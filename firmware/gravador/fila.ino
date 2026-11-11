// Fila de gravações no cartão: cada gravação pronta é um .wav em /fila, com o
// nome dizendo quando foi gravada. A tarefa de rede manda a mais antiga e só
// apaga depois que o Noteless confirma; o que ele recusa vai para /erro.

bool montarCartao() {
  static bool spiPronto = false, avisou = false;
  if (!spiPronto) {
    spiCartao.begin(CARTAO_SCK, CARTAO_MISO, CARTAO_MOSI, -1);
    spiPronto = true;
  }
  fecharRegistro();  // o arquivo não pode ficar aberto com o cartão desmontado
  SD.end();
  // 1 MHz: com os fios da protoboard, a 4 MHz o cartão monta e funciona, mas
  // troca bytes calado (3060 errados em 256 KB) — estalos no áudio e, uma vez,
  // a pasta raiz perdida. 1 MHz grava ~110 KB/s, e o áudio usa 16 KB/s.
  cartaoOk = SD.begin(CARTAO_CS, spiCartao, 1000000);
  if (!cartaoOk) {
    // O loop() tenta de novo a cada 10 s: avisa só na primeira.
    if (!avisou) registrar("ERRO: o cartão não respondeu. Confira se ele está encaixado e os fios (firmware/cartao testa um a um).");
    avisou = true;
    return false;
  }
  avisou = false;
  abrirRegistro();
  SD.mkdir(PASTA_FILA);
  SD.mkdir(PASTA_ERRO);
  // Placa desligada no meio de uma gravação: o bruto não tem volume acertado
  // nem fim certo, e o .tmp ficou pela metade. Não dá para aproveitar.
  SD.remove(ARQUIVO_BRUTO);
  apagarTemporarios();
  naFila = contar(PASTA_FILA);
  int recusadas = contar(PASTA_ERRO);
  char extra[64] = "";
  if (recusadas) snprintf(extra, sizeof(extra), " | %d recusada(s) guardada(s) em %s", recusadas, PASTA_ERRO);
  registrar("Cartão montado: %.1f GB livres | %d na fila%s", (SD.totalBytes() - SD.usedBytes()) / 1e9, naFila, extra);
  return true;
}

// Quantos .wav há na pasta (.tmp ainda está sendo escrito).
int contar(const char *pasta) {
  File p = SD.open(pasta);
  if (!p) return 0;
  int n = 0;
  for (File f = p.openNextFile(); f; f = p.openNextFile())
    if (!f.isDirectory() && String(f.name()).endsWith(".wav")) n++;
  return n;
}

int contarFila() { return contar(PASTA_FILA); }

void apagarTemporarios() {
  std::vector<String> lixo;  // apagar durante a listagem atrapalha a listagem
  File p = SD.open(PASTA_FILA);
  if (!p) return;
  for (File f = p.openNextFile(); f; f = p.openNextFile())
    if (String(f.name()).endsWith(".tmp")) lixo.push_back(String(PASTA_FILA) + "/" + f.name());
  p.close();
  for (const String &c : lixo) SD.remove(c);
}

// A mais antiga: os nomes começam pela hora. As sem hora ("b...") vêm antes.
String proximaDaFila() {
  File p = SD.open(PASTA_FILA);
  String menor;
  if (!p) return menor;
  for (File f = p.openNextFile(); f; f = p.openNextFile()) {
    String nome = f.name();
    if (f.isDirectory() || !nome.endsWith(".wav")) continue;
    if (menor.isEmpty() || nome < menor) menor = nome;
  }
  return menor.isEmpty() ? menor : String(PASTA_FILA) + "/" + menor;
}

// Tira da fila sem apagar: dá para recuperar o áudio tirando o cartão.
bool moverParaErro(const String &caminho) {
  String para = String(PASTA_ERRO) + caminho.substring(caminho.lastIndexOf('/'));
  SD.remove(para);
  return SD.rename(caminho, para);
}

String isoDe(uint64_t epochMs) {
  time_t s = epochMs / 1000;
  tm t;
  gmtime_r(&s, &t);
  char iso[24];
  strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", &t);
  return iso;
}

// Hora real em que a gravação começou, pelo nome. Gravação feita antes do
// relógio acertar só tem hora se a placa não reiniciou desde então (aí o
// millis() do nome ainda vale); senão, 0 — o Noteless usa a hora da chegada.
uint64_t inicioDe(const String &caminho) {
  String base = caminho.substring(caminho.lastIndexOf('/') + 1);
  if (base.startsWith("t")) return strtoull(base.c_str() + 1, nullptr, 10);
  if (base.startsWith("b") && relogioValido() && strtoul(base.c_str() + 1, nullptr, 10) == bootId) {
    uint32_t inicioMs = strtoul(base.c_str() + base.indexOf('-') + 1, nullptr, 10);
    return agoraEpochMs() - (millis() - inicioMs);
  }
  return 0;
}

String gravadoEmDe(const String &caminho) {
  uint64_t ms = inicioDe(caminho);
  return ms ? isoDe(ms) : "";
}

// O relógio acabou de acertar: as gravações deste boot feitas antes disso
// ganham a hora real no nome, e não a perdem se a placa reiniciar antes de enviar.
void darHoraAosNomes() {
  std::vector<String> semHora;
  File p = SD.open(PASTA_FILA);
  if (!p) return;
  for (File f = p.openNextFile(); f; f = p.openNextFile()) {
    String nome = f.name();
    if (nome.startsWith("b") && nome.endsWith(".wav")) semHora.push_back(String(PASTA_FILA) + "/" + nome);
  }
  p.close();
  for (const String &de : semHora) {
    uint64_t ms = inicioDe(de);
    if (!ms) continue;  // de um boot anterior: sem como saber a hora
    char para[48];
    snprintf(para, sizeof(para), "%s/t%llu.wav", PASTA_FILA, (unsigned long long)ms);
    if (SD.rename(de, para)) registrar("  %s gravada em %s\n", de.c_str(), isoDe(ms).c_str());
  }
}
