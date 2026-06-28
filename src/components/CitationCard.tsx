import { Quote } from 'lucide-react';
import type { Citation } from '../types/research';

export function CitationCard({ citation }: { citation: Citation }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-paper/70 p-4">
      <div className="flex items-start gap-3">
        <Quote className="mt-0.5 shrink-0 text-brass" size={17} />
        <div>
          <p className="text-sm font-extrabold text-ink">{citation.documentTitle}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-graphite/55">{citation.location}</p>
          <p className="mt-3 text-sm leading-6 text-graphite/78">{citation.excerpt}</p>
        </div>
      </div>
    </div>
  );
}
