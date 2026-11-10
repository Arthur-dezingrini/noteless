// Conecta no Wi-Fi definido em segredos.h, mostra o IP e reconecta se cair.
// O LED azul (GPIO2) fica aceso enquanto conectado.
#include <WiFi.h>
#include "segredos.h"

const int LED = 2;

// Diz se a rede está ao alcance e com que segurança (WPA2-Enterprise não entra com senha simples).
void procurarRede() {
  int n = WiFi.scanNetworks();
  for (int i = 0; i < n; i++) {
    if (WiFi.SSID(i) == WIFI_SSID) {
      Serial.printf("Rede vista: canal %d, %d dBm, seguranca %d\n", WiFi.channel(i), WiFi.RSSI(i), WiFi.encryptionType(i));
      return;
    }
  }
  Serial.printf("Rede \"%s\" NAO encontrada entre %d redes (fora de alcance ou so 5 GHz?)\n", WIFI_SSID, n);
}

void conectar() {
  Serial.printf("Conectando em \"%s\"", WIFI_SSID);
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_SENHA);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {  // ~20 s
    digitalWrite(LED, i % 2);
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED, HIGH);
    Serial.printf("\nConectado! IP: %s | gateway: %s | sinal: %d dBm\n", WiFi.localIP().toString().c_str(),
                  WiFi.gatewayIP().toString().c_str(), WiFi.RSSI());
  } else {
    digitalWrite(LED, LOW);
    Serial.printf("\nFalhou (status %d). Tentando de novo...\n", WiFi.status());
  }
}

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== VOCare - Wi-Fi ===");
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  procurarRede();
  conectar();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) conectar();
  delay(5000);
}
