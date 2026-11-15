// Identidade da placa no Noteless, sem conta nem senha no código. Na primeira
// vez que liga, ela sorteia um segredo (32 bytes) e o guarda na flash; toda
// chamada leva "Authorization: Gravador <série> <segredo>", e o servidor guarda
// só o hash. No primeiro aviso de estado a placa aparece no Noteless
// aguardando aprovação; o super usuário aprova em Configurações › Gravadores
// digitando o código curto que ela mostra na página de Wi-Fi.
//
// O segredo sobrevive a gravar firmware novo; só some apagando a flash inteira.
// Aí a placa vira outra para o Noteless: é preciso esquecê-la lá e aprovar de novo.

#include <bootloader_random.h>
#include <esp_mac.h>
#include <mbedtls/sha256.h>

// Sem 0, O, 1 e I: o código é lido numa tela e digitado em outra.
const char ALFABETO_CODIGO[] = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

// Os 30 primeiros bits do SHA-256 de "noteless-pareamento:<segredo>", em 6
// letras ("K7F-3QX"). A mesma conta do servidor (api, base/gravador-atual.ts).
String codigoDe(const String &s) {
  String texto = "noteless-pareamento:" + s;
  uint8_t h[32];
  mbedtls_sha256((const uint8_t *)texto.c_str(), texto.length(), h, 0);
  uint32_t v = (uint32_t)h[0] << 24 | (uint32_t)h[1] << 16 | (uint32_t)h[2] << 8 | h[3];
  String c;
  for (int i = 0; i < 6; i++) {
    if (i == 3) c += '-';
    c += ALFABETO_CODIGO[(v >> (27 - 5 * i)) & 31];
  }
  return c;
}

// Antes do Wi-Fi e do microfone: o sorteio usa o ruído do conversor analógico
// (sem o rádio ligado, o gerador do chip não é aleatório de verdade), e no
// ESP32 isso ocupa o I2S0.
void carregarIdentidade() {
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  char s[18];
  snprintf(s, sizeof(s), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  serieDaPlaca = s;

  prefs.begin("noteless", false);
  String segredo = prefs.getString("segredo", "");
  if (segredo.length() != 64) {
    uint8_t b[32];
    bootloader_random_enable();
    esp_fill_random(b, sizeof(b));
    bootloader_random_disable();
    segredo = "";
    for (uint8_t x : b) {
      char hex[3];
      snprintf(hex, sizeof(hex), "%02x", x);
      segredo += hex;
    }
    prefs.putString("segredo", segredo);
    registrar("Segredo novo sorteado: a placa aparece no Noteless aguardando aprovação.");
  }
  prefs.end();
  credencialDaPlaca = "Gravador " + serieDaPlaca + " " + segredo;

  codigoDaPlaca = codigoDe(segredo);
  // Com o exemplo do teste da api, tem de dar o mesmo de lá: senão a aprovação recusa todo código.
  if (codigoDe("0000000000000000000000000000000000000000000000000000000000000000") != "P28-84K")
    registrar("ERRO: o código de pareamento não bate com a conta do Noteless; a aprovação vai recusá-lo.");
  registrar("Gravador %s | código para aprovar no Noteless: %s", serieDaPlaca.c_str(), codigoDaPlaca.c_str());
}
