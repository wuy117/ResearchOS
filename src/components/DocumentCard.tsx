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
  const percentageRecords = linkedRecords
    .map((record) => ({ record, percentage: getRecordPercentage(record) }))
    .filter((item): item is { record: PerformanceRecord; percentage: number } => item.percentage !== undefined);
  const orderedPercentages = [...percentageRecords].sort((a, b) => b.percentage - a.percentage);
  const averageMark = percentageRecords.length
    ? Math.round(percentageRecords.reduce((total, item) => total + item.percentage, 0) / percentageRecords.length)
    : undefined;
  const highest = orderedPercentages[0];
  const lowest = orderedPercentages.length > 1 ? orderedPercentages[orderedPercentages.length - 1] : undefined;
  const teacherComments = linkedRecords.filter((record) => Boolean(record.teacherComment?.trim()));
  const themes = buildFindingThemes(linkedRecords, metadata?.topics);
  const context = [
    metadata?.linkedAssessmentName,
    metadata?.term ?? metadata?.terms?.[0],
    metadata?.academicYear ?? metadata?.academicYears?.[0],
  ].filter((value): value is string => Boolean(value));
  const academicPeriod = [
    metadata?.term ?? metadata?.terms?.[0],
    metadata?.academicYear ?? metadata?.academicYears?.[0],
  ].filter((value): value is string => Boolean(value));
  const documentKind = metadata?.documentCategory ?? metadata?.documentTypes?.[0] ?? document.type;
  const displaySummary = cleanDocumentSummary(document.summary);
  const importance = buildArchiveImportance(documentKind, subjects, teacherComments.length, academicPeriod);
  const originalFile = document.originalFile;
  const showDeveloperDiagnostics = import.meta.env.DEV || new URLSearchParams(window.location.search).get('dev') === '1';
  const summary = document.extractionSummary;
  const primaryFinding = averageMark !== undefined
    ? { label: 'Average mark', value: `${averageMark}%`, detail: `Across ${percentageRecords.length} marked subject${percentageRecords.length === 1 ? '' : 's'}` }
    : teacherComments.length
      ? { label: 'Teacher feedback', value: `${teacherComments.length} subject${teacherComments.length === 1 ? '' : 's'}`, detail: 'A report led by written feedback' }
      : { label: 'Document overview', value: subjects.length ? `${subjects.length} subject${subjects.length === 1 ? '' : 's'}` : documentKind, detail: displaySummary || 'A saved document in your academic archive.' };

  return (
    <article className="overflow-hidden rounded-xl bg-white shadow-[0_18px_48px_rgba(43,40,35,0.07)] ring-1 ring-ink/[0.045]">
      <div className="px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">{documentKind}</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold leading-tight text-ink sm:text-3xl">{document.title}</h2>
            <p className="mt-2 text-sm leading-6 text-graphite/64">
              {context.length ? context.join(' · ') : `Added ${document.addedAt}`}
            </p>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1 text-sm">{actions}</div> : null}
        </div>

        <div className="mt-7 grid gap-7 border-t border-ink/[0.055] pt-7 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-graphite/48">{primaryFinding.label}</p>
            <p className="mt-2 font-serif text-4xl font-semibold leading-none text-ink sm:text-5xl">{primaryFinding.value}</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-graphite/65">{primaryFinding.detail}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-graphite/48">Why it matters</p>
            <p className="mt-2 max-w-2xl font-serif text-xl leading-8 text-ink/86">{importance}</p>
          </div>
        </div>

        {(highest || lowest) ? (
          <div className="mt-7 grid gap-5 border-t border-ink/[0.055] pt-6 sm:grid-cols-2">
            {highest ? <ArchiveFact label="Highest subject" value={`${highest.record.subject} · ${highest.percentage}%`} /> : null}
            {lowest ? <ArchiveFact label="Lowest subject" value={`${lowest.record.subject} · ${lowest.percentage}%`} /> : null}
          </div>
        ) : null}

        {teacherComments.length ? (
          <section className="mt-7 border-t border-ink/[0.055] pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-graphite/48">Teacher summary</p>
            <div className="mt-3 space-y-4">
              {teacherComments.slice(0, 2).map((record) => (
                <blockquote key={record.id} className="border-l-2 border-brass/45 pl-4">
                  <p className="font-serif text-lg leading-8 text-ink/84">{record.teacherComment}</p>
                  <footer className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-graphite/52">
                    {[record.subject, record.teacher].filter(Boolean).join(' · ')}
                  </footer>
                </blockquote>
              ))}
              {teacherComments.length > 2 ? <p className="text-sm text-graphite/60">Plus {teacherComments.length - 2} more subject comment{teacherComments.length - 2 === 1 ? '' : 's'} in the report.</p> : null}
            </div>
          </section>
        ) : displaySummary ? (
          <section className="mt-7 border-t border-ink/[0.055] pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-graphite/48">Summary</p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-graphite/72">{displaySummary}</p>
          </section>
        ) : null}

        {(themes.length || subjects.length) ? (
          <div className="mt-7 grid gap-7 border-t border-ink/[0.055] pt-6 lg:grid-cols-2">
            {themes.length ? (
              <ArchiveList label="Key themes" items={themes} />
            ) : null}
            {subjects.length ? (
              <ArchiveList label="Subjects covered" items={subjects.slice(0, 12)} />
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-t border-ink/[0.055] bg-paper/[0.38] px-5 py-4 sm:px-7">
        <div className="grid gap-2 sm:grid-cols-2">
          <details className="group rounded-lg px-1 py-1 sm:open:col-span-2">
            <summary className="cursor-pointer list-none rounded-md px-2 py-2 text-sm font-semibold text-ink outline-none transition hover:bg-white/70 focus-visible:ring-4 focus-visible:ring-ink/10">
              <span className="inline-flex items-center gap-2"><span aria-hidden="true">＋</span> Open report</span>
            </summary>
            <div className="mt-3 rounded-lg bg-[#fdfcf8] p-4 shadow-inner ring-1 ring-ink/[0.055] sm:p-7">
              <div className="mx-auto max-w-4xl">
                <div className="mb-5 border-b border-ink/10 pb-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-graphite/50">School report</p>
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
                  <p className="py-10 text-center text-sm leading-7 text-graphite/65">The original report is not available to preview here.</p>
                )}
              </div>
            </div>
          </details>

          <details className="group rounded-lg px-1 py-1 sm:open:col-span-2">
            <summary className="cursor-pointer list-none rounded-md px-2 py-2 text-sm font-semibold text-graphite/65 outline-none transition hover:bg-white/70 focus-visible:ring-4 focus-visible:ring-ink/10">Technical Details</summary>
            <div className="mt-3 space-y-4 rounded-lg border border-ink/[0.055] bg-white/70 p-4 text-sm leading-6 text-graphite/70">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                <TechnicalFact label="Archive status" value={formatArchiveStatus(document.status)} />
                <TechnicalFact label="File" value={originalFile ? `${originalFile.fileName} · ${formatBytes(originalFile.size)}` : document.type} />
                <TechnicalFact label="Length" value={document.pageCount ? `${document.pageCount.toLocaleString()} pages` : 'Not recorded'} />
                <TechnicalFact label="Study index" value={chunkCount ? `${chunkCount.toLocaleString()} sections available` : 'Not available'} />
              </dl>
              {technicalDetails}
              {showDeveloperDiagnostics ? (
                <details className="border-t border-ink/[0.055] pt-4">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Developer diagnostics</summary>
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

function buildArchiveImportance(documentKind: string, subjects: string[], teacherCommentCount: number, context: string[]) {
  const scope = subjects.length ? `${subjects.length} subject${subjects.length === 1 ? '' : 's'}` : 'this stage of learning';
  const period = context.length ? ` for ${context.slice(0, 3).join(', ')}` : '';

  if (/report/i.test(documentKind)) {
    return `A broad record of ${scope}${period}${teacherCommentCount ? ', bringing results and teacher feedback together in one place' : ''}.`;
  }
  if (/exam|assessment|mark/i.test(documentKind)) {
    return `A point-in-time view of performance across ${scope}${period}, useful for seeing what was secure and what needed attention next.`;
  }
  if (/coursework|essay/i.test(documentKind)) {
    return `A record of completed work across ${scope}${period}, preserving the feedback and ideas that can strengthen the next piece.`;
  }
  return `A saved academic source covering ${scope}${period}, kept here so its evidence and context are easy to return to.`;
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

function ArchiveFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-graphite/48">{label}</p>
      <p className="mt-2 font-serif text-xl font-semibold text-ink/86">{value}</p>
    </div>
  );
}

function ArchiveList({ label, items }: { label: string; items: string[] }) {
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-graphite/48">{label}</p>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm leading-6 text-graphite/72">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function TechnicalFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-graphite/48">{label}</dt>
      <dd className="mt-1 text-xs leading-5 text-graphite/70">{value}</dd>
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
