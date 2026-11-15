// Fila de gravações no cartão: cada gravação pronta é um .wav em /fila, com o
// nome dizendo quando foi gravada. A tarefa de rede manda a mais antiga e só
// apaga depois que o Noteless confirma; o que ele recusa vai para /erro.
// Gravação nunca é apagada por causa de falha: a que não virou .wav fica como
// .raw e é recuperada. Toda falha do cartão passa por cartaoFalhou().

// O cartão parou de responder no meio do uso: daqui em diante ninguém mexe
// nele até a tarefa de rede montar de novo (e testar). Avisa uma vez por falha.
void cartaoFalhou(const char *oQue) {
  if (!cartaoOk) return;
  cartaoOk = false;
  fecharRegistro();  // não insiste em escrever num cartão que falhou
  registrar(USAR_CARTAO ? "ERRO: o cartão parou de responder (%s). Se não voltar sozinho, desligue e ligue a USB; se repetir, troque o cartão."
                        : "ERRO: a memória interna falhou (%s). Se não voltar sozinha, desligue e ligue a USB.",
            oQue);
}

// Montar não basta: cartão com defeito monta e depois não lê nem grava. Abre a
// fila e grava, relê e apaga um arquivinho.
bool cartaoResponde() {
  memoria.mkdir(PASTA_FILA);
  memoria.mkdir(PASTA_ERRO);
  File p = memoria.open(PASTA_FILA);
  bool ok = p && p.isDirectory();
  if (p) p.close();
  const char *TESTE = "/teste-cartao.txt";
  if (ok) {
    File w = memoria.open(TESTE, FILE_WRITE);
    ok = w && w.print("noteless") == 8;
    if (w) w.close();
  }
  if (ok) {
    char lido[9] = {0};
    File r = memoria.open(TESTE, FILE_READ);
    ok = r && r.read((uint8_t *)lido, 8) == 8 && !strcmp(lido, "noteless");
    if (r) r.close();
  }
  memoria.remove(TESTE);
  return ok;
}

// Gravação interrompida (energia caiu ou o cartão falhou no meio): o bruto vira
// .raw na fila, longe da próxima gravação (que reescreveria ARQUIVO_BRUTO), e
// recuperarPendente o transforma em .wav.
void guardarBrutoAntigo() {
  if (!memoria.exists(ARQUIVO_BRUTO)) return;
  char para[48];
  snprintf(para, sizeof(para), "%s/r%06lu-%010lu.raw", PASTA_FILA, (unsigned long)bootId, (unsigned long)millis());
  if (memoria.rename(ARQUIVO_BRUTO, para)) {
    haPendentes = true;
    registrar("AVISO: havia uma gravação interrompida (energia ou cartão): guardada para recuperar.");
  }
}

// Monta e testa. Quem chama: setup() e a tarefa de rede, nunca com alguém
// usando o cartão (loopUsandoCartao). cartaoOk só vira true no fim, com tudo
// pronto: antes disso, ninguém mais toca no cartão.
bool montarCartao() {
  static bool avisou = false;
  cartaoOk = false;
  fecharRegistro();  // o arquivo não pode ficar aberto com o cartão desmontado
  memoria.end();
#if USAR_CARTAO
  static bool spiPronto = false;
  if (!spiPronto) {
    spiCartao.begin(CARTAO_SCK, CARTAO_MISO, CARTAO_MOSI, -1);
    spiPronto = true;
  }
  // 1 MHz: com os fios da protoboard, a 4 MHz o cartão monta e funciona, mas
  // troca bytes calado (3060 errados em 256 KB) — estalos no áudio e, uma vez,
  // a pasta raiz perdida. 1 MHz grava ~110 KB/s, e o áudio usa 16 KB/s.
  bool montou = SD.begin(CARTAO_CS, spiCartao, 1000000);
#else
  bool montou = LittleFS.begin(true);  // true: formata se não houver nada (a primeira vez)
#endif
  const char *falha = nullptr;
  if (!montou)
    falha = USAR_CARTAO ? "ERRO: o cartão não respondeu. Confira se ele está encaixado e os fios (firmware/cartao testa um a um)."
                        : "ERRO: a memória interna não montou (a placa foi gravada com o partitions.csv do sketch?).";
  else if (!cartaoResponde())
    falha = USAR_CARTAO ? "ERRO: o cartão monta, mas não lê nem grava (travado ou com defeito). Desligue e ligue a USB; se repetir, troque o cartão."
                        : "ERRO: a memória interna monta, mas não grava (cheia?). Desligue e ligue a USB.";
  if (falha) {
    memoria.end();
    // Tenta de novo sozinho (tarefa de rede): avisa só na primeira vez.
    if (!avisou) registrar("%s", falha);
    avisou = true;
    return false;
  }
  avisou = false;
  guardarBrutoAntigo();
  apagarTemporarios();
  int fila = contarComo(PASTA_FILA, ".wav"), recusadas = contarComo(PASTA_ERRO, ".wav");
  if (contarComo(PASTA_FILA, ".raw") > 0) haPendentes = true;
  if (fila < 0 || recusadas < 0) {
    memoria.end();
    if (!avisou) registrar("ERRO: o cartão monta, mas a fila não abre. Desligue e ligue a USB; se repetir, troque o cartão.");
    avisou = true;
    return false;
  }
  naFila = fila;
  char extra[64] = "";
  if (recusadas) snprintf(extra, sizeof(extra), " | %d recusada(s) guardada(s) em %s", recusadas, PASTA_ERRO);
  cartaoLivreGb = (memoria.totalBytes() - memoria.usedBytes()) / 1e9;
  abrirRegistro();
  cartaoOk = true;
  registrar(USAR_CARTAO ? "Cartão montado: %.1f GB livres | %d na fila%s%s" : "Memória interna montada: %.1f MB livres | %d na fila%s%s",
            USAR_CARTAO ? cartaoLivreGb : cartaoLivreGb * 1000, naFila, extra, haPendentes ? " | gravação para recuperar" : "");
  return true;
}

// Uma gravação guardada como .raw vira .wav: ela já é o .wav, só falta o
// tamanho no cabeçalho (a gravação parou antes de acertá-lo). Uma por vez, em
// segundo plano.
void recuperarPendente() {
  File p = memoria.open(PASTA_FILA);
  if (!p) return cartaoFalhou("ler a fila");
  String raw;
  for (File f = p.openNextFile(); f; f = p.openNextFile())
    if (String(f.name()).endsWith(".raw")) {
      raw = String(PASTA_FILA) + "/" + f.name();
      break;
    }
  p.close();
  if (raw.isEmpty()) {
    haPendentes = false;
    return;
  }
  File b = memoria.open(raw, "r+");
  if (!b) return cartaoFalhou("abrir uma gravação para recuperar");
  char riff[4] = {0};
  bool temCabecalho = b.read((uint8_t *)riff, 4) == 4 && !memcmp(riff, "RIFF", 4);
  size_t n = b.size() > CABECALHO_WAV ? (b.size() - CABECALHO_WAV) / sizeof(int16_t) : 0;
  if (!temCabecalho) {
    // Bruto sem cabeçalho, do firmware de antes dos 16 kHz: não vira .wav
    // aqui. Fica guardado fora da fila.
    b.close();
    String para = String(PASTA_ERRO) + raw.substring(raw.lastIndexOf('/'));
    if (!memoria.rename(raw, para)) return cartaoFalhou("guardar uma gravação antiga");
    registrar("AVISO: gravação interrompida de um firmware antigo guardada em %s (não sobe sozinha).", para.c_str());
    return;
  }
  if (n < TAXA / 2) {
    b.close();
    memoria.remove(raw);
    registrar("Gravação interrompida com menos de 0,5 s: descartada.");
    return;
  }
  bool ok = fecharWav(b, n);
  b.close();
  if (!ok) return cartaoFalhou("recuperar uma gravação");
  String nome = raw.substring(0, raw.length() - 4) + ".wav";
  if (!memoria.rename(raw, nome)) return cartaoFalhou("dar nome a uma gravação recuperada");
  naFila = naFila + 1;
  registrar("Gravação recuperada: %.1f s -> %s", (float)n / TAXA, nome.c_str());
}

// Quantos arquivos com essa terminação há na pasta; -1 se ela não abriu (cartão
// com problema — não é o mesmo que fila vazia).
int contarComo(const char *pasta, const char *terminacao) {
  File p = memoria.open(pasta);
  if (!p) return -1;
  int n = 0;
  for (File f = p.openNextFile(); f; f = p.openNextFile())
    if (!f.isDirectory() && String(f.name()).endsWith(terminacao)) n++;
  p.close();
  return n;
}

// .wav prontos (.tmp ainda está sendo escrito; .raw espera recuperação). Pasta
// que não abre é falha do cartão.
int contar(const char *pasta) {
  int n = contarComo(pasta, ".wav");
  if (n < 0) cartaoFalhou("ler a fila");
  return n;
}

int contarFila() { return contar(PASTA_FILA); }

// Fila que não abriu fica com o último número conhecido (cartaoFalhou já avisou).
void atualizarFila() {
  if (!cartaoOk) return;
  int n = contarFila();
  if (n >= 0) naFila = n;
}

void apagarTemporarios() {
  std::vector<String> lixo;  // apagar durante a listagem atrapalha a listagem
  File p = memoria.open(PASTA_FILA);
  if (!p) return;
  for (File f = p.openNextFile(); f; f = p.openNextFile())
    if (String(f.name()).endsWith(".tmp")) lixo.push_back(String(PASTA_FILA) + "/" + f.name());
  p.close();
  for (const String &c : lixo) memoria.remove(c);
}

// A mais antiga: os nomes começam pela hora. As sem hora ("b...") vêm antes.
String proximaDaFila() {
  File p = memoria.open(PASTA_FILA);
  String menor;
  if (!p) {
    cartaoFalhou("ler a fila");
    return menor;
  }
  for (File f = p.openNextFile(); f; f = p.openNextFile()) {
    String nome = f.name();
    if (f.isDirectory() || !nome.endsWith(".wav")) continue;
    if (menor.isEmpty() || nome < menor) menor = nome;
  }
  p.close();
  return menor.isEmpty() ? menor : String(PASTA_FILA) + "/" + menor;
}

// Tira da fila sem apagar: dá para recuperar o áudio tirando o cartão.
bool moverParaErro(const String &caminho) {
  String para = String(PASTA_ERRO) + caminho.substring(caminho.lastIndexOf('/'));
  memoria.remove(para);
  if (memoria.rename(caminho, para)) return true;
  cartaoFalhou("tirar da fila um áudio recusado");
  return false;
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
  File p = memoria.open(PASTA_FILA);
  if (!p) return cartaoFalhou("ler a fila");
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
    if (memoria.rename(de, para)) registrar("  %s gravada em %s\n", de.c_str(), isoDe(ms).c_str());
  }
}
