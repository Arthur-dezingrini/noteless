# Modelo de dados

> Banco: PostgreSQL no Neon, acessado pelo Drizzle ORM. Fonte da verdade:
> `apps/api/src/db/schema.ts` (tabelas do Better Auth, geradas) e
> `apps/api/src/db/tabelas/<módulo>.ts` (tabelas de negócio). As migrações
> SQL estão em `apps/api/drizzle/` (0000 a 0015 na `main`).

## 1. Escolha do banco de dados

**PostgreSQL**, hospedado no **Neon**, com **Drizzle ORM**.

### Por que relacional

Os dados do Noteless são relacionais por natureza: uma organização tem
animais; um animal tem pesagens, vacinas, tratamentos, partos, consultas e
prontuários; um lote de aves ocupa galpões ao longo do tempo. O banco precisa
garantir isso, não o código:

- **Integridade referencial**: chave estrangeira em todo vínculo. Uma vacina
  não existe sem o animal; apagar a organização apaga tudo dela (`cascade`);
  um usuário que sai deixa o histórico sem autor em vez de sumir com ele
  (`set null`).
- **Transações**: salvar uma nota aplica várias operações em tabelas
  diferentes (vacina, peso, consulta, cadastro de crias). Ou entra tudo, ou
  nada. Isso é natural em Postgres e difícil em bancos de documentos.
- **Restrições de unicidade** que são regra de negócio: um apontamento por
  galpão por dia; código de lote único na empresa; um prontuário por
  consulta.
- **JSONB para o que não é dado do sistema ainda**: as operações que a IA
  propõe são uma sugestão com forma variável por tipo. Ficam em JSONB na
  nota, validadas pelo contrato Zod na leitura, e só viram linhas de verdade
  na confirmação. O mesmo para o estado que o gravador reporta e para as
  listas curtas do prontuário (exame físico, remédios, exames pedidos).
- **Consultas de relatório** (vacinas a vencer, animais em carência,
  indicadores de postura) são `JOIN` + filtro por data, o forte de SQL.

### Por que Neon

- Postgres gerenciado e **serverless**: escala a zero, plano grátis suficiente
  para o MVP.
- **Branches**: o banco de produção (`production`) e o de homologação
  (`homologacao`) são branches do mesmo projeto. Migração arriscada é
  testada no de homologação antes
  (`npm run db:migrate:hom`).
- **Driver por WebSocket na porta 443**: a rede da faculdade bloqueia a 5432.
  Com `@neondatabase/serverless`, a api e as migrações funcionam em qualquer
  rede, sem VPN.
- Região `sa-east-1` (São Paulo), a mesma das funções da Vercel (`gru1`):
  menor latência e dados no Brasil.

### Por que Drizzle

- O esquema é código TypeScript: o tipo de cada linha chega pronto nas
  regras, e erro de coluna aparece na compilação.
- Gera **migrações SQL versionadas** no git (`npm run db:generate`), revisáveis
  em diff.
- Consultas parametrizadas por padrão (proteção contra SQL injection).
- Funciona igual com o **PGlite** (Postgres compilado para WebAssembly): os
  testes de rota rodam contra um Postgres de verdade, em memória, com as
  mesmas migrações.

### Alternativas consideradas

| Alternativa | Por que não |
| --- | --- |
| MongoDB / Firestore | dados relacionais; sem chave estrangeira; transação entre coleções é mais cara e menos natural; regras de acesso viram código espalhado |
| MySQL | atenderia, mas JSONB do Postgres é mais completo e o Neon (branches, WebSocket) só existe para Postgres |
| SQLite / Turso | ótimo para um processo só; com várias funções serverless e o time inteiro no mesmo banco, Postgres é mais simples de operar |
| Supabase | também Postgres; o Neon foi escolhido pelo driver WebSocket e pelos branches; a autenticação já é do Better Auth |

## 2. Convenções

- **Chave primária** `id text`, gerada como UUID v4 (`crypto.randomUUID()`) nas
  tabelas de negócio; o Better Auth gera os ids das tabelas dele. Ids não são
  sequenciais: não dá para adivinhar o próximo.
- **Multiempresa**: toda tabela de negócio tem `organization_id` (FK para
  `organization`, `on delete cascade`). Toda consulta da api filtra por ele.
- **Valores fechados** (espécie, status, tipo de consulta, fase do lote) são
  `text` validados pelo contrato Zod, não `enum` do Postgres: incluir um
  valor novo não exige migração.
- **Datas**: `date` para o que é dia de calendário (vacina, parto, consulta);
  `hora` da agenda é texto "HH:MM" "de parede" (08:00 é 08:00 na fazenda,
  sempre); `timestamp` (sem fuso, gravado em UTC) para momentos (criação,
  revisão).
- **Autoria**: `criado_por_id`, `revisado_por_id`, `encaminhada_por_id` e
  afins apontam para `user` com `on delete set null`.
- **Origem**: eventos que nasceram de uma nota guardam `ocorrencia_id`
  (`set null`), para saber de qual áudio veio cada registro.
- **Esquema do Better Auth** (`schema.ts`) é gerado com
  `npm run auth:generate` e nunca editado à mão.

## 3. Diagrama entidade-relacionamento

### 3.1 Visão geral

```mermaid
erDiagram
    organization ||--o{ member : "tem"
    user ||--o{ member : "participa"
    user ||--o{ session : "abre"
    user ||--o{ account : "credencial"
    organization ||--o{ invitation : "convida"

    organization ||--o{ animal : "cadastra"
    organization ||--o{ grupo : "organiza"
    grupo ||--o{ grupo_animal : ""
    animal ||--o{ grupo_animal : ""

    animal ||--o{ pesagem : ""
    animal ||--o{ vacina : ""
    animal ||--o{ tratamento : ""
    animal ||--o{ parto : "mãe"
    animal |o--o{ parto : "pai"
    animal |o--o{ animal : "mãe ou pai de"
    animal ||--o{ anotacao_animal : ""
    animal ||--o{ consulta : ""
    grupo ||--o{ consulta : ""
    animal ||--o{ prontuario : ""
    consulta |o--o| prontuario : "documenta"

    organization ||--o{ ocorrencia : "recebe"
    ocorrencia ||--o| ocorrencia_audio : "áudio"
    ocorrencia |o--o{ pesagem : "origem"
    ocorrencia |o--o{ vacina : "origem"
    ocorrencia |o--o{ anotacao_animal : "origem"

    organization ||--o{ notificacao : ""
    user ||--o{ notificacao : "recebe"
    organization |o--o{ gravador : "recebe notas de"
    user |o--o| gravador : "conta técnica"
    firmware |o--o{ gravador : "versão-alvo"
    user ||--o{ aceite_termos : "aceitou"

    organization ||--o{ instalacao : ""
    organization ||--o{ lote : ""
    lote ||--o{ alojamento : ""
    instalacao ||--o{ alojamento : ""
    instalacao ||--o{ apontamento_aviario : ""
    lote ||--o{ apontamento_aviario : ""
    lote ||--o{ pesagem_lote : ""
    lote ||--o{ vacinacao_lote : ""
```

### 3.2 Contas e multiempresa (Better Auth + gravador)

```mermaid
erDiagram
    user {
        text id PK
        text name
        text email UK
        boolean email_verified
        text image "avatar (data URL)"
        text cargo "Veterinária, Peão…"
        text tipo "comum | super"
        timestamp created_at
    }
    session {
        text id PK
        text token UK
        timestamp expires_at
        text ip_address
        text user_agent
        text user_id FK
        text active_organization_id
    }
    account {
        text id PK
        text provider_id "credential"
        text password "hash scrypt"
        text user_id FK
    }
    verification {
        text id PK
        text identifier
        text value
        timestamp expires_at
    }
    organization {
        text id PK
        text name
        text slug UK
        timestamp created_at
    }
    member {
        text id PK
        text organization_id FK
        text user_id FK
        text role "owner | admin | member"
    }
    invitation {
        text id PK
        text organization_id FK
        text email
        text status
        text inviter_id FK
    }
    gravador {
        text id PK
        text serie UK "MAC do chip"
        text nome
        text segredo_hash "SHA-256"
        text codigo "código de pareamento"
        timestamp aprovado_em
        text user_id FK "conta técnica"
        text organization_id FK
        jsonb estado "último aviso"
        timestamp visto_em
        boolean envio_pausado
        text firmware_alvo FK "versão a instalar"
    }
    firmware {
        text versao PK
        int tamanho
        text sha256
        text assinatura "ECDSA P-256"
        bytea dados "o .bin"
        text publicado_por_id FK
    }
    aceite_termos {
        text id PK
        text user_id FK
        text versao "dos termos"
        timestamp aceito_em
        text ip
    }
    notificacao {
        text id PK
        text organization_id FK
        text user_id FK
        text texto
        text link
        timestamp lida_em
    }

    user ||--o{ session : ""
    user ||--o{ account : ""
    user ||--o{ member : ""
    organization ||--o{ member : ""
    organization ||--o{ invitation : ""
    user ||--o{ invitation : "convidou"
    user |o--o| gravador : ""
    organization |o--o{ gravador : ""
    firmware |o--o{ gravador : "versão-alvo"
    user |o--o{ firmware : "publicou"
    user ||--o{ aceite_termos : "aceitou"
    user ||--o{ notificacao : ""
    organization ||--o{ notificacao : ""
```

`verification` não se liga a nenhuma tabela: o Better Auth guarda nela
tokens de uso único, e a api guarda o contador de senhas erradas por e-mail
(`id = tentativas-login:<e-mail>`, apagado ao entrar; vence 15 minutos depois do
primeiro erro; ver V4 em [seguranca.md](seguranca.md)).

### 3.3 Animais, saúde e notas

```mermaid
erDiagram
    animal {
        text id PK
        text organization_id FK
        text numero "brinco, coleira"
        text nome
        text especie
        text raca
        text sexo
        date nascimento
        numeric peso_kg
        text tutor
        text tutor_telefone
        text microchip
        text local
        text status
        text mae_id FK "animal"
        text pai_id FK "animal"
        text pai_externo "sêmen, reprodutor de fora"
    }
    grupo {
        text id PK
        text organization_id FK
        text nome
        text especie
        text local
    }
    grupo_animal {
        text grupo_id PK, FK
        text animal_id PK, FK
    }
    pesagem {
        text id PK
        text animal_id FK
        text ocorrencia_id FK
        numeric peso_kg
        date data
    }
    vacina {
        text id PK
        text animal_id FK
        text ocorrencia_id FK
        text vacina
        text dose
        text grupo_id "aplicada no grupo"
        date data
        date proxima_data
    }
    tratamento {
        text id PK
        text animal_id FK
        text ocorrencia_id FK
        text remedio
        date inicio
        date fim
        int carencia_dias
    }
    parto {
        text id PK
        text animal_id FK "a mãe"
        text pai_id FK "animal"
        text pai_externo
        text ocorrencia_id FK
        date data
        int crias
    }
    consulta {
        text id PK
        text organization_id FK
        text animal_id FK "ou"
        text grupo_id FK "ou"
        text veterinario_id FK
        date data
        text hora "HH:MM"
        text tipo
        text status
    }
    prontuario {
        text id PK
        text animal_id FK
        text consulta_id FK, UK
        text retorno_id FK
        text veterinario_id FK
        date data
        text queixa
        jsonb exame
        text diagnostico
        jsonb remedios
        jsonb exames
    }
    ocorrencia {
        text id PK
        text organization_id FK
        text criado_por_id FK
        text status "pendente | confirmada | descartada"
        text transcricao
        text transcricao_original
        text resumo
        int duracao_seg
        jsonb operacoes "propostas pela IA"
        text revisado_por_id FK
        text encaminhada_por_id FK
        timestamp created_at "hora da gravação"
        timestamp audio_apagado_em "90 dias após revisar"
    }
    ocorrencia_audio {
        text ocorrencia_id PK, FK
        text mime
        bytea dados
    }
    anotacao_animal {
        text id PK
        text animal_id FK
        text ocorrencia_id FK
        text texto
    }

    animal ||--o{ grupo_animal : ""
    grupo ||--o{ grupo_animal : ""
    animal ||--o{ pesagem : ""
    animal ||--o{ vacina : ""
    animal ||--o{ tratamento : ""
    animal ||--o{ parto : "mãe"
    animal |o--o{ parto : "pai"
    animal |o--o{ animal : "mãe ou pai de"
    animal ||--o{ anotacao_animal : ""
    animal |o--o{ consulta : ""
    grupo |o--o{ consulta : ""
    animal ||--o{ prontuario : ""
    consulta |o--o| prontuario : "documenta"
    consulta |o--o{ prontuario : "retorno"
    ocorrencia ||--o| ocorrencia_audio : ""
    ocorrencia |o--o{ pesagem : ""
    ocorrencia |o--o{ vacina : ""
    ocorrencia |o--o{ tratamento : ""
    ocorrencia |o--o{ parto : ""
    ocorrencia |o--o{ anotacao_animal : ""
```

Todas as tabelas acima também têm `organization_id` (FK) e as de histórico
têm `criado_por_id` e `created_at`; foram omitidos do desenho para caber.

### 3.4 Aviário

```mermaid
erDiagram
    instalacao {
        text id PK
        text organization_id FK
        text nome "UK com a org"
        text tipo
        int capacidade
        numeric area_m2
        boolean ativa
    }
    lote {
        text id PK
        text organization_id FK
        text codigo "UK com a org"
        text especie
        text linhagem
        date data_alojamento
        int femeas_iniciais
        int machos_iniciais
        text fase
        text situacao
    }
    alojamento {
        text id PK
        text lote_id FK
        text instalacao_id FK
        date inicio
        date fim "vazio = ainda alojado"
        int femeas
        int machos
    }
    apontamento_aviario {
        text id PK
        text instalacao_id FK "UK com data"
        text lote_id FK
        date data
        int mortas_femeas
        int ovos_total
        int ovos_incubaveis
        numeric racao_kg
        numeric agua_l
        text ocorrencia_id FK
    }
    pesagem_lote {
        text id PK
        text lote_id FK
        text instalacao_id FK
        date data
        text sexo
        numeric peso_medio_g
        numeric uniformidade_pct
    }
    vacinacao_lote {
        text id PK
        text lote_id FK
        text vacina
        date data
        date proxima_data
    }

    lote ||--o{ alojamento : ""
    instalacao ||--o{ alojamento : ""
    instalacao ||--o{ apontamento_aviario : ""
    lote ||--o{ apontamento_aviario : ""
    lote ||--o{ pesagem_lote : ""
    instalacao |o--o{ pesagem_lote : ""
    lote ||--o{ vacinacao_lote : ""
```

`apontamento_aviario` tem ainda mortes e eliminações por sexo e ovos
trincados, sujos, de duas gemas e de descarte. Os indicadores (postura,
mortalidade, ração por ave) são **calculados** em `@vocare/shared`, não
gravados: dado derivado gravado fica velho.

## 4. Chaves, índices e relacionamentos

### 4.1 Unicidade

| Tabela | Restrição | Regra de negócio |
| --- | --- | --- |
| `user` | `email` único | uma conta por e-mail, em todas as empresas |
| `session` | `token` único | — |
| `organization` | `slug` único | — |
| `gravador` | `serie` única | uma placa = um registro |
| `firmware` | PK `versao` | cada versão é publicada uma vez; a versão vem de dentro do `.bin` |
| `aceite_termos` | (`user_id`, `versao`) | um aceite por pessoa para cada versão dos termos |
| `prontuario` | `consulta_id` único | um atendimento por consulta |
| `instalacao` | (`organization_id`, `nome`) | nome de galpão não se repete na empresa |
| `lote` | (`organization_id`, `codigo`) | código de lote não se repete na empresa |
| `apontamento_aviario` | (`instalacao_id`, `data`) | um apontamento por galpão por dia; o segundo soma no primeiro (upsert) |
| `grupo_animal` | PK (`grupo_id`, `animal_id`) | o animal entra uma vez no grupo |

### 4.2 Índices

Cada índice existe por causa de uma consulta da tela ou de um relatório.

| Índice | Colunas | Atende |
| --- | --- | --- |
| `animal_organization_id_idx` | `organization_id` | lista de animais da empresa |
| `animal_mae_id_idx`, `animal_pai_id_idx` | `mae_id` / `pai_id` | filhos de um animal na ficha |
| `grupo_organization_id_idx` | `organization_id` | lista de grupos |
| `grupo_animal_animal_id_idx` | `animal_id` | grupos de um animal (a PK já cobre por grupo) |
| `pesagem_animal_id_idx` | `animal_id`, `data` | curva de peso na ficha |
| `vacina_animal_id_idx` | `animal_id`, `data` | vacinas na ficha |
| `vacina_org_proxima_idx` | `organization_id`, `proxima_data` | relatório "vacinas a vencer" |
| `tratamento_org_fim_idx` | `organization_id`, `fim` | "em tratamento" e carência |
| `parto_animal_id_idx` | `animal_id` | partos na ficha |
| `anotacao_animal_animal_id_idx` | `animal_id` | anotações na ficha |
| `consulta_organization_id_data_idx` | `organization_id`, `data` | agenda do dia/semana/mês |
| `consulta_animal_id_idx` | `animal_id` | consultas na ficha |
| `prontuario_organization_id_data_idx` | `organization_id`, `data` | lista de prontuários |
| `prontuario_animal_id_idx` | `animal_id` | prontuários na ficha |
| `ocorrencia_organization_id_status_idx` | `organization_id`, `status` | notas pendentes da empresa |
| `notificacao_user_org_idx` | `user_id`, `organization_id`, `created_at` | sino de avisos |
| `gravador_organization_id_idx` | `organization_id` | gravadores da empresa |
| `alojamento_instalacao_inicio_idx` | `instalacao_id`, `inicio` | quem está no galpão em tal data |
| `apontamento_aviario_lote_data_idx` | `lote_id`, `data` | ficha e indicadores do lote |
| `pesagem_lote_lote_data_idx` | `lote_id`, `data` | curva de peso do lote |
| `vacinacao_lote_org_proxima_idx` | `organization_id`, `proxima_data` | vacinas de lote a vencer |
| `session_userId_idx`, `account_userId_idx`, `member_*`, `invitation_*`, `verification_identifier_idx` | — | criados pelo Better Auth |

### 4.3 O que acontece ao apagar

| Ao apagar… | Efeito | Por quê |
| --- | --- | --- |
| a organização | apaga tudo dela (`cascade`) | os dados são da empresa |
| um animal | apaga o histórico dele (pesagens, vacinas, consultas, prontuários) | histórico sem animal não tem sentido |
| um usuário | autoria vira nula (`set null`), inclusive de quem publicou firmware; vínculos, sessões e aceites dos termos somem | o histórico da fazenda fica |
| uma consulta | o prontuário fica, sem a consulta (`set null`) | o atendimento aconteceu |
| uma nota | os registros que ela gerou ficam, sem a origem (`set null`); o áudio vai junto (`cascade`) | o dado salvo já foi conferido |
| um lote ou galpão | alojamentos, apontamentos, pesagens e vacinações dele vão junto | — |
| a empresa do gravador | o gravador fica sem empresa (`set null`) e para de mandar notas | — |
| a mãe ou o pai de um animal | o filho fica, sem a mãe ou o pai (`set null`); o mesmo vale para o pai em `parto` | a cria continua existindo |
| uma versão de firmware | a placa que ia instalá-la fica sem versão-alvo (`set null`) | — |

Na prática o sistema **quase não apaga**: remover usuário tira o vínculo
com a empresa (a conta fica); consulta se cancela; nota se descarta (e pode
voltar).

## 5. Mudanças recentes

Migrações que entraram na `main` depois da primeira versão deste documento
(16/11/2026). Todas já estão nos diagramas e tabelas acima.

| Migração | O que muda | Para quê |
| --- | --- | --- |
| `0016_aceite_termos_e_audio_apagado` | tabela `aceite_termos` (um aceite por pessoa e versão, com data e IP) e `ocorrencia.audio_apagado_em` | registrar o aceite dos termos (LGPD) e marcar a nota cujo áudio a rotina diária apagou |
| `0017_genealogia` | `animal.mae_id` e `animal.pai_id` (autorrelacionamento com `set null` e índice), `animal.pai_externo` em texto (sêmen, reprodutor de fora do rebanho); `parto.pai_id` e `parto.pai_externo` | mãe, pai e filhos na ficha; o parto liga as crias aos pais |
| `0018_pausar_envio` | `gravador.envio_pausado` | o super usuário pausa os envios de uma placa |
| `0019_firmware` | tabela `firmware` (versão, tamanho, SHA-256, assinatura e o binário) e `gravador.firmware_alvo` | atualização do firmware do gravador pelo ar (OTA) |

## 6. Como mudar o esquema

1. Edite `apps/api/src/db/tabelas/<módulo>.ts` (nunca o `schema.ts`, que é
   gerado; mudou a configuração do Better Auth, rode `npm run auth:generate`).
2. `npm run db:generate` cria a migração SQL em `apps/api/drizzle/`.
3. Teste em homologação: `npm run db:migrate:hom`.
4. Commite a migração junto com o código. Antes do merge na `main`, que
   publica a produção, `npx cross-env APP_ENV=prod npm run db:migrate`.

Migração destrutiva (remover coluna, renomear tabela) derruba quem ainda roda o
código antigo: aplique na produção só depois que o código novo estiver
publicado.
