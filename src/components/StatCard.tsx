import type { LucideIcon } from 'lucide-react';

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, detail, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
        </div>
        <div className="grid size-10 place-items-center rounded-lg border border-ink/10 bg-paper text-moss">
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-graphite/80">{detail}</p>
    </div>
  );
}
