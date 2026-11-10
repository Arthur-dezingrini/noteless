// Gravador de campo: segure o botão para gravar e solte para parar. O áudio vai
// para o cartão microSD e, de lá, para o Noteless como nota
// (POST /api/org/:orgId/ocorrencias), igual à gravação pelo site. Sem Wi-Fi,
// as gravações esperam no cartão e sobem sozinhas quando a rede voltar.
//
// Ligações (todas do lado esquerdo da placa — o direito fica coberto na protoboard):
//   microfone I2S INMP441: VDD -> 3V3 (nunca 5V)  GND -> GND  L/R -> GND
//                          SCK -> D23  WS -> D22  SD -> D21
//   módulo microSD (3,3 V): 3V3 -> 3V3  GND -> GND  CS -> D5  CLK -> TX2 (GPIO17)
//                           MOSI -> RX2 (GPIO16)  MISO -> D4
//   botão -> D18 e GND (pull-up interno; pernas em diagonal)
//
// Botão: segurado = grava até soltar | clique (menos de 0,5 s) não grava | 5
// cliques seguidos = trocar o Wi-Fi pelo celular (ver configuracao.ino). Sem rede
// salva, a placa já liga nesse modo, abrindo a rede "Noteless-XXXX".
//
// LED azul: aceso = pronto e tudo enviado | apagado = sem Wi-Fi ou sem servidor
// (tenta de novo sozinho) | piscando = gravando | uma piscadinha a cada 2 s =
// gravação guardada esperando para subir | piscando rápido sem parar = problema
// no cartão | 3 piscadas lentas = não deu para gravar | invertido enquanto o botão
// está apertado = o aperto foi percebido | piscando devagar sem parar = esperando
// o Wi-Fi ser configurado.
//
// Três tarefas: a de captura lê o microfone sem parar (o cartão às vezes demora
// para gravar, e o microfone não espera); o loop cuida do botão e grava no
// cartão; a de rede (rede.ino) conecta, acerta o relógio, entra no Noteless e
// esvazia a fila (fila.ino). Enviar nunca trava o botão.
#include <DNSServer.h>
#include <ESP_I2S.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <SD.h>
#include <SPI.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <freertos/stream_buffer.h>
#include <sys/time.h>

#include <vector>

#include "segredos.h"

const int LED = 2;
const int BOTAO = 18;
const int PINO_SCK = 23, PINO_WS = 22, PINO_SD = 21;                          // microfone
const int CARTAO_CS = 5, CARTAO_SCK = 17, CARTAO_MOSI = 16, CARTAO_MISO = 4;  // microSD

const int TAXA = 8000;       // Hz — o Whisper não precisa de mais para voz
const int QUADROS = 256;     // quadros estéreo lidos do I2S por vez (32 ms)
const int LIMITE_SEG = 300;  // botão preso ou esquecido: para sozinho em 5 min
const int CLIQUE_MS = 500;   // solto antes disso é clique, não gravação
const int CLIQUES_PARA_TROCAR_WIFI = 5;
const int ENTRE_CLIQUES_MS = 1000;  // mais que isso entre um e outro: a contagem recomeça
const char *PASTA_FILA = "/fila";             // prontas, esperando envio
const char *PASTA_ERRO = "/erro";             // recusadas pelo Noteless: guardadas, fora da fila
const char *ARQUIVO_BRUTO = "/gravando.raw";  // a gravação em andamento, antes do volume

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
uint32_t bootId = 0;         // conta os boots: nomeia gravação feita antes do relógio acertar

I2SClass i2s;
int canal = 0;  // o canal em que o microfone fala (L/R no GND = esquerdo)
SPIClass spiCartao(HSPI);

StreamBufferHandle_t sbAudio;    // captura -> loop: amostras de 16 bits
volatile bool gravando = false;
volatile uint32_t perdidas = 0;  // amostras que não couberam (cartão lento demais)

// Estado para o LED: o loop e a tarefa de rede escrevem.
volatile bool cartaoOk = false;
volatile bool online = false;  // Wi-Fi + login no Noteless
volatile int naFila = 0;       // gravações esperando envio

uint32_t histograma[256];  // |amostra| em faixas de 128, para acertar o volume

void escrever32(uint8_t *p, uint32_t v) { for (int i = 0; i < 4; i++) p[i] = v >> (8 * i); }
void escrever16(uint8_t *p, uint16_t v) { p[0] = v; p[1] = v >> 8; }

// WAV PCM mono, 8 bits sem sinal (128 = silêncio).
void cabecalhoWav(uint8_t *p, uint32_t n) {
  memcpy(p, "RIFF", 4); escrever32(p + 4, 36 + n); memcpy(p + 8, "WAVEfmt ", 8);
  escrever32(p + 16, 16); escrever16(p + 20, 1); escrever16(p + 22, 1);
  escrever32(p + 24, TAXA); escrever32(p + 28, TAXA); escrever16(p + 32, 1); escrever16(p + 34, 8);
  memcpy(p + 36, "data", 4); escrever32(p + 40, n);
}

// O relógio é acertado pela internet (rede.ino). Antes disso, conta de 1970.
bool relogioValido() { return time(nullptr) > 1700000000; }

uint64_t agoraEpochMs() {
  timeval tv;
  gettimeofday(&tv, nullptr);
  if (tv.tv_sec < 1700000000) return 0;
  return (uint64_t)tv.tv_sec * 1000 + tv.tv_usec / 1000;
}

// Sem o monitor serial, o LED é o único jeito de saber que algo deu errado.
void avisarFalha() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED, HIGH); delay(300);
    digitalWrite(LED, LOW); delay(300);
  }
}

// Lê o microfone sem parar; gravando, passa as amostras para o loop por um
// buffer de 2 s — o cartão às vezes leva centenas de ms para gravar, e o
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
    size_t bytes = n * sizeof(int16_t);
    size_t foi = xStreamBufferSend(sbAudio, amostras, bytes, 0);
    if (foi < bytes) perdidas = perdidas + (bytes - foi) / sizeof(int16_t);
  }
}

// O áudio começa no aperto do botão: enquanto não dá para saber se é clique ou
// gravação, as amostras esperam no buffer, e a primeira palavra não se perde.
void comecarCaptura(Gravacao &g) {
  g.inicioMs = millis();
  g.inicioEpochMs = agoraEpochMs();
  xStreamBufferReset(sbAudio);
  perdidas = 0;
  gravando = true;
}

// Grava no cartão o que está sendo capturado até soltar o botão (ou até o
// limite), já sem os graves (passa-alta ~100 Hz: deriva lenta e zumbido de 60
// Hz). O volume só é acertado no fim (finalizar), quando se sabe o quanto a fala
// subiu.
bool gravar(Gravacao &g) {
  File bruto = SD.open(ARQUIVO_BRUTO, FILE_WRITE);
  if (!bruto) {
    gravando = false;
    return false;
  }
  memset(histograma, 0, sizeof(histograma));
  // Os 100 ms de cada ponta ficam fora do histograma: o barulho do botão, ao
  // apertar e ao soltar, deixaria a fala baixinha. As faixas mais novas esperam
  // aqui até deixarem de ser o fim.
  static uint8_t recentes[TAXA / 10];
  static int16_t bloco[2048];
  const float k = 0.927f;  // RC/(RC+dt) para ~100 Hz a 8 kHz
  float ant = 0, y = 0;
  size_t n = 0;
  bool falhou = false;

  Serial.println("Gravando... (solte o botão para parar)");
  while (true) {
    size_t m = xStreamBufferReceive(sbAudio, bloco, sizeof(bloco), pdMS_TO_TICKS(300)) / sizeof(int16_t);
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
    }
    if (m && bruto.write((uint8_t *)bloco, m * sizeof(int16_t)) != m * sizeof(int16_t)) {
      falhou = true;
      break;
    }
    digitalWrite(LED, (millis() / 250) % 2);
    // Soltou. A segunda leitura descarta um contato falhando por um instante.
    if (digitalRead(BOTAO) == HIGH) {
      delay(20);
      if (digitalRead(BOTAO) == HIGH) break;
    }
    if (n >= (size_t)LIMITE_SEG * TAXA) {
      Serial.printf("Limite de %d min atingido: parou sozinho.\n", LIMITE_SEG / 60);
      break;
    }
  }
  gravando = false;
  bruto.close();
  digitalWrite(LED, LOW);
  if (falhou) {
    Serial.println("ERRO: o cartão parou de gravar (cheio, protegido ou com mau contato).");
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

// Acerta o volume e grava o arquivo da fila: WAV PCM de 8 bits, o formato que
// o Noteless e os navegadores tocam. O volume se baseia no percentil 99,9,
// não no pico: um estalo do botão não deixa a fala baixinha.
void finalizar(const Gravacao &g) {
  size_t n = g.amostras;
  if (n < TAXA / 2) {
    Serial.println("Curto demais (menos de 0,5 s), ignorado.");
    SD.remove(ARQUIVO_BRUTO);
    return;
  }
  int faixa = 255;
  for (uint32_t acumulado = 0; faixa > 0; faixa--) {
    acumulado += histograma[faixa];
    if (acumulado > n / 1000) break;
  }
  float ref = (faixa + 1) * 128.0f;
  float escala = 120.0f / ref;

  String nome = nomeDaGravacao(g);
  String temporario = nome + ".tmp";  // a fila só pega .wav: nunca sobe arquivo pela metade
  File bruto = SD.open(ARQUIVO_BRUTO, FILE_READ);
  File saida = SD.open(temporario, FILE_WRITE);
  const char *erro = !bruto ? "abrir a gravação" : !saida ? "criar o arquivo" : nullptr;
  if (!erro) {
    uint8_t cab[44];
    cabecalhoWav(cab, n);
    if (saida.write(cab, sizeof(cab)) != sizeof(cab)) erro = "escrever o cabeçalho";
  }
  static int16_t entrada[1024];
  static uint8_t pcm8[1024];
  for (size_t feitas = 0; !erro && feitas < n; feitas += min((size_t)1024, n - feitas)) {
    size_t m = min((size_t)1024, n - feitas);
    if (bruto.read((uint8_t *)entrada, m * sizeof(int16_t)) != m * sizeof(int16_t)) {
      erro = "ler a gravação";
      break;
    }
    for (size_t i = 0; i < m; i++) pcm8[i] = constrain((int)lroundf(entrada[i] * escala), -127, 127) + 128;
    if (saida.write(pcm8, m) != m) erro = "escrever o áudio";
  }
  size_t tamBruto = bruto ? bruto.size() : 0;
  if (bruto) bruto.close();
  if (saida) saida.close();
  if (!erro && !SD.rename(temporario, nome)) erro = "dar nome ao arquivo";
  if (erro) {
    Serial.printf("ERRO: não consegui %s no cartão (%s; gravação com %u de %u bytes).\n", erro, strerror(errno),
                  (unsigned)tamBruto, (unsigned)(n * sizeof(int16_t)));
    SD.remove(temporario);
    cartaoOk = false;
    avisarFalha();
    return;
  }
  SD.remove(ARQUIVO_BRUTO);
  naFila = naFila + 1;
  float db = 20 * log10f(ref / 32768);
  Serial.printf("Gravou %.1f s | volume %.0f dBFS%s -> %s\n", (float)n / TAXA, db, db < -40 ? " — baixo, fale mais perto" : "",
                nome.c_str());
  if (perdidas) Serial.printf("AVISO: %lu amostras perdidas — o cartão demorou para gravar.\n", (unsigned long)perdidas);
}

// O LED com o botão solto.
bool ledParado() {
  uint32_t t = millis();
  if (!cartaoOk) return (t / 100) % 2;   // problema no cartão
  if (naFila > 0) return t % 2000 < 80;  // gravação esperando para subir
  return online;                         // aceso = pronto e tudo enviado
}

void setup() {
  pinMode(LED, OUTPUT);
  pinMode(BOTAO, INPUT_PULLUP);
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== Noteless - gravador de campo ===");

  prefs.begin("noteless", false);
  bootId = prefs.getUInt("boot", 0) + 1;
  prefs.putUInt("boot", bootId);
  bool trocarWifi = prefs.getBool("trocarWifi", false);
  if (trocarWifi) prefs.remove("trocarWifi");
  prefs.end();

  // Sem rede salva (ou depois dos 5 cliques): configurar pelo celular antes de
  // tudo. configurarWifi() não volta — reinicia a placa no fim.
  carregarRede();
  if (wifiNome.isEmpty() || trocarWifi) configurarWifi();
  Serial.printf("Rede salva: \"%s\" (para trocar, clique %d vezes seguidas no botão)\n", wifiNome.c_str(), CLIQUES_PARA_TROCAR_WIFI);

  // Microfone: I2S padrão, 32 bits por canal. Fica rodando direto; gravar é só ler.
  i2s.setPins(PINO_SCK, PINO_WS, -1, PINO_SD);
  if (!i2s.begin(I2S_MODE_STD, TAXA, I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_STEREO)) {
    Serial.println("ERRO: o I2S não iniciou.");
    while (true) avisarFalha();
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
    Serial.println("AVISO: microfone mudo. Confira SD, SCK, WS e a alimentação (3V3 e GND).");

  montarCartao();

  // 2 s de áudio de folga para o cartão; o loop acorda a cada 64 ms para ver o botão.
  sbAudio = xStreamBufferCreate(32 * 1024, 1024);
  xTaskCreatePinnedToCore(tarefaCaptura, "captura", 4096, nullptr, 5, nullptr, 1);
  xTaskCreatePinnedToCore(tarefaRede, "rede", 16384, nullptr, 1, nullptr, 1);
  Serial.printf("Pronto: segure o botão para gravar e solte para parar (até %d min, microfone no canal %s).\n",
                LIMITE_SEG / 60, canal ? "direito" : "esquerdo");
}

// Segurado, grava até soltar. Solto antes de CLIQUE_MS, é clique: não grava, e
// CLIQUES_PARA_TROCAR_WIFI seguidos abrem o modo de trocar o Wi-Fi.
void tratarBotao() {
  static int cliques = 0;
  static uint32_t ultimoClique = 0;

  Gravacao g;
  comecarCaptura(g);
  digitalWrite(LED, !ledParado());  // resposta na hora, inclusive para o clique
  delay(30);                        // debounce
  if (digitalRead(BOTAO) != LOW) {
    gravando = false;
    return;
  }
  while (digitalRead(BOTAO) == LOW && millis() - g.inicioMs < CLIQUE_MS) delay(5);

  if (digitalRead(BOTAO) != LOW) {
    gravando = false;
    cliques = millis() - ultimoClique < ENTRE_CLIQUES_MS ? cliques + 1 : 1;
    ultimoClique = millis();
    Serial.printf("Clique %d de %d para trocar o Wi-Fi.\n", cliques, CLIQUES_PARA_TROCAR_WIFI);
    if (cliques >= CLIQUES_PARA_TROCAR_WIFI) pedirTrocaDeWifi();  // não volta: reinicia direto no modo configuração
    return;
  }

  cliques = 0;
  if (!cartaoOk && !montarCartao()) {
    gravando = false;
    Serial.println("Sem cartão, não dá para gravar: confira se ele está encaixado até o clique.");
    while (digitalRead(BOTAO) == LOW) delay(10);
    avisarFalha();
    return;
  }
  bool ok = gravar(g);
  while (digitalRead(BOTAO) == LOW) delay(10);  // no limite de tempo, ainda pode estar segurando
  if (ok) {
    finalizar(g);
  } else {
    cartaoOk = false;
    avisarFalha();
  }
}

void loop() {
  digitalWrite(LED, ledParado());
  if (digitalRead(BOTAO) == LOW) tratarBotao();
  // Cartão que falhou às vezes volta (mau contato, placa reiniciada com ele
  // ocupado). Sem esperar alguém apertar o botão: sem cartão, a fila não sobe.
  static uint32_t tentouCartao = 0;
  if (!cartaoOk && millis() - tentouCartao > 10000) {
    tentouCartao = millis();
    montarCartao();
  }
  delay(10);
}
