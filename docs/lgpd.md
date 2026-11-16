# Tratamento de dados pessoais (LGPD)

> Avaliação do Noteless frente à Lei nº 13.709/2018 (LGPD), em 16/11/2026.
> Este documento descreve o que o sistema trata e como. Não substitui a
> política de privacidade e os termos de uso, que são documentos jurídicos
> próprios (item "Modelo de contrato, termos de uso ou licença").

## 1. Papéis

| Quem | Papel na LGPD | Sobre quais dados |
| --- | --- | --- |
| **Empresa cliente** (fazenda, granja, clínica) | **controladora** | dados dos seus funcionários e dos tutores dos animais que ela cadastra; ela decide o que registrar |
| **Noteless** (a startup) | **operadora** dos dados acima; **controladora** dos dados de conta e de segurança (login, sessões, registros de acesso) | — |
| Vercel, Neon, Groq, Anthropic | **suboperadores** contratados pelo Noteless | ver seção 4 |

O produto trata principalmente dados **de animais** (peso, vacina, parto,
prontuário veterinário), que não são dados pessoais. Os dados pessoais
são os das pessoas que usam o sistema, dos tutores e a voz nas gravações.

## 2. Inventário de dados pessoais

| Dado | Titular | Onde fica | Para quê | Base legal (art. 7º) |
| --- | --- | --- | --- | --- |
| Nome, e-mail, cargo | usuário | `user` | identificar quem usa e quem fez cada registro | execução de contrato (V) |
| Foto de perfil (opcional) | usuário | `user.image` | aparecer no menu | consentimento (I): só se a pessoa enviar |
| Senha (hash scrypt) | usuário | `account` | autenticar | execução de contrato (V) |
| Endereço IP e navegador da sessão | usuário | `session` | segurança da conta | legítimo interesse (IX) e art. 15 do Marco Civil |
| E-mail digitado no login e número de senhas erradas | quem tenta entrar | `verification` | travar tentativa de adivinhar senha | legítimo interesse (IX) |
| Vínculo e papel na empresa | usuário | `member` | controle de acesso | execução de contrato (V) |
| Autoria dos registros (quem gravou, conferiu, salvou) | usuário | colunas `*_por_id` | rastreabilidade do que entrou no sistema | legítimo interesse (IX) |
| **Voz** (áudio da nota) | quem grava; eventualmente terceiros ao fundo | `ocorrencia_audio` | transcrever e permitir que quem confere ouça | execução de contrato (V) |
| Transcrição e resumo | idem (pode citar nomes) | `ocorrencia` | virar registro no sistema | execução de contrato (V) |
| Nome e telefone do tutor | tutor (cliente da clínica) | `animal.tutor`, `animal.tutor_telefone` | contato sobre o animal | execução de contrato com o tutor (V) ou legítimo interesse da clínica (IX) — definido pela controladora |
| Notificações | usuário | `notificacao` | avisar sobre notas | execução de contrato (V) |
| Série (MAC) do gravador, rede Wi-Fi e IP local | dispositivo da empresa | `gravador` | aprovar a placa e mostrar o estado dela | legítimo interesse (IX) |
| Registros de acesso (logs) | qualquer visitante | Vercel | operação e segurança | legítimo interesse (IX) |

**Dados sensíveis (art. 5º, II).** O sistema não pede nenhum. A voz não é
usada para identificar ninguém (não há reconhecimento de voz), por isso não é
tratada como dado biométrico. O prontuário é de animal, não de pessoa.

**Crianças e adolescentes.** O produto é para uso profissional; não há
tratamento direcionado a menores.

## 3. Princípios (art. 6º) aplicados

| Princípio | Como o sistema atende |
| --- | --- |
| Finalidade e adequação | cada dado tem uso declarado na tabela acima; nada é vendido nem usado para publicidade |
| Necessidade | cadastro de usuário pede só nome, e-mail, senha e papel; cargo e foto são opcionais; o tutor tem só nome e telefone |
| Livre acesso | cada pessoa vê e edita o próprio nome, e-mail e foto em Perfil; administradores veem a lista de usuários da própria empresa |
| Qualidade | dados editáveis a qualquer momento; a IA nunca grava nada sem um humano conferir |
| Transparência | **pendente**: política de privacidade e aviso no login (seção 6) |
| Segurança e prevenção | ver [seguranca.md](seguranca.md): HTTPS, scrypt, controle de acesso por empresa, testes de "quem não pode" |
| Não discriminação | nenhuma decisão automatizada sobre pessoas |
| Responsabilização | este documento, o de segurança e os testes servem de registro das medidas |

## 4. Compartilhamento e transferência internacional

| Suboperador | O que recebe | Onde processa | Observação |
| --- | --- | --- | --- |
| **Neon** (banco) | todos os dados do sistema | AWS `sa-east-1`, São Paulo | dados no Brasil |
| **Vercel** (hospedagem) | requisições em trânsito; logs de acesso | funções em `gru1`, São Paulo; empresa nos EUA | logs com IP |
| **Groq** (transcrição e interpretação) | o **áudio**, a transcrição e o cadastro da empresa (nomes de animais, grupos, galpões) | EUA | **transferência internacional** |
| **Anthropic** (opcional, interpretação) | a transcrição e o cadastro (não o áudio) | EUA | só se `ANTHROPIC_API_KEY` estiver configurada |
| GitHub | só código-fonte; nenhum dado de cliente | EUA | — |

A transferência para a Groq e a Anthropic se apoia no art. 33 da LGPD.
Providências: (a) aceitar os termos de tratamento de dados (DPA) desses
provedores e registrar as cláusulas aplicáveis, conforme a regulamentação da
ANPD sobre transferência internacional; (b) informar a transferência na
política de privacidade; (c) usar as opções dos provedores que **não retêm**
nem usam os dados para treinar modelos (a API da Anthropic não treina com
dados de clientes por padrão; conferir a política vigente da Groq).

## 5. Direitos do titular (art. 18)

| Direito | Como atender hoje | Lacuna |
| --- | --- | --- |
| Confirmação e acesso | Perfil (o próprio usuário); administrador da empresa ou super usuário consultam o resto | sem exportação automática |
| Correção | Perfil; administrador edita usuários e tutores | — |
| Anonimização, bloqueio ou eliminação | administrador tira o usuário da empresa; o super usuário pode apagar a conta pelo banco; registros feitos por ele ficam sem autor (`set null`) | **sem exclusão de conta pela tela**; **áudio não tem botão para apagar** |
| Portabilidade | exportação manual pelo banco (JSON/CSV) | sem exportação pela tela |
| Informação sobre compartilhamento | seção 4 deste documento | falta na política de privacidade |
| Revogação do consentimento | apagar a foto de perfil | — |

Canal: os pedidos chegam pela empresa cliente (controladora) ou pelo
encarregado do Noteless (seção 6), que tem até 15 dias para responder
(art. 19, II).

## 6. O que falta para ficar em conformidade

| # | Ação | Responsável | Prioridade |
| --- | --- | --- | --- |
| L1 | **Política de privacidade** e **termos de uso** publicados, com link na tela de login, citando os suboperadores e a transferência internacional | jurídico (Luiz) | alta |
| L2 | **Contrato com a empresa cliente** com cláusula de operador (art. 39): o Noteless trata só conforme as instruções da cliente | jurídico (Luiz) | alta |
| L3 | **Nomear o encarregado** (DPO) e publicar o contato | time | alta |
| L4 | **Prazo de retenção do áudio**: apagar o áudio de notas salvas ou descartadas depois de um prazo (sugestão: 90 dias), mantendo a transcrição | técnico | média |
| L5 | Exclusão da própria conta e exportação dos dados pela tela | técnico | média |
| L6 | Aceitar os DPAs da Groq, Vercel, Neon e Anthropic e guardar as cópias | time | média |
| L7 | Aviso no gravador/manual: "o áudio é enviado para transcrição automática" | produto | média |
| L8 | Plano de resposta a incidente: quem avalia, como comunicar a ANPD e os titulares no prazo do regulamento da ANPD (art. 48) | time | média |
| L9 | Itens de segurança ainda abertos em [seguranca.md](seguranca.md): V5 (conferir o segredo da Vercel) e V6 (recuperação de senha e MFA). V1 a V4 foram corrigidos em 16/11/2026 | técnico | média |

## 7. Retenção

| Dado | Hoje | Proposta |
| --- | --- | --- |
| Conta do usuário | enquanto existir; sair da empresa não apaga | apagar a pedido ou após o fim do contrato com a cliente |
| Sessões | expiram em 30 dias | — |
| Contador de senhas erradas | apagado ao entrar; vence 15 minutos depois do primeiro erro e é removido na próxima falha de login | — |
| Áudio das notas | indefinido | 90 dias após salvar/descartar (L4) |
| Transcrição, registros de animais | enquanto a empresa for cliente | idem; prontuário veterinário segue o prazo das normas do CFMV |
| Placas aguardando aprovação | 7 dias | — |
| Logs da Vercel | prazo do plano da Vercel | — |
| Dados da empresa ao encerrar o contrato | apagar a organização apaga tudo em cascata | exportar para a cliente e apagar |
