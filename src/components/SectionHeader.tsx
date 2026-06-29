type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  copy?: string;
};

export function SectionHeader({ eyebrow, title, copy }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">{title}</h2>
      {copy ? <p className="mt-2 max-w-2xl text-sm leading-7 text-graphite/72">{copy}</p> : null}
    </div>
  );
}
