type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  copy?: string;
  compact?: boolean;
};

export function SectionHeader({ eyebrow, title, copy, compact = false }: SectionHeaderProps) {
  return (
    <div className={compact ? '' : 'mb-7'}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className={`${eyebrow ? 'mt-2' : ''} font-serif text-[2rem] font-semibold leading-[1.12] text-ink sm:text-4xl`}>{title}</h2>
      {copy ? <p className="mt-3 max-w-2xl text-[0.9375rem] leading-7 text-graphite/80">{copy}</p> : null}
    </div>
  );
}
