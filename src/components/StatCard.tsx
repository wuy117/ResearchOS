import type { LucideIcon } from 'lucide-react';

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, detail, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/80 bg-white/78 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-graphite/60">{label}</p>
          <p className="mt-3 text-3xl font-extrabold text-ink">{value}</p>
        </div>
        <div className="grid size-11 place-items-center rounded-2xl bg-paper text-moss">
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-graphite/72">{detail}</p>
    </div>
  );
}
