// Versão do firmware e atualização pelo Noteless (OTA, "pelo ar").
//
// O aviso de estado traz a versão escolhida no Noteless (situacao.ino,
// receberOferta). Com a placa parada (rede.ino), ela baixa em pedaços de 32 KB
// — o Wi-Fi caindo não faz recomeçar —, confere o SHA-256 e a assinatura
// (ECDSA P-256, chave pública abaixo) e grava na outra cópia do firmware
// (partitions.csv). Reinicia na nova, que só vale depois do primeiro aviso
// aceito pelo Noteless: se travar antes, o bootloader volta sozinho para a
// anterior; se ficar 10 min com Wi-Fi sem conseguir avisar, ela mesma volta.
// Versão que não funcionou não é tentada de novo (o Noteless mostra o erro).
//
// Fica depois de rede.ino de propósito (ordem alfabética): usa Conexao.

// A chave privada fica só no servidor (FIRMWARE_CHAVE_PRIVADA); esta é a pública.
const char CHAVE_PUBLICA_FIRMWARE[] =
    "-----BEGIN PUBLIC KEY-----\n"
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEdaYBDc2zSn9S4TGbxmXMK9boMpUn\n"
    "Ej1Vv6vIQ45PKOrfq/bIkRNNVM8KUmHlUoV30cyU5+K6Owz+orf1Up40ig==\n"
    "-----END PUBLIC KEY-----\n";

const size_t PEDACO_OTA = 32 * 1024;
const uint32_t TESTE_COM_WIFI_MS = 10 * 60000;  // Wi-Fi e sem conseguir avisar: a versão não presta
const uint32_t TESTE_SEM_WIFI_MS = 60 * 60000;  // sem Wi-Fi não dá para julgar: volta, e tenta outro dia
const uint8_t FALHAS_DE_PEDACO = 20;

String otaVersao, otaSha256, otaAssinatura;  // a oferta atual
size_t otaTamanho = 0, otaBaixados = 0;
bool otaBaixando = false, otaEmTeste = false;
uint8_t otaFalhasSeguidas = 0;
uint32_t otaProximaTentativa = 0, otaComWifiMs = 0;
mbedtls_sha256_context otaSha;
String otaEtapa, otaErro;  // etapa: "", "baixando", "instalando", "falhou"

// O Arduino marcaria a versão nova como boa assim que liga; aqui quem marca é
// validarVersaoNova(), depois de falar com o Noteless.
bool verifyRollbackLater() { return true; }

String lerPreferencia(const char *chave) {
  prefs.begin("noteless", true);
  String v = prefs.getString(chave, "");
  prefs.end();
  return v;
}

void gravarPreferencia(const char *chave, const String &valor) {
  prefs.begin("noteless", false);
  if (valor.isEmpty()) prefs.remove(chave);
  else prefs.putString(chave, valor);
  prefs.end();
}

void otaFalhar(const String &versao, const String &motivo) {
  if (otaBaixando) {
    Update.abort();
    mbedtls_sha256_free(&otaSha);
  }
  otaBaixando = false;
  otaVersao = versao;
  otaEtapa = "falhou";
  otaErro = motivo;
  registrar("ERRO: a atualização para a versão %s falhou: %s.", versao.c_str(), motivo.c_str());
}

void otaCancelar(const char *motivo) {
  if (otaBaixando) {
    Update.abort();
    mbedtls_sha256_free(&otaSha);
  }
  if (otaVersao.length() && otaEtapa != "falhou") registrar("AVISO: atualização para a versão %s %s.", otaVersao.c_str(), motivo);
  otaBaixando = false;
  otaVersao = otaEtapa = otaErro = "";
}

// Ao ligar: veio de uma atualização? A versão que estava sendo instalada não é a
// que está rodando = a nova não funcionou e o bootloader voltou para esta.
void conferirVersaoNova() {
  esp_ota_img_states_t estado;
  otaEmTeste = esp_ota_get_state_partition(esp_ota_get_running_partition(), &estado) == ESP_OK && estado == ESP_OTA_IMG_PENDING_VERIFY;
  String tentando = lerPreferencia("ota_tentando");
  if (tentando.isEmpty()) return;
  gravarPreferencia("ota_tentando", "");
  if (tentando == FIRMWARE_VERSAO) {
    registrar("Atualização: rodando a versão %s; ela fica depois do primeiro aviso aceito pelo Noteless.", FIRMWARE_VERSAO);
    return;
  }
  // Voltou por falta de Wi-Fi: a versão pode estar boa, então pode tentar de novo.
  if (lerPreferencia("ota_semwifi") == tentando) {
    gravarPreferencia("ota_semwifi", "");
    registrar("AVISO: a versão %s ficou 1 h sem Wi-Fi para se provar; voltou para a %s e tenta de novo depois.", tentando.c_str(),
              FIRMWARE_VERSAO);
    return;
  }
  gravarPreferencia("ota_falhou", tentando);
  otaFalhar(tentando, String("não funcionou nesta placa, que voltou para a versão ") + FIRMWARE_VERSAO);
}

// Primeiro aviso aceito pelo Noteless rodando a versão nova: ela fica.
void validarVersaoNova() {
  if (!otaEmTeste) return;
  otaEmTeste = false;
  esp_ota_mark_app_valid_cancel_rollback();
  registrar("Atualização: versão %s aprovada (falou com o Noteless).", FIRMWARE_VERSAO);
}

// Versão nova que não consegue avisar o Noteless: volta para a anterior.
void conferirTesteDaVersao() {
  if (!otaEmTeste) return;
  static uint32_t ultimo = millis();
  uint32_t agora = millis();
  if (WiFi.status() == WL_CONNECTED) otaComWifiMs += agora - ultimo;
  ultimo = agora;
  bool semWifi = otaComWifiMs == 0 && agora > TESTE_SEM_WIFI_MS;
  if (otaComWifiMs < TESTE_COM_WIFI_MS && !semWifi) return;
  if (semWifi) gravarPreferencia("ota_semwifi", FIRMWARE_VERSAO);
  registrar("ERRO: a versão %s não conseguiu falar com o Noteless%s: voltando para a anterior.", FIRMWARE_VERSAO,
            semWifi ? " (1 h sem Wi-Fi)" : " em 10 min de Wi-Fi");
  delay(300);
  esp_ota_mark_app_invalid_rollback_and_reboot();
}

long numeroNoJson(const String &json, const char *chave) {
  String alvo = String("\"") + chave + "\":";
  int i = json.indexOf(alvo);
  return i < 0 ? 0 : strtol(json.c_str() + i + alvo.length(), nullptr, 10);
}

// Resposta do aviso (200): "firmware":{...} é a versão a instalar; null, nenhuma.
void receberOferta(const String &resp) {
  int i = resp.indexOf("\"firmware\":{");
  if (i < 0) {
    if (otaVersao.length() && otaEtapa != "falhou") otaCancelar("cancelada no Noteless");
    return;
  }
  String oferta = resp.substring(i, resp.indexOf('}', i) + 1);
  String versao = campo(oferta, "versao");
  if (versao.isEmpty() || versao == FIRMWARE_VERSAO || versao == otaVersao) return;
  if (otaVersao.length()) otaCancelar("trocada por outra versão no Noteless");
  if (versao == lerPreferencia("ota_falhou")) {
    otaVersao = versao;
    otaEtapa = "falhou";
    otaErro = "não funcionou nesta placa antes; escolha outra versão";
    return;
  }
  otaVersao = versao;
  otaSha256 = campo(oferta, "sha256");
  otaAssinatura = campo(oferta, "assinatura");
  otaTamanho = numeroNoJson(oferta, "tamanho");
  otaBaixados = 0;
  otaFalhasSeguidas = 0;
  otaProximaTentativa = millis();
  otaEtapa = otaErro = "";
  registrar("Atualização: o Noteless pede a versão %s (%u KB); baixa quando a placa estiver parada.", versao.c_str(),
            (unsigned)(otaTamanho / 1024));
}

bool otaPendente() {
  return otaVersao.length() && otaEtapa != "falhou" && otaEtapa != "instalando" &&
         (int32_t)(millis() - otaProximaTentativa) >= 0;
}

// O andamento para o aviso de estado (situacao.ino).
String atualizacaoJson() {
  if (otaVersao.isEmpty() || otaEtapa.isEmpty()) return "null";
  int progresso = otaTamanho ? (int)((uint64_t)otaBaixados * 100 / otaTamanho) : 0;
  return String("{\"versao\":\"") + jsonTexto(otaVersao.c_str()) + "\",\"etapa\":\"" + otaEtapa + "\",\"progresso\":" +
         String(min(progresso, 100)) + ",\"erro\":" +
         (otaErro.length() ? String("\"") + jsonTexto(otaErro.c_str()) + "\"" : String("null")) + "}";
}

bool assinaturaConfere(const uint8_t *hash) {
  uint8_t assinatura[80];
  size_t n = 0;
  if (mbedtls_base64_decode(assinatura, sizeof(assinatura), &n, (const uint8_t *)otaAssinatura.c_str(), otaAssinatura.length()) != 0)
    return false;
  mbedtls_pk_context pk;
  mbedtls_pk_init(&pk);
  bool ok = mbedtls_pk_parse_public_key(&pk, (const uint8_t *)CHAVE_PUBLICA_FIRMWARE, sizeof(CHAVE_PUBLICA_FIRMWARE)) == 0 &&
            mbedtls_pk_verify(&pk, MBEDTLS_MD_SHA256, hash, 32, assinatura, n) == 0;
  mbedtls_pk_free(&pk);
  return ok;
}

// Um passo: começa, ou baixa o próximo pedaço; no último, confere e instala.
void passoDaAtualizacao() {
  if (!otaBaixando) {
    if (!otaTamanho || otaSha256.length() != 64 || otaAssinatura.isEmpty()) return otaFalhar(otaVersao, "oferta incompleta do Noteless");
    if (!Update.begin(otaTamanho, U_FLASH))
      return otaFalhar(otaVersao, String("não cabe na outra cópia do firmware (") + Update.errorString() + ")");
    mbedtls_sha256_init(&otaSha);
    mbedtls_sha256_starts(&otaSha, 0);
    otaBaixados = 0;
    otaBaixando = true;
    otaEtapa = "baixando";
    ultimoAvisoMs = 0;  // próximo aviso já: o Noteless mostra "baixando" (situacao.ino)
    registrar("Atualização: baixando a versão %s...", otaVersao.c_str());
  }

  size_t fim = min(otaBaixados + PEDACO_OTA, otaTamanho) - 1;
  size_t quer = fim - otaBaixados + 1, veio = 0;
  int st = 0;
  {
    Conexao c;
    if (c.abrir("/api/gravadores/firmware/" + otaVersao)) {
      c.http.addHeader("Range", String("bytes=") + String((unsigned long)otaBaixados) + "-" + String((unsigned long)fim));
      st = c.http.GET();
      if (st == 206) {
        auto *s = c.http.getStreamPtr();
        uint8_t buf[1024];
        uint32_t limite = millis() + 30000;
        while (veio < quer && millis() < limite && (s->connected() || s->available())) {
          int n = s->available();
          if (n <= 0) {
            delay(5);
            continue;
          }
          n = s->read(buf, min((size_t)n, min(sizeof(buf), quer - veio)));
          if (n <= 0) continue;
          // O que chegou já vale: se a conexão cair, o próximo pedaço começa daqui.
          if (Update.write(buf, n) != (size_t)n) {
            c.http.end();
            return otaFalhar(otaVersao, String("não conseguiu gravar na memória (") + Update.errorString() + ")");
          }
          mbedtls_sha256_update(&otaSha, buf, n);
          veio += n;
          otaBaixados += n;
        }
      }
    }
    c.http.end();
  }
  if (st == 403 || st == 404) return otaCancelar("recusada pelo Noteless (a versão deixou de ser a escolhida)");
  if (veio < quer) {
    if (++otaFalhasSeguidas >= FALHAS_DE_PEDACO)
      return otaFalhar(otaVersao, String("o download falhou ") + FALHAS_DE_PEDACO + " vezes seguidas (HTTP " + st + ")");
    if (otaFalhasSeguidas == 1) registrar("AVISO: atualização: pedaço falhou (HTTP %d); continua de %u KB.", st, (unsigned)(otaBaixados / 1024));
    otaProximaTentativa = millis() + 30000;
    return;
  }
  otaFalhasSeguidas = 0;
  if (otaBaixados < otaTamanho) return;

  uint8_t hash[32];
  char hex[65];
  mbedtls_sha256_finish(&otaSha, hash);
  for (int i = 0; i < 32; i++) sprintf(hex + 2 * i, "%02x", hash[i]);
  if (otaSha256 != hex) return otaFalhar(otaVersao, "o arquivo chegou diferente do publicado (SHA-256)");
  if (!assinaturaConfere(hash)) return otaFalhar(otaVersao, "assinatura inválida: o arquivo não é do Noteless");
  mbedtls_sha256_free(&otaSha);
  otaBaixando = false;
  otaEtapa = "instalando";
  if (!Update.end(true)) return otaFalhar(otaVersao, String("a instalação falhou (") + Update.errorString() + ")");
  gravarPreferencia("ota_tentando", otaVersao);
  registrar("Atualização: versão %s conferida e instalada; reiniciando nela.", otaVersao.c_str());
  avisarEstado();  // o Noteless vê "instalando" antes de a placa sumir uns segundos
  delay(500);
  ESP.restart();
}
