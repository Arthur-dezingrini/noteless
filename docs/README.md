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
| [../README.md](../README.md) | instalação, configuração e execução |
| [../firmware/README.md](../firmware/README.md) | gravador de campo: montagem, gravação do firmware, funcionamento |
| [superpowers/specs/](superpowers/specs/) e [superpowers/plans/](superpowers/plans/) | especificação e plano de cada funcionalidade grande |

## Mapa das evidências (checklist da banca)

| Item | Onde está |
| --- | --- |
| Arquitetura do software documentada | [arquitetura.md](arquitetura.md) |
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
| Histórico de commits demonstrando a evolução | `git log` (135 commits); resumo abaixo |
| Infraestrutura documentada | [infraestrutura.md §1–3](infraestrutura.md) |
| Dependências, versões e configuração de ambiente | [infraestrutura.md §4–5](infraestrutura.md#4-variáveis-de-ambiente) |
| Ambiente de demonstração acessível | https://vocare-iota.vercel.app — [infraestrutura.md §6](infraestrutura.md#6-ambiente-de-demonstração-para-a-banca) |
| Testes automatizados | 316 testes (`npm test`); CI em `.github/workflows/ci.yml` |
| Regras de negócio além de CRUD | conferência de notas pela IA, aplicação em transação, aviário (alojamento, transferência, indicadores), pareamento do gravador — [arquitetura.md §5–6](arquitetura.md) |

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
| 16/11 | esta documentação técnica |

Comandos úteis para a banca conferir:

```bash
git log --oneline --reverse          # evolução, commit a commit
git log --format='%ad' --date=format:'%Y-%m' | sort | uniq -c   # commits por mês
npm test                             # 316 testes
```
