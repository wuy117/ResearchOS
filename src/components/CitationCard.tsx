import { Quote } from 'lucide-react';
import type { Citation } from '../types/research';

export function CitationCard({ citation }: { citation: Citation }) {
  return (
    <div className="citation-card group min-w-0 border-l-2 border-brass/25 py-2 pl-4 sm:pl-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <Quote className="mt-1 shrink-0 text-brass" size={15} />
        <div className="min-w-0">
          <p className="break-words text-[0.9375rem] font-semibold leading-6 text-ink">{citation.documentTitle}</p>
          <p className="mt-1.5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-graphite/80">{citation.location}</p>
          <p className="mt-3.5 max-w-3xl break-words text-sm leading-7 text-graphite/80">{citation.excerpt}</p>
          {import.meta.env.DEV && (citation.score || citation.matchedTerms?.length || citation.reason) ? (
            <p className="mt-3 font-mono text-[0.6875rem] font-medium tracking-[0.04em] text-graphite/80">
              Score {citation.score?.toFixed(1) ?? 'n/a'}
              {citation.matchedTerms?.length ? ` · ${citation.matchedTerms.join(', ')}` : ''}
              {citation.reason ? ` · ${citation.reason}` : ''}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
