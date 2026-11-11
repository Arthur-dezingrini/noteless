// Registro (log): tudo o que a placa faz vai para o monitor serial e para
// /registro.txt no cartão, com data e hora — para ver depois, sem USB, o que
// deu certo e o que falhou. Passando de 1 MB, o atual vira
// /registro-antigo.txt (e o antigo de antes é apagado): no máximo 2 MB.
//
// Linha: "2026-11-10 08:49:01 (boot 46, 12.3 s) mensagem". Antes de o relógio
// acertar pela internet, a data vem em branco; boot e tempo ligado sempre vêm.
//
// No monitor serial: "log" mostra o fim do registro do cartão, "log tudo" o
// registro inteiro (1 MB leva ~90 s), "apagar log" começa do zero e "cartao"
// lista as pastas e testa se o cartão aceita gravar.
//
// O loop e a tarefa de rede registram ao mesmo tempo: uma trava impede linhas
// misturadas. O arquivo fica aberto (abrir e fechar a cada linha picota a
// memória, e a conexão segura precisa de blocos grandes); montarCartao() fecha
// antes de desmontar e abre de novo depois.

const char *ARQUIVO_REGISTRO = "/registro.txt";
const char *ARQUIVO_REGISTRO_ANTIGO = "/registro-antigo.txt";
const size_t REGISTRO_MAX = 1024 * 1024;
const size_t REGISTRO_FIM = 16 * 1024;  // o que "log" mostra
const long FUSO_SEG = -3 * 3600;        // Brasília (sem horário de verão desde 2019)

SemaphoreHandle_t travaRegistro = nullptr;
File arqRegistro;

void iniciarRegistro() { travaRegistro = xSemaphoreCreateMutex(); }

void abrirRegistro() {
  xSemaphoreTake(travaRegistro, portMAX_DELAY);
  if (!arqRegistro) arqRegistro = SD.open(ARQUIVO_REGISTRO, FILE_APPEND);
  xSemaphoreGive(travaRegistro);
}

void fecharRegistro() {
  xSemaphoreTake(travaRegistro, portMAX_DELAY);
  if (arqRegistro) arqRegistro.close();
  xSemaphoreGive(travaRegistro);
}

void carimbo(char *c, size_t tam) {
  char data[20] = "---------- --:--:--";
  if (relogioValido()) {
    time_t s = time(nullptr) + FUSO_SEG;
    tm t;
    gmtime_r(&s, &t);
    strftime(data, sizeof(data), "%Y-%m-%d %H:%M:%S", &t);
  }
  snprintf(c, tam, "%s (boot %lu, %.1f s)", data, (unsigned long)bootId, millis() / 1000.0f);
}

// Com a trava pega.
void girarRegistro() {
  arqRegistro.close();
  SD.remove(ARQUIVO_REGISTRO_ANTIGO);
  SD.rename(ARQUIVO_REGISTRO, ARQUIVO_REGISTRO_ANTIGO);
  arqRegistro = SD.open(ARQUIVO_REGISTRO, FILE_APPEND);
}

// Como printf, sem precisar do \n no fim.
void registrar(const char *formato, ...) {
  char msg[400], c[48];
  va_list args;
  va_start(args, formato);
  vsnprintf(msg, sizeof(msg), formato, args);
  va_end(args);
  size_t n = strlen(msg);
  while (n && (msg[n - 1] == '\n' || msg[n - 1] == '\r')) msg[--n] = 0;
  carimbo(c, sizeof(c));

  if (!travaRegistro) {  // antes de iniciarRegistro()
    Serial.printf("%s %s\n", c, msg);
    return;
  }
  xSemaphoreTake(travaRegistro, portMAX_DELAY);
  Serial.printf("%s %s\n", c, msg);
  if (arqRegistro) {
    if (arqRegistro.size() > REGISTRO_MAX) girarRegistro();
    if (arqRegistro && arqRegistro.printf("%s %s\n", c, msg) > 0) arqRegistro.flush();
    else if (arqRegistro) arqRegistro.close();  // cartão falhou: volta quando ele montar de novo
  }
  xSemaphoreGive(travaRegistro);
}

// Por que a placa (re)ligou: queda de energia e travamento aparecem aqui.
const char *motivoDoBoot() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON: return "ligada na energia";
    case ESP_RST_EXT: return "botão EN";
    case ESP_RST_SW: return "reiniciada pelo firmware";
    case ESP_RST_PANIC: return "ERRO: travou (falha no firmware)";
    case ESP_RST_INT_WDT:
    case ESP_RST_TASK_WDT:
    case ESP_RST_WDT: return "ERRO: travou (watchdog)";
    case ESP_RST_BROWNOUT: return "ERRO: queda de tensão (fonte ou cabo fracos)";
    case ESP_RST_DEEPSLEEP: return "acordou do sono";
    default: return "motivo desconhecido";
  }
}

// Mostra o registro pelo monitor serial; sem tudo, só os últimos 16 KB.
void mostrarRegistro(bool tudo) {
  xSemaphoreTake(travaRegistro, portMAX_DELAY);
  if (arqRegistro) arqRegistro.close();  // ler com ele aberto para escrita não é seguro
  File f = SD.open(ARQUIVO_REGISTRO, FILE_READ);
  if (!f) {
    Serial.println("Sem registro no cartão (cartão fora ou nada registrado ainda).");
  } else {
    if (!tudo && f.size() > REGISTRO_FIM) {
      f.seek(f.size() - REGISTRO_FIM);
      while (f.available() && f.read() != '\n') {}  // começa numa linha inteira
    }
    Serial.printf("----- %s (%u bytes) -----\n", ARQUIVO_REGISTRO, (unsigned)f.size());
    static uint8_t bloco[512];
    for (int k; (k = f.read(bloco, sizeof(bloco))) > 0;) Serial.write(bloco, k);
    Serial.println("----- fim do registro -----");
    f.close();
  }
  if (cartaoOk) arqRegistro = SD.open(ARQUIVO_REGISTRO, FILE_APPEND);
  xSemaphoreGive(travaRegistro);
}

void apagarRegistro() {
  xSemaphoreTake(travaRegistro, portMAX_DELAY);
  if (arqRegistro) arqRegistro.close();
  SD.remove(ARQUIVO_REGISTRO);
  SD.remove(ARQUIVO_REGISTRO_ANTIGO);
  if (cartaoOk) arqRegistro = SD.open(ARQUIVO_REGISTRO, FILE_APPEND);
  xSemaphoreGive(travaRegistro);
  registrar("Registro apagado pelo monitor serial.");
}

void listarPasta(const char *pasta) {
  File p = SD.open(pasta);
  if (!p) {
    Serial.printf("  %s: não abriu (%s)\n", pasta, strerror(errno));
    return;
  }
  Serial.printf("  %s:\n", pasta);
  int n = 0;
  for (File f = p.openNextFile(); f; f = p.openNextFile(), n++)
    Serial.printf("    %-28s %s%u bytes\n", f.name(), f.isDirectory() ? "[pasta] " : "", (unsigned)f.size());
  if (!n) Serial.println("    (vazia)");
}

// Diagnóstico do cartão pela serial, para quando não dá para tirá-lo: o que
// tem nas pastas e se ele aceita gravar e ler.
void diagnosticarCartao() {
  Serial.printf("Cartão: %s | registro %s\n", cartaoOk ? "montado" : "NÃO montado",
                arqRegistro ? "aberto" : "FECHADO (não está gravando no cartão)");
  if (!cartaoOk) return;
  listarPasta("/");
  listarPasta(PASTA_FILA);
  listarPasta(PASTA_ERRO);
  const char *teste = "/teste-cartao.txt";
  File w = SD.open(teste, FILE_WRITE);
  int erroEscrita = w ? 0 : errno;
  size_t escrito = w ? w.print("noteless") : 0;
  if (w) w.close();
  File r = SD.open(teste, FILE_READ);
  String lido = r ? r.readString() : "";
  if (r) r.close();
  SD.remove(teste);
  Serial.printf("Teste de escrita: %s (escreveu %u bytes, leu \"%s\")%s%s\n", lido == "noteless" ? "OK" : "FALHOU",
                (unsigned)escrito, lido.c_str(), erroEscrita ? " - " : "", erroEscrita ? strerror(erroEscrita) : "");
}

// Comandos digitados no monitor serial, uma linha por vez.
void atenderSerial() {
  static String cmd;
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch != '\n' && ch != '\r') {
      if (cmd.length() < 32) cmd += ch;
      continue;
    }
    cmd.trim();
    if (cmd == "log") mostrarRegistro(false);
    else if (cmd == "log tudo") mostrarRegistro(true);
    else if (cmd == "apagar log") apagarRegistro();
    else if (cmd == "cartao") diagnosticarCartao();
    else if (cmd.length()) Serial.println("Comandos: log | log tudo | apagar log | cartao");
    cmd = "";
  }
}
