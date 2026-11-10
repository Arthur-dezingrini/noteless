// Configuração do Wi-Fi pelo celular, sem app. Sem rede salva — ou com 5 cliques
// seguidos no botão — a placa vira um ponto de acesso aberto, "Noteless-XXXX".
// Quem conecta nele cai numa página (portal cativo: todo endereço leva a ela)
// para escolher a rede e digitar a senha. A rede só é salva depois de conectar
// de verdade; aí a placa reinicia já usando ela.

// Os cliques vêm com a placa rodando: a tarefa de rede pode estar no meio de um
// envio, e o modo configuração precisa do rádio só para ele. Em vez de
// disputar o Wi-Fi, a placa anota o pedido e reinicia direto nesse modo.
void pedirTrocaDeWifi() {
  prefs.begin("noteless", false);
  prefs.putBool("trocarWifi", true);
  prefs.end();
  delay(100);
  ESP.restart();
}

void carregarRede() {
  prefs.begin("wifi", true);
  wifiNome = prefs.getString("nome", "");
  wifiSenha = prefs.getString("senha", "");
  prefs.end();
}

void salvarRede(const String &nome, const String &senha) {
  prefs.begin("wifi", false);
  prefs.putString("nome", nome);
  prefs.putString("senha", senha);
  prefs.end();
}

String escaparHtml(const String &s) {
  String r;
  for (char c : s) {
    if (c == '&') r += "&amp;";
    else if (c == '<') r += "&lt;";
    else if (c == '>') r += "&gt;";
    else if (c == '"') r += "&quot;";
    else r += c;
  }
  return r;
}

const char PAGINA_INICIO[] = R"(<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Wi-Fi do gravador · Noteless</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:24px 16px;background:#f6f6f4;color:#1f1f1d}
main{max-width:420px;margin:0 auto}h1{font-size:22px;margin:0 0 6px}p{color:#5f5e5a;line-height:1.5;margin:0 0 16px}
label{display:block;font-size:14px;margin:18px 0 6px}select,input{width:100%;box-sizing:border-box;font-size:16px;
padding:12px;border:1px solid #c9c7bf;border-radius:8px;background:#fff;color:inherit}
button{width:100%;margin-top:22px;padding:14px;font-size:16px;border:0;border-radius:8px;background:#1f6f43;color:#fff}
.dica{font-size:13px;margin-top:18px}a{color:#1f6f43}.ver{display:flex;gap:8px;align-items:center;margin-top:10px}
.ver input{width:auto}</style></head><body><main>)";

const char PAGINA_FIM[] = "</main></body></html>";

// Lista as redes ao alcance como <option>, da mais forte para a mais fraca,
// sem repetir nome. Rede corporativa (usuário + senha) aparece desabilitada.
String procurarRedes() {
  int n = WiFi.scanNetworks();
  if (n < 0) {  // rádio ocupado: mais uma vez
    delay(500);
    n = WiFi.scanNetworks();
    if (n < 0) n = 0;
  }
  String opcoes, vistos = "\n";
  for (int k = 0; k < n; k++) {
    int melhor = -1;
    for (int i = 0; i < n; i++) {
      String nome = WiFi.SSID(i);
      if (nome.isEmpty() || vistos.indexOf("\n" + nome + "\n") >= 0) continue;
      if (melhor < 0 || WiFi.RSSI(i) > WiFi.RSSI(melhor)) melhor = i;
    }
    if (melhor < 0) break;
    String nome = WiFi.SSID(melhor);
    vistos += nome + "\n";
    int rssi = WiFi.RSSI(melhor);
    wifi_auth_mode_t tipo = WiFi.encryptionType(melhor);
    String sinal = rssi > -60 ? "sinal forte" : rssi > -75 ? "sinal médio" : "sinal fraco";
    String e = escaparHtml(nome);
    if (tipo == WIFI_AUTH_WPA2_ENTERPRISE || tipo == WIFI_AUTH_WPA3_ENTERPRISE)
      opcoes += "<option disabled>" + e + " · corporativa (não dá)</option>";
    else
      opcoes += "<option value=\"" + e + "\">" + e + " · " + sinal + (tipo == WIFI_AUTH_OPEN ? " · aberta" : "") + "</option>";
  }
  WiFi.scanDelete();
  Serial.printf("Portal: %d redes ao alcance.\n", n);
  return opcoes;
}

String paginaRedes(const String &opcoes) {
  return String(PAGINA_INICIO) + R"(<h1>Wi-Fi do gravador</h1>
<p>Escolha a rede que o gravador vai usar para enviar as gravações ao Noteless.</p>
<form method="post" action="/salvar"><label for="nome">Rede</label><select id="nome" name="nome">)" + opcoes +
         R"(<option value="">Outra rede (digitar o nome)…</option></select>
<input id="outra" name="outra" placeholder="Nome da rede" autocapitalize="none" autocorrect="off" spellcheck="false" style="display:none;margin-top:8px">
<label for="senha">Senha</label><input id="senha" name="senha" type="password" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
<label class="ver"><input type="checkbox" onclick="senha.type=this.checked?'text':'password'"> Mostrar senha</label>
<button>Conectar</button></form>
<p class="dica">Só aparecem redes de 2,4 GHz: o gravador não enxerga 5 GHz. <a href="/?procurar=1">Procurar de novo</a></p>
<script>(nome.onchange=()=>{outra.style.display=nome.value?'none':'block'})()</script>)" + PAGINA_FIM;
}

String paginaAguarde(const String &nome) {
  return String(PAGINA_INICIO) + "<h1>Conectando…</h1><p id=\"msg\">Tentando entrar em <b>" + escaparHtml(nome) +
         R"(</b>. Leva alguns segundos.</p>
<form id="forcar" method="post" action="/forcar" style="display:none"><button>Salvar mesmo assim</button>
<p class="dica">Use se a rede for o roteador deste celular: ele fica desligado enquanto você está conectado ao gravador.</p></form>
<script>let falhas=0;async function ver(){try{const t=await (await fetch('/estado')).text();falhas=0;
if(t=='ok'){msg.innerHTML='Pronto! O gravador conectou e vai reiniciar. O LED azul fica aceso quando ele estiver pronto. Pode fechar esta página.';return}
if(t.startsWith('erro')){msg.innerHTML='Não conectou: '+t.slice(5)+'. <a href="/">Tentar de novo</a>';forcar.style.display='block';return}
}catch(e){if(++falhas>3)msg.textContent='Reconectando ao gravador… se demorar, entre de novo na rede dele.'}setTimeout(ver,1000)}ver()</script>)" +
         PAGINA_FIM;
}

// O motivo que o rádio deu para a última tentativa falhar, para a página.
String motivoFalha(uint16_t r) {
  switch (r) {
    case 0: return "a rede não respondeu a tempo";
    case WIFI_REASON_4WAY_HANDSHAKE_TIMEOUT:
    case WIFI_REASON_HANDSHAKE_TIMEOUT:
    case WIFI_REASON_AUTH_FAIL:
    case WIFI_REASON_MIC_FAILURE:
    case WIFI_REASON_AUTH_EXPIRE: return "senha errada (maiúsculas e minúsculas contam)";
    case WIFI_REASON_NO_AP_FOUND:
    case WIFI_REASON_BEACON_TIMEOUT: return "rede não encontrada (desligada, longe ou só 5 GHz)";
    case WIFI_REASON_NO_AP_FOUND_W_COMPATIBLE_SECURITY:
    case WIFI_REASON_NO_AP_FOUND_IN_AUTHMODE_THRESHOLD: return "segurança da rede incompatível (aberta, WEP ou WPA antigo)";
    case WIFI_REASON_NO_AP_FOUND_IN_RSSI_THRESHOLD: return "sinal fraco demais";
    default: return "a rede recusou a conexão (código " + String(r) + ")";
  }
}

String paginaSalvo(const String &nome) {
  return String(PAGINA_INICIO) + "<h1>Rede salva</h1><p>O gravador vai reiniciar e tentar entrar em <b>" + escaparHtml(nome) +
         "</b>. Pode desconectar desta rede. O LED azul fica aceso quando ele conectar.</p>" + PAGINA_FIM;
}

void configurarWifi() {
  uint64_t mac = ESP.getEfuseMac();
  char nomeAp[16];
  snprintf(nomeAp, sizeof(nomeAp), "Noteless-%02X%02X", (uint8_t)(mac >> 32), (uint8_t)(mac >> 40));

  // Para de tentar a rede salva: cada tentativa tira o rádio do canal do ponto
  // de acesso (o celular deixa de ver a rede) e faz a busca de redes falhar.
  WiFi.setAutoReconnect(false);
  WiFi.disconnect();
  delay(100);
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(nomeAp);
  delay(100);
  IPAddress ip = WiFi.softAPIP();
  DNSServer dns;
  dns.start(53, "*", ip);  // todo nome de site responde com o gravador
  WebServer servidor(80);
  String opcoes = procurarRedes();

  enum { PARADO, CONECTANDO, CONECTADO, FALHOU } estado = PARADO;
  String nome, senha, motivo;
  uint32_t desde = 0, reiniciarEm = 0;
  const uint32_t inicio = millis();
  uint32_t mexeu = inicio;  // último pedido do celular: a página aberta segura o modo configuração
  auto ativo = [&]() { mexeu = millis(); };

  // O porquê da falha vem no evento de desconexão. O ASSOC_LEAVE é o nosso
  // próprio WiFi.disconnect() antes de tentar.
  uint16_t ultimoMotivo = 0;
  WiFi.onEvent(
      [&](arduino_event_id_t, arduino_event_info_t info) {
        uint16_t r = info.wifi_sta_disconnected.reason;
        if (estado == CONECTANDO && r != WIFI_REASON_ASSOC_LEAVE) ultimoMotivo = r;
      },
      ARDUINO_EVENT_WIFI_STA_DISCONNECTED);

  servidor.on("/", HTTP_GET, [&]() {
    ativo();
    if (servidor.hasArg("procurar")) opcoes = procurarRedes();
    servidor.send(200, "text/html; charset=utf-8", paginaRedes(opcoes));
  });
  servidor.on("/salvar", HTTP_POST, [&]() {
    ativo();
    nome = servidor.arg("nome");
    if (nome.isEmpty()) nome = servidor.arg("outra");
    nome.trim();
    senha = servidor.arg("senha");
    if (nome.isEmpty()) {
      servidor.sendHeader("Location", "/");
      servidor.send(303);
      return;
    }
    Serial.printf("Portal: testando \"%s\"...\n", nome.c_str());
    WiFi.disconnect();
    ultimoMotivo = 0;
    WiFi.begin(nome.c_str(), senha.c_str());
    estado = CONECTANDO;
    desde = millis();
    servidor.send(200, "text/html; charset=utf-8", paginaAguarde(nome));
  });
  servidor.on("/estado", HTTP_GET, [&]() {
    ativo();
    String r = estado == CONECTADO ? String("ok") : estado == FALHOU ? "erro:" + motivo : String("conectando");
    servidor.send(200, "text/plain; charset=utf-8", r);
  });
  servidor.on("/forcar", HTTP_POST, [&]() {  // salva sem testar (ver paginaAguarde)
    ativo();
    if (nome.isEmpty()) {
      servidor.sendHeader("Location", "/");
      servidor.send(303);
      return;
    }
    salvarRede(nome, senha);
    Serial.printf("Portal: \"%s\" salva sem testar.\n", nome.c_str());
    servidor.send(200, "text/html; charset=utf-8", paginaSalvo(nome));
    reiniciarEm = millis() + 3000;
  });
  servidor.onNotFound([&]() {  // celulares testam um endereço qualquer para achar o portal
    ativo();
    servidor.sendHeader("Location", "http://" + ip.toString() + "/");
    servidor.send(302);
  });
  servidor.begin();
  Serial.printf("Modo configuração: conecte o celular na rede \"%s\" e escolha o Wi-Fi na página que abrir (ou entre em http://%s).\n",
                nomeAp, ip.toString().c_str());

  // Com uma rede já salva há para onde voltar: um clique ou 5 min sem o celular
  // pedir nada cancelam. Nos primeiros 10 s o botão não cancela — quem acabou de
  // dar os 5 cliques às vezes dá mais um.
  uint32_t soltouEm = 0;
  while (true) {
    dns.processNextRequest();
    servidor.handleClient();
    digitalWrite(LED, (millis() / 600) % 2);  // piscando devagar = esperando configuração
    if (estado == CONECTANDO) {
      if (WiFi.status() == WL_CONNECTED) {
        salvarRede(nome, senha);
        estado = CONECTADO;
        reiniciarEm = millis() + 8000;  // dá tempo da página mostrar "Pronto"
        Serial.printf("Portal: conectou em \"%s\" (IP %s). Rede salva.\n", nome.c_str(), WiFi.localIP().toString().c_str());
      } else if (millis() - desde > 20000) {
        motivo = motivoFalha(ultimoMotivo);
        estado = FALHOU;
        WiFi.disconnect();
        Serial.printf("Portal: não conectou em \"%s\": %s.\n", nome.c_str(), motivo.c_str());
      }
    }
    if (!wifiNome.isEmpty() && estado != CONECTANDO && !reiniciarEm) {
      // A placa pode ter reiniciado com o dedo ainda no botão: o clique só conta
      // depois de 300 ms solto.
      if (digitalRead(BOTAO) == HIGH) {
        if (!soltouEm) soltouEm = millis();
      } else if (soltouEm && millis() - soltouEm > 300 && millis() - inicio > 10000) {
        Serial.println("Portal: cancelado pelo botão; voltando para a rede salva.");
        delay(100);
        ESP.restart();
      } else {
        soltouEm = 0;
      }
      if (millis() - mexeu > 5UL * 60 * 1000) {
        Serial.println("Portal: 5 min sem ninguém na página; voltando para a rede salva.");
        delay(100);
        ESP.restart();
      }
    }
    if (reiniciarEm && (int32_t)(millis() - reiniciarEm) > 0) {
      Serial.println("Portal: reiniciando com a rede nova.");
      delay(100);
      ESP.restart();
    }
    delay(2);
  }
}
