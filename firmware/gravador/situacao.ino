// Aviso de estado para o Noteless (Configurações › Gravadores). Leva Wi-Fi,
// fila, cartão, último erro e o motivo do boot. É também como a placa se
// apresenta: na primeira vez ela aparece lá aguardando aprovação (HTTP 202);
// aprovada, a resposta diz para qual empresa as notas vão (quem escolhe é o
// sistema).
//
// Pouco, de propósito: cada aviso é uma requisição na Vercel e acorda o banco.
// Avisa logo ao conectar, quando algo muda (erro novo, fila, cartão) com pelo
// menos 5 min entre um e outro, antes de cada envio (a empresa pode ter mudado,
// ou o envio ter sido pausado no Noteless) e, fora isso, a cada 15 min.
// Servidor fora do ar: de novo a cada minuto. Aguardando aprovação na primeira
// meia hora depois de ligar (alguém deve estar aprovando agora): a cada minuto;
// esquecida assim, volta ao ritmo normal e não deixa o banco acordado. Com o
// envio pausado e gravação esperando: a cada minuto, para retomar logo.

const uint32_t AVISO_A_CADA_MS = 15 * 60000;
const uint32_t AVISO_MINIMO_MS = 5 * 60000;
const uint32_t DE_NOVO_MS = 60000;
const uint32_t AGUARDANDO_LOGO_MS = 30 * 60000;

uint32_t ultimoAvisoMs = 0, erroAvisado = 0;
uint32_t errosMandados = 0;  // linhas de erro que o Noteless já recebeu
int filaAvisada = -1;
bool cartaoAvisado = false;
bool avisoFalhando = false;       // o Noteless não respondeu (rede ou servidor fora)
bool aguardandoAprovacao = false;
String avisoDoSistema;  // o "aviso" (ou erro) da última resposta: registra só quando muda

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

bool cartaoGravando() { return cartaoOk && registroAberto(); }

bool avisoDevido() {
  uint32_t desde = millis() - ultimoAvisoMs;
  if (!ultimoAvisoMs || desde >= AVISO_A_CADA_MS) return true;
  if (desde >= DE_NOVO_MS && (avisoFalhando || (aguardandoAprovacao && millis() < AGUARDANDO_LOGO_MS) || (envioPausado && naFila > 0))) return true;
  if (desde < AVISO_MINIMO_MS) return false;
  char t[2];
  return ultimoErro(t, sizeof(t)) != erroAvisado || naFila != filaAvisada || cartaoGravando() != cartaoAvisado;
}

// Antes de cada envio: a empresa de destino pode ter mudado no Noteless, ou o
// envio ter sido pausado (aí a gravação fica no cartão). Um aviso a mais por
// nota, para a pausa valer na hora.
void conferirEmpresa() { avisarEstado(); }

String jsonEstado(const char *erro, uint32_t erroMs, int fila, uint32_t &errosAteAqui) {
  String j = String("{\"serie\":\"") + serieDaPlaca + "\",\"versao\":\"" + FIRMWARE_VERSAO + "\"";
  j += String(",\"atualizacao\":") + atualizacaoJson();
  j += String(",\"wifi\":{\"rede\":\"") + jsonTexto(wifiNome.c_str()) + "\",\"sinalDbm\":" + String(WiFi.RSSI()) + ",\"ip\":\"" +
       WiFi.localIP().toString() + "\"}";
  j += String(",\"fila\":") + String(fila) + ",\"recusadas\":" + String(cartaoOk ? max(0, contar(PASTA_ERRO)) : 0);
  j += String(",\"cartao\":{\"ok\":") + (cartaoGravando() ? "true" : "false") + ",\"livreGb\":" +
       (cartaoOk ? String(cartaoLivreGb, USAR_CARTAO ? 1 : 4) : String("null")) + "}";
  if (erroMs)
    j += String(",\"ultimoErro\":{\"texto\":\"") + jsonTexto(erro) + "\",\"haSeg\":" + String((millis() - erroMs) / 1000) + "}";
  else
    j += ",\"ultimoErro\":null";
  // Só durante o aviso (fixa, tirava 1,6 KB da memória que o envio precisa).
  LinhaErro *novos = new LinhaErro[ERROS_GUARDADOS];
  int n = errosDesde(errosMandados, novos, ERROS_GUARDADOS, errosAteAqui);
  j += ",\"erros\":[";
  for (int i = 0; i < n; i++)
    j += String(i ? "," : "") + "{\"texto\":\"" + jsonTexto(novos[i].texto) + "\",\"haSeg\":" + String((millis() - novos[i].ms) / 1000) + "}";
  j += "]";
  delete[] novos;
  j += String(",\"boot\":{\"motivo\":\"") + jsonTexto(motivoDoBoot()) + "\",\"haSeg\":" + String(millis() / 1000) + "}}";
  return j;
}

void avisarEstado() {
  ultimoAvisoMs = millis();
  char erro[200];
  uint32_t erroMs = ultimoErro(erro, sizeof(erro));
  int fila = naFila;
  bool cartao = cartaoGravando();
  uint32_t errosAteAqui;
  String json = jsonEstado(erro, erroMs, fila, errosAteAqui);

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

  if (st == 200 || st == 202) {  // 202: aguardando aprovação
    validarVersaoNova();  // versão nova que fala com o Noteless fica (versao.ino)
    if (st == 200) receberOferta(resp);
    if (avisoFalhando) registrar("O estado do gravador voltou a chegar no Noteless.");
    avisoFalhando = false;
    aguardandoAprovacao = st == 202;
    errosMandados = errosAteAqui;
    String destino = campo(resp, "id");
    if (destino != orgId) {
      if (destino.length()) registrar("Notas vão para a empresa \"%s\" (escolhida no Noteless).", campo(resp, "nome").c_str());
      orgId = destino;
    }
    bool pausado = resp.indexOf("\"pausado\":true") >= 0;
    if (pausado != envioPausado)
      registrar(pausado ? "Envio pausado no Noteless: as gravações ficam no cartão." : "Envio retomado no Noteless: a fila volta a subir.");
    envioPausado = pausado;
    String aviso = campo(resp, "aviso");
    if (aviso != avisoDoSistema && aviso.length()) registrar(st == 202 ? "%s Aprove em Configurações › Gravadores." : "AVISO: %s", aviso.c_str());
    avisoDoSistema = aviso;
  } else if (st > 0 && st < 500) {
    // Recusou a placa (segredo que não confere, gravadores demais aguardando):
    // de novo logo não adianta.
    avisoFalhando = aguardandoAprovacao = false;
    orgId = "";
    String erro = campo(resp, "error");
    if (erro != avisoDoSistema) registrar("ERRO: o Noteless recusou o gravador (HTTP %d): %s", st, erro.c_str());
    avisoDoSistema = erro;
  } else {
    if (!avisoFalhando) registrar("AVISO: o Noteless não recebeu o estado do gravador (HTTP %d).", st);
    avisoFalhando = true;
  }
  // O que este aviso registrou não puxa outro aviso logo em seguida.
  char t[2];
  erroAvisado = ultimoErro(t, sizeof(t));
  filaAvisada = fila;
  cartaoAvisado = cartao;
}
