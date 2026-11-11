// Aviso de estado para o Noteless (Configurações › Gravadores): a cada 1 min e
// logo que algo muda (erro novo, fila). Leva Wi-Fi, fila, cartão, último erro
// e o motivo do boot. A resposta diz para qual empresa as notas vão: quem
// escolhe é o sistema; CONTA_EMPRESA só vale até ele responder.

const uint32_t AVISO_A_CADA_MS = 60000;
const uint32_t AVISO_MINIMO_MS = 10000;  // mudança logo depois de um aviso espera um pouco

uint32_t ultimoAvisoMs = 0, erroAvisado = 0;
int filaAvisada = -1;
bool avisoFalhando = false;
String avisoDoSistema;  // o "aviso" da última resposta: registra só quando muda

// Texto para dentro de "..." num JSON.
String jsonTexto(const char *s) {
  String r;
  for (; *s; s++) {
    if (*s == '"' || *s == '\\') {
      r += '\\';
      r += *s;
    } else if ((uint8_t)*s < 0x20) {
      r += ' ';
    } else {
      r += *s;
    }
  }
  return r;
}

// Depois do login: avisa já, para a resposta acertar a empresa antes de enviar a fila.
void avisarLogo() { ultimoAvisoMs = 0; }

bool avisoDevido() {
  uint32_t desde = millis() - ultimoAvisoMs;
  if (!ultimoAvisoMs || desde >= AVISO_A_CADA_MS) return true;
  if (desde < AVISO_MINIMO_MS) return false;
  char t[2];
  return ultimoErro(t, sizeof(t)) != erroAvisado || naFila != filaAvisada;
}

String jsonEstado(const char *erro, uint32_t erroMs, int fila) {
  String j = String("{\"serie\":\"") + WiFi.macAddress() + "\",\"versao\":\"" + __DATE__ " " __TIME__ + "\"";
  j += String(",\"wifi\":{\"rede\":\"") + jsonTexto(wifiNome.c_str()) + "\",\"sinalDbm\":" + String(WiFi.RSSI()) + ",\"ip\":\"" +
       WiFi.localIP().toString() + "\"}";
  j += String(",\"fila\":") + String(fila) + ",\"recusadas\":" + String(cartaoOk ? contar(PASTA_ERRO) : 0);
  j += String(",\"cartao\":{\"ok\":") + (cartaoOk && registroAberto() ? "true" : "false") + ",\"livreGb\":" +
       (cartaoOk ? String(cartaoLivreGb, 1) : String("null")) + "}";
  if (erroMs)
    j += String(",\"ultimoErro\":{\"texto\":\"") + jsonTexto(erro) + "\",\"haSeg\":" + String((millis() - erroMs) / 1000) + "}";
  else
    j += ",\"ultimoErro\":null";
  j += String(",\"boot\":{\"motivo\":\"") + jsonTexto(motivoDoBoot()) + "\",\"haSeg\":" + String(millis() / 1000) + "}";
  j += String(",\"empresaAtual\":") + (orgId.isEmpty() ? String("null") : String("\"") + orgId + "\"") + "}";
  return j;
}

void avisarEstado() {
  ultimoAvisoMs = millis();
  char erro[200];
  uint32_t erroMs = ultimoErro(erro, sizeof(erro));
  int fila = naFila;
  String json = jsonEstado(erro, erroMs, fila);

  int st;
  String resp;
  {
    Conexao c;
    if (!c.abrir("/api/gravadores/estado")) return;
    c.http.addHeader("Content-Type", "application/json");
    st = c.http.POST(json);
    resp = st > 0 ? c.http.getString() : "";
    c.http.end();
  }

  if (st == 401) {  // sessão expirou: entra de novo
    registrar("Aviso de estado: sessão recusada (HTTP %d): entrando de novo.", st);
    orgId = "";
  } else if (st != 200) {
    if (!avisoFalhando) registrar("AVISO: o Noteless não recebeu o estado do gravador (HTTP %d): %s", st, campo(resp, "error").c_str());
    avisoFalhando = true;
  } else {
    if (avisoFalhando) registrar("O estado do gravador voltou a chegar no Noteless.");
    avisoFalhando = false;
    String destino = campo(resp, "id");
    if (destino.length() && destino != orgId) {
      orgId = destino;
      registrar("Notas passam a ir para a empresa \"%s\" (escolhida no Noteless).", campo(resp, "nome").c_str());
    }
    String aviso = campo(resp, "aviso");
    if (aviso != avisoDoSistema && aviso.length()) registrar("AVISO: %s", aviso.c_str());
    avisoDoSistema = aviso;
  }
  // O que este aviso registrou não puxa outro aviso logo em seguida.
  char t[2];
  erroAvisado = ultimoErro(t, sizeof(t));
  filaAvisada = fila;
}
