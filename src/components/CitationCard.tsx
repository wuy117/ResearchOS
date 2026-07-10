import { Quote } from 'lucide-react';
import type { Citation } from '../types/research';

export function CitationCard({ citation }: { citation: Citation }) {
  return (
    <div className="rounded-lg border border-ink/8 bg-paper/55 p-4">
      <div className="flex items-start gap-3">
        <Quote className="mt-0.5 shrink-0 text-brass" size={17} />
        <div>
          <p className="text-sm font-semibold text-ink">{citation.documentTitle}</p>
          <p className="mt-1 text-xs font-semibold text-graphite/60">{citation.location}</p>
          <p className="mt-3 text-sm leading-6 text-graphite/78">{citation.excerpt}</p>
          {import.meta.env.DEV && (citation.score || citation.matchedTerms?.length || citation.reason) ? (
            <p className="mt-3 text-xs font-semibold text-graphite/55">
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
