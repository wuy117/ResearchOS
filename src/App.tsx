import {
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Edit3,
  FilePlus2,
  LibraryBig,
  Network,
  MessageSquareText,
  Trash2,
  Send,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { AppShell } from './components/AppShell';
import { AuthGate } from './components/AuthGate';
import { CitationCard } from './components/CitationCard';
import { DocumentCard, SourceArchiveCard } from './components/DocumentCard';
import { SectionHeader } from './components/SectionHeader';
import { TutorPage } from './components/TutorPage';
import { useAuth } from './hooks/useAuth';
import { useResearchState } from './hooks/useResearchState';
import { isSupabaseEnabled } from './lib/supabase';
import { deleteSupabaseRows, saveChunks, saveDocument, saveState } from './services/researchStore';
import type { AcademicTerm, AssessmentType, ChatMessage, DocumentCategory, DocumentChunk, DocumentMetadata, ExtractionConfidence, ExtractionFieldConfidence, ExtractionSummary, MapEdge, MapNode, OriginalDocumentSnapshot, PageId, PerformanceDomain, PerformanceRecord, PerformanceSummary, ResearchDocument, ResearchState, TutorAttempt, TutorLesson, TutorMemory } from './types/research';
import { analyseDocumentMetadata, analysePerformanceDocument, askResearchChat, embedChunks, generatePerformanceAdvice, semanticSearch, setApiAccessTokenProvider, type DocumentMetadataAnalysisResponse, type PerformanceAdviceResponse, type PerformanceAnalysisRecord, type SemanticSearchMatch } from './utils/api';
import { chunkText, extractTopics, getWordCount, summarizeText } from './utils/chunkText';
import { extractDocxText } from './utils/extractDocxText';
import { extractImageText, isSupportedImageFile } from './utils/extractImageText';
import { extractPdfText } from './utils/extractPdfText';
import { buildDocumentMetadata, buildTimelineEvents, deriveCollections, getDocumentMetadata, type TimelineEvent } from './utils/learningModel';
import { retrieveChunks, type RetrievedChunk } from './utils/retrieveChunks';

class AuthenticatedAppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Authenticated Research OS crashed.', error, errorInfo);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center bg-ivory px-4 text-ink">
          <section className="surface-raised w-full max-w-lg p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass">Unable to open workspace</p>
            <h1 className="mt-3 font-serif text-3xl font-semibold text-ink">Research OS could not open this workspace.</h1>
            <p className="mt-4 text-sm leading-7 text-graphite/80">
              Your data is safe. Reload the workspace, or sign out and back in if the problem continues.
            </p>
            <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-graphite">
              Reload workspace
            </button>
            {import.meta.env.DEV ? <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-paper p-3 text-xs text-graphite/80">{this.state.error.message}</pre> : null}
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const auth = useAuth();
  const userId = auth.currentUser?.id ?? null;
  const { state, setState, storageStatus, claimableLocalState, dismissClaimableLocalState } = useResearchState(userId);
  const [activePage, setActivePage] = useState<PageId>('dashboard');

  useEffect(() => {
    setApiAccessTokenProvider(() => auth.session?.access_token);
    return () => setApiAccessTokenProvider(null);
  }, [auth.session?.access_token]);

  const workspaceDocuments = useMemo(
    () => state.documents.filter((document) => document.workspaceId === state.activeWorkspaceId),
    [state.activeWorkspaceId, state.documents],
  );
  const activeWorkspaceName = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.name ?? 'Research workspace';

  if (isSupabaseEnabled && (auth.authLoading || storageStatus === 'client-created')) {
    return (
      <div className="grid min-h-screen place-items-center bg-ivory px-4 text-ink">
        <div role="status" className="status-strip inline-flex items-center gap-3 px-4 py-3 text-sm font-semibold text-graphite/80">
          <span className="size-2 animate-pulse rounded-full bg-moss" />
          Opening your workspace…
        </div>
      </div>
    );
  }

  if (isSupabaseEnabled && !auth.currentUser) {
    return <AuthGate authLoading={auth.authLoading} authError={auth.authError} onSignIn={auth.signIn} onSignUp={auth.signUp} />;
  }

  const page = {
    dashboard: <Dashboard state={state} documents={workspaceDocuments} setActivePage={setActivePage} />,
    settings: null,
    library: <Library state={state} documents={workspaceDocuments} chunks={state.chunks} storageStatus={storageStatus} userId={userId} setState={setState} />,
    performance: <PerformancePage records={state.performanceRecords} summaries={state.performanceSummaries} documents={state.documents} tutorLessons={state.tutorLessons} tutorAttempts={state.tutorAttempts} tutorMemory={state.tutorMemory} storageStatus={storageStatus} userId={userId} setState={setState} />,
    timeline: <TimelinePage events={buildTimelineEvents(state)} />,
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
        storageStatus={storageStatus}
        userId={userId}
        setState={setState}
      />
    ),
    upload: <Upload activeWorkspaceId={state.activeWorkspaceId} storageStatus={storageStatus} performanceRecords={state.performanceRecords} userId={userId} setState={setState} />,
    chat: <ResearchChat chat={state.chat} workspaceName={activeWorkspaceName} workspaceId={state.activeWorkspaceId} documents={workspaceDocuments} chunks={state.chunks} performanceRecords={state.performanceRecords} performanceSummaries={state.performanceSummaries} tutorLessons={state.tutorLessons} tutorAttempts={state.tutorAttempts} storageStatus={storageStatus} userId={userId} setState={setState} />,
    study: <StudyTools documents={workspaceDocuments} />,
    map: <KnowledgeMap documents={workspaceDocuments} />,
  }[activePage];

  async function importClaimableLocalData() {
    if (!claimableLocalState || !userId) return;
    const merged = mergeImportedLocalState(state, claimableLocalState, userId);
    setState(merged);
    await saveState(merged, { userId });
    dismissClaimableLocalState();
  }

  return (
    <AuthenticatedAppErrorBoundary>
      <AppShell
        state={state}
        activePage={activePage}
        setActivePage={setActivePage}
        setState={setState}
        storageStatus={storageStatus}
        user={auth.currentUser}
        onSignOut={auth.signOut}
        claimableLocalState={claimableLocalState}
        onImportClaimableLocalData={importClaimableLocalData}
        onDismissClaimableLocalData={dismissClaimableLocalState}
      >
        {page}
      </AppShell>
    </AuthenticatedAppErrorBoundary>
  );
}

function markOwned<T extends { id: string; userId?: string }>(items: T[], userId: string): T[] {
  return items.map((item) => ({ ...item, userId }));
}

function mergeById<T extends { id: string; userId?: string }>(remoteItems: T[], localItems: T[], userId: string): T[] {
  const remoteIds = new Set(remoteItems.map((item) => item.id));
  return [...markOwned(remoteItems, userId), ...markOwned(localItems.filter((item) => !remoteIds.has(item.id)), userId)];
}

function mergeImportedLocalState(remoteState: ResearchState, localState: ResearchState, userId: string): ResearchState {
  const workspaces = mergeById(remoteState.workspaces, localState.workspaces, userId);
  const activeWorkspaceId = workspaces.some((workspace) => workspace.id === remoteState.activeWorkspaceId)
    ? remoteState.activeWorkspaceId
    : workspaces[0]?.id ?? remoteState.activeWorkspaceId;

  return withDerivedCollections({
    ...remoteState,
    workspaces,
    activeWorkspaceId,
    collections: mergeById(remoteState.collections, localState.collections, userId),
    documents: mergeById(remoteState.documents, localState.documents, userId),
    chunks: mergeById(remoteState.chunks, localState.chunks, userId),
    insights: mergeById(remoteState.insights, localState.insights, userId),
    chat: mergeById(remoteState.chat, localState.chat, userId),
    performanceRecords: mergeById(remoteState.performanceRecords, localState.performanceRecords, userId),
    performanceSummaries: mergeById(remoteState.performanceSummaries, localState.performanceSummaries, userId),
    tutorLessons: mergeById(remoteState.tutorLessons, localState.tutorLessons, userId),
    tutorAttempts: mergeById(remoteState.tutorAttempts, localState.tutorAttempts, userId),
    tutorSocraticTurns: mergeById(remoteState.tutorSocraticTurns, localState.tutorSocraticTurns, userId),
    tutorExamSessions: mergeById(remoteState.tutorExamSessions, localState.tutorExamSessions, userId),
    tutorMemory: {
      ...localState.tutorMemory,
      ...remoteState.tutorMemory,
      userId,
      lessonsCompleted: Math.max(remoteState.tutorMemory.lessonsCompleted ?? 0, localState.tutorMemory.lessonsCompleted ?? 0),
      topicsStudied: mergeTutorTopics(remoteState.tutorMemory.topicsStudied ?? [], localState.tutorMemory.topicsStudied ?? []),
      revisionStreak: Math.max(remoteState.tutorMemory.revisionStreak ?? 0, localState.tutorMemory.revisionStreak ?? 0),
      lastReviewed: remoteState.tutorMemory.lastReviewed ?? localState.tutorMemory.lastReviewed,
    },
  });
}

function mergeTutorTopics(remoteTopics: TutorMemory['topicsStudied'], localTopics: TutorMemory['topicsStudied']) {
  const topics = new Map(remoteTopics.map((topic) => [topic.topic.toLowerCase(), topic]));
  for (const topic of localTopics) {
    const key = topic.topic.toLowerCase();
    const existing = topics.get(key);
    if (!existing) {
      topics.set(key, topic);
      continue;
    }
    topics.set(key, {
      ...existing,
      confidence: Math.max(existing.confidence, topic.confidence),
      quizAccuracy: Math.max(existing.quizAccuracy, topic.quizAccuracy),
      lessonsCompleted: Math.max(existing.lessonsCompleted, topic.lessonsCompleted),
      attempts: Math.max(existing.attempts, topic.attempts),
      correctAttempts: Math.max(existing.correctAttempts, topic.correctAttempts),
      lastReviewed: existing.lastReviewed > topic.lastReviewed ? existing.lastReviewed : topic.lastReviewed,
    });
  }
  return [...topics.values()];
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
  const newestDocuments = [...documents].slice(0, 3);
  const timeline = buildTimelineEvents(state).slice(0, 5);
  const academicPerformanceRecords = getAcademicPerformanceRecords(state.performanceRecords);
  const subjects = [
    ...new Set([
      ...documents.flatMap((document) => getDocumentMetadata(document, state.performanceRecords).subjects),
      ...academicPerformanceRecords.map((record) => record.subject),
    ]),
  ].slice(0, 8);
  const activeLesson = state.tutorLessons.find((lesson) => lesson.status === 'in_progress') ?? state.tutorLessons[0];
  const weakTopics = [
    ...new Set(
      academicPerformanceRecords
        .flatMap((record) => [...record.weaknesses, ...record.actionPoints])
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, 4);
  const hasDocuments = documents.length > 0;
  const hasReadySources = readyCount > 0;
  const hasTimeline = timeline.length > 0;
  const hasSubjects = subjects.length > 0;
  const hasPerformance = academicPerformanceRecords.length > 0;
  const latestTimelineEvent = timeline[0];
  const earlierTimelineEvents = timeline.slice(1);
  const sourcesNeedingAttention = Math.max(0, documents.length - readyCount);
  const nextAction = !hasDocuments
    ? { label: 'Upload first source', page: 'upload' as PageId, detail: 'Start with a report, notes file, exam paper, or source document.' }
    : weakTopics.length
      ? { label: 'Practise weak topic', page: 'tutor' as PageId, detail: `Start a focused Tutor session on ${weakTopics[0]}.` }
      : activeLesson
        ? { label: 'Continue Tutor', page: 'tutor' as PageId, detail: activeLesson.objective }
        : { label: 'Ask your sources', page: 'chat' as PageId, detail: 'Use your saved sources, reports, and feedback to answer a study question.' };

  return (
    <div className="home-command mx-auto max-w-7xl space-y-12 sm:space-y-16">
      <section className="home-command-hero overflow-hidden">
        <div className="home-command-hero__primary">
          <p className="home-command-kicker text-xs font-semibold uppercase tracking-[0.14em]">Academic profile</p>
          <h2 className="home-command-title mt-4 max-w-4xl font-serif text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            {hasReadySources ? `${readyCount} source${readyCount === 1 ? ' is' : 's are'} ready to study.` : 'Start with one source.'}
          </h2>
          <p className="home-command-summary mt-5 max-w-2xl text-sm leading-7 sm:text-base">
            {hasReadySources
              ? 'Use your reports, notes, and assessments to ask questions, study a topic, or review progress.'
              : hasDocuments
                ? 'One source needs attention before it can support learning.'
                : 'Upload your first report to begin tracking academic progress.'}
          </p>

          <dl className="home-state-ledger mt-9 grid grid-cols-3 gap-4" aria-label="Academic workspace status">
            <div className="home-state-ledger__item">
              <dt className="home-state-ledger__label text-xs font-semibold uppercase tracking-[0.12em]">Ready sources</dt>
              <dd className="home-state-ledger__value mt-2 text-2xl font-semibold sm:text-3xl">{readyCount}</dd>
            </div>
            <div className="home-state-ledger__item">
              <dt className="home-state-ledger__label text-xs font-semibold uppercase tracking-[0.12em]">Subjects</dt>
              <dd className="home-state-ledger__value mt-2 text-2xl font-semibold sm:text-3xl">{subjects.length}</dd>
            </div>
            <div className="home-state-ledger__item">
              <dt className="home-state-ledger__label text-xs font-semibold uppercase tracking-[0.12em]">Academic records</dt>
              <dd className="home-state-ledger__value mt-2 text-2xl font-semibold sm:text-3xl">{academicPerformanceRecords.length}</dd>
            </div>
          </dl>

          <div className="home-next-action mt-10">
            <div className="home-next-action__copy">
              <p className="home-next-action__label text-xs font-semibold uppercase tracking-[0.14em]">Next action</p>
              <p className="home-next-action__detail mt-2 max-w-xl text-sm leading-6">{nextAction.detail}</p>
            </div>
            <button type="button" onClick={() => setActivePage(nextAction.page)} className="home-next-action__button inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold">
              {nextAction.label}
              <ArrowRight size={17} />
            </button>
          </div>
        </div>

        <aside className="home-command-rail">
          <div className="home-signal home-signal--recent">
            <p className="home-signal__eyebrow text-xs font-semibold uppercase tracking-[0.14em]">Changed recently</p>
            {latestTimelineEvent ? (
              <div className="home-signal__content mt-3">
                <TimelineRow event={latestTimelineEvent} compact />
              </div>
            ) : (
              <p className="home-signal__empty mt-3 text-sm leading-6">No academic activity has been recorded yet.</p>
            )}
            {hasTimeline ? (
              <button type="button" onClick={() => setActivePage('timeline')} className="home-signal__link mt-3 inline-flex items-center gap-2 text-sm font-semibold">
                View timeline
                <ArrowRight size={15} />
              </button>
            ) : null}
          </div>

          <div className="home-signal home-signal--attention">
            <p className="home-signal__eyebrow text-xs font-semibold uppercase tracking-[0.14em]">Needs attention</p>
            {hasDocuments && hasPerformance && weakTopics.length ? (
              <div className="home-signal__content mt-4">
                <TagList label="Priority themes" items={weakTopics} />
              </div>
            ) : sourcesNeedingAttention > 0 ? (
              <>
                <h3 className="home-signal__title mt-3 text-lg font-semibold">Source readiness</h3>
                <p className="home-signal__detail mt-2 text-sm leading-6">
                  {sourcesNeedingAttention} source{sourcesNeedingAttention === 1 ? ' needs' : 's need'} attention before {sourcesNeedingAttention === 1 ? 'it' : 'they'} can support learning.
                </p>
              </>
            ) : !hasDocuments ? (
              <>
                <h3 className="home-signal__title mt-3 text-lg font-semibold">Academic picture</h3>
                <p className="home-signal__detail mt-2 text-sm leading-6">Your first source will establish the evidence for this workspace.</p>
              </>
            ) : (
              <>
                <h3 className="home-signal__title mt-3 text-lg font-semibold">No priority theme yet</h3>
                <p className="home-signal__detail mt-2 text-sm leading-6">No recurring weakness has been identified in your academic records.</p>
              </>
            )}
          </div>
        </aside>
      </section>

      {(hasDocuments && hasPerformance) || hasSubjects ? (
        <section className={`home-section home-section--academic grid gap-8 ${hasDocuments && hasPerformance && hasSubjects ? 'xl:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.55fr)]' : ''}`}>
          {hasDocuments && hasPerformance ? (
            <div className="home-section__primary home-progress-field">
              <SectionHeader eyebrow="Performance" title="Progress overview" />
              <div className="home-progress-field__content mt-5">
                <TrendChart records={academicPerformanceRecords} documents={documents} selectedSubject="All Subjects" />
              </div>
            </div>
          ) : null}

          {hasSubjects ? (
            <aside className={`${hasDocuments && hasPerformance ? 'home-section__secondary' : 'home-section__primary'} home-subject-field`}>
              <SectionHeader eyebrow="Subjects" title="What am I studying?" />
              <div className="home-subject-field__content mt-5">
                <ChipCloud items={subjects} />
              </div>
            </aside>
          ) : null}
        </section>
      ) : null}

      {hasDocuments || earlierTimelineEvents.length ? (
        <section className={`home-section home-section--activity grid gap-8 ${hasDocuments && earlierTimelineEvents.length ? 'xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]' : 'home-section--solo'}`}>
          {hasDocuments ? (
            <div className="home-section__primary home-source-stream">
              <SectionHeader eyebrow="Recent uploads" title="Recent sources" />
              <div className="home-source-stream__content mt-5 space-y-4">
                {newestDocuments.map((document) => <DocumentCard key={document.id} document={document} records={state.performanceRecords} />)}
              </div>
            </div>
          ) : null}

          {earlierTimelineEvents.length ? (
            <aside className={`${hasDocuments ? 'home-section__secondary' : 'home-section__primary'} home-activity-stream`}>
              <SectionHeader eyebrow="Continue" title="Recent activity" />
              <div className="home-activity-stream__content mt-2 space-y-1">
                {earlierTimelineEvents.map((event) => <TimelineRow key={event.id} event={event} compact />)}
              </div>
            </aside>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Library({
  state,
  documents,
  chunks,
  storageStatus,
  userId,
  setState,
}: {
  state: ReturnType<typeof useResearchState>['state'];
  documents: ResearchDocument[];
  chunks: DocumentChunk[];
  storageStatus: ReturnType<typeof useResearchState>['storageStatus'];
  userId?: string | null;
  setState: ReturnType<typeof useResearchState>['setState'];
}) {
  const [message, setMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    subject: 'All',
    academicYear: 'All',
    term: 'All',
    assessmentType: 'All',
    teacher: 'All',
    documentType: 'All',
  });
  const filterOptions = useMemo(() => buildSourceFilterOptions(documents, state.performanceRecords), [documents, state.performanceRecords]);
  const filteredDocuments = useMemo(() => documents.filter((document) => documentMatchesSourceFilters(document, state.performanceRecords, filters)), [documents, filters, state.performanceRecords]);
  const hasActiveFilters = Object.values(filters).some((value) => value !== 'All');
  const activeFilterCount = Object.values(filters).filter((value) => value !== 'All').length;

  function updateFilter(field: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    setFilters({
      subject: 'All',
      academicYear: 'All',
      term: 'All',
      assessmentType: 'All',
      teacher: 'All',
      documentType: 'All',
    });
  }

  async function deleteDocument(document: ResearchDocument) {
    try {
      await deleteRemoteDocumentIfNeeded(state, document.id, storageStatus, userId);
      setState((current) => removeDocumentFromState(current, document.id));
      setMessage(`${document.title} was deleted.`);
    } catch (error) {
      setMessage('Document was not deleted. Check your connection and try again.');
    }
  }

  return (
    <div className="sources-page mx-auto max-w-7xl space-y-10">
      <div className="sources-page__header max-w-5xl">
        <SectionHeader
          eyebrow="Research context"
          title="Sources"
          copy="Your reports, assessments, notes, and papers — organised around what they mean for your learning."
          compact
        />
      </div>
      {message ? <StatusNote message={message} /> : null}
      {documents.length ? (
        <section className="sources-filter-rail border-y border-ink/[0.055] py-6">
          <div className="sources-filter-rail__header flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-graphite/80">Filter sources</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium tabular-nums text-graphite/80">
                {filteredDocuments.length} of {documents.length} document{documents.length === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                aria-expanded={mobileFiltersOpen}
                onClick={() => setMobileFiltersOpen((value) => !value)}
                className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-ink shadow-sm ring-1 ring-ink/[0.07] md:hidden"
              >
                {mobileFiltersOpen ? 'Hide filters' : `Filters${activeFilterCount ? ` · ${activeFilterCount}` : ''}`}
              </button>
            </div>
          </div>
          <div className={`sources-filter-grid ${mobileFiltersOpen ? 'grid' : 'hidden'} mt-5 gap-x-4 gap-y-4 md:grid md:grid-cols-2 xl:grid-cols-3`}>
            <SourceFilter label="Subject" value={filters.subject} options={filterOptions.subjects} onChange={(value) => updateFilter('subject', value)} />
            <SourceFilter label="Academic year" value={filters.academicYear} options={filterOptions.academicYears} onChange={(value) => updateFilter('academicYear', value)} />
            <SourceFilter label="Term" value={filters.term} options={filterOptions.terms} onChange={(value) => updateFilter('term', value)} />
            <SourceFilter label="Assessment type" value={filters.assessmentType} options={filterOptions.assessmentTypes} onChange={(value) => updateFilter('assessmentType', value)} />
            <SourceFilter label="Teacher" value={filters.teacher} options={filterOptions.teachers} onChange={(value) => updateFilter('teacher', value)} />
            <SourceFilter label="Document type" value={filters.documentType} options={filterOptions.documentTypes} onChange={(value) => updateFilter('documentType', value)} />
          </div>
          {hasActiveFilters ? (
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={clearFilters} className="rounded-md px-2 py-2 text-xs font-semibold text-graphite/80 transition hover:bg-white hover:text-ink">
              Clear filters
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
      {documents.length ? (
        <div className="sources-stream space-y-7">
          {filteredDocuments.map((document) => (
            <ManagedDocumentCard
              key={document.id}
              document={document}
              records={state.performanceRecords}
              chunkCount={chunks.filter((chunk) => chunk.documentId === document.id).length}
              onSave={(documentId, patch) => {
                setState((current) => applyDocumentEdit(current, documentId, patch));
                setMessage('Document details were updated.');
              }}
              onSaveRecord={(record) => {
                setState((current) => {
                  const performanceRecords = current.performanceRecords.map((item) => (item.id === record.id ? record : item));

                  return withDerivedCollections({
                    ...current,
                    performanceRecords,
                    documents: current.documents.map((document) => {
                      const metadata = buildDocumentMetadata(document, performanceRecords);
                      const extractionSummary = buildExtractionSummary(document, metadata, performanceRecords);

                      return {
                        ...document,
                        status: document.status === 'Needs review' && extractionSummary.needsReview === 0 ? 'Ready' : document.status,
                        metadata,
                        extractionSummary,
                      };
                    }),
                  });
                });
                setMessage(`${record.subject} was confirmed and Progress was updated.`);
              }}
              onDelete={(item) =>
                setConfirmAction({
                  title: `Delete ${item.title}?`,
                  body: 'This deletes the document and its learning history links. Performance records are kept but unlinked from this source.',
                  confirmLabel: 'Delete document',
                  onConfirm: () => deleteDocument(item),
                })
              }
            />
          ))}
          {filteredDocuments.length === 0 ? (
            <EmptyState title="No documents match these filters" copy="Change a filter to bring reports and assessments back into view." action="Clear filters" onClick={clearFilters} />
          ) : null}
        </div>
      ) : (
        <EmptyState title="Start with one source" copy="Add a report, note, paper, or assessment to build this workspace around real learning evidence." />
      )}
      <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
    </div>
  );
}

type ConfirmAction = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
};

function StatusNote({ message }: { message: string }) {
  return (
    <div className="status-strip status-enter rounded-lg border border-ink/10 bg-paper/70 px-4 py-3 text-sm leading-6 text-graphite/80">
      {message}
    </div>
  );
}

function SourceFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-graphite/80">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full min-w-0 rounded-lg border border-ink/[0.08] bg-white px-3 text-sm font-medium text-ink shadow-sm outline-none ring-ink/10 transition focus:border-ink/20 focus:ring-4">
        <option value="All">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildSourceFilterOptions(documents: ResearchDocument[], records: PerformanceRecord[]) {
  const subjects = new Set<string>();
  const academicYears = new Set<string>();
  const terms = new Set<string>();
  const assessmentTypes = new Set<string>();
  const teachers = new Set<string>();
  const documentTypes = new Set<string>();

  documents.forEach((document) => {
    const metadata = getDocumentMetadata(document, records);
    const linkedRecords = records.filter((record) => record.sourceDocumentId === document.id);

    metadata.subjects.forEach((value) => subjects.add(value));
    metadata.academicYears.forEach((value) => academicYears.add(value));
    metadata.terms.forEach((value) => terms.add(value));
    metadata.teacherNames.forEach((value) => teachers.add(value));
    metadata.documentTypes.forEach((value) => documentTypes.add(value));
    if (metadata.academicYear) academicYears.add(metadata.academicYear);
    if (metadata.term) terms.add(metadata.term);
    if (metadata.documentCategory) documentTypes.add(metadata.documentCategory);

    linkedRecords.forEach((record) => {
      subjects.add(record.subject);
      if (record.academicYear) academicYears.add(record.academicYear);
      if (record.term) terms.add(record.term);
      assessmentTypes.add(record.assessmentType);
      if (record.teacher) teachers.add(record.teacher);
    });
  });

  return {
    subjects: sortFilterOptions(subjects),
    academicYears: sortFilterOptions(academicYears),
    terms: sortFilterOptions(terms),
    assessmentTypes: sortFilterOptions(assessmentTypes),
    teachers: sortFilterOptions(teachers),
    documentTypes: sortFilterOptions(documentTypes),
  };
}

function sortFilterOptions(values: Set<string>) {
  return [...values].map((value) => value.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function documentMatchesSourceFilters(document: ResearchDocument, records: PerformanceRecord[], filters: { subject: string; academicYear: string; term: string; assessmentType: string; teacher: string; documentType: string }) {
  const metadata = getDocumentMetadata(document, records);
  const linkedRecords = records.filter((record) => record.sourceDocumentId === document.id);
  const values = {
    subjects: new Set([...metadata.subjects, ...linkedRecords.map((record) => record.subject)]),
    academicYears: new Set([metadata.academicYear, ...metadata.academicYears, ...linkedRecords.map((record) => record.academicYear)].filter((value): value is string => Boolean(value))),
    terms: new Set([metadata.term, ...metadata.terms, ...linkedRecords.map((record) => record.term)].filter((value): value is string => Boolean(value))),
    assessmentTypes: new Set<string>(linkedRecords.map((record) => record.assessmentType)),
    teachers: new Set([...metadata.teacherNames, ...linkedRecords.map((record) => record.teacher)].filter((value): value is string => Boolean(value))),
    documentTypes: new Set([metadata.documentCategory, ...metadata.documentTypes].filter((value): value is string => Boolean(value))),
  };

  return (
    (filters.subject === 'All' || values.subjects.has(filters.subject)) &&
    (filters.academicYear === 'All' || values.academicYears.has(filters.academicYear)) &&
    (filters.term === 'All' || values.terms.has(filters.term)) &&
    (filters.assessmentType === 'All' || values.assessmentTypes.has(filters.assessmentType)) &&
    (filters.teacher === 'All' || values.teachers.has(filters.teacher)) &&
    (filters.documentType === 'All' || values.documentTypes.has(filters.documentType))
  );
}

function ConfirmModal({ action, onClose }: { action: ConfirmAction | null; onClose: () => void }) {
  const [isWorking, setIsWorking] = useState(false);
  if (!action) return null;

  async function confirm() {
    if (!action) return;
    setIsWorking(true);
    try {
      await action.onConfirm();
      onClose();
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/35 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-body" className="dialog-panel w-full max-w-lg rounded-xl border border-ink/10 bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass">Confirm destructive action</p>
        <h2 id="confirm-dialog-title" className="mt-3 text-xl font-semibold text-ink">{action.title}</h2>
        <p id="confirm-dialog-body" className="mt-3 text-sm leading-7 text-graphite/80">{action.body}</p>
        <div className="mt-6 grid gap-2 sm:flex sm:justify-end">
          <button type="button" onClick={onClose} disabled={isWorking} className="min-h-10 rounded-lg border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-paper/50">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={isWorking} className="min-h-10 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:bg-brass/45">
            {isWorking ? 'Working…' : action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManagedDocumentCard({
  document,
  records,
  chunkCount,
  onSave,
  onSaveRecord,
  onDelete,
}: {
  document: ResearchDocument;
  records: PerformanceRecord[];
  chunkCount: number;
  onSave: (documentId: string, patch: { title?: string; metadata?: Partial<DocumentMetadata> }) => void;
  onSaveRecord: (record: PerformanceRecord) => void;
  onDelete: (document: ResearchDocument) => void;
}) {
  const metadata = getDocumentMetadata(document, records);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(document.title);
  const [sourceDate, setSourceDate] = useState(metadata.sourceDate ?? '');
  const [academicYear, setAcademicYear] = useState(metadata.academicYear ?? metadata.academicYears[0] ?? '');
  const [term, setTerm] = useState(metadata.term ?? metadata.terms[0] ?? 'Other');
  const [linkedAssessmentName, setLinkedAssessmentName] = useState(metadata.linkedAssessmentName ?? metadata.assessments[0] ?? '');
  const [documentCategory, setDocumentCategory] = useState(metadata.documentCategory ?? metadata.documentTypes[0] ?? 'Other');
  const [ignoreInstrumentalMusic, setIgnoreInstrumentalMusic] = useState(metadata.ignoreInstrumentalMusic ?? false);
  const [subjects, setSubjects] = useState(metadata.subjects.join(', '));
  const [topics, setTopics] = useState(metadata.topics.join(', '));
  const [academicYears, setAcademicYears] = useState(metadata.academicYears.join(', '));
  const [terms, setTerms] = useState(metadata.terms.join(', '));
  const [documentTypes, setDocumentTypes] = useState(metadata.documentTypes.join(', '));
  const [teacherNames, setTeacherNames] = useState(metadata.teacherNames.join(', '));
  const [skills, setSkills] = useState(metadata.skills.join(', '));
  const [tags, setTags] = useState(metadata.tags.join(', '));

  function save() {
    const nextMetadata: Partial<DocumentMetadata> = {
      sourceDate: sourceDate.trim() || undefined,
      academicYear: academicYear.trim() || undefined,
      term: term.trim() || undefined,
      linkedAssessmentName: linkedAssessmentName.trim() || undefined,
      documentCategory: documentCategory.trim() || undefined,
      ignoreInstrumentalMusic,
      subjects: normalizeListInput(subjects),
      topics: normalizeListInput(topics),
      academicYears: normalizeListInput(academicYears),
      terms: normalizeListInput(terms),
      documentTypes: normalizeListInput(documentTypes),
      teacherNames: normalizeListInput(teacherNames),
      skills: normalizeListInput(skills),
      collections: metadata.collections,
      tags: normalizeListInput(tags),
    };
    onSave(document.id, { title, metadata: nextMetadata });
    setIsEditing(false);
  }

  return (
    <div className="sources-record space-y-3">
      <SourceArchiveCard
        document={document}
        records={records}
        chunkCount={chunkCount}
        actions={(
          <>
            <button type="button" onClick={() => setIsEditing(true)} className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-xs font-semibold text-graphite/80 transition hover:bg-paper hover:text-ink">
              <Edit3 size={14} /> Edit details
            </button>
            <button type="button" onClick={() => onDelete(document)} className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-xs font-semibold text-graphite/80 transition hover:bg-brass/10 hover:text-brass">
              <Trash2 size={14} /> Delete
            </button>
          </>
        )}
        technicalDetails={<ExtractionReviewPanel records={records.filter((record) => record.sourceDocumentId === document.id)} onSaveRecord={onSaveRecord} />}
      />
      {isEditing ? (
        <div className="sources-edit-panel rounded-xl bg-white p-5 shadow-sm ring-1 ring-ink/[0.055]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">Edit source details</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <FormField label="Document title" className="md:col-span-2"><input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Academic year"><input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Term"><select value={term} onChange={(event) => setTerm(event.target.value)} className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4">{[...academicTerms, term].filter((value, index, values) => value && values.indexOf(value) === index).map((value) => <option key={value} value={value}>{value}</option>)}</select></FormField>
            <FormField label="Assessment or report name" className="md:col-span-2"><input value={linkedAssessmentName} onChange={(event) => setLinkedAssessmentName(event.target.value)} className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <details className="rounded-lg border border-ink/10 bg-paper/70 p-3 md:col-span-2">
              <summary className="cursor-pointer text-sm font-semibold text-ink">Add exact date (optional)</summary>
              <FormField label="Exact date" className="mt-3"><input type="date" value={sourceDate} onChange={(event) => setSourceDate(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            </details>
            <FormField label="Document type"><select value={documentCategory} onChange={(event) => setDocumentCategory(event.target.value)} className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4">{[...documentCategories, documentCategory].filter((value, index, values) => value && values.indexOf(value) === index).map((value) => <option key={value} value={value}>{value}</option>)}</select></FormField>
            <EditListField label="Subjects" value={subjects} setValue={setSubjects} />
            <EditListField label="Topics" value={topics} setValue={setTopics} />
            <EditListField label="Academic years" value={academicYears} setValue={setAcademicYears} />
            <EditListField label="Terms" value={terms} setValue={setTerms} />
            <EditListField label="Document types" value={documentTypes} setValue={setDocumentTypes} />
            <EditListField label="Teacher names" value={teacherNames} setValue={setTeacherNames} />
            <EditListField label="Skills" value={skills} setValue={setSkills} />
            <EditListField label="Tags" value={tags} setValue={setTags} />
            <label className="flex gap-3 rounded-lg border border-ink/10 bg-paper/70 p-3 text-sm leading-6 text-graphite/80 md:col-span-2">
              <input type="checkbox" checked={ignoreInstrumentalMusic} onChange={(event) => setIgnoreInstrumentalMusic(event.target.checked)} className="mt-1 size-4 shrink-0 accent-ink" />
              <span>Keep instrumental or performance lesson content out of academic progress.</span>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={save} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-graphite">Save changes</button>
            <button type="button" onClick={() => setIsEditing(false)} className="rounded-lg border border-ink/10 px-4 py-2 text-sm font-semibold text-ink">Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExtractionReviewPanel({ records, onSaveRecord }: { records: PerformanceRecord[]; onSaveRecord: (record: PerformanceRecord) => void }) {
  const reviewRecords = records.filter(needsExtractionReview);

  if (!reviewRecords.length) return null;

  return (
    <section className="rounded-lg border border-brass/25 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass">May need a quick check</p>
          <p className="mt-2 text-sm leading-6 text-graphite/80">
            Check {reviewRecords.length} subject {reviewRecords.length === 1 ? 'entry' : 'entries'} before {reviewRecords.length === 1 ? 'it affects' : 'they affect'} Progress.
          </p>
        </div>
        <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-semibold text-brass">Review required</span>
      </div>
      <div className="mt-4 space-y-3">
        {reviewRecords.map((record) => (
          <ExtractionRecordEditor key={record.id} record={record} onSaveRecord={onSaveRecord} />
        ))}
      </div>
    </section>
  );
}

function ExtractionRecordEditor({ record, onSaveRecord }: { record: PerformanceRecord; onSaveRecord: (record: PerformanceRecord) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [subject, setSubject] = useState(record.subject);
  const [teacher, setTeacher] = useState(record.teacher ?? '');
  const [teacherComment, setTeacherComment] = useState(record.teacherComment ?? '');
  const [percentage, setPercentage] = useState(record.percentage?.toString() ?? '');
  const [grade, setGrade] = useState(record.grade ?? '');
  const [predictedGrade, setPredictedGrade] = useState(record.predictedGrade ?? '');
  const [targetGrade, setTargetGrade] = useState(record.targetGrade ?? '');
  const [effort, setEffort] = useState(record.effort ?? '');
  const [attainment, setAttainment] = useState(record.attainment ?? '');

  function save() {
    const cleanSubject = subject.trim() || record.subject;
    const nextPercentage = parseOptionalNumber(percentage);
    const domain = getPerformanceDomain(cleanSubject, record.assessmentType, [record.title, teacherComment, grade, predictedGrade, targetGrade].join(' '));
    const nextRecord: PerformanceRecord = {
      ...record,
      subject: cleanSubject,
      teacher: teacher.trim() || undefined,
      teacherComment: teacherComment.trim() || undefined,
      percentage: nextPercentage,
      grade: grade.trim() || undefined,
      predictedGrade: predictedGrade.trim() || undefined,
      targetGrade: targetGrade.trim() || undefined,
      effort: effort.trim() || undefined,
      attainment: attainment.trim() || undefined,
      marksExtracted: Boolean(nextPercentage !== undefined || grade.trim() || predictedGrade.trim() || targetGrade.trim() || attainment.trim()),
      domain,
      excludeFromAcademicAnalysis: domain !== 'academic',
      extractionConfidence: 'High',
      fieldConfidence: {
        subject: 'High',
        teacher: teacher.trim() ? 'High' : undefined,
        teacherComment: teacherComment.trim() ? 'High' : undefined,
        percentage: nextPercentage !== undefined ? 'High' : undefined,
        grade: grade.trim() ? 'High' : undefined,
        predictedGrade: predictedGrade.trim() ? 'High' : undefined,
        targetGrade: targetGrade.trim() ? 'High' : undefined,
        effort: effort.trim() ? 'High' : undefined,
        attainment: attainment.trim() ? 'High' : undefined,
      },
      reviewStatus: 'confirmed',
    };

    onSaveRecord(nextRecord);
    setIsEditing(false);
  }

  const confidence = getRecordExtractionConfidence(record);
  const reviewReasons = getExtractionReviewReasons(record);
  const values = [
    percentage.trim() ? `${percentage}%` : undefined,
    grade.trim(),
    predictedGrade.trim() ? `Predicted ${predictedGrade}` : undefined,
    targetGrade.trim() ? `Target ${targetGrade}` : undefined,
    teacher.trim(),
  ].filter(Boolean);

  return (
    <article className={`rounded-lg border p-4 ${confidence === 'Low' ? 'border-brass/35 bg-brass/10' : 'border-brass/20 bg-paper/55'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{record.subject}</p>
          <p className="mt-1 text-sm leading-6 text-graphite/80">{values.length ? values.join(' / ') : 'Teacher comments only'}</p>
          {reviewReasons.length ? <p className="mt-2 text-sm font-semibold leading-6 text-brass">{reviewReasons.join(' ')}</p> : null}
        </div>
        <button type="button" onClick={() => setIsEditing((value) => !value)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${confidence === 'Low' ? 'bg-ink text-white' : 'border border-ink/10 bg-white text-ink'}`}>
          {isEditing ? 'Close' : 'Review'}
        </button>
      </div>
      {isEditing ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <FormField label="Subject"><input value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
          <FormField label="Teacher"><input value={teacher} onChange={(event) => setTeacher(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
          <FormField label="Percentage"><input value={percentage} onChange={(event) => setPercentage(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
          <FormField label="Grade"><input value={grade} onChange={(event) => setGrade(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
          <FormField label="Predicted grade"><input value={predictedGrade} onChange={(event) => setPredictedGrade(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
          <FormField label="Target grade"><input value={targetGrade} onChange={(event) => setTargetGrade(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
          <FormField label="Effort"><input value={effort} onChange={(event) => setEffort(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
          <FormField label="Attainment"><input value={attainment} onChange={(event) => setAttainment(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
          <FormField label="Teacher comment" className="md:col-span-2"><textarea value={teacherComment} onChange={(event) => setTeacherComment(event.target.value)} rows={4} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
          <button type="button" onClick={save} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-graphite md:col-span-2">
            Save reviewed values
          </button>
        </div>
      ) : null}
    </article>
  );
}

function EditListField({ label, value, setValue }: { label: string; value: string; setValue: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">{label}</span>
      <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={2} className="mt-2 w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" />
    </label>
  );
}

function IconTextButton({ icon: Icon, label, onClick, danger = false, iconOnly = false }: { icon: typeof Edit3; label: string; onClick: () => void; danger?: boolean; iconOnly?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold ${iconOnly ? 'size-9 p-0' : 'px-3 py-2'} ${
        danger ? 'text-graphite/80 hover:bg-brass/10 hover:text-brass' : 'text-ink hover:bg-paper'
      }`}
    >
      <Icon size={14} />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </button>
  );
}

const assessmentTypes: AssessmentType[] = ['exam', 'report', 'coursework', 'music', 'mock', 'other'];
const academicTerms: AcademicTerm[] = ['Michaelmas', 'Lent', 'Summer', 'Custom'];
const documentCategories: DocumentCategory[] = ['Report', 'Exam result', 'Mark sheet', 'Coursework', 'Assessment', 'Notes', 'Past paper', 'Mark scheme', 'Essay', 'Other'];
const defaultSubjectOptions = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'English', 'History', 'Geography', 'French', 'Spanish', 'Latin', 'Music'];

type UploadMetadataDraft = {
  sourceDate: string;
  academicYear: string;
  term: AcademicTerm;
  linkedAssessmentName: string;
  documentCategory: DocumentCategory;
  subjectsIncluded: string[];
  customSubjects: string;
  ignoreInstrumentalMusic: boolean;
};

type UploadStage = 'file-selected' | 'extracting' | 'chunking' | 'saving' | 'embedding';

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getUploadSubjects(draft: UploadMetadataDraft) {
  return [...safeStringArray(draft.subjectsIncluded), ...normalizeListInput(draft.customSubjects ?? '')];
}

function buildUploadMetadata(draft: UploadMetadataDraft): Partial<DocumentMetadata> {
  const subjects = getUploadSubjects(draft);

  return {
    sourceDate: draft.sourceDate?.trim() || undefined,
    academicYear: draft.academicYear.trim() || undefined,
    term: draft.term,
    linkedAssessmentName: draft.linkedAssessmentName.trim() || undefined,
    documentCategory: draft.documentCategory,
    subjects,
    ignoreInstrumentalMusic: draft.ignoreInstrumentalMusic,
  };
}

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

function isInstrumentalOrPerformanceText(value?: string | null) {
  return /\b(instrument|instrumental|piano|violin|cello|flute|clarinet|saxophone|trumpet|guitar|drum|singing|vocal|ensemble|orchestra|choir|abrsm|trinity|graded instrument|music performance|performance lesson)\b/i.test(value ?? '');
}

function isAcademicMusicText(value?: string | null) {
  return /\b(gcse|appraising|composition|coursework|listening|set works?|theory|exam|report|assessment|mark sheet|marksheet|notes?)\b/i.test(value ?? '');
}

function isAcademicMusicCategory(category?: string | null) {
  return /\b(exam|exam result|report|coursework|assessment|notes?|mark sheet|marksheet)\b/i.test(category ?? '');
}

function canDocumentCategoryAffectAcademicProgress(category?: string | null) {
  return ['Report', 'Exam result', 'Mark sheet', 'Coursework', 'Assessment', 'Notes'].includes(String(category ?? ''));
}

function isMusicSubject(subject?: string | null) {
  return /\bmusic\b/i.test(subject ?? '');
}

function isMusicOrPerformanceSubject(subject: string) {
  return isMusicSubject(subject) || isInstrumentalOrPerformanceText(subject);
}

function shouldTreatAsInstrumentalPerformanceRecord(record: Pick<PerformanceRecord, 'subject' | 'title' | 'assessmentType' | 'teacherComment' | 'strengths' | 'weaknesses' | 'actionPoints' | 'domain' | 'excludeFromAcademicAnalysis'>) {
  if (record.excludeFromAcademicAnalysis) return true;
  if (record.domain === 'performance') return true;

  const context = [record.subject, record.title, record.assessmentType, record.teacherComment, ...record.strengths, ...record.weaknesses, ...record.actionPoints].join(' ');
  if (isInstrumentalOrPerformanceText(record.subject)) return true;
  if (isMusicSubject(record.subject) && isAcademicMusicText(context)) return false;
  return isInstrumentalOrPerformanceText(context);
}

function shouldTreatAsInstrumentalPerformanceDocument(metadata: DocumentMetadata) {
  if (!metadata.ignoreInstrumentalMusic) return false;
  const subjects = safeStringArray(metadata.subjects);
  const context = [metadata.linkedAssessmentName, metadata.documentCategory, ...subjects, ...safeStringArray(metadata.tags), ...safeStringArray(metadata.topics)].join(' ');
  if (isMusicSubject(context) && (isAcademicMusicCategory(metadata.documentCategory) || isAcademicMusicText(context))) return false;
  return subjects.length > 0 && subjects.every((subject) => isInstrumentalOrPerformanceText(subject));
}

function shouldDocumentAffectAcademicPerformance(metadata: DocumentMetadata) {
  return canDocumentCategoryAffectAcademicProgress(metadata.documentCategory) && !shouldTreatAsInstrumentalPerformanceDocument(metadata);
}

function shouldExcludeRecordForInstrumentalPreference(record: PerformanceRecord, metadata?: DocumentMetadata) {
  if (!metadata?.ignoreInstrumentalMusic) return false;
  if (isMusicSubject(record.subject) && (isAcademicMusicCategory(metadata.documentCategory) || isAcademicMusicText([metadata.linkedAssessmentName, record.title, record.assessmentType].join(' ')))) {
    return false;
  }
  return shouldTreatAsInstrumentalPerformanceRecord(record);
}

function getPerformanceDomain(subject: string, assessmentType?: AssessmentType, context = ''): PerformanceDomain {
  const combined = [subject, assessmentType, context].join(' ');
  if (isInstrumentalOrPerformanceText(subject) || isInstrumentalOrPerformanceText(combined)) return 'performance';
  return 'academic';
}

export function isAcademicPerformanceRecord(record: PerformanceRecord) {
  const domain = shouldTreatAsInstrumentalPerformanceRecord(record) ? 'performance' : 'academic';
  if (domain !== 'academic' || needsExtractionReview(record)) return false;
  return !record.excludeFromAcademicAnalysis || hasReviewAvailable(record) || hasProgressUsableEvidence(record);
}

export function getAcademicPerformanceRecords(records: PerformanceRecord[]) {
  return records.filter(isAcademicPerformanceRecord);
}

function getSubjectGroups(records: PerformanceRecord[]) {
  return [...records]
    .sort((a, b) => getRecordAcademicSortKey(a).localeCompare(getRecordAcademicSortKey(b)))
    .reduce<Record<string, PerformanceRecord[]>>((groups, record) => {
      const subject = record.subject.trim() || 'Unspecified subject';
      groups[subject] = [...(groups[subject] ?? []), record];
      return groups;
    }, {});
}

function formatResult(record: PerformanceRecord) {
  const percentage = getRecordPercentage(record);
  const score = typeof record.score === 'number' && typeof record.maxScore === 'number' ? `${record.score}/${record.maxScore}` : undefined;
  const estimatedGrade = getEstimatedGradeFromPercentage(percentage);
  return [
    score,
    percentage !== undefined ? `${percentage}%` : undefined,
    estimatedGrade ? `Estimated from percentage: ${estimatedGrade}` : undefined,
    record.grade,
    record.attainment ? `Attainment ${record.attainment}` : undefined,
    record.predictedGrade ? `Predicted ${record.predictedGrade}` : undefined,
    record.targetGrade ? `Target ${record.targetGrade}` : undefined,
  ].filter(Boolean).join(' / ') || (record.teacherComment ? 'Teacher comments only' : 'Marks not extracted');
}

function withDerivedCollections(state: ReturnType<typeof useResearchState>['state']) {
  return {
    ...state,
    collections: deriveCollections(state),
  };
}

function collectionIdFromName(name: string) {
  return `collection-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function normalizeListInput(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function makeMetadata(document: ResearchDocument, records: PerformanceRecord[], overrides: Partial<DocumentMetadata> = {}) {
  const base = getDocumentMetadata(document, records);
  return {
    ...base,
    ...overrides,
    subjects: safeStringArray(overrides.subjects ?? base.subjects),
    topics: safeStringArray(overrides.topics ?? base.topics),
    academicYears: safeStringArray(overrides.academicYears ?? base.academicYears),
    terms: safeStringArray(overrides.terms ?? base.terms),
    assessments: safeStringArray(overrides.assessments ?? base.assessments),
    documentTypes: safeStringArray(overrides.documentTypes ?? base.documentTypes),
    teacherNames: safeStringArray(overrides.teacherNames ?? base.teacherNames),
    skills: safeStringArray(overrides.skills ?? base.skills),
    performanceRecords: safeStringArray(overrides.performanceRecords ?? base.performanceRecords),
    extractedFacts: safeStringArray(overrides.extractedFacts ?? base.extractedFacts),
    inferredMetadata: safeStringArray(overrides.inferredMetadata ?? base.inferredMetadata),
    collections: safeStringArray(overrides.collections ?? base.collections),
    tags: safeStringArray(overrides.tags ?? base.tags),
  };
}

function applyDocumentEdit(state: ResearchState, documentId: string, patch: { title?: string; metadata?: Partial<DocumentMetadata> }) {
  return withDerivedCollections({
    ...state,
    documents: state.documents.map((document) => {
      if (document.id !== documentId) return document;
      const nextDocument = {
        ...document,
        title: patch.title?.trim() || document.title,
      };
      const metadata = makeMetadata(nextDocument, state.performanceRecords, patch.metadata);
      const extractionSummary = buildExtractionSummary(nextDocument, metadata, state.performanceRecords);
      return {
        ...nextDocument,
        addedAt: metadata.sourceDate ?? nextDocument.addedAt,
        tags: metadata.tags.length ? metadata.tags : nextDocument.tags,
        metadata,
        extractionSummary,
        collectionIds: metadata.collections.map(collectionIdFromName),
      };
    }),
  });
}

function removeDocumentFromState(state: ResearchState, documentId: string) {
  return withDerivedCollections({
    ...state,
    documents: state.documents.filter((document) => document.id !== documentId),
    chunks: state.chunks.filter((chunk) => chunk.documentId !== documentId),
    insights: state.insights.filter((insight) => insight.sourceId !== documentId),
    performanceRecords: state.performanceRecords.map((record) => (record.sourceDocumentId === documentId ? { ...record, sourceDocumentId: undefined } : record)),
  });
}

async function deleteRemoteDocumentIfNeeded(state: ResearchState, documentId: string, storageStatus: ReturnType<typeof useResearchState>['storageStatus'], userId?: string | null) {
  if (storageStatus !== 'connected') return;
  const chunkIds = state.chunks.filter((chunk) => chunk.documentId === documentId).map((chunk) => chunk.id);
  const insightIds = state.insights.filter((insight) => insight.sourceId === documentId).map((insight) => insight.id);

  await deleteSupabaseRows({
    documents: [documentId],
    document_chunks: chunkIds,
    insights: insightIds,
  }, { userId });
}

async function deleteRemoteRowsIfNeeded(rows: Parameters<typeof deleteSupabaseRows>[0], storageStatus: ReturnType<typeof useResearchState>['storageStatus'], userId?: string | null) {
  if (storageStatus !== 'connected') return;
  await deleteSupabaseRows(rows, { userId });
}

function buildPerformanceSummary(records: PerformanceRecord[], advice: PerformanceAdviceResponse): PerformanceSummary {
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
    recordIds: records.map((record) => record.id).sort(),
    teacherThemes: advice.teacherThemes,
    coachingRecommendations: advice.coachingRecommendations,
    overallCommentary:
      advice.overallCommentary ||
      `Based on the available ${records.length} performance record${records.length === 1 ? '' : 's'}, more data may be needed before drawing firm conclusions.`,
  };
}

function normalizeAssessmentType(value: unknown): AssessmentType {
  return typeof value === 'string' && assessmentTypes.includes(value as AssessmentType) ? (value as AssessmentType) : 'other';
}

function cleanOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

const originalPreviewLimit = 1_200_000;
const percentageEstimateBands = [
  { min: 90, label: 'exceptional' },
  { min: 80, label: 'strong' },
  { min: 70, label: 'secure' },
  { min: 60, label: 'developing' },
  { min: 0, label: 'building' },
];

function getEstimatedGradeFromPercentage(percentage?: number) {
  if (percentage === undefined || percentage < 0 || percentage > 100) return undefined;
  return percentageEstimateBands.find((band) => percentage >= band.min)?.label;
}

function normalizeExtractionConfidence(value: unknown): ExtractionConfidence | undefined {
  return value === 'High' || value === 'Medium' || value === 'Low' ? value : undefined;
}

function getLowestConfidence(values: Array<ExtractionConfidence | undefined>) {
  if (values.includes('Low')) return 'Low';
  if (values.includes('Medium')) return 'Medium';
  if (values.includes('High')) return 'High';
  return undefined;
}

function getRecordExtractionConfidence(record: Pick<PerformanceRecord, 'extractionConfidence' | 'fieldConfidence'>): ExtractionConfidence {
  return record.extractionConfidence ?? getLowestConfidence(Object.values(record.fieldConfidence ?? {})) ?? 'High';
}

function hasUsefulExtractedValue(record: Pick<PerformanceRecord, 'teacher' | 'teacherComment' | 'effort' | 'attainment' | 'percentage' | 'grade' | 'predictedGrade' | 'targetGrade' | 'score' | 'maxScore'>) {
  return Boolean(
    typeof record.percentage === 'number' ||
      typeof record.score === 'number' ||
      typeof record.maxScore === 'number' ||
      record.grade?.trim() ||
      record.teacherComment?.trim() ||
      record.teacher?.trim() ||
      record.effort?.trim() ||
      record.attainment?.trim() ||
      record.predictedGrade?.trim() ||
      record.targetGrade?.trim(),
  );
}

function hasImpossibleMarkValue(record: Pick<PerformanceRecord, 'percentage' | 'score' | 'maxScore'>) {
  return Boolean(
    (typeof record.percentage === 'number' && (record.percentage < 0 || record.percentage > 100)) ||
      (typeof record.score === 'number' && record.score < 0) ||
      (typeof record.maxScore === 'number' && record.maxScore <= 0) ||
      (typeof record.score === 'number' && typeof record.maxScore === 'number' && record.score > record.maxScore),
  );
}

function hasContradictoryMarkValue(record: Pick<PerformanceRecord, 'percentage' | 'score' | 'maxScore'>) {
  if (typeof record.percentage !== 'number' || typeof record.score !== 'number' || typeof record.maxScore !== 'number' || record.maxScore <= 0) return false;
  const calculated = Math.round((record.score / record.maxScore) * 100);
  return Math.abs(calculated - record.percentage) > 1;
}

function hasClearPercentage(record: Pick<PerformanceRecord, 'percentage' | 'fieldConfidence'>) {
  return typeof record.percentage === 'number' && record.percentage >= 0 && record.percentage <= 100 && record.fieldConfidence?.percentage !== 'Low';
}

function hasProgressUsableEvidence(record: Pick<PerformanceRecord, 'fieldConfidence' | 'teacherComment' | 'teacher' | 'effort' | 'attainment' | 'percentage' | 'grade' | 'predictedGrade' | 'targetGrade' | 'score' | 'maxScore'>) {
  return Boolean(
    hasClearPercentage(record) ||
      (record.teacherComment?.trim() && record.fieldConfidence?.teacherComment !== 'Low') ||
      (record.grade?.trim() && record.fieldConfidence?.grade !== 'Low') ||
      (record.teacher?.trim() && record.fieldConfidence?.teacher !== 'Low') ||
      (record.effort?.trim() && record.fieldConfidence?.effort !== 'Low') ||
      (record.attainment?.trim() && record.fieldConfidence?.attainment !== 'Low') ||
      (record.predictedGrade?.trim() && record.fieldConfidence?.predictedGrade !== 'Low') ||
      (record.targetGrade?.trim() && record.fieldConfidence?.targetGrade !== 'Low') ||
      (typeof record.score === 'number' && record.fieldConfidence?.score !== 'Low') ||
      (typeof record.maxScore === 'number' && record.fieldConfidence?.maxScore !== 'Low'),
  );
}

function hasLowConfidenceMark(record: Pick<PerformanceRecord, 'marksExtracted' | 'fieldConfidence' | 'percentage' | 'score' | 'maxScore' | 'grade' | 'predictedGrade' | 'targetGrade' | 'attainment'>) {
  const fieldConfidence = record.fieldConfidence ?? {};
  return Boolean(
    (typeof record.percentage === 'number' && fieldConfidence.percentage === 'Low') ||
      (typeof record.score === 'number' && fieldConfidence.score === 'Low') ||
      (typeof record.maxScore === 'number' && fieldConfidence.maxScore === 'Low') ||
      (record.grade?.trim() && fieldConfidence.grade === 'Low') ||
      (record.attainment?.trim() && fieldConfidence.attainment === 'Low'),
  );
}

function hasLowConfidenceUsefulValue(record: Pick<PerformanceRecord, 'fieldConfidence' | 'teacher' | 'teacherComment' | 'effort' | 'attainment' | 'percentage' | 'grade' | 'predictedGrade' | 'targetGrade' | 'score' | 'maxScore'>) {
  const fieldConfidence = record.fieldConfidence ?? {};
  return Boolean(
    (record.teacher?.trim() && fieldConfidence.teacher === 'Low') ||
      (record.teacherComment?.trim() && fieldConfidence.teacherComment === 'Low') ||
      (record.effort?.trim() && fieldConfidence.effort === 'Low') ||
      (record.attainment?.trim() && fieldConfidence.attainment === 'Low') ||
      (typeof record.percentage === 'number' && fieldConfidence.percentage === 'Low') ||
      (typeof record.score === 'number' && fieldConfidence.score === 'Low') ||
      (typeof record.maxScore === 'number' && fieldConfidence.maxScore === 'Low') ||
      (record.grade?.trim() && fieldConfidence.grade === 'Low') ||
      (record.predictedGrade?.trim() && fieldConfidence.predictedGrade === 'Low') ||
      (record.targetGrade?.trim() && fieldConfidence.targetGrade === 'Low'),
  );
}

function hasMediumConfidenceUsefulValue(record: Pick<PerformanceRecord, 'fieldConfidence' | 'teacher' | 'teacherComment' | 'effort' | 'attainment' | 'percentage' | 'grade' | 'predictedGrade' | 'targetGrade' | 'score' | 'maxScore'>) {
  const fieldConfidence = record.fieldConfidence ?? {};
  return Boolean(
    (record.teacher?.trim() && fieldConfidence.teacher === 'Medium') ||
      (record.teacherComment?.trim() && fieldConfidence.teacherComment === 'Medium') ||
      (record.effort?.trim() && fieldConfidence.effort === 'Medium') ||
      (record.attainment?.trim() && fieldConfidence.attainment === 'Medium') ||
      (typeof record.percentage === 'number' && fieldConfidence.percentage === 'Medium') ||
      (typeof record.score === 'number' && fieldConfidence.score === 'Medium') ||
      (typeof record.maxScore === 'number' && fieldConfidence.maxScore === 'Medium') ||
      (record.grade?.trim() && fieldConfidence.grade === 'Medium') ||
      (record.predictedGrade?.trim() && fieldConfidence.predictedGrade === 'Medium') ||
      (record.targetGrade?.trim() && fieldConfidence.targetGrade === 'Medium'),
  );
}

function needsExtractionReview(record: Pick<PerformanceRecord, 'reviewStatus' | 'extractionConfidence' | 'fieldConfidence' | 'marksExtracted' | 'subject' | 'teacher' | 'teacherComment' | 'effort' | 'attainment' | 'percentage' | 'grade' | 'predictedGrade' | 'targetGrade' | 'score' | 'maxScore' | 'needsReviewReason'>) {
  if (record.reviewStatus === 'confirmed') return false;
  if (record.needsReviewReason?.trim()) return true;
  const subjectIsUnclear = !record.subject.trim() || record.fieldConfidence?.subject === 'Low';
  if (subjectIsUnclear) return true;
  if (hasImpossibleMarkValue(record) || hasContradictoryMarkValue(record)) return true;
  if (hasClearPercentage(record)) return false;
  if (record.teacherComment?.trim() && record.fieldConfidence?.teacherComment !== 'Low') return false;
  if (!hasUsefulExtractedValue(record)) return record.extractionConfidence === 'Low';
  return hasLowConfidenceUsefulValue(record) || hasLowConfidenceMark(record);
}

function hasReviewAvailable(record: Pick<PerformanceRecord, 'reviewStatus' | 'extractionConfidence' | 'fieldConfidence' | 'marksExtracted' | 'subject' | 'teacher' | 'teacherComment' | 'effort' | 'attainment' | 'percentage' | 'grade' | 'predictedGrade' | 'targetGrade' | 'score' | 'maxScore'>) {
  return record.reviewStatus !== 'confirmed' && !needsExtractionReview(record) && (record.extractionConfidence === 'Medium' || hasMediumConfidenceUsefulValue(record));
}

function getExtractionReviewReasons(record: Pick<PerformanceRecord, 'extractionConfidence' | 'fieldConfidence' | 'marksExtracted' | 'subject' | 'teacher' | 'teacherComment' | 'effort' | 'attainment' | 'percentage' | 'grade' | 'predictedGrade' | 'targetGrade' | 'score' | 'maxScore' | 'needsReviewReason'>) {
  const lowFields = Object.entries(record.fieldConfidence ?? {})
    .filter(([field, confidence]) => {
      if (confidence !== 'Low') return false;
      if (field === 'subject') return true;
      if (field === 'teacher') return Boolean(record.teacher?.trim());
      if (field === 'teacherComment') return Boolean(record.teacherComment?.trim());
      if (field === 'score') return typeof record.score === 'number';
      if (field === 'maxScore') return typeof record.maxScore === 'number';
      if (field === 'percentage') return typeof record.percentage === 'number';
      if (field === 'grade') return Boolean(record.grade?.trim());
      if (field === 'predictedGrade') return Boolean(record.predictedGrade?.trim());
      if (field === 'targetGrade') return Boolean(record.targetGrade?.trim());
      if (field === 'effort') return Boolean(record.effort?.trim());
      if (field === 'attainment') return Boolean(record.attainment?.trim());
      return false;
    })
    .map(([field]) => field);
  const reasons: string[] = lowFields.map((field) => {
    if (field === 'subject') return 'Subject uncertain.';
    if (field === 'teacher') return 'Teacher name may need a quick check.';
    if (field === 'teacherComment') return 'Teacher comment was difficult to read.';
    if (field === 'score' || field === 'maxScore' || field === 'percentage') return 'Possible mark mismatch.';
    if (field === 'grade' || field === 'predictedGrade' || field === 'targetGrade') return 'Possible grade mismatch.';
    if (field === 'effort' || field === 'attainment') return 'Effort or attainment value may be ambiguous.';
    if (field === 'rank') return 'Rank or set value may be ambiguous.';
    return 'One extracted field may need a quick check.';
  });
  if (record.extractionConfidence === 'Low' && reasons.length === 0) {
    reasons.push('OCR or table structure made this row uncertain.');
  }
  if (record.needsReviewReason?.trim()) {
    reasons.push(record.needsReviewReason.trim());
  }
  if (hasImpossibleMarkValue(record)) {
    reasons.push('Mark value looks impossible.');
  }
  if (hasContradictoryMarkValue(record)) {
    reasons.push('Score and percentage may not match.');
  }
  if (hasLowConfidenceMark(record)) {
    reasons.push('Possible mark mismatch.');
  }
  return uniqueStrings(reasons).slice(0, 3);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('File preview could not be prepared.'));
    reader.readAsDataURL(file);
  });
}

async function createOriginalFileSnapshot(file: File, fallbackText?: string): Promise<OriginalDocumentSnapshot> {
  const mimeType = file.type || 'application/octet-stream';
  const base = {
    fileName: file.name || 'Uploaded file',
    mimeType,
    size: file.size,
    storedAt: new Date().toISOString(),
  };

  if (mimeType.startsWith('image/') && file.size <= originalPreviewLimit) {
    return {
      ...base,
      previewKind: 'image',
      previewData: await readFileAsDataUrl(file),
      previewLabel: 'Original image preview',
    };
  }

  if ((mimeType === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) && fallbackText) {
    return {
      ...base,
      previewKind: 'text',
      previewData: fallbackText.slice(0, 8000),
      previewLabel: 'Original text preview',
    };
  }

  if (file.size <= originalPreviewLimit && (mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
    return {
      ...base,
      previewKind: 'file',
      previewData: await readFileAsDataUrl(file),
      previewLabel: 'Original PDF preview',
    };
  }

  return {
    ...base,
    previewKind: 'metadata',
    previewLabel: file.size > originalPreviewLimit ? 'Original file metadata saved; preview skipped because the file is large.' : 'Original file metadata saved.',
  };
}

async function createOriginalFileSnapshotSafe(file: File, fallbackText?: string): Promise<OriginalDocumentSnapshot> {
  try {
    return await createOriginalFileSnapshot(file, fallbackText);
  } catch {
    return {
      fileName: file.name || 'Uploaded file',
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      storedAt: new Date().toISOString(),
      previewKind: 'metadata',
      previewLabel: 'Original file metadata saved; preview could not be prepared.',
    };
  }
}

function createRecordFromAnalysis(record: PerformanceAnalysisRecord, sourceDocumentId: string, fallbackTitle: string, sourceMetadata?: DocumentMetadata): PerformanceRecord | null {
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
  const grade = cleanOptionalString(record.grade);
  const attainment = cleanOptionalString(record.attainment);
  const predictedGrade = cleanOptionalString(record.predictedGrade);
  const targetGrade = cleanOptionalString(record.targetGrade);
  const extractionConfidence = normalizeExtractionConfidence(record.extractionConfidence) ?? 'Medium';
  const rawFieldConfidence = record.fieldConfidence && typeof record.fieldConfidence === 'object' ? record.fieldConfidence : {};
  const fieldConfidence: ExtractionFieldConfidence = {};
  (Object.entries(rawFieldConfidence) as Array<[keyof ExtractionFieldConfidence, unknown]>).forEach(([field, confidence]) => {
    const normalized = normalizeExtractionConfidence(confidence);
    if (normalized) fieldConfidence[field] = normalized;
  });
  const marksExtracted = Boolean(
    record.marksExtracted ||
    typeof score === 'number' ||
    typeof maxScore === 'number' ||
    typeof percentage === 'number' ||
    grade ||
    attainment ||
    predictedGrade ||
    targetGrade,
  );

  const assessmentType = normalizeAssessmentType(record.assessmentType);
  const title = typeof record.title === 'string' && record.title.trim() ? record.title.trim() : fallbackTitle;
  const domain = getPerformanceDomain(subject, assessmentType, [title, sourceMetadata?.linkedAssessmentName, sourceMetadata?.documentCategory].join(' '));
  const candidateRecord = {
    reviewStatus: undefined,
    extractionConfidence,
    fieldConfidence,
    marksExtracted,
    subject,
    teacher: cleanOptionalString(record.teacher),
    teacherComment: cleanOptionalString(record.teacherComment),
    effort: cleanOptionalString(record.effort),
    attainment,
    percentage,
    grade,
    predictedGrade,
    targetGrade,
    score,
    maxScore,
    needsReviewReason: cleanOptionalString(record.needsReviewReason),
  };
  const requiresReview = needsExtractionReview(candidateRecord);
  const teacher = candidateRecord.teacher;
  const teacherComment = candidateRecord.teacherComment;
  const effort = candidateRecord.effort;

  return {
    id: `performance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    sourceDocumentId,
    date: typeof record.date === 'string' && record.date.trim() ? record.date.trim() : sourceMetadata?.sourceDate || '',
    term: typeof record.term === 'string' && record.term.trim() ? record.term.trim() : sourceMetadata?.term,
    academicYear: typeof record.academicYear === 'string' && record.academicYear.trim() ? record.academicYear.trim() : sourceMetadata?.academicYear,
    subject,
    assessmentType,
    domain,
    excludeFromAcademicAnalysis:
      Boolean(record.excludeFromAcademicAnalysis) ||
      requiresReview ||
      shouldExcludeRecordForInstrumentalPreference(
        {
          id: '',
          title,
          sourceDocumentId,
          date: '',
          subject,
          assessmentType,
          domain,
          excludeFromAcademicAnalysis: false,
          teacher,
          teacherComment,
          effort,
          attainment,
          score,
          maxScore,
          percentage,
          grade,
          predictedGrade,
          targetGrade,
          marksExtracted,
          extractionConfidence,
          fieldConfidence,
          strengths: Array.isArray(record.strengths) ? record.strengths.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [],
          weaknesses: Array.isArray(record.weaknesses) ? record.weaknesses.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [],
          actionPoints: Array.isArray(record.actionPoints) ? record.actionPoints.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [],
          createdAt: '',
        },
        sourceMetadata,
      ),
    score,
    maxScore,
    percentage,
    grade,
    rank: cleanOptionalString(record.rank),
    teacher,
    teacherComment,
    effort,
    attainment,
    predictedGrade,
    targetGrade,
    marksExtracted,
    extractionConfidence,
    fieldConfidence,
    reviewStatus: requiresReview ? 'needs_review' : 'confirmed',
    strengths: Array.isArray(record.strengths) ? record.strengths.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [],
    weaknesses: Array.isArray(record.weaknesses) ? record.weaknesses.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [],
    actionPoints: Array.isArray(record.actionPoints) ? record.actionPoints.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [],
    rawEvidence: Array.isArray(record.rawEvidence) ? record.rawEvidence.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [],
    needsReviewReason: candidateRecord.needsReviewReason,
    createdAt: new Date().toISOString(),
  };
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function buildEvidenceAwareSummary({
  title,
  text,
  metadata,
  analysis,
}: {
  title: string;
  text: string;
  metadata: DocumentMetadata;
  analysis?: DocumentMetadataAnalysisResponse;
}) {
  if (analysis?.summary.summaryText) {
    return [
      analysis.summary.summaryText,
      analysis.summary.keyEvidence?.length ? `Key evidence: ${analysis.summary.keyEvidence.slice(0, 3).join('; ')}.` : '',
      analysis.summary.suggestedUse ? `Use it for: ${analysis.summary.suggestedUse}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  const topics = safeStringArray(metadata.topics).slice(0, 5);
  const subjects = safeStringArray(metadata.subjects).slice(0, 4);
  const evidenceLines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => /\b(%|score|mark|grade|rank|position|comment|target|strength|improve|excellent|good|weak|needs)\b/i.test(line))
    .slice(0, 3);
  const sourceType = metadata.documentCategory ?? 'source document';

  return [
    `${title} appears to be a ${sourceType}.`,
    subjects.length ? `Main subjects: ${subjects.join(', ')}.` : '',
    topics.length ? `Main topics: ${topics.join(', ')}.` : '',
    evidenceLines.length ? `Key evidence: ${evidenceLines.join('; ')}.` : summarizeText(text, 180),
    `Use it for: source-grounded revision, Tutor context, and Progress evidence${metadata.shouldAffectAcademicPerformance === false ? '; it is not counted in academic performance trends' : ''}.`,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildExtractionSummary(document: ResearchDocument, metadata: DocumentMetadata, records: PerformanceRecord[], analysis?: DocumentMetadataAnalysisResponse): ExtractionSummary {
  const linkedRecords = records.filter((record) => record.sourceDocumentId === document.id);
  const subjectsFound = uniqueStrings([...safeStringArray(metadata.subjects), ...linkedRecords.map((record) => record.subject)]).length;
  const teacherComments = linkedRecords.filter((record) => Boolean(record.teacherComment)).length;
  const marksExtracted = linkedRecords.filter((record) => record.marksExtracted).length;
  const gradesExtracted = linkedRecords.filter((record) => Boolean(record.grade || record.attainment || record.predictedGrade)).length;
  const targetsFound = linkedRecords.filter((record) => Boolean(record.targetGrade)).length;
  const teachersIdentified = uniqueStrings([...safeStringArray(metadata.teacherNames), ...linkedRecords.map((record) => record.teacher)]).length;
  const reviewRecords = linkedRecords.filter(needsExtractionReview);
  const reviewSuggestedRecords = linkedRecords.filter(hasReviewAvailable);
  const confirmedRecords = linkedRecords.filter((record) => !needsExtractionReview(record));
  const metadataConfidence = metadata.metadataConfidence ?? analysis?.metadata.metadataConfidence ?? 'Low';
  const confidence = getLowestConfidence([metadataConfidence, ...linkedRecords.map(getRecordExtractionConfidence)]) ?? 'Low';
  const extractionWarnings = uniqueStrings([...(analysis?.extractionWarnings ?? []), ...(analysis?.extractionDiagnostics?.warnings ?? [])]);
  const missingLikelySubjects = uniqueStrings(analysis?.missingLikelySubjects ?? []);
  const uncertainFields = linkedRecords.reduce((total, record) => total + Object.values(record.fieldConfidence ?? {}).filter((value) => value === 'Low').length + (record.needsReviewReason ? 1 : 0), 0);
  const diagnostics = analysis?.extractionDiagnostics
    ? {
        ...analysis.extractionDiagnostics,
        warnings: uniqueStrings(analysis.extractionDiagnostics.warnings),
      }
    : linkedRecords.length || extractionWarnings.length
      ? {
          detectedSubjectSections: subjectsFound,
          subjectsWithMarks: marksExtracted,
          subjectsWithComments: teacherComments,
          uncertainFields,
          warnings: extractionWarnings,
        }
      : undefined;
  const reviewNotes = [
    linkedRecords.length ? `Research OS understood this report. ${confirmedRecords.length} subject${confirmedRecords.length === 1 ? '' : 's'} confirmed automatically.` : '',
    reviewSuggestedRecords.length ? `${reviewSuggestedRecords.length} subject${reviewSuggestedRecords.length === 1 ? '' : 's'} may need a quick check later.` : '',
    reviewRecords.length ? `${reviewRecords.length} subject${reviewRecords.length === 1 ? ' is' : 's are'} waiting for confirmation before affecting Progress.` : '',
    linkedRecords.some(hasLowConfidenceMark) ? 'One possible mark ambiguity is visible for review and is not counted in Progress yet.' : '',
    extractionWarnings.length ? `${extractionWarnings.length} extraction warning${extractionWarnings.length === 1 ? '' : 's'} recorded in diagnostics.` : '',
    missingLikelySubjects.length ? `${missingLikelySubjects.length} likely subject${missingLikelySubjects.length === 1 ? '' : 's'} may be missing.` : '',
  ].filter(Boolean);

  return {
    confidence,
    status: reviewRecords.length ? 'Partially understood' : 'Document understood',
    subjectsFound,
    teacherComments,
    marksExtracted,
    gradesExtracted,
    targetsFound,
    teachersIdentified,
    needsReview: reviewRecords.length,
    confirmedAutomatically: confirmedRecords.length,
    reviewSuggested: reviewSuggestedRecords.length,
    waitingForConfirmation: reviewRecords.length,
    reviewNotes,
    diagnostics,
    extractionWarnings,
    missingLikelySubjects,
  };
}

function metadataFromDocumentAnalysis(document: ResearchDocument, fallback: DocumentMetadata, analysis?: DocumentMetadataAnalysisResponse): DocumentMetadata {
  if (!analysis) {
    const fallbackSubjects = safeStringArray(fallback.subjects);
    const fallbackTopics = safeStringArray(fallback.topics);

    return {
      ...fallback,
      subjects: fallbackSubjects,
      topics: fallbackTopics,
      metadataConfidence: fallback.metadataConfidence ?? (fallbackSubjects.length || fallbackTopics.length ? 'Medium' : 'Low'),
      metadataSource: fallback.metadataSource ?? 'Local fallback',
      shouldAffectAcademicPerformance:
        fallback.shouldAffectAcademicPerformance ??
        shouldDocumentAffectAcademicPerformance(fallback),
      extractedFacts: fallback.extractedFacts ?? [],
      inferredMetadata: fallback.inferredMetadata ?? ['Local metadata inferred from upload fields, filename, tags, and extracted text.'],
    };
  }

  const metadata = analysis.metadata;
  const subjects = uniqueStrings([...safeStringArray(metadata.subjects), ...safeStringArray(fallback.subjects)]);
  const topics = uniqueStrings([...safeStringArray(metadata.topics), ...safeStringArray(fallback.topics)]);
  const skills = uniqueStrings([...safeStringArray(metadata.skills), ...safeStringArray(fallback.skills)]);
  const teacherNames = uniqueStrings([
    ...safeStringArray(metadata.teacherNames),
    ...safeStringArray(fallback.teacherNames),
    ...analysis.performanceRecords.map((record) => cleanOptionalString(record.teacher)),
  ]);
  const tags = uniqueStrings([...safeStringArray(metadata.tags), ...topics, ...subjects, ...safeStringArray(fallback.tags)]);
  const academicYears = uniqueStrings([metadata.academicYear, ...safeStringArray(fallback.academicYears)]);
  const terms = uniqueStrings([metadata.term, ...safeStringArray(fallback.terms)]);
  const assessments = uniqueStrings([metadata.linkedAssessmentName, ...safeStringArray(fallback.assessments)]);
  const documentTypes = uniqueStrings([metadata.documentCategory, ...safeStringArray(fallback.documentTypes)]);
  const base: DocumentMetadata = {
    ...fallback,
    sourceDate: metadata.sourceDate || fallback.sourceDate,
    academicYear: metadata.academicYear || fallback.academicYear,
    term: metadata.term || fallback.term,
    linkedAssessmentName: metadata.linkedAssessmentName || fallback.linkedAssessmentName || document.title,
    documentCategory: metadata.documentCategory || fallback.documentCategory,
    ignoreInstrumentalMusic: metadata.ignoreInstrumentalMusic || fallback.ignoreInstrumentalMusic,
    subjects,
    topics,
    academicYears,
    terms,
    assessments,
    documentTypes,
    teacherNames,
    skills,
    tags,
    metadataConfidence: metadata.metadataConfidence ?? fallback.metadataConfidence ?? 'Low',
    metadataSource: metadata.metadataSource ?? 'AI generated',
    shouldAffectAcademicPerformance:
      shouldDocumentAffectAcademicPerformance({
        ...fallback,
        documentCategory: metadata.documentCategory || fallback.documentCategory,
        linkedAssessmentName: metadata.linkedAssessmentName || fallback.linkedAssessmentName || document.title,
        ignoreInstrumentalMusic: metadata.ignoreInstrumentalMusic || fallback.ignoreInstrumentalMusic,
        subjects,
        topics,
        tags,
      })
        ? true
        : metadata.shouldAffectAcademicPerformance ?? fallback.shouldAffectAcademicPerformance,
    extractedFacts: uniqueStrings([...safeStringArray(metadata.extractedFacts), ...safeStringArray(fallback.extractedFacts)]),
    inferredMetadata: uniqueStrings([...safeStringArray(metadata.inferredMetadata), ...safeStringArray(fallback.inferredMetadata)]),
  };

  return {
    ...base,
    collections: uniqueStrings([
      ...safeStringArray(base.collections),
      base.documentCategory,
      base.term,
      base.academicYear,
      base.linkedAssessmentName,
      ...subjects,
      ...documentTypes,
    ]).slice(0, 12),
  };
}

function applyAnalysedDocument(document: ResearchDocument, analysis?: DocumentMetadataAnalysisResponse) {
  const fallback = getDocumentMetadata(document);
  const metadata = metadataFromDocumentAnalysis(document, fallback, analysis);
  const extractionSummary = buildExtractionSummary(document, metadata, [], analysis);
  return {
    ...document,
    summary: buildEvidenceAwareSummary({
      title: document.title,
      text: document.extractedText ?? '',
      metadata,
      analysis,
    }),
    tags: metadata.tags.length ? metadata.tags : document.tags,
    metadata,
    extractionSummary,
    collectionIds: metadata.collections.map(collectionIdFromName),
  };
}

function PerformancePage({
  records,
  summaries,
  documents,
  tutorLessons,
  tutorAttempts,
  tutorMemory,
  storageStatus,
  userId,
  setState,
}: {
  records: PerformanceRecord[];
  summaries: PerformanceSummary[];
  documents: ResearchDocument[];
  tutorLessons: TutorLesson[];
  tutorAttempts: TutorAttempt[];
  tutorMemory: TutorMemory;
  storageStatus: ReturnType<typeof useResearchState>['storageStatus'];
  userId?: string | null;
  setState: ReturnType<typeof useResearchState>['setState'];
}) {
  const [form, setForm] = useState({
    title: '',
    subject: '',
    date: '',
    academicYear: '',
    term: '',
    assessmentType: 'exam' as AssessmentType,
    score: '',
    maxScore: '',
    percentage: '',
    grade: '',
    rank: '',
    teacher: '',
    teacherComment: '',
    effort: '',
    attainment: '',
    predictedGrade: '',
    targetGrade: '',
    strengths: '',
    weaknesses: '',
    actionPoints: '',
  });
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [selectedPeriod, setSelectedPeriod] = useState<ProgressPeriod>('This Academic Year');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const academicRecords = useMemo(() => getAcademicPerformanceRecords(records), [records]);
  const musicRecords = useMemo(() => records.filter(shouldTreatAsInstrumentalPerformanceRecord), [records]);
  const academicSubjects = useMemo(() => Object.keys(getSubjectGroups(academicRecords)), [academicRecords]);
  const musicSubjects = useMemo(() => Object.keys(getSubjectGroups(musicRecords)), [musicRecords]);
  const subjectOptions = useMemo(() => ['All Subjects', ...academicSubjects, ...musicSubjects.filter((subject) => !academicSubjects.includes(subject))], [academicSubjects, musicSubjects]);
  const availableRecords = musicSubjects.includes(selectedSubject) && !academicSubjects.includes(selectedSubject) ? musicRecords : academicRecords;
  const filteredRecords = useMemo(
    () => filterProgressRecords(availableRecords, selectedSubject, selectedPeriod, customStart, customEnd),
    [availableRecords, customEnd, customStart, selectedPeriod, selectedSubject],
  );
  const sortedRecords = useMemo(() => sortRecordsByAssessmentDate(filteredRecords), [filteredRecords]);
  const matchingSummary = useMemo(() => {
    const recordKey = filteredRecords.map((record) => record.id).sort().join('|');
    return summaries.find((summary) => summary.recordIds?.slice().sort().join('|') === recordKey);
  }, [filteredRecords, summaries]);
  const learningSummary = useMemo(
    () => buildLearningSummary(filteredRecords, selectedSubject, matchingSummary),
    [filteredRecords, matchingSummary, selectedSubject],
  );
  const teacherInsights = useMemo(() => buildTeacherInsights(filteredRecords, matchingSummary?.teacherThemes), [filteredRecords, matchingSummary?.teacherThemes]);
  const recommendations = useMemo(
    () => buildProgressRecommendations(filteredRecords, tutorLessons, tutorAttempts, tutorMemory, documents, selectedSubject, matchingSummary?.coachingRecommendations),
    [documents, filteredRecords, matchingSummary?.coachingRecommendations, selectedSubject, tutorAttempts, tutorLessons, tutorMemory],
  );
  const analysableDocuments = documents.filter((document) => document.extractedText?.trim() && (document.status === 'Ready' || document.status === 'Indexed'));
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

  function startEditingRecord(record: PerformanceRecord) {
    setEditingRecordId(record.id);
    setForm({
      title: record.title,
      subject: record.subject,
      date: record.date,
      academicYear: record.academicYear ?? '',
      term: record.term ?? '',
      assessmentType: record.assessmentType,
      score: record.score?.toString() ?? '',
      maxScore: record.maxScore?.toString() ?? '',
      percentage: record.percentage?.toString() ?? '',
      grade: record.grade ?? '',
      rank: record.rank ?? '',
      teacher: record.teacher ?? '',
      teacherComment: record.teacherComment ?? '',
      effort: record.effort ?? '',
      attainment: record.attainment ?? '',
      predictedGrade: record.predictedGrade ?? '',
      targetGrade: record.targetGrade ?? '',
      strengths: record.strengths.join(', '),
      weaknesses: record.weaknesses.join(', '),
      actionPoints: record.actionPoints.join(', '),
    });
    setStatusMessage(`Editing ${record.title}. Save changes in the manual entry form.`);
  }

  function buildRecordFromForm(existing?: PerformanceRecord): PerformanceRecord | null {
    const subject = form.subject.trim();
    if (!subject) return null;

    return {
      id: existing?.id ?? `performance-${Date.now()}`,
      sourceDocumentId: existing?.sourceDocumentId,
      title: form.title.trim() || `${subject} ${form.assessmentType}`,
      date: form.date,
      academicYear: form.academicYear.trim() || undefined,
      term: form.term.trim() || undefined,
      subject,
      assessmentType: form.assessmentType,
      domain: getPerformanceDomain(subject, form.assessmentType, form.title),
      excludeFromAcademicAnalysis: getPerformanceDomain(subject, form.assessmentType, form.title) !== 'academic',
      score: parseOptionalNumber(form.score),
      maxScore: parseOptionalNumber(form.maxScore),
      percentage: computedPercentage,
      grade: form.grade.trim() || undefined,
      rank: form.rank.trim() || undefined,
      teacher: form.teacher.trim() || undefined,
      teacherComment: form.teacherComment.trim() || undefined,
      effort: form.effort.trim() || undefined,
      attainment: form.attainment.trim() || undefined,
      predictedGrade: form.predictedGrade.trim() || undefined,
      targetGrade: form.targetGrade.trim() || undefined,
      marksExtracted: Boolean(computedPercentage !== undefined || form.score.trim() || form.maxScore.trim() || form.grade.trim() || form.attainment.trim() || form.predictedGrade.trim() || form.targetGrade.trim()),
      extractionConfidence: 'High',
      fieldConfidence: {
        subject: 'High',
        teacher: form.teacher.trim() ? 'High' : undefined,
        teacherComment: form.teacherComment.trim() ? 'High' : undefined,
        effort: form.effort.trim() ? 'High' : undefined,
        attainment: form.attainment.trim() ? 'High' : undefined,
        score: form.score.trim() ? 'High' : undefined,
        maxScore: form.maxScore.trim() ? 'High' : undefined,
        percentage: computedPercentage !== undefined ? 'High' : undefined,
        grade: form.grade.trim() ? 'High' : undefined,
        predictedGrade: form.predictedGrade.trim() ? 'High' : undefined,
        targetGrade: form.targetGrade.trim() ? 'High' : undefined,
        rank: form.rank.trim() ? 'High' : undefined,
      },
      reviewStatus: 'confirmed',
      strengths: splitList(form.strengths),
      weaknesses: splitList(form.weaknesses),
      actionPoints: splitList(form.actionPoints),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
  }

  function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = form.subject.trim();

    if (!subject) {
      setStatusMessage('Add a subject before saving a performance record.');
      return;
    }

    const existing = records.find((record) => record.id === editingRecordId);
    const record = buildRecordFromForm(existing);
    if (!record) return;

    setState((current) =>
      (() => {
        const performanceRecords = existing
          ? current.performanceRecords.map((item) => (item.id === existing.id ? record : item))
          : [record, ...current.performanceRecords];

        return withDerivedCollections({
          ...current,
          performanceRecords,
          documents: current.documents.map((document) => {
            const metadata = buildDocumentMetadata(document, performanceRecords);
            const extractionSummary = buildExtractionSummary(document, metadata, performanceRecords);

            return {
              ...document,
              status: document.status === 'Needs review' && extractionSummary.needsReview === 0 ? 'Ready' : document.status,
              metadata,
              extractionSummary,
            };
          }),
        });
      })(),
    );
    setEditingRecordId('');
    setForm((current) => ({
      ...current,
      title: '',
      subject: '',
      date: '',
      academicYear: '',
      term: '',
      score: '',
      maxScore: '',
      percentage: '',
      grade: '',
      rank: '',
      teacher: '',
      teacherComment: '',
      effort: '',
      attainment: '',
      predictedGrade: '',
      targetGrade: '',
      strengths: '',
      weaknesses: '',
      actionPoints: '',
    }));
    setStatusMessage(`${record.title} was ${existing ? 'updated' : 'saved'}.`);
  }

  async function deletePerformanceRecord(record: PerformanceRecord) {
    try {
      await deleteRemoteRowsIfNeeded({ performance_records: [record.id] }, storageStatus, userId);
      setState((current) => {
        const performanceRecords = current.performanceRecords.filter((item) => item.id !== record.id);
        return withDerivedCollections({
          ...current,
          performanceRecords,
          documents: current.documents.map((document) => ({
            ...document,
            metadata: buildDocumentMetadata(document, performanceRecords),
          })),
        });
      });
      setStatusMessage(`${record.title} was deleted.`);
    } catch (error) {
      setStatusMessage('Progress record was not deleted. Check your connection and try again.');
    }
  }

  async function handleAnalyseDocument() {
    const document = documents.find((item) => item.id === selectedDocumentId);
    if (!document?.extractedText) {
      setStatusMessage('Choose an uploaded report first.');
      return;
    }

    setIsAnalysing(true);
    setStatusMessage(`Analysing ${document.title} for academic performance records...`);

    try {
      const metadata = getDocumentMetadata(document, records);

      if (shouldTreatAsInstrumentalPerformanceDocument(metadata)) {
        setStatusMessage(`${document.title} is stored as source material, but its instrumental or performance lesson content is ignored for academic performance trends.`);
        return;
      }

      const response = await analysePerformanceDocument({ title: document.title, text: document.extractedText });
      const newRecords = response.records
        .map((record) => createRecordFromAnalysis(record, document.id, document.title, metadata))
        .filter((record): record is PerformanceRecord => Boolean(record))
        .map((record) =>
          shouldExcludeRecordForInstrumentalPreference(record, metadata)
            ? { ...record, domain: record.domain ?? 'performance', excludeFromAcademicAnalysis: true }
            : record,
        );

      if (newRecords.length === 0) {
        setStatusMessage(response.message || 'No reliable performance records were found in that document.');
        return;
      }

      setState((current) => {
        const performanceRecords = [...newRecords, ...current.performanceRecords.filter((record) => record.sourceDocumentId !== document.id)];
        const documents = current.documents.map((item) =>
          item.id === document.id
            ? {
                ...item,
                metadata: buildDocumentMetadata(item, performanceRecords),
              }
            : item,
        );
        return withDerivedCollections({
          ...current,
          documents,
          performanceRecords,
        });
      });
      setStatusMessage(`Added ${newRecords.length} performance record${newRecords.length === 1 ? '' : 's'} from ${document.title}.`);
    } catch (error) {
      setStatusMessage('This report could not be analysed. Try again.');
    } finally {
      setIsAnalysing(false);
    }
  }

  async function handleGenerateAdvice() {
    const adviceRecords = filteredRecords.filter(isAcademicPerformanceRecord);
    if (adviceRecords.length === 0) {
      setStatusMessage('Add at least one academic performance record before generating advice.');
      return;
    }

    setIsGeneratingAdvice(true);
    setStatusMessage(`Updating the summary for ${selectedSubject} / ${selectedPeriod}…`);

    try {
      const advice = await generatePerformanceAdvice(adviceRecords);
      const summary = buildPerformanceSummary(adviceRecords, advice);
      setState((current) => ({
        ...current,
        performanceSummaries: [summary, ...current.performanceSummaries],
      }));
      setStatusMessage('Progress summary updated.');
    } catch (error) {
      setStatusMessage('The progress summary could not be updated. Try again.');
    } finally {
      setIsGeneratingAdvice(false);
    }
  }

  return (
    <div className="progress-page mx-auto max-w-6xl space-y-10">
      <div className="progress-page__header max-w-5xl">
        <SectionHeader title="Your learning, clearly explained" copy="A tutor's view of what is going well, what has changed, what teachers repeat, and what to do next." compact />
      </div>

      {records.length > 0 ? <div className="progress-control-deck border-y border-ink/[0.06] py-6">
        <div className="progress-control-deck__controls grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">
            Focus
            <select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-ink/[0.08] bg-white px-3 text-sm font-medium normal-case tracking-normal text-ink shadow-sm outline-none ring-ink/10 focus:ring-4">
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
              {!subjectOptions.includes('Music') ? <option value="Music">Music</option> : null}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">
            Period
            <select value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value as ProgressPeriod)} className="mt-2 h-11 w-full rounded-lg border border-ink/[0.08] bg-white px-3 text-sm font-medium normal-case tracking-normal text-ink shadow-sm outline-none ring-ink/10 focus:ring-4">
              {progressPeriods.map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleGenerateAdvice} disabled={isGeneratingAdvice || filteredRecords.filter(isAcademicPerformanceRecord).length === 0} className="h-11 self-end rounded-lg border border-ink/10 bg-white px-4 text-sm font-semibold text-ink shadow-sm hover:border-ink/20 hover:bg-paper/50 disabled:cursor-not-allowed disabled:bg-paper disabled:text-graphite/45">
            {isGeneratingAdvice ? 'Reading reports…' : 'Refresh tutor view'}
          </button>
        </div>
        {selectedPeriod === 'Custom Range' ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <FormField label="From"><input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="To"><input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
          </div>
        ) : null}
        {statusMessage ? <p key={statusMessage} role="status" className="status-strip status-enter mt-3 text-sm leading-7 text-graphite/80">{statusMessage}</p> : null}
      </div> : null}

      {records.length === 0 ? (
        <EmptyState
          title={documents.some((document) => document.extractedText?.trim()) ? 'Turn uploaded reports into evidence' : 'Add the first report or assessment'}
          copy={documents.some((document) => document.extractedText?.trim()) ? 'Analyse an uploaded report so teacher comments, strengths, targets, grades, and recommendations can feed Progress.' : 'Upload a report, or add a progress record below.'}
        />
      ) : null}

      {records.length > 0 && filteredRecords.length === 0 ? (
        <EmptyState title="No evidence in this view" copy="Choose another subject or time period to return to the reports and teacher feedback already in Progress." />
      ) : null}

      {filteredRecords.length > 0 ? (
        <>
          <section className="progress-hero surface-raised px-6 py-8 sm:px-9 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">How am I doing?</p>
            <div className="mt-4 max-w-4xl">
              <p className="text-sm font-semibold text-graphite/80">{selectedSubject} · {selectedPeriod}</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-ink sm:text-4xl">{learningSummary.headline}</h2>
              <p className="mt-4 text-base leading-8 text-graphite/80 sm:text-lg">{learningSummary.body}</p>
            </div>
          </section>

          <section className="progress-story progress-story--change border-t border-ink/[0.06] pt-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">What changed?</p>
            <TrendChart records={sortedRecords} documents={documents} selectedSubject={selectedSubject} storyMode />
          </section>

          <section className="progress-story progress-story--teachers border-t border-ink/[0.06] pt-10">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">What do teachers keep telling me?</p>
              <h2 className="mt-3 font-serif text-2xl font-semibold text-ink sm:text-3xl">The messages worth carrying into the next piece of work.</h2>
            </div>
            {teacherInsights.length ? (
              <div className="progress-story__body mt-7 divide-y divide-ink/[0.06]">
                {teacherInsights.slice(0, 3).map((insight) => <TeacherInsightCard key={`${insight.theme}-${insight.classification}`} insight={insight} />)}
              </div>
            ) : (
              <p className="mt-5 rounded-lg bg-paper/55 p-4 text-sm leading-7 text-graphite/80">There is not enough written teacher feedback in this view to identify a repeated message yet.</p>
            )}
          </section>

          <section className="progress-story progress-story--plan border-t border-ink/[0.06] pt-10">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">What should I do next?</p>
              <h2 className="mt-3 font-serif text-2xl font-semibold text-ink sm:text-3xl">A short plan, in priority order.</h2>
            </div>
            <div className="progress-story__body mt-7 divide-y divide-ink/[0.06] border-y border-ink/[0.06]">
              {recommendations.map((recommendation, index) => (
                <article key={recommendation.title} className="grid gap-4 py-6 sm:grid-cols-[42px_1fr]">
                  <span className="font-serif text-2xl text-brass">{index + 1}</span>
                  <div className="max-w-4xl">
                    <h3 className="text-lg font-semibold text-ink">{recommendation.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-graphite/80">{recommendation.action}</p>
                    <p className="mt-3 text-sm leading-7 text-graphite/80"><span className="font-semibold text-ink">Why this now:</span> {recommendation.why}</p>
                    {recommendation.evidence ? <p className="mt-2 border-l-2 border-brass/35 pl-3 text-sm italic leading-6 text-graphite/80">{recommendation.evidence}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <details className={`progress-evidence-manager ${records.length ? 'border-t border-ink/[0.06]' : ''} pt-6`}>
        <summary className="cursor-pointer text-sm font-semibold text-graphite/80">{records.length ? 'Manage the evidence behind this view' : 'Add a progress record'}</summary>
        <div className="progress-evidence-manager__workspace mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <form onSubmit={handleManualSubmit} className="progress-manual-entry rounded-lg border border-ink/10 bg-paper/50 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">
            <ClipboardList size={15} />
            Manual entry
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <FormField label="Assessment title"><input value={form.title} onChange={(event) => updateForm('title', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Subject"><input value={form.subject} onChange={(event) => updateForm('subject', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Academic year" hint="e.g. 2025-2026"><input value={form.academicYear} onChange={(event) => updateForm('academicYear', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Term"><input value={form.term} onChange={(event) => updateForm('term', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Assessment type"><select value={form.assessmentType} onChange={(event) => updateForm('assessmentType', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4">{assessmentTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></FormField>
            <FormField label="Teacher"><input value={form.teacher} onChange={(event) => updateForm('teacher', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <details className="rounded-lg border border-ink/10 bg-white p-3 sm:col-span-2">
              <summary className="cursor-pointer text-sm font-semibold text-ink">Add exact date (optional)</summary>
              <FormField label="Exact date" className="mt-3"><input type="date" value={form.date} onChange={(event) => updateForm('date', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            </details>
            <FormField label="Score"><input value={form.score} onChange={(event) => updateForm('score', event.target.value)} inputMode="decimal" className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Maximum score"><input value={form.maxScore} onChange={(event) => updateForm('maxScore', event.target.value)} inputMode="decimal" className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Percentage" hint={computedPercentage !== undefined ? `${computedPercentage}% calculated` : undefined}><input value={form.percentage} onChange={(event) => updateForm('percentage', event.target.value)} inputMode="decimal" className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Grade"><input value={form.grade} onChange={(event) => updateForm('grade', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Rank or set"><input value={form.rank} onChange={(event) => updateForm('rank', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Effort"><input value={form.effort} onChange={(event) => updateForm('effort', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Attainment"><input value={form.attainment} onChange={(event) => updateForm('attainment', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Predicted grade"><input value={form.predictedGrade} onChange={(event) => updateForm('predictedGrade', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Target grade"><input value={form.targetGrade} onChange={(event) => updateForm('targetGrade', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Teacher comment" className="sm:col-span-2"><textarea value={form.teacherComment} onChange={(event) => updateForm('teacherComment', event.target.value)} rows={3} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Strengths" hint="Separate items with commas or new lines"><textarea value={form.strengths} onChange={(event) => updateForm('strengths', event.target.value)} rows={2} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Areas to improve" hint="Separate items with commas or new lines"><textarea value={form.weaknesses} onChange={(event) => updateForm('weaknesses', event.target.value)} rows={2} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
            <FormField label="Action points" className="sm:col-span-2"><textarea value={form.actionPoints} onChange={(event) => updateForm('actionPoints', event.target.value)} rows={2} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
          </div>
          <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-graphite">
            <FilePlus2 size={17} />
            {editingRecordId ? 'Save changes' : 'Save record'}
          </button>
          {editingRecordId ? (
            <button
              type="button"
              onClick={() => {
                setEditingRecordId('');
                setForm((current) => ({
                  ...current,
                  title: '',
                  subject: '',
                  date: '',
                  score: '',
                  maxScore: '',
                  percentage: '',
                  grade: '',
                  rank: '',
                  teacher: '',
                  teacherComment: '',
                  effort: '',
                  attainment: '',
                  predictedGrade: '',
                  targetGrade: '',
                  strengths: '',
                  weaknesses: '',
                  actionPoints: '',
                }));
              }}
              className="ml-2 mt-4 rounded-lg border border-ink/10 px-4 py-3 text-sm font-semibold text-ink"
            >
              Cancel edit
            </button>
          ) : null}
          </form>

        <div className="progress-evidence-manager__rail space-y-6">
          <div className="progress-analysis-panel rounded-lg border border-ink/10 bg-paper/50 p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">
              <Sparkles size={15} />
              Analyse uploaded report
            </div>
            <p className="mt-3 text-sm leading-7 text-graphite/80">Select an uploaded report. Research OS will look for academic records and will not invent missing marks.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <FormField label="Uploaded report" className="min-w-0 flex-1"><select value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4"><option value="">Choose a document</option>{analysableDocuments.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}</select></FormField>
              <button type="button" onClick={handleAnalyseDocument} disabled={isAnalysing || analysableDocuments.length === 0} className="self-end rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-graphite disabled:cursor-not-allowed disabled:bg-graphite/55">
                {isAnalysing ? 'Analysing...' : 'Analyse'}
              </button>
            </div>
            {analysableDocuments.length === 0 ? (
              <p className="mt-3 rounded-lg bg-paper/70 p-3 text-sm leading-6 text-graphite/80">Upload a TXT, PDF, or DOCX report first.</p>
            ) : null}
          </div>

        </div>
        </div>

        <div className="progress-record-ledger mt-9 grid gap-3">
          {records.length ? (
            records.map((record) => (
              <article key={record.id} className="progress-record-ledger__item rounded-lg border border-ink/10 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{record.title}</p>
                      {!isAcademicPerformanceRecord(record) ? (
                        <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-semibold text-graphite/80">Ignored in academic trends</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-graphite/80">
                      {[record.subject, record.date, record.academicYear, record.term, formatResult(record)].filter(Boolean).join(' / ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <IconTextButton icon={Edit3} label="Edit" onClick={() => startEditingRecord(record)} />
                    <IconTextButton
                      icon={Trash2}
                      label="Delete"
                      danger
                      onClick={() =>
                        setConfirmAction({
                          title: `Delete ${record.title}?`,
                          body: 'This removes the performance record and updates metadata, timeline, Tutor recommendations, and source details.',
                          confirmLabel: 'Delete record',
                          onConfirm: () => deletePerformanceRecord(record),
                        })
                      }
                    />
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="Add a record to edit" copy="Saved or extracted performance records will appear here." />
          )}
        </div>
      </details>
      <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
    </div>
  );
}

function FormField({ label, hint, className = '', children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="flex min-h-5 items-baseline justify-between gap-3 text-xs font-semibold text-graphite/80">
        <span>{label}</span>
        {hint ? <span className="font-normal text-graphite/80">{hint}</span> : null}
      </span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

type ProgressPeriod = 'This Term' | 'This Academic Year' | 'Last Academic Year' | 'All Time' | 'Custom Range';

const progressPeriods: ProgressPeriod[] = ['This Term', 'This Academic Year', 'Last Academic Year', 'All Time', 'Custom Range'];

type TrendPoint = {
  subject: string;
  date: string;
  time: number;
  percentage: number;
  records: PerformanceRecord[];
};

type TrendChange = {
  subject: string;
  from: TrendPoint;
  to: TrendPoint;
  delta: number;
};

type ReportSnapshot = {
  key: string;
  title: string;
  date: string;
  sortKey: string;
  records: PerformanceRecord[];
};

function parseAssessmentDateParts(date: string) {
  const value = date.trim();
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) };
  }

  const ukMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (ukMatch) {
    const year = Number(ukMatch[3].length === 2 ? `20${ukMatch[3]}` : ukMatch[3]);
    return { year, month: Number(ukMatch[2]), day: Number(ukMatch[1]) };
  }

  return undefined;
}

function parseDateValue(date: string) {
  const parts = parseAssessmentDateParts(date);
  if (parts && parts.month >= 1 && parts.month <= 12 && parts.day >= 1 && parts.day <= 31) {
    const time = Date.UTC(parts.year, parts.month - 1, parts.day);
    return Number.isFinite(time) ? time : 0;
  }

  const time = new Date(date).getTime();
  return Number.isFinite(time) ? time : 0;
}

function hasExactAssessmentDate(date: string | undefined) {
  return Boolean(date?.trim() && parseDateValue(date) > 0);
}

function getAssessmentDateKey(date: string) {
  const parts = parseAssessmentDateParts(date);
  if (!parts) return date.trim() || 'undated';
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function formatDisplayDate(date: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const time = parseDateValue(date);
  if (!time) return date || 'Undated';
  return new Intl.DateTimeFormat('en-GB', options).format(new Date(time));
}

function getAcademicYearSortValue(academicYear?: string) {
  const match = academicYear?.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : 0;
}

function getTermSortValue(term?: string) {
  const normalized = term?.toLowerCase() ?? '';
  if (normalized.includes('michaelmas') || normalized.includes('autumn')) return 1;
  if (normalized.includes('lent') || normalized.includes('spring')) return 2;
  if (normalized.includes('summer') || normalized.includes('trinity')) return 3;
  return 4;
}

function normalizeSortText(value?: string) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getRecordAssessmentName(record: PerformanceRecord) {
  return record.title.trim() || record.assessmentType;
}

function getRecordAcademicSortKey(record: PerformanceRecord) {
  if (hasExactAssessmentDate(record.date)) {
    const exactTime = parseDateValue(record.date);
    const exactDate = new Date(exactTime);
    return [
      String(getAcademicYearSortValue(getCurrentAcademicYear(exactDate))).padStart(4, '0'),
      String(getTermSortValue(getCurrentTermName(exactDate))).padStart(2, '0'),
      '0',
      String(exactTime).padStart(16, '0'),
    ].join('|');
  }

  return [
    String(getAcademicYearSortValue(record.academicYear)).padStart(4, '0'),
    String(getTermSortValue(record.term)).padStart(2, '0'),
    '1',
    normalizeSortText(getRecordAssessmentName(record)),
    record.createdAt,
  ].join('|');
}

function getRecordAxisLabel(record: PerformanceRecord) {
  if (hasExactAssessmentDate(record.date)) return formatDisplayDate(record.date);
  return [record.term, getRecordAssessmentName(record)].filter(Boolean).join(' ') || record.academicYear || 'Assessment';
}

function getRecordTimelineLabel(record: PerformanceRecord) {
  if (hasExactAssessmentDate(record.date)) return formatDisplayDate(record.date);
  return [getRecordAxisLabel(record), record.academicYear].filter(Boolean).join(' / ') || 'Undated assessment';
}

function sortRecordsByAssessmentDate(records: PerformanceRecord[]) {
  return [...records].sort((a, b) => getRecordAcademicSortKey(a).localeCompare(getRecordAcademicSortKey(b)) || a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title));
}

function getReportSnapshotKey(record: PerformanceRecord) {
  if (record.sourceDocumentId) {
    return [
      record.sourceDocumentId,
      hasExactAssessmentDate(record.date) ? getAssessmentDateKey(record.date) : record.academicYear ?? '',
      record.term ?? '',
    ].join('|');
  }

  return [
    getRecordAssessmentName(record),
    hasExactAssessmentDate(record.date) ? getAssessmentDateKey(record.date) : record.academicYear ?? '',
    record.term ?? '',
    getRecordAssessmentName(record),
  ].join('|');
}

function getReportSnapshots(records: PerformanceRecord[]) {
  const snapshots = new Map<string, ReportSnapshot>();

  records.forEach((record) => {
    const key = getReportSnapshotKey(record);
    const existing = snapshots.get(key);
    if (existing) {
      existing.records.push(record);
      return;
    }

    snapshots.set(key, {
      key,
      title: record.title || 'Assessment report',
      date: record.date,
      sortKey: getRecordAcademicSortKey(record),
      records: [record],
    });
  });

  return [...snapshots.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.title.localeCompare(b.title));
}

function getSubjectTrendSeries(records: PerformanceRecord[]) {
  const bySubjectDate = new Map<string, TrendPoint>();

  records.forEach((record) => {
    const percentage = getRecordPercentage(record);
    if (percentage === undefined) return;

    const subject = record.subject.trim() || 'Unspecified subject';
    const assessmentKey = getReportSnapshotKey(record);
    const key = `${subject.toLowerCase()}|${assessmentKey}`;
    const existing = bySubjectDate.get(key);
    if (existing) {
      existing.records.push(record);
      existing.percentage = Math.round(existing.records.reduce((total, item) => total + (getRecordPercentage(item) ?? 0), 0) / existing.records.length);
      return;
    }

    bySubjectDate.set(key, {
      subject,
      date: record.date,
      time: hasExactAssessmentDate(record.date) ? parseDateValue(record.date) : 0,
      percentage,
      records: [record],
    });
  });

  const bySubject = [...bySubjectDate.values()].reduce<Record<string, TrendPoint[]>>((groups, point) => {
    groups[point.subject] = [...(groups[point.subject] ?? []), point];
    return groups;
  }, {});

  Object.keys(bySubject).forEach((subject) => {
    bySubject[subject] = bySubject[subject].sort((a, b) => getRecordAcademicSortKey(a.records[0]).localeCompare(getRecordAcademicSortKey(b.records[0])));
  });

  return bySubject;
}

function getTrendEligibleSeries(records: PerformanceRecord[]) {
  return Object.fromEntries(Object.entries(getSubjectTrendSeries(records)).filter(([, points]) => new Set(points.map((point) => getReportSnapshotKey(point.records[0]))).size >= 2));
}

function getTrendChanges(records: PerformanceRecord[]) {
  return Object.entries(getTrendEligibleSeries(records)).flatMap(([subject, points]) =>
    points.slice(1).map((point, index) => ({
      subject,
      from: points[index],
      to: point,
      delta: point.percentage - points[index].percentage,
    })),
  );
}

function getCurrentAcademicYear(date = new Date()) {
  const year = date.getFullYear();
  return date.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function getPreviousAcademicYear(date = new Date()) {
  const currentStart = Number(getCurrentAcademicYear(date).slice(0, 4));
  return `${currentStart - 1}-${currentStart}`;
}

function getCurrentTermName(date = new Date()) {
  const month = date.getMonth();
  if (month >= 8 || month <= 0) return 'Michaelmas';
  if (month <= 3) return 'Lent';
  return 'Summer';
}

function filterProgressRecords(records: PerformanceRecord[], subject: string, period: ProgressPeriod, customStart: string, customEnd: string) {
  const subjectFiltered = records.filter((record) => subject === 'All Subjects' || record.subject === subject || (subject === 'Music' && isMusicOrPerformanceSubject(record.subject)));
  const currentAcademicYear = getCurrentAcademicYear();
  const previousAcademicYear = getPreviousAcademicYear();
  const currentTerm = getCurrentTermName().toLowerCase();
  const startTime = customStart ? parseDateValue(customStart) : undefined;
  const endTime = customEnd ? parseDateValue(customEnd) : undefined;

  return subjectFiltered.filter((record) => {
    if (period === 'All Time') return true;
    if (period === 'This Academic Year') return record.academicYear === currentAcademicYear || (hasExactAssessmentDate(record.date) && getCurrentAcademicYear(new Date(parseDateValue(record.date))) === currentAcademicYear);
    if (period === 'Last Academic Year') return record.academicYear === previousAcademicYear || (hasExactAssessmentDate(record.date) && getCurrentAcademicYear(new Date(parseDateValue(record.date))) === previousAcademicYear);
    if (period === 'This Term') return record.term?.toLowerCase() === currentTerm;
    if (period === 'Custom Range') {
      if (!hasExactAssessmentDate(record.date)) return false;
      const time = parseDateValue(record.date);
      return (!startTime || time >= startTime) && (!endTime || time <= endTime);
    }
    return true;
  });
}

function getTrendDelta(records: PerformanceRecord[]) {
  const changes = getTrendChanges(records);
  if (changes.length === 0) return undefined;
  const pointsBySubject = getTrendEligibleSeries(records);
  const subjectDeltas = Object.values(pointsBySubject)
    .map((points) => points[points.length - 1].percentage - points[0].percentage)
    .filter((delta) => Number.isFinite(delta));
  if (subjectDeltas.length === 0) return undefined;
  return Math.round(subjectDeltas.reduce((total, delta) => total + delta, 0) / subjectDeltas.length);
}

function normalizeEvidenceTerm(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/[.]+$/, '');
}

function topEvidenceTerms(records: PerformanceRecord[], field: 'strengths' | 'weaknesses' | 'actionPoints') {
  const byTerm = new Map<string, { term: string; records: PerformanceRecord[] }>();
  records.forEach((record) => {
    record[field].forEach((raw) => {
      const term = normalizeEvidenceTerm(raw);
      if (!term) return;
      const key = term.toLowerCase();
      const existing = byTerm.get(key) ?? { term, records: [] };
      existing.records.push(record);
      byTerm.set(key, existing);
    });
  });
  return [...byTerm.values()].sort((a, b) => b.records.length - a.records.length || a.term.localeCompare(b.term));
}

const teacherThemeConcepts = [
  {
    theme: 'Reasoning & Evidence',
    why: 'Making the reasoning visible helps a teacher reward what you know, not merely the final answer.',
    phrases: ['justify conclusions', 'conclusions need evidence', 'use supporting evidence', 'evidence selection', 'explain the answer', 'link results to conclusions', 'interpret data', 'analyse ideas', 'evaluate arguments', 'support each point', 'show reasoning', 'draw conclusions'],
  },
  {
    theme: 'Accuracy & Checking',
    why: 'A reliable checking routine protects marks that understanding alone should already have earned.',
    phrases: ['check calculations', 'careless arithmetic', 'verify units', 'significant figures', 'numerical accuracy', 'multi step accuracy', 'proofread work', 'avoid small errors', 'show each step', 'precise answers'],
  },
  {
    theme: 'Communication & Structure',
    why: 'Clear structure and precise language make good ideas easier to follow and harder to misread.',
    phrases: ['organise writing', 'structure paragraphs', 'clear expression', 'technical vocabulary', 'subject terminology', 'present ideas clearly', 'well organised answer', 'coherent argument'],
  },
  {
    theme: 'Preparation & Exam Craft',
    why: 'Good preparation turns knowledge into a dependable performance when time and marks are limited.',
    phrases: ['exam technique', 'manage time', 'answer the question', 'past paper practice', 'revision plan', 'prepare thoroughly', 'plan before writing', 'work under timed conditions'],
  },
  {
    theme: 'Independent Learning',
    why: 'Independent habits make progress continue between lessons rather than waiting for the next prompt.',
    phrases: ['work independently', 'show initiative', 'take responsibility', 'respond to challenge', 'seek extension', 'self directed study', 'act on feedback', 'ask useful questions'],
  },
  {
    theme: 'Engagement & Effort',
    why: 'Sustained attention and purposeful effort make later independent work much easier.',
    phrases: ['contribute in class', 'sustained effort', 'work diligently', 'participate in discussion', 'stay focused', 'positive attitude', 'engage with learning', 'show enthusiasm'],
  },
  {
    theme: 'Practical & Applied Thinking',
    why: 'Careful practical thinking connects classroom knowledge to methods, observations, and real evidence.',
    phrases: ['plan experiments', 'practical work', 'laboratory method', 'investigate results', 'experimental design', 'apply knowledge', 'method and variables', 'organise experiments'],
  },
  {
    theme: 'Confidence & Ambition',
    why: 'Confidence matters when it leads to attempting harder work and showing the full extent of your understanding.',
    phrases: ['show confidence', 'attempt harder questions', 'trust own judgement', 'speak with confidence', 'take intellectual risks', 'believe in ability', 'less hesitant'],
  },
  {
    theme: 'Consistency & Follow-through',
    why: 'Reliable habits make good work repeatable rather than dependent on the day or the subject.',
    phrases: ['work consistently', 'maintain standards', 'complete homework regularly', 'follow through', 'sustain progress', 'meet deadlines', 'reliable effort', 'apply this every time'],
  },
];

const positiveThemeWords = /\b(strong|excellent|good|very good|impressive|confident|clear|secure|effective|well|praise|praised|pleased|engaged|enthusiastic|consistent|attentive|diligent|thoughtful|successful)\b/i;
const needsWorkThemeWords = /\b(needs?|should|must|target|focus|improve|develop|work on|weak|weaker|inconsistent|lack|careless|limited|struggle|difficulty|more|further|ensure|avoid|check|remember|keep|continue|accuracy|significant figures)\b/i;
const improvementThemeWords = /\b(improved|improving|progress|better|developed|stronger|clearer|increasing|now able|has begun|recent improvement)\b/i;

type CommentThemeMention = {
  theme: string;
  why: string;
  kind: 'strength' | 'weakness' | 'improvement';
  record: PerformanceRecord;
  snippet: string;
  source: 'comment' | 'record';
};

type TeacherInsight = {
  theme: string;
  classification: 'Strength' | 'Priority' | 'Improving';
  summary: string;
  why: string;
  subjects: string[];
  quote?: string;
  confidence: 'Early' | 'Moderate' | 'Strong';
  count: number;
};

function splitCommentSentences(comment: string) {
  return comment
    .split(/(?<=[.!?;])\s+|\n+|\s+but\s+|\s+while\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function classifyThemeSentence(sentence: string): CommentThemeMention['kind'] {
  if (improvementThemeWords.test(sentence)) return 'improvement';
  if (needsWorkThemeWords.test(sentence)) return 'weakness';
  if (positiveThemeWords.test(sentence)) return 'strength';
  return 'strength';
}

function extractTeacherCommentThemes(records: PerformanceRecord[]) {
  const mentions: CommentThemeMention[] = [];
  records.forEach((record) => {
    if (!record.teacherComment?.trim()) return;
    splitCommentSentences(record.teacherComment).forEach((sentence) => {
      const concept = inferThemeFromTerm(sentence);
      if (!concept.matched) return;
        mentions.push({
          theme: concept.theme,
          why: concept.why,
          kind: classifyThemeSentence(sentence),
          record,
          snippet: sentence.length > 150 ? `${sentence.slice(0, 147)}...` : sentence,
          source: 'comment',
        });
    });
  });
  return mentions;
}

function titleCaseTheme(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\w\S*/g, (word) => (word.length <= 2 && word !== word.toLowerCase() ? word : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`));
}

const semanticStopWords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'more', 'of', 'on', 'or', 'the', 'their', 'this', 'to', 'with', 'work']);

function semanticStem(value: string) {
  const stem = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/ies$/, 'y')
    .replace(/(ised|ized)$/, 'ize')
    .replace(/(ing|ed)$/, '')
    .replace(/s$/, '');
  return /^organi[sz]e$/.test(stem) ? 'organize' : stem;
}

function semanticTokens(value: string) {
  return new Set(value.split(/\s+/).map(semanticStem).filter((token) => token.length > 2 && !semanticStopWords.has(token)));
}

function semanticPhraseScore(value: string, phrase: string) {
  const valueTokens = semanticTokens(value);
  const phraseTokens = semanticTokens(phrase);
  if (!valueTokens.size || !phraseTokens.size) return 0;
  const overlap = [...phraseTokens].filter((token) => valueTokens.has(token)).length;
  const coverage = overlap / phraseTokens.size;
  const exactPhrase = value.toLowerCase().includes(phrase.toLowerCase()) ? 4 : 0;
  return exactPhrase + coverage * 3 + (overlap >= 2 ? 1 : 0);
}

function inferThemeFromTerm(term: string) {
  const ranked = teacherThemeConcepts
    .map((concept) => ({ ...concept, score: Math.max(...concept.phrases.map((phrase) => semanticPhraseScore(term, phrase))) }))
    .sort((a, b) => b.score - a.score);
  const match = ranked[0];
  return match && match.score >= 2.2 ? { ...match, matched: true } : {
    theme: titleCaseTheme(term),
    why: 'Repeated teacher feedback is worth turning into a deliberate study habit.',
    matched: false,
  };
}

function insightConfidence(count: number, subjects: string[]) {
  if (count >= 3 || subjects.length >= 3) return 'Strong';
  if (count >= 2 || subjects.length >= 2) return 'Moderate';
  return 'Early';
}

function buildTeacherInsightGroups(mentions: CommentThemeMention[], explicitItems: CommentThemeMention[]) {
  const deduplicated = new Map<string, CommentThemeMention>();
  [...mentions, ...explicitItems].forEach((mention) => {
    const key = `${mention.theme}|${mention.kind}|${mention.record.id}`;
    const existing = deduplicated.get(key);
    if (!existing || (existing.source === 'record' && mention.source === 'comment')) deduplicated.set(key, mention);
  });
  const grouped = new Map<string, CommentThemeMention[]>();
  deduplicated.forEach((mention) => {
    grouped.set(mention.theme, [...(grouped.get(mention.theme) ?? []), mention]);
  });

  return [...grouped.entries()]
    .map(([theme, themeMentions]) => {
      const counts = {
        strength: themeMentions.filter((mention) => mention.kind === 'strength').length,
        weakness: themeMentions.filter((mention) => mention.kind === 'weakness').length,
        improvement: themeMentions.filter((mention) => mention.kind === 'improvement').length,
      };
      const dominantKind = counts.improvement > Math.max(counts.strength, counts.weakness)
        ? 'improvement'
        : counts.weakness > 0
          ? 'weakness'
          : 'strength';
      const subjects = uniqueStrings(themeMentions.map((mention) => mention.record.subject)).slice(0, 4);
      const classification = dominantKind === 'improvement' ? 'Improving' : dominantKind === 'weakness' ? 'Priority' : 'Strength';
      const quoteMention = themeMentions.find((mention) => mention.kind === dominantKind && mention.source === 'comment')
        ?? themeMentions.find((mention) => mention.kind === dominantKind)
        ?? themeMentions.find((mention) => mention.source === 'comment')
        ?? themeMentions[0];
      return {
        theme,
        classification,
        summary: counts.strength > 0 && counts.weakness > 0
          ? `Teachers recognise ${theme.toLowerCase()} in your work, but keep asking you to make it more deliberate and reliable.`
          : classification === 'Improving'
          ? `Recent comments suggest that ${theme.toLowerCase()} is becoming more secure.`
          : classification === 'Priority'
            ? `Teachers keep returning to ${theme.toLowerCase()} as the habit most likely to improve the next piece of work.`
            : `Teachers repeatedly recognise ${theme.toLowerCase()} as something worth protecting.`,
        why: themeMentions[0]?.why ?? inferThemeFromTerm(theme).why,
        subjects,
        quote: quoteMention?.snippet,
        confidence: insightConfidence(themeMentions.length, subjects),
        count: themeMentions.length,
      } satisfies TeacherInsight;
    })
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme));
}

function describeEvidenceScope(records: PerformanceRecord[]) {
  const snapshots = getReportSnapshots(records).length;
  if (snapshots >= 6) return `Across ${snapshots} reports, the longer pattern is now useful.`;
  if (snapshots >= 3) return `Across ${snapshots} reports, the repeated messages are becoming clear.`;
  if (snapshots === 2) return 'With two reports, the direction is beginning to show, though it is still early.';
  if (snapshots === 1) return 'This first report is a useful starting point; it should be read as a snapshot, not a trend.';
  return 'There is useful evidence here, but no report-level pattern yet.';
}

function buildLearningSummary(records: PerformanceRecord[], subject: string, latestSummary: PerformanceSummary | undefined) {
  const delta = getTrendDelta(records);
  const insights = buildTeacherInsights(records, latestSummary?.teacherThemes);
  const strongestInsight = insights.find((item) => item.classification === 'Strength');
  const developmentInsight = insights.find((item) => item.classification === 'Priority');
  const improvementInsight = insights.find((item) => item.classification === 'Improving');
  const headline =
    delta !== undefined
      ? delta > 4
        ? 'You are moving in the right direction.'
        : delta < -4
          ? 'The latest results need a focused response.'
          : 'Your results are steady; the next gain will come from acting on feedback.'
      : insights.length || records.some((record) => record.teacherComment)
        ? 'Your teachers are already giving you a clear direction.'
        : 'This is a useful starting point, with more to learn from the next report.';
  const summarySentences = [
    describeEvidenceScope(records),
    strongestInsight ? `${strongestInsight.theme} is a strength worth protecting${strongestInsight.subjects.length ? `, particularly in ${strongestInsight.subjects.slice(0, 3).join(', ')}` : ''}.` : undefined,
    developmentInsight ? `The most useful priority now is ${developmentInsight.theme.toLowerCase()}${developmentInsight.subjects.length ? ` across ${developmentInsight.subjects.slice(0, 3).join(', ')}` : ''}.` : undefined,
    improvementInsight ? `${improvementInsight.theme} is beginning to improve.` : undefined,
    delta !== undefined
      ? delta > 4
        ? `Across like-for-like subject comparisons, the typical rise is about ${Math.round(delta)} points.`
        : delta < -4
          ? `Across like-for-like subject comparisons, the typical fall is about ${Math.abs(Math.round(delta))} points, so the next response should be specific rather than broad.`
          : 'The marks have not shifted much, so teacher feedback is the best guide to the next improvement.'
      : undefined,
    latestSummary?.overallCommentary && subject === 'All Subjects' ? latestSummary.overallCommentary : undefined,
  ].filter((item): item is string => Boolean(item));

  return {
    headline,
    body: summarySentences.join(' '),
  };
}

export function buildTeacherInsights(records: PerformanceRecord[], savedThemes?: PerformanceSummary['teacherThemes']) {
  if (savedThemes?.length) {
    return savedThemes.slice(0, 4).map((theme) => ({
      theme: theme.theme,
      classification: theme.classification,
      summary: theme.summary,
      why: theme.why,
      subjects: theme.subjects,
      quote: theme.evidence[0],
      confidence: insightConfidence(theme.evidence.length, theme.subjects),
      count: Math.max(theme.evidence.length, theme.subjects.length, 1),
    } satisfies TeacherInsight));
  }

  const commentThemes = extractTeacherCommentThemes(records);
  const explicitItems = [
    ...topEvidenceTerms(records, 'strengths').map((item) => {
      const theme = inferThemeFromTerm(item.term);
      return item.records.map((record) => ({ theme: theme.theme, why: theme.why, kind: 'strength' as const, record, snippet: item.term, source: 'record' as const }));
    }).flat(),
    ...topEvidenceTerms(records, 'weaknesses').map((item) => {
      const theme = inferThemeFromTerm(item.term);
      return item.records.map((record) => ({ theme: theme.theme, why: theme.why, kind: 'weakness' as const, record, snippet: item.term, source: 'record' as const }));
    }).flat(),
    ...topEvidenceTerms(records, 'actionPoints').map((item) => {
      const theme = inferThemeFromTerm(item.term);
      return item.records.map((record) => ({ theme: theme.theme, why: theme.why, kind: 'weakness' as const, record, snippet: item.term, source: 'record' as const }));
    }).flat(),
  ];
  return buildTeacherInsightGroups(commentThemes, explicitItems).slice(0, 4);
}

function getPracticeActionForTheme(theme: string, subjects: string[]) {
  const subjectText = subjects.length ? ` in ${subjects.slice(0, 2).join(' and ')}` : '';
  if (/Reasoning|Evidence/i.test(theme)) return `Before submitting the next piece${subjectText}, underline each conclusion and check that the evidence and explanation are both visible.`;
  if (/Accuracy|Checking/i.test(theme)) return `Reserve the final five minutes${subjectText} for calculations, units, signs, and any answer copied between steps.`;
  if (/Communication|Structure/i.test(theme)) return `Plan the order of the answer first, then use the final read-through to tighten vocabulary and remove any unclear sentence.`;
  if (/Preparation|Exam/i.test(theme)) return `Complete one timed question, mark it, and write down the single exam habit to repeat next time.`;
  if (/Independent/i.test(theme)) return `Choose one follow-up task without waiting for a prompt, then record what you changed after checking the feedback.`;
  if (/Engagement|Effort/i.test(theme)) return `Set one visible participation or focus goal for the next lesson and review it immediately afterwards.`;
  if (/Practical|Applied/i.test(theme)) return `For the next practical task, write the method, variables, expected evidence, and conclusion link before starting.`;
  if (/Confidence|Ambition/i.test(theme)) return `Attempt one question beyond the comfortable level and annotate where your reasoning was secure.`;
  if (/Consistency|Follow/i.test(theme)) return `Use the same short preparation and checking routine for the next three pieces of work.`;
  return `Turn this feedback into a three-point checklist and use it before the next piece of work${subjectText}.`;
}

export function buildProgressRecommendations(
  records: PerformanceRecord[],
  tutorLessons: TutorLesson[],
  tutorAttempts: TutorAttempt[],
  tutorMemory: TutorMemory,
  documents: ResearchDocument[],
  subject: string,
  savedRecommendations?: PerformanceSummary['coachingRecommendations'],
) {
  if (savedRecommendations?.length) return savedRecommendations.slice(0, 3);

  if (records.length === 0) {
    const readableSources = documents.filter((document) => document.extractedText?.trim() && document.status !== 'Failed').length;
    return [
      {
        title: 'Start with one real report',
        action: 'Choose a recent report or assessment and add it to this view.',
        why: 'A tutor can give useful early guidance from one report, then compare direction when a second report arrives.',
        evidence: `${readableSources} readable source${readableSources === 1 ? '' : 's'} available for analysis.`,
      },
      {
        title: 'Keep the teacher wording',
        action: 'Save the comments as well as the marks or grades.',
        why: 'Teacher wording explains what produced a result and what needs to change next.',
        evidence: 'No written teacher feedback matches this view yet.',
      },
      {
        title: 'Return after the next report',
        action: 'Compare the same subject again when the next assessment or report is available.',
        why: 'Change is only meaningful when the page compares like with like.',
        evidence: 'There is not yet a same-subject comparison.',
      },
    ];
  }

  const insights = buildTeacherInsights(records);
  const priorities = insights.filter((item) => item.classification === 'Priority');
  const improvement = insights.find((item) => item.classification === 'Improving');
  const strength = insights.find((item) => item.classification === 'Strength');
  const changes = getTrendChanges(records);
  const decline = [...changes].filter((change) => change.delta < 0).sort((a, b) => a.delta - b.delta)[0];
  const improvementChange = [...changes].filter((change) => change.delta > 0).sort((a, b) => b.delta - a.delta)[0];
  const relevantTutorTopics = tutorMemory.topicsStudied.filter((topic) => subject === 'All Subjects' || topic.topic.toLowerCase().includes(subject.toLowerCase()) || subject.toLowerCase().includes(topic.topic.toLowerCase()));
  const hasTutorPractice = tutorLessons.length + tutorAttempts.length > 0 || relevantTutorTopics.length > 0;
  const recommendations = priorities.slice(0, 2).map((priority) => ({
    title: priority.theme,
    action: getPracticeActionForTheme(priority.theme, priority.subjects),
    why: `${priority.summary} ${priority.why}`,
    evidence: priority.quote ?? '',
  }));

  if (recommendations.length < 2 && decline) {
    recommendations.push({
      title: `Rebuild confidence in ${decline.subject}`,
      action: `Review the gap between ${getShortReportAxisLabel(decline.from.records[0])} and ${getShortReportAxisLabel(decline.to.records[0])}, then practise the weakest skill before another full paper.`,
      why: `${decline.subject} moved from ${decline.from.percentage}% to ${decline.to.percentage}%, so a targeted response is more useful than broad revision.`,
      evidence: `${decline.from.percentage}% to ${decline.to.percentage}% across comparable reports.`,
    });
  }

  const protectedTheme = improvement ?? strength;
  if (protectedTheme) {
    const matchingImprovementChange = improvementChange && protectedTheme.subjects.includes(improvementChange.subject) ? improvementChange : undefined;
    recommendations.push({
      title: protectedTheme.classification === 'Improving' ? `Keep the improvement in ${protectedTheme.theme}` : `Protect ${protectedTheme.theme}`,
      action: getPracticeActionForTheme(protectedTheme.theme, protectedTheme.subjects),
      why: matchingImprovementChange
        ? `${matchingImprovementChange.subject} rose from ${matchingImprovementChange.from.percentage}% to ${matchingImprovementChange.to.percentage}%; naming the successful habit makes it easier to repeat.`
        : `${protectedTheme.summary} Strengths should remain visible while the priority work changes.`,
      evidence: protectedTheme.quote ?? '',
    });
  }

  const fallbackSteps = [
    {
      title: 'Check the next piece against this plan',
      action: hasTutorPractice ? 'Use the next Tutor practice or assignment to apply the first two habits, then compare the teacher response.' : 'Use the first two habits on the next assignment and compare the teacher response when it returns.',
      why: 'A recommendation becomes useful only when the next piece of work tests whether it changed the outcome.',
      evidence: improvementChange ? `${improvementChange.subject} already shows that change can be seen across reports.` : 'The next comparable report will show whether the plan worked.',
    },
    {
      title: 'Read the comment before revising',
      action: 'Start the next revision session by rewriting the latest teacher comment as one question to answer or one habit to practise.',
      why: 'This keeps revision tied to the teacher’s diagnosis instead of defaulting to broad, unfocused review.',
      evidence: records.find((record) => record.teacherComment?.trim())?.teacherComment ?? 'The current view has limited written feedback, so the next comment will be especially useful.',
    },
    {
      title: 'Create the next fair comparison',
      action: `When the next ${subject === 'All Subjects' ? 'report' : `${subject} result`} arrives, compare it with the same subject and note which habit changed.`,
      why: 'A like-for-like comparison is the safest way to tell whether the plan helped.',
      evidence: 'Progress never treats movement between different subjects as a trend.',
    },
  ];

  fallbackSteps.forEach((step) => {
    if (recommendations.length < 3 && !recommendations.some((recommendation) => recommendation.title === step.title)) recommendations.push(step);
  });

  if (recommendations.length < 3) {
    recommendations.push({
      title: 'Keep one useful habit visible',
      action: 'Choose the clearest successful habit from this report and write it at the top of the next piece of work.',
      why: 'Protecting a strength prevents improvement work from becoming a list of faults.',
      evidence: 'This is a cautious fallback while the page waits for more specific teacher evidence.',
    });
  }

  return recommendations.slice(0, 3);
}

function ProgressTimeline({ snapshots, documents, selectedKey, onSelect }: { snapshots: ReportSnapshot[]; documents: ResearchDocument[]; selectedKey?: string; onSelect: (key: string) => void }) {
  return snapshots.length ? (
    <div className="mt-5">
      <div className="space-y-4">
        {snapshots.map((snapshot) => {
          const selected = snapshot.key === selectedKey;
          const percentages = snapshot.records.map(getRecordPercentage).filter((value): value is number => typeof value === 'number');
          const subjects = uniqueStrings(snapshot.records.map((record) => record.subject));
          const teacherComments = snapshot.records.filter((record) => record.teacherComment?.trim());
          const reportLabel = getSnapshotReportLabel(snapshot);
          const sourceTitle = documents.find((document) => document.id === snapshot.records[0]?.sourceDocumentId)?.title;

          return (
          <article key={snapshot.key} className={`rounded-lg border p-4 transition ${selected ? 'border-ink/25 bg-paper/65' : 'border-ink/10 bg-white hover:border-ink/20'}`}>
            <button type="button" onClick={() => onSelect(snapshot.key)} className="block w-full text-left">
              <span className="flex flex-wrap items-start justify-between gap-4">
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">{getRecordTimelineLabel(snapshot.records[0])}</span>
                  <span className="mt-1 block font-semibold text-ink">{sourceTitle || snapshot.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-graphite/80">
                    {reportLabel} / {subjects.length} subject{subjects.length === 1 ? '' : 's'} / {percentages.length} mark{percentages.length === 1 ? '' : 's'} / {teacherComments.length} teacher comment{teacherComments.length === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm">{getSnapshotOutcomeLabel(snapshot.records)}</span>
              </span>
            </button>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">Expand Report</summary>
              <div className="mt-3 grid gap-2">
                {snapshot.records.slice(0, 12).map((record) => (
                  <div key={record.id} className="rounded-lg bg-white px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{record.subject}</span>
                      <span className="text-graphite/80">{[formatCompactMark(record), record.teacher].filter(Boolean).join(' / ') || 'Teacher comments only'}</span>
                    </div>
                    {record.teacherComment ? <p className="mt-2 leading-6 text-graphite/80">{record.teacherComment}</p> : null}
                  </div>
                ))}
              </div>
            </details>
          </article>
          );
        })}
      </div>
    </div>
  ) : (
    <p className="mt-5 rounded-lg bg-paper/70 p-4 text-sm leading-7 text-graphite/80">No records match this subject and time period yet.</p>
  );
}

function getSnapshotReportLabel(snapshot: ReportSnapshot) {
  const record = snapshot.records[0];
  return [snapshot.title, record.academicYear, record.term].filter(Boolean).join(' · ') || getRecordTimelineLabel(record);
}

function formatCompactMark(record: PerformanceRecord) {
  const percentage = getRecordPercentage(record);
  if (percentage !== undefined) return `${percentage}%`;
  if (record.grade) return record.grade;
  if (record.attainment) return `Attainment ${record.attainment}`;
  return '';
}

function getSnapshotOutcomeLabel(records: PerformanceRecord[]) {
  const percentages = records.map(getRecordPercentage).filter((value): value is number => typeof value === 'number');
  const average = percentages.length ? Math.round(percentages.reduce((total, percentage) => total + percentage, 0) / percentages.length) : undefined;
  if (average !== undefined) {
    const estimate = getEstimatedGradeFromPercentage(average);
    return [`${average}% avg`, estimate ? `Estimated from percentage: ${estimate}` : undefined].filter(Boolean).join(' / ');
  }
  const explicitGrades = records.flatMap((record) => [record.grade, record.attainment, record.predictedGrade, record.targetGrade]).filter(Boolean);
  if (explicitGrades.length) return explicitGrades.slice(0, 2).join(' / ');
  if (records.some((record) => record.teacherComment)) return 'Teacher comments only';
  if (records.some((record) => record.marksExtracted)) return 'Marks not extracted';
  return 'Awaiting mark extraction';
}

function TimelineDetail({ snapshot, documents }: { snapshot: ReportSnapshot; documents: ResearchDocument[] }) {
  const source = documents.find((document) => document.id === snapshot.records[0]?.sourceDocumentId);
  const subjects = uniqueStrings(snapshot.records.map((record) => record.subject));
  const marks = snapshot.records.map(getRecordPercentage).filter((value): value is number => typeof value === 'number');
  const average = marks.length ? Math.round(marks.reduce((total, mark) => total + mark, 0) / marks.length) : undefined;
  const commentHighlights = snapshot.records.filter((record) => record.teacherComment?.trim()).slice(0, 4);
  return (
    <div className="mt-4 space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-ink">{source?.title || snapshot.title}</h3>
        <p className="mt-1 text-sm text-graphite/80">{[snapshot.records[0]?.academicYear, snapshot.records[0]?.term, getRecordTimelineLabel(snapshot.records[0])].filter(Boolean).join(' / ')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <DetailPill label="Subjects" value={String(subjects.length)} />
        <DetailPill label="Marks" value={marks.length ? `${marks.length} marks` : 'No marks'} />
        <DetailPill label="Average" value={average !== undefined ? `${average}%` : 'Comments only'} />
      </div>
      <TagList label="Subjects included" items={subjects} />
      <div className="space-y-2">
        {snapshot.records.slice(0, 12).map((record) => (
          <div key={record.id} className="rounded-lg bg-paper/70 p-3 text-sm">
            <p className="font-semibold text-ink">{record.subject} · {[formatCompactMark(record), record.teacher].filter(Boolean).join(' · ') || 'Teacher comments only'}</p>
          </div>
        ))}
      </div>
      {commentHighlights.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">Teacher comment highlights</p>
          <div className="mt-2 space-y-2">
            {commentHighlights.map((record) => (
              <p key={record.id} className="rounded-lg bg-paper/70 p-3 text-sm leading-6 text-graphite/80"><span className="font-semibold text-ink">{record.subject}:</span> {record.teacherComment}</p>
            ))}
          </div>
        </div>
      ) : null}
      {source ? <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">Source: {source.title}</p> : null}
    </div>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-paper/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function TeacherInsightCard({ insight }: { insight: TeacherInsight }) {
  const label = insight.classification === 'Priority' ? 'Work on this' : insight.classification === 'Improving' ? 'Getting stronger' : 'Keep this strength';
  return (
    <article className="grid gap-3 py-6 md:grid-cols-[170px_1fr]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">{label}</p>
        {insight.subjects.length ? <p className="mt-2 text-xs leading-5 text-graphite/80">{insight.subjects.join(' · ')}</p> : null}
      </div>
      <div className="max-w-3xl">
        <h3 className="text-xl font-semibold text-ink">{insight.theme}</h3>
        <p className="mt-2 text-sm leading-7 text-graphite/80">{insight.summary}</p>
        <p className="mt-2 text-sm leading-7 text-graphite/80"><span className="font-semibold text-ink">Why it matters:</span> {insight.why}</p>
        {insight.quote ? <blockquote className="mt-3 border-l-2 border-brass/35 pl-3 text-sm italic leading-6 text-graphite/80">{insight.quote}</blockquote> : null}
      </div>
    </article>
  );
}

function ReportSnapshotStory({ snapshot, documents }: { snapshot: ReportSnapshot; documents: ResearchDocument[] }) {
  const sourceTitle = documents.find((document) => document.id === snapshot.records[0]?.sourceDocumentId)?.title ?? snapshot.title;
  const marked = snapshot.records
    .map((record) => ({ record, percentage: getRecordPercentage(record) }))
    .filter((item): item is { record: PerformanceRecord; percentage: number } => item.percentage !== undefined)
    .sort((a, b) => b.percentage - a.percentage);
  const average = marked.length ? Math.round(marked.reduce((total, item) => total + item.percentage, 0) / marked.length) : undefined;
  const highest = marked[0];
  const lowest = marked.length > 1 ? marked[marked.length - 1] : undefined;
  const story = highest && lowest
    ? `${highest.record.subject} is the strongest marked subject in this report. ${lowest.record.subject} is the clearest place to focus next.`
    : highest
      ? `${highest.record.subject} is at ${highest.percentage}%. Treat this as a starting point until the next comparable report arrives.`
      : 'This report is best read through the teacher comments; there are no comparable percentage marks in it.';

  return (
    <div className="chart-frame mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-ink/[0.045] sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/[0.06] pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">One report · snapshot</p>
          <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">{sourceTitle}</h3>
          <p className="mt-2 text-sm text-graphite/80">{[snapshot.records[0]?.term, snapshot.records[0]?.academicYear].filter(Boolean).join(' · ') || 'Current report'}</p>
        </div>
        {average !== undefined ? <p className="font-serif text-4xl font-semibold text-ink">{average}% <span className="font-sans text-xs font-semibold uppercase tracking-[0.1em] text-graphite/80">average</span></p> : null}
      </div>
      <p className="mt-5 max-w-3xl text-base leading-7 text-graphite/80">{story}</p>
      {marked.length ? (
        <div className="mt-6 space-y-4">
          {marked.map(({ record, percentage }) => (
            <div key={record.id}>
              <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-ink">{record.subject}</span>
                <span className="font-semibold tabular-nums text-ink">{percentage}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-moss" style={{ width: `${Math.max(3, Math.min(100, percentage))}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getSubjectTimelineStory(points: TrendPoint[], subject: string) {
  const first = points[0];
  const latest = points[points.length - 1];
  if (!first || !latest || points.length < 2) return { headline: `${subject} has one marked starting point.`, body: 'The next comparable report will show whether the learning is moving.' };
  const delta = latest.percentage - first.percentage;
  if (delta > 2) return { headline: `${subject} has risen by ${Math.round(delta)} points.`, body: `${getShortReportAxisLabel(first.records[0])} was ${first.percentage}%; ${getShortReportAxisLabel(latest.records[0])} is ${latest.percentage}%. The next question is which habit produced that gain.` };
  if (delta < -2) return { headline: `${subject} has fallen by ${Math.abs(Math.round(delta))} points.`, body: `${getShortReportAxisLabel(first.records[0])} was ${first.percentage}%; ${getShortReportAxisLabel(latest.records[0])} is ${latest.percentage}%. Use the teacher feedback to choose one precise response.` };
  return { headline: `${subject} is broadly steady.`, body: `The change from ${first.percentage}% to ${latest.percentage}% is small, so the written feedback is more useful than the number alone.` };
}

function TrendChart({
  records,
  documents,
  selectedSubject,
  storyMode = false,
}: {
  records: PerformanceRecord[];
  documents: ResearchDocument[];
  selectedSubject: string;
  storyMode?: boolean;
}) {
  if (!storyMode && selectedSubject === 'All Subjects') {
    return <CompactSubjectMovementComparison records={records} />;
  }

  const snapshots = getReportSnapshots(records);
  if (snapshots.length === 1) {
    return <ReportSnapshotStory snapshot={snapshots[0]} documents={documents} />;
  }

  if (selectedSubject === 'All Subjects') {
    return <SubjectMovementComparison records={records} />;
  }

  const trendSeries = getTrendEligibleSeries(records);
  const seriesEntries = Object.entries(trendSeries);
  const allPoints = seriesEntries.flatMap(([, points]) => points);
  const width = 760;
  const height = 260;
  const pad = { top: 20, right: 24, bottom: 54, left: 54 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const axisSlots = [...new Map(allPoints.map((point) => [getReportSnapshotKey(point.records[0]), point])).values()].sort((a, b) => getRecordAcademicSortKey(a.records[0]).localeCompare(getRecordAcademicSortKey(b.records[0])));
  const slotIndex = new Map(axisSlots.map((point, index) => [getReportSnapshotKey(point.records[0]), index]));
  const xForPoint = (point: TrendPoint) => {
    const index = slotIndex.get(getReportSnapshotKey(point.records[0])) ?? 0;
    return pad.left + (axisSlots.length <= 1 ? plotWidth / 2 : (index / (axisSlots.length - 1)) * plotWidth);
  };
  const yFor = (percentage: number) => pad.top + plotHeight - (Math.min(100, Math.max(0, percentage)) / 100) * plotHeight;
  const colors = ['var(--ink)', 'var(--moss)', 'var(--brass)'];
  const timelineStory = getSubjectTimelineStory(allPoints, selectedSubject);

  return (
    <div className="mt-5">
      {seriesEntries.length ? (
        <>
          <div className="mb-5 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">One subject · timeline</p>
            <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">{timelineStory.headline}</h3>
            <p className="mt-2 text-sm leading-7 text-graphite/80">{timelineStory.body}</p>
          </div>
          <div className="chart-frame overflow-hidden rounded-xl bg-white p-3 shadow-sm ring-1 ring-ink/[0.045] sm:p-5">
          <svg className="h-[300px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${selectedSubject} marks across comparable reports`}>
            {[0, 25, 50, 75, 100].map((tick) => (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={yFor(tick)} y2={yFor(tick)} stroke="var(--rule)" />
                <text x={pad.left - 10} y={yFor(tick) + 4} textAnchor="end" className="fill-graphite text-[11px]">{tick}%</text>
              </g>
            ))}
            <line x1={pad.left} x2={pad.left} y1={pad.top} y2={height - pad.bottom} stroke="var(--rule-strong)" />
            <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="var(--rule-strong)" />
            <text x={18} y={pad.top + plotHeight / 2} transform={`rotate(-90 18 ${pad.top + plotHeight / 2})`} className="fill-graphite text-[12px] font-semibold">Percentage</text>
            <text x={pad.left + plotWidth / 2} y={height - 10} textAnchor="middle" className="fill-graphite text-[12px] font-semibold">Report</text>
            {seriesEntries.map(([subject, points], seriesIndex) => {
              const color = colors[seriesIndex % colors.length];
              const line = points.map((point) => `${xForPoint(point)},${yFor(point.percentage)}`).join(' ');

              return (
                <g key={subject}>
                  <polyline points={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  {points.map((point) => (
                    <g key={`${subject}-${point.date}`}>
                      <circle cx={xForPoint(point)} cy={yFor(point.percentage)} r="5" fill={color} />
                      <text x={xForPoint(point)} y={yFor(point.percentage) - 10} textAnchor="middle" className="fill-graphite text-[10px] font-semibold">{point.percentage}%</text>
                    </g>
                  ))}
                </g>
              );
            })}
            {axisSlots.map((point) => (
              <text key={getReportSnapshotKey(point.records[0])} x={xForPoint(point)} y={height - pad.bottom + 20} textAnchor="middle" className="fill-graphite text-[10px]">{getShortReportAxisLabel(point.records[0])}</text>
            ))}
          </svg>
          </div>
        </>
      ) : records.length ? (
        <p className="mt-5 rounded-lg bg-paper/55 p-4 text-sm leading-7 text-graphite/80">There are reports here, but not yet two comparable marked results for {selectedSubject}. Read the teacher messages as the main guide for now.</p>
      ) : (
        <p className="mt-5 rounded-lg bg-paper/55 p-4 text-sm leading-7 text-graphite/80">No reports match this focus and period yet.</p>
      )}
    </div>
  );
}

function getShortReportAxisLabel(record: PerformanceRecord) {
  if (record.term) return record.term;
  if (hasExactAssessmentDate(record.date)) return formatDisplayDate(record.date, { month: 'short', year: '2-digit' });
  return getRecordAssessmentName(record).slice(0, 18);
}

function getSubjectMovementRows(records: PerformanceRecord[]) {
  return Object.entries(getSubjectTrendSeries(records))
    .map(([subject, points]) => {
      const sorted = [...points].sort((a, b) => getRecordAcademicSortKey(a.records[0]).localeCompare(getRecordAcademicSortKey(b.records[0])));
      const first = sorted[0];
      const latest = sorted[sorted.length - 1];
      return {
        subject,
        first,
        latest,
        delta: first && latest && sorted.length > 1 ? latest.percentage - first.percentage : undefined,
      };
    })
    .filter((row): row is { subject: string; first: TrendPoint; latest: TrendPoint; delta: number } => Boolean(row.first && row.latest && row.delta !== undefined))
    .sort((a, b) => b.delta - a.delta || a.subject.localeCompare(b.subject));
}

function CompactSubjectMovementComparison({ records }: { records: PerformanceRecord[] }) {
  const rows = getSubjectMovementRows(records);
  const maxDelta = Math.max(12, ...rows.map((row) => Math.abs(row.delta ?? 0)));

  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-semibold text-ink">Subject movement from first to latest report</p>
      <p className="mb-4 text-sm leading-6 text-graphite/80">Each row compares the first and latest marked report for the same subject.</p>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => {
            const width = Math.min(100, Math.round((Math.abs(row.delta) / maxDelta) * 100));
            return (
              <div key={row.subject} className="rounded-lg border border-ink/10 bg-paper/55 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{row.subject}</p>
                    <p className="mt-1 text-xs text-graphite/80">{`${getShortReportAxisLabel(row.first.records[0])}: ${row.first.percentage}% · ${getShortReportAxisLabel(row.latest.records[0])}: ${row.latest.percentage}%`}</p>
                  </div>
                  <p className={`text-lg font-semibold ${row.delta >= 0 ? 'text-moss' : 'text-brass'}`}>{row.delta > 0 ? '+' : ''}{Math.round(row.delta)}</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div className={`h-full rounded-full ${row.delta >= 0 ? 'bg-moss' : 'bg-brass'}`} style={{ width: `${Math.max(8, width)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : records.length ? (
        <p className="rounded-lg bg-paper/70 p-4 text-sm leading-7 text-graphite/80">Add a later report for the same subject to see subject movement.</p>
      ) : (
        <p className="rounded-lg bg-paper/70 p-4 text-sm leading-7 text-graphite/80">No marked academic records match this view yet.</p>
      )}
    </div>
  );
}

function SubjectMovementComparison({ records }: { records: PerformanceRecord[] }) {
  const rows = getSubjectMovementRows(records);
  const maxDelta = Math.max(12, ...rows.map((row) => Math.abs(row.delta ?? 0)));
  const topGain = [...rows].filter((row) => row.delta > 0).sort((a, b) => b.delta - a.delta)[0];
  const topFall = [...rows].filter((row) => row.delta < 0).sort((a, b) => a.delta - b.delta)[0];
  const story = rows.length && rows.every((row) => row.delta > 0)
    ? `Every comparable subject improved. ${topGain?.subject ?? 'The strongest mover'} made the clearest gain.`
    : topGain && topFall
      ? `${topGain.subject} made the clearest gain, while ${topFall.subject} needs the closest attention.`
      : topGain
        ? `${topGain.subject} made the clearest gain; the other comparable subjects were steadier.`
        : topFall
          ? `${topFall.subject} shows the clearest fall and should be the first subject reviewed.`
          : 'The comparable subjects are broadly steady.';

  return (
    <div className="mt-5">
      <div className="mb-5 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">All subjects · comparison</p>
        <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">{story}</h3>
        <p className="mt-2 text-sm leading-7 text-graphite/80">Each subject is compared only with itself, from its first marked report in this view to its latest.</p>
      </div>
      {rows.length ? (
        <div className="divide-y divide-ink/[0.06] border-y border-ink/[0.06]">
          {rows.map((row) => {
            const delta = row.delta;
            const width = delta === undefined ? 0 : Math.min(100, Math.round((Math.abs(delta) / maxDelta) * 100));
            return (
              <div key={row.subject} className="py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{row.subject}</p>
                    <p className="mt-1 text-sm text-graphite/80">
                      {row.first && row.latest ? `${getShortReportAxisLabel(row.first.records[0])} ${row.first.percentage}% → ${getShortReportAxisLabel(row.latest.records[0])} ${row.latest.percentage}%` : 'One marked report'}
                    </p>
                  </div>
                  <p className={`font-serif text-2xl font-semibold ${delta >= 0 ? 'text-moss' : 'text-brass'}`}>{delta > 0 ? '+' : ''}{Math.round(delta)} <span className="font-sans text-xs uppercase tracking-[0.1em]">points</span></p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper">
                  <div className={`h-full rounded-full ${delta >= 0 ? 'bg-moss' : 'bg-brass'}`} style={{ width: `${Math.max(8, width)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : records.length ? (
        <p className="rounded-lg bg-paper/55 p-4 text-sm leading-7 text-graphite/80">There is only one marked report per subject here, so this view is a snapshot rather than a comparison.</p>
      ) : (
        <p className="rounded-lg bg-paper/55 p-4 text-sm leading-7 text-graphite/80">No marked reports match this view yet.</p>
      )}
    </div>
  );
}

function TrendDataNotice() {
  return <p className="rounded-lg bg-paper/70 p-3 text-sm leading-6 text-graphite/80">Add another assessment for this subject to see progress over time.</p>;
}

function TrendCallout({ label, change }: { label: string; change?: TrendChange }) {
  if (!change) {
    return <p className="rounded-lg bg-paper/70 p-3 text-sm text-graphite/80">{label}: more data needed.</p>;
  }

  return (
    <div className="rounded-lg bg-paper/70 p-3 text-sm">
      <p className="font-semibold text-ink">{label}: {change.delta > 0 ? '+' : ''}{Math.round(change.delta)} points</p>
      <p className="mt-1 text-graphite/80">{change.subject}: {getRecordAxisLabel(change.from.records[0])} to {getRecordAxisLabel(change.to.records[0])}</p>
    </div>
  );
}

function getSubjectEvidenceRows(records: PerformanceRecord[]) {
  return Object.entries(getSubjectTrendSeries(records))
    .map(([subject, points]) => {
      const reportCount = new Set(points.map((point) => getReportSnapshotKey(point.records[0]))).size;
      const markedCount = points.length;
      const commentCount = points.reduce((total, point) => total + point.records.filter((record) => record.teacherComment?.trim()).length, 0);
      return { subject, reportCount, markedCount, commentCount, total: reportCount + commentCount };
    })
    .filter((row) => row.reportCount > 1 || row.commentCount > 0)
    .sort((a, b) => b.total - a.total || a.subject.localeCompare(b.subject));
}

function getSingleSubjectTrendPoints(records: PerformanceRecord[]) {
  return Object.values(getTrendEligibleSeries(records))[0] ?? [];
}

function getSupportingEvidenceItems(records: PerformanceRecord[], selectedSubject: string) {
  const items: string[] = [];
  const movementRows = getSubjectMovementRows(records);
  const evidenceRows = getSubjectEvidenceRows(records);
  if (selectedSubject === 'All Subjects') {
    if (movementRows.length) items.push('movement');
    if (evidenceRows.length > 1) items.push('support');
    return items;
  }

  if (getSingleSubjectTrendPoints(records).length >= 2) items.push('consistency');
  if (evidenceRows.length) items.push('support');
  return items;
}

function SupportingEvidence({ records, selectedSubject }: { records: PerformanceRecord[]; selectedSubject: string }) {
  const items = getSupportingEvidenceItems(records, selectedSubject);
  if (!items.length) return null;

  return (
    <div className="mt-5 grid gap-6 xl:grid-cols-2">
      {items.includes('movement') ? <SubjectChangeChart records={records} /> : null}
      {items.includes('consistency') ? <MarkConsistencyChart records={records} selectedSubject={selectedSubject} /> : null}
      {items.includes('support') ? <EvidenceSupportChart records={records} /> : null}
    </div>
  );
}

function SubjectChangeChart({ records }: { records: PerformanceRecord[] }) {
  const rows = getSubjectMovementRows(records).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8);
  const maxDelta = Math.max(8, ...rows.map((row) => Math.abs(row.delta)));
  if (!rows.length) return null;

  return (
    <article className="chart-frame rounded-lg border border-ink/10 bg-paper/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">Which Subjects Changed Most?</p>
      <div className="mt-5 space-y-3">
        {rows.map((row) => {
          const width = Math.max(8, Math.round((Math.abs(row.delta) / maxDelta) * 100));
          return (
            <div key={row.subject}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-ink">{row.subject}</span>
                <span className={`shrink-0 font-semibold ${row.delta >= 0 ? 'text-moss' : 'text-brass'}`}>{row.delta > 0 ? '+' : ''}{Math.round(row.delta)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="h-2 rounded-full bg-white">
                  {row.delta < 0 ? <div className="ml-auto h-full rounded-full bg-brass" style={{ width: `${width}%` }} /> : null}
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-graphite/45">0</span>
                <div className="h-2 rounded-full bg-white">
                  {row.delta >= 0 ? <div className="h-full rounded-full bg-moss" style={{ width: `${width}%` }} /> : null}
                </div>
              </div>
              <p className="mt-1 text-xs text-graphite/80">{row.first.percentage}% to {row.latest.percentage}%</p>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function MarkConsistencyChart({ records, selectedSubject }: { records: PerformanceRecord[]; selectedSubject: string }) {
  const points = getSingleSubjectTrendPoints(records);
  if (points.length < 2) return null;
  const percentages = points.map((point) => point.percentage);
  const min = Math.min(...percentages);
  const max = Math.max(...percentages);
  const range = Math.max(1, max - min);
  const clampedMin = Math.max(0, Math.min(100, min));
  const clampedMax = Math.max(0, Math.min(100, max));

  return (
    <article className="chart-frame rounded-lg border border-ink/10 bg-paper/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">How Consistent Are My Marks?</p>
      <h3 className="mt-2 text-lg font-semibold text-ink">{selectedSubject}</h3>
      <div className="mt-5 rounded-lg bg-white p-4">
        <div className="relative h-8 rounded-full bg-paper">
          <div className="absolute top-0 h-8 rounded-full bg-moss/20" style={{ left: `${clampedMin}%`, width: `${Math.max(1, clampedMax - clampedMin)}%` }} />
          {points.map((point) => (
            <span key={getReportSnapshotKey(point.records[0])} className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink shadow-sm" style={{ left: `${Math.max(0, Math.min(100, point.percentage))}%` }} />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-semibold text-graphite/80">
          <span>{min}% low</span>
          <span>{max}% high</span>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-graphite/80">The marks span {range} point{range === 1 ? '' : 's'} across {points.length} reports.</p>
    </article>
  );
}

function EvidenceSupportChart({ records }: { records: PerformanceRecord[] }) {
  const rows = getSubjectEvidenceRows(records).slice(0, 8);
  const max = Math.max(1, ...rows.map((row) => row.total));
  if (!rows.length) return null;

  return (
    <article className="chart-frame rounded-lg border border-ink/10 bg-paper/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">How Much Evidence Supports This?</p>
      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div key={row.subject}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-ink">{row.subject}</span>
              <span className="shrink-0 text-xs font-semibold text-graphite/80">{row.reportCount} report{row.reportCount === 1 ? '' : 's'} / {row.commentCount} comment{row.commentCount === 1 ? '' : 's'}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-brass" style={{ width: `${Math.max(10, (row.total / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">{label}</p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-graphite/80">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-graphite/80">No clear pattern yet.</p>
      )}
    </div>
  );
}

function ChipCloud({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-graphite/80">
          {item}
        </span>
      ))}
    </div>
  );
}

function TimelineRow({ event, compact = false, showContext = true }: { event: TimelineEvent; compact?: boolean; showContext?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasSubjectRecords = event.subjectRecords.length > 0;
  return (
    <article className={`timeline-event ${compact ? 'is-compact' : ''} border-t border-ink/[0.055] py-4`}>
      <div className="timeline-event__head flex items-start justify-between gap-4">
        <div className="min-w-0">
          {showContext ? <p className="timeline-event__context text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">{event.academicYear} / {event.term} / {event.type}</p> : <p className="timeline-event__context text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">{event.type}</p>}
          <h3 className={`timeline-event__title ${compact ? 'mt-2 text-sm' : 'mt-3 text-lg'} font-semibold text-ink`}>{event.title}</h3>
          <p className={`timeline-event__detail ${compact ? 'line-clamp-2' : ''} mt-2 text-sm leading-6 text-graphite/80`}>{event.detail}</p>
          {!compact && event.subjects.length ? <div className="mt-3"><ChipCloud items={event.subjects.slice(0, 6)} /></div> : null}
        </div>
        {showContext ? <time className="timeline-event__date shrink-0 whitespace-pre-line rounded-full bg-paper px-3 py-1 text-xs font-semibold text-graphite/80">{event.date || 'Undated'}</time> : null}
      </div>
      {!compact && hasSubjectRecords ? (
        <>
          <button type="button" onClick={() => setExpanded((current) => !current)} className="mt-4 rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink hover:border-ink/20 hover:bg-paper/50">
            {expanded ? 'Hide subjects' : 'Show subjects'}
          </button>
          {expanded ? (
            <div className="mt-4 space-y-3 border-t border-ink/10 pt-4">
              {event.subjectRecords.map((record) => (
                <div key={record.id} className="rounded-lg bg-paper/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{record.subject}</p>
                      <p className="mt-1 text-sm text-graphite/80">{[record.teacher, record.effort ? `Effort ${record.effort}` : undefined, record.attainment ? `Attainment ${record.attainment}` : undefined].filter(Boolean).join(' / ')}</p>
                    </div>
                    <span className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm">{formatTimelineSubjectResult(record)}</span>
                  </div>
                  {record.teacherComment ? <p className="mt-3 text-sm leading-7 text-graphite/80">{record.teacherComment}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function formatTimelineSubjectResult(record: TimelineEvent['subjectRecords'][number]) {
  const estimatedGrade = getEstimatedGradeFromPercentage(record.percentage);
  const values = [
    record.percentage !== undefined ? `${record.percentage}%` : undefined,
    estimatedGrade ? `Estimated from percentage: ${estimatedGrade}` : undefined,
    record.grade,
    record.predictedGrade ? `Predicted ${record.predictedGrade}` : undefined,
    record.targetGrade ? `Target ${record.targetGrade}` : undefined,
  ].filter(Boolean);
  return values.length ? values.join(' / ') : record.teacherComment ? 'Teacher comments only' : 'Marks not extracted';
}

function TimelinePage({ events }: { events: TimelineEvent[] }) {
  const groups = events.reduce<Record<string, Record<string, Record<string, TimelineEvent[]>>>>((accumulator, event) => {
    accumulator[event.academicYear] ??= {};
    accumulator[event.academicYear][event.term] ??= {};
    accumulator[event.academicYear][event.term][event.date] ??= [];
    accumulator[event.academicYear][event.term][event.date].push(event);
    return accumulator;
  }, {});

  return (
    <div className="timeline-page mx-auto max-w-6xl space-y-10">
      <div className="timeline-page__header max-w-4xl">
        <SectionHeader
          title="Reports over time"
          copy="Each uploaded report or assessment appears once. Open it to see the subjects inside."
          compact
        />
      </div>
      {events.length ? (
        <div className="timeline-stream space-y-12">
          {Object.entries(groups).map(([academicYear, termGroups]) => (
            <section key={academicYear} className="timeline-year space-y-5">
              <h2 className="timeline-year__title font-serif text-3xl font-semibold text-ink">{academicYear}</h2>
              {Object.entries(termGroups).map(([term, dateGroups]) => (
                <div key={`${academicYear}-${term}`} className="timeline-term border-l border-ink/10 pl-4 sm:pl-7">
                  <h3 className="timeline-term__title mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-graphite/80">{term}</h3>
                  <div className="timeline-term__events space-y-4">
                    {Object.entries(dateGroups).map(([date, dateEvents]) => (
                      <div key={`${term}-${date}`} className="timeline-date-group grid gap-3 xl:grid-cols-[160px_1fr]">
                        <time className="timeline-date-group__label pt-4 text-sm font-semibold text-graphite/80">{date}</time>
                        <div className="space-y-3">
                          {dateEvents.map((event) => (
                            <TimelineRow key={event.id} event={event} showContext={false} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <EmptyState title="Build your learning timeline" copy="Upload a source, analyse a report, or complete a Tutor activity." />
      )}
    </div>
  );
}

function EmptyState({ title, copy, action, onClick }: { title: string; copy: string; action?: string; onClick?: () => void }) {
  return (
    <div className="empty-state">
      <p className="font-serif text-2xl font-semibold leading-tight text-ink sm:text-[1.75rem]">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-graphite/80">{copy}</p>
      {action && onClick ? (
        <button type="button" onClick={onClick} className="mt-6 min-h-11 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-graphite">
          {action}
        </button>
      ) : null}
    </div>
  );
}

function Upload({
  activeWorkspaceId,
  storageStatus,
  performanceRecords,
  userId,
  setState,
}: {
  activeWorkspaceId: string;
  storageStatus: ReturnType<typeof useResearchState>['storageStatus'];
  performanceRecords: PerformanceRecord[];
  userId?: string | null;
  setState: ReturnType<typeof useResearchState>['setState'];
}) {
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [failedUpload, setFailedUpload] = useState<{ file: File; documentId: string; title: string; cleanName: string; type: 'PDF' | 'DOCX' | 'IMAGE' } | null>(null);
  const [note, setNote] = useState('Choose a document to add to this workspace.');
  const [metadataDraft, setMetadataDraft] = useState<UploadMetadataDraft>({
    sourceDate: '',
    academicYear: '',
    term: 'Michaelmas',
    linkedAssessmentName: '',
    documentCategory: 'Notes',
    subjectsIncluded: [],
    customSubjects: '',
    ignoreInstrumentalMusic: false,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasSelectedFile = Boolean(selectedFile);
  const hasAcademicTime = Boolean(metadataDraft.academicYear.trim() && metadataDraft.term && metadataDraft.linkedAssessmentName.trim());
  const hasDocumentKind = Boolean(metadataDraft.documentCategory);
  const canUpload = hasSelectedFile && hasAcademicTime && hasDocumentKind;

  function logUploadStage(stage: UploadStage, detail?: unknown) {
    if (import.meta.env.DEV) {
      console.debug(`[Upload] ${stage}`, detail ?? '');
    }
  }

  function logUploadError(stage: UploadStage, error: unknown) {
    if (import.meta.env.DEV) {
      console.error(`[Upload] ${stage}`, error);
    }
  }

  function logExtractionMetrics(analysis?: DocumentMetadataAnalysisResponse) {
    if (!import.meta.env.DEV || !analysis) return;
    const quality = analysis.extractionQuality;
    const subjects = quality?.subjectsFound ?? analysis.performanceRecords.length;
    const comments = quality?.commentsLinked ?? analysis.performanceRecords.filter((record) => record.teacherComment).length;
    console.debug(`[Extraction] ${subjects} subjects found`);
    console.debug(`[Extraction] ${comments} comments linked`);
    console.debug(`[Extraction] ${quality?.duplicateRows ?? analysis.extractionDiagnostics?.duplicateRows ?? 0} duplicate rows`);
    console.debug(`[Extraction] Confidence ${quality?.confidence ?? analysis.confidence ?? 'Low'}`, quality?.confidenceReasons ?? analysis.extractionDiagnostics?.confidenceReasons ?? []);
    if (analysis.extractionTimings) console.debug('[Extraction] Timings', analysis.extractionTimings);
  }

  function getStageErrorMessage(stage: UploadStage, cleanName: string, error: unknown) {
    const message = error instanceof Error ? error.message : '';

    if (message) return message;
    if (stage === 'file-selected') return `Research OS could not read ${cleanName}. Choose the file again and retry.`;
    if (stage === 'extracting') return `Research OS could not extract text from ${cleanName}. Try another file.`;
    if (stage === 'chunking') return `${cleanName} could not be prepared for study. Try another file.`;
    if (stage === 'saving') return `${cleanName} was read, but could not be saved. Try again.`;
    return `${cleanName} was saved, but search preparation failed.`;
  }

  function resetUploadFields() {
    setSelectedFile(null);
    setFileName('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function enrichDocument(document: ResearchDocument) {
    const uploadMetadata = buildUploadMetadata(metadataDraft);
    const taggedDocument = {
      ...document,
      tags: [...new Set([...document.tags, ...(uploadMetadata.subjects ?? []), uploadMetadata.documentCategory ?? ''].filter(Boolean))],
    };
    const metadata = makeMetadata(taggedDocument, performanceRecords, uploadMetadata);
    return {
      ...taggedDocument,
      addedAt: document.addedAt,
      metadata,
      collectionIds: metadata.collections.map((collection) => `collection-${collection.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`),
    };
  }

  async function analyseDocumentMetadataIfPossible(document: ResearchDocument, pipelineTimings?: { ocrMs?: number }) {
    if (!document.extractedText?.trim()) return undefined;

    try {
      return await analyseDocumentMetadata({
        title: document.title,
        text: document.extractedText,
        uploadMetadata: buildUploadMetadata(metadataDraft),
        pipelineTimings,
      });
    } catch (error) {
      logUploadError('saving', error);
      return undefined;
    }
  }

  function updateUploadMetadata<K extends keyof UploadMetadataDraft>(field: K, value: UploadMetadataDraft[K]) {
    setMetadataDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleUploadSubject(subject: string) {
    setMetadataDraft((current) => ({
      ...current,
      subjectsIncluded: current.subjectsIncluded.includes(subject)
        ? current.subjectsIncluded.filter((item) => item !== subject)
        : [...current.subjectsIncluded, subject],
    }));
  }

  async function queueEmbeddings(document: ResearchDocument, chunks: DocumentChunk[], readyMessage: string) {
    logUploadStage('embedding', { documentId: document.id, chunkCount: chunks.length });

    if (!isSupabaseEnabled || storageStatus !== 'connected') {
      const notEmbeddedDocument: ResearchDocument = {
        ...document,
        embeddingStatus: 'not_embedded',
      };

      setState((current) => ({
        ...current,
        documents: current.documents.map((item) => (item.id === document.id ? { ...item, ...notEmbeddedDocument, metadata: item.metadata ?? notEmbeddedDocument.metadata } : item)),
      }));
      setNote(readyMessage);
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
      documents: current.documents.map((item) => (item.id === document.id ? { ...item, ...embeddingDocument, metadata: item.metadata ?? embeddingDocument.metadata } : item)),
      chunks: [...pendingChunks, ...current.chunks.filter((chunk) => chunk.documentId !== document.id)],
    }));
    setNote('Updating your academic profile...');

    try {
      await saveDocument(embeddingDocument, { userId });
      await saveChunks(pendingChunks, { userId });

      const result = await embedChunks({ documentId: document.id });
      const nextStatus = result.embedded > 0 ? 'embedded' : result.failed > 0 ? 'failed' : 'keyword_only';
      const finalDocument: ResearchDocument = {
        ...embeddingDocument,
        embeddingStatus: nextStatus,
        embeddingError: result.failed > 0 && result.embedded === 0 ? 'Study search preparation failed. Local search remains available.' : undefined,
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
        documents: current.documents.map((item) => (item.id === document.id ? { ...item, ...finalDocument, metadata: item.metadata ?? finalDocument.metadata } : item)),
        chunks: current.chunks.map((chunk) => finalChunks.find((item) => item.id === chunk.id) ?? chunk),
      }));
      await saveDocument(finalDocument, { userId });
      await saveChunks(finalChunks, { userId });
      setNote(readyMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search preparation is unavailable.';
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

      logUploadError('embedding', error);
      setState((current) => ({
        ...current,
        documents: current.documents.map((item) => (item.id === document.id ? { ...item, ...keywordOnlyDocument, metadata: item.metadata ?? keywordOnlyDocument.metadata } : item)),
        chunks: current.chunks.map((chunk) => failedEmbeddingChunks.find((item) => item.id === chunk.id) ?? chunk),
      }));
      await saveDocument(keywordOnlyDocument, { userId });
      await saveChunks(failedEmbeddingChunks, { userId });
      setNote(readyMessage);
    }
  }

  async function analyseUploadedPerformanceIfRelevant(document: ResearchDocument, metadataAnalysis?: DocumentMetadataAnalysisResponse) {
    const metadata = getDocumentMetadata(document, performanceRecords);
    const category = metadata.documentCategory ?? '';
    const canAffectProgress = canDocumentCategoryAffectAcademicProgress(category);

    if (!document.extractedText?.trim() || !canAffectProgress) return 0;

    logExtractionMetrics(metadataAnalysis);

    if (shouldTreatAsInstrumentalPerformanceDocument(metadata)) {
      return 0;
    }

    try {
      const response = metadataAnalysis?.performanceRecords?.length
        ? { records: metadataAnalysis.performanceRecords, message: metadataAnalysis.message }
        : await analysePerformanceDocument({ title: document.title, text: document.extractedText });
      const newRecords = response.records
        .map((record) => createRecordFromAnalysis(record, document.id, document.title, metadata))
        .filter((record): record is PerformanceRecord => Boolean(record))
        .map((record) =>
          record.excludeFromAcademicAnalysis || shouldExcludeRecordForInstrumentalPreference(record, metadata)
            ? { ...record, domain: record.domain ?? 'performance', excludeFromAcademicAnalysis: true }
            : record,
        );

      if (newRecords.length === 0) return 0;

      setState((current) => {
        const performanceRecords = [...newRecords, ...current.performanceRecords.filter((record) => record.sourceDocumentId !== document.id)];
        return withDerivedCollections({
          ...current,
          performanceRecords,
          documents: current.documents.map((item) =>
            item.id === document.id
              ? (() => {
                  const metadata = buildDocumentMetadata(item, performanceRecords);
                  const extractionSummary = buildExtractionSummary(item, metadata, performanceRecords, metadataAnalysis);

                  return {
                    ...item,
                    status: extractionSummary.needsReview ? 'Needs review' : item.status,
                    metadata,
                    extractionSummary,
                  };
                })()
              : item,
          ),
        });
      });

      if (import.meta.env.DEV) {
        const academicCreated = newRecords.filter(isAcademicPerformanceRecord).length;
        console.debug(`[Extraction] ${academicCreated} academic records created`);
        console.debug('[Extraction] Progress updated');
      }

      return newRecords.filter(isAcademicPerformanceRecord).length;
    } catch (error) {
      logUploadError('saving', error);
      return 0;
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
    let uploadStage: UploadStage = 'file-selected';
    setIsReading(true);
    setFailedUpload(null);
    logUploadStage(uploadStage, { fileName: cleanName, type: 'PDF' });

    const processingDocument: ResearchDocument = {
      id: documentId,
      title,
      type: 'PDF',
      workspaceId: activeWorkspaceId,
      authors: 'Local PDF upload',
      addedAt: new Date().toISOString(),
      status: 'Extracting',
      tags: ['pdf upload'],
      insightCount: 0,
      summary: 'Reading this PDF.',
    };

    setState((current) => ({
      ...current,
      documents: [processingDocument, ...current.documents.filter((document) => document.id !== documentId)],
      chunks: current.chunks.filter((chunk) => chunk.documentId !== documentId),
    }));
    setNote('Uploading document...');

    try {
      uploadStage = 'extracting';
      logUploadStage(uploadStage, { fileName: cleanName });
      setNote('Reading report...');
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
                summary: 'Finding subjects and comments.',
                pageCount: extracted.pages.length,
                wordCount: extracted.wordCount,
              }
            : document,
        ),
      }));
      setNote('Finding subjects...');

      uploadStage = 'chunking';
      logUploadStage(uploadStage, { fileName: cleanName, pages: extracted.pages.length, wordCount: extracted.wordCount });
      const chunks = chunkText({ text: extracted.text, documentId, pages: extracted.pages });

      if (chunks.length === 0) {
        throw new Error('This PDF could not be prepared. Try another file.');
      }

      const tags = extractTopics(extracted.text);
      const originalFile = await createOriginalFileSnapshotSafe(file);
      let readyDocument: ResearchDocument = enrichDocument({
        ...processingDocument,
        status: 'Ready',
        tags: tags.length ? tags : ['pdf upload'],
        summary: summarizeText(extracted.text),
        extractedText: extracted.text,
        pageCount: extracted.pages.length,
        wordCount: extracted.wordCount,
        chunkIds: chunks.map((chunk) => chunk.id),
        originalFile,
      });
      setNote('Understanding teacher comments...');
      const metadataAnalysis = await analyseDocumentMetadataIfPossible(readyDocument);
      readyDocument = applyAnalysedDocument(readyDocument, metadataAnalysis);

      setState((current) => withDerivedCollections({
        ...current,
        documents: current.documents.map((document) => (document.id === documentId ? readyDocument : document)),
        chunks: [...chunks, ...current.chunks.filter((chunk) => chunk.documentId !== documentId)],
      }));
      uploadStage = 'saving';
      logUploadStage(uploadStage, { documentId, chunkCount: chunks.length });
      setNote('Updating your academic profile...');
      const performanceCount = await analyseUploadedPerformanceIfRelevant(readyDocument, metadataAnalysis);
      const readyMessage = performanceCount ? 'Your academic profile has been updated.' : 'Your document has been imported.';
      setNote(readyMessage);
      resetUploadFields();
      await queueEmbeddings(readyDocument, chunks, readyMessage);
    } catch (error) {
      const message = getStageErrorMessage(uploadStage, cleanName, error);
      const failedDocument: ResearchDocument = enrichDocument({
        ...processingDocument,
        status: 'Failed',
        tags: ['pdf upload', 'failed'],
        summary: message,
        extractionError: message,
      });

      logUploadError(uploadStage, error);
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
    let uploadStage: UploadStage = 'file-selected';
    setIsReading(true);
    setFailedUpload(null);
    logUploadStage(uploadStage, { fileName: cleanName, type: 'DOCX' });

    const processingDocument: ResearchDocument = {
      id: documentId,
      title,
      type: 'DOCX',
      workspaceId: activeWorkspaceId,
      authors: 'Local DOCX upload',
      addedAt: new Date().toISOString(),
      status: 'Extracting',
      tags: ['docx upload'],
      insightCount: 0,
      summary: 'Reading this document.',
    };

    setState((current) => ({
      ...current,
      documents: [processingDocument, ...current.documents.filter((document) => document.id !== documentId)],
      chunks: current.chunks.filter((chunk) => chunk.documentId !== documentId),
    }));
    setNote('Uploading document...');

    try {
      uploadStage = 'extracting';
      logUploadStage(uploadStage, { fileName: cleanName });
      setNote('Reading report...');
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
                summary: 'Finding subjects and comments.',
                wordCount: extracted.wordCount,
              }
            : document,
        ),
      }));
      setNote('Finding subjects...');

      uploadStage = 'chunking';
      logUploadStage(uploadStage, { fileName: cleanName, wordCount: extracted.wordCount });
      const chunks = chunkText({ text: extracted.text, documentId });

      if (chunks.length === 0) {
        throw new Error('This DOCX could not be prepared. Try another file.');
      }

      const tags = extractTopics(extracted.text);
      const originalFile = await createOriginalFileSnapshotSafe(file);
      let readyDocument: ResearchDocument = enrichDocument({
        ...processingDocument,
        status: 'Ready',
        tags: tags.length ? tags : ['docx upload'],
        summary: summarizeText(extracted.text),
        extractedText: extracted.text,
        wordCount: extracted.wordCount,
        chunkIds: chunks.map((chunk) => chunk.id),
        originalFile,
      });
      setNote('Understanding teacher comments...');
      const metadataAnalysis = await analyseDocumentMetadataIfPossible(readyDocument);
      readyDocument = applyAnalysedDocument(readyDocument, metadataAnalysis);

      setState((current) => withDerivedCollections({
        ...current,
        documents: current.documents.map((document) => (document.id === documentId ? readyDocument : document)),
        chunks: [...chunks, ...current.chunks.filter((chunk) => chunk.documentId !== documentId)],
      }));
      uploadStage = 'saving';
      logUploadStage(uploadStage, { documentId, chunkCount: chunks.length });
      setNote('Updating your academic profile...');
      const performanceCount = await analyseUploadedPerformanceIfRelevant(readyDocument, metadataAnalysis);
      const readyMessage = performanceCount ? 'Your academic profile has been updated.' : 'Your document has been imported.';
      setNote(readyMessage);
      resetUploadFields();
      await queueEmbeddings(readyDocument, chunks, readyMessage);
    } catch (error) {
      const message = getStageErrorMessage(uploadStage, cleanName, error);
      const failedDocument: ResearchDocument = enrichDocument({
        ...processingDocument,
        status: 'Failed',
        tags: ['docx upload', 'failed'],
        summary: message,
        extractionError: message,
      });

      logUploadError(uploadStage, error);
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

  async function processImageUpload({
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
    let uploadStage: UploadStage = 'file-selected';
    setIsReading(true);
    setFailedUpload(null);
    logUploadStage(uploadStage, { fileName: cleanName, type: file.type || 'IMAGE' });

    const processingDocument: ResearchDocument = {
      id: documentId,
      title,
      type: 'IMAGE',
      workspaceId: activeWorkspaceId,
      authors: 'Local image upload',
      addedAt: new Date().toISOString(),
      status: 'Extracting',
      tags: ['image upload'],
      insightCount: 0,
      summary: 'Reading this image.',
    };

    setState((current) => ({
      ...current,
      documents: [processingDocument, ...current.documents.filter((document) => document.id !== documentId)],
      chunks: current.chunks.filter((chunk) => chunk.documentId !== documentId),
    }));
    setNote('Reading image...');

    try {
      uploadStage = 'extracting';
      logUploadStage(uploadStage, { fileName: cleanName });
      setNote('Extracting text...');
      const ocrStartedAt = performance.now();
      const extracted = await extractImageText(file);
      const ocrMs = performance.now() - ocrStartedAt;
      if (import.meta.env.DEV) console.debug('[Extraction] OCR Complete', { milliseconds: Math.round(ocrMs), confidence: extracted.confidence });

      setState((current) => ({
        ...current,
        documents: current.documents.map((document) =>
          document.id === documentId
            ? {
                ...document,
                status: 'Analysing',
                summary: 'Understanding report.',
                wordCount: extracted.wordCount,
              }
            : document,
        ),
      }));
      setNote('Understanding report...');

      uploadStage = 'chunking';
      logUploadStage(uploadStage, { fileName: cleanName, wordCount: extracted.wordCount, confidence: extracted.confidence });
      const chunks = chunkText({ text: extracted.text, documentId });

      if (chunks.length === 0) {
        throw new Error("This image doesn't appear to contain readable text. Try a higher-quality image.");
      }

      const tags = extractTopics(extracted.text);
      const originalFile = await createOriginalFileSnapshotSafe(file);
      let readyDocument: ResearchDocument = enrichDocument({
        ...processingDocument,
        status: 'Ready',
        tags: tags.length ? tags : ['image upload'],
        summary: summarizeText(extracted.text),
        extractedText: extracted.text,
        wordCount: extracted.wordCount,
        chunkIds: chunks.map((chunk) => chunk.id),
        originalFile,
      });
      const metadataAnalysis = await analyseDocumentMetadataIfPossible(readyDocument, { ocrMs });
      readyDocument = applyAnalysedDocument(readyDocument, metadataAnalysis);

      setState((current) => withDerivedCollections({
        ...current,
        documents: current.documents.map((document) => (document.id === documentId ? readyDocument : document)),
        chunks: [...chunks, ...current.chunks.filter((chunk) => chunk.documentId !== documentId)],
      }));
      uploadStage = 'saving';
      logUploadStage(uploadStage, { documentId, chunkCount: chunks.length });
      setNote('Updating academic profile...');
      const performanceCount = await analyseUploadedPerformanceIfRelevant(readyDocument, metadataAnalysis);
      const readyMessage = performanceCount ? 'Your academic profile has been updated.' : 'Your document has been imported.';
      setNote(readyMessage);
      resetUploadFields();
      await queueEmbeddings(readyDocument, chunks, readyMessage);
    } catch (error) {
      const message = getStageErrorMessage(uploadStage, cleanName, error);
      const failedDocument: ResearchDocument = enrichDocument({
        ...processingDocument,
        status: 'Failed',
        tags: ['image upload', 'failed'],
        summary: message,
        extractionError: message,
      });

      logUploadError(uploadStage, error);
      setState((current) => ({
        ...current,
        documents: current.documents.map((document) => (document.id === documentId ? failedDocument : document)),
        chunks: current.chunks.filter((chunk) => chunk.documentId !== documentId),
      }));
      setFailedUpload({ file, documentId, title, cleanName, type: 'IMAGE' });
      setNote(`${message} You can retry the import without selecting the file again.`);
    } finally {
      setIsReading(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      setNote('Choose a TXT, PDF, DOCX, PNG, JPG, JPEG, or HEIC file before uploading.');
      return;
    }

    const cleanName = selectedFile?.name || fileName.trim() || 'Untitled Research Source.pdf';
    const extension = cleanName.split('.').pop()?.toUpperCase();
    const type = extension === 'TXT' || extension === 'DOCX' ? extension : isSupportedImageFile(selectedFile, cleanName) ? 'IMAGE' : 'PDF';
    const title = cleanName.replace(/\.(pdf|txt|docx|png|jpe?g|heic)$/i, '').replace(/[-_]/g, ' ');
    const documentId = `doc-${Date.now()}`;

    if (type === 'TXT' && selectedFile) {
      let uploadStage: UploadStage = 'file-selected';
      setIsReading(true);
      logUploadStage(uploadStage, { fileName: cleanName, type: 'TXT' });
      setNote('Uploading document...');

      try {
        uploadStage = 'extracting';
        logUploadStage(uploadStage, { fileName: cleanName });
        setNote('Reading report...');
        const extractedText = await selectedFile.text();
        const wordCount = getWordCount(extractedText);

        if (wordCount === 0 || !extractedText.trim()) {
          throw new Error('No readable text found in this TXT file.');
        }

        uploadStage = 'chunking';
        logUploadStage(uploadStage, { fileName: cleanName, wordCount });
        setNote('Finding subjects...');
        const chunks = chunkText({ text: extractedText, documentId });

        if (chunks.length === 0) {
          throw new Error('This text file could not be prepared. Try another file.');
        }

        const tags = extractTopics(extractedText);
        const originalFile = await createOriginalFileSnapshotSafe(selectedFile, extractedText);

        let newDocument: ResearchDocument = enrichDocument({
          id: documentId,
          title,
          type,
          workspaceId: activeWorkspaceId,
          authors: 'Local TXT upload',
          addedAt: new Date().toISOString(),
          status: 'Ready',
          tags: tags.length ? tags : ['txt upload'],
          insightCount: 0,
          summary: summarizeText(extractedText),
          extractedText,
          wordCount,
          chunkIds: chunks.map((chunk) => chunk.id),
          originalFile,
        });
        setNote('Understanding teacher comments...');
        const metadataAnalysis = await analyseDocumentMetadataIfPossible(newDocument);
        newDocument = applyAnalysedDocument(newDocument, metadataAnalysis);

        setState((current) => withDerivedCollections({
          ...current,
          documents: [newDocument, ...current.documents],
          chunks: [...chunks, ...current.chunks],
        }));
        uploadStage = 'saving';
        logUploadStage(uploadStage, { documentId, chunkCount: chunks.length });
        setNote('Updating your academic profile...');
        const performanceCount = await analyseUploadedPerformanceIfRelevant(newDocument, metadataAnalysis);
        const readyMessage = performanceCount ? 'Your academic profile has been updated.' : 'Your document has been imported.';
        setNote(readyMessage);
        await queueEmbeddings(newDocument, chunks, readyMessage);
      } catch (error) {
        const message = getStageErrorMessage(uploadStage, cleanName, error);
        const failedDocument: ResearchDocument = enrichDocument({
          id: documentId,
          title,
          type: 'TXT',
          workspaceId: activeWorkspaceId,
          authors: 'Local TXT upload',
          addedAt: new Date().toISOString(),
          status: 'Failed',
          tags: ['txt upload', 'failed'],
          insightCount: 0,
          summary: message,
          extractionError: message,
        });

        logUploadError(uploadStage, error);
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

    if (type === 'IMAGE' && selectedFile) {
      await processImageUpload({ file: selectedFile, cleanName, title, documentId });
      return;
    }

    setNote('Choose a TXT, PDF, DOCX, PNG, JPG, JPEG, or HEIC file to extract. Research OS no longer creates placeholder documents from a filename alone.');
  }

  return (
    <div className="upload-page mx-auto max-w-4xl">
      <section className="upload-workflow space-y-9">
        <div className="upload-page__header max-w-3xl">
          <SectionHeader
            title="Add a source"
            copy="Choose a document and add the academic context you want tracked."
            compact
          />
        </div>
        <div className="upload-stage-stack surface-raised divide-y divide-ink/[0.055] overflow-hidden">
          <section className="upload-stage upload-stage--file p-5 sm:p-7">
            <h3 className="text-xl font-semibold text-ink">Choose document</h3>
            <div className="mt-4">
              <label className="upload-dropzone flex min-h-20 cursor-pointer items-center justify-between gap-4 rounded-lg bg-paper/55 px-4 py-4 text-sm font-semibold text-graphite ring-1 ring-inset ring-ink/10 hover:bg-paper hover:text-ink focus-within:ring-2 focus-within:ring-ink/20 sm:px-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx,.png,.jpg,.jpeg,.heic,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/heic"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    logUploadStage('file-selected', file ? { fileName: file.name, type: file.type, size: file.size } : { fileName: null });
                    setSelectedFile(file);
                    setFileName(file?.name ?? fileName);
                  }}
                />
                <span>Choose file</span>
                <span className="text-right text-xs font-medium text-graphite/80">TXT, PDF, DOCX or image</span>
              </label>
            </div>
            {selectedFile ? <p className="mt-4 truncate text-sm font-medium text-ink">{selectedFile.name}</p> : null}
          </section>

          {hasSelectedFile ? (
            <section className="upload-stage upload-stage--time p-5 sm:p-7">
              <h3 className="text-xl font-semibold text-ink">Academic time</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
                <FormField label="Academic year" hint="e.g. 2025-2026"><input value={metadataDraft.academicYear} onChange={(event) => updateUploadMetadata('academicYear', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
                <FormField label="Term"><select value={metadataDraft.term} onChange={(event) => updateUploadMetadata('term', event.target.value as AcademicTerm)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm outline-none ring-ink/10 focus:ring-4">{academicTerms.map((term) => <option key={term} value={term}>{term}</option>)}</select></FormField>
                <FormField label="Assessment or report name" hint="e.g. Michaelmas Report" className="sm:col-span-2"><input value={metadataDraft.linkedAssessmentName} onChange={(event) => updateUploadMetadata('linkedAssessmentName', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
              </div>
              <details className="mt-3 rounded-lg border border-ink/10 bg-paper/50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-ink">Add exact date (optional)</summary>
                <FormField label="Exact date" className="mt-3"><input type="date" value={metadataDraft.sourceDate} onChange={(event) => updateUploadMetadata('sourceDate', event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
              </details>
            </section>
          ) : null}

          {hasSelectedFile && hasAcademicTime ? (
            <section className="upload-stage upload-stage--type p-5 sm:p-7">
              <h3 className="text-xl font-semibold text-ink">Document type</h3>
              <div className="mt-4 grid gap-3">
                <FormField label="Type"><select value={metadataDraft.documentCategory} onChange={(event) => updateUploadMetadata('documentCategory', event.target.value as DocumentCategory)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm outline-none ring-ink/10 focus:ring-4">{documentCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></FormField>
              </div>
            </section>
          ) : null}

          {hasSelectedFile && hasAcademicTime && hasDocumentKind ? (
            <section className="upload-stage upload-stage--subjects p-5 sm:p-7">
              <h3 className="text-xl font-semibold text-ink">Subjects</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {defaultSubjectOptions.map((subject) => (
                  <button key={subject} type="button" aria-pressed={metadataDraft.subjectsIncluded.includes(subject)} onClick={() => toggleUploadSubject(subject)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${metadataDraft.subjectsIncluded.includes(subject) ? 'border-ink bg-ink text-white' : 'border-ink/10 bg-paper text-graphite/80'}`}>
                    {subject}
                  </button>
                ))}
              </div>
              <FormField label="Other subjects" hint="Optional" className="mt-3"><textarea value={metadataDraft.customSubjects} onChange={(event) => updateUploadMetadata('customSubjects', event.target.value)} rows={2} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" /></FormField>
              <label className="mt-3 flex gap-3 rounded-lg bg-paper/60 p-3 text-sm leading-6 text-graphite/80">
                <input type="checkbox" checked={metadataDraft.ignoreInstrumentalMusic} onChange={(event) => updateUploadMetadata('ignoreInstrumentalMusic', event.target.checked)} className="mt-1 size-4 shrink-0 accent-ink" />
                <span>Keep instrumental or performance lesson content out of academic progress.</span>
              </label>
            </section>
          ) : null}

          {hasSelectedFile && hasAcademicTime && hasDocumentKind ? (
            <section className="upload-stage upload-stage--commit p-5 sm:p-7">
              <button type="button" onClick={handleUpload} disabled={isReading || !canUpload} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-graphite disabled:cursor-not-allowed disabled:bg-graphite/55">
                <FilePlus2 size={18} />
                {isReading ? 'Importing...' : 'Import document'}
              </button>
              {isReading || note !== 'Choose a document to add to this workspace.' ? <p key={note} role="status" className="status-strip status-enter mt-4 text-center text-sm font-medium text-graphite/80">{note}</p> : null}
              {failedUpload ? (
                <button
                  type="button"
                  onClick={() =>
                    failedUpload.type === 'PDF'
                      ? processPdfUpload(failedUpload)
                      : failedUpload.type === 'DOCX'
                        ? processDocxUpload(failedUpload)
                        : processImageUpload(failedUpload)
                  }
                  disabled={isReading}
                  className="mt-3 w-full rounded-lg border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-paper/50 disabled:cursor-not-allowed disabled:bg-paper disabled:text-graphite/45"
                >
                  Retry import
                </button>
              ) : null}
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function formatChunkLocation(result: RetrievedChunk) {
  if (result.pageStart && result.pageEnd) {
    return result.pageStart === result.pageEnd ? `p. ${result.pageStart}` : `pp. ${result.pageStart}-${result.pageEnd}`;
  }

  return `section ${result.chunk.chunkIndex + 1}`;
}

function buildResearchChatContext(
  results: RetrievedChunk[],
  performanceRecords: PerformanceRecord[],
  performanceSummaries: PerformanceSummary[],
  tutorLessons: ReturnType<typeof useResearchState>['state']['tutorLessons'],
  tutorAttempts: ReturnType<typeof useResearchState>['state']['tutorAttempts'],
) {
  return results.map((result) => ({
    title: result.document.title,
    location: formatChunkLocation(result),
    pageStart: result.pageStart,
    pageEnd: result.pageEnd,
    summary: result.document.summary,
    topics: result.document.tags,
    extractedText: result.chunk.text,
    matchedTerms: result.matchedTerms,
    metadata: getDocumentMetadata(result.document, performanceRecords),
    performanceContext: performanceRecords
      .filter((record) => record.sourceDocumentId === result.document.id || result.document.tags.some((tag) => tag.toLowerCase() === record.subject.toLowerCase()))
      .slice(0, 8)
      .map((record) => {
        const reviewCopy = needsExtractionReview(record) ? 'waiting for review' : hasReviewAvailable(record) ? 'review available' : 'confirmed';
        return `${record.date}: ${record.subject} ${formatResult(record)} (${reviewCopy})${record.teacherComment ? `; comment: ${record.teacherComment}` : ''}`;
      })
      .concat(
        performanceSummaries.slice(0, 2).map((summary) => `Summary: ${summary.overallCommentary}`),
      ),
    tutorContext: [
      ...tutorLessons
        .filter((lesson) => lesson.citations.some((citation) => citation.documentTitle === result.document.title) || result.document.tags.some((tag) => tag.toLowerCase() === lesson.topic.toLowerCase()))
        .slice(0, 4)
        .map((lesson) => `${lesson.status}: ${lesson.topic} - ${lesson.objective}`),
      ...tutorAttempts
        .filter((attempt) => result.document.tags.some((tag) => tag.toLowerCase() === attempt.topic.toLowerCase()))
        .slice(0, 4)
        .map((attempt) => `${attempt.mode}: ${attempt.topic} - ${attempt.feedback}`),
    ],
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
  performanceRecords,
  performanceSummaries,
  tutorLessons,
  tutorAttempts,
  storageStatus,
  userId,
  setState,
}: {
  chat: ChatMessage[];
  workspaceName: string;
  workspaceId: string;
  documents: ResearchDocument[];
  chunks: DocumentChunk[];
  performanceRecords: PerformanceRecord[];
  performanceSummaries: PerformanceSummary[];
  tutorLessons: ReturnType<typeof useResearchState>['state']['tutorLessons'];
  tutorAttempts: ReturnType<typeof useResearchState>['state']['tutorAttempts'];
  storageStatus: ReturnType<typeof useResearchState>['storageStatus'];
  userId?: string | null;
  setState: ReturnType<typeof useResearchState>['setState'];
}) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const latestCitations = [...chat].reverse().find((message) => message.citations?.length)?.citations ?? [];
  const searchableDocuments = documents.filter((document) => document.extractedText?.trim() && document.status !== 'Failed');

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'end' });
  }, [chat.length, isLoading]);

  async function sendMessage() {
    const question = prompt.trim();

    if (!question || isLoading) return;
    if (searchableDocuments.length === 0) {
      setErrorMessage('Add a source before asking a question.');
      return;
    }

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
        documents: buildResearchChatContext(retrievedChunks, performanceRecords, performanceSummaries, tutorLessons, tutorAttempts),
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
      setErrorMessage('Try again in a moment.');
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteMessage(message: ChatMessage) {
    try {
      await deleteRemoteRowsIfNeeded({ chat_messages: [message.id] }, storageStatus, userId);
      setState((current) => ({ ...current, chat: current.chat.filter((item) => item.id !== message.id) }));
    } catch (error) {
      setErrorMessage('Message was not deleted. Check your connection and try again.');
    }
  }

  async function clearChatHistory() {
    try {
      await deleteRemoteRowsIfNeeded({ chat_messages: chat.map((message) => message.id) }, storageStatus, userId);
      setState((current) => ({ ...current, chat: [] }));
    } catch (error) {
      setErrorMessage('Chat history was not cleared. Check your connection and try again.');
    }
  }

  return (
    <div className={`research-chat mx-auto grid gap-6 ${searchableDocuments.length ? `h-full min-h-[20rem] max-w-7xl ${latestCitations.length ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}` : 'max-w-5xl'}`}>
      <section className={`research-chat__conversation flex min-h-0 flex-col overflow-hidden ${searchableDocuments.length ? 'surface-raised' : 'research-chat__conversation--empty'}`}>
        <div className={`research-chat__header shrink-0 ${searchableDocuments.length ? 'border-b border-ink/10 p-4 sm:p-6' : 'pb-7'}`}>
          <div className="relative">
            <SectionHeader title="Ask your sources" copy="Ask about a report, teacher feedback, a weak topic, or a contradiction." compact />
            {chat.length ? (
              <div className="absolute right-0 top-0">
                <IconTextButton
                  icon={Trash2}
                  label="Clear chat"
                  danger
                  iconOnly
                  onClick={() =>
                    setConfirmAction({
                      title: 'Clear chat history?',
                      body: 'This deletes all chat messages in the current Research OS history. Documents, Tutor sessions, and performance records are kept.',
                      confirmLabel: 'Clear chat',
                      onConfirm: clearChatHistory,
                    })
                  }
                />
              </div>
            ) : null}
          </div>
        </div>
        <div className={`research-chat__messages scrollbar-soft min-h-0 flex-1 space-y-5 overflow-y-auto ${searchableDocuments.length ? 'px-4 py-5 sm:px-7 sm:py-6' : ''}`}>
          {chat.length ? (
            chat.map((message) => (
              <div key={message.id} className={`research-chat__message ${message.role === 'user' ? 'research-chat__message--user ml-auto max-w-[70ch]' : 'research-chat__message--assistant mr-auto max-w-[78ch]'} group`}>
                <div className={`research-chat__message-body rounded-lg p-4 sm:p-5 ${message.role === 'user' ? 'bg-ink text-white' : 'bg-paper/70 text-ink'}`}>
                  <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmAction({
                      title: 'Delete this chat message?',
                      body: 'This removes one chat message from the conversation history. Other messages are kept.',
                      confirmLabel: 'Delete message',
                      onConfirm: () => deleteMessage(message),
                    })
                  }
                  className="mt-1.5 text-xs font-semibold text-graphite/80 transition-opacity hover:text-brass md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                >
                  Delete message
                </button>
                {message.citations ? (
                  <details className="mt-3 rounded-lg border border-ink/10 bg-white p-3 xl:hidden">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-graphite/80">
                      {message.citations.length} source{message.citations.length === 1 ? '' : 's'}
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
              title="Start with a source"
              copy="Add a report, note, paper, or assessment before asking a question."
            />
          )}
          {isLoading ? (
            <div className="research-chat__loading mr-auto max-w-[820px]">
              <div className="rounded-lg border border-ink/10 bg-paper/70 p-5 text-ink">
                <div className="flex items-center gap-3 text-sm font-semibold text-graphite/80">
                  <span className="size-2 animate-pulse rounded-full bg-brass" />
                  <span className="size-2 animate-pulse rounded-full bg-brass [animation-delay:120ms]" />
                  <span className="size-2 animate-pulse rounded-full bg-brass [animation-delay:240ms]" />
                  <span className="ml-1">Reading your sources…</span>
                </div>
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
        {searchableDocuments.length ? <div className="research-chat__composer chat-composer shrink-0 border-t border-ink/10 bg-white p-4 sm:px-6 sm:py-5">
          {errorMessage ? (
            <div role="status" className="status-strip status-enter mb-3 rounded-lg border border-brass/20 bg-brass/10 px-4 py-3 text-sm font-semibold text-graphite">
              Research chat could not answer right now. {errorMessage}
            </div>
          ) : null}
          <div className="flex gap-3">
            <input
              aria-label="Ask your workspace"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendMessage();
              }}
              disabled={isLoading || searchableDocuments.length === 0}
              placeholder={searchableDocuments.length ? 'Ask about claims, contradictions, teacher comments, or gaps...' : 'Add a source before asking...'}
              className="min-w-0 flex-1 rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 transition focus:ring-4 disabled:cursor-not-allowed disabled:bg-paper"
            />
            <button
              type="button"
              aria-label="Send research question"
              title="Send research question"
              onClick={sendMessage}
              disabled={isLoading || searchableDocuments.length === 0}
              className="grid size-12 place-items-center rounded-lg bg-ink text-white shadow-sm transition hover:bg-graphite disabled:cursor-not-allowed disabled:bg-graphite/55"
            >
              <Send size={18} />
            </button>
          </div>
        </div> : null}
      </section>

      {searchableDocuments.length && latestCitations.length ? <aside className="research-chat__evidence surface-raised hidden min-h-0 overflow-hidden xl:flex xl:flex-col">
        <div className="shrink-0 border-b border-ink/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">Evidence</p>
          <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">Related sources</h3>
        </div>
        <div className="scrollbar-soft min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {latestCitations.length ? (
            latestCitations.map((citation) => <CitationCard key={`${citation.documentTitle}-${citation.location}`} citation={citation} />)
          ) : (
            <p className="rounded-lg bg-paper/70 p-4 text-sm leading-7 text-graphite/80">
              Related sources appear here after an answer.
            </p>
          )}
        </div>
      </aside> : null}
      <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
    </div>
  );
}

function StudyTools({ documents }: { documents: ResearchDocument[] }) {
  const [activeTool, setActiveTool] = useState('Summary');
  const sourceDocuments = documents.filter((document) => document.extractedText?.trim() && document.status !== 'Failed');
  const tools = [
    { label: 'Summary', icon: Sparkles },
    { label: 'Flashcards', icon: BrainCircuit },
    { label: 'Essay Plan', icon: LibraryBig },
    { label: 'Quiz', icon: CheckCircle2 },
    { label: 'Timeline', icon: CalendarDays },
  ];

  return (
    <div className="study-tools-page mx-auto max-w-6xl space-y-9">
      <div className="study-tools-page__header max-w-4xl">
        <SectionHeader
          eyebrow="Study tools"
          title="Prepare from your sources"
          copy="Choose a study format and see which sources are ready to support it."
          compact
        />
      </div>
      <div className="study-tools-layout grid gap-7 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="study-tools-rail surface-raised divide-y divide-ink/[0.055] overflow-hidden">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.label}
                type="button"
                onClick={() => setActiveTool(tool.label)}
                className={`study-tools-rail__choice flex w-full items-start gap-4 p-4 text-left transition sm:p-5 ${
                  activeTool === tool.label ? 'is-active bg-paper text-ink' : 'bg-white text-ink hover:bg-paper/50'
                }`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-paper text-graphite">
                  <Icon size={20} />
                </span>
                <span>
                  <span className="block font-semibold">{tool.label}</span>
                  <span className="mt-1 block text-sm leading-6 text-graphite/80">
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
        <div className="study-tools-workspace surface-raised p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">Selected format</p>
          <h3 className="mt-3 font-serif text-4xl font-semibold text-ink">{activeTool}</h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-graphite/80">
            {sourceDocuments.length
              ? `${sourceDocuments.length} readable source${sourceDocuments.length === 1 ? ' is' : 's are'} ready for ${activeTool.toLowerCase()} work.`
              : 'Upload readable documents before using study workflows. Summaries, flashcards, essay plans, quizzes, and timelines should be based on real workspace sources.'}
          </p>
          <div className="mt-7 divide-y divide-ink/[0.055] border-y border-ink/[0.055]">
            {sourceDocuments.length ? (
              sourceDocuments.slice(0, 4).map((document) => (
                <div key={document.id} className="py-4">
                  <p className="font-semibold text-ink">{document.title}</p>
                  <p className="mt-2 line-clamp-2 text-sm leading-7 text-graphite/80">{document.summary}</p>
                </div>
              ))
            ) : (
              <EmptyState title="Upload a study source" copy="Add a readable document before preparing study material." />
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
  const nodeById = Object.fromEntries(mapNodes.map((node) => [node.id, node]));
  const toneClasses = {
    moss: 'bg-white text-ink border-moss/35',
    brass: 'bg-white text-ink border-brass/35',
    graphite: 'bg-white text-ink border-graphite/30',
    ink: 'bg-ink text-white border-ink',
  };

  return (
    <div className="knowledge-map-page mx-auto max-w-6xl space-y-9">
      <div className="knowledge-map-page__header max-w-4xl">
        <SectionHeader
          eyebrow="Knowledge map"
          title="Connected topic graph"
          copy="Topics found across your sources, connected by shared context."
          compact
        />
      </div>
      {mapNodes.length === 0 ? (
        <EmptyState title="Create a topic map" copy="Upload documents and Research OS will use their topics to start a workspace map." />
      ) : (
      <div>
        <div className="knowledge-map-stage knowledge-map-frame relative min-h-[460px] overflow-hidden rounded-lg border border-ink/10 bg-white shadow-sm sm:min-h-[560px]">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {mapEdges.map((edge) => {
              const from = nodeById[edge.from];
              const to = nodeById[edge.to];
              if (!from || !to) return null;
              return <line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--rule-strong)" strokeWidth="0.28" />;
            })}
          </svg>
          <div className="absolute left-5 top-5 z-10 rounded-lg border border-ink/10 bg-paper/80 px-4 py-3 text-ink">
            <div className="flex items-center gap-2">
              <Network size={18} />
              <span className="text-sm font-semibold">
                {mapNodes.length} topics / {mapEdges.length} links
              </span>
            </div>
          </div>
          {mapNodes.map((node) => (
            <div
              key={node.id}
              className={`absolute z-20 grid place-items-center overflow-hidden rounded-full border px-3 text-center text-xs font-semibold leading-tight shadow-sm sm:px-4 sm:text-sm ${toneClasses[node.tone]}`}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                width: node.size,
                height: node.size,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span className="max-w-full break-words">{node.label}</span>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}

export default App;
