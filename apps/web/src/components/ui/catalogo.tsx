"use client";

import { ChevronLeft } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Button,
  buttonClass,
  Callout,
  Card,
  ConfirmBar,
  Dot,
  EmptyState,
  Field,
  FormMessage,
  Input,
  Menu,
  MenuItem,
  Modal,
  ModalFooter,
  PageHeader,
  SectionHeader,
  SegmentedControl,
  Select,
  Spinner,
  StatusText,
  tabela,
  Tabs,
  Textarea,
  TONS,
  type Tom,
  type VarianteBotao,
} from "@/components/ui";

const VARIANTES: VarianteBotao[] = [
  "primario",
  "secundario",
  "fantasma",
  "perigo",
  "perigoSolido",
  "pequeno",
  "pequenoPerigo",
  "linha",
  "linhaPerigo",
  "link",
];
const CORES = ["brand", "brand-soft", "ink", "ink-soft", "ink-muted", "page", "surface", "line", "warn-dot", "warn-bg", "danger", "danger-bg", "danger-border"];

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={titulo} />
      <Card padded className="flex flex-wrap items-center gap-3">
        {children}
      </Card>
    </section>
  );
}

export function KitView() {
  const [aba, setAba] = useState<"a" | "b" | "c">("a");
  const [modal, setModal] = useState(false);
  const [modo, setModo] = useState<"dia" | "semana">("dia");
  const [menu, setMenu] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Só em desenvolvimento"
        title="Kit de UI"
        description="As peças de @/components/ui. Tela nova se monta com elas."
        actions={<Button variant="primario">Ação principal</Button>}
      />

      <Bloco titulo="Cores">
        {CORES.map((c) => (
          <span key={c} className="flex flex-col items-center gap-1 text-xs text-ink-muted">
            <span className="size-12 rounded-field border border-line" style={{ background: `var(--color-${c})` }} />
            {c}
          </span>
        ))}
      </Bloco>

      <Bloco titulo="Botões">
        {VARIANTES.map((v) => (
          <Button key={v} variant={v}>
            {v}
          </Button>
        ))}
        <Button variant="primario" loading>
          Salvando
        </Button>
        <Button variant="primario" disabled>
          Desabilitado
        </Button>
        <button type="button" aria-label="Fechar" className={buttonClass("icone")}>
          ×
        </button>
        <button type="button" aria-label="Anterior" className={buttonClass("iconePequeno")}>
          <ChevronLeft className="size-4" />
        </button>
      </Bloco>

      <Bloco titulo="Alternância e menu">
        <SegmentedControl
          label="Ver por"
          value={modo}
          onChange={setModo}
          items={[
            { value: "dia", label: "Dia" },
            { value: "semana", label: "Semana" },
          ]}
        />
        <span className="relative">
          <Button variant="pequeno" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            Mais ações
          </Button>
          {menu && (
            <Menu className="absolute top-11 left-0">
              <MenuItem onClick={() => setMenu(false)}>Remarcar</MenuItem>
              <MenuItem danger onClick={() => setMenu(false)}>
                Cancelar consulta
              </MenuItem>
            </Menu>
          )}
        </span>
      </Bloco>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Formulário" />
        <Card padded>
          <form className="grid max-w-[640px] gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
            <Field label="Nome">
              <Input placeholder="Mimosa" />
            </Field>
            <Field label="Espécie">
              <Select defaultValue="">
                <option value="" disabled>
                  Escolha
                </option>
                <option>Bovino</option>
              </Select>
            </Field>
            <Field label="Microchip" hint="(opcional)" error="Microchip já cadastrado.">
              <Input aria-invalid defaultValue="985112" />
            </Field>
            <Field label="Desabilitado">
              <Input disabled defaultValue="—" />
            </Field>
            <Field label="Observações" wide>
              <Textarea placeholder="Escreva aqui" />
            </Field>
            <div className="flex items-center justify-end gap-4 sm:col-span-2">
              <FormMessage tone="ok">Alterações salvas.</FormMessage>
              <Button type="submit" variant="primario">
                Salvar alterações
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <Bloco titulo="Status e avisos">
        {(Object.keys(TONS) as Tom[]).map((t) => (
          <span key={t} className="flex items-center gap-2">
            <Dot tone={t} />
            <StatusText tone={t}>{t}</StatusText>
          </span>
        ))}
        <Spinner className="text-ink-muted" />
        <FormMessage>Não foi possível salvar. Tente de novo.</FormMessage>
        <Callout className="w-full">
          <span>Em tratamento até 14/11.</span>
          <Button variant="pequeno">Ver prontuário</Button>
        </Callout>
        <Callout tone="perigo" className="w-full">
          Vacina vencida há 3 dias.
        </Callout>
      </Bloco>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Abas" />
        <Tabs
          label="Exemplo"
          value={aba}
          onChange={setAba}
          items={[
            { value: "a", label: "Pendentes", count: 3 },
            { value: "b", label: "Conferidas", count: 12 },
            { value: "c", label: "Todas" },
          ]}
        />
        <p className="text-[15px] text-ink-muted">Aba ativa: {aba}</p>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Tabela e vazio" action={<Button variant="link">Ver todos</Button>} />
        <Card className="overflow-hidden">
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr>
                <th className={tabela.th}>Animal</th>
                <th className={tabela.th}>Peso</th>
                <th className={`${tabela.th} w-36`}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["nº 132 Mimosa", "412 kg", "ok", "Ativo"],
                ["nº 87 Estrela", "388 kg", "aviso", "Em tratamento"],
              ].map(([n, p, t, s]) => (
                <tr key={n} tabIndex={0} className={tabela.linhaClicavel}>
                  <td className={`${tabela.td} font-semibold`}>{n}</td>
                  <td className={`${tabela.td} tabular-nums`}>{p}</td>
                  <td className={tabela.td}>
                    <StatusText tone={t as Tom}>{s}</StatusText>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <EmptyState
            title="Nenhum animal encontrado"
            description="Confira o nome ou o número, ou limpe os filtros."
            action={<Button>Limpar filtros</Button>}
          />
        </Card>
      </section>

      <Bloco titulo="Diálogo">
        <Button onClick={() => setModal(true)}>Abrir diálogo</Button>
      </Bloco>

      <Modal open={modal} onClose={() => setModal(false)} title="Editar animal" subtitle="nº 132 · Mimosa">
        <div className="flex flex-col gap-4">
          <Field label="Nome">
            <Input defaultValue="Mimosa" />
          </Field>
          {confirmar && (
            <ConfirmBar onCancel={() => setConfirmar(false)} onConfirm={() => setModal(false)}>
              Remover <strong>Mimosa</strong> e todo o histórico? Não dá para desfazer.
            </ConfirmBar>
          )}
          <ModalFooter start={!confirmar && <Button variant="perigo" onClick={() => setConfirmar(true)}>Excluir</Button>}>
            <Button variant="fantasma" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button variant="primario">Salvar</Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}
