// Copie para segredos.h (que não vai para o git) e preencha.

// Onde a api atende, sem barra no fim. Na Vercel, a URL do web (ele repassa
// /api/*); local, a api direto: "http://<IP do notebook>:4000".
#define SERVIDOR_URL "https://seu-front.vercel.app"

// Conta de quem "grava" as notas. Precisa ser membro de uma organização.
#define CONTA_EMAIL "gravador@exemplo.com"
#define CONTA_SENHA "senha"

// Empresa que recebe as notas até o Noteless responder a escolhida em
// Configurações › Gravadores. Nome como aparece no Noteless (ou o slug).
// Vazio: a mais antiga da conta.
#define CONTA_EMPRESA ""
