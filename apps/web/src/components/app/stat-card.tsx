import { BarChart3, CalendarDays, CircleDollarSign, Heart } from "lucide-react";

import type { Stat } from "@/lib/mock/dashboard";

import { Card } from "./card";

const ICONS = {
  calendar: CalendarDays,
  heart: Heart,
  dollar: CircleDollarSign,
  chart: BarChart3,
};

const TONES = {
  green: { value: "text-brand", icon: "bg-brand-soft text-brand" },
  blue: { value: "text-blue-600", icon: "bg-blue-50 text-blue-600" },
  purple: { value: "text-purple-600", icon: "bg-purple-50 text-purple-600" },
  orange: { value: "text-orange-600", icon: "bg-orange-50 text-orange-600" },
};

export function StatCard({ label, value, hint, tone, icon }: Stat) {
  const Icon = ICONS[icon];
  const t = TONES[tone];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-ink-muted">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded-lg ${t.icon}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className={`mt-3 text-[1.65rem] leading-none font-bold ${t.value}`}>{value}</p>
      <p className="mt-2 text-xs text-ink-muted">{hint}</p>
    </Card>
  );
}
