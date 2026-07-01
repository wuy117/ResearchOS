import type { ResearchDocument } from '../types/research';

function getEmbeddingLabel(document: ResearchDocument) {
  if (document.embeddingStatus === 'embedding') return 'Embedding';
  if (document.embeddingStatus === 'embedded') return 'Embedded';
  if (document.embeddingStatus === 'failed') return 'Keyword search ready; semantic embedding failed';
  if (document.embeddingStatus === 'keyword_only') return 'Keyword search ready';

  return 'Not embedded';
}

export function DocumentCard({ document, chunkCount = 0 }: { document: ResearchDocument; chunkCount?: number }) {
  const metadata = document.metadata;
  const statusClasses = {
    Indexed: 'bg-moss/10 text-moss',
    Ready: 'bg-moss/10 text-moss',
    Extracting: 'bg-brass/12 text-brass',
    Analysing: 'bg-brass/12 text-brass',
    Failed: 'bg-red-50 text-red-700',
    'Needs review': 'bg-ink/8 text-graphite',
  };

  return (
    <article className="rounded-lg border border-ink/6 bg-white p-5 shadow-sm hover:border-ink/12">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink">{document.title}</h3>
          <p className="mt-1 text-sm text-graphite/62">
            {document.type} / {document.authors}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[document.status]}`}>{document.status}</span>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-7 text-graphite/75">{document.summary}</p>
      {metadata ? (
        <div className="mt-5 grid gap-x-6 gap-y-4 border-t border-ink/6 pt-4 lg:grid-cols-2">
          <MetadataBlock label="Subjects" items={metadata.subjects} />
          <MetadataBlock label="Context" items={[metadata.academicYear, metadata.term, metadata.sourceDate].filter((item): item is string => Boolean(item))} />
          <MetadataBlock label="Category" items={[metadata.documentCategory, metadata.linkedAssessmentName].filter((item): item is string => Boolean(item))} />
          <MetadataBlock label="Teachers" items={metadata.teacherNames} />
        </div>
      ) : null}
      {metadata?.ignoreInstrumentalMusic ? (
        <p className="mt-3 rounded-lg bg-paper/75 px-3 py-2 text-xs font-semibold text-graphite/70">
          Instrumental/music lesson content is ignored for academic performance analysis.
        </p>
      ) : null}
      {document.status === 'Failed' && document.extractionError && document.extractionError !== document.summary ? <p className="mt-3 text-sm font-semibold text-red-700">{document.extractionError}</p> : null}
      {document.status !== 'Failed' ? (
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">{getEmbeddingLabel(document)}</p>
      ) : null}
      <div className="mt-5 grid grid-cols-3 gap-3 rounded-lg bg-paper/55 p-3 text-center text-xs text-graphite/68">
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
      <details className="mt-4 border-t border-ink/6 pt-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">More details</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {document.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-paper/75 px-2.5 py-1 text-xs font-medium text-graphite/70">
              {tag}
            </span>
          ))}
          <span className="rounded-full bg-paper/75 px-2.5 py-1 text-xs font-medium text-graphite/70">Added {document.addedAt}</span>
        </div>
      </details>
    </article>
  );
}

function MetadataBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">{label}</p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.slice(0, 5).map((item) => (
            <span key={item} className="text-sm leading-6 text-graphite/74">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-graphite/60">Not extracted yet</p>
      )}
    </div>
  );
}
