import { Quote } from 'lucide-react';
import type { Citation } from '../types/research';

export function CitationCard({ citation }: { citation: Citation }) {
  return (
    <div className="min-w-0 border-l-2 border-brass/25 py-1 pl-4">
      <div className="flex items-start gap-3">
        <Quote className="mt-0.5 shrink-0 text-brass" size={15} />
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-ink">{citation.documentTitle}</p>
          <p className="mt-1 text-xs font-semibold text-graphite/80">{citation.location}</p>
          <p className="mt-3 break-words text-sm leading-6 text-graphite/80">{citation.excerpt}</p>
          {import.meta.env.DEV && (citation.score || citation.matchedTerms?.length || citation.reason) ? (
            <p className="mt-3 text-xs font-semibold text-graphite/80">
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
