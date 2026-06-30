import { AlertTriangle, BarChart3, BookOpen, CalendarDays, Files, GraduationCap, LayoutDashboard, MessageSquareText, Plus, Search, Trash2, UploadCloud, Wrench } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { initialState } from '../data/initialState';
import type { AppStorageStatus } from '../hooks/useResearchState';
import { isSupabaseEnabled } from '../lib/supabase';
import { clearLocalStateOnly, clearSupabaseScope, type SupabaseResetScope } from '../services/researchStore';
import type { PageId, ResearchState } from '../types/research';
import { embedChunks } from '../utils/api';
import { buildDocumentMetadata, deriveCollections } from '../utils/learningModel';
import { getResearchStorageStats } from '../utils/storage';

type PillarId = 'home' | 'sources' | 'learn' | 'progress';

const navItems: Array<{ id: PillarId; label: string; target: PageId; pages: PageId[]; icon: typeof LayoutDashboard }> = [
  { id: 'home', label: 'Home', target: 'dashboard', pages: ['dashboard'], icon: LayoutDashboard },
  { id: 'sources', label: 'Sources', target: 'upload', pages: ['upload', 'library'], icon: Files },
  { id: 'learn', label: 'Learn', target: 'chat', pages: ['chat', 'tutor', 'study', 'map'], icon: GraduationCap },
  { id: 'progress', label: 'Progress', target: 'performance', pages: ['performance', 'timeline'], icon: BarChart3 },
];

const secondaryTabs: Record<PillarId, Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }>> = {
  home: [{ id: 'dashboard', label: 'Overview', icon: LayoutDashboard }],
  sources: [
    { id: 'upload', label: 'Upload', icon: UploadCloud },
    { id: 'library', label: 'Library', icon: Files },
  ],
  learn: [
    { id: 'chat', label: 'Chat', icon: MessageSquareText },
    { id: 'tutor', label: 'Tutor', icon: GraduationCap },
  ],
  progress: [
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'timeline', label: 'Timeline', icon: CalendarDays },
  ],
};

const sectionDescriptions: Record<PillarId, string> = {
  home: 'Academic profile, recent activity, next best action, recent sources, and progress snapshot.',
  sources: 'Upload, library, collections, metadata editing, and source management.',
  learn: 'Chat and Tutor in one source-aware learning workspace.',
  progress: 'Performance, timeline, trends, and teacher comments.',
};

function getActivePillar(activePage: PageId) {
  return navItems.find((item) => item.pages.includes(activePage)) ?? navItems[0];
}

function getVisibleTabs(pillar: PillarId) {
  return secondaryTabs[pillar];
}

type AppShellProps = {
  state: ResearchState;
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  setState: Dispatch<SetStateAction<ResearchState>>;
  storageStatus: AppStorageStatus;
  children: React.ReactNode;
};

export function AppShell({ state, activePage, setActivePage, setState, storageStatus, children }: AppShellProps) {
  const [workspaceName, setWorkspaceName] = useState('');
  const activeWorkspace = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
  const getWorkspaceDocumentCount = (workspaceId: string) => state.documents.filter((document) => document.workspaceId === workspaceId).length;
  const storageLabel = {
    loading: 'Checking storage',
    'missing-env': 'Local storage',
    'client-created': 'Checking Supabase',
    'connection-failed': 'Local fallback active',
    connected: 'Supabase connected',
  }[storageStatus];
  const storageDescription = {
    loading: 'Loading saved workspace data.',
    'missing-env': 'Saved in this browser. Add Supabase env vars to sync remotely.',
    'client-created': 'Remote storage is configured; checking the connection.',
    'connection-failed': 'Saved locally for now. Remote sync will resume when Supabase is reachable.',
    connected: 'Remote sync is active, with localStorage as a fallback.',
  }[storageStatus];
  const storageDotClass = {
    loading: 'bg-brass',
    'missing-env': 'bg-graphite/45',
    'client-created': 'bg-brass',
    'connection-failed': 'bg-red-500',
    connected: 'bg-moss',
  }[storageStatus];
  const showDeveloperTools = import.meta.env.DEV || new URLSearchParams(window.location.search).get('dev') === '1';
  const activePillar = getActivePillar(activePage);
  const visibleTabs = getVisibleTabs(activePillar.id);

  function createWorkspace() {
    const name = workspaceName.trim();
    if (!name) return;

    const workspace = {
      id: `workspace-${Date.now()}`,
      name,
      description: `Learning space for ${name}. Uploads can still belong to multiple subjects, collections, and performance records.`,
      documentCount: 0,
      color: ['bg-moss', 'bg-brass', 'bg-graphite'][state.workspaces.length % 3],
    };

    setState((current) => ({
      ...current,
      workspaces: [...current.workspaces, workspace],
      activeWorkspaceId: workspace.id,
    }));
    setWorkspaceName('');
  }

  return (
    <div className="min-h-screen text-ink">
      <div className="flex min-h-screen overflow-hidden bg-ivory">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-ink/8 bg-white/85 p-5 lg:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-ink/8 bg-paper text-ink">
              <BookOpen size={21} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Research OS</p>
              <p className="text-xs text-graphite/65">Personal knowledge desk</p>
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-ink/8 bg-paper/70 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm text-graphite/70">
              <Search size={16} />
              <span>One upload updates the whole system</span>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activePillar.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePage(item.target)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                    active ? 'bg-paper text-ink shadow-sm ring-1 ring-ink/8' : 'text-graphite hover:bg-paper/70 hover:text-ink'
                  }`}
                >
                  <Icon size={17} className={active ? 'text-ink' : 'text-graphite/70'} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-5">
            <ResetResearchOS state={state} setState={setState} storageStatus={storageStatus} compact />
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Workspaces</p>
            </div>
            <div className="mb-3 flex gap-2">
              <input
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') createWorkspace();
                }}
                placeholder="New workspace"
                className="min-w-0 flex-1 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4"
              />
              <button type="button" onClick={createWorkspace} aria-label="Create workspace" title="Create workspace" className="grid size-9 place-items-center rounded-lg bg-ink text-white">
                <Plus size={16} />
              </button>
            </div>
            <p className="mb-3 text-xs leading-5 text-graphite/65">Examples: Biology, History, French, Music, Programming, Personal Research.</p>
            <div className="space-y-2">
              {state.workspaces.map((workspace) => {
                const active = workspace.id === state.activeWorkspaceId;
                return (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => setState((current) => ({ ...current, activeWorkspaceId: workspace.id }))}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      active ? 'border-ink/12 bg-paper/85 shadow-sm' : 'border-transparent hover:border-ink/8 hover:bg-paper/55'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 size-2 rounded-full ${workspace.color}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{workspace.name}</span>
                        <span className="mt-1 block text-xs leading-5 text-graphite/70">{getWorkspaceDocumentCount(workspace.id)} documents</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto space-y-3">
            <div className="rounded-lg border border-ink/8 bg-paper/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Storage</p>
              <div className="mt-3 flex items-center gap-2">
                <span className={`size-2 rounded-full ${storageDotClass}`} />
                <p className="text-sm font-semibold text-ink">{storageLabel}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-graphite/68">{storageDescription}</p>
            </div>

            <div className="rounded-lg border border-ink/8 bg-paper/75 p-4">
              <p className="text-sm font-semibold text-ink">Desk focus</p>
              <p className="mt-2 text-sm leading-6 text-graphite/72">
                {activeWorkspace?.description ?? 'Choose a workspace to focus your desk.'}
              </p>
            </div>

            {showDeveloperTools ? (
              <DeveloperTools state={state} setState={setState} storageStatus={storageStatus} storageLabel={storageLabel} />
            ) : null}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-col gap-4 border-b border-ink/8 bg-white/70 px-4 py-4 sm:px-6 xl:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Active workspace</p>
                <h1 className="mt-1 font-serif text-3xl font-semibold text-ink sm:text-4xl">{activeWorkspace?.name}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/68">{sectionDescriptions[activePillar.id]}</p>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('upload')}
                className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-graphite"
              >
                <UploadCloud size={18} />
                Add Source
              </button>
            </div>
            <div className="rounded-lg border border-ink/8 bg-paper/65 px-3 py-2 text-xs leading-5 text-graphite/70 lg:hidden">
              <div className="flex items-center gap-2 font-semibold text-ink">
                <span className={`size-2 rounded-full ${storageDotClass}`} />
                {storageLabel}
              </div>
              <p className="mt-1">{storageDescription}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActivePage(item.target)}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                      activePillar.id === item.id ? 'bg-paper text-ink ring-1 ring-ink/8' : 'bg-white/70 text-graphite'
                    }`}
                  >
                    <Icon size={15} />
                    {item.label}
                  </button>
                );
              })}
            </div>
            {visibleTabs.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activePage === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActivePage(tab.id)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                        active ? 'bg-ink text-white shadow-sm' : 'border border-ink/8 bg-white text-graphite hover:text-ink'
                      }`}
                    >
                      <Icon size={15} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="lg:hidden">
              <ResetResearchOS state={state} setState={setState} storageStatus={storageStatus} />
            </div>
          </header>

          <div className="scrollbar-soft min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-10 2xl:px-12">{children}</div>
        </main>
      </div>
    </div>
  );
}

type DeveloperConfirmAction = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
};

type ResetOption = {
  scope: SupabaseResetScope;
  label: string;
  body: string;
  confirmLabel: string;
};

const resetOptions: ResetOption[] = [
  {
    scope: 'local',
    label: 'Clear local browser state',
    body: 'This removes Research OS data saved in this browser. It does not delete Supabase data. The current screen stays visible until you refresh or continue working.',
    confirmLabel: 'Clear local state',
  },
  {
    scope: 'supabase',
    label: 'Clear all Supabase app data',
    body: 'This deletes Research OS rows from Supabase, including workspaces, documents, chunks, embeddings, insights, chat, Tutor data, Performance data, collections, and legacy study artifacts. Local browser data is kept unless you run a full reset.',
    confirmLabel: 'Clear Supabase data',
  },
  {
    scope: 'chat',
    label: 'Clear chat history',
    body: 'This deletes saved chat messages locally and in Supabase when connected. Documents, Tutor, and Progress are kept.',
    confirmLabel: 'Clear chat',
  },
  {
    scope: 'tutor',
    label: 'Clear Tutor memory',
    body: 'This deletes Tutor lessons, attempts, Socratic turns, exam sessions, topic confidence, and revision streak locally and in Supabase when connected.',
    confirmLabel: 'Clear Tutor',
  },
  {
    scope: 'performance',
    label: 'Clear Performance data',
    body: 'This deletes Performance records and AI performance summaries locally and in Supabase when connected. Documents are kept.',
    confirmLabel: 'Clear Performance',
  },
  {
    scope: 'documents',
    label: 'Clear documents, chunks, and embeddings',
    body: 'This deletes uploaded documents, extracted chunks, insight rows, and embedding status locally and in Supabase when connected. Performance records are kept but unlinked from sources.',
    confirmLabel: 'Clear documents',
  },
  {
    scope: 'full',
    label: 'Full reset: everything',
    body: 'This deletes all Research OS local browser state and, when Supabase is connected, all app rows in Supabase: workspaces, documents, chunks, embeddings, insights, chat, Tutor, Performance, collections, and legacy study artifacts. The app returns to the clean first-launch state.',
    confirmLabel: 'Full reset',
  },
];

function ResetResearchOS({
  state,
  setState,
  storageStatus,
  compact = false,
}: {
  state: ResearchState;
  setState: Dispatch<SetStateAction<ResearchState>>;
  storageStatus: AppStorageStatus;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<DeveloperConfirmAction | null>(null);
  const hasSupabase = storageStatus === 'connected';

  async function runReset(scope: SupabaseResetScope) {
    if (scope === 'local') {
      clearLocalStateOnly();
      setMessage('Local browser state was cleared. Remote data was not deleted.');
      return;
    }

    if (scope === 'supabase') {
      if (!hasSupabase) {
        setMessage('Supabase is not connected, so no remote data was cleared.');
        return;
      }
      await clearSupabaseScope('supabase');
      setMessage('All Supabase app data was cleared. Local browser data was kept.');
      return;
    }

    if (hasSupabase) {
      await clearSupabaseScope(scope);
    }

    if (scope === 'full') {
      clearLocalStateOnly();
      setState(initialState);
      setMessage(hasSupabase ? 'Full reset completed. Local browser state and Supabase app data were cleared.' : 'Full local reset completed. Supabase was not connected.');
      return;
    }

    setState((current) => applyScopedStateClear(current, scope));
    setMessage(`${getResetLabel(scope)} cleared${hasSupabase ? ' locally and in Supabase.' : ' locally. Supabase was not connected.'}`);
  }

  return (
    <div className={`rounded-lg border border-red-200 bg-red-50/70 ${compact ? 'p-4' : 'p-3'}`}>
      <button type="button" onClick={() => setIsOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Reset Research OS</span>
          <span className="mt-1 block text-sm font-semibold text-ink">Clear local, remote, or scoped data</span>
        </span>
        <AlertTriangle size={17} className="text-red-700" />
      </button>
      {isOpen ? (
        <div className="mt-4 space-y-3">
          {message ? <p className="rounded-lg bg-white px-3 py-2 text-xs leading-5 text-graphite/75">{message}</p> : null}
          <div className="grid gap-2">
            {resetOptions.map((option) => {
              const disabled = option.scope === 'supabase' && !hasSupabase;
              return (
                <div key={option.scope}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      setConfirmAction({
                        title: option.label,
                        body: option.body,
                        confirmLabel: option.confirmLabel,
                        onConfirm: () => runReset(option.scope),
                      })
                    }
                    className={`inline-flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                      option.scope === 'full'
                        ? 'border-red-700 bg-red-700 text-white disabled:border-ink/8 disabled:bg-paper disabled:text-graphite/45'
                        : 'border-red-200 bg-white text-red-700 disabled:cursor-not-allowed disabled:border-ink/8 disabled:bg-paper disabled:text-graphite/45'
                    }`}
                  >
                    <Trash2 size={14} />
                    {option.label}
                  </button>
                  {disabled ? <p className="mt-1 text-xs leading-5 text-graphite/60">Supabase is not connected.</p> : null}
                </div>
              );
            })}
          </div>
          <p className="text-xs leading-5 text-graphite/65">Scoped clears preserve unrelated workflows such as Upload, semantic search fallback, Tutor, Progress, Timeline, and document editing.</p>
        </div>
      ) : null}
      <DeveloperConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
    </div>
  );
}

function getResetLabel(scope: SupabaseResetScope) {
  return resetOptions.find((option) => option.scope === scope)?.label ?? 'Data';
}

function DeveloperTools({
  state,
  setState,
  storageStatus,
  storageLabel,
}: {
  state: ResearchState;
  setState: Dispatch<SetStateAction<ResearchState>>;
  storageStatus: AppStorageStatus;
  storageLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [lastError, setLastError] = useState('');
  const [confirmAction, setConfirmAction] = useState<DeveloperConfirmAction | null>(null);
  const [documentId, setDocumentId] = useState(state.documents[0]?.id ?? '');
  const storageStats = getResearchStorageStats();
  const embeddedChunkCount = state.chunks.filter((chunk) => chunk.embeddingStatus === 'embedded').length;
  const tutorSessionCount = state.tutorLessons.length + state.tutorSocraticTurns.length + state.tutorExamSessions.length;
  const embeddingConfigured = isSupabaseEnabled && storageStatus === 'connected';

  function runLocalReset(label: string, updater: (current: ResearchState) => ResearchState) {
    setState((current) => updater(current));
    setMessage(`${label} completed locally.`);
  }

  async function rerunEmbeddings(chunkIds: string[], label: string) {
    if (!embeddingConfigured || chunkIds.length === 0) return;
    try {
      const result = await embedChunks({ chunkIds });
      setMessage(`${label}: embedded ${result.embedded}, failed ${result.failed}, skipped ${result.skipped}.`);
      setLastError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Embedding rebuild failed.';
      setLastError(message);
      setMessage(message);
    }
  }

  return (
    <div className="rounded-lg border border-ink/8 bg-white p-4">
      <button type="button" onClick={() => setIsOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Developer Tools</span>
          <span className="mt-1 block text-sm font-semibold text-ink">Diagnostics and resets</span>
        </span>
        <Wrench size={17} className="text-graphite/60" />
      </button>
      {isOpen ? (
        <div className="mt-4 space-y-4">
          {message ? <p className="rounded-lg bg-paper px-3 py-2 text-xs leading-5 text-graphite/75">{message}</p> : null}
          <DeveloperStatGrid
            items={[
              ['Version', import.meta.env.VITE_APP_VERSION ?? '0.1.0'],
              ['Environment', import.meta.env.DEV ? 'development' : 'production'],
              ['Storage mode', storageLabel],
              ['Supabase', isSupabaseEnabled ? 'enabled' : 'disabled'],
              ['Embedding', embeddingConfigured ? 'configured' : 'not ready'],
              ['localStorage keys', storageStats.keys.toLocaleString()],
              ['localStorage bytes', storageStats.bytes.toLocaleString()],
              ['Documents', state.documents.length.toLocaleString()],
              ['Chunks', state.chunks.length.toLocaleString()],
              ['Embedded chunks', embeddedChunkCount.toLocaleString()],
              ['Performance', state.performanceRecords.length.toLocaleString()],
              ['Tutor sessions', tutorSessionCount.toLocaleString()],
              ['Collections', state.collections.length.toLocaleString()],
              ['Last error', lastError || 'none'],
            ]}
          />

          <DeveloperSection title="Developer rebuild tools">
            <DeveloperActionButton label="Rebuild local derived metadata" onClick={() => runLocalReset('Metadata rebuild', rebuildMetadata)} />
            <DeveloperActionButton label="Rebuild collections from documents" onClick={() => runLocalReset('Collections rebuild', (current) => ({ ...current, collections: deriveCollections(current) }))} />
            <DeveloperActionButton
              label="Re-run embeddings for all chunks"
              disabled={!embeddingConfigured || state.chunks.length === 0}
              reason={!embeddingConfigured ? 'Semantic search is not connected.' : state.chunks.length === 0 ? 'No chunks to embed.' : undefined}
              onClick={() => rerunEmbeddings(state.chunks.map((chunk) => chunk.id), 'All chunk embeddings')}
            />
            <select value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs outline-none">
              <option value="">Choose document</option>
              {state.documents.map((document) => (
                <option key={document.id} value={document.id}>{document.title}</option>
              ))}
            </select>
            <DeveloperActionButton
              label="Re-run embeddings for one document"
              disabled={!embeddingConfigured || !documentId}
              reason={!embeddingConfigured ? 'Semantic search is not connected.' : !documentId ? 'Choose a document first.' : undefined}
              onClick={() => rerunEmbeddings(state.chunks.filter((chunk) => chunk.documentId === documentId).map((chunk) => chunk.id), 'Document embeddings')}
            />
          </DeveloperSection>
        </div>
      ) : null}
      <DeveloperConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
    </div>
  );
}

function applyScopedStateClear(state: ResearchState, scope: SupabaseResetScope): ResearchState {
  if (scope === 'local' || scope === 'supabase') {
    return state;
  }

  if (scope === 'chat') {
    return {
      ...state,
      chat: [],
    };
  }

  if (scope === 'documents') {
    return {
      ...state,
      documents: [],
      chunks: [],
      insights: [],
      collections: deriveCollections({ ...state, documents: [], chunks: [], insights: [] }),
      performanceRecords: state.performanceRecords.map((record) => ({ ...record, sourceDocumentId: undefined })),
    };
  }

  if (scope === 'performance') {
    return rebuildMetadata({
      ...state,
      performanceRecords: [],
      performanceSummaries: [],
    });
  }

  if (scope === 'tutor') {
    return {
      ...state,
      tutorLessons: [],
      tutorAttempts: [],
      tutorSocraticTurns: [],
      tutorExamSessions: [],
      tutorMemory: {
        lessonsCompleted: 0,
        topicsStudied: [],
        revisionStreak: 0,
      },
    };
  }

  if (scope === 'collections') {
    return {
      ...state,
      collections: [],
      documents: state.documents.map((document) => ({
        ...document,
        metadata: undefined,
        collectionIds: [],
      })),
    };
  }

  return initialState;
}

function rebuildMetadata(state: ResearchState): ResearchState {
  const documents = state.documents.map((document) => {
    const metadata = buildDocumentMetadata(document, state.performanceRecords);
    return {
      ...document,
      metadata,
      collectionIds: metadata.collections.map((collection) => `collection-${collection.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`),
    };
  });

  const nextState = {
    ...state,
    documents,
  };

  return {
    ...nextState,
    collections: deriveCollections(nextState),
  };
}

function DeveloperStatGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 rounded-lg bg-paper/65 px-3 py-2 text-xs">
          <span className="text-graphite/65">{label}</span>
          <span className="max-w-[130px] truncate font-semibold text-ink">{value}</span>
        </div>
      ))}
    </div>
  );
}

function DeveloperSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink/8 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">{title}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function DeveloperActionButton({ label, onClick, disabled = false, reason }: { label: string; onClick: () => void; disabled?: boolean; reason?: string }) {
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-left text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:bg-paper disabled:text-graphite/45"
      >
        {label}
      </button>
      {disabled && reason ? <p className="mt-1 text-xs leading-5 text-graphite/60">{reason}</p> : null}
    </div>
  );
}

function DeveloperConfirmModal({ action, onClose }: { action: DeveloperConfirmAction | null; onClose: () => void }) {
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
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Developer confirmation</p>
        <h2 className="mt-3 text-xl font-semibold text-ink">{action.title}</h2>
        <p className="mt-3 text-sm leading-7 text-graphite/75">{action.body}</p>
        <div className="mt-6 flex justify-end gap-3">
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
