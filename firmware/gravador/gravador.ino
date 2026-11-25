// Gravador de campo: segure o botão para gravar e solte para parar. O áudio vai
// para o cartão microSD (ou para a memória interna da placa, ver USAR_CARTAO)
// e, de lá, para o Noteless como nota (POST /api/org/:orgId/ocorrencias), igual
// à gravação pelo site. Sem Wi-Fi, as gravações esperam guardadas e sobem
// sozinhas quando a rede voltar. No código, "cartão" (cartaoOk, montarCartao...)
// é onde as gravações ficam, seja ele o microSD ou a memória interna.
//
// Ligações (todas do lado esquerdo da placa — o direito fica coberto na protoboard):
//   microfone I2S INMP441: VDD -> 3V3 (nunca 5V)  GND -> GND  L/R -> GND
//                          SCK -> D23  WS -> D22  SD -> D21
//   módulo microSD (3,3 V), só com USAR_CARTAO 1: 3V3 -> 3V3  GND -> GND  CS -> D5
//                           CLK -> TX2 (GPIO17)  MOSI -> RX2 (GPIO16)  MISO -> D4
//   botão -> D18 e GND (pull-up interno; pernas em diagonal)
//
// Botão: segurado = grava até soltar | clique (menos de 0,5 s) não grava | 5
// cliques seguidos = trocar o Wi-Fi pelo celular (ver configuracao.ino). Sem rede
// salva, a placa já liga nesse modo, abrindo a rede "Noteless-XXXX".
//
// LED azul: aceso fixo = tudo certo (Wi-Fi, aprovada no Noteless e cartão) |
// apagado = algum problema: sem Wi-Fi, aguardando aprovação ou cartão (tenta
// de novo sozinho; o monitor serial diz qual) | respirando (acende e apaga suave) =
// botão apertado, gravando | piscando rápido = modo configuração do Wi-Fi.
//
// Três tarefas: a de captura lê o microfone sem parar (o cartão às vezes demora
// para gravar, e o microfone não espera); o loop cuida do botão e grava no
// cartão; a de rede (rede.ino) conecta, acerta o relógio, se apresenta ao
// Noteless (situacao.ino) e esvazia a fila (fila.ino). Enviar nunca trava o botão.
#include <DNSServer.h>
#include <ESP_I2S.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <Update.h>
#include <WiFiClientSecure.h>
#include <esp_ota_ops.h>
#include <esp_wifi.h>
#include <mbedtls/base64.h>
#include <mbedtls/pk.h>
#include <mbedtls/sha256.h>
#include <sys/time.h>

#include <vector>

#include "buffer_audio.h"
#include "segredos.h"

// Versão do firmware: aumente a cada versão publicada no Noteless (a mesma
// versão não publica duas vezes). Fica marcada no binário: o Noteless a lê de
// dentro do .bin ao publicar (apps/api, regras/firmware.ts).
#define FIRMWARE_VERSAO "1.0.3"
const char MARCA_VERSAO[] = "NOTELESS_FW_VERSAO=" FIRMWARE_VERSAO;

// Onde ficam as gravações: 1 = cartão microSD; 0 = a memória interna da placa,
// em LittleFS na partição de partitions.csv (2,5 MB, perto de 1 min e 15 s por
// nota com a fila vazia), para quando não há cartão bom (os primeiros testados
// na protoboard falharam, 11/2026).
#define USAR_CARTAO 1
#if USAR_CARTAO
#include <SD.h>
#include <SPI.h>
fs::SDFS &memoria = SD;
#else
#include <LittleFS.h>
fs::LittleFSFS &memoria = LittleFS;
#endif

const int LED = 2;
const int BOTAO = 18;
const int PINO_SCK = 23, PINO_WS = 22, PINO_SD = 21;                          // microfone
const int CARTAO_CS = 5, CARTAO_SCK = 17, CARTAO_MOSI = 16, CARTAO_MISO = 4;  // microSD

// A taxa do Whisper. A 8 kHz somem os sons de s, z, f e x ("fazenda" saía
// "fadazinha"); 16 bits por amostra, 32 KB por segundo.
const int TAXA = 16000;      // Hz
const int QUADROS = 256;     // quadros estéreo lidos do I2S por vez (16 ms)
// Botão preso ou esquecido: para sozinho. O Noteless (Vercel) recebe até 4,5 MB
// por envio; 2 min são 3,8 MB.
const int LIMITE_SEG = 120;
const int CLIQUE_MS = 500;   // solto antes disso é clique, não gravação
const int CLIQUES_PARA_TROCAR_WIFI = 5;
const int ENTRE_CLIQUES_MS = 1000;  // mais que isso entre um e outro: a contagem recomeça
const char *PASTA_FILA = "/fila";             // prontas, esperando envio
const char *PASTA_ERRO = "/erro";             // recusadas pelo Noteless: guardadas, fora da fila
const char *ARQUIVO_BRUTO = "/gravando.raw";  // a gravação em andamento (já é o .wav; o tamanho entra no fim)

// Uma gravação terminada, antes de virar arquivo da fila.
struct Gravacao {
  size_t amostras;
  uint32_t inicioMs;       // millis() no começo
  uint64_t inicioEpochMs;  // hora real do começo; 0 = relógio ainda não acertado
};

// Resultado de um envio (rede.ino).
enum Resultado { ENVIADO, TENTAR_DEPOIS, RECUSADO };

Preferences prefs;
String wifiNome, wifiSenha;  // a rede escolhida pelo usuário, guardada na flash
// Quem a placa é para o Noteless (pareamento.ino): o MAC, "Gravador <série>
// <segredo>" para o cabeçalho Authorization e o código para aprovar.
String serieDaPlaca, credencialDaPlaca, codigoDaPlaca;
uint32_t bootId = 0;         // conta os boots: nomeia gravação feita antes do relógio acertar

I2SClass i2s;
int canal = 0;  // o canal em que o microfone fala (L/R no GND = esquerdo)
#if USAR_CARTAO
SPIClass spiCartao(HSPI);
#endif

BufferAudio bufferAudio;         // captura -> loop: amostras de 16 bits
volatile bool gravando = false;
volatile uint32_t perdidas = 0;  // amostras que não couberam (cartão lento demais)

// Estado para o LED: o loop e a tarefa de rede escrevem.
volatile bool cartaoOk = false;
volatile bool online = false;  // Wi-Fi + aprovada no Noteless, com empresa
volatile bool envioPausado = false;   // pausado no Noteless (situacao.ino): as gravações esperam no cartão
volatile bool wifiDesligado = false;  // "wifi off" no monitor serial: nada sai da placa, tudo fica no cartão
volatile int naFila = 0;       // gravações esperando envio
float cartaoLivreGb = 0;        // medido ao montar (medir de novo leva segundos)
volatile bool loopUsandoCartao = false;  // gravando ou comando da serial: a tarefa de rede não remonta
volatile bool falhaNoRegistro = false;   // a escrita do registro falhou (registro.ino avisa a tarefa de rede)
volatile bool haPendentes = false;       // gravação que não virou .wav, guardada como .raw na fila

// Últimas linhas ERRO:/AVISO: na memória (registro.ino), para o histórico no Noteless.
const int ERROS_GUARDADOS = 10;
struct LinhaErro {
  char texto[160];
  uint32_t ms;
};

uint32_t histograma[256];  // |amostra| em faixas de 128, para medir o volume

void escrever32(uint8_t *p, uint32_t v) { for (int i = 0; i < 4; i++) p[i] = v >> (8 * i); }
void escrever16(uint8_t *p, uint16_t v) { p[0] = v; p[1] = v >> 8; }

// WAV μ-law (G.711) mono: 1 byte por amostra, metade do PCM de 16 bits, com a
// mesma faixa útil para a fala (a escala é logarítmica, como a do ouvido). Com
// Wi-Fi fraco, o envio termina antes de a conexão cair. O Noteless converte em
// PCM na chegada. n = bytes de áudio depois do cabeçalho.
const size_t CABECALHO_WAV = 44;
const size_t BYTES_POR_AMOSTRA = 1;
void cabecalhoWav(uint8_t *p, uint32_t n) {
  memcpy(p, "RIFF", 4); escrever32(p + 4, 36 + n); memcpy(p + 8, "WAVEfmt ", 8);
  escrever32(p + 16, 16); escrever16(p + 20, 7); escrever16(p + 22, 1);  // 7 = μ-law
  escrever32(p + 24, TAXA); escrever32(p + 28, TAXA); escrever16(p + 32, 1); escrever16(p + 34, 8);
  memcpy(p + 36, "data", 4); escrever32(p + 40, n);
}

// Amostra de 16 bits → μ-law (codificador G.711 de referência).
uint8_t muLaw(int16_t amostra) {
  const int VIES = 0x84, TETO = 32635;
  int sinal = (amostra >> 8) & 0x80;
  int v = sinal ? -(int)amostra : amostra;
  if (v > TETO) v = TETO;
  v += VIES;
  int expoente = 7;
  for (int mascara = 0x4000; (v & mascara) == 0 && expoente > 0; mascara >>= 1) expoente--;
  int mantissa = (v >> (expoente + 3)) & 0x0F;
  return ~(sinal | (expoente << 4) | mantissa);
}

// Põe o tamanho certo no cabeçalho de um .wav que já está escrito (gravação
// terminada, ou interrompida e recuperada).
bool fecharWav(File &f, size_t amostras) {
  uint8_t cab[CABECALHO_WAV];
  cabecalhoWav(cab, amostras * BYTES_POR_AMOSTRA);
  return f.seek(0) && f.write(cab, sizeof(cab)) == sizeof(cab);
}

// Memória que serve para tudo. O ESP.getFreeHeap() soma os ~33 KB de IRAM, que
// nem o Wi-Fi nem a conexão segura conseguem usar.
uint32_t memoriaLivre() { return heap_caps_get_free_size(MALLOC_CAP_8BIT); }

// O relógio é acertado pela internet (rede.ino). Antes disso, conta de 1970.
bool relogioValido() { return time(nullptr) > 1700000000; }

uint64_t agoraEpochMs() {
  timeval tv;
  gettimeofday(&tv, nullptr);
  if (tv.tv_sec < 1700000000) return 0;
  return (uint64_t)tv.tv_sec * 1000 + tv.tv_usec / 1000;
}

// Todo o LED passa por aqui: com brilho (PWM) no pino, digitalWrite não vale mais.
void led(uint8_t brilho) { analogWrite(LED, brilho); }

// Brilho de "respirando" (gravando): acende e apaga suave, uma vez por segundo,
// começando apagado — o aperto aparece na hora, com o LED aceso ou não.
uint8_t respirando(uint32_t ms) {
  float onda = (1 - cosf(2 * PI * (ms % 1000) / 1000.0f)) / 2;
  return (uint8_t)(255 * onda * onda);  // ao quadrado: o olho vê a subida mais por igual
}

// Deu errado: o LED apaga (é o sinal de problema) e o monitor serial diz o quê.
void avisarFalha() { led(0); }

// Lê o microfone sem parar; gravando, passa as amostras para o loop por um
// buffer de ~1 s (buffer_audio.h) — o cartão às vezes leva centenas de ms para gravar, e o
// microfone não espera. O INMP441 manda 24 bits no alto de cada palavra de
// 32; >> 14 dá 16 bits com 4x de ganho (fala a um palmo fica com folga; só
// estoura soprando no microfone).
void tarefaCaptura(void *) {
  static int32_t quadros[2 * QUADROS];  // esquerdo, direito, esquerdo, ...
  static int16_t amostras[QUADROS];
  while (true) {
    size_t n = i2s.readBytes((char *)quadros, sizeof(quadros)) / 8;
    if (!gravando || n == 0) continue;
    for (size_t i = 0; i < n; i++) amostras[i] = constrain(quadros[2 * i + canal] >> 14, -32768, 32767);
    size_t foi = bufferAudio.por(amostras, n);
    if (foi < n) perdidas = perdidas + (n - foi);
  }
}

// O áudio começa no aperto do botão: enquanto não dá para saber se é clique ou
// gravação, as amostras esperam no buffer, e a primeira palavra não se perde.
void comecarCaptura(Gravacao &g) {
  g.inicioMs = millis();
  g.inicioEpochMs = agoraEpochMs();
  bufferAudio.zerar();
  perdidas = 0;
  gravando = true;
}

// Grava no cartão o que está sendo capturado até soltar o botão (ou até o
// limite), já sem os graves (passa-alta ~100 Hz: deriva lenta e zumbido de 60
// Hz). O arquivo já é o .wav (μ-law): o cabeçalho vai na frente e ganha o
// tamanho no fim. Volume não se acerta — o μ-law guarda a fala baixa e a alta
// com a mesma precisão relativa, e o Whisper não depende dele.
bool gravar(Gravacao &g) {
  size_t limite = (size_t)LIMITE_SEG * TAXA;
#if !USAR_CARTAO
  // A memória interna é pequena: a gravação para antes de enchê-la (1 byte
  // por amostra). A folga fica para o registro (até 2 x 64 KB, registro.ino) e
  // para o próprio LittleFS.
  const size_t FOLGA = 160 * 1024;
  size_t livre = memoria.totalBytes() - memoria.usedBytes();
  cartaoLivreGb = livre / 1e9;
  limite = min(limite, livre > FOLGA ? (livre - FOLGA) / BYTES_POR_AMOSTRA : 0);
  if (limite < (size_t)TAXA) {
    gravando = false;
    registrar("AVISO: memória cheia (%u KB livres): espere as notas da fila subirem.", (unsigned)(livre / 1024));
    return false;
  }
#endif
  File bruto = memoria.open(ARQUIVO_BRUTO, FILE_WRITE);
  uint8_t cab[CABECALHO_WAV];
  cabecalhoWav(cab, 0);
  if (!bruto || bruto.write(cab, sizeof(cab)) != sizeof(cab)) {
    gravando = false;
    if (bruto) bruto.close();
    cartaoFalhou("criar a gravação");
    return false;
  }
  memset(histograma, 0, sizeof(histograma));
  // Os 100 ms de cada ponta ficam fora do histograma: o barulho do botão, ao
  // apertar e ao soltar, deixaria a fala baixinha. As faixas mais novas esperam
  // aqui até deixarem de ser o fim.
  static uint8_t recentes[TAXA / 10];
  static int16_t bloco[2048];
  static uint8_t comprimido[2048];  // o mesmo bloco em μ-law, que vai para o cartão
  const float k = 1 / (1 + 2 * PI * 100.0f / TAXA);  // RC/(RC+dt) para ~100 Hz
  float ant = 0, y = 0;
  size_t n = 0;
  bool falhou = false;

  registrar("Gravando... (solte o botão para parar)");
  while (true) {
    size_t m = bufferAudio.tirar(bloco, sizeof(bloco) / sizeof(int16_t), 300);
    for (size_t i = 0; i < m; i++, n++) {
      float x = bloco[i];
      if (n == 0) ant = x;
      y = k * (y + x - ant);
      ant = x;
      int v = constrain((int)lroundf(y), -32768, 32767);
      bloco[i] = v;
      size_t r = n % (TAXA / 10);
      if (n >= TAXA / 5) histograma[recentes[r]]++;
      recentes[r] = min(255, abs(v) / 128);
      comprimido[i] = muLaw(v);
    }
    if (m && bruto.write(comprimido, m) != m) {
      falhou = true;
      break;
    }
    led(respirando(millis() - g.inicioMs));
    // Soltou. A segunda leitura descarta um contato falhando por um instante.
    if (digitalRead(BOTAO) == HIGH) {
      delay(20);
      if (digitalRead(BOTAO) == HIGH) break;
    }
    if (n >= limite) {
      if (limite < (size_t)LIMITE_SEG * TAXA) registrar("AVISO: memória quase cheia: parou sozinho em %u s.", (unsigned)(n / TAXA));
      else registrar("Limite de %d min atingido: parou sozinho.\n", LIMITE_SEG / 60);
      break;
    }
  }
  gravando = false;
  if (!falhou && !fecharWav(bruto, n)) falhou = true;
  bruto.close();
  if (falhou) {
    // O que já foi gravado fica em ARQUIVO_BRUTO: montarCartao o guarda para recuperar.
    cartaoFalhou("gravar o áudio (cheio, protegido ou com mau contato)");
    return false;
  }
  g.amostras = n;
  return true;
}

// Nome = quando foi gravada: "t" + hora real em ms; antes do relógio acertar,
// "b" + boot + millis (a tarefa de rede troca pelo "t" assim que acertar).
String nomeDaGravacao(const Gravacao &g) {
  uint64_t inicio = g.inicioEpochMs;
  if (!inicio && relogioValido()) inicio = agoraEpochMs() - (millis() - g.inicioMs);  // acertou durante a gravação
  char nome[48];
  if (inicio) snprintf(nome, sizeof(nome), "%s/t%llu.wav", PASTA_FILA, (unsigned long long)inicio);
  else snprintf(nome, sizeof(nome), "%s/b%06lu-%010lu.wav", PASTA_FILA, (unsigned long)bootId, (unsigned long)g.inicioMs);
  return nome;
}

// Volume da fala em dBFS, pelo percentil 99,9 e não pelo pico: um estalo do
// botão não conta. Só para o registro ("baixo, fale mais perto").
float volumeDb(const uint32_t *hist, size_t n) {
  int faixa = 255;
  for (uint32_t acumulado = 0; faixa > 0; faixa--) {
    acumulado += hist[faixa];
    if (acumulado > n / 1000) break;
  }
  return 20 * log10f((faixa + 1) * 128.0f / 32768);
}

// A gravação já é o .wav: entrar na fila é só ganhar o nome (renomear não
// copia nada, e a fila nunca pega arquivo pela metade).
void finalizar(const Gravacao &g) {
  size_t n = g.amostras;
  if (n < TAXA / 2) {
    registrar("Curto demais (menos de 0,5 s), ignorado.");
    memoria.remove(ARQUIVO_BRUTO);
    return;
  }
  String nome = nomeDaGravacao(g);
  if (!memoria.rename(ARQUIVO_BRUTO, nome)) {
    // Não apaga nada: ARQUIVO_BRUTO fica, e montarCartao o guarda na fila para
    // recuperar quando o cartão voltar.
    cartaoFalhou("dar nome à gravação");
    registrar("AVISO: a gravação de %.1f s ficou guardada no cartão e sobe quando ele voltar.", (float)n / TAXA);
    return;
  }
  naFila = naFila + 1;
  float db = volumeDb(histograma, n);
  registrar("Gravou %.1f s | volume %.0f dBFS%s -> %s\n", (float)n / TAXA, db, db < -40 ? " — baixo, fale mais perto" : "",
            nome.c_str());
  if (perdidas) registrar("AVISO: %lu amostras perdidas — o cartão demorou para gravar.\n", (unsigned long)perdidas);
}

// O LED com o botão solto: aceso só com tudo certo (Wi-Fi, aprovada e cartão).
bool ledParado() { return cartaoOk && online; }

void setup() {
  pinMode(LED, OUTPUT);
  pinMode(BOTAO, INPUT_PULLUP);
  Serial.begin(115200);
  delay(500);
  Serial.println();
  iniciarRegistro();

  prefs.begin("noteless", false);
  bootId = prefs.getUInt("boot", 0) + 1;
  prefs.putUInt("boot", bootId);
  bool trocarWifi = prefs.getBool("trocarWifi", false);
  if (trocarWifi) prefs.remove("trocarWifi");
  prefs.end();

  // A marca vem daqui (e não de FIRMWARE_VERSAO): usada, ela fica no binário.
  registrar("=== Noteless - gravador de campo %s === boot %lu: %s | memória livre %u", MARCA_VERSAO + 19, (unsigned long)bootId,
            motivoDoBoot(), (unsigned)memoriaLivre());
  conferirVersaoNova();  // veio de uma atualização? (versao.ino)
  carregarIdentidade();  // antes do Wi-Fi e do microfone (ver pareamento.ino); o portal mostra o código

  // Sem rede salva (ou depois dos 5 cliques): configurar pelo celular antes de
  // tudo. configurarWifi() não volta — reinicia a placa no fim.
  carregarRede();
  if (wifiNome.isEmpty() || trocarWifi) configurarWifi();
  registrar("Rede salva: \"%s\" (para trocar, clique %d vezes seguidas no botão)\n", wifiNome.c_str(), CLIQUES_PARA_TROCAR_WIFI);
  if (wifiDesligado) registrar("AVISO: Wi-Fi desligado (\"wifi off\"): as gravações ficam no cartão. \"wifi on\" no monitor serial religa.");

  // Microfone: I2S padrão, 32 bits por canal. Fica rodando direto; gravar é só ler.
  i2s.setPins(PINO_SCK, PINO_WS, -1, PINO_SD);
  if (!i2s.begin(I2S_MODE_STD, TAXA, I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_STEREO)) {
    registrar("ERRO: o I2S não iniciou.");
    while (true) {
      avisarFalha();
      delay(1000);
    }
  }
  delay(200);  // o INMP441 leva ~85 ms para acordar
  static int32_t quadros[2 * QUADROS];
  double energia[2] = {0, 0};
  for (int bloco = 0; bloco < 8; bloco++) {
    size_t q = i2s.readBytes((char *)quadros, sizeof(quadros)) / 8;
    for (size_t i = 0; i < q; i++)
      for (int c = 0; c < 2; c++) energia[c] += fabs((double)(quadros[2 * i + c] >> 8));
  }
  canal = energia[1] > energia[0] ? 1 : 0;
  if (energia[0] == 0 && energia[1] == 0)
    registrar("AVISO: microfone mudo. Confira SD, SCK, WS e a alimentação (3V3 e GND).");

  montarCartao();

  // ~1 s de áudio de folga para o cartão.
  if (!bufferAudio.criar()) registrar("ERRO: sem memória para o buffer do microfone.");
  else if (!bufferAudio.naIram()) registrar("AVISO: o buffer do microfone não coube na IRAM: sobra menos memória para o envio.");
  xTaskCreatePinnedToCore(tarefaCaptura, "captura", 4096, nullptr, 5, nullptr, 1);
  // Pilha da rede: medida, a conexão segura usa ~4 KB dela (o resto vem do
  // heap); 10 KB dá folga e deixa mais heap para o envio, que precisa de ~52 KB
  // só para abrir a conexão e de folga para o Wi-Fi depois (ver buffer_audio.h).
  xTaskCreatePinnedToCore(tarefaRede, "rede", 10240, nullptr, 1, nullptr, 1);
  registrar("Pronto: segure o botão para gravar e solte para parar (até %d min, microfone no canal %s).\n",
                LIMITE_SEG / 60, canal ? "direito" : "esquerdo");
}

// Segurado, grava até soltar. Solto antes de CLIQUE_MS, é clique: não grava, e
// CLIQUES_PARA_TROCAR_WIFI seguidos abrem o modo de trocar o Wi-Fi.
void tratarBotao() {
  static int cliques = 0;
  static uint32_t ultimoClique = 0;

  Gravacao g;
  comecarCaptura(g);
  led(respirando(0));  // resposta na hora, inclusive para o clique
  delay(30);           // debounce
  if (digitalRead(BOTAO) != LOW) {
    gravando = false;
    return;
  }
  while (digitalRead(BOTAO) == LOW && millis() - g.inicioMs < CLIQUE_MS) {
    led(respirando(millis() - g.inicioMs));
    delay(5);
  }

  if (digitalRead(BOTAO) != LOW) {
    gravando = false;
    cliques = millis() - ultimoClique < ENTRE_CLIQUES_MS ? cliques + 1 : 1;
    ultimoClique = millis();
    registrar("Clique %d de %d para trocar o Wi-Fi.\n", cliques, CLIQUES_PARA_TROCAR_WIFI);
    if (cliques >= CLIQUES_PARA_TROCAR_WIFI) pedirTrocaDeWifi();  // não volta: reinicia direto no modo configuração
    return;
  }

  cliques = 0;
  // Marca antes de olhar o cartão: a tarefa de rede só remonta com ele livre.
  loopUsandoCartao = true;
  if (!cartaoOk) {
    // Não tenta montar aqui: com o cartão travado, montar leva até ~30 s e o
    // botão ficaria sem resposta. A tarefa de rede tenta de novo sozinha.
    loopUsandoCartao = false;
    gravando = false;
    registrar(USAR_CARTAO ? "Sem cartão, não dá para gravar: confira se ele está encaixado até o clique (se ele travou, desligue e ligue a USB)."
                          : "A memória interna não montou, não dá para gravar: desligue e ligue a USB.");
    while (digitalRead(BOTAO) == LOW) delay(10);
    avisarFalha();
    return;
  }
  bool ok = gravar(g);
  while (digitalRead(BOTAO) == LOW) delay(10);  // no limite de tempo, ainda pode estar segurando
  if (ok) finalizar(g);
  loopUsandoCartao = false;
  if (!ok) avisarFalha();  // o cartão falhou: cartaoFalhou já avisou o quê
}

void loop() {
  atenderSerial();
  led(ledParado() ? 255 : 0);
  if (digitalRead(BOTAO) == LOW) tratarBotao();
  // Cartão que falhou: quem tenta montar de novo é a tarefa de rede (rede.ino),
  // para o botão nunca ficar preso esperando um cartão travado.
  delay(10);
}
