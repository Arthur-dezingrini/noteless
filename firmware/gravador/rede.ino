// Tarefa de rede: conecta no Wi-Fi salvo, acerta o relógio pela internet,
// entra no Noteless e esvazia a fila do cartão, da mais antiga para a mais
// nova. Roda separada do botão: enviar (e esperar a transcrição) nunca impede
// de começar outra gravação.

const char *FRONTEIRA = "----noteless-esp32";

CookieJar cookies;  // sessão do Better Auth, guardada após o login
String orgId;

String hostServidor() {
  String host = String(SERVIDOR_URL);
  host = host.substring(host.indexOf("//") + 2);
  if (host.indexOf('/') >= 0) host = host.substring(0, host.indexOf('/'));
  if (host.indexOf(':') >= 0) host = host.substring(0, host.indexOf(':'));
  return host;
}

// Há roteadores (o do iPhone, por exemplo) cujo DNS não responde à placa: sem
// descobrir o endereço do servidor, nada é enviado. Nesse caso, DNS públicos.
// (hostByName devolve 1 no sucesso e o código de erro — também "verdadeiro" — na falha.)
void garantirDns() {
  IPAddress ip;
  if (WiFi.hostByName(hostServidor().c_str(), ip) == 1) return;
  Serial.printf("DNS da rede (%s) não respondeu; usando 1.1.1.1 e 8.8.8.8.\n", WiFi.dnsIP(0).toString().c_str());
  WiFi.STA.dnsIP(0, IPAddress(1, 1, 1, 1));
  WiFi.STA.dnsIP(1, IPAddress(8, 8, 8, 8));
}

bool conectarWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.printf("Wi-Fi \"%s\"", wifiNome.c_str());
  WiFi.mode(WIFI_STA);
  // Sem economia de energia: consumo constante (~100 mA) que não deixa powerbank
  // desligar sozinha, e o envio responde mais rápido.
  WiFi.setSleep(false);
  WiFi.disconnect();  // encerra tentativa anterior ainda em andamento ("sta is connecting")
  WiFi.begin(wifiNome.c_str(), wifiSenha.c_str());
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) { delay(250); Serial.print("."); }
  bool ok = WiFi.status() == WL_CONNECTED;
  Serial.println(ok ? " ok, IP " + WiFi.localIP().toString() : " fora de alcance");
  if (ok) garantirDns();
  return ok;
}

// Valor de "chave":"valor" num JSON simples — evita depender de biblioteca.
String campo(const String &json, const char *chave) {
  String alvo = String("\"") + chave + "\":";
  int i = json.indexOf(alvo);
  if (i < 0) return "";
  i += alvo.length();
  if (json[i] != '"') return "";
  String v;
  for (int j = i + 1; j < (int)json.length() && json[j] != '"'; j++) {
    if (json[j] == '\\' && j + 1 < (int)json.length()) j++;
    v += json[j];
  }
  return v;
}

// Cliente HTTP ou HTTPS conforme a URL (api local em http, Vercel em https).
// Sem cabeçalho Origin, de propósito: o Better Auth só confere a origem de quem
// a manda ou traz cookie no login (proteção de navegador contra CSRF). Mandar
// uma origem fora da lista confiável da api faz o login dar 403.
struct Conexao {
  WiFiClient simples;
  WiFiClientSecure seguro;
  HTTPClient http;

  bool abrir(const String &caminho) {
    String url = String(SERVIDOR_URL) + caminho;
    http.setCookieJar(&cookies);
    http.setTimeout(60000);  // transcrição + IA levam alguns segundos
    if (url.startsWith("https")) {
      seguro.setInsecure();            // protótipo: não confere o certificado do servidor
      seguro.setHandshakeTimeout(15);  // rede ruim não pode prender a fila por minutos
      return http.begin(seguro, url);
    }
    return http.begin(simples, url);
  }

  // Por que a conexão nem abriu (código negativo): nome do servidor (DNS),
  // conexão segura (TLS) ou falta de memória.
  void explicar(int st) {
    String host = hostServidor();
    IPAddress ip;
    bool dns = WiFi.hostByName(host.c_str(), ip) == 1;
    Serial.printf("  %s | DNS de %s (servidor %s): %s | memória livre %u (maior bloco %u)\n",
                  HTTPClient::errorToString(st).c_str(), host.c_str(), WiFi.dnsIP(0).toString().c_str(),
                  dns ? ip.toString().c_str() : "FALHOU", ESP.getFreeHeap(), heap_caps_get_largest_free_block(MALLOC_CAP_8BIT));
    char erro[120];
    if (seguro.lastError(erro, sizeof(erro)) != 0) Serial.printf("  TLS: %s\n", erro);
  }
};

bool entrar() {
  cookies.clear();
  orgId = "";
  {
    Conexao c;
    if (!c.abrir("/api/auth/sign-in/email")) return false;
    c.http.addHeader("Content-Type", "application/json");
    int st = c.http.POST(String("{\"email\":\"") + CONTA_EMAIL + "\",\"password\":\"" + CONTA_SENHA + "\"}");
    String resp = c.http.getString();
    c.http.end();
    if (st != 200) {
      Serial.printf("Login falhou (HTTP %d): %s\n", st, resp.substring(0, 160).c_str());
      if (st < 0) c.explicar(st);
      return false;
    }
  }
  Conexao c;
  if (!c.abrir("/api/auth/get-session")) return false;
  int st = c.http.GET();
  String sessao = st == 200 ? c.http.getString() : "";
  c.http.end();
  orgId = campo(sessao, "activeOrganizationId");
  if (orgId.isEmpty()) { Serial.printf("Sessão sem organização (HTTP %d).\n", st); return false; }
  Serial.printf("Logado no Noteless como %s (org %s)\n", CONTA_EMAIL, orgId.c_str());
  return true;
}

// Corpo multipart lido aos pedaços: campos + arquivo do cartão + fim. O
// arquivo não cabe inteiro na memória (5 min de áudio são 2,4 MB).
class CorpoMultipart : public Stream {
 public:
  CorpoMultipart(const String &ini, File &arq, const String &fim) : ini(ini), arq(arq), fim(fim), tamArq(arq.size()) {}

  size_t total() const { return ini.length() + tamArq + fim.length(); }
  int available() override { return total() - pos; }

  // O HTTPClient conta como enviado o que pediu, não o que veio: tem que vir
  // tudo de uma vez, atravessando as três partes. Cartão que falha no meio
  // deixa o envio curto, e ele é refeito depois.
  size_t readBytes(char *destino, size_t quer) override {
    size_t feito = 0;
    while (feito < quer && pos < total()) {
      size_t k;
      if (pos < ini.length()) {
        k = min(quer - feito, ini.length() - pos);
        memcpy(destino + feito, ini.c_str() + pos, k);
      } else if (pos < ini.length() + tamArq) {
        k = arq.read((uint8_t *)destino + feito, min(quer - feito, ini.length() + tamArq - pos));
        if (k == 0) break;
      } else {
        size_t noFim = pos - ini.length() - tamArq;
        k = min(quer - feito, fim.length() - noFim);
        memcpy(destino + feito, fim.c_str() + noFim, k);
      }
      pos += k;
      feito += k;
    }
    return feito;
  }
  int read() override {
    char c;
    return readBytes(&c, 1) == 1 ? (uint8_t)c : -1;
  }
  int peek() override { return -1; }
  size_t write(uint8_t) override { return 0; }

 private:
  const String &ini;
  File &arq;
  const String &fim;
  size_t tamArq, pos = 0;
};

Resultado enviarArquivo(const String &caminho) {
  File arq = SD.open(caminho, FILE_READ);
  if (!arq) return TENTAR_DEPOIS;
  if (arq.size() <= 44) {  // só o cabeçalho: nada para ouvir
    arq.close();
    return RECUSADO;
  }
  String base = caminho.substring(caminho.lastIndexOf('/') + 1);
  String quando = gravadoEmDe(caminho);
  float seg = (arq.size() - 44) / (float)TAXA;
  String ini = String("--") + FRONTEIRA + "\r\nContent-Disposition: form-data; name=\"duracaoSeg\"\r\n\r\n" +
               String((int)(seg + 0.5f)) + "\r\n";
  if (quando.length())
    ini += String("--") + FRONTEIRA + "\r\nContent-Disposition: form-data; name=\"gravadoEm\"\r\n\r\n" + quando + "\r\n";
  ini += String("--") + FRONTEIRA + "\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"" + base +
         "\"\r\nContent-Type: audio/wav\r\n\r\n";
  String fim = String("\r\n--") + FRONTEIRA + "--\r\n";

  for (int tentativa = 0; tentativa < 2; tentativa++) {
    if (orgId.isEmpty() && !entrar()) break;
    arq.seek(0);
    CorpoMultipart corpo(ini, arq, fim);
    Conexao c;
    if (!c.abrir("/api/org/" + orgId + "/ocorrencias")) break;
    c.http.addHeader("Content-Type", String("multipart/form-data; boundary=") + FRONTEIRA);
    Serial.printf("Enviando %s (%.1f s%s%s)...\n", base.c_str(), seg, quando.length() ? ", gravada em " : ", sem hora", quando.c_str());
    int st = c.http.sendRequest("POST", &corpo, corpo.total());
    String resp = st > 0 ? c.http.getString() : "";
    c.http.end();

    if (st == 201) {
      arq.close();
      SD.remove(caminho);
      Serial.println("Nota criada no Noteless!");
      Serial.println("  Transcrição: " + campo(resp, "transcricao"));
      Serial.println("  Resumo:      " + campo(resp, "resumo"));
      return ENVIADO;
    }
    if (st == 401 || st == 403) { orgId = ""; continue; }  // sessão expirou: entra de novo
    Serial.printf("Falhou (HTTP %d): %s\n", st, resp.substring(0, 200).c_str());
    if (st < 0) c.explicar(st);
    arq.close();
    // 400 e 413: o Noteless leu e recusou o arquivo — mandar de novo não adianta.
    return st == 400 || st == 413 ? RECUSADO : TENTAR_DEPOIS;
  }
  arq.close();
  return TENTAR_DEPOIS;
}

void tarefaRede(void *) {
  uint32_t ultimaWifi = 0, ultimoLogin = 0, proximoEnvio = 0, espera = 0;
  bool primeiraVez = true, relogioPedido = false, nomesComHora = false;
  while (true) {
    if (WiFi.status() != WL_CONNECTED) {
      online = false;
      // Sem rede, tenta de novo a cada 30 s.
      if (primeiraVez || millis() - ultimaWifi > 30000) {
        primeiraVez = false;
        ultimaWifi = millis();
        conectarWifi();
      }
    }
    if (WiFi.status() == WL_CONNECTED) {
      if (!relogioPedido) {
        configTime(0, 0, "pool.ntp.org", "a.st1.ntp.br", "time.google.com");  // em UTC; o Noteless converte
        relogioPedido = true;
      }
      // Servidor inacessível ou rede instável: login de novo a cada minuto.
      if (orgId.isEmpty() && (!ultimoLogin || millis() - ultimoLogin > 60000)) {
        ultimoLogin = millis();
        entrar();
      }
      online = !orgId.isEmpty();
    }
    if (!nomesComHora && relogioValido()) {
      nomesComHora = true;
      Serial.printf("Relógio acertado pela internet: %s\n", isoDe(agoraEpochMs()).c_str());
      if (cartaoOk) darHoraAosNomes();
    }

    if (cartaoOk) naFila = contarFila();
    if (online && cartaoOk && naFila > 0 && (int32_t)(millis() - proximoEnvio) >= 0) {
      String caminho = proximaDaFila();
      Resultado r = caminho.isEmpty() ? TENTAR_DEPOIS : enviarArquivo(caminho);
      if (r == RECUSADO) {
        if (moverParaErro(caminho)) Serial.printf("Recusada pelo Noteless: guardada em %s, fora da fila.\n", PASTA_ERRO);
        else r = TENTAR_DEPOIS;
      }
      if (r == TENTAR_DEPOIS) {
        // Espera cada vez mais entre as tentativas: 15 s, 30 s... até 5 min.
        espera = espera ? min(espera * 2, (uint32_t)(5 * 60 * 1000)) : 15000;
        proximoEnvio = millis() + espera;
        Serial.printf("Tenta enviar de novo em %lu s (%d na fila).\n", (unsigned long)(espera / 1000), (int)naFila);
      } else {
        espera = 0;
      }
      if (cartaoOk) naFila = contarFila();
      continue;  // já parte para a próxima da fila
    }
    vTaskDelay(pdMS_TO_TICKS(1000));
  }
}
