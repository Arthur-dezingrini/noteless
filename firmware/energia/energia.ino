// Teste da energia do cartão microSD. A cada 2 s, tenta acordar o cartão e
// mede a tensão no VCC do módulo enquanto ele acorda. Só lê, nunca grava.
//
// Por quê: o cartão responde aos primeiros comandos e, quando recebe o que o
// manda ligar o controlador interno (ACMD41), puxa um pico de corrente. Com a
// alimentação fraca, a tensão cai e ele reinicia — "o cartão não respondeu".
//
// Ligações: as do gravador (módulo: CS D5, SCK TX2, MOSI RX2, MISO D4) e, para
// medir, um fio do pino VCC do módulo até o D15. Sem esse fio, o teste só diz
// se o cartão acordou.
//
// Cada linha do monitor serial diz se o cartão acordou e a menor tensão no
// momento. Mexa na alimentação (fio direto no 3V3 da ESP32, capacitor no
// módulo, outro cabo ou porta USB) e veja a linha seguinte. LED aceso = o
// cartão acordou. O ADC da ESP32 não passa de ~3,1 V: acima disso aparece
// "3,1+ V".
#include <SPI.h>

const int CS = 5, P_SCK = 17, P_MOSI = 16, P_MISO = 4, P_VCC = 15, LED = 2;
const int SATURA_MV = 3100;  // daqui para cima o ADC não distingue
const int SEM_FIO_MV = 1500; // com o cartão respondendo, VCC abaixo disso é o D15 solto
SPIClass spi(HSPI);

uint8_t crc7(const uint8_t *d, int n) {
  uint8_t crc = 0;
  for (int i = 0; i < n; i++) {
    uint8_t b = d[i];
    for (int j = 0; j < 8; j++) {
      crc <<= 1;
      if ((b & 0x80) ^ (crc & 0x80)) crc ^= 0x09;
      b <<= 1;
    }
  }
  return (crc << 1) | 1;
}

void selecionar() { digitalWrite(CS, LOW); spi.transfer(0xFF); }
void soltar() { digitalWrite(CS, HIGH); spi.transfer(0xFF); }

// Um comando com o cartão selecionado; devolve o R1 (0xFF = não respondeu).
uint8_t comando(uint8_t c, uint32_t arg, uint32_t *extra = nullptr) {
  uint8_t p[6] = {uint8_t(0x40 | c), uint8_t(arg >> 24), uint8_t(arg >> 16), uint8_t(arg >> 8), uint8_t(arg), 0};
  p[5] = crc7(p, 5);
  uint32_t t = millis();
  while (spi.transfer(0xFF) != 0xFF && millis() - t < 300) {}
  for (int i = 0; i < 6; i++) spi.transfer(p[i]);
  uint8_t r = 0xFF;
  for (int i = 0; i < 10; i++) {
    r = spi.transfer(0xFF);
    if (!(r & 0x80)) break;
  }
  if (extra) {
    uint32_t v = 0;
    for (int i = 0; i < 4; i++) v = (v << 8) | spi.transfer(0xFF);
    *extra = v;
  }
  return r;
}

uint8_t um(uint8_t c, uint32_t arg, uint32_t *extra = nullptr) {
  selecionar();
  uint8_t r = comando(c, arg, extra);
  soltar();
  return r;
}

// Menor tensão no VCC do módulo durante `ms` milissegundos.
int minimoPor(uint32_t ms) {
  int menor = 99999;
  uint32_t t = millis();
  do menor = min(menor, (int)analogReadMilliVolts(P_VCC));
  while (millis() - t < ms);
  return menor;
}

String volts(int mv) {
  if (mv >= SATURA_MV) return "3,1+ V";
  String s = String(mv / 1000.0, 2) + " V";
  s.replace('.', ',');
  return s;
}

// Quem fez o cartão (CID): SanDisk original é fabricante 0x03, OEM "SD".
void mostrarCid() {
  uint8_t b[16];
  selecionar();
  bool ok = false;
  if (comando(10, 0) == 0) {
    uint32_t t = millis();
    uint8_t tok;
    do tok = spi.transfer(0xFF); while (tok == 0xFF && millis() - t < 300);
    if (tok == 0xFE) {
      for (int i = 0; i < 16; i++) b[i] = spi.transfer(0xFF);
      spi.transfer(0xFF); spi.transfer(0xFF);
      ok = true;
    }
  }
  soltar();
  if (!ok) return;
  char oem[3] = {(char)b[1], (char)b[2], 0}, produto[6] = {(char)b[3], (char)b[4], (char)b[5], (char)b[6], (char)b[7], 0};
  bool sandisk = b[0] == 0x03 && !strcmp(oem, "SD");
  Serial.printf("     Cartão: fabricante 0x%02X, OEM \"%s\", produto \"%s\", fabricado em %02d/%d%s\n", b[0], oem, produto, b[14] & 15,
                2000 + (((b[13] & 15) << 4) | (b[14] >> 4)), sandisk ? " — SanDisk original" : "");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(LED, OUTPUT);
  pinMode(CS, OUTPUT);
  digitalWrite(CS, HIGH);
  analogSetPinAttenuation(P_VCC, ADC_11db);
  analogReadMilliVolts(P_VCC);
  spi.begin(P_SCK, P_MISO, P_MOSI, -1);
  Serial.println("\n=== Teste da energia do cartão (só leitura). Uma linha a cada 2 s; mexa na alimentação e compare.");
}

void loop() {
  static int n = 0;
  static bool mostrouCid = false;
  n++;
  spi.beginTransaction(SPISettings(400000, MSBFIRST, SPI_MODE0));
  digitalWrite(CS, HIGH);
  for (int i = 0; i < 20; i++) spi.transfer(0xFF);  // 160 pulsos de relógio para o cartão acordar no modo SPI
  int repouso = minimoPor(20);
  uint8_t r0 = um(0, 0);
  if (r0 != 0x01) r0 = um(0, 0);
  bool semFio = repouso < SEM_FIO_MV;

  if (r0 != 0x01) {
    Serial.printf("#%-3d não responde nem ao primeiro comando (0x%02X): cartão encaixado? módulo com energia? | VCC %s\n", n, r0,
                  semFio ? "-" : volts(repouso).c_str());
  } else {
    uint32_t v8 = 0, ocr = 0;
    um(59, 1);
    um(8, 0x1AA, &v8);
    um(58, 0, &ocr);
    // Acorda: ACMD41 até 1,5 s, medindo a tensão entre um pedido e outro.
    int minimo = 99999, voltas = 0;
    bool acordou = false, reiniciou = false;
    uint32_t t = millis();
    while (millis() - t < 1500) {
      voltas++;
      if (um(55, 0) == 0xFF) { reiniciou = true; break; }
      uint8_t r41 = um(41, 0x40000000);
      minimo = min(minimo, minimoPor(5));
      if (r41 == 0x00) { acordou = true; break; }
      if (r41 == 0xFF) { reiniciou = true; break; }
    }
    uint32_t ms = millis() - t;
    String tensao = semFio ? String("(ligue o VCC do módulo no D15 para medir)")
                           : "VCC parado " + volts(repouso) + ", menor ao acordar " + volts(minimo);
    if (acordou) Serial.printf("#%-3d ACORDOU em %lu ms  | %s\n", n, (unsigned long)ms, tensao.c_str());
    else if (reiniciou) Serial.printf("#%-3d REINICIOU ao acordar (pedido nº %d, %lu ms) | %s\n", n, voltas, (unsigned long)ms, tensao.c_str());
    else Serial.printf("#%-3d não acordou em 1,5 s | %s\n", n, tensao.c_str());
    if (acordou && !mostrouCid) {
      mostrarCid();
      mostrouCid = true;
    }
    digitalWrite(LED, acordou);
  }
  if (r0 != 0x01) digitalWrite(LED, LOW);
  um(0, 0);  // de volta ao repouso
  spi.endTransaction();
  delay(2000);
}
