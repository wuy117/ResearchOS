type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  copy?: string;
};

export function SectionHeader({ eyebrow, title, copy }: SectionHeaderProps) {
  return (
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brass">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-3xl font-bold text-ink">{title}</h2>
      {copy ? <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/75">{copy}</p> : null}
    </div>
  );
}
