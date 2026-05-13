import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
}

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, { wrap: string; icon: string; value: string }> = {
  default: { wrap: "bg-primary/5 border-primary/15", icon: "bg-primary/10 text-primary", value: "text-foreground" },
  success: { wrap: "bg-success/5 border-success/20", icon: "bg-success/10 text-success", value: "text-success" },
  warning: { wrap: "bg-warning/5 border-warning/20", icon: "bg-warning/10 text-warning", value: "text-warning" },
  destructive: { wrap: "bg-destructive/5 border-destructive/20", icon: "bg-destructive/10 text-destructive", value: "text-destructive" },
};

export const StatCard = ({ label, value, sub, icon: Icon, tone = "default" }: StatCardProps) => {
  const t = toneClasses[tone];
  return (
    <div className={`ide-card relative overflow-hidden border ${t.wrap} p-4 sm:p-5`}>
      {Icon && (
        <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${t.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold leading-tight sm:text-3xl ${t.value}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
};
