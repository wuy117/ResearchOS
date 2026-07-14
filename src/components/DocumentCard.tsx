import type { ReactNode } from 'react';
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
    Extracting: 'bg-brass/10 text-brass',
    Analysing: 'bg-brass/10 text-brass',
    Failed: 'bg-brass/10 text-brass',
    'Needs review': 'bg-ink/10 text-graphite',
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
    <article className="document-card-compact surface-raised p-5 transition hover:border-ink/15 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate font-sans text-base font-semibold text-ink">{document.title}</h3>
          <p className="mt-1 text-sm text-graphite/80">
            {[metadata?.linkedAssessmentName, metadata?.academicYear ?? metadata?.academicYears?.[0], metadata?.term ?? metadata?.terms?.[0]].filter(Boolean).join(' / ') || document.type}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[document.status]}`}>{statusLabels[document.status]}</span>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-7 text-graphite/80">{displaySummary}</p>
      {metadata && displaySubjects.length ? (
        <div className="mt-5 border-t border-ink/10 pt-4">
          <MetadataBlock label="Subjects" items={displaySubjects} />
        </div>
      ) : null}
      {linkedRecords.length ? (
        <div className="mt-5 grid gap-3 border-t border-ink/10 pt-4 md:grid-cols-2">
          <SummaryBlock label="Results" value={markedRecords.length ? markedRecords.map(formatRecordResult).join(' / ') : commentRecords.length ? 'Teacher feedback only' : 'No results found'} />
          <SummaryBlock label="Teacher feedback" value={commentRecords.length ? `${commentRecords.length} subject comment${commentRecords.length === 1 ? '' : 's'}` : 'No teacher feedback found'} />
        </div>
      ) : null}
      {metadata?.ignoreInstrumentalMusic ? (
        <p className="mt-3 rounded-lg bg-paper/75 px-3 py-2 text-xs font-semibold text-graphite/80">
          Instrumental or performance lesson content is ignored for academic performance analysis.
        </p>
      ) : null}
      {document.status === 'Failed' && document.extractionError && document.extractionError !== document.summary ? <p className="mt-3 text-sm font-semibold text-brass">{document.extractionError}</p> : null}
      <details className="mt-4 border-t border-ink/10 pt-3">
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80"><span className="inline-flex items-center gap-2"><span className="disclosure-icon" aria-hidden="true">＋</span> More details</span></summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-paper/75 px-2.5 py-1 text-xs font-medium text-graphite/80">
              {tag}
            </span>
          ))}
          <span className="rounded-full bg-paper/75 px-2.5 py-1 text-xs font-medium text-graphite/80">Added {formatAddedDate(document.addedAt)}</span>
          {document.pageCount ? <span className="rounded-full bg-paper/75 px-2.5 py-1 text-xs font-medium text-graphite/80">{document.pageCount.toLocaleString()} pages</span> : null}
          {chunkCount ? <span className="rounded-full bg-paper/75 px-2.5 py-1 text-xs font-medium text-graphite/80">Ready to study</span> : null}
        </div>
        {originalFile ? (
          <div className="mt-4 rounded-lg border border-ink/10 bg-paper/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">Original document</p>
            <p className="mt-2 text-sm leading-6 text-graphite/80">
              {originalFile.fileName} / {formatBytes(originalFile.size)}
            </p>
            {originalFile.previewKind === 'image' && originalFile.previewData ? (
              <img src={originalFile.previewData} alt={`Preview of ${originalFile.fileName}`} className="mt-3 max-h-72 w-full rounded-lg border border-ink/10 object-contain" />
            ) : originalFile.previewKind === 'file' && originalFile.previewData ? (
              <iframe title={`Preview of ${originalFile.fileName}`} src={originalFile.previewData} className="mt-3 h-72 w-full rounded-lg border border-ink/10 bg-white" />
            ) : originalFile.previewKind === 'text' && originalFile.previewData ? (
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-ink/10 bg-white p-3 text-xs leading-5 text-graphite/80">{originalFile.previewData}</pre>
            ) : (
              <p className="mt-2 text-sm leading-6 text-graphite/80">{originalFile.previewLabel}</p>
            )}
          </div>
        ) : null}
        {showDeveloperDiagnostics ? (
          <div className="mt-4 space-y-3 rounded-lg border border-ink/10 bg-paper/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">Extraction diagnostics</p>
            {summary?.extractionWarnings?.length ? (
              <div>
                <p className="text-xs font-semibold text-ink">Warnings</p>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-graphite/80">
                  {summary.extractionWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {summary?.missingLikelySubjects?.length ? (
              <p className="text-xs leading-5 text-graphite/80">Missing likely subjects: {summary.missingLikelySubjects.join(', ')}</p>
            ) : null}
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-ink">View raw extracted text</summary>
              <pre className="mt-3 max-h-96 overflow-auto rounded-lg border border-ink/10 bg-white p-3 text-xs leading-5 text-graphite/80">{document.extractedText || 'No raw text stored on this document.'}</pre>
            </details>
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-ink">Compare raw text vs extracted records</summary>
              <div className="mt-3 space-y-3">
                {linkedRecords.length ? linkedRecords.map((record) => (
                  <div key={record.id} className="rounded-lg border border-ink/10 bg-white p-3">
                    <p className="text-sm font-semibold text-ink">{record.subject}</p>
                    <p className="mt-1 text-xs leading-5 text-graphite/80">{formatRecordResult(record)}{record.teacher ? ` / ${record.teacher}` : ''}</p>
                    {record.teacherComment ? <p className="mt-2 text-xs leading-5 text-graphite/80">{record.teacherComment}</p> : null}
                    {record.needsReviewReason ? <p className="mt-2 text-xs font-semibold text-brass">{record.needsReviewReason}</p> : null}
                    {record.rawEvidence?.length ? (
                      <ul className="mt-2 space-y-1 text-xs leading-5 text-graphite/80">
                        {record.rawEvidence.slice(0, 3).map((evidence) => (
                          <li key={evidence}>{evidence}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-graphite/80">No raw evidence quote stored for this record.</p>
                    )}
                  </div>
                )) : (
                  <p className="text-xs leading-5 text-graphite/80">No extracted records are linked to this document yet.</p>
                )}
              </div>
            </details>
          </div>
        ) : null}
      </details>
    </article>
  );
}

export function SourceArchiveCard({
  document,
  records = [],
  chunkCount = 0,
  actions,
  technicalDetails,
}: {
  document: ResearchDocument;
  records?: PerformanceRecord[];
  chunkCount?: number;
  actions?: ReactNode;
  technicalDetails?: ReactNode;
}) {
  const metadata = document.metadata;
  const linkedRecords = records.filter((record) => record.sourceDocumentId === document.id);
  const subjects = uniqueStrings([
    ...safeStringArray(metadata?.subjects),
    ...linkedRecords.map((record) => record.subject),
  ]);
  const teacherComments = linkedRecords.filter((record) => Boolean(record.teacherComment?.trim()));
  const themes = buildFindingThemes(linkedRecords, metadata?.topics);
  const linkedAcademicYear = linkedRecords.find((record) => record.academicYear?.trim())?.academicYear?.trim();
  const linkedTerm = linkedRecords.find((record) => record.term?.trim())?.term?.trim();
  const context = uniqueStrings([
    metadata?.linkedAssessmentName?.trim(),
    metadata?.term?.trim() || metadata?.terms?.find((value) => value.trim())?.trim() || linkedTerm,
    metadata?.academicYear?.trim() || metadata?.academicYears?.find((value) => value.trim())?.trim() || linkedAcademicYear,
  ].filter((value): value is string => Boolean(value)));
  const documentKind = metadata?.documentCategory ?? metadata?.documentTypes?.[0] ?? document.type;
  const displaySummary = cleanDocumentSummary(document.summary);
  const originalFile = document.originalFile;
  const showDeveloperDiagnostics = import.meta.env.DEV || new URLSearchParams(window.location.search).get('dev') === '1';
  const summary = document.extractionSummary;
  const leadSummary = displaySummary || teacherComments[0]?.teacherComment || '';
  const hasLearningEvidence = teacherComments.length > 0 || themes.length > 0 || subjects.length > 0;

  return (
    <article className="source-archive-document document-card surface-raised overflow-hidden">
      <div className="source-archive-document__body px-5 py-6 sm:px-8 sm:py-8">
        <div className="source-archive-document__header flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">{documentKind}</p>
            <h2 className="source-archive-document__title mt-2 max-w-3xl text-balance font-sans text-2xl font-semibold leading-tight text-ink sm:text-3xl">{document.title}</h2>
            <p className="mt-2.5 text-sm leading-6 text-graphite/80">
              {context.length ? context.join(' · ') : `Added ${formatAddedDate(document.addedAt)}`}
            </p>
          </div>
          {actions ? <div className="source-archive-document__actions flex shrink-0 flex-wrap items-center gap-2 text-sm sm:justify-end">{actions}</div> : null}
        </div>

        {leadSummary ? (
          <section className="source-archive-document__summary mt-8 border-t border-ink/[0.055] pt-6 sm:pt-7">
            <p className="eyebrow">{displaySummary ? 'At a glance' : 'Teacher feedback'}</p>
            <p className="mt-3.5 max-w-4xl text-pretty text-[0.9375rem] leading-7 text-graphite/80">{leadSummary}</p>
          </section>
        ) : null}

        {subjects.length ? (
          <div className="source-archive-document__subjects mt-7 border-t border-ink/[0.055] pt-5 text-sm text-graphite/80">
            <p><span className="font-semibold text-ink">Subjects</span> · {subjects.slice(0, 5).join(', ')}{subjects.length > 5 ? ` +${subjects.length - 5}` : ''}</p>
          </div>
        ) : null}
      </div>

      <div className="source-document-disclosures border-t border-ink/[0.055] bg-paper/[0.38] px-4 py-4 sm:px-8">
        <div className="source-document-disclosures__grid grid gap-1.5 sm:grid-cols-3">
          <details className="source-document-disclosure source-document-disclosure--reader group rounded-lg px-1 py-1 sm:open:col-span-3">
            <summary className="source-document-disclosure__trigger flex min-h-10 cursor-pointer list-none items-center rounded-md px-2.5 py-2 text-sm font-semibold text-ink transition hover:bg-white/70">
              <span className="inline-flex items-center gap-2"><span className="disclosure-icon" aria-hidden="true">＋</span> Read document</span>
            </summary>
            <div className="document-reader mt-3 rounded-lg bg-ivory p-4 ring-1 ring-ink/[0.055] sm:p-8 lg:p-10">
              <div className="mx-auto max-w-4xl">
                <div className="mb-5 border-b border-ink/10 pb-4 text-center">
                  <p className="eyebrow">{documentKind}</p>
                  <p className="mt-2 font-serif text-xl font-semibold text-ink">{document.title}</p>
                </div>
                {originalFile?.previewKind === 'image' && originalFile.previewData ? (
                  <img src={originalFile.previewData} alt={`Preview of ${originalFile.fileName}`} className="max-h-[48rem] w-full object-contain" />
                ) : originalFile?.previewKind === 'file' && originalFile.previewData ? (
                  <iframe title={`Preview of ${originalFile.fileName}`} src={originalFile.previewData} className="h-[42rem] w-full bg-white" />
                ) : originalFile?.previewKind === 'text' && originalFile.previewData ? (
                  <div className="max-h-[42rem] overflow-auto whitespace-pre-wrap bg-white px-5 py-6 font-serif text-sm leading-7 text-ink/80 sm:px-8">{originalFile.previewData}</div>
                ) : document.extractedText ? (
                  <div className="max-h-[42rem] overflow-auto whitespace-pre-wrap bg-white px-5 py-6 font-serif text-sm leading-7 text-ink/80 sm:px-8">{document.extractedText}</div>
                ) : (
                  <p className="py-10 text-center text-sm leading-7 text-graphite/80">The original document is not available to preview here.</p>
                )}
              </div>
            </div>
          </details>

          {hasLearningEvidence ? (
            <details className="source-document-disclosure group rounded-lg px-1 py-1 sm:open:col-span-3">
              <summary className="source-document-disclosure__trigger flex min-h-10 cursor-pointer list-none items-center rounded-md px-2.5 py-2 text-sm font-semibold text-graphite/80 transition hover:bg-white/70">
                Learning evidence
              </summary>
              <div className="mt-3 grid gap-7 rounded-lg bg-white/70 p-5 sm:p-6 lg:grid-cols-2">
                {teacherComments.length ? (
                  <section className="lg:col-span-2">
                    <p className="eyebrow">Teacher feedback</p>
                    <div className="mt-3 space-y-4">
                      {teacherComments.slice(0, 3).map((record) => (
                        <blockquote key={record.id} className="border-l-2 border-brass/45 pl-4">
                          <p className="font-serif text-base leading-7 text-ink/85">{record.teacherComment}</p>
                          <footer className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-graphite/80">
                            {[record.subject, record.teacher].filter(Boolean).join(' · ')}
                          </footer>
                        </blockquote>
                      ))}
                    </div>
                  </section>
                ) : null}
                {themes.length ? <ArchiveList label="Key themes" items={themes} /> : null}
                {subjects.length ? <ArchiveList label="Subjects covered" items={subjects.slice(0, 12)} /> : null}
              </div>
            </details>
          ) : null}

          <details className="source-document-disclosure group rounded-lg px-1 py-1 sm:open:col-span-3">
            <summary className="source-document-disclosure__trigger flex min-h-10 cursor-pointer list-none items-center rounded-md px-2.5 py-2 text-sm font-semibold text-graphite/80 transition hover:bg-white/70">File details</summary>
            <div className="mt-3 space-y-5 rounded-lg border border-ink/[0.055] bg-white/70 p-5 text-sm leading-6 text-graphite/80 sm:p-6">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-5">
                <TechnicalFact label="Status" value={formatArchiveStatus(document.status)} />
                <TechnicalFact label="Added" value={formatAddedDate(document.addedAt)} />
                <TechnicalFact label="File" value={originalFile ? `${originalFile.fileName} · ${formatBytes(originalFile.size)}` : document.type} />
                <TechnicalFact label="Length" value={document.pageCount ? `${document.pageCount.toLocaleString()} pages` : 'Not recorded'} />
                <TechnicalFact label="Available for study" value={chunkCount ? 'Yes' : 'No'} />
              </dl>
              {technicalDetails}
              {showDeveloperDiagnostics ? (
                <details className="border-t border-ink/[0.055] pt-4">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">Developer diagnostics</summary>
                  <div className="mt-3 space-y-3">
                    {summary?.extractionWarnings?.length ? (
                      <ul className="space-y-1 text-xs leading-5">
                        {summary.extractionWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                      </ul>
                    ) : <p className="text-xs">No extraction warnings recorded.</p>}
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-ink">View raw extracted text</summary>
                      <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-white p-3 text-xs leading-5">{document.extractedText || 'No raw text stored on this document.'}</pre>
                    </details>
                  </div>
                </details>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

function cleanDocumentSummary(value: string) {
  const cleaned = value
    .replace(/^\[(?:AI generated|Local fallback)[^\]]*\]\s*/i, '')
    .replace(/\b(?:subjects?|comments?|marks?|grades?) extracted\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return /^(?:reading this|finding subjects and comments|understanding report)|\b(?:parser|embedding|indexing|extraction)\b/i.test(cleaned) ? '' : cleaned;
}

function buildFindingThemes(records: PerformanceRecord[], metadataTopics: unknown) {
  const strengths = uniqueStrings(records.flatMap((record) => safeStringArray(record.strengths))).slice(0, 2).map((item) => `Strength · ${item}`);
  const weaknesses = uniqueStrings(records.flatMap((record) => safeStringArray(record.weaknesses))).slice(0, 2).map((item) => `Focus · ${item}`);
  const actions = uniqueStrings(records.flatMap((record) => safeStringArray(record.actionPoints))).slice(0, 2).map((item) => `Next step · ${item}`);
  const findings = [...strengths, ...weaknesses, ...actions];
  return findings.length ? findings.slice(0, 5) : safeStringArray(metadataTopics).slice(0, 5);
}

function formatArchiveStatus(status: ResearchDocument['status']) {
  if (status === 'Indexed' || status === 'Ready') return 'Available';
  if (status === 'Extracting' || status === 'Analysing') return 'Being prepared';
  if (status === 'Needs review') return 'Check suggested';
  return 'Unavailable';
}

function ArchiveList({ label, items }: { label: string; items: string[] }) {
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-graphite/80">{label}</p>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm leading-6 text-graphite/80">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function TechnicalFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-graphite/80">{label}</dt>
      <dd className="mt-1 text-xs leading-5 text-graphite/80">{value}</dd>
    </div>
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

function formatAddedDate(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(timestamp));
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-ink/10 py-1 pl-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">{label}</p>
      <p className="mt-2 text-sm leading-6 text-graphite/80">{value}</p>
    </div>
  );
}

function MetadataBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">{label}</p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.slice(0, 5).map((item) => (
            <span key={item} className="text-sm leading-6 text-graphite/80">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-graphite/80">Not available</p>
      )}
    </div>
  );
}
