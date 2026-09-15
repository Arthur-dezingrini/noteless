import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/app/avatar";
import { Badge } from "@/components/app/badge";
import { Card, CardHeader } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { requireSession } from "@/lib/auth/dal";
import { ALERTS, APPOINTMENTS, REVENUE, STATS } from "@/lib/mock/dashboard";

export const metadata = { title: "Dashboard" };

const TZ = "America/Sao_Paulo";

function saudacao(date: Date): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: TZ }).format(date),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function dataExtenso(date: Date): string {
  const s = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const ALERT_TONES = {
  yellow: "border-amber-400 bg-amber-50 text-amber-900",
  red: "border-red-400 bg-red-50 text-red-900",
  blue: "border-blue-400 bg-blue-50 text-blue-900",
};

export default async function DashboardPage() {
  const { user } = await requireSession();
  const agora = new Date();
  const primeiroNome = (user.name || user.email).split(/[\s@]/)[0];

  return (
    <>
      <PageHeader
        title={
          <>
            {saudacao(agora)}, {primeiroNome}{" "}
            <span aria-hidden="true">👋</span>
          </>
        }
        subtitle={dataExtenso(agora)}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATS.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader
            title="Consultas de hoje"
            aside={<Badge tone="gray">{`${APPOINTMENTS.length} agendadas`}</Badge>}
          />
          <ul className="divide-y divide-line">
            {APPOINTMENTS.map((a) => (
              <li key={a.time} className="flex items-center gap-4 px-5 py-3.5">
                <span className="w-12 text-sm text-ink-muted tabular-nums">{a.time}</span>
                <Avatar name={a.animal} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{a.animal}</p>
                  <p className="truncate text-xs text-ink-muted">{a.details}</p>
                </div>
                <span className="hidden text-xs text-ink-muted sm:block">{a.type}</span>
                <Badge tone={a.status.tone}>{a.status.label}</Badge>
              </li>
            ))}
          </ul>
          <div className="px-5 py-4">
            <Link
              href="/agenda"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
            >
              Ver agenda completa <ArrowRight className="size-4" />
            </Link>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Alertas importantes" />
            <ul className="space-y-3 px-5 pb-5">
              {ALERTS.map((al) => {
                const cls = `block rounded-lg border-l-4 px-4 py-3 text-sm ${ALERT_TONES[al.tone]}`;
                return (
                  <li key={al.text}>
                    {al.href ? (
                      <Link href={al.href} className={`${cls} hover:brightness-95`}>
                        {al.text}
                      </Link>
                    ) : (
                      <p className={cls}>{al.text}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Receita esta semana" />
            <ul className="space-y-4 px-5 pb-5">
              {REVENUE.map((r) => (
                <li key={r.label}>
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-muted">{r.label}</span>
                    <span className="font-medium text-ink tabular-nums">{r.value}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${r.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
