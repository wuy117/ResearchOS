import { ChevronDown } from 'lucide-react';
import type { Citation } from '../types/research';

export function CitationCard({ citation, index }: { citation: Citation; index?: number }) {
  return (
    <details className="citation-card group min-w-0">
      <summary className="citation-card__summary">
        <span className="citation-card__index">Ref. {String(index ?? 1).padStart(2, '0')}</span>
        <span className="citation-card__identity">
          <span className="citation-card__title">{citation.documentTitle}</span>
          <span className="citation-card__location">{citation.location}</span>
        </span>
        <ChevronDown className="citation-card__chevron" size={15} aria-hidden="true" />
      </summary>
      <div className="citation-card__passage">
        <p>{citation.excerpt}</p>
          {import.meta.env.DEV && (citation.score || citation.matchedTerms?.length || citation.reason) ? (
            <p className="citation-card__diagnostic">
              Score {citation.score?.toFixed(1) ?? 'n/a'}
              {citation.matchedTerms?.length ? ` · ${citation.matchedTerms.join(', ')}` : ''}
              {citation.reason ? ` · ${citation.reason}` : ''}
            </p>
          ) : null}
      </div>
    </details>
  );
}
