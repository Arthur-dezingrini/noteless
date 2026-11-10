// Teste do módulo microSD. Primeiro confere os fios um a um, depois monta o
// cartão, mostra tipo e tamanho, grava e lê de volta 256 KB e mede a
// velocidade. O gravador vai precisar de 8 KB/s (áudio de 8 kHz, 8 bits).
// Se o cartão não responde, fica tentando sem parar e o LED acende a cada
// resposta: dá para achar o mau contato apertando fio por fio.
//
// Ligações (módulo de 3,3 V, sem regulador; o nome está ao lado de cada furo):
//   VCC/3V3 -> trilha + (3V3)     GND -> trilha − (GND)
//   CS -> D5    SCK/CLK -> TX2 (GPIO17)    MOSI -> RX2 (GPIO16)    MISO -> D4
// Os pinos não atrapalham o microfone (D21–D23) nem o botão (D18).
#include <SD.h>
#include <SPI.h>
#include <driver/gpio.h>

const int PINO_CS = 5, PINO_SCK = 17, PINO_MOSI = 16, PINO_MISO = 4;
const int LED = 2;
const char *ARQUIVO = "/teste-noteless.bin";
const size_t TAMANHO = 256 * 1024;

SPIClass spi(HSPI);
uint8_t bloco[512];

struct Fio {
  int pino;
  const char *nome, *placa;
};
const Fio FIOS[] = {{PINO_CS, "CS", "D5"}, {PINO_SCK, "SCK", "TX2"}, {PINO_MOSI, "MOSI", "RX2"}, {PINO_MISO, "MISO", "D4"}};

// Pistas para quando o cartão não responde. O módulo tem resistores puxando
// algumas linhas para o 3V3: com o pino da ESP32 puxando fraco para baixo, a
// linha lê "alto" se o fio chega no módulo alimentado. "Baixo" só é pista —
// nem todo módulo tem resistor em todas as linhas.
bool fioAlto[4];
// Com o cartão fora do barramento (CS alto), ninguém deveria segurar o MISO:
// puxado fraco para cima, ele sobe. Se fica baixo, está encostando no GND.
bool misoLivre;

void lerFios() {
  for (int i = 0; i < 4; i++) {
    pinMode(FIOS[i].pino, INPUT_PULLDOWN);
    delay(5);
    fioAlto[i] = digitalRead(FIOS[i].pino);
    pinMode(FIOS[i].pino, INPUT);
  }
  pinMode(PINO_MISO, INPUT_PULLUP);
  delay(5);
  misoLivre = digitalRead(PINO_MISO);
  pinMode(PINO_MISO, INPUT);
}

void mostrarFios() {
  int altos = 0;
  Serial.println("Fios (alto = chega no módulo alimentado; baixo = suspeito):");
  for (int i = 0; i < 4; i++) {
    altos += fioAlto[i];
    Serial.printf("  %-4s no %-3s: %s\n", FIOS[i].nome, FIOS[i].placa, fioAlto[i] ? "alto" : "baixo");
  }
  if (altos == 0)
    Serial.println("  -> Nenhum fio chega: o módulo está sem energia (VCC na trilha +, GND na trilha −, trilhas ligadas no "
                   "3V3 e no GND da ESP32) ou a solda dos pinos não pegou.");
}

// Manda o comando de reset (CMD0) na mão, devagar, e devolve a resposta.
// 0x01 = o cartão respondeu; 0xFF = ninguém respondeu; 0x00 = MISO em baixo.
uint8_t sondarCartao() {
  pinMode(PINO_CS, OUTPUT);
  digitalWrite(PINO_CS, HIGH);
  spi.beginTransaction(SPISettings(400000, MSBFIRST, SPI_MODE0));
  for (int i = 0; i < 10; i++) spi.transfer(0xFF);  // 80 pulsos para o cartão acordar
  digitalWrite(PINO_CS, LOW);
  const uint8_t cmd0[] = {0x40, 0, 0, 0, 0, 0x95};
  for (uint8_t b : cmd0) spi.transfer(b);
  uint8_t r = 0xFF;
  for (int i = 0; i < 10 && r == 0xFF; i++) r = spi.transfer(0xFF);
  digitalWrite(PINO_CS, HIGH);
  spi.transfer(0xFF);
  spi.endTransaction();
  return r;
}

// Conteúdo previsível para conferir a leitura byte a byte.
uint8_t esperado(size_t i) { return (uint8_t)(i * 31 + (i >> 9)); }

bool gravar(float &kbps) {
  File f = SD.open(ARQUIVO, FILE_WRITE);
  if (!f) return false;
  uint32_t t = millis();
  for (size_t pos = 0; pos < TAMANHO; pos += sizeof(bloco)) {
    for (size_t i = 0; i < sizeof(bloco); i++) bloco[i] = esperado(pos + i);
    if (f.write(bloco, sizeof(bloco)) != sizeof(bloco)) return false;
  }
  f.close();
  kbps = TAMANHO / 1024.0f / ((millis() - t) / 1000.0f);
  return true;
}

// Devolve a posição do primeiro byte errado, ou -1 se veio tudo certo.
long conferir(float &kbps) {
  File f = SD.open(ARQUIVO, FILE_READ);
  if (!f || f.size() != TAMANHO) return 0;
  uint32_t t = millis();
  for (size_t pos = 0; pos < TAMANHO; pos += sizeof(bloco)) {
    if (f.read(bloco, sizeof(bloco)) != sizeof(bloco)) return pos;
    for (size_t i = 0; i < sizeof(bloco); i++)
      if (bloco[i] != esperado(pos + i)) return pos + i;
  }
  f.close();
  kbps = TAMANHO / 1024.0f / ((millis() - t) / 1000.0f);
  return -1;
}

// Mau contato vai e volta. Enquanto o cartão não responde, sonda sem parar e
// mostra no LED: aceso = respondeu agora. Com 2 s respondendo firme, volta e o
// teste segue.
void esperarCartao() {
  Serial.println("Tentando sem parar: aperte os fios, as soldas e o cartão, um de cada vez. O LED acende quando o "
                 "cartão responde; com 2 s firme, o teste segue.");
  gpio_num_t miso = (gpio_num_t)PINO_MISO;
  int antes = -1;
  uint32_t firmeDesde = 0;
  while (true) {
    // Só para o diagnóstico: o MISO puxado fraco para baixo, com o cartão fora
    // do barramento. Lido pelo driver de GPIO, que não tira o pino do SPI.
    gpio_pullup_dis(miso);
    gpio_pulldown_en(miso);
    delayMicroseconds(100);
    bool misoAlto = gpio_get_level(miso);
    gpio_pulldown_dis(miso);
    gpio_pullup_en(miso);

    uint8_t r = sondarCartao();
    digitalWrite(LED, r == 0x01);
    int agora = r << 1 | misoAlto;
    if (agora != antes) {
      Serial.printf("%7.1f s: CMD0 0x%02X, MISO %s\n", millis() / 1000.0f, r, misoAlto ? "alto" : "baixo");
      antes = agora;
    }
    if (r != 0x01) firmeDesde = 0;
    else if (!firmeDesde) firmeDesde = millis();
    else if (millis() - firmeDesde > 2000) return;
    delay(20);
  }
}

void falhou(const char *motivo) {
  Serial.printf("ERRO: %s\n", motivo);
  // Pisca rápido para sempre: dá para ver sem o computador.
  while (true) {
    digitalWrite(LED, !digitalRead(LED));
    delay(150);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
  delay(500);

  lerFios();  // antes do SPI, que toma conta dos pinos

  spi.begin(PINO_SCK, PINO_MISO, PINO_MOSI, -1);
  // Sem resistor no MISO, ninguém falando nele também lê 0x00, como se ele
  // estivesse no GND. Com o pull-up da ESP32 ligado, o silêncio vira 0xFF.
  gpio_pullup_en((gpio_num_t)PINO_MISO);
  uint8_t r = sondarCartao();
  Serial.printf("Reset do cartão (CMD0): resposta 0x%02X — ", r);
  if (r == 0x01) Serial.println("o cartão respondeu, os 4 fios de sinal estão certos.");
  else if (r == 0xFF)
    Serial.println("ninguém respondeu. Cartão mal encaixado, fio do MISO solto, GND do módulo solto, CS/SCK/MOSI no furo "
                   "errado, ou módulo sem energia.");
  else if (r == 0x00 && !misoLivre)
    Serial.println("MISO preso em baixo mesmo com o cartão fora do barramento: fio do MISO encostando no GND (ponte "
                   "de solda, fileira errada da protoboard) ou cartão travado (mal encaixado ou com defeito). Tire o "
                   "cartão e rode de novo: se continuar, é a fiação.");
  else if (r == 0x00)
    Serial.println("o cartão segura o MISO em baixo quando é chamado: travado ou ocupado. Desligue a USB, tire e "
                   "recoloque o cartão, e ligue de novo.");
  else Serial.println("resposta estranha: mau contato. Refaça a solda e confira os fios.");
  if (r != 0x01) {
    mostrarFios();
    esperarCartao();
    Serial.println("O cartão respondeu firme. Seguindo com o teste.");
  }

  // 1 MHz, a mesma do gravador (ver fila.ino): é nela que a conferência vale.
  if (!SD.begin(PINO_CS, spi, 1000000)) falhou("o cartão não montou. Veja o diagnóstico acima.");

  const char *tipos[] = {"nenhum", "MMC", "SD", "SDHC/SDXC", "desconhecido"};
  uint8_t tipo = SD.cardType();
  Serial.printf("CARTAO: %s, %.1f GB, %.1f GB livres\n", tipos[tipo > 4 ? 4 : tipo], SD.cardSize() / 1e9,
                (SD.totalBytes() - SD.usedBytes()) / 1e9);
  if (tipo == CARD_NONE) falhou("nenhum cartão encaixado.");

  float grava = 0, le = 0;
  if (!gravar(grava)) falhou("não consegui gravar no cartão (protegido, cheio ou formatado em exFAT/NTFS? use FAT32).");
  long erro = conferir(le);
  if (erro >= 0) {
    Serial.printf("ERRO: o que voltou do cartão não bate com o que foi gravado (byte %ld). "
                  "Mau contato num fio ou na solda, normalmente MISO.\n",
                  erro);
    falhou("leitura corrompida.");
  }
  SD.remove(ARQUIVO);
  Serial.printf("OK: grava %.0f KB/s, lê %.0f KB/s (o gravador precisa de 8 KB/s)\n", grava, le);

  Serial.println("Arquivos na raiz do cartão:");
  File raiz = SD.open("/");
  int n = 0;
  for (File f = raiz.openNextFile(); f; f = raiz.openNextFile()) {
    Serial.printf("  %s%s  %u bytes\n", f.name(), f.isDirectory() ? "/" : "", (unsigned)f.size());
    n++;
  }
  if (n == 0) Serial.println("  (vazio)");
  Serial.println("PRONTO: cartão funcionando.");
  digitalWrite(LED, HIGH);  // aceso = tudo certo
}

void loop() {}
