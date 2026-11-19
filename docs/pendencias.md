# Pendências técnicas críticas

> Registro das pendências técnicas que punham em risco a segurança, os dados
> ou o uso em campo: o que era, como foi corrigido e a prova (commit e teste).
> No fim, o que segue aberto e por que não é crítico. Revisado em 19/11/2026,
> com os 410 testes passando.

## 1. Critério

Crítica é a pendência que, em produção, deixaria alguém ver ou mudar dado de
outra empresa ou tomar uma conta, perderia gravação ou dado já conferido, ou
impediria o uso do sistema ou do gravador. O resto (melhoria, conforto, texto)
fica no backlog.

Toda correção segue o mesmo caminho: um teste que reproduz o problema e falha,
a correção, o teste passando e o commit com o motivo. O CI barra o push se
algum teste quebrar.

## 2. Corrigidas

| # | Data | Pendência | Correção | Prova |
| --- | --- | --- | --- | --- |
| P1 | 14/09/2026 | **Login em laço.** Com cookie de sessão vencido, `/dashboard` mandava para `/login` e `/login` devolvia para `/dashboard`: o navegador parava em "muitos redirecionamentos" e ninguém entrava | o proxy só barra quem não tem cookie; quem decide se a sessão vale é a api, na própria página de login | `41b4be3` |
| P2 | 18/10/2026 | **Tomada de conta entre fazendas.** Bastava o e-mail: o administrador de uma fazenda vinculava o dono de outra, trocava a senha dele e entrava na fazenda dele. E qualquer pessoa logada criava uma organização e virava administradora | senha e e-mail são da conta, não do vínculo: o administrador só troca os de quem está apenas na empresa dele e não é o dono (senão 403, e nada é gravado); senha trocada pelo administrador encerra as sessões da pessoa | `96a6758`; hoje em `apps/api/test/conta/usuarios.test.ts` |
| P3 | 11/11/2026 | **Escalada para super usuário.** Um super usuário vinculado a uma empresa tinha a senha trocável pelo administrador dela; quem entrasse como ele ganharia todas as empresas | só o próprio super usuário troca a senha e o e-mail dele | `8c49a50`; `apps/api/test/conta/usuarios.test.ts` (falhava antes da correção) |
| P4 | 11/11/2026 | **Envio do gravador travado.** Na rede de testes, o envio parava no primeiro pacote cheio (~1500 bytes) | envio em pedaços de 512 bytes; tudo o que a placa faz vai para `/registro.txt` no cartão, para diagnosticar em campo | `53227b8` |
| P5 | 11/11/2026 | **Gravação perdida com cartão com falha.** O cartão frouxo travava e o firmware seguia como se estivesse tudo certo | montar o cartão testa gravação e leitura; qualquer falha do cartão faz a placa parar de mexer nele e avisar uma vez; nenhuma gravação se perde | `947a00b`; `packages/shared/src/conta/gravadores.test.ts` |
| P6 | 15/11/2026 | **Senha de conta gravada na placa.** Cada gravador levava e-mail e senha de uma conta no `segredos.h` | a placa sorteia um segredo na primeira vez que liga e o servidor guarda só o hash; o super usuário aprova a placa com o código que ela mostra; ela só manda áudio para a empresa em que foi aprovada | `295851b`; `apps/api/test/conta/gravadores.test.ts` |
| P7 | 16/11/2026 | **Nenhuma cópia do banco testada.** A única recuperação era a do plano do Neon | rotina diária copia o banco para o Cloudflare R2, criptografado, e restaura a cópia num Postgres descartável para conferir; se algo falhar, avisa por e-mail | `d6a61dc`; `.github/workflows/rotina-diaria.yml` |
| P8 | 16/11/2026 | **Falha sem aviso.** Erro não tratado na api ou falha da IA numa nota só apareciam no log | alerta por e-mail (Resend), com limite de 15 min entre avisos; `/health` confere o banco | `5b16383`, `fa0e817`, `5911a8f`; testes em `apps/api/test/base/` e `apps/api/test/notas/alerta.test.ts` |
| P9 | 16/11/2026 | **Áudio guardado sem prazo** (LGPD) | a rotina diária apaga o áudio das notas revisadas há mais de 90 dias; a transcrição fica | `3ef6ead`; `apps/api/test/notas/limpeza-audio.test.ts` |
| P10 | 16/11/2026 | **V1: dependências com alertas críticos e altos** (`next`, `better-auth`, `hono`, `zod`) | versões corrigidas; `npm audit` sem alerta alto ou crítico (repetido em 19/11/2026) | `c8130f1` |
| P11 | 16/11/2026 | **V2: cabeçalhos de segurança ausentes no web** (a tela podia ser embutida em outro site) | CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy` em toda resposta; conferidos em produção em 19/11/2026 | `cca74da`; `apps/web/next.config.test.ts` |
| P12 | 16/11/2026 | **V3: áudio servido com o tipo informado por quem enviou** (um "áudio" `text/html` abriria como página) | o upload só aceita `audio/*`; a resposta só sai com tipo de áudio, `nosniff` e `sandbox` | `bce4628`; `apps/api/test/notas/audio.test.ts` |
| P13 | 16/11/2026 | **V4: limite de tentativas de login em memória**, burlável entre instâncias da Vercel | dez senhas erradas em 15 min travam o e-mail; o contador fica no banco | `e0fb021`; `apps/api/test/conta/tentativas-login.test.ts` |
| P14 | 18/11/2026 | **Fila do gravador travada em Wi-Fi fraco.** A gravação de 2 min (~3,8 MB) não terminava de subir, era tentada sem parar e segurava as seguintes | áudio em μ-law (metade do tamanho), convertido na api; gravação que falha 3 vezes seguidas sai da frente por 15 min | `86c063e`; `apps/api/test/notas/wav.test.ts` |
| P15 | 18/11/2026 | **Corrigir o firmware exigia ir até cada placa com um cabo USB** | atualização pelo ar, assinada (ECDSA P-256), com volta automática para a versão anterior se a nova falhar | `4484dd7`; `apps/api/test/conta/firmware.test.ts` |

Os achados V1 a V4 vêm da verificação de vulnerabilidades em
[seguranca.md](seguranca.md), seção 5.

## 3. Abertas, e por que não são críticas

| # | Pendência | Por que não é crítica | Próximo passo |
| --- | --- | --- | --- |
| V5 | conferir se o segredo de sessão da Vercel é diferente do que esteve no histórico do git | o valor do histórico não é o usado nos `.env` locais, e o repositório é privado | conferir na Vercel; se for igual, gerar outro (todos entram de novo) |
| V6 | sem MFA (a recuperação de senha por e-mail entrou em 19/11/2026) | a trava de login limita as tentativas, e quem esquece a senha recebe um link por e-mail | MFA para administradores |
| V8 | isolamento entre empresas só na aplicação, sem Row-Level Security | toda rota filtra pela empresa e tem teste de "outra organização não vê" | avaliar RLS |
| — | a CSP ainda permite script inline | o Next precisa dele para hidratar a página; os outros cabeçalhos estão ativos | trocar por *nonce* |
| — | 5 alertas moderados no `npm audit` | só em ferramenta de desenvolvimento (`esbuild` dentro do `drizzle-kit`) e em recurso não usado (`serveStatic` do `@hono/node-server`) | atualizar quando sair versão compatível |
| — | migração de banco não roda no deploy | o passo está documentado em [infraestrutura.md](infraestrutura.md), seção 2 | rodar a migração no CI antes do deploy |
| — | placa própria do gravador (ESP32-S3) ainda em projeto | o protótipo com ESP32 DevKit funciona em campo | fechar o projeto em `firmware/placa/` |

As pendências jurídicas da LGPD (texto final dos termos, contrato com a
cliente, encarregado) não são técnicas e estão em [lgpd.md](lgpd.md),
seção 6.
