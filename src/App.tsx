import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Edit3,
  FilePlus2,
  FolderKanban,
  LibraryBig,
  Network,
  Trash2,
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
import { deleteSupabaseRows, saveChunks, saveDocument } from './services/researchStore';
import type { AssessmentType, ChatMessage, Collection, DocumentChunk, DocumentMetadata, MapEdge, MapNode, PageId, PerformanceRecord, PerformanceSummary, ResearchDocument, ResearchState } from './types/research';
import { analysePerformanceDocument, askResearchChat, embedChunks, generatePerformanceAdvice, semanticSearch, type PerformanceAnalysisRecord, type SemanticSearchMatch } from './utils/api';
import { chunkText, extractTopics, getWordCount, summarizeText } from './utils/chunkText';
import { extractDocxText } from './utils/extractDocxText';
import { extractPdfText } from './utils/extractPdfText';
import { buildDocumentMetadata, buildTimelineEvents, deriveCollections, getCollectionDocumentCount, getDocumentMetadata, type TimelineEvent } from './utils/learningModel';
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
    library: <Library state={state} documents={workspaceDocuments} chunks={state.chunks} storageStatus={storageStatus} setState={setState} />,
    performance: <PerformancePage records={state.performanceRecords} summaries={state.performanceSummaries} documents={state.documents} storageStatus={storageStatus} setState={setState} />,
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
        setState={setState}
      />
    ),
    upload: <Upload stateDocuments={workspaceDocuments} activeWorkspaceId={state.activeWorkspaceId} storageStatus={storageStatus} performanceRecords={state.performanceRecords} setState={setState} />,
    chat: <ResearchChat chat={state.chat} workspaceName={activeWorkspaceName} workspaceId={state.activeWorkspaceId} documents={workspaceDocuments} chunks={state.chunks} performanceRecords={state.performanceRecords} performanceSummaries={state.performanceSummaries} tutorLessons={state.tutorLessons} tutorAttempts={state.tutorAttempts} storageStatus={storageStatus} setState={setState} />,
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
  const newestDocuments = [...documents].slice(0, 3);
  const collections = deriveCollections(state);
  const timeline = buildTimelineEvents(state).slice(0, 5);
  const subjects = [
    ...new Set([
      ...documents.flatMap((document) => getDocumentMetadata(document, state.performanceRecords).subjects),
      ...state.performanceRecords.map((record) => record.subject),
    ]),
  ].slice(0, 8);
  const percentages = state.performanceRecords
    .map((record) => getRecordPercentage(record))
    .filter((percentage): percentage is number => typeof percentage === 'number');
  const latestAverage = percentages.length ? Math.round(percentages.reduce((total, value) => total + value, 0) / percentages.length) : undefined;
  const activeLesson = state.tutorLessons.find((lesson) => lesson.status === 'in_progress') ?? state.tutorLessons[0];
  const weakTopics = [
    ...new Set(
      state.performanceRecords
        .flatMap((record) => [...record.weaknesses, ...record.actionPoints])
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, 4);
  const hasDocuments = documents.length > 0;
  const hasReadySources = readyCount > 0;
  const nextAction = !hasDocuments
    ? { label: 'Upload first source', page: 'upload' as PageId, detail: 'Add a report, notes file, exam paper, or source document to start the system.' }
    : weakTopics.length
      ? { label: 'Practise weak topic', page: 'tutor' as PageId, detail: `Tutor can start with ${weakTopics[0]} using performance and source context.` }
      : activeLesson
        ? { label: 'Continue Tutor', page: 'tutor' as PageId, detail: activeLesson.objective }
        : { label: 'Ask across metadata', page: 'chat' as PageId, detail: 'Chat can combine source chunks with subjects, collections, performance, and Tutor history.' };

  return (
    <div className="space-y-7">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <div className="rounded-lg border border-ink/8 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Academic profile</p>
          <h2 className="mt-4 max-w-3xl font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            {hasReadySources ? 'Your learning system is connected.' : 'Create your own learning operating system.'}
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-graphite/72">
            {hasReadySources
              ? `${readyCount} ready source${readyCount === 1 ? '' : 's'} now feed Library, Chat, Tutor, Performance, Collections, Timeline, and the Knowledge Map.`
              : hasDocuments
                ? 'Some uploads still need readable text or recovery before the rest of Research OS can react.'
                : 'Start with a workspace that matches your real life: Biology, History, French, Music, Programming, personal research, or anything else you are studying.'}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" onClick={() => setActivePage(nextAction.page)} className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm">
              {nextAction.label}
              <ArrowRight size={17} />
            </button>
            <button type="button" onClick={() => setActivePage('timeline')} className="inline-flex items-center gap-2 rounded-lg border border-ink/10 bg-paper px-4 py-3 text-sm font-semibold text-ink">
              View timeline
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-ink/8 bg-paper/80 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">What should I do next?</p>
          <h3 className="mt-3 text-xl font-semibold text-ink">{nextAction.label}</h3>
          <p className="mt-3 text-sm leading-7 text-graphite/72">{nextAction.detail}</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <MetricCard label="Subjects" value={subjects.length.toLocaleString()} />
            <MetricCard label="Collections" value={collections.length.toLocaleString()} />
            <MetricCard label="Sources" value={documents.length.toLocaleString()} />
            <MetricCard label="Average" value={latestAverage !== undefined ? `${latestAverage}%` : '-'} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
        <div>
          <SectionHeader eyebrow="Subjects" title="What am I studying?" />
          <div className="rounded-lg border border-ink/8 bg-white p-5 shadow-sm">
            {subjects.length ? <ChipCloud items={subjects} /> : <p className="text-sm leading-7 text-graphite/70">Create a workspace or upload a source; subjects will be inferred gradually from metadata and performance records.</p>}
          </div>
        </div>
        <div>
          <SectionHeader eyebrow="Collections" title="Virtual source sets" />
          <div className="space-y-3">
            {collections.slice(0, 4).map((collection) => (
              <button key={collection.id} type="button" onClick={() => setActivePage('library')} className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink/8 bg-white p-4 text-left shadow-sm transition hover:border-ink/14">
                <span>
                  <span className="block font-semibold text-ink">{collection.name}</span>
                  <span className="mt-1 block text-sm text-graphite/68">{getCollectionDocumentCount(collection, documents, state.performanceRecords)} source links</span>
                </span>
                <FolderKanban size={18} className="text-graphite/55" />
              </button>
            ))}
            {!collections.length ? <EmptyState title="No collections yet" copy="Uploads will automatically appear in virtual collections such as reports, terms, subjects, assessments, and years." /> : null}
          </div>
        </div>
        <div>
          <SectionHeader eyebrow="Continue" title="Recent activity" />
          <div className="space-y-3">
            {timeline.length ? timeline.map((event) => <TimelineRow key={event.id} event={event} compact />) : <EmptyState title="No activity yet" copy="Uploads, performance records, Tutor sessions, and study events will appear here." />}
          </div>
        </div>
      </section>

      <section className="grid gap-7 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <SectionHeader eyebrow="Recent uploads" title="Source intake" />
          <div className="space-y-4">
            {newestDocuments.length ? (
              newestDocuments.map((document) => <DocumentCard key={document.id} document={document} />)
            ) : (
              <EmptyState title="No documents yet" copy="Add a source to begin building this workspace." action="Upload a source" onClick={() => setActivePage('upload')} />
            )}
          </div>
        </div>

        <div>
          <SectionHeader eyebrow="Performance" title="Progress overview" />
          <div className="rounded-lg border border-ink/8 bg-white p-5 shadow-sm">
            {state.performanceRecords.length ? (
              <div className="space-y-4">
                <TrendChart records={state.performanceRecords} />
                {weakTopics.length ? <TagList label="Priority themes" items={weakTopics} /> : null}
              </div>
            ) : (
              <EmptyState title="No performance picture yet" copy="Analyse an uploaded report or add an assessment record to start long-term progress tracking." action="Open Performance" onClick={() => setActivePage('performance')} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Library({
  state,
  documents,
  chunks,
  storageStatus,
  setState,
}: {
  state: ReturnType<typeof useResearchState>['state'];
  documents: ResearchDocument[];
  chunks: DocumentChunk[];
  storageStatus: ReturnType<typeof useResearchState>['storageStatus'];
  setState: ReturnType<typeof useResearchState>['setState'];
}) {
  const collections = deriveCollections(state);
  const [message, setMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  function renameCollection(collection: Collection, name: string) {
    const nextName = name.trim();
    if (!nextName) return;

    setState((current) =>
      withDerivedCollections({
        ...current,
        collections: current.collections.map((item) => (item.id === collection.id ? { ...item, name: nextName, source: 'user' } : item)),
        documents: current.documents.map((document) => {
          const metadata = getDocumentMetadata(document, current.performanceRecords);
          if (!metadata.collections.some((item) => item.toLowerCase() === collection.name.toLowerCase())) return document;
          const nextCollections = metadata.collections.map((item) => (item.toLowerCase() === collection.name.toLowerCase() ? nextName : item));
          return {
            ...document,
            metadata: { ...metadata, collections: nextCollections },
            collectionIds: nextCollections.map(collectionIdFromName),
          };
        }),
      }),
    );
    setMessage(`${collection.name} was renamed.`);
  }

  async function deleteCollection(collection: Collection) {
    try {
      await deleteRemoteRowsIfNeeded({ collections: [collection.id] }, storageStatus);
      setState((current) =>
        withDerivedCollections({
          ...current,
          collections: current.collections.filter((item) => item.id !== collection.id),
          documents: current.documents.map((document) => removeCollectionFromDocument(document, collection.name, current.performanceRecords)),
        }),
      );
      setMessage(`${collection.name} was deleted. Documents were kept.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Collection was not deleted: ${error.message}` : 'Collection was not deleted because Supabase failed.');
    }
  }

  async function deleteDocument(document: ResearchDocument) {
    try {
      await deleteRemoteDocumentIfNeeded(state, document.id, storageStatus);
      setState((current) => removeDocumentFromState(current, document.id));
      setMessage(`${document.title} and its chunks were deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Document was not deleted: ${error.message}` : 'Document was not deleted because Supabase failed.');
    }
  }

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Document library"
        title="Sources, metadata, and collections"
        copy="Documents are sources. Metadata and virtual collections let the same upload enrich Chat, Tutor, Performance, Timeline, and the Knowledge Map without duplication."
      />
      {message ? <StatusNote message={message} /> : null}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {collections.slice(0, 8).map((collection) => (
          <ManagedCollectionCard
            key={collection.id}
            collection={collection}
            documentCount={getCollectionDocumentCount(collection, documents, state.performanceRecords)}
            onRename={renameCollection}
            onDelete={(item) =>
              setConfirmAction({
                title: `Delete ${item.name}?`,
                body: 'This removes the virtual collection label from documents. The documents themselves will not be deleted.',
                confirmLabel: 'Delete collection',
                onConfirm: () => deleteCollection(item),
              })
            }
          />
        ))}
      </section>
      {documents.length ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {documents.map((document) => (
            <ManagedDocumentCard
              key={document.id}
              document={document}
              records={state.performanceRecords}
              chunkCount={chunks.filter((chunk) => chunk.documentId === document.id).length}
              onSave={(documentId, patch) => {
                setState((current) => applyDocumentEdit(current, documentId, patch));
                setMessage('Document details were updated.');
              }}
              onRemoveCollection={(documentId, collectionName) => {
                setState((current) =>
                  withDerivedCollections({
                    ...current,
                    documents: current.documents.map((item) => (item.id === documentId ? removeCollectionFromDocument(item, collectionName, current.performanceRecords) : item)),
                  }),
                );
                setMessage(`${collectionName} was removed from the document.`);
              }}
              onDelete={(item) =>
                setConfirmAction({
                  title: `Delete ${item.title}?`,
                  body: 'This deletes the document, its chunks, semantic embedding rows, and document-derived timeline events. Performance records are kept but unlinked from this source.',
                  confirmLabel: 'Delete document',
                  onConfirm: () => deleteDocument(item),
                })
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState title="Your library is empty" copy="Upload a TXT, PDF, or DOCX file to create searchable source material for this workspace." />
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
    <div className="rounded-lg border border-ink/8 bg-paper/70 px-4 py-3 text-sm leading-6 text-graphite/76">
      {message}
    </div>
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
      <div className="w-full max-w-lg rounded-xl border border-ink/10 bg-white p-5 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Confirm destructive action</p>
        <h2 className="mt-3 text-xl font-semibold text-ink">{action.title}</h2>
        <p className="mt-3 text-sm leading-7 text-graphite/75">{action.body}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isWorking} className="rounded-lg border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={isWorking} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-red-400">
            {isWorking ? 'Working...' : action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManagedCollectionCard({
  collection,
  documentCount,
  onRename,
  onDelete,
}: {
  collection: Collection;
  documentCount: number;
  onRename: (collection: Collection, name: string) => void;
  onDelete: (collection: Collection) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(collection.name);

  return (
    <div className="rounded-lg border border-ink/8 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">
        <FolderKanban size={14} />
        Collection
      </div>
      {isEditing ? (
        <div className="mt-3 space-y-3">
          <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" />
          <div className="flex gap-2">
            <button type="button" onClick={() => { onRename(collection, name); setIsEditing(false); }} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">Save</button>
            <button type="button" onClick={() => { setName(collection.name); setIsEditing(false); }} className="rounded-lg border border-ink/10 px-3 py-2 text-xs font-semibold text-ink">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 truncate text-lg font-semibold text-ink">{collection.name}</p>
          <p className="mt-1 text-sm text-graphite/68">{documentCount} source links</p>
          <div className="mt-4 flex gap-2">
            <IconTextButton icon={Edit3} label="Rename" onClick={() => setIsEditing(true)} />
            <IconTextButton icon={Trash2} label="Delete" onClick={() => onDelete(collection)} danger />
          </div>
        </>
      )}
    </div>
  );
}

function ManagedDocumentCard({
  document,
  records,
  chunkCount,
  onSave,
  onRemoveCollection,
  onDelete,
}: {
  document: ResearchDocument;
  records: PerformanceRecord[];
  chunkCount: number;
  onSave: (documentId: string, patch: { title?: string; metadata?: Partial<DocumentMetadata> }) => void;
  onRemoveCollection: (documentId: string, collectionName: string) => void;
  onDelete: (document: ResearchDocument) => void;
}) {
  const metadata = getDocumentMetadata(document, records);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(document.title);
  const [subjects, setSubjects] = useState(metadata.subjects.join(', '));
  const [topics, setTopics] = useState(metadata.topics.join(', '));
  const [academicYears, setAcademicYears] = useState(metadata.academicYears.join(', '));
  const [terms, setTerms] = useState(metadata.terms.join(', '));
  const [documentTypes, setDocumentTypes] = useState(metadata.documentTypes.join(', '));
  const [teacherNames, setTeacherNames] = useState(metadata.teacherNames.join(', '));
  const [skills, setSkills] = useState(metadata.skills.join(', '));
  const [collections, setCollections] = useState(metadata.collections.join(', '));
  const [tags, setTags] = useState(metadata.tags.join(', '));

  function save() {
    const nextMetadata: Partial<DocumentMetadata> = {
      subjects: normalizeListInput(subjects),
      topics: normalizeListInput(topics),
      academicYears: normalizeListInput(academicYears),
      terms: normalizeListInput(terms),
      documentTypes: normalizeListInput(documentTypes),
      teacherNames: normalizeListInput(teacherNames),
      skills: normalizeListInput(skills),
      collections: normalizeListInput(collections),
      tags: normalizeListInput(tags),
    };
    onSave(document.id, { title, metadata: nextMetadata });
    setIsEditing(false);
  }

  return (
    <div className="space-y-3">
      <DocumentCard document={document} chunkCount={chunkCount} />
      {isEditing ? (
        <div className="rounded-lg border border-ink/8 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Edit source metadata</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Document title" className="rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4 md:col-span-2" />
            <EditListField label="Subjects" value={subjects} setValue={setSubjects} />
            <EditListField label="Topics" value={topics} setValue={setTopics} />
            <EditListField label="Academic years" value={academicYears} setValue={setAcademicYears} />
            <EditListField label="Terms" value={terms} setValue={setTerms} />
            <EditListField label="Document types" value={documentTypes} setValue={setDocumentTypes} />
            <EditListField label="Teacher names" value={teacherNames} setValue={setTeacherNames} />
            <EditListField label="Skills" value={skills} setValue={setSkills} />
            <EditListField label="Collections" value={collections} setValue={setCollections} />
            <EditListField label="Tags" value={tags} setValue={setTags} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={save} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">Save changes</button>
            <button type="button" onClick={() => setIsEditing(false)} className="rounded-lg border border-ink/10 px-4 py-2 text-sm font-semibold text-ink">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-ink/8 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <IconTextButton icon={Edit3} label="Edit" onClick={() => setIsEditing(true)} />
            <IconTextButton icon={Trash2} label="Delete" onClick={() => onDelete(document)} danger />
          </div>
          {metadata.collections.length ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Remove from collection</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {metadata.collections.map((collection) => (
                  <button key={collection} type="button" onClick={() => onRemoveCollection(document.id, collection)} className="rounded-full border border-ink/10 bg-paper px-3 py-1 text-xs font-semibold text-graphite/75">
                    {collection}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function EditListField({ label, value, setValue }: { label: string; value: string; setValue: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">{label}</span>
      <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={2} className="mt-2 w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4" />
    </label>
  );
}

function IconTextButton({ icon: Icon, label, onClick, danger = false }: { icon: typeof Edit3; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
        danger ? 'border-red-200 bg-red-50 text-red-700' : 'border-ink/10 bg-white text-ink'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
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
    tags: overrides.tags ?? base.tags,
  };
}

function removeCollectionFromDocument(document: ResearchDocument, collectionName: string, records: PerformanceRecord[]) {
  const metadata = getDocumentMetadata(document, records);
  const nextCollections = metadata.collections.filter((name) => name.toLowerCase() !== collectionName.toLowerCase());

  return {
    ...document,
    metadata: {
      ...metadata,
      collections: nextCollections,
    },
    collectionIds: nextCollections.map(collectionIdFromName),
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
      return {
        ...nextDocument,
        tags: metadata.tags.length ? metadata.tags : nextDocument.tags,
        metadata,
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

async function deleteRemoteDocumentIfNeeded(state: ResearchState, documentId: string, storageStatus: ReturnType<typeof useResearchState>['storageStatus']) {
  if (storageStatus !== 'connected') return;
  const chunkIds = state.chunks.filter((chunk) => chunk.documentId === documentId).map((chunk) => chunk.id);
  const insightIds = state.insights.filter((insight) => insight.sourceId === documentId).map((insight) => insight.id);

  await deleteSupabaseRows({
    documents: [documentId],
    document_chunks: chunkIds,
    insights: insightIds,
  });
}

async function deleteRemoteRowsIfNeeded(rows: Parameters<typeof deleteSupabaseRows>[0], storageStatus: ReturnType<typeof useResearchState>['storageStatus']) {
  if (storageStatus !== 'connected') return;
  await deleteSupabaseRows(rows);
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
  storageStatus,
  setState,
}: {
  records: PerformanceRecord[];
  summaries: PerformanceSummary[];
  documents: ResearchDocument[];
  storageStatus: ReturnType<typeof useResearchState>['storageStatus'];
  setState: ReturnType<typeof useResearchState>['setState'];
}) {
  const [form, setForm] = useState({
    title: '',
    subject: '',
    date: new Date().toISOString().slice(0, 10),
    academicYear: '',
    term: '',
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
  const [editingRecordId, setEditingRecordId] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

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
      teacherComment: record.teacherComment ?? '',
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
      date: form.date || new Date().toISOString().slice(0, 10),
      academicYear: form.academicYear.trim() || undefined,
      term: form.term.trim() || undefined,
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
      withDerivedCollections({
        ...current,
        performanceRecords: existing
          ? current.performanceRecords.map((item) => (item.id === existing.id ? record : item))
          : [record, ...current.performanceRecords],
        documents: current.documents.map((document) => ({
          ...document,
          metadata: buildDocumentMetadata(document, existing ? current.performanceRecords.map((item) => (item.id === existing.id ? record : item)) : [record, ...current.performanceRecords]),
        })),
      }),
    );
    setEditingRecordId('');
    setForm((current) => ({
      ...current,
      title: '',
      subject: '',
      academicYear: '',
      term: '',
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
    setStatusMessage(`${record.title} was ${existing ? 'updated' : 'saved'} locally.`);
  }

  async function deletePerformanceRecord(record: PerformanceRecord) {
    try {
      await deleteRemoteRowsIfNeeded({ performance_records: [record.id] }, storageStatus);
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
      setStatusMessage(error instanceof Error ? `Performance record was not deleted: ${error.message}` : 'Performance record was not deleted because Supabase failed.');
    }
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

      setState((current) => {
        const performanceRecords = [...newRecords, ...current.performanceRecords];
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
      <SectionHeader eyebrow="Performance" title="Performance" copy="Add marks manually or analyse uploaded reports that contain readable academic results." />

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
            <input value={form.academicYear} onChange={(event) => updateForm('academicYear', event.target.value)} placeholder="Academic year, e.g. 2025-2026" className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" />
            <input value={form.term} onChange={(event) => updateForm('term', event.target.value)} placeholder="Term, e.g. Summer" className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4" />
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
              }}
              className="ml-2 mt-4 rounded-xl border border-ink/10 px-4 py-3 text-sm font-semibold text-ink"
            >
              Cancel edit
            </button>
          ) : null}
        </form>

        <div className="space-y-6">
          <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">
              <Sparkles size={15} />
              Analyse uploaded report
            </div>
            <p className="mt-3 text-sm leading-7 text-graphite/72">Select an uploaded report with extracted text. Research OS will ask the model for structured academic records and will not invent missing marks.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <select value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4">
                <option value="">Choose uploaded document</option>
                {analysableDocuments.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title}
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleAnalyseDocument} disabled={isAnalysing || analysableDocuments.length === 0} className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-graphite/55">
                {isAnalysing ? 'Analysing...' : 'Analyse'}
              </button>
            </div>
            {analysableDocuments.length === 0 ? (
              <p className="mt-3 rounded-xl bg-paper/70 p-3 text-sm leading-6 text-graphite/70">Upload a TXT, PDF, or DOCX report first. Documents without readable text cannot be analysed.</p>
            ) : null}
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
                Add at least one performance record before generating advice. With limited data, the summary will include a confidence caveat.
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Records" title="Edit saved performance data" />
        <div className="grid gap-3">
          {records.length ? (
            records.map((record) => (
              <article key={record.id} className="rounded-lg border border-ink/8 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-ink">{record.title}</p>
                    <p className="mt-1 text-sm text-graphite/70">
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
                          body: 'This removes the performance record and updates derived collections, timeline, Tutor recommendations, and document metadata.',
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
            <EmptyState title="No editable records yet" copy="Saved or extracted performance records will appear here." />
          )}
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
      <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
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

function ChipCloud({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-graphite/75">
          {item}
        </span>
      ))}
    </div>
  );
}

function TimelineRow({ event, compact = false }: { event: TimelineEvent; compact?: boolean }) {
  return (
    <article className="rounded-lg border border-ink/8 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">
            {event.academicYear} / {event.term} / {event.type}
          </p>
          <h3 className={`${compact ? 'mt-2 text-sm' : 'mt-3 text-lg'} font-semibold text-ink`}>{event.title}</h3>
          <p className={`${compact ? 'line-clamp-2' : ''} mt-2 text-sm leading-6 text-graphite/72`}>{event.detail}</p>
          {!compact && event.subjects.length ? <div className="mt-3"><ChipCloud items={event.subjects.slice(0, 6)} /></div> : null}
        </div>
        <time className="shrink-0 rounded-full bg-paper px-3 py-1 text-xs font-semibold text-graphite/70">{event.date || 'Undated'}</time>
      </div>
    </article>
  );
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
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Timeline"
        title="Everything in one learning history"
        copy="Uploads, reports, exam results, Tutor work, study sessions, and knowledge milestones are grouped by academic year, term, and date."
      />
      {events.length ? (
        <div className="space-y-8">
          {Object.entries(groups).map(([academicYear, termGroups]) => (
            <section key={academicYear} className="space-y-4">
              <h2 className="font-serif text-3xl font-semibold text-ink">{academicYear}</h2>
              {Object.entries(termGroups).map(([term, dateGroups]) => (
                <div key={`${academicYear}-${term}`} className="border-l border-ink/10 pl-4">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-graphite/55">{term}</h3>
                  <div className="space-y-3">
                    {Object.entries(dateGroups).map(([date, dateEvents]) => (
                      <div key={`${term}-${date}`} className="grid gap-3 xl:grid-cols-[140px_1fr]">
                        <time className="pt-4 text-sm font-semibold text-graphite/70">{date}</time>
                        <div className="space-y-3">
                          {dateEvents.map((event) => (
                            <TimelineRow key={event.id} event={event} />
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
        <EmptyState title="No timeline yet" copy="Upload a source, analyse a report, or complete a Tutor activity to start the unified learning timeline." />
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
  if (document.embeddingStatus === 'failed') return 'Keyword search ready';
  if (document.embeddingStatus === 'keyword_only') return 'Keyword search ready';

  return 'Not embedded';
}

function Upload({
  stateDocuments,
  activeWorkspaceId,
  storageStatus,
  performanceRecords,
  setState,
}: {
  stateDocuments: ResearchDocument[];
  activeWorkspaceId: string;
  storageStatus: ReturnType<typeof useResearchState>['storageStatus'];
  performanceRecords: PerformanceRecord[];
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

  function enrichDocument(document: ResearchDocument) {
    const metadata = buildDocumentMetadata(document, performanceRecords);
    return {
      ...document,
      metadata,
      collectionIds: metadata.collections.map((collection) => `collection-${collection.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`),
    };
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
      setNote(`${readyMessage} Keyword search is ready now. Semantic search will start after Supabase connects.`);
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
          : `${readyMessage} Keyword search is ready; semantic embeddings were skipped.`,
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
      setNote(`${readyMessage} Keyword search is ready; semantic embeddings failed but upload is saved.`);
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
      const readyDocument: ResearchDocument = enrichDocument({
        ...processingDocument,
        status: 'Ready',
        tags: tags.length ? tags : ['pdf upload'],
        summary: summarizeText(extracted.text),
        extractedText: extracted.text,
        pageCount: extracted.pages.length,
        wordCount: extracted.wordCount,
        chunkIds: chunks.map((chunk) => chunk.id),
      });

      setState((current) => withDerivedCollections({
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
      const readyDocument: ResearchDocument = enrichDocument({
        ...processingDocument,
        status: 'Ready',
        tags: tags.length ? tags : ['docx upload'],
        summary: summarizeText(extracted.text),
        extractedText: extracted.text,
        wordCount: extracted.wordCount,
        chunkIds: chunks.map((chunk) => chunk.id),
      });

      setState((current) => withDerivedCollections({
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

        const newDocument: ResearchDocument = enrichDocument({
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
        });

        setState((current) => withDerivedCollections({
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
          copy="Choose a TXT, PDF, or DOCX file. Research OS extracts readable text, creates chunks for keyword search, then adds semantic embeddings when Supabase is connected."
        />
        <div className="rounded-2xl border border-dashed border-ink/16 bg-white p-5 shadow-sm">
          <div className="grid min-h-[340px] place-items-center rounded-2xl bg-paper/65 px-5 py-10 text-center">
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-ink/8 bg-white text-ink shadow-sm">
                <UploadCloud size={28} />
              </div>
              <h3 className="mt-5 font-serif text-3xl font-semibold text-ink">Place a source on the desk</h3>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-graphite/72">
                Upload first, then ask Chat or Tutor questions against the extracted source chunks. Scanned PDFs may need OCR before they can be searched.
              </p>
              <div className="mx-auto mt-7 flex max-w-xl flex-col gap-3 sm:flex-row">
                <input
                  value={fileName}
                  onChange={(event) => setFileName(event.target.value)}
                  placeholder="optional-display-name.pdf"
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
                      document.status === 'Failed'
                        ? null
                        : document.embeddingStatus === 'keyword_only'
                          ? 'Keyword search ready'
                          : formatEmbeddingStatus(document),
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
      .map((record) => `${record.date}: ${record.subject} ${formatResult(record)}${record.teacherComment ? `; comment: ${record.teacherComment}` : ''}`)
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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.length, isLoading]);

  async function sendMessage() {
    const question = prompt.trim();

    if (!question || isLoading) return;
    if (searchableDocuments.length === 0) {
      setErrorMessage('Upload a readable TXT, PDF, or DOCX file before asking source-grounded questions.');
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
      const message = error instanceof Error ? error.message : 'Research chat failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteMessage(message: ChatMessage) {
    try {
      await deleteRemoteRowsIfNeeded({ chat_messages: [message.id] }, storageStatus);
      setState((current) => ({ ...current, chat: current.chat.filter((item) => item.id !== message.id) }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? `Message was not deleted: ${error.message}` : 'Message was not deleted because Supabase failed.');
    }
  }

  async function clearChatHistory() {
    try {
      await deleteRemoteRowsIfNeeded({ chat_messages: chat.map((message) => message.id) }, storageStatus);
      setState((current) => ({ ...current, chat: [] }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? `Chat history was not cleared: ${error.message}` : 'Chat history was not cleared because Supabase failed.');
    }
  }

  return (
    <div className="mx-auto grid min-h-[620px] max-w-7xl gap-5 sm:h-[calc(100vh-12rem)] sm:min-h-[480px] xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm">
        <div className="shrink-0 border-b border-ink/8 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionHeader eyebrow="Research chat" title="Ask with sources" copy="Answers are grounded in uploaded source chunks. Citations appear with each response when evidence is retrieved." />
            {chat.length ? (
              <IconTextButton
                icon={Trash2}
                label="Clear chat"
                danger
                onClick={() =>
                  setConfirmAction({
                    title: 'Clear chat history?',
                    body: 'This deletes all chat messages in the current Research OS history. Documents, Tutor sessions, and performance records are kept.',
                    confirmLabel: 'Clear chat',
                    onConfirm: clearChatHistory,
                  })
                }
              />
            ) : null}
          </div>
        </div>
        <div className="scrollbar-soft min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {chat.length ? (
            chat.map((message) => (
              <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[70ch]' : 'mr-auto max-w-[78ch]'}>
                <div className={`rounded-2xl p-5 ${message.role === 'user' ? 'bg-ink text-white' : 'border border-ink/8 bg-paper/70 text-ink'}`}>
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
                  className="mt-2 text-xs font-semibold text-graphite/60 hover:text-red-700"
                >
                  Delete message
                </button>
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
              title="Upload a source before chatting"
              copy="Chat uses extracted document chunks for grounded answers. Add a readable TXT, PDF, or DOCX file, then ask about claims, methods, contradictions, or gaps."
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
              disabled={isLoading || searchableDocuments.length === 0}
              placeholder={searchableDocuments.length ? 'Ask about claims, contradictions, methods, or gaps...' : 'Upload a readable source before asking...'}
              className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 transition focus:ring-4 disabled:cursor-not-allowed disabled:bg-paper"
            />
            <button
              type="button"
              aria-label="Send research question"
              title="Send research question"
              onClick={sendMessage}
              disabled={isLoading || searchableDocuments.length === 0}
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
    <div className="mx-auto max-w-6xl">
      <SectionHeader
        eyebrow="Study tools"
        title="Turn sources into learning assets"
        copy="Choose a study format and review the uploaded source context that would support it."
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
            {sourceDocuments.length
              ? `${sourceDocuments.length} readable source${sourceDocuments.length === 1 ? '' : 's'} are available for ${activeTool.toLowerCase()} work. Use Chat or Tutor for generated help from these sources.`
              : 'Upload readable documents before using study workflows. Summaries, flashcards, essay plans, quizzes, and timelines should be based on real workspace sources.'}
          </p>
          <div className="mt-7 space-y-3">
            {sourceDocuments.length ? (
              sourceDocuments.slice(0, 4).map((document) => (
                <div key={document.id} className="rounded-xl border border-ink/8 bg-paper/65 p-4">
                  <p className="font-semibold text-ink">{document.title}</p>
                  <p className="mt-2 line-clamp-2 text-sm leading-7 text-graphite/72">{document.summary}</p>
                </div>
              ))
            ) : (
              <EmptyState title="No readable source set" copy="Upload a document with extracted text before preparing study material." />
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
        <div className="relative min-h-[460px] overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm sm:min-h-[560px]">
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
              className={`absolute z-20 grid place-items-center overflow-hidden rounded-full border px-3 text-center text-xs font-semibold leading-tight shadow-sm transition hover:scale-[1.02] sm:px-4 sm:text-sm ${toneClasses[node.tone]} ${
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
              <span className="max-w-full break-words">{node.label}</span>
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
