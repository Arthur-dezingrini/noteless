// Tarefa de rede: conecta no Wi-Fi salvo, acerta o relógio pela internet,
// entra no Noteless e esvazia a fila do cartão, da mais antiga para a mais
// nova. Roda separada do botão: enviar (e esperar a transcrição) nunca impede
// de começar outra gravação.

const char *FRONTEIRA = "----noteless-esp32";

#ifndef CONTA_EMPRESA
#define CONTA_EMPRESA ""  // segredos.h antigo, sem a empresa: a mais antiga da conta
#endif

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
  registrar("DNS da rede (%s) não respondeu; usando 1.1.1.1 e 8.8.8.8.\n", WiFi.dnsIP(0).toString().c_str());
  WiFi.STA.dnsIP(0, IPAddress(1, 1, 1, 1));
  WiFi.STA.dnsIP(1, IPAddress(8, 8, 8, 8));
}

bool conectarWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  registrar("Wi-Fi \"%s\": conectando...", wifiNome.c_str());
  WiFi.mode(WIFI_STA);
  // Sem economia de energia: consumo constante (~100 mA) que não deixa powerbank
  // desligar sozinha, e o envio responde mais rápido.
  WiFi.setSleep(false);
  WiFi.disconnect();  // encerra tentativa anterior ainda em andamento ("sta is connecting")
  WiFi.begin(wifiNome.c_str(), wifiSenha.c_str());
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) delay(250);
  bool ok = WiFi.status() == WL_CONNECTED;
  if (ok) registrar("Wi-Fi \"%s\": ok, IP %s, sinal %d dBm", wifiNome.c_str(), WiFi.localIP().toString().c_str(), WiFi.RSSI());
  else registrar("ERRO: Wi-Fi \"%s\" fora de alcance ou senha errada (status %d).", wifiNome.c_str(), (int)WiFi.status());
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
    registrar("  %s | DNS de %s (servidor %s): %s | memória livre %u (maior bloco %u)\n",
                  HTTPClient::errorToString(st).c_str(), host.c_str(), WiFi.dnsIP(0).toString().c_str(),
                  dns ? ip.toString().c_str() : "FALHOU", ESP.getFreeHeap(), heap_caps_get_largest_free_block(MALLOC_CAP_8BIT));
    char erro[120];
    if (seguro.lastError(erro, sizeof(erro)) != 0) registrar("  TLS: %s\n", erro);
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
      registrar("ERRO: login falhou (HTTP %d): %s\n", st, resp.substring(0, 160).c_str());
      if (st < 0) c.explicar(st);
      return false;
    }
  }
  {
    Conexao c;  // fecha antes da próxima: duas conexões seguras de uma vez não abrem
    if (!c.abrir("/api/auth/get-session")) return false;
    int st = c.http.GET();
    String sessao = st == 200 ? c.http.getString() : "";
    c.http.end();
    orgId = campo(sessao, "activeOrganizationId");
    if (orgId.isEmpty()) { registrar("ERRO: sessão sem organização (HTTP %d).\n", st); return false; }
  }
  if (strlen(CONTA_EMPRESA) && !escolherEmpresa()) { orgId = ""; return false; }
  registrar("Logado no Noteless como %s (org %s)\n", CONTA_EMAIL, orgId.c_str());
  avisarLogo();  // antes de enviar a fila: o sistema diz para qual empresa as notas vão
  return true;
}

// Id da empresa com esse nome (ou slug) na lista de empresas da conta; vazio se
// ela não estiver vinculada. Em "nomes" ficam todas, para o registro.
String acharEmpresa(const String &lista, const char *nome, String &nomes) {
  String achou;
  for (int i = lista.indexOf('{'); i >= 0; i = lista.indexOf('{', i + 1)) {
    int f = lista.indexOf('}', i);
    if (f < 0) break;
    String org = lista.substring(i, f + 1);
    String n = campo(org, "name");
    if (n.isEmpty()) continue;
    if (!nomes.isEmpty()) nomes += ", ";
    nomes += n;
    if (achou.isEmpty() && (n.equalsIgnoreCase(nome) || campo(org, "slug").equalsIgnoreCase(nome))) achou = campo(org, "id");
  }
  return achou;
}

// O login deixa ativa a empresa mais antiga da conta. Com CONTA_EMPRESA, as
// notas começam indo para essa — até o aviso de estado responder a escolhida
// no Noteless. A rota de notas recebe a empresa na URL e confere o vínculo,
// então basta o id (não precisa trocar a empresa ativa da sessão).
bool escolherEmpresa() {
  Conexao c;
  if (!c.abrir("/api/auth/organization/list")) return false;
  int st = c.http.GET();
  String lista = st == 200 ? c.http.getString() : "";
  c.http.end();
  if (st != 200) {
    registrar("ERRO: não consegui ver as empresas da conta (HTTP %d).", st);
    if (st < 0) c.explicar(st);
    return false;
  }
  String nomes;
  String id = acharEmpresa(lista, CONTA_EMPRESA, nomes);
  if (id.isEmpty()) {
    // Não trava: a empresa escolhida no Noteless (aviso de estado) vale mais que esta.
    registrar("AVISO: a conta %s não está vinculada à empresa \"%s\" (vinculada a: %s); fica a do Noteless.",
              CONTA_EMAIL, CONTA_EMPRESA, nomes.isEmpty() ? "nenhuma" : nomes.c_str());
    return true;
  }
  orgId = id;
  registrar("Notas vão para a empresa \"%s\".", CONTA_EMPRESA);
  return true;
}

// Corpo multipart lido aos pedaços: campos + arquivo do cartão + fim. O
// arquivo não cabe inteiro na memória (5 min de áudio são 2,4 MB).
class CorpoMultipart : public Stream {
 public:
  // O arquivo só abre no 1º pedaço do corpo, com a conexão segura já feita: a
  // conta do RSA na abertura dela precisa de ~85 KB livres, e o arquivo aberto
  // (com o buffer dele) já tirava o bastante para ela falhar.
  CorpoMultipart(const String &ini, const String &caminho, size_t tamArq, const String &fim)
      : ini(ini), caminho(caminho), fim(fim), tamArq(tamArq) {}
  ~CorpoMultipart() { fechar(); }
  void fechar() {
    if (arq) arq.close();
  }

  size_t total() const { return ini.length() + tamArq + fim.length(); }
  size_t lido() const { return pos; }             // para o registro: até onde o envio chegou
  uint32_t primeiroMs = 0;                         // millis() do 1º pedaço = conexão e cabeçalhos prontos
  bool falhouCartao = false;                       // o arquivo não abriu ou parou de ler no meio
  // Em pedaços de 512 bytes: o HTTPClient lê o que available() diz, e cada
  // pedaço vira um pacote próprio (TCP_NODELAY). Com pacotes cheios (~1500
  // bytes), há redes que os perdem sem avisar e o envio trava no 1º pedaço.
  int available() override { return min(total() - pos, (size_t)512); }

  // O HTTPClient conta como enviado o que pediu, não o que veio: tem que vir
  // tudo de uma vez, atravessando as três partes. Cartão que falha no meio
  // deixa o envio curto, e ele é refeito depois.
  size_t readBytes(char *destino, size_t quer) override {
    size_t feito = 0;
    if (!primeiroMs) primeiroMs = millis();
    while (feito < quer && pos < total()) {
      size_t k;
      if (pos < ini.length()) {
        k = min(quer - feito, ini.length() - pos);
        memcpy(destino + feito, ini.c_str() + pos, k);
      } else if (pos < ini.length() + tamArq) {
        if (!arq) {
          arq = SD.open(caminho, FILE_READ);
          if (!arq || !arq.seek(pos - ini.length())) {
            falhouCartao = true;
            break;
          }
        }
        k = arq.read((uint8_t *)destino + feito, min(quer - feito, ini.length() + tamArq - pos));
        if (k == 0) {
          falhouCartao = true;
          break;
        }
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
  const String &caminho;
  File arq;
  const String &fim;
  size_t tamArq, pos = 0;
};

Resultado enviarArquivo(const String &caminho) {
  File arq = SD.open(caminho, FILE_READ);
  if (!arq) {
    cartaoFalhou("abrir um áudio da fila");
    return TENTAR_DEPOIS;
  }
  size_t tamArq = arq.size();
  arq.close();  // reabre só depois da conexão segura (ver CorpoMultipart)
  if (tamArq <= 44) return RECUSADO;  // só o cabeçalho: nada para ouvir
  String base = caminho.substring(caminho.lastIndexOf('/') + 1);
  String quando = gravadoEmDe(caminho);
  float seg = (tamArq - 44) / (float)TAXA;
  String ini = String("--") + FRONTEIRA + "\r\nContent-Disposition: form-data; name=\"duracaoSeg\"\r\n\r\n" +
               String((int)(seg + 0.5f)) + "\r\n";
  if (quando.length())
    ini += String("--") + FRONTEIRA + "\r\nContent-Disposition: form-data; name=\"gravadoEm\"\r\n\r\n" + quando + "\r\n";
  ini += String("--") + FRONTEIRA + "\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"" + base +
         "\"\r\nContent-Type: audio/wav\r\n\r\n";
  String fim = String("\r\n--") + FRONTEIRA + "--\r\n";

  for (int tentativa = 0; tentativa < 2; tentativa++) {
    if (orgId.isEmpty() && !entrar()) break;
    CorpoMultipart corpo(ini, caminho, tamArq, fim);
    Conexao c;
    if (!c.abrir("/api/org/" + orgId + "/ocorrencias")) break;
    c.http.addHeader("Content-Type", String("multipart/form-data; boundary=") + FRONTEIRA);
    registrar("Enviando %s (%.1f s%s%s) | memória livre %u (maior bloco %u) | pilha livre %u...", base.c_str(), seg,
              quando.length() ? ", gravada em " : ", sem hora", quando.c_str(), ESP.getFreeHeap(),
              heap_caps_get_largest_free_block(MALLOC_CAP_8BIT), (unsigned)uxTaskGetStackHighWaterMark(NULL));
    uint32_t inicio = millis();
    int st = c.http.sendRequest("POST", &corpo, corpo.total());
    String resp = st > 0 ? c.http.getString() : "";
    c.http.end();
    corpo.fechar();

    // O cartão falhou no meio: o Noteless recebeu o áudio pela metade. Não é
    // recusa (o arquivo pode estar bom): fica na fila para quando o cartão voltar.
    if (corpo.falhouCartao) {
      registrar("ERRO: o cartão falhou enquanto %s subia (%u de %u bytes).", base.c_str(), (unsigned)corpo.lido(), (unsigned)corpo.total());
      cartaoFalhou("ler um áudio da fila durante o envio");
      return TENTAR_DEPOIS;
    }
    if (st == 201) {
      registrar("Nota criada no Noteless em %.1f s: %s", (millis() - inicio) / 1000.0f, base.c_str());
      if (!SD.remove(caminho)) {
        registrar("AVISO: a nota foi criada, mas %s não saiu da fila: se o cartão voltar com ele, pode subir de novo.", base.c_str());
        cartaoFalhou("tirar da fila um áudio enviado");
      }
      registrar("  Transcrição: %s", campo(resp, "transcricao").c_str());
      registrar("  Resumo:      %s", campo(resp, "resumo").c_str());
      return ENVIADO;
    }
    if (st == 401 || st == 403) {  // sessão expirou: entra de novo
      registrar("Sessão recusada (HTTP %d): entrando de novo.", st);
      orgId = "";
      continue;
    }
    registrar("ERRO: envio de %s falhou depois de %.1f s (HTTP %d): %s", base.c_str(), (millis() - inicio) / 1000.0f, st,
              resp.substring(0, 200).c_str());
    if (corpo.primeiroMs)
      registrar("  conexão + cabeçalhos: %.1f s | corpo: %u de %u bytes lidos em %.1f s", (corpo.primeiroMs - inicio) / 1000.0f,
                (unsigned)corpo.lido(), (unsigned)corpo.total(), (millis() - corpo.primeiroMs) / 1000.0f);
    else
      registrar("  o corpo nem começou a ir: caiu na conexão ou nos cabeçalhos");
    if (st < 0) c.explicar(st);
    // 400 e 413: o Noteless leu e recusou o arquivo — mandar de novo não adianta.
    return st == 400 || st == 413 ? RECUSADO : TENTAR_DEPOIS;
  }
  return TENTAR_DEPOIS;
}

void tarefaRede(void *) {
  uint32_t ultimaWifi = 0, ultimoLogin = 0, proximoEnvio = 0, espera = 0;
  uint32_t esperaMontagem = 10000, proximaMontagem = millis() + esperaMontagem;
  bool primeiraVez = true, relogioPedido = false, nomesComHora = false, estavaNoWifi = false;
  while (true) {
    if (falhaNoRegistro) {
      falhaNoRegistro = false;
      cartaoFalhou("gravar o registro");
    }
    // Cartão que falhou às vezes volta (mau contato, placa reiniciada com ele
    // ocupado). Montar um cartão travado leva até ~30 s: por isso aqui, em
    // segundo plano, cada vez mais espaçado (10 s, 20 s, 40 s, depois a cada
    // minuto: cartão recolocado volta em até 1 min), e nunca com o loop usando.
    if (!cartaoOk && !loopUsandoCartao && (int32_t)(millis() - proximaMontagem) >= 0) {
      esperaMontagem = montarCartao() ? 10000 : min(esperaMontagem * 2, (uint32_t)60000);
      proximaMontagem = millis() + esperaMontagem;
    }
    // Gravação que ficou como .raw (cartão falhou ao fechar, energia caiu): vira .wav.
    if (cartaoOk && haPendentes && !gravando && !loopUsandoCartao) recuperarPendente();

    if (WiFi.status() != WL_CONNECTED) {
      if (estavaNoWifi) registrar("AVISO: Wi-Fi caiu (status %d).", (int)WiFi.status());
      estavaNoWifi = false;
      online = false;
      // Sem rede, tenta de novo a cada 30 s.
      if (primeiraVez || millis() - ultimaWifi > 30000) {
        primeiraVez = false;
        ultimaWifi = millis();
        conectarWifi();
      }
    }
    if (WiFi.status() == WL_CONNECTED) {
      estavaNoWifi = true;
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
      if (online && avisoDevido()) avisarEstado();
    }
    if (!nomesComHora && relogioValido()) {
      nomesComHora = true;
      registrar("Relógio acertado pela internet: %s\n", isoDe(agoraEpochMs()).c_str());
      if (cartaoOk) darHoraAosNomes();
    }

    atualizarFila();
    if (online && cartaoOk && naFila > 0 && (int32_t)(millis() - proximoEnvio) >= 0) {
      conferirEmpresa();
      if (orgId.isEmpty()) continue;  // a sessão caiu no aviso: entra de novo antes de enviar
      String caminho = proximaDaFila();
      Resultado r = caminho.isEmpty() ? TENTAR_DEPOIS : enviarArquivo(caminho);
      if (r == RECUSADO) {
        if (moverParaErro(caminho)) registrar("ERRO: recusada pelo Noteless: guardada em %s, fora da fila.\n", PASTA_ERRO);
        else r = TENTAR_DEPOIS;
      }
      if (r == TENTAR_DEPOIS) {
        // Espera cada vez mais entre as tentativas: 15 s, 30 s... até 5 min.
        espera = espera ? min(espera * 2, (uint32_t)(5 * 60 * 1000)) : 15000;
        proximoEnvio = millis() + espera;
        registrar("Tenta enviar de novo em %lu s (%d na fila).\n", (unsigned long)(espera / 1000), (int)naFila);
      } else {
        espera = 0;
      }
      atualizarFila();
      continue;  // já parte para a próxima da fila
    }
    vTaskDelay(pdMS_TO_TICKS(1000));
  }
}
