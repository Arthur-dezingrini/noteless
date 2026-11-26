# Estoque de insumos: produtos, locais, livro de movimentos, NF-e e voz

Data: 2026-11-26. É o módulo `estoque`, que estava "em breve" no menu.

## Objetivo

A granja de matrizes do piloto precisa de quatro coisas, todas pedidas pelo Arthur:

1. **Não deixar faltar.** Saldo atualizado e aviso antes de acabar a ração, a vacina ou o remédio ("ração do silo 2 acaba em 4 dias").
2. **Saber quanto custa.** Valor das compras e custo médio. Prepara o custo por lote e por ovo no Financeiro.
3. **Conferir o que some.** Toda entrada e saída registrada com quem fez, e inventário para comparar o sistema com o depósito.
4. **Rastrear lote e validade.** Qual lote de fabricação de vacina ou remédio foi aplicado em qual lote de aves, e aviso de vencimento.

Sucesso: a ração que entra no silo e sai no registro diário, e a vacina que entra na geladeira e sai na vacinação, aparecem no saldo sem lançamento duplicado. O dono vê o custo médio e quantos dias o silo aguenta.

### Contexto já decidido

- **Só insumos** (o que se compra): ração, vacina, medicamento, material, outro. Ovos e aves ficam fora; entram quando vierem incubatório e venda.
- **Saldo por local**: silo de cada galpão, depósito, geladeira, farmácia. Há transferência entre locais.
- **Entradas por três caminhos**: tela, voz (nota) e XML da NF-e.
- **Permissão**: por enquanto o `member` pode tudo, como o owner e o admin. Perfis de acesso virão depois, então a decisão fica numa função só (`podeNoEstoque`).
- **Leitor de XML**: o Arthur autorizou a dependência `fast-xml-parser`, só no `apps/api`.
- O registro diário do galpão já grava `racaoKg`. A vacinação de lote, a vacina de animal e o tratamento já existem e guardam o produto como texto livre.

### Fora do escopo

- Estoque de ovos e de aves.
- Perfis de acesso.
- Consulta da nota na SEFAZ e manifestação do destinatário, porque exigem certificado digital.
- Contas a pagar, pedido de compra e código de barras.
- Relatório de custo por lote de aves. O custo fica gravado em cada saída, mas o relatório é do Financeiro.

## Abordagem

**Livro de movimentos com tabela de saldo.**
- Toda mudança vira uma linha imutável em `movimento_estoque`, com origem, quem fez e quando.
- `saldo_estoque` (produto × local × lote) é atualizado na mesma transação.
- Corrigir é estornar, nunca editar nem apagar.

Duas alternativas foram descartadas:
- saldo editável com histórico à parte, porque o histórico pode divergir do saldo e o custo e o rastreio ficam frágeis;
- só o livro, somado a cada consulta, porque pesa com o tempo e complica o "dura X dias" e os avisos.

## Modelo de dados

Arquivo novo `apps/api/src/db/tabelas/estoque.ts`, no padrão de `aviario.ts`:
- `base()` com `id` uuid, `organizationId` (cascade), `criadoPorId` (set null) e `createdAt`;
- `ocorrenciaId` (set null) onde o registro pode vir de uma nota.

Quantidades são `numeric(14,3)` e custos `numeric(14,4)`. As tabelas entram numa migration em `apps/api/drizzle/`.

| Tabela | Campos | Regras |
|---|---|---|
| `produto` | `nome`, `categoria` (`racao`, `vacina`, `medicamento`, `material`, `outro`), `unidade` (`kg`, `l`, `ml`, `dose`, `un`), `embalagemNome?` ("saco"), `embalagemFator?` (25), `estoqueMinimo?`, `controlaLote` (bool), `custoMedio` (default 0), `ativo`, `updatedAt` | `nome` único por organização. `controlaLote` vem ligado por padrão para vacina e medicamento. |
| `local_estoque` | `nome`, `tipo` (`silo`, `deposito`, `geladeira`, `farmacia`, `outro`), `instalacaoId?` (set null), `ativo` | `nome` único por organização. No máximo um silo **ativo** por galpão. |
| `fornecedor` | `nome`, `documento?` (CNPJ/CPF, só dígitos), `telefone?` | `documento` único por organização, quando houver. |
| `produto_fornecedor` | `fornecedorId`, `codigo` (o `cProd` da NF-e), `unidadeCompra`, `fator`, `produtoId`, `localId?` | Único por (fornecedor, código). É gravado ao confirmar uma NF-e, para a próxima nota já vir ligada. |
| `entrada` | `fornecedorId?`, `numeroNota?`, `serie?`, `chaveNfe?`, `dataEmissao?`, `data`, `valorTotal?`, `origem` (`tela`, `voz`, `nfe`), `xml?`, `estornadaEm?` | `chaveNfe` é única por organização, para a mesma nota não entrar duas vezes. |
| `movimento_estoque` | `produtoId`, `localId`, `loteFabricacao` ('' quando o produto não controla lote), `validade?`, `tipo` (`entrada`, `saida`, `transferencia`, `ajuste`, `estorno`), `quantidade` (**com sinal**: + entra, − sai), `custoUnitario`, `data`, `origemTipo`, `origemId?`, `grupoId?`, `estornaId?`, `motivo?` | Imutável: não há rota de edição nem de exclusão. Os dois lados de uma transferência compartilham o `grupoId`. Índices: (org, produto, data), (org, origemTipo, origemId) e (org, loteFabricacao). |
| `saldo_estoque` | `produtoId`, `localId`, `loteFabricacao`, `validade?`, `quantidade` | Único por (produto, local, lote). Atualizado só por `lancarMovimento`, com `on conflict do update set quantidade = quantidade + excluded.quantidade`. |
| `inventario` | `localId`, `status` (`aberto`, `fechado`, `cancelado`), `abertoEm`, `fechadoEm?`, `fechadoPorId?` | No máximo um aberto por local. |
| `inventario_item` | `inventarioId`, `produtoId`, `loteFabricacao`, `quantidadeContada`, `quantidadeSistema?` | `quantidadeSistema` é gravada ao fechar. |

`origemTipo` pode ser:
- `entrada`, `manual`, `transferencia` ou `inventario`;
- `apontamento_aviario`, `vacinacao_lote`, `vacina` ou `tratamento`;
- `ocorrencia`.

A origem é guardada como tipo + id em texto, **sem chave estrangeira**. Assim o estoque não depende dos outros módulos.

**Tabelas que já existem.** `vacinacao_lote`, `vacina` e `tratamento` ganham dois campos opcionais:
- `produtoId?` (set null);
- `quantidade?`.

O nome em texto continua obrigatório: o formulário e a IA o preenchem com o nome do produto. `apontamento_aviario` não muda.

## Regras (`apps/api/src/modulos/estoque/regras/`)

**Uma porta só.** Todo movimento passa por `lancarMovimento(tx, dados)`, exportada pelo `estoque/index.ts`. Ela grava o movimento, atualiza o saldo e, na entrada, o custo médio, tudo na transação de quem chamou. Nenhum outro código escreve em `movimento_estoque` ou `saldo_estoque`.

**Funções puras** (`packages/shared/src/estoque/`, com teste ao lado):
- **`novoCustoMedio(saldoTotal, custoAtual, qtd, custoCompra)`** = `(max(saldoTotal,0) × custoAtual + qtd × custoCompra) ÷ (max(saldoTotal,0) + qtd)`. O custo médio é por produto, somando todos os locais.
- **`repartirFefo(saldosPorLote, qtd)`** decide de quais lotes sai a quantidade:
  - vai primeiro no que vence antes; sem validade fica por último;
  - no empate, sai antes o lote que entrou primeiro;
  - a sobra que nenhum lote cobre fica no lote '' e deixa o saldo negativo.
- **`converterParaUnidade(qtd, fator)`** e **`diasRestantes(saldo, consumoUltimos7Dias)`**. O consumo é a soma das saídas por `apontamento_aviario` naquele local nos últimos 7 dias, dividida por 7. Sem consumo, o resultado é nulo.

**Entrada** (tela, voz ou NF-e):
- A quantidade da compra vezes o fator vira unidade de estoque.
- O custo unitário é o custo do item dividido pela quantidade em unidade de estoque.
- Produto com `controlaLote` exige lote e validade.

**Saída manual:**
- O lote sai por FEFO, a menos que seja informado na mão.
- Sai pelo `custoMedio` do momento.
- **Nada bloqueia por falta de saldo.** O saldo fica negativo e o aviso sai na hora. A tela pede confirmação antes de lançar uma saída acima do saldo.

**Transferência.**
- São dois movimentos com o mesmo `grupoId`, o mesmo lote e o mesmo custo, na mesma transação.
- O local de destino precisa ser diferente do de origem.

**Estorno:**
- O estorno é um movimento oposto, com `estornaId` apontando para o original.
- Não se estorna duas vezes nem se estorna um estorno (409).
- Estornar uma entrada estorna todos os movimentos dela, grava `estornadaEm` e recalcula o `custoMedio` do produto relendo as entradas do livro em ordem.
- Os dois lados de uma transferência são estornados juntos.

**Inventário.**
- Abrir: cria a contagem de um local. Um local não pode ter dois inventários abertos.
- Contar: grava os itens.
- Fechar:
  - para cada item, lê o saldo daquela hora e grava em `quantidadeSistema`;
  - a diferença (contado − sistema) vira um movimento `ajuste` com motivo "inventário";
  - produto que tinha saldo no local e não foi contado não é ajustado.
- Fechar sem itens dá 400.

**Cadastros:** produto e local com movimento não se apagam, só se desativam. Produto ou local inativo não recebe movimento novo.

**Permissão:** toda rota do estoque chama `podeNoEstoque(papel, acao)`, com as ações `lancar`, `verCusto`, `acertarInventario` e `cadastrar`. Hoje ela libera tudo para owner, admin e member.

### Baixas automáticas (chamadas pelos outros módulos)

São feitas dentro da transação da regra de cada módulo, chamando `baixarPorOrigem(tx, {origemTipo, origemId, ...})` e `estornarPorOrigem(tx, origemTipo, origemId)`, ambas do `estoque/index.ts`.

| Origem | Quando | O que sai |
|---|---|---|
| Registro diário (`apontamento_aviario`) com `racaoKg` > 0 | Criar | `racaoKg` do silo ativo ligado ao galpão. Sai a ração com saldo nesse silo, por FEFO e depois pela entrada mais antiga. Se não houver saldo, sai a última ração que entrou no silo e o saldo fica negativo. Galpão sem silo não baixa e gera o aviso "galpão X sem silo ligado". |
| Registro diário | Editar | Se o `racaoKg` ou o galpão mudou, estorna o movimento antigo e lança o novo. |
| Registro diário | Apagar | Estorna. |
| `vacinacao_lote` com `produtoId` | Criar ou apagar | `quantidade`, que por padrão é o número de **aves vivas** do lote no dia (indicador que já existe no `shared`). O local é o informado ou, se só um tiver saldo do produto, esse. O lote de fabricação é o informado ou sai por FEFO. |
| `vacina` (animal) com `produtoId` | Criar ou apagar | `quantidade`, ou 1 dose se nada for informado. |
| `tratamento` com `produtoId` | Criar ou apagar | `quantidade`, que é obrigatória quando há produto. |

Sem `produtoId`, tudo continua como hoje, sem baixa.

As dependências vão de `aviario`, `animais` e `saude` para `estoque/index.ts`. O `estoque` não importa de nenhum deles, e o `estrutura.test.ts` continua barrando ciclo.

## NF-e (`fast-xml-parser`)

1. **`POST /estoque/nfe/ler`** (upload do XML):
   - Aceita `nfeProc` ou `NFe`, nos modelos 55 e 65.
   - Lê do `infNFe`:
     - chave (o `Id` sem o prefixo "NFe"), `nNF`, `serie` e `dhEmi`;
     - o `emit` (CNPJ ou CPF, `xNome`, `fone`) e o `dest` (nome e documento, só para mostrar);
     - de cada `det`: `cProd`, `xProd`, `uCom`, `qCom`, `vProd`, `vFrete`, `vSeg`, `vOutro`, `vDesc`, o `vIPI` e o `vICMSST` do item, e o `rastro` (`nLote`, `dVal`);
     - o `vNF`.
   - Devolve uma **pré-entrada sem gravar nada**. Cada item vem com o custo calculado (`vProd + vFrete + vSeg + vOutro − vDesc + vIPI + vICMSST`). Se houver vínculo em `produto_fornecedor`, vem também a sugestão de produto, fator e local.
   - Recusa com 400 quando o XML é inválido ou não é NF-e, e com 409 quando a chave já foi importada.
2. **Tela de conferência.**
   - Cada item é ligado a um produto (ou cria um), com fator e local.
   - O lote e a validade vêm do `rastro` e podem ser corrigidos.
   - A tela mostra o destinatário da nota, para conferir.
3. **`POST /estoque/nfe/confirmar`**. Numa transação só:
   - cria o fornecedor, se for novo pelo documento;
   - grava a `entrada` com o XML e os movimentos;
   - grava ou atualiza o `produto_fornecedor`.

   A chave repetida também é recusada aqui (409), para cobrir duas confirmações ao mesmo tempo.

## Voz (extensão do fluxo de notas)

- **Duas operações novas** no `@vocare/shared` (`notas/ocorrencias.ts`), na ferramenta e nas instruções da IA (`notas/ia/`):
  - **`entrada_estoque`**: `produto`, `quantidade`, `unidade?`, `local?`, `fornecedor?`, `numeroNota?`, `valorTotal?`, `loteFabricacao?`, `validade?`, `data?`.
  - **`saida_estoque`**: `produto`, `quantidade`, `unidade?`, `local?`, `motivo?`, `data?`.
- **Reconhecimento dos nomes.** A IA recebe os produtos e os locais ativos da organização, como já recebe lotes e galpões. Na aprovação, os nomes são resolvidos sem diferenciar maiúsculas nem acentos. O que não for resolvido o usuário escolhe na tela de aprovação. Se a `unidade` for a embalagem do produto ("saco"), a quantidade é multiplicada pelo `embalagemFator`.
- **Operações que já existem.** `vacinar_lote`, `aplicar_vacina` e `registrar_remedio` passam a tentar resolver o produto pelo nome. Se resolverem, preenchem `produtoId` e a baixa automática acontece.

## API (`/api/org/:orgId/estoque/...`)

As rotas são montadas em `/api/org`, como as do aviário (`/:orgId/lotes`). Diferente delas, levam o prefixo `estoque/`, para "locais" e "entradas" não colidirem com rotas de outros módulos.

| Recurso | Rotas |
|---|---|
| Cadastros | `GET`/`POST` em `produtos`, `locais` e `fornecedores`; `PATCH .../:id` em cada um |
| Saldo | `GET saldo?categoria&localId`: por produto, total e por local, com `diasRestantes`, a validade mais próxima e o custo (se `verCusto`) |
| Livro | `GET movimentos?produtoId&localId&de&ate&origemTipo&loteFabricacao&criadoPorId`, paginado |
| Lançamentos | `POST movimentos/saida`, `POST movimentos/transferencia`, `POST movimentos/:id/estorno` |
| Entradas | `GET`/`POST entradas`, `GET entradas/:id`, `POST entradas/:id/estorno` |
| NF-e | `POST nfe/ler`, `POST nfe/confirmar` |
| Inventário | `GET`/`POST inventarios`, `GET inventarios/:id`, `PUT inventarios/:id/itens`, `POST inventarios/:id/fechar`, `POST inventarios/:id/cancelar` |

Os schemas de entrada e saída ficam em `packages/shared/src/estoque/`.

## Telas (web `src/modulos/estoque/`, com o kit `@/components/ui`)

O `menu.ts` deixa de ser `emBreve` e ganha estas telas:

- **Saldo** (`/estoque`):
  - por produto, com o total e a divisão por local;
  - "dura X dias" para a ração;
  - validade mais próxima;
  - saldo negativo e abaixo do mínimo em destaque;
  - filtro por categoria e por local.
- **Movimentos** (`/estoque/movimentos`):
  - o livro com os filtros da API;
  - a busca por lote de fabricação é o rastreio;
  - daqui se lança saída e transferência e se estorna.
- **Entradas** (`/estoque/entradas`): a lista, a nova entrada manual e **Importar NF-e** (upload e conferência).
- **Inventário** (`/estoque/inventario`): abrir, contar e fechar.
- **Produtos, Locais e Fornecedores** (`/estoque/produtos`, `/estoque/locais`, `/estoque/fornecedores`): os cadastros. O silo é ligado ao galpão na tela de locais.

Nos formulários de vacinação de lote, vacina e tratamento entra um campo opcional "Produto do estoque". Ele vem com local, lote de fabricação e quantidade; na vacinação de lote, a quantidade já vem com as aves vivas.

## Avisos

Os avisos vão pelo módulo `avisos` (`notificacao`) para owner e admin, um por produto e por motivo a cada dia. São conferidos na rotina diária que já existe. O de saldo negativo também sai na hora do movimento.

- abaixo do `estoqueMinimo` (saldo total do produto);
- ração de um silo com `diasRestantes` ≤ 5;
- validade em até 30 dias, ou já vencida com saldo;
- saldo negativo;
- `racaoKg` lançado num galpão sem silo ligado.

O painel ganha um cartão "Estoque" com a contagem desses alertas, só lendo o `estoque/index.ts`.

## Erros e regras

- A quantidade informada é sempre maior que zero. O sinal vem do tipo do movimento.
- Produto de outra organização, ou inativo, dá 404 ou 400. O mesmo vale para local.
- Produto com `controlaLote` e entrada sem lote ou sem validade dá 400.
- Estornar de novo, ou estornar um estorno, dá 409.
- Transferência para o mesmo local dá 400.
- NF-e com XML inválido dá 400, e com chave repetida dá 409.
- Abrir inventário num local que já tem um aberto dá 409. Fechar sem itens dá 400.
- Erros de regra saem como `Resultado` de `base/resultado.ts`, como nos outros módulos.

## Testes

- **`shared`**: os schemas do estoque e das duas operações novas; `novoCustoMedio`, `repartirFefo` (vários lotes, sem validade, sobra negativa), `converterParaUnidade` e `diasRestantes`.
- **api `test/estoque/`**, com `criarFazenda` e `chamar`. Cada rota tem o caminho feliz e **outra organização não vê nem lança**, mais estes casos:
  - entrada e custo médio;
  - saída por FEFO;
  - saldo negativo com aviso;
  - transferência;
  - estorno de movimento, de entrada (com o custo recalculado) e o estorno duplo (409);
  - inventário fechando com ajuste;
  - NF-e com XML de exemplo **fictício** em `test/estoque/fixtures/`: leitura, confirmação, vínculo aprendido e chave repetida;
  - baixa pelo registro diário (criar, editar e apagar) e galpão sem silo;
  - baixa pela vacinação de lote (aves vivas) e pelo tratamento;
  - aprovação de `entrada_estoque` e `saida_estoque` por voz.
- `estrutura.test.ts` (api e web): sem ciclo com o módulo novo.

## Ordem de entrega

Cada fase vai num commit na `homologacao`, com seus testes e `npm test` verde, e funciona sozinha.

1. **Base**: tabelas e migration; cadastros; `lancarMovimento`; entrada manual, saída, transferência e estorno; telas de saldo, movimentos, entradas e cadastros.
2. **Baixas automáticas**: registro diário, vacinação de lote, vacina e tratamento, com o campo de produto nos formulários.
3. **Inventário**.
4. **NF-e**: `fast-xml-parser`, leitura, conferência e vínculo com o fornecedor.
5. **Voz**: `entrada_estoque`, `saida_estoque` e o reconhecimento de produto nas operações que já existem.
6. **Avisos** e o cartão no painel.

A migration é aplicada primeiro no banco da homologação, e só com autorização do Arthur na hora, porque é escrita no banco. Na produção, só no merge para a `main`, com `npx cross-env APP_ENV=prod npm run db:migrate`.
