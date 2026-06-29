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
    <article className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm transition hover:border-ink/14 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-ink/8 bg-paper text-graphite">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-ink">{document.title}</h3>
            <p className="mt-1 text-sm text-graphite/68">
              {document.type} · {document.authors}
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[document.status]}`}>{document.status}</span>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-7 text-graphite/75">{document.summary}</p>
      {document.status === 'Failed' && document.extractionError ? <p className="mt-3 text-sm font-semibold text-red-700">{document.extractionError}</p> : null}
      <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-paper/70 p-3 text-center text-xs text-graphite/70">
        <div>
          <p className="font-semibold text-ink">{document.pageCount ? document.pageCount.toLocaleString() : '-'}</p>
          <p className="mt-1">pages</p>
        </div>
        <div>
          <p className="font-semibold text-ink">{document.wordCount ? document.wordCount.toLocaleString() : '-'}</p>
          <p className="mt-1">words</p>
        </div>
        <div>
          <p className="font-semibold text-ink">{chunkCount.toLocaleString()}</p>
          <p className="mt-1">chunks</p>
        </div>
      </div>
      <details className="mt-4 border-t border-ink/8 pt-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">More details</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {document.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-graphite/72">
              {tag}
            </span>
          ))}
          <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-graphite/72">Added {document.addedAt}</span>
        </div>
      </details>
    </article>
  );
}
