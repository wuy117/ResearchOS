import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FilePlus2,
  LibraryBig,
  Network,
  Send,
  Sparkles,
  Tags,
  TrendingUp,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from './components/AppShell';
import { CitationCard } from './components/CitationCard';
import { DocumentCard } from './components/DocumentCard';
import { SectionHeader } from './components/SectionHeader';
import { TutorPage } from './components/TutorPage';
import { useResearchState } from './hooks/useResearchState';
import { isSupabaseEnabled } from './lib/supabase';
import { saveChunks, saveDocument } from './services/researchStore';
import type { AssessmentType, ChatMessage, DocumentChunk, MapEdge, MapNode, PageId, PerformanceRecord, PerformanceSummary, ResearchDocument } from './types/research';
import { analysePerformanceDocument, askResearchChat, embedChunks, generatePerformanceAdvice, semanticSearch, type PerformanceAnalysisRecord, type SemanticSearchMatch } from './utils/api';
import { chunkText, extractTopics, getWordCount, summarizeText } from './utils/chunkText';
import { extractDocxText } from './utils/extractDocxText';
import { extractPdfText } from './utils/extractPdfText';
import { retrieveChunks, type RetrievedChunk } from './utils/retrieveChunks';

function App() {
  const { state, setState, storageStatus } = useResearchState();
  const [activePage, setActivePage] = useState<PageId>('dashboard');

  const workspaceDocuments = useMemo(
    () => state.documents.filter((document) => document.workspaceId === state.activeWorkspaceId),
    [state.activeWorkspaceId, state.documents],
  );
  const activeWorkspaceName = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.name ?? 'Research workspace';

  const page = {
    dashboard: <Dashboard state={state} documents={workspaceDocuments} setActivePage={setActivePage} />,
    library: <Library documents={workspaceDocuments} chunks={state.chunks} />,
    performance: <PerformancePage records={state.performanceRecords} summaries={state.performanceSummaries} documents={state.documents} setState={setState} />,
    tutor: (
      <TutorPage
        workspaceId={state.activeWorkspaceId}
        documents={workspaceDocuments}
        chunks={state.chunks}
        performanceRecords={state.performanceRecords}
        performanceSummaries={state.performanceSummaries}
        tutorLessons={state.tutorLessons}
        tutorAttempts={state.tutorAttempts}
        tutorSocraticTurns={state.tutorSocraticTurns}
        tutorExamSessions={state.tutorExamSessions}
        tutorMemory={state.tutorMemory}
        setState={setState}
      />
    ),
    upload: <Upload stateDocuments={state.documents} activeWorkspaceId={state.activeWorkspaceId} storageStatus={storageStatus} setState={setState} />,
    chat: <ResearchChat chat={state.chat} workspaceName={activeWorkspaceName} workspaceId={state.activeWorkspaceId} documents={workspaceDocuments} chunks={state.chunks} setState={setState} />,
    study: <StudyTools documents={workspaceDocuments} />,
    map: <KnowledgeMap documents={workspaceDocuments} />,
  }[activePage];

  return (
    <AppShell state={state} activePage={activePage} setActivePage={setActivePage} setState={setState} storageStatus={storageStatus}>
      {page}
    </AppShell>
  );
}

function Dashboard({
  state,
  documents,
  setActivePage,
}: {
  state: ReturnType<typeof useResearchState>['state'];
  documents: ResearchDocument[];
  setActivePage: (page: PageId) => void;
}) {
  const readyCount = documents.filter((document) => document.status === 'Indexed' || document.status === 'Ready').length;
  const newestDocuments = [...documents].slice(0, 2);
  const primaryAction = state.actions[0];
  const hasDocuments = documents.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-9">
      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-ink/8 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">{hasDocuments ? 'Continue' : 'Start'}</p>
          <h2 className="mt-4 max-w-2xl font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            {hasDocuments ? 'Return to your active reading desk.' : 'Build your research desk from real sources.'}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-graphite/72">
            {hasDocuments
              ? `${readyCount} sources are ready in this workspace. Use chat for synthesis or open the library to keep reviewing source material.`
              : 'Upload a TXT, PDF, or DOCX file to create searchable source material. Research chat and study tools will use those documents once they are ready.'}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActivePage(hasDocuments ? 'chat' : 'upload')}
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm"
            >
              {hasDocuments ? 'Ask research chat' : 'Upload first source'}
              <ArrowRight size={17} />
            </button>
            <button
              type="button"
              onClick={() => setActivePage(hasDocuments ? 'library' : 'upload')}
              className="inline-flex items-center gap-2 rounded-xl border border-ink/10 bg-paper px-4 py-3 text-sm font-semibold text-ink"
            >
              {hasDocuments ? 'Open library' : 'Add document'}
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-ink/8 bg-paper/75 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Workspace at a glance</p>
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-4xl font-semibold text-ink">{documents.length}</p>
              <p className="mt-1 text-sm text-graphite/70">documents in scope</p>
            </div>
            <div className="border-t border-ink/8 pt-5">
              <p className="text-4xl font-semibold text-ink">{state.insights.length}</p>
              <p className="mt-1 text-sm text-graphite/70">saved insights</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-7 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <SectionHeader eyebrow="Recent documents" title="Recently added" />
          <div className="space-y-4">
            {newestDocuments.length ? (
              newestDocuments.map((document) => <DocumentCard key={document.id} document={document} />)
            ) : (
              <EmptyState title="No documents yet" copy="Add a source to begin building this workspace." action="Upload a source" onClick={() => setActivePage('upload')} />
            )}
          </div>
        </div>

        <div>
          <SectionHeader eyebrow="Suggested next action" title="One useful move" />
          {primaryAction ? (
            <button
              type="button"
              onClick={() => setActivePage(primaryAction.page)}
              className="w-full rounded-2xl border border-ink/8 bg-white p-5 text-left shadow-sm transition hover:border-ink/14 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-lg font-semibold text-ink">{primaryAction.title}</p>
                  <p className="mt-3 text-sm leading-7 text-graphite/72">{primaryAction.detail}</p>
                </div>
                <ArrowRight className="mt-1 shrink-0 text-graphite/55" size={18} />
              </div>
            </button>
          ) : (
            <EmptyState title="No suggested actions yet" copy="Upload a source and Research OS will have real material to work with." action="Upload a source" onClick={() => setActivePage('upload')} />
          )}
        </div>
      </section>

      {state.insights[0] ? (
        <section className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Saved insight</p>
          <h3 className="mt-3 text-lg font-semibold text-ink">{state.insights[0].title}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-graphite/72">{state.insights[0].body}</p>
        </section>
      ) : null}
    </div>
  );
}

function Library({ documents, chunks }: { documents: ResearchDocument[]; chunks: DocumentChunk[] }) {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader
        eyebrow="Document library"
        title="Sources by workspace"
        copy="A calm catalogue for indexed and in-progress materials, with enough context to choose the next source without turning the library into a dashboard."
      />
      {documents.length ? (
        <div className="grid gap-5 md:grid-cols-2">
          {documents.map((document) => (
            <DocumentCard key={document.id} document={document} chunkCount={chunks.filter((chunk) => chunk.documentId === document.id).length} />
          ))}
        </div>
      ) : (
        <EmptyState title="Your library is empty" copy="Upload a TXT, PDF, or DOCX file to create searchable source material for this workspace." />
      )}
    </div>
  );
}

const assessmentTypes: AssessmentType[] = ['exam', 'report', 'coursework', 'music', 'mock', 'other'];

function splitList(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getRecordPercentage(record: PerformanceRecord) {
  if (typeof record.percentage === 'number') return record.percentage;
  if (typeof record.score === 'number' && typeof record.maxScore === 'number' && record.maxScore > 0) {
    return Math.round((record.score / record.maxScore) * 100);
  }
  return undefined;
}

function getSubjectGroups(records: PerformanceRecord[]) {
  return [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce<Record<string, PerformanceRecord[]>>((groups, record) => {
      const subject = record.subject.trim() || 'Unspecified subject';
      groups[subject] = [...(groups[subject] ?? []), record];
      return groups;
    }, {});
}

function formatResult(record: PerformanceRecord) {
  const percentage = getRecordPercentage(record);
  const score = typeof record.score === 'number' && typeof record.maxScore === 'number' ? `${record.score}/${record.maxScore}` : undefined;
  return [score, percentage !== undefined ? `${percentage}%` : undefined, record.grade].filter(Boolean).join(' / ') || 'No mark recorded';
}

function buildPerformanceSummary(records: PerformanceRecord[], advice: Omit<PerformanceSummary, 'id' | 'generatedAt'>): PerformanceSummary {
  return {
    id: `performance-summary-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    subjects: advice.subjects,
    strongestSubjects: advice.strongestSubjects,
    weakestSubjects: advice.weakestSubjects,
    improvingSubjects: advice.improvingSubjects,
    decliningSubjects: advice.decliningSubjects,
    recurringStrengths: advice.recurringStrengths,
    recurringWeaknesses: advice.recurringWeaknesses,
    recommendedActions: advice.recommendedActions,
    overallCommentary:
      advice.overallCommentary ||
      `Based on the available ${records.length} performance record${records.length === 1 ? '' : 's'}, more data may be needed before drawing firm conclusions.`,
  };
}

function normalizeAssessmentType(value: unknown): AssessmentType {
  return typeof value === 'string' && assessmentTypes.includes(value as AssessmentType) ? (value as AssessmentType) : 'other';
}

function createRecordFromAnalysis(record: PerformanceAnalysisRecord, sourceDocumentId: string, fallbackTitle: string): PerformanceRecord | null {
  const subject = typeof record.subject === 'string' ? record.subject.trim() : '';
  if (!subject) return null;

  const score = typeof record.score === 'number' ? record.score : undefined;
  const maxScore = typeof record.maxScore === 'number' ? record.maxScore : undefined;
  const percentage =
    typeof record.percentage === 'number'
      ? record.percentage
      : typeof score === 'number' && typeof maxScore === 'number' && maxScore > 0
        ? Math.round((score / maxScore) * 100)
        : undefined;

  return {
    id: `performance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: typeof record.title === 'string' && record.title.trim() ? record.title.trim() : fallbackTitle,
    sourceDocumentId,
    date: typeof record.date === 'string' && record.date.trim() ? record.date.trim() : new Date().toISOString().slice(0, 10),
    term: typeof record.term === 'string' && record.term.trim() ? record.term.trim() : undefined,
    academicYear: typeof record.academicYear === 'string' && record.academicYear.trim() ? record.academicYear.trim() : undefined,
    subject,
    assessmentType: normalizeAssessmentType(record.assessmentType),
    score,
    maxScore,
    percentage,
    grade: typeof record.grade === 'string' && record.grade.trim() ? record.grade.trim() : undefined,
    rank: typeof record.rank === 'string' && record.rank.trim() ? record.rank.trim() : undefined,
    teacherComment: typeof record.teacherComment === 'string' && record.teacherComment.trim() ? record.teacherComment.trim() : undefined,
    strengths: Array.isArray(record.strengths) ? record.strengths.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [],
    weaknesses: Array.isArray(record.weaknesses) ? record.weaknesses.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [],
    actionPoints: Array.isArray(record.actionPoints) ? record.actionPoints.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [],
    createdAt: new Date().toISOString(),
  };
}

function PerformancePage({
  records,
  summaries,
  documents,
  setState,
}: {
  records: PerformanceRecord[];
  summaries: PerformanceSummary[];
  documents: ResearchDocument[];
  setState: ReturnType<typeof useResearchState>['setState'];
}) {
  const [form, setForm] = useState({
    title: '',
    subject: '',
    date: new Date().toISOString().slice(0, 10),
    assessmentType: 'exam' as AssessmentType,
    score: '',
    maxScore: '',
    percentage: '',
    grade: '',
    rank: '',
    teacherComment: '',
    strengths: '',
    weaknesses: '',
    actionPoints: '',
  });
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [statusMessage, setStatusMessage] = useState('Performance data is stored locally in this version.');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);

  const subjectGroups = useMemo(() => getSubjectGroups(records), [records]);
  const subjectEntries = Object.entries(subjectGroups);
  const latestBySubject = subjectEntries.map(([subject, subjectRecords]) => ({
    subject,
    record: subjectRecords[subjectRecords.length - 1],
    previous: subjectRecords[subjectRecords.length - 2],
  }));
  const latestPercentages = latestBySubject
    .map((item) => ({ subject: item.subject, percentage: getRecordPercentage(item.record) }))
    .filter((item): item is { subject: string; percentage: number } => typeof item.percentage === 'number');
  const latestAverage = latestPercentages.length
    ? Math.round(latestPercentages.reduce((total, item) => total + item.percentage, 0) / latestPercentages.length)
    : undefined;
  const strongestSubject = [...latestPercentages].sort((a, b) => b.percentage - a.percentage)[0]?.subject;
  const weakestSubject = [...latestPercentages].sort((a, b) => a.percentage - b.percentage)[0]?.subject;
  const latestSummary = summaries[0];
  const analysableDocuments = documents.filter((document) => document.extractedText?.trim() && document.status === 'Ready');
  const computedPercentage = (() => {
    const score = parseOptionalNumber(form.score);
    const maxScore = parseOptionalNumber(form.maxScore);
    const manualPercentage = parseOptionalNumber(form.percentage);
    if (manualPercentage !== undefined) return manualPercentage;
    if (score !== undefined && maxScore !== undefined && maxScore > 0) return Math.round((score / maxScore) * 100);
    return undefined;
  })();

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = form.subject.trim();

    if (!subject) {
      setStatusMessage('Add a subject before saving a performance record.');
      return;
    }

    const record: PerformanceRecord = {
      id: `performance-${Date.now()}`,
      title: form.title.trim() || `${subject} ${form.assessmentType}`,
      date: form.date || new Date().toISOString().slice(0, 10),
      subject,
      assessmentType: form.assessmentType,
      score: parseOptionalNumber(form.score),
      maxScore: parseOptionalNumber(form.maxScore),
      percentage: computedPercentage,
      grade: form.grade.trim() || undefined,
      rank: form.rank.trim() || undefined,
      teacherComment: form.teacherComment.trim() || undefined,
      strengths: splitList(form.strengths),
      weaknesses: splitList(form.weaknesses),
      actionPoints: splitList(form.actionPoints),
      createdAt: new Date().toISOString(),
    };

    setState((current) => ({
      ...current,
      performanceRecords: [record, ...current.performanceRecords],
    }));
    setForm((current) => ({
      ...current,
      title: '',
      subject: '',
      score: '',
      maxScore: '',
      percentage: '',
      grade: '',
      rank: '',
      teacherComment: '',
      strengths: '',
      weaknesses: '',
      actionPoints: '',
    }));
    setStatusMessage(`${record.title} was saved locally.`);
  }

  async function handleAnalyseDocument() {
    const document = documents.find((item) => item.id === selectedDocumentId);
    if (!document?.extractedText) {
      setStatusMessage('Choose an uploaded document with extracted text first.');
      return;
    }

    setIsAnalysing(true);
    setStatusMessage(`Analysing ${document.title} for academic performance records...`);

    try {
      const response = await analysePerformanceDocument({ title: document.title, text: document.extractedText });
      const newRecords = response.records
        .map((record) => createRecordFromAnalysis(record, document.id, document.title))
        .filter((record): record is PerformanceRecord => Boolean(record));

      if (newRecords.length === 0) {
        setStatusMessage(response.message || 'No reliable performance records were found in that document.');
        return;
      }

      setState((current) => ({
        ...current,
        performanceRecords: [...newRecords, ...current.performanceRecords],
      }));
      setStatusMessage(`Added ${newRecords.length} performance record${newRecords.length === 1 ? '' : 's'} from ${document.title}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Performance analysis failed. Please try again.';
      setStatusMessage(message);
    } finally {
      setIsAnalysing(false);
    }
  }

  async function handleGenerateAdvice() {
    if (records.length === 0) {
      setStatusMessage('Add at least one performance record before generating advice.');
      return;
    }

    setIsGeneratingAdvice(true);
    setStatusMessage('Generating academic coaching advice from saved records...');

    try {
      const advice = await generatePerformanceAdvice(records);
      const summary = buildPerformanceSummary(records, advice);
      setState((current) => ({
        ...current,
        performanceSummaries: [summary, ...current.performanceSummaries],
      }));
      setStatusMessage('AI performance advice was saved locally.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Performance advice failed. Please try again.';
      setStatusMessage(message);
    } finally {
      setIsGeneratingAdvice(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <SectionHeader eyebrow="Performance" title="Performance" copy="Understand reports, exam results, and academic patterns." />

      <div className="rounded-2xl border border-ink/8 bg-white p-4 shadow-sm">
        <p className="text-sm leading-7 text-graphite/74">{statusMessage}</p>
      </div>

      {records.length === 0 ? (
        <EmptyState
          title="No performance records yet"
          copy="Add exam results manually or analyse an uploaded report to begin building a private academic performance picture."
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Subjects tracked" value={subjectEntries.length.toLocaleString()} />
        <MetricCard label="Latest average" value={latestAverage !== undefined ? `${latestAverage}%` : '-'} />
        <MetricCard label="Strongest subject" value={strongestSubject ?? '-'} />
        <MetricCard label="Priority area" value={weakestSubject ?? '-'} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">
            <BarChart3 size={15} />
            Latest performance by subject
          </div>
          <div className="mt-5 space-y-4">
            {latestPercentages.length ? (
              latestPercentages.map((item) => (
                <div key={item.subject}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-ink">{item.subject}</span>
                    <span className="text-graphite/70">{item.percentage}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-paper">
                    <div className="h-full rounded-full bg-moss" style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-paper/70 p-4 text-sm leading-7 text-graphite/70">Scores or percentages will appear here after they are added.</p>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          <TrendChart records={records} />
          <AssessmentBreakdown records={records} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={handleManualSubmit} className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">
            <ClipboardList size={15} />
            Manual entry
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Assessment title" className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" />
            <input value={form.subject} onChange={(event) => updateForm('subject', event.target.value)} placeholder="Subject" className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" />
            <input type="date" value={form.date} onChange={(event) => updateForm('date', event.target.value)} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" />
            <select value={form.assessmentType} onChange={(event) => updateForm('assessmentType', event.target.value)} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4">
              {assessmentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input value={form.score} onChange={(event) => updateForm('score', event.target.value)} placeholder="Score" inputMode="decimal" className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" />
            <input value={form.maxScore} onChange={(event) => updateForm('maxScore', event.target.value)} placeholder="Max score" inputMode="decimal" className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" />
            <input value={form.percentage} onChange={(event) => updateForm('percentage', event.target.value)} placeholder={computedPercentage !== undefined ? `${computedPercentage}% calculated` : 'Percentage'} inputMode="decimal" className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" />
            <input value={form.grade} onChange={(event) => updateForm('grade', event.target.value)} placeholder="Grade" className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" />
            <input value={form.rank} onChange={(event) => updateForm('rank', event.target.value)} placeholder="Rank or set" className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4 sm:col-span-2" />
            <textarea value={form.teacherComment} onChange={(event) => updateForm('teacherComment', event.target.value)} placeholder="Teacher comment" rows={3} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4 sm:col-span-2" />
            <textarea value={form.strengths} onChange={(event) => updateForm('strengths', event.target.value)} placeholder="Strengths, separated by commas or new lines" rows={2} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" />
            <textarea value={form.weaknesses} onChange={(event) => updateForm('weaknesses', event.target.value)} placeholder="Weaknesses, separated by commas or new lines" rows={2} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" />
            <textarea value={form.actionPoints} onChange={(event) => updateForm('actionPoints', event.target.value)} placeholder="Action points" rows={2} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4 sm:col-span-2" />
          </div>
          <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm">
            <FilePlus2 size={17} />
            Save record
          </button>
        </form>

        <div className="space-y-6">
          <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">
              <Sparkles size={15} />
              Analyse uploaded report
            </div>
            <p className="mt-3 text-sm leading-7 text-graphite/72">Select a document that has already been extracted. Research OS will ask the model for structured academic records and will not invent missing marks.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <select value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4">
                <option value="">Choose uploaded document</option>
                {analysableDocuments.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title}
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleAnalyseDocument} disabled={isAnalysing} className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-graphite/55">
                {isAnalysing ? 'Analysing...' : 'Analyse'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">AI advice</p>
                <h3 className="mt-2 font-serif text-3xl font-semibold text-ink">Academic coaching summary</h3>
              </div>
              <button type="button" onClick={handleGenerateAdvice} disabled={isGeneratingAdvice || records.length === 0} className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-graphite/55">
                {isGeneratingAdvice ? 'Generating...' : 'Generate'}
              </button>
            </div>
            {latestSummary ? (
              <div className="mt-5 space-y-4">
                <p className="text-sm leading-7 text-graphite/74">{latestSummary.overallCommentary}</p>
                <TagList label="Strongest" items={latestSummary.strongestSubjects} />
                <TagList label="Priority themes" items={latestSummary.recurringWeaknesses} />
                <TagList label="Recommended actions" items={latestSummary.recommendedActions} />
              </div>
            ) : (
              <p className="mt-5 rounded-xl bg-paper/70 p-4 text-sm leading-7 text-graphite/70">
                Generate advice after adding records. With limited data, the summary will include a confidence caveat.
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Subject breakdown" title="Patterns by subject" />
        <div className="grid gap-5 md:grid-cols-2">
          {latestBySubject.length ? (
            latestBySubject.map(({ subject, record, previous }) => {
              const currentPercentage = getRecordPercentage(record);
              const previousPercentage = previous ? getRecordPercentage(previous) : undefined;
              const trend =
                currentPercentage !== undefined && previousPercentage !== undefined
                  ? currentPercentage > previousPercentage
                    ? 'Improving'
                    : currentPercentage < previousPercentage
                      ? 'Needs attention'
                      : 'Stable'
                  : 'More data needed';

              return (
                <article key={subject} className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">{trend}</p>
                      <h3 className="mt-2 font-serif text-3xl font-semibold text-ink">{subject}</h3>
                    </div>
                    <span className="rounded-full bg-paper px-3 py-1 text-sm font-semibold text-graphite">{formatResult(record)}</span>
                  </div>
                  {record.teacherComment ? <p className="mt-4 line-clamp-3 text-sm leading-7 text-graphite/74">{record.teacherComment}</p> : null}
                  <div className="mt-5 grid gap-3">
                    <TagList label="Strengths" items={record.strengths} />
                    <TagList label="Weaknesses" items={record.weaknesses} />
                    <TagList label="Action points" items={record.actionPoints} />
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState title="No subject patterns yet" copy="Performance records will appear here grouped by subject." />
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">{label}</p>
      <p className="mt-3 truncate text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function TrendChart({ records }: { records: PerformanceRecord[] }) {
  const points = [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record) => ({ date: record.date, percentage: getRecordPercentage(record) }))
    .filter((point): point is { date: string; percentage: number } => typeof point.percentage === 'number');
  const width = 320;
  const height = 130;
  const polyline = points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - (Math.min(100, Math.max(0, point.percentage)) / 100) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">
        <TrendingUp size={15} />
        Trend over time
      </div>
      {points.length > 1 ? (
        <svg className="mt-5 h-36 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline points={polyline} fill="none" stroke="rgb(111 123 92)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <p className="mt-5 rounded-xl bg-paper/70 p-4 text-sm leading-7 text-graphite/70">Add at least two marked records to see a trend.</p>
      )}
    </div>
  );
}

function AssessmentBreakdown({ records }: { records: PerformanceRecord[] }) {
  const counts = assessmentTypes.map((type) => ({
    type,
    count: records.filter((record) => record.assessmentType === type).length,
  }));
  const maxCount = Math.max(1, ...counts.map((item) => item.count));

  return (
    <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Assessment type breakdown</p>
      <div className="mt-5 space-y-3">
        {counts.map((item) => (
          <div key={item.type} className="flex items-center gap-3 text-sm">
            <span className="w-24 font-semibold capitalize text-ink">{item.type}</span>
            <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full bg-brass" style={{ width: `${(item.count / maxCount) * 100}%` }} />
            </div>
            <span className="w-8 text-right text-graphite/70">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">{label}</p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-graphite/75">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-graphite/60">No clear pattern yet.</p>
      )}
    </div>
  );
}

function EmptyState({ title, copy, action, onClick }: { title: string; copy: string; action?: string; onClick?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/14 bg-white/70 p-8 text-center">
      <p className="font-serif text-2xl font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-graphite/70">{copy}</p>
      {action && onClick ? (
        <button type="button" onClick={onClick} className="mt-5 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm">
          {action}
        </button>
      ) : null}
    </div>
  );
}

function formatEmbeddingStatus(document: ResearchDocument) {
  if (document.embeddingStatus === 'embedding') return 'Embedding';
  if (document.embeddingStatus === 'embedded') return 'Embedded';
  if (document.embeddingStatus === 'failed') return 'Failed';
  if (document.embeddingStatus === 'keyword_only') return 'Keyword search only';

  return 'Not embedded';
}

function Upload({
  stateDocuments,
  activeWorkspaceId,
  storageStatus,
  setState,
}: {
  stateDocuments: ResearchDocument[];
  activeWorkspaceId: string;
  storageStatus: ReturnType<typeof useResearchState>['storageStatus'];
  setState: ReturnType<typeof useResearchState>['setState'];
}) {
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [failedUpload, setFailedUpload] = useState<{ file: File; documentId: string; title: string; cleanName: string; type: 'PDF' | 'DOCX' } | null>(null);
  const [note, setNote] = useState('TXT, PDF, and DOCX files are extracted locally and chunked into searchable research context.');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recentUploads = stateDocuments.filter((document) => document.status !== 'Indexed' || document.type === 'TXT' || document.type === 'PDF' || document.type === 'DOCX').slice(0, 4);

  function logUploadError(context: string, error: unknown) {
    if (import.meta.env.DEV) {
      console.error(`[Upload] ${context}`, error);
    }
  }

  function resetUploadFields() {
    setSelectedFile(null);
    setFileName('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function queueEmbeddings(document: ResearchDocument, chunks: DocumentChunk[], readyMessage: string) {
    if (!isSupabaseEnabled || storageStatus !== 'connected') {
      const notEmbeddedDocument: ResearchDocument = {
        ...document,
        embeddingStatus: 'not_embedded',
      };

      setState((current) => ({
        ...current,
        documents: current.documents.map((item) => (item.id === document.id ? notEmbeddedDocument : item)),
      }));
      setNote(`${readyMessage} Not embedded until Supabase is connected.`);
      return;
    }

    const embeddingDocument: ResearchDocument = {
      ...document,
      embeddingStatus: 'embedding',
      embeddingError: undefined,
    };
    const pendingChunks = chunks.map((chunk) => ({
      ...chunk,
      embeddingStatus: 'pending' as const,
      embeddingError: undefined,
    }));

    setState((current) => ({
      ...current,
      documents: current.documents.map((item) => (item.id === document.id ? embeddingDocument : item)),
      chunks: [...pendingChunks, ...current.chunks.filter((chunk) => chunk.documentId !== document.id)],
    }));
    setNote(`${readyMessage} Embedding chunks for semantic search...`);

    try {
      await saveDocument(embeddingDocument);
      await saveChunks(pendingChunks);

      const result = await embedChunks({ documentId: document.id });
      const nextStatus = result.embedded > 0 ? 'embedded' : result.failed > 0 ? 'failed' : 'keyword_only';
      const finalDocument: ResearchDocument = {
        ...embeddingDocument,
        embeddingStatus: nextStatus,
        embeddingError: result.failed > 0 && result.embedded === 0 ? 'Embedding failed. Keyword search remains available.' : undefined,
      };
      const finalChunks = pendingChunks.map((chunk) =>
        chunk.documentId === document.id
          ? {
              ...chunk,
              embeddingStatus: nextStatus === 'embedded' ? ('embedded' as const) : nextStatus === 'failed' ? ('failed' as const) : chunk.embeddingStatus,
            }
          : chunk,
      );

      setState((current) => ({
        ...current,
        documents: current.documents.map((item) => (item.id === document.id ? finalDocument : item)),
        chunks: current.chunks.map((chunk) => finalChunks.find((item) => item.id === chunk.id) ?? chunk),
      }));
      await saveDocument(finalDocument);
      await saveChunks(finalChunks);
      setNote(
        result.embedded > 0
          ? `${readyMessage} Semantic search is ready for ${result.embedded.toLocaleString()} chunks.`
          : `${readyMessage} Keyword search only.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Embedding is unavailable. Keyword search remains available.';
      const keywordOnlyDocument: ResearchDocument = {
        ...embeddingDocument,
        embeddingStatus: 'keyword_only',
        embeddingError: message,
      };
      const failedEmbeddingChunks = pendingChunks.map((chunk) => ({
        ...chunk,
        embeddingStatus: 'failed' as const,
        embeddingError: message,
      }));

      logUploadError('Embedding failed after document upload; keeping keyword search available.', error);
      setState((current) => ({
        ...current,
        documents: current.documents.map((item) => (item.id === document.id ? keywordOnlyDocument : item)),
        chunks: current.chunks.map((chunk) => failedEmbeddingChunks.find((item) => item.id === chunk.id) ?? chunk),
      }));
      await saveDocument(keywordOnlyDocument);
      await saveChunks(failedEmbeddingChunks);
      setNote(`${readyMessage} Keyword search only.`);
    }
  }

  async function processPdfUpload({
    file,
    cleanName,
    title,
    documentId,
  }: {
    file: File;
    cleanName: string;
    title: string;
    documentId: string;
  }) {
    setIsReading(true);
    setFailedUpload(null);

    const processingDocument: ResearchDocument = {
      id: documentId,
      title,
      type: 'PDF',
      workspaceId: activeWorkspaceId,
      authors: 'Local PDF upload',
      addedAt: new Date().toISOString().slice(0, 10),
      status: 'Extracting',
      tags: ['pdf upload'],
      insightCount: 0,
      summary: 'Extracting selectable text from this PDF in your browser.',
    };

    setState((current) => ({
      ...current,
      documents: [processingDocument, ...current.documents.filter((document) => document.id !== documentId)],
      chunks: current.chunks.filter((chunk) => chunk.documentId !== documentId),
    }));
    setNote(`Extracting text from ${cleanName}...`);

    try {
      const extracted = await extractPdfText(file);

      if (extracted.wordCount === 0 || !extracted.text.trim()) {
        throw new Error('No selectable text found. This PDF may be scanned.');
      }

      setState((current) => ({
        ...current,
        documents: current.documents.map((document) =>
          document.id === documentId
            ? {
                ...document,
                status: 'Analysing',
                summary: 'Analysing extracted text, topics, and searchable chunks.',
                pageCount: extracted.pages.length,
                wordCount: extracted.wordCount,
              }
            : document,
        ),
      }));
      setNote(`Analysing ${extracted.wordCount.toLocaleString()} words from ${cleanName}...`);

      const chunks = chunkText({ text: extracted.text, documentId, pages: extracted.pages });

      if (chunks.length === 0) {
        throw new Error('No searchable chunks could be created from this PDF.');
      }

      const tags = extractTopics(extracted.text);
      const readyDocument: ResearchDocument = {
        ...processingDocument,
        status: 'Ready',
        tags: tags.length ? tags : ['pdf upload'],
        summary: summarizeText(extracted.text),
        extractedText: extracted.text,
        pageCount: extracted.pages.length,
        wordCount: extracted.wordCount,
        chunkIds: chunks.map((chunk) => chunk.id),
      };

      setState((current) => ({
        ...current,
        documents: current.documents.map((document) => (document.id === documentId ? readyDocument : document)),
        chunks: [...chunks, ...current.chunks.filter((chunk) => chunk.documentId !== documentId)],
      }));
      const readyMessage = `${cleanName} is ready with ${extracted.pages.length.toLocaleString()} pages, ${extracted.wordCount.toLocaleString()} words, and ${chunks.length} chunks.`;
      setNote(readyMessage);
      resetUploadFields();
      await queueEmbeddings(readyDocument, chunks, readyMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Research OS could not extract text from ${cleanName}. Please try another PDF.`;
      const failedDocument: ResearchDocument = {
        ...processingDocument,
        status: 'Failed',
        tags: ['pdf upload', 'failed'],
        summary: message,
        extractionError: message,
      };

      logUploadError(`PDF upload failed for ${cleanName}.`, error);
      setState((current) => ({
        ...current,
        documents: current.documents.map((document) => (document.id === documentId ? failedDocument : document)),
        chunks: current.chunks.filter((chunk) => chunk.documentId !== documentId),
      }));
      setFailedUpload({ file, documentId, title, cleanName, type: 'PDF' });
      setNote(`${message} You can retry the extraction without selecting the file again.`);
    } finally {
      setIsReading(false);
    }
  }

  async function processDocxUpload({
    file,
    cleanName,
    title,
    documentId,
  }: {
    file: File;
    cleanName: string;
    title: string;
    documentId: string;
  }) {
    setIsReading(true);
    setFailedUpload(null);

    const processingDocument: ResearchDocument = {
      id: documentId,
      title,
      type: 'DOCX',
      workspaceId: activeWorkspaceId,
      authors: 'Local DOCX upload',
      addedAt: new Date().toISOString().slice(0, 10),
      status: 'Extracting',
      tags: ['docx upload'],
      insightCount: 0,
      summary: 'Extracting document text from this DOCX in your browser.',
    };

    setState((current) => ({
      ...current,
      documents: [processingDocument, ...current.documents.filter((document) => document.id !== documentId)],
      chunks: current.chunks.filter((chunk) => chunk.documentId !== documentId),
    }));
    setNote(`Extracting text from ${cleanName}...`);

    try {
      const extracted = await extractDocxText(file);

      if (extracted.wordCount === 0 || !extracted.text.trim()) {
        throw new Error('No readable text found in this DOCX.');
      }

      setState((current) => ({
        ...current,
        documents: current.documents.map((document) =>
          document.id === documentId
            ? {
                ...document,
                status: 'Analysing',
                summary: 'Analysing extracted text, topics, and searchable chunks.',
                wordCount: extracted.wordCount,
              }
            : document,
        ),
      }));
      setNote(`Analysing ${extracted.wordCount.toLocaleString()} words from ${cleanName}...`);

      const chunks = chunkText({ text: extracted.text, documentId });

      if (chunks.length === 0) {
        throw new Error('No searchable chunks could be created from this DOCX.');
      }

      const tags = extractTopics(extracted.text);
      const readyDocument: ResearchDocument = {
        ...processingDocument,
        status: 'Ready',
        tags: tags.length ? tags : ['docx upload'],
        summary: summarizeText(extracted.text),
        extractedText: extracted.text,
        wordCount: extracted.wordCount,
        chunkIds: chunks.map((chunk) => chunk.id),
      };

      setState((current) => ({
        ...current,
        documents: current.documents.map((document) => (document.id === documentId ? readyDocument : document)),
        chunks: [...chunks, ...current.chunks.filter((chunk) => chunk.documentId !== documentId)],
      }));
      const readyMessage = `${cleanName} is ready with ${extracted.wordCount.toLocaleString()} words and ${chunks.length} chunks.`;
      setNote(readyMessage);
      resetUploadFields();
      await queueEmbeddings(readyDocument, chunks, readyMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Research OS could not extract text from ${cleanName}. Please try another DOCX.`;
      const failedDocument: ResearchDocument = {
        ...processingDocument,
        status: 'Failed',
        tags: ['docx upload', 'failed'],
        summary: message,
        extractionError: message,
      };

      logUploadError(`DOCX upload failed for ${cleanName}.`, error);
      setState((current) => ({
        ...current,
        documents: current.documents.map((document) => (document.id === documentId ? failedDocument : document)),
        chunks: current.chunks.filter((chunk) => chunk.documentId !== documentId),
      }));
      setFailedUpload({ file, documentId, title, cleanName, type: 'DOCX' });
      setNote(`${message} You can retry the extraction without selecting the file again.`);
    } finally {
      setIsReading(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      setNote('Choose a TXT, PDF, or DOCX file before uploading.');
      return;
    }

    const cleanName = selectedFile?.name || fileName.trim() || 'Untitled Research Source.pdf';
    const extension = cleanName.split('.').pop()?.toUpperCase();
    const type = extension === 'TXT' || extension === 'DOCX' ? extension : 'PDF';
    const title = cleanName.replace(/\.(pdf|txt|docx)$/i, '').replace(/[-_]/g, ' ');
    const documentId = `doc-${Date.now()}`;

    if (type === 'TXT' && selectedFile) {
      setIsReading(true);

      try {
        const extractedText = await selectedFile.text();
        const wordCount = getWordCount(extractedText);

        if (wordCount === 0 || !extractedText.trim()) {
          throw new Error('No readable text found in this TXT file.');
        }

        const chunks = chunkText({ text: extractedText, documentId });

        if (chunks.length === 0) {
          throw new Error('No searchable chunks could be created from this TXT file.');
        }

        const tags = extractTopics(extractedText);

        const newDocument: ResearchDocument = {
          id: documentId,
          title,
          type,
          workspaceId: activeWorkspaceId,
          authors: 'Local TXT upload',
          addedAt: new Date().toISOString().slice(0, 10),
          status: 'Ready',
          tags: tags.length ? tags : ['txt upload'],
          insightCount: 0,
          summary: summarizeText(extractedText),
          extractedText,
          wordCount,
          chunkIds: chunks.map((chunk) => chunk.id),
        };

        setState((current) => ({
          ...current,
          documents: [newDocument, ...current.documents],
          chunks: [...chunks, ...current.chunks],
        }));
        const readyMessage = `${cleanName} was read locally, saved with ${wordCount.toLocaleString()} words, and split into ${chunks.length} chunks.`;
        setNote(readyMessage);
        await queueEmbeddings(newDocument, chunks, readyMessage);
      } catch (error) {
        const message = error instanceof Error ? error.message : `Research OS could not read ${cleanName}. Please try a plain UTF-8 text file.`;
        const failedDocument: ResearchDocument = {
          id: documentId,
          title,
          type: 'TXT',
          workspaceId: activeWorkspaceId,
          authors: 'Local TXT upload',
          addedAt: new Date().toISOString().slice(0, 10),
          status: 'Failed',
          tags: ['txt upload', 'failed'],
          insightCount: 0,
          summary: message,
          extractionError: message,
        };

        logUploadError(`TXT upload failed for ${cleanName}.`, error);
        setState((current) => ({
          ...current,
          documents: [failedDocument, ...current.documents.filter((document) => document.id !== documentId)],
          chunks: current.chunks.filter((chunk) => chunk.documentId !== documentId),
        }));
        setNote(message);
      } finally {
        setIsReading(false);
        resetUploadFields();
      }

      return;
    }

    if (type === 'PDF' && selectedFile) {
      await processPdfUpload({ file: selectedFile, cleanName, title, documentId });
      return;
    }

    if (type === 'DOCX' && selectedFile) {
      await processDocxUpload({ file: selectedFile, cleanName, title, documentId });
      return;
    }

    setNote('Choose a TXT, PDF, or DOCX file to extract. Research OS no longer creates placeholder documents from a filename alone.');
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-7 xl:grid-cols-[1.35fr_0.65fr]">
      <section>
        <SectionHeader
          eyebrow="Upload"
          title="Add research material"
          copy="Choose a source and let Research OS prepare it for the local library. TXT, PDF, and DOCX extraction stay in your browser."
        />
        <div className="rounded-2xl border border-dashed border-ink/16 bg-white p-5 shadow-sm">
          <div className="grid min-h-[340px] place-items-center rounded-2xl bg-paper/65 px-5 py-10 text-center">
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-ink/8 bg-white text-ink shadow-sm">
                <UploadCloud size={28} />
              </div>
              <h3 className="mt-5 font-serif text-3xl font-semibold text-ink">Place a source on the desk</h3>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-graphite/72">
                Select a TXT, PDF, or DOCX file. Research OS extracts readable text locally, builds topics and summaries, then chunks it for chat.
              </p>
              <div className="mx-auto mt-7 flex max-w-xl flex-col gap-3 sm:flex-row">
                <input
                  value={fileName}
                  onChange={(event) => setFileName(event.target.value)}
                  placeholder="optional-fallback-name.pdf"
                  className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 transition focus:ring-4"
                />
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-graphite shadow-sm transition hover:text-ink">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setSelectedFile(file);
                      setFileName(file?.name ?? fileName);
                    }}
                  />
                  Choose File
                </label>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={isReading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-graphite/55"
                >
                  <FilePlus2 size={18} />
                  {isReading
                    ? 'Processing...'
                    : selectedFile?.name.toLowerCase().endsWith('.txt')
                      ? 'Ingest TXT'
                      : selectedFile?.name.toLowerCase().endsWith('.pdf')
                        ? 'Extract PDF'
                        : selectedFile?.name.toLowerCase().endsWith('.docx')
                          ? 'Extract DOCX'
                          : 'Choose File'}
                </button>
              </div>
              {selectedFile ? <p className="mt-4 text-sm font-medium text-ink">{selectedFile.name}</p> : null}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-ink/8 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">{isReading ? 'Processing' : 'Latest result'}</p>
          <p className="mt-2 text-sm leading-7 text-graphite/74">{note}</p>
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="After upload" title="Recent intake" />
        <div className="space-y-4">
          {recentUploads.length ? (
            recentUploads.map((document) => (
            <div key={document.id} className="rounded-2xl border border-ink/8 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{document.title}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-7 text-graphite/72">{document.summary}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">
                    {[
                      document.status,
                      document.pageCount ? `${document.pageCount.toLocaleString()} pages` : null,
                      document.wordCount ? `${document.wordCount.toLocaleString()} words` : null,
                      document.chunkIds?.length ? `${document.chunkIds.length.toLocaleString()} chunks` : null,
                      formatEmbeddingStatus(document),
                    ]
                      .filter(Boolean)
                      .join(' / ')}
                  </p>
                  {document.status === 'Failed' && failedUpload?.documentId === document.id ? (
                    <button
                      type="button"
                      onClick={() =>
                        failedUpload.type === 'PDF'
                          ? processPdfUpload(failedUpload)
                          : processDocxUpload(failedUpload)
                      }
                      disabled={isReading}
                      className="mt-3 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-graphite/55"
                    >
                      Retry extraction
                    </button>
                  ) : null}
                </div>
                <Clock3 className="shrink-0 text-graphite/45" size={20} />
              </div>
            </div>
            ))
          ) : (
            <EmptyState title="Nothing waiting" copy="Completed uploads and extraction attempts will appear here." />
          )}
        </div>
      </section>
    </div>
  );
}

function formatChunkLocation(result: RetrievedChunk) {
  if (result.pageStart && result.pageEnd) {
    return result.pageStart === result.pageEnd ? `p. ${result.pageStart}` : `pp. ${result.pageStart}-${result.pageEnd}`;
  }

  return `chunk ${result.chunk.chunkIndex + 1}`;
}

function buildResearchChatContext(results: RetrievedChunk[]) {
  return results.map((result) => ({
    title: result.document.title,
    location: formatChunkLocation(result),
    pageStart: result.pageStart,
    pageEnd: result.pageEnd,
    summary: result.document.summary,
    topics: result.document.tags,
    extractedText: result.chunk.text,
    matchedTerms: result.matchedTerms,
  }));
}

function semanticMatchesToRetrievedChunks(matches: SemanticSearchMatch[], documents: ResearchDocument[]): RetrievedChunk[] {
  const documentById = new Map(documents.map((document) => [document.id, document]));

  return matches.map((match, index) => {
    const document =
      documentById.get(match.documentId) ??
      ({
        id: match.documentId,
        title: match.documentTitle || 'Untitled source',
        type: match.documentType === 'TXT' || match.documentType === 'DOCX' ? match.documentType : 'PDF',
        workspaceId: '',
        authors: 'Supabase semantic search',
        addedAt: '',
        status: 'Ready',
        tags: [],
        insightCount: 0,
        summary: '',
      } satisfies ResearchDocument);
    const chunk: DocumentChunk = {
      id: match.id,
      documentId: match.documentId,
      chunkIndex: index,
      text: match.text,
      wordCount: match.text.trim().split(/\s+/).filter(Boolean).length,
      pageStart: match.pageStart,
      pageEnd: match.pageEnd,
      createdAt: '',
      embeddingStatus: 'embedded',
    };

    return {
      chunk,
      document,
      score: match.similarity,
      matchedTerms: [],
      reason: 'semantic similarity',
      pageStart: match.pageStart,
      pageEnd: match.pageEnd,
    };
  });
}

function ResearchChat({
  chat,
  workspaceName,
  workspaceId,
  documents,
  chunks,
  setState,
}: {
  chat: ChatMessage[];
  workspaceName: string;
  workspaceId: string;
  documents: ResearchDocument[];
  chunks: DocumentChunk[];
  setState: ReturnType<typeof useResearchState>['setState'];
}) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const latestCitations = [...chat].reverse().find((message) => message.citations?.length)?.citations ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.length, isLoading]);

  async function sendMessage() {
    const question = prompt.trim();

    if (!question || isLoading) return;

    const userMessage: ChatMessage = {
      id: `chat-${Date.now()}-user`,
      role: 'user',
      content: question,
    };

    setErrorMessage('');
    setIsLoading(true);
    setState((current) => ({ ...current, chat: [...current.chat, userMessage] }));
    setPrompt('');

    try {
      let retrievedChunks: RetrievedChunk[] = [];
      let retrievalMode: 'semantic' | 'keyword' = 'keyword';

      if (isSupabaseEnabled) {
        try {
          const semanticResult = await semanticSearch({ query: question, workspaceId, matchCount: 6 });
          const semanticChunks = semanticMatchesToRetrievedChunks(semanticResult.matches, documents);
          const semanticLowConfidence = semanticChunks.length === 0 || (semanticChunks[0]?.score ?? 0) < 0.68;

          if (!semanticLowConfidence) {
            retrievedChunks = semanticChunks;
            retrievalMode = 'semantic';
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.debug('Semantic retrieval unavailable; falling back to keyword retrieval.', error);
          }
        }
      }

      if (retrievedChunks.length === 0) {
        retrievedChunks = retrieveChunks(question, chunks, documents);
      }

      const lowConfidence =
        retrievedChunks.length === 0 || (retrievalMode === 'semantic' ? (retrievedChunks[0]?.score ?? 0) < 0.68 : (retrievedChunks[0]?.score ?? 0) < 4);

      if (import.meta.env.DEV) {
        console.debug(
          'Research chat retrieval',
          retrievedChunks.map((result) => ({
            mode: retrievalMode,
            document: result.document.title,
            location: formatChunkLocation(result),
            score: Number(result.score.toFixed(2)),
            matchedTerms: result.matchedTerms,
            reason: result.reason,
          })),
        );
      }

      const response = await askResearchChat({
        question,
        workspaceName,
        documents: buildResearchChatContext(retrievedChunks),
      });

      const assistantMessage: ChatMessage = {
        id: `chat-${Date.now()}-assistant`,
        role: 'assistant',
        content: lowConfidence
          ? `I found limited direct evidence in your documents, so this answer may be incomplete.\n\n${response.answer}`
          : response.answer,
        citations: retrievedChunks.length
          ? retrievedChunks.map((result) => ({
              documentTitle: result.document.title,
              location: formatChunkLocation(result),
              excerpt: result.chunk.text.slice(0, 260),
              matchedTerms: result.matchedTerms,
              score: result.score,
              reason: result.reason,
            }))
          : response.sources.map((source) => ({
              documentTitle: source.documentTitle,
              location: source.location,
              excerpt: source.excerpt,
              matchedTerms: source.matchedTerms,
              score: source.score,
              reason: source.reason,
            })),
      };

      setState((current) => ({ ...current, chat: [...current.chat, assistantMessage] }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Research chat failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto grid h-[calc(100vh-23rem)] min-h-[420px] max-w-7xl gap-5 sm:h-[calc(100vh-12rem)] sm:min-h-[480px] xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm">
        <div className="shrink-0 border-b border-ink/8 p-5">
          <SectionHeader eyebrow="Research chat" title="Ask with sources" copy="A fixed research conversation area with source material kept close, but out of the way." />
        </div>
        <div className="scrollbar-soft min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {chat.length ? (
            chat.map((message) => (
              <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[70ch]' : 'mr-auto max-w-[78ch]'}>
                <div className={`rounded-2xl p-5 ${message.role === 'user' ? 'bg-ink text-white' : 'border border-ink/8 bg-paper/70 text-ink'}`}>
                  <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                </div>
                {message.citations ? (
                  <details className="mt-3 rounded-2xl border border-ink/8 bg-white p-3 xl:hidden">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">
                      {message.citations.length} sources
                    </summary>
                    <div className="mt-3 space-y-3">
                      {message.citations.map((citation) => (
                        <CitationCard key={`${message.id}-${citation.documentTitle}-${citation.location}`} citation={citation} />
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState
              title="Chat is ready when your sources are"
              copy="You can ask a question now, but answers become more grounded after you upload TXT, PDF, or DOCX documents to this workspace."
            />
          )}
          {isLoading ? (
            <div className="mr-auto max-w-[820px]">
              <div className="rounded-2xl border border-ink/8 bg-paper/70 p-5 text-ink">
                <div className="flex items-center gap-3 text-sm font-semibold text-graphite/72">
                  <span className="size-2 animate-pulse rounded-full bg-brass" />
                  <span className="size-2 animate-pulse rounded-full bg-brass [animation-delay:120ms]" />
                  <span className="size-2 animate-pulse rounded-full bg-brass [animation-delay:240ms]" />
                  <span className="ml-1">Reading workspace sources...</span>
                </div>
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
        <div className="shrink-0 border-t border-ink/8 bg-white p-4">
          {errorMessage ? (
            <div className="mb-3 rounded-xl border border-brass/20 bg-brass/10 px-4 py-3 text-sm font-semibold text-graphite">
              Research chat could not answer right now. {errorMessage}
            </div>
          ) : null}
          <div className="flex gap-3">
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendMessage();
              }}
              disabled={isLoading}
              placeholder="Ask about claims, contradictions, methods, or gaps..."
              className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 transition focus:ring-4 disabled:cursor-not-allowed disabled:bg-paper"
            />
            <button
              type="button"
              aria-label="Send research question"
              title="Send research question"
              onClick={sendMessage}
              disabled={isLoading}
              className="grid size-12 place-items-center rounded-xl bg-ink text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-graphite/55"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </section>

      <aside className="hidden min-h-0 overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm xl:flex xl:flex-col">
        <div className="shrink-0 border-b border-ink/8 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Sources</p>
          <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">Latest citations</h3>
        </div>
        <div className="scrollbar-soft min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {documents.length ? (
            latestCitations.length ? (
            latestCitations.map((citation) => <CitationCard key={`${citation.documentTitle}-${citation.location}`} citation={citation} />)
            ) : (
            <p className="rounded-2xl bg-paper/70 p-4 text-sm leading-7 text-graphite/70">
              Source cards will appear here after the assistant answers with citations.
            </p>
            )
          ) : (
            <p className="rounded-2xl bg-paper/70 p-4 text-sm leading-7 text-graphite/70">
              Upload documents to give research chat source material for grounded answers.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function StudyTools({ documents }: { documents: ResearchDocument[] }) {
  const [activeTool, setActiveTool] = useState('Summary');
  const tools = [
    { label: 'Summary', icon: Sparkles },
    { label: 'Flashcards', icon: BrainCircuit },
    { label: 'Essay Plan', icon: LibraryBig },
    { label: 'Quiz', icon: CheckCircle2 },
    { label: 'Timeline', icon: CalendarDays },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader
        eyebrow="Study tools"
        title="Turn sources into learning assets"
        copy="Choose a workflow and keep the source context visible. These controls remain presentation-only until generation is added."
      />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.label}
                type="button"
                onClick={() => setActiveTool(tool.label)}
                className={`flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition ${
                  activeTool === tool.label ? 'border-ink/14 bg-paper text-ink shadow-sm' : 'border-ink/8 bg-white text-ink shadow-sm hover:border-ink/14'
                }`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-ink/8 bg-white text-graphite">
                  <Icon size={20} />
                </span>
                <span>
                  <span className="block font-semibold">{tool.label}</span>
                  <span className="mt-1 block text-sm leading-6 text-graphite/70">
                    {tool.label === 'Summary'
                      ? 'Condense a source set into durable notes.'
                      : tool.label === 'Flashcards'
                        ? 'Review terms, claims, and definitions.'
                        : tool.label === 'Essay Plan'
                          ? 'Shape an argument before drafting.'
                          : tool.label === 'Quiz'
                            ? 'Check recall and comprehension.'
                            : 'Sequence people, papers, and events.'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="rounded-2xl border border-ink/8 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Workflow preview</p>
          <h3 className="mt-3 font-serif text-4xl font-semibold text-ink">{activeTool}</h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-graphite/72">
            {documents.length
              ? `${activeTool} output would be generated from ${documents.length} workspace sources. This preview keeps the interaction model visible while generation is still intentionally absent.`
              : 'Upload or select documents before generating study outputs. Your summaries, flashcards, essay plans, quizzes, and timelines will be based on real workspace sources.'}
          </p>
          <div className="mt-7 space-y-3">
            {documents.length ? (
              documents.slice(0, 4).map((document) => (
                <div key={document.id} className="rounded-xl border border-ink/8 bg-paper/65 p-4">
                  <p className="font-semibold text-ink">{document.title}</p>
                  <p className="mt-2 line-clamp-2 text-sm leading-7 text-graphite/72">{document.summary}</p>
                </div>
              ))
            ) : (
              <EmptyState title="No source set selected" copy="Add a document to this workspace before generating study material." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KnowledgeMap({ documents }: { documents: ResearchDocument[] }) {
  const mapNodes = useMemo<MapNode[]>(() => {
    const topics = [...new Set(documents.flatMap((document) => document.tags).filter((tag) => !tag.includes('upload') && tag !== 'failed'))].slice(0, 6);

    return topics.map((topic, index) => {
      const positions = [
        { x: 48, y: 44, size: 90, tone: 'moss' },
        { x: 24, y: 26, size: 72, tone: 'brass' },
        { x: 68, y: 24, size: 78, tone: 'graphite' },
        { x: 72, y: 66, size: 74, tone: 'brass' },
        { x: 30, y: 70, size: 68, tone: 'ink' },
        { x: 50, y: 82, size: 58, tone: 'moss' },
      ] as const;
      const position = positions[index];

      return {
        id: `topic-${topic}`,
        label: topic,
        ...position,
      };
    });
  }, [documents]);
  const mapEdges = useMemo<MapEdge[]>(() => mapNodes.slice(1).map((node) => ({ from: mapNodes[0].id, to: node.id })), [mapNodes]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const nodeById = Object.fromEntries(mapNodes.map((node) => [node.id, node]));
  const selectedNode = nodeById[selectedNodeId] ?? mapNodes[0];
  const toneClasses = {
    moss: 'bg-white text-ink border-moss/35',
    brass: 'bg-white text-ink border-brass/35',
    graphite: 'bg-white text-ink border-graphite/30',
    ink: 'bg-ink text-white border-ink',
  };

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader
        eyebrow="Knowledge map"
        title="Connected topic graph"
        copy="A quieter map of relationships across the active research area. Topic nodes appear after documents have been extracted."
      />
      {mapNodes.length === 0 ? (
        <EmptyState title="No knowledge map yet" copy="Upload documents with readable text and Research OS will use their topics to start a workspace map." />
      ) : (
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="relative min-h-[560px] overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {mapEdges.map((edge) => {
              const from = nodeById[edge.from];
              const to = nodeById[edge.to];
              if (!from || !to) return null;
              return <line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(68,81,94,0.18)" strokeWidth="0.28" />;
            })}
          </svg>
          <div className="absolute left-5 top-5 z-10 rounded-xl border border-ink/8 bg-paper/80 px-4 py-3 text-ink">
            <div className="flex items-center gap-2">
              <Network size={18} />
              <span className="text-sm font-semibold">
                {mapNodes.length} topics / {mapEdges.length} links
              </span>
            </div>
          </div>
          {mapNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedNodeId(node.id)}
              className={`absolute z-20 grid place-items-center rounded-full border px-4 text-center text-sm font-semibold leading-tight shadow-sm transition hover:scale-[1.02] ${toneClasses[node.tone]} ${
                selectedNodeId === node.id ? 'ring-4 ring-ink/8' : ''
              }`}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                width: node.size,
                height: node.size,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {node.label}
            </button>
          ))}
        </div>
        <aside className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">
            <Tags size={14} />
            Selected node
          </p>
          <h3 className="mt-3 font-serif text-3xl font-semibold text-ink">{selectedNode?.label}</h3>
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Cluster</p>
              <p className="mt-2 text-sm font-semibold text-ink">Workspace topics</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Strongest bridge</p>
              <p className="mt-2 text-sm leading-7 text-graphite/72">Shared source tags from extracted documents</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Next useful action</p>
              <p className="mt-2 text-sm leading-7 text-graphite/72">Ask research chat for evidence connected to this topic.</p>
            </div>
          </div>
        </aside>
      </div>
      )}
    </div>
  );
}

export default App;
