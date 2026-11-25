# Documentação técnica do Noteless

Índice da documentação e mapa das evidências técnicas para a banca.

## Documentos

| Documento | Conteúdo |
| --- | --- |
| [arquitetura.md](arquitetura.md) | visão geral, monorepo, camadas, os sete módulos, fluxo do áudio à nota, gravador, decisões técnicas |
| [modelo-de-dados.md](modelo-de-dados.md) | justificativa do banco, DER, chaves, índices, relacionamentos e o que acontece ao apagar |
| [seguranca.md](seguranca.md) | autenticação, autorização, proteção de dados, verificação de vulnerabilidades e achados |
| [lgpd.md](lgpd.md) | inventário de dados pessoais, bases legais, suboperadores, direitos do titular, pendências |
| [ia.md](ia.md) | IA no produto (transcrição, interpretação, avaliação) e no desenvolvimento, com justificativa de valor |
| [infraestrutura.md](infraestrutura.md) | serviços, deploy, ambientes, variáveis, dependências e versões, ambiente de demonstração |
| [pendencias.md](pendencias.md) | pendências técnicas críticas: o que era, como foi corrigido, a prova, e o que segue aberto |
| [../README.md](../README.md) | instalação, configuração e execução |
| [../firmware/README.md](../firmware/README.md) | gravador de campo: montagem, gravação do firmware, funcionamento |
| [superpowers/specs/](superpowers/specs/) e [superpowers/plans/](superpowers/plans/) | especificação e plano de cada funcionalidade grande |

## Atualização

Revisada em 19/11/2026 contra o commit `4484dd7` da `main`. Entrou nesta
revisão o que chegou ao código depois da primeira versão (16/11): mãe e pai
dos animais (migração 0017), pausa de envio e atualização do firmware pelo ar
(0018 e 0019), aceite dos termos e áudio apagado em 90 dias (0016), cópia
diária do banco e alertas por e-mail, áudio do gravador em μ-law, as variáveis
de ambiente novas, os números de testes (410) e de commits (157), o endereço
de produção (https://app.noteless.com.br) e os commits das correções de
segurança, que estavam citados com o código errado.

## Mapa das evidências (checklist da banca)

| Item | Onde está |
| --- | --- |
| Arquitetura do software documentada | [arquitetura.md](arquitetura.md) |
| Pendências técnicas críticas corrigidas | [pendencias.md](pendencias.md) |
| Modelo de dados estruturado e documentado (DER) | [modelo-de-dados.md §3](modelo-de-dados.md#3-diagrama-entidade-relacionamento) |
| Escolha do banco de dados justificada | [modelo-de-dados.md §1](modelo-de-dados.md#1-escolha-do-banco-de-dados) |
| Chaves, índices e relacionamentos | [modelo-de-dados.md §4](modelo-de-dados.md#4-chaves-índices-e-relacionamentos); SQL em `apps/api/drizzle/` |
| Autenticação, autorização e proteção de dados avaliadas | [seguranca.md §2–4](seguranca.md) |
| Verificação de vulnerabilidades básicas | [seguranca.md §5](seguranca.md#5-verificação-de-vulnerabilidades-básicas) |
| Tratamento de dados pessoais alinhado à LGPD | [lgpd.md](lgpd.md) |
| Uso de IA documentado, com justificativa de valor | [ia.md](ia.md) |
| Documentação técnica atualizada | esta pasta |
| Arquitetura, módulos e decisões técnicas | [arquitetura.md §4 e §8](arquitetura.md) |
| README com instalação, configuração e execução | [../README.md](../README.md) |
| Histórico de commits demonstrando a evolução | `git log` (157 commits até 18/11/2026); resumo abaixo |
| Infraestrutura documentada | [infraestrutura.md §1–3](infraestrutura.md) |
| Dependências, versões e configuração de ambiente | [infraestrutura.md §4–5](infraestrutura.md#4-variáveis-de-ambiente) |
| Ambiente de demonstração acessível | https://app.noteless.com.br (também https://vocare-iota.vercel.app) — [infraestrutura.md §6](infraestrutura.md#6-ambiente-de-demonstração-para-a-banca) |
| Testes automatizados | 410 testes (`npm test`, 19/11/2026); CI em `.github/workflows/ci.yml` |
| Regras de negócio além de CRUD | conferência de notas pela IA, aplicação em transação, aviário (alojamento, transferência, indicadores), pareamento do gravador — [arquitetura.md §5–6](arquitetura.md) |
| Repositório organizado e atualizado | seção [Repositório](#repositório), abaixo |
| Evidências técnicas e documentais disponíveis | esta página e os documentos acima |

## Repositório

Código, documentação, firmware e histórico ficam num só repositório Git, no
GitHub: https://github.com/Arthur-dezingrini/noteless. O repositório é
privado; para a banca consultar, é preciso dar acesso de leitura
(Settings › Collaborators).

| Pasta | O que tem |
| --- | --- |
| `apps/web` | interface (Next.js), por módulo em `src/modulos/<módulo>/`; `app/` só com páginas finas |
| `apps/api` | regra de negócio (Hono), por módulo em `src/modulos/<módulo>/`; tabelas em `src/db/tabelas/`; migrações SQL em `drizzle/` (0000 a 0019); testes de rota em `test/<módulo>/` |
| `packages/shared` | o contrato entre web e api (schemas Zod), por módulo |
| `firmware/` | gravador de campo (ESP32) e projeto da placa |
| `docs/` | esta documentação e, em `superpowers/`, a especificação e o plano de cada funcionalidade grande |
| `.github/workflows/` | `ci.yml` (lint, tipos, testes e build a cada push e PR) e `rotina-diaria.yml` (cópia do banco, teste de restauração, limpeza do áudio) |

Como ele se mantém organizado:

- **CI em todo push e PR**: lint, tipos, os 410 testes e o build.
- **Funcionalidade nova vem com teste no mesmo commit**, cobrindo o caminho
  feliz e quem não pode (outro papel, outra empresa); correção de bug vem com
  o teste que falhava antes.
- **Fronteiras checadas por teste**: `apps/api/test/estrutura.test.ts` e
  `apps/web/src/modulos/estrutura.test.ts` barram import entre módulos fora
  do `index.ts` e ciclos.
- **Assunto do commit diz a área e o que mudou** (`gravador: …`,
  `animais: …`, `docs: …`), em português.
- **Nenhum segredo no git**: `.env` e `segredos.h` são ignorados; só os
  `.example`, sem valores (ver V5 em [seguranca.md](seguranca.md)).
- **Regras para quem programa**, inclusive assistentes de IA, em
  [CLAUDE.md](../CLAUDE.md); instalação e comandos no [README](../README.md).

## Evolução do projeto

Resumo do histórico do repositório (`git log --reverse`).

| Período | Marco |
| --- | --- |
| 09/09/2026 | primeiro commit |
| 14–16/09 | login com Better Auth; separação em monorepo (web, api, shared); banco no Neon com driver WebSocket; homologação por `APP_ENV`; usuários da organização; cadastro de animais; agenda de consultas; multiempresa sem cadastro público |
| 17–18/09 | **registro por áudio**: transcrição + IA + conferência; Groq como provedor grátis |
| 27/09 | primeiro teste da placa ESP32 |
| 28/09 | redesenho da interface em 8 etapas e telas do protótipo (ficha do animal, grupos, relatórios, prontuários); **testes** com Vitest e PGlite; **CI** no GitHub Actions; regra "toda funcionalidade vem com teste" |
| 29–30/09 | deploy na Vercel em dois projetos (api e web) |
| 18/10 | correção de segurança: administrador não toma a conta de quem é de outra fazenda |
| 09–10/11 | marca Noteless; "Ocorrências" vira "Notas"; kit de componentes; **módulo aviário** (galpões, lotes, apontamento por voz); nota com a hora da gravação; tela ao vivo; **firmware do gravador**; **modularização** por domínio com teste de estrutura; menu por módulo |
| 11/11 | avaliação da IA com conjunto de casos; **super usuário** e vínculos; gravadores avisam o estado; cartão com falha detectado sem perder gravação |
| 15/11 | gravador sem conta, aprovado pelo código; transcrição com o vocabulário da empresa (38 de 41 casos certos); IA corrige palavras mal ouvidas; parto cadastra as crias |
| 16/11 | **cópia diária do banco** no Cloudflare R2 com teste de restauração; **alerta por e-mail**; aceite dos termos e áudio apagado 90 dias depois da revisão (LGPD); esta documentação técnica; correção dos achados de segurança V1 a V4 (dependências, cabeçalhos HTTP, tipo do áudio, trava de login no banco); mãe, pai e filhos na ficha do animal; o gravador volta a gravar no cartão, com Wi-Fi desligável e envio pausável |
| 18/11 | gravador: áudio em μ-law (metade do tamanho) e fila que não trava numa gravação; **atualização do firmware pelo ar (OTA)**, assinada e com volta automática |
| 19/11 | documentação revisada contra o código |
| 24/11 | gravador: envio que travava por falta de memória e gravação longa recusada com 503 (áudio enviado cru; firmware publicado também) |

Comandos úteis para a banca conferir:

```bash
git log --oneline --reverse          # evolução, commit a commit
git log --format='%ad' --date=format:'%Y-%m' | sort | uniq -c   # commits por mês
npm test                             # 410 testes
```
