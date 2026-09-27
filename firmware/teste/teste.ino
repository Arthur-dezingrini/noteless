// Teste da placa: pisca o LED azul (GPIO2), mostra o chip e varre o Wi-Fi.
// Se isto funciona, placa, USB e rádio estão bons.
#include <WiFi.h>

const int LED = 2;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== VOCare - teste da placa ===");
  Serial.printf("Chip: %s rev %d, %d nucleos, %d MHz\n", ESP.getChipModel(), ESP.getChipRevision(),
                ESP.getChipCores(), ESP.getCpuFreqMHz());
  Serial.printf("Flash: %u MB | RAM livre: %u KB\n", ESP.getFlashChipSize() / (1024 * 1024), ESP.getFreeHeap() / 1024);
  WiFi.mode(WIFI_STA);
}

void loop() {
  digitalWrite(LED, HIGH);
  int n = WiFi.scanNetworks();
  digitalWrite(LED, LOW);
  Serial.printf("\nRedes Wi-Fi encontradas: %d\n", n);
  for (int i = 0; i < n && i < 8; i++) {
    Serial.printf("  %-32s %4d dBm\n", WiFi.SSID(i).c_str(), WiFi.RSSI(i));
  }
  for (int i = 0; i < 6; i++) {  // pisca 3x entre as varreduras
    digitalWrite(LED, i % 2 == 0);
    delay(500);
  }
}
