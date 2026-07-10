import type { PerformanceRecord, ResearchDocument } from '../types/research';

export function DocumentCard({ document, records = [], chunkCount = 0 }: { document: ResearchDocument; records?: PerformanceRecord[]; chunkCount?: number }) {
  const metadata = document.metadata;
  const subjects = safeStringArray(metadata?.subjects);
  const tags = safeStringArray(document.tags);
  const linkedRecords = records.filter((record) => record.sourceDocumentId === document.id);
  const recordSubjects = uniqueStrings(linkedRecords.map((record) => record.subject));
  const displaySubjects = subjects.length ? subjects : recordSubjects;
  const markedRecords = linkedRecords.filter((record) => getRecordPercentage(record) !== undefined || record.grade || record.attainment || record.predictedGrade || record.targetGrade);
  const commentRecords = linkedRecords.filter((record) => record.teacherComment);
  const summary = document.extractionSummary;
  const showDeveloperDiagnostics = import.meta.env.DEV || new URLSearchParams(window.location.search).get('dev') === '1';
  const displaySummary = document.summary.replace(/^\[(?:AI generated|Local fallback)[^\]]*\]\s*/i, '');
  const originalFile = document.originalFile;
  const statusClasses = {
    Indexed: 'bg-moss/10 text-moss',
    Ready: 'bg-moss/10 text-moss',
    Extracting: 'bg-brass/12 text-brass',
    Analysing: 'bg-brass/12 text-brass',
    Failed: 'bg-red-50 text-red-700',
    'Needs review': 'bg-ink/8 text-graphite',
  };
  const statusLabels = {
    Indexed: 'Ready',
    Ready: 'Ready',
    Extracting: 'Importing',
    Analysing: 'Reading',
    Failed: 'Failed',
    'Needs review': 'Needs review',
  };

  return (
    <article className="rounded-lg border border-ink/6 bg-white p-5 shadow-sm hover:border-ink/12">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink">{document.title}</h3>
          <p className="mt-1 text-sm text-graphite/62">
            {[metadata?.linkedAssessmentName, metadata?.academicYear ?? metadata?.academicYears?.[0], metadata?.term ?? metadata?.terms?.[0]].filter(Boolean).join(' / ') || document.type}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[document.status]}`}>{statusLabels[document.status]}</span>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-7 text-graphite/75">{displaySummary}</p>
      {metadata ? (
        <div className="mt-5 grid gap-x-6 gap-y-4 border-t border-ink/6 pt-4 lg:grid-cols-3">
          <MetadataBlock label="Subjects" items={displaySubjects} />
          <MetadataBlock label="Report" items={[metadata.linkedAssessmentName, metadata.documentCategory].filter((item): item is string => Boolean(item))} />
          <MetadataBlock label="Academic time" items={[metadata.academicYear ?? metadata.academicYears?.[0], metadata.term ?? metadata.terms?.[0], metadata.sourceDate].filter((item): item is string => Boolean(item))} />
        </div>
      ) : null}
      {linkedRecords.length ? (
        <div className="mt-5 grid gap-3 border-t border-ink/6 pt-4 md:grid-cols-2">
          <SummaryBlock label="Results" value={markedRecords.length ? markedRecords.map(formatRecordResult).join(' / ') : commentRecords.length ? 'Teacher feedback only' : 'No results found'} />
          <SummaryBlock label="Teacher feedback" value={commentRecords.length ? `${commentRecords.length} subject comment${commentRecords.length === 1 ? '' : 's'}` : 'No teacher feedback found'} />
        </div>
      ) : null}
      {metadata?.ignoreInstrumentalMusic ? (
        <p className="mt-3 rounded-lg bg-paper/75 px-3 py-2 text-xs font-semibold text-graphite/70">
          Instrumental or performance lesson content is ignored for academic performance analysis.
        </p>
      ) : null}
      {document.status === 'Failed' && document.extractionError && document.extractionError !== document.summary ? <p className="mt-3 text-sm font-semibold text-red-700">{document.extractionError}</p> : null}
      <details className="mt-4 border-t border-ink/6 pt-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">More details</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-paper/75 px-2.5 py-1 text-xs font-medium text-graphite/70">
              {tag}
            </span>
          ))}
          <span className="rounded-full bg-paper/75 px-2.5 py-1 text-xs font-medium text-graphite/70">Added {document.addedAt}</span>
          {document.pageCount ? <span className="rounded-full bg-paper/75 px-2.5 py-1 text-xs font-medium text-graphite/70">{document.pageCount.toLocaleString()} pages</span> : null}
          {chunkCount ? <span className="rounded-full bg-paper/75 px-2.5 py-1 text-xs font-medium text-graphite/70">Ready to study</span> : null}
        </div>
        {originalFile ? (
          <div className="mt-4 rounded-lg border border-ink/6 bg-paper/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Original document</p>
            <p className="mt-2 text-sm leading-6 text-graphite/74">
              {originalFile.fileName} / {formatBytes(originalFile.size)}
            </p>
            {originalFile.previewKind === 'image' && originalFile.previewData ? (
              <img src={originalFile.previewData} alt={`Preview of ${originalFile.fileName}`} className="mt-3 max-h-72 w-full rounded-lg border border-ink/8 object-contain" />
            ) : originalFile.previewKind === 'file' && originalFile.previewData ? (
              <iframe title={`Preview of ${originalFile.fileName}`} src={originalFile.previewData} className="mt-3 h-72 w-full rounded-lg border border-ink/8 bg-white" />
            ) : originalFile.previewKind === 'text' && originalFile.previewData ? (
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-ink/8 bg-white p-3 text-xs leading-5 text-graphite/75">{originalFile.previewData}</pre>
            ) : (
              <p className="mt-2 text-sm leading-6 text-graphite/68">{originalFile.previewLabel}</p>
            )}
          </div>
        ) : null}
        {showDeveloperDiagnostics ? (
          <div className="mt-4 space-y-3 rounded-lg border border-ink/6 bg-paper/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Extraction diagnostics</p>
            {summary?.extractionWarnings?.length ? (
              <div>
                <p className="text-xs font-semibold text-ink">Warnings</p>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-graphite/72">
                  {summary.extractionWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {summary?.missingLikelySubjects?.length ? (
              <p className="text-xs leading-5 text-graphite/72">Missing likely subjects: {summary.missingLikelySubjects.join(', ')}</p>
            ) : null}
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-ink">View raw extracted text</summary>
              <pre className="mt-3 max-h-96 overflow-auto rounded-lg border border-ink/8 bg-white p-3 text-xs leading-5 text-graphite/75">{document.extractedText || 'No raw text stored on this document.'}</pre>
            </details>
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-ink">Compare raw text vs extracted records</summary>
              <div className="mt-3 space-y-3">
                {linkedRecords.length ? linkedRecords.map((record) => (
                  <div key={record.id} className="rounded-lg border border-ink/8 bg-white p-3">
                    <p className="text-sm font-semibold text-ink">{record.subject}</p>
                    <p className="mt-1 text-xs leading-5 text-graphite/72">{formatRecordResult(record)}{record.teacher ? ` / ${record.teacher}` : ''}</p>
                    {record.teacherComment ? <p className="mt-2 text-xs leading-5 text-graphite/72">{record.teacherComment}</p> : null}
                    {record.needsReviewReason ? <p className="mt-2 text-xs font-semibold text-brass">{record.needsReviewReason}</p> : null}
                    {record.rawEvidence?.length ? (
                      <ul className="mt-2 space-y-1 text-xs leading-5 text-graphite/68">
                        {record.rawEvidence.slice(0, 3).map((evidence) => (
                          <li key={evidence}>{evidence}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-graphite/55">No raw evidence quote stored for this record.</p>
                    )}
                  </div>
                )) : (
                  <p className="text-xs leading-5 text-graphite/68">No extracted records are linked to this document yet.</p>
                )}
              </div>
            </details>
          </div>
        ) : null}
      </details>
    </article>
  );
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getRecordPercentage(record: PerformanceRecord) {
  if (typeof record.percentage === 'number') return record.percentage;
  if (typeof record.score === 'number' && typeof record.maxScore === 'number' && record.maxScore > 0) {
    return Math.round((record.score / record.maxScore) * 100);
  }
  return undefined;
}

function formatRecordResult(record: PerformanceRecord) {
  const percentage = getRecordPercentage(record);
  const score = typeof record.score === 'number' && typeof record.maxScore === 'number' ? `${record.score}/${record.maxScore}` : undefined;
  const mark = [score, percentage !== undefined ? `${percentage}%` : undefined, record.grade, record.attainment].filter(Boolean).join(' ');
  return mark ? `${record.subject}: ${mark}` : record.subject;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-paper/65 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">{label}</p>
      <p className="mt-2 text-sm leading-6 text-graphite/76">{value}</p>
    </div>
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
        <p className="mt-2 text-sm text-graphite/60">Not available</p>
      )}
    </div>
  );
}
