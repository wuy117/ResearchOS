import type { LucideIcon } from 'lucide-react';

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, detail, icon: Icon }: StatCardProps) {
  return (
    <article className="stat-card min-w-0 rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
      <div className="stat-card-heading flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="stat-card-label text-xs font-semibold uppercase leading-5 tracking-[0.14em] text-graphite/80">{label}</p>
          <p className="stat-card-value mt-3 truncate text-3xl font-semibold tabular-nums text-ink">{value}</p>
        </div>
        <div className="stat-card-icon grid size-10 shrink-0 place-items-center rounded-lg border border-ink/10 bg-paper text-moss" aria-hidden="true">
          <Icon size={20} />
        </div>
      </div>
      <p className="stat-card-detail mt-4 max-w-sm text-pretty text-sm leading-7 text-graphite/80">{detail}</p>
    </article>
  );
}
