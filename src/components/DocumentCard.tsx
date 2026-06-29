import { FileText } from 'lucide-react';
import type { ResearchDocument } from '../types/research';

export function DocumentCard({ document, chunkCount = 0 }: { document: ResearchDocument; chunkCount?: number }) {
  const statusClasses = {
    Indexed: 'bg-moss/10 text-moss',
    Ready: 'bg-moss/10 text-moss',
    Extracting: 'bg-brass/12 text-brass',
    Analysing: 'bg-brass/12 text-brass',
    Failed: 'bg-red-50 text-red-700',
    'Needs review': 'bg-ink/8 text-graphite',
  };

  return (
    <article className="rounded-3xl border border-white/80 bg-white/78 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-paper text-graphite">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-extrabold text-ink">{document.title}</h3>
            <p className="mt-1 text-sm text-graphite/68">{document.authors}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[document.status]}`}>{document.status}</span>
      </div>
      <p className="mt-4 line-clamp-2 text-sm leading-6 text-graphite/75">{document.summary}</p>
      {document.status === 'Failed' && document.extractionError ? <p className="mt-3 text-sm font-semibold text-red-700">{document.extractionError}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {document.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-paper px-2.5 py-1 text-xs font-bold text-graphite/72">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-ink/8 pt-4 text-xs font-bold uppercase tracking-[0.12em] text-graphite/55">
        <span>
          {[document.type, document.pageCount ? `${document.pageCount.toLocaleString()} pages` : null, document.wordCount ? `${document.wordCount.toLocaleString()} words` : null]
            .filter(Boolean)
            .join(' / ')}
        </span>
        <span>{chunkCount} chunks</span>
      </div>
    </article>
  );
}
