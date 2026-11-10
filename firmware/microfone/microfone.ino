// Teste do microfone I2S (INMP441): grava enquanto o botão (D18) está apertado
// e manda o áudio pela USB. No computador, `receber.py` salva como .wav.
//
// Ligações: VDD -> 3V3 (nunca 5V)   GND -> GND   L/R -> GND (canal esquerdo)
//           SCK -> D23              WS -> D22    SD -> D21
// Botão: D18 e GND, como no gravador.
#include <ESP_I2S.h>

const int BOTAO = 18, LED = 2;
const int PINO_SCK = 23, PINO_WS = 22, PINO_SD = 21;
const int TAXA = 16000;
const int QUADROS = 256;  // quadros estéreo lidos por vez

I2SClass i2s;
int32_t quadros[2 * QUADROS];  // esquerdo, direito, esquerdo, ...
int16_t *audio = nullptr;
size_t capacidade = 0;
int canal = 0;  // 0 = esquerdo, 1 = direito

size_t lerQuadros() { return i2s.readBytes((char *)quadros, sizeof(quadros)) / 8; }

void setup() {
  Serial.begin(115200);
  pinMode(BOTAO, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
  delay(500);

  // O INMP441 manda 24 bits dentro de cada palavra de 32, em I2S padrão.
  i2s.setPins(PINO_SCK, PINO_WS, -1, PINO_SD);
  if (!i2s.begin(I2S_MODE_STD, TAXA, I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_STEREO)) {
    Serial.println("ERRO: o I2S não iniciou.");
    while (true) delay(1000);
  }

  // Lê os dois canais e fica com o que tem sinal: com L/R no GND o microfone
  // fala no esquerdo, e o outro fica em zero.
  delay(200);  // o INMP441 leva ~85 ms para acordar
  double energia[2] = {0, 0};
  for (int bloco = 0; bloco < 16; bloco++) {
    size_t n = lerQuadros();
    for (size_t i = 0; i < n; i++)
      for (int c = 0; c < 2; c++) energia[c] += fabs((double)(quadros[2 * i + c] >> 8));
  }
  canal = energia[1] > energia[0] ? 1 : 0;

  capacidade = min((size_t)(10 * TAXA), (heap_caps_get_largest_free_block(MALLOC_CAP_8BIT) - 8192) / 2);
  audio = (int16_t *)malloc(capacidade * 2);
  Serial.printf("PRONTO: canal %s (energia esq=%.0f dir=%.0f), grava até %.1f s\n", canal ? "direito" : "esquerdo",
                energia[0], energia[1], (float)capacidade / TAXA);
  if (energia[0] == 0 && energia[1] == 0)
    Serial.println("AVISO: microfone mudo. Confira SD, SCK, WS e a alimentação (3V3 e GND).");
}

void loop() {
  if (digitalRead(BOTAO) != LOW) return;
  digitalWrite(LED, HIGH);
  size_t n = 0;
  int32_t pico = 0;
  while (digitalRead(BOTAO) == LOW && n < capacidade) {
    size_t lidos = lerQuadros();
    for (size_t i = 0; i < lidos && n < capacidade; i++) {
      int32_t s = quadros[2 * i + canal] >> 8;  // 24 bits com sinal
      pico = max(pico, abs(s));
      audio[n++] = constrain(s >> 8, -32768, 32767);  // 24 -> 16 bits, sem ganho: o INMP441 é sensível
    }
  }
  digitalWrite(LED, LOW);
  Serial.printf("\nINFO taxa=%d canal=%d pico=%.1f dBFS\n", TAXA, canal, 20 * log10f(max(pico, (int32_t)1) / 8388608.0f));
  Serial.printf("AUDIO %u\n", n);
  Serial.write((uint8_t *)audio, n * 2);
  Serial.println("\nFIM");
  while (digitalRead(BOTAO) == LOW) delay(10);
}
