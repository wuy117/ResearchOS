import { AlertTriangle, BarChart3, BookOpen, CalendarDays, Download, Files, GraduationCap, LayoutDashboard, LogOut, MessageSquareText, Plus, Settings, Trash2, UploadCloud, UserCircle, Wrench } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { initialState } from '../data/initialState';
import type { AppStorageStatus } from '../hooks/useResearchState';
import { isSupabaseEnabled } from '../lib/supabase';
import { clearLocalStateOnly, clearSupabaseScope, type SupabaseResetScope } from '../services/researchStore';
import type { DocumentMetadata, ExtractionSummary, PageId, ResearchDocument, ResearchState } from '../types/research';
import { analyseDocumentMetadata, embedChunks, type DocumentMetadataAnalysisResponse } from '../utils/api';
import { buildDocumentMetadata, deriveCollections, getDocumentMetadata } from '../utils/learningModel';
import { getResearchStateSummary, getResearchStorageStats } from '../utils/storage';

type PillarId = 'home' | 'sources' | 'learn' | 'progress';

const navItems: Array<{ id: PillarId; label: string; target: PageId; pages: PageId[]; icon: typeof LayoutDashboard }> = [
  { id: 'home', label: 'Home', target: 'dashboard', pages: ['dashboard', 'settings'], icon: LayoutDashboard },
  { id: 'sources', label: 'Sources', target: 'upload', pages: ['upload', 'library'], icon: Files },
  { id: 'learn', label: 'Learn', target: 'chat', pages: ['chat', 'tutor', 'study', 'map'], icon: GraduationCap },
  { id: 'progress', label: 'Progress', target: 'performance', pages: ['performance', 'timeline'], icon: BarChart3 },
];

const secondaryTabs: Record<PillarId, Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }>> = {
  home: [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ],
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
  user: User | null;
  onSignOut: () => Promise<void>;
  claimableLocalState: ResearchState | null;
  onImportClaimableLocalData: () => Promise<void>;
  onDismissClaimableLocalData: () => void;
  children: React.ReactNode;
};

export function AppShell({
  state,
  activePage,
  setActivePage,
  setState,
  storageStatus,
  user,
  onSignOut,
  claimableLocalState,
  onImportClaimableLocalData,
  onDismissClaimableLocalData,
  children,
}: AppShellProps) {
  const [workspaceName, setWorkspaceName] = useState('');
  const activeWorkspace = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
  const getWorkspaceDocumentCount = (workspaceId: string) => state.documents.filter((document) => document.workspaceId === workspaceId).length;
  const storageLabel = {
    loading: 'Checking storage',
    'missing-env': 'Local only',
    'auth-required': 'Sign in required',
    'client-created': 'Checking cloud sync',
    'connection-failed': 'Sync issue',
    connected: user?.email ? `Signed in as ${user.email}` : 'Cloud sync connected',
  }[storageStatus];
  const showDeveloperTools = import.meta.env.DEV || new URLSearchParams(window.location.search).get('dev') === '1';
  const activePillar = getActivePillar(activePage);
  const visibleTabs = getVisibleTabs(activePillar.id);
  const activeWorkspaceDocumentCount = activeWorkspace ? getWorkspaceDocumentCount(activeWorkspace.id) : 0;
  const showAddSource = activePage !== 'upload' && activePage !== 'settings' && !(activePage === 'dashboard' && activeWorkspaceDocumentCount === 0);

  function createWorkspace() {
    const name = workspaceName.trim();
    if (!name) return;

    const workspace = {
      id: `workspace-${Date.now()}`,
      name,
      description: `Learning space for ${name}. Uploads can still belong to multiple subjects, reports, and performance records.`,
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
    <div className="h-[100dvh] text-ink">
      <div className="flex h-full overflow-hidden bg-ivory">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-ink/[0.055] bg-[#faf9f6] px-5 py-6 lg:flex">
          <div className="mb-9 flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-paper text-ink">
              <BookOpen size={19} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Research OS</p>
              <p className="text-xs text-graphite/80">Learning workspace</p>
            </div>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activePillar.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePage(item.target)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium ${
                    active ? 'bg-paper text-ink' : 'text-graphite/80 hover:bg-paper/65 hover:text-ink'
                  }`}
                >
                  <Icon size={17} className={active ? 'text-ink' : 'text-graphite/80'} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-8 flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">Workspaces</p>
            </div>
            <div className="mb-3 flex gap-2">
              <input
                value={workspaceName}
                aria-label="New workspace name"
                onChange={(event) => setWorkspaceName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') createWorkspace();
                }}
                placeholder="New workspace"
                className="min-w-0 flex-1 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none ring-ink/10 focus:ring-4"
              />
              <button type="button" onClick={createWorkspace} aria-label="Create workspace" title="Create workspace" className="grid size-9 place-items-center rounded-lg bg-ink text-white hover:bg-graphite">
                <Plus size={16} />
              </button>
            </div>
            <div className="scrollbar-soft min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {state.workspaces.map((workspace) => {
                const active = workspace.id === state.activeWorkspaceId;
                return (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => setState((current) => ({ ...current, activeWorkspaceId: workspace.id }))}
                    aria-pressed={active}
                    className={`w-full rounded-lg p-3 text-left transition ${
                      active ? 'bg-paper/90' : 'hover:bg-paper/55'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 size-2 rounded-full ${workspace.color}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{workspace.name}</span>
                        <span className="mt-1 block text-xs leading-5 text-graphite/80">{getWorkspaceDocumentCount(workspace.id)} documents</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 flex-col gap-3 border-b border-ink/[0.055] bg-[#faf9f6]/95 px-4 py-3 backdrop-blur-sm sm:px-6 xl:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">{activePillar.label}</p>
                <h1 className="mt-1 truncate text-base font-semibold text-ink sm:text-lg">{activeWorkspace?.name}</h1>
              </div>
              {showAddSource ? (
                <button
                  type="button"
                  onClick={() => setActivePage('upload')}
                  className="inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-ink/10 bg-white px-3.5 py-2 text-sm font-semibold text-graphite shadow-sm hover:border-ink/20 hover:text-ink"
                >
                  <UploadCloud size={17} />
                  Add source
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-4 gap-1 lg:hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActivePage(item.target)}
                    aria-current={activePillar.id === item.id ? 'page' : undefined}
                    className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-semibold ${
                      activePillar.id === item.id ? 'bg-paper text-ink ring-1 ring-ink/10' : 'text-graphite/80 hover:bg-paper/55 hover:text-ink'
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
                      aria-current={active ? 'page' : undefined}
                      className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                        active ? 'bg-paper text-ink ring-1 ring-ink/10' : 'bg-transparent text-graphite/80 hover:bg-paper/65 hover:text-ink'
                      }`}
                    >
                      <Icon size={15} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </header>

          <div className="scrollbar-soft min-h-0 flex-1 overflow-auto px-4 py-7 sm:px-6 sm:py-8 xl:px-10 2xl:px-12">
            <div key={activePage} className={`page-enter ${activePage === 'chat' ? 'h-full' : ''}`}>
              {activePage === 'settings' ? (
                <SettingsPage
                  state={state}
                  setState={setState}
                  storageStatus={storageStatus}
                  storageLabel={storageLabel}
                  user={user}
                  onSignOut={onSignOut}
                  claimableLocalState={claimableLocalState}
                  onImportClaimableLocalData={onImportClaimableLocalData}
                  onDismissClaimableLocalData={onDismissClaimableLocalData}
                  showDeveloperTools={showDeveloperTools}
                />
              ) : (
                children
              )}
            </div>
          </div>
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

function SettingsPage({
  state,
  setState,
  storageStatus,
  storageLabel,
  user,
  onSignOut,
  claimableLocalState,
  onImportClaimableLocalData,
  onDismissClaimableLocalData,
  showDeveloperTools,
}: {
  state: ResearchState;
  setState: Dispatch<SetStateAction<ResearchState>>;
  storageStatus: AppStorageStatus;
  storageLabel: string;
  user: User | null;
  onSignOut: () => Promise<void>;
  claimableLocalState: ResearchState | null;
  onImportClaimableLocalData: () => Promise<void>;
  onDismissClaimableLocalData: () => void;
  showDeveloperTools: boolean;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section>
        <h2 className="font-serif text-4xl font-semibold leading-tight text-ink">Account and data</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-graphite/80">Manage your account, saved work, and workspace data.</p>
      </section>

      <div className={`grid gap-6 ${storageStatus !== 'missing-env' ? 'lg:grid-cols-[1fr_1fr]' : ''}`}>
        <AccountDataControls
          state={state}
          storageStatus={storageStatus}
          user={user}
          onSignOut={onSignOut}
          claimableLocalState={claimableLocalState}
          onImportClaimableLocalData={onImportClaimableLocalData}
          onDismissClaimableLocalData={onDismissClaimableLocalData}
        />
        {storageStatus !== 'missing-env' ? <section className="surface-raised p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">Storage</p>
          <h3 className="mt-2 text-lg font-semibold text-ink">{storageLabel}</h3>
          <p className="mt-3 text-sm leading-7 text-graphite/80">
            {storageStatus === 'connected'
              ? 'Your work is syncing to your account.'
              : storageStatus === 'connection-failed'
                ? 'Research OS is keeping your work locally until sync is available.'
                : 'Your work is saved in this browser.'}
          </p>
        </section> : null}
      </div>

      <details className="surface-raised p-5">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Advanced</summary>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <ResetResearchOS state={state} setState={setState} storageStatus={storageStatus} user={user} />
          {showDeveloperTools ? <DeveloperTools state={state} setState={setState} storageStatus={storageStatus} storageLabel={storageLabel} user={user} /> : null}
        </div>
      </details>
    </div>
  );
}

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
    body: 'This removes Research OS data saved in this browser. It does not delete synced cloud data. The current screen stays visible until you refresh or continue working.',
    confirmLabel: 'Clear local state',
  },
  {
    scope: 'supabase',
    label: 'Clear all cloud data',
    body: 'This deletes synced Research OS data for this account, including workspaces, documents, chat, Tutor data, Progress data, and collections. Data saved only in this browser is kept.',
    confirmLabel: 'Clear cloud data',
  },
  {
    scope: 'chat',
    label: 'Clear chat history',
    body: 'This deletes saved chat messages in this browser and from cloud sync when connected. Documents, Tutor, and Progress are kept.',
    confirmLabel: 'Clear chat',
  },
  {
    scope: 'tutor',
    label: 'Clear Tutor memory',
    body: 'This deletes Tutor lessons, attempts, Socratic turns, exam sessions, topic confidence, and revision streak here and from cloud sync when connected.',
    confirmLabel: 'Clear Tutor',
  },
  {
    scope: 'performance',
    label: 'Clear Performance data',
    body: 'This deletes performance records and coaching summaries here and from cloud sync when connected. Documents are kept.',
    confirmLabel: 'Clear Performance',
  },
  {
    scope: 'documents',
    label: 'Clear documents',
    body: 'This deletes uploaded documents and related source records here and from cloud sync when connected. Performance records are kept but unlinked from sources.',
    confirmLabel: 'Clear documents',
  },
  {
    scope: 'full',
    label: 'Full reset: everything',
    body: 'This deletes all Research OS data in this browser and, when cloud sync is connected, all synced account data. The app returns to the clean first-launch state.',
    confirmLabel: 'Full reset',
  },
];

function AccountDataControls({
  state,
  storageStatus,
  user,
  onSignOut,
  claimableLocalState,
  onImportClaimableLocalData,
  onDismissClaimableLocalData,
}: {
  state: ResearchState;
  storageStatus: AppStorageStatus;
  user: User | null;
  onSignOut: () => Promise<void>;
  claimableLocalState: ResearchState | null;
  onImportClaimableLocalData: () => Promise<void>;
  onDismissClaimableLocalData: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const summary = claimableLocalState ? getResearchStateSummary(claimableLocalState) : null;
  const hasCloud = storageStatus === 'connected' && Boolean(user);

  function exportData() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), user: user?.email ?? null, state }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `research-os-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Export prepared as JSON.');
  }

  async function importLocalData() {
    setIsImporting(true);
    try {
      await onImportClaimableLocalData();
      setMessage('Local browser data was copied into this account. Original local data was not deleted.');
    } catch {
      setMessage('Local data could not be imported. Check your connection and try again.');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="surface-raised p-4">
      <button type="button" onClick={() => setIsOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">Account</span>
          <span className="mt-1 block truncate text-sm font-semibold text-ink">{user?.email ?? 'Saved in this browser'}</span>
        </span>
        <UserCircle size={17} className="text-graphite/80" />
      </button>
      {isOpen ? (
        <div className="mt-4 space-y-3">
          {message ? <p className="rounded-lg bg-paper px-3 py-2 text-xs leading-5 text-graphite/80">{message}</p> : null}
          {summary ? (
            <div className="rounded-lg border border-brass/25 bg-brass/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">Local data found</p>
              <p className="mt-2 text-xs leading-5 text-graphite/80">
                {summary.documents} documents, {summary.performanceRecords} progress records, {summary.tutorSessions} Tutor sessions, {summary.collections} source labels.
              </p>
              <div className="mt-3 grid gap-2">
                <button type="button" disabled={!hasCloud || isImporting} onClick={importLocalData} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-graphite disabled:bg-graphite/45">
                  {isImporting ? 'Importing...' : 'Import local data to my account'}
                </button>
                <button type="button" onClick={onDismissClaimableLocalData} className="rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink">
                  Keep local data only for now
                </button>
              </div>
            </div>
          ) : null}
          <button type="button" onClick={exportData} className="inline-flex w-full items-center gap-2 rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink">
            <Download size={14} />
            Export my data as JSON
          </button>
          {user ? (
            <button type="button" onClick={onSignOut} className="inline-flex w-full items-center gap-2 rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink">
              <LogOut size={14} />
              Sign out
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ResetResearchOS({
  state,
  setState,
  storageStatus,
  user,
  compact = false,
}: {
  state: ResearchState;
  setState: Dispatch<SetStateAction<ResearchState>>;
  storageStatus: AppStorageStatus;
  user: User | null;
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
        setMessage('Cloud sync is not connected, so no cloud data was cleared.');
        return;
      }
      await clearSupabaseScope('supabase', { userId: user?.id });
      setMessage('All cloud app data was cleared. Local browser data was kept.');
      return;
    }

    if (hasSupabase) {
      await clearSupabaseScope(scope, { userId: user?.id });
    }

    if (scope === 'full') {
      clearLocalStateOnly();
      setState(initialState);
      setMessage(hasSupabase ? 'Full reset completed. Local browser state and cloud data were cleared.' : 'Full local reset completed. Cloud sync was not connected.');
      return;
    }

    setState((current) => applyScopedStateClear(current, scope));
    setMessage(`${getResetLabel(scope)} cleared${hasSupabase ? ' locally and in the cloud.' : ' locally. Cloud sync was not connected.'}`);
  }

  return (
    <div className={`rounded-lg bg-paper/60 ${compact ? 'p-4' : 'p-3'}`}>
      <button type="button" onClick={() => setIsOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">Maintenance</span>
          <span className="mt-1 block text-sm font-semibold text-ink">Reset or clear data</span>
        </span>
        <AlertTriangle size={17} className="text-graphite/80" />
      </button>
      {isOpen ? (
        <div className="mt-4 space-y-3">
          {message ? <p className="rounded-lg bg-white px-3 py-2 text-xs leading-5 text-graphite/80">{message}</p> : null}
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
                        ? 'border-red-700 bg-red-700 text-white disabled:border-ink/10 disabled:bg-paper disabled:text-graphite/45'
                        : 'border-red-200 bg-white text-red-700 disabled:cursor-not-allowed disabled:border-ink/10 disabled:bg-paper disabled:text-graphite/45'
                    }`}
                  >
                    <Trash2 size={14} />
                    {option.label}
                  </button>
                  {disabled ? <p className="mt-1 text-xs leading-5 text-graphite/80">Cloud sync is not connected.</p> : null}
                </div>
              );
            })}
          </div>
          <p className="text-xs leading-5 text-graphite/80">Each option keeps unrelated sources, learning history, and progress data.</p>
        </div>
      ) : null}
      <DeveloperConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
    </div>
  );
}

function getResetLabel(scope: SupabaseResetScope) {
  return resetOptions.find((option) => option.scope === scope)?.label ?? 'Data';
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function applyDeveloperMetadataAnalysis(document: ResearchDocument, performanceRecords: ResearchState['performanceRecords'], analysis: DocumentMetadataAnalysisResponse): ResearchDocument {
  const fallback = getDocumentMetadata(document, performanceRecords);
  const metadata: DocumentMetadata = {
    ...fallback,
    sourceDate: analysis.metadata.sourceDate || fallback.sourceDate,
    academicYear: analysis.metadata.academicYear || fallback.academicYear,
    term: analysis.metadata.term || fallback.term,
    linkedAssessmentName: analysis.metadata.linkedAssessmentName || fallback.linkedAssessmentName || document.title,
    documentCategory: analysis.metadata.documentCategory || fallback.documentCategory,
    ignoreInstrumentalMusic: analysis.metadata.ignoreInstrumentalMusic || fallback.ignoreInstrumentalMusic,
    subjects: uniqueStrings([...(analysis.metadata.subjects ?? []), ...fallback.subjects]),
    topics: uniqueStrings([...(analysis.metadata.topics ?? []), ...fallback.topics]),
    teacherNames: uniqueStrings([...(analysis.metadata.teacherNames ?? []), ...fallback.teacherNames]),
    skills: uniqueStrings([...(analysis.metadata.skills ?? []), ...fallback.skills]),
    tags: uniqueStrings([...(analysis.metadata.tags ?? []), ...fallback.tags]),
    academicYears: uniqueStrings([analysis.metadata.academicYear, ...fallback.academicYears]),
    terms: uniqueStrings([analysis.metadata.term, ...fallback.terms]),
    assessments: uniqueStrings([analysis.metadata.linkedAssessmentName, ...fallback.assessments]),
    documentTypes: uniqueStrings([analysis.metadata.documentCategory, ...fallback.documentTypes]),
    performanceRecords: fallback.performanceRecords,
    collections: fallback.collections,
    metadataConfidence: analysis.metadata.metadataConfidence ?? fallback.metadataConfidence ?? 'Low',
    metadataSource: analysis.metadata.metadataSource ?? 'AI generated',
    shouldAffectAcademicPerformance: analysis.metadata.shouldAffectAcademicPerformance ?? fallback.shouldAffectAcademicPerformance,
    extractedFacts: uniqueStrings([...(analysis.metadata.extractedFacts ?? []), ...(fallback.extractedFacts ?? [])]),
    inferredMetadata: uniqueStrings([...(analysis.metadata.inferredMetadata ?? []), ...(fallback.inferredMetadata ?? [])]),
  };
  const collections = uniqueStrings([
    ...metadata.collections,
    metadata.documentCategory,
    metadata.term,
    metadata.academicYear,
    metadata.linkedAssessmentName,
    ...metadata.subjects,
  ]).slice(0, 12);

  return {
    ...document,
    summary: buildDeveloperSummary(document, analysis),
    tags: metadata.tags,
    metadata: {
      ...metadata,
      collections,
    },
    extractionSummary: buildDeveloperExtractionSummary(document, metadata, performanceRecords, analysis),
    collectionIds: collections.map((collection) => `collection-${collection.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`),
  };
}

function buildDeveloperExtractionSummary(document: ResearchDocument, metadata: DocumentMetadata, performanceRecords: ResearchState['performanceRecords'], analysis: DocumentMetadataAnalysisResponse): ExtractionSummary {
  const linkedRecords = performanceRecords.filter((record) => record.sourceDocumentId === document.id);
  const candidateRecords = analysis.performanceRecords.length ? analysis.performanceRecords : linkedRecords;
  const subjectsFound = uniqueStrings([...metadata.subjects, ...candidateRecords.map((record) => record.subject)]);
  const teacherComments = candidateRecords.filter((record) => record.teacherComment).length;
  const marksExtracted = candidateRecords.filter((record) => record.marksExtracted || typeof record.percentage === 'number' || record.grade || record.attainment || record.predictedGrade || record.targetGrade).length;
  const uncertainFields = analysis.extractionDiagnostics?.uncertainFields ?? candidateRecords.reduce((total, record) => total + Object.values(record.fieldConfidence ?? {}).filter((confidence) => confidence === 'Low').length + (record.needsReviewReason ? 1 : 0), 0);
  const extractionWarnings = uniqueStrings([...(analysis.extractionWarnings ?? []), ...(analysis.extractionDiagnostics?.warnings ?? [])]);
  const missingLikelySubjects = uniqueStrings(analysis.missingLikelySubjects ?? []);

  return {
    confidence: analysis.confidence ?? analysis.metadata.metadataConfidence ?? metadata.metadataConfidence ?? 'Medium',
    status: uncertainFields || extractionWarnings.length || missingLikelySubjects.length ? 'Partially understood' : 'Document understood',
    subjectsFound: subjectsFound.length,
    teacherComments,
    marksExtracted,
    gradesExtracted: candidateRecords.filter((record) => record.grade || record.attainment || record.predictedGrade).length,
    targetsFound: candidateRecords.filter((record) => record.targetGrade).length,
    teachersIdentified: uniqueStrings([...metadata.teacherNames, ...candidateRecords.map((record) => record.teacher)]).length,
    needsReview: candidateRecords.filter((record) => record.needsReviewReason || Object.values(record.fieldConfidence ?? {}).includes('Low')).length,
    confirmedAutomatically: candidateRecords.filter((record) => !record.needsReviewReason && !Object.values(record.fieldConfidence ?? {}).includes('Low')).length,
    reviewSuggested: candidateRecords.filter((record) => record.extractionConfidence === 'Medium').length,
    waitingForConfirmation: candidateRecords.filter((record) => record.needsReviewReason || Object.values(record.fieldConfidence ?? {}).includes('Low')).length,
    reviewNotes: [
      `Re-run extraction found ${subjectsFound.length} subject${subjectsFound.length === 1 ? '' : 's'}.`,
      extractionWarnings.length ? `${extractionWarnings.length} warning${extractionWarnings.length === 1 ? '' : 's'} recorded.` : '',
      missingLikelySubjects.length ? `${missingLikelySubjects.length} likely subject${missingLikelySubjects.length === 1 ? '' : 's'} may be missing.` : '',
    ].filter(Boolean),
    diagnostics: analysis.extractionDiagnostics ?? {
      detectedSubjectSections: subjectsFound.length,
      subjectsWithMarks: marksExtracted,
      subjectsWithComments: teacherComments,
      uncertainFields,
      warnings: extractionWarnings,
    },
    extractionWarnings,
    missingLikelySubjects,
  };
}

function buildDeveloperSummary(document: ResearchDocument, analysis: DocumentMetadataAnalysisResponse) {
  if (analysis.summary.summaryText) {
    return [
      analysis.summary.summaryText,
      analysis.summary.keyEvidence?.length ? `Key evidence: ${analysis.summary.keyEvidence.slice(0, 3).join('; ')}.` : '',
      analysis.summary.suggestedUse ? `Use it for: ${analysis.summary.suggestedUse}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return `${document.title} was analysed for subjects, topics, teacher evidence, and performance context.`;
}

function DeveloperTools({
  state,
  setState,
  storageStatus,
  storageLabel,
  user,
}: {
  state: ResearchState;
  setState: Dispatch<SetStateAction<ResearchState>>;
  storageStatus: AppStorageStatus;
  storageLabel: string;
  user: User | null;
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

  async function rerunMetadataExtraction(documentIds: string[], label: string) {
    const readableDocuments = state.documents.filter((document) => documentIds.includes(document.id) && document.extractedText?.trim());
    if (!readableDocuments.length) {
      setMessage('No readable documents were available for extraction.');
      return;
    }

    let analysed = 0;
    let failed = 0;
    const updates = new Map<string, ResearchDocument>();

    for (const document of readableDocuments) {
      try {
        const analysis = await analyseDocumentMetadata({
          title: document.title,
          text: document.extractedText ?? '',
          uploadMetadata: getDocumentMetadata(document, state.performanceRecords),
        });
        if (import.meta.env.DEV && (analysis.extractionWarnings?.length || analysis.extractionDiagnostics?.warnings.length)) {
          console.debug(`Extraction warnings for ${document.title}.`, analysis.extractionWarnings ?? analysis.extractionDiagnostics?.warnings);
        }
        updates.set(document.id, applyDeveloperMetadataAnalysis(document, state.performanceRecords, analysis));
        analysed += 1;
      } catch (error) {
        failed += 1;
        if (import.meta.env.DEV) {
          console.debug(`Document extraction failed for ${document.title}.`, error);
        }
      }
    }

    if (updates.size) {
      setState((current) => {
        const documents = current.documents.map((document) => updates.get(document.id) ?? document);
        const nextState = { ...current, documents };
        return { ...nextState, collections: deriveCollections(nextState) };
      });
    }

    setMessage(`${label}: analysed ${analysed}, failed ${failed}. Existing records were preserved.`);
    setLastError(failed ? `${failed} document${failed === 1 ? '' : 's'} could not be analysed.` : '');
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4">
      <button type="button" onClick={() => setIsOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">Developer Tools</span>
          <span className="mt-1 block text-sm font-semibold text-ink">Diagnostics and resets</span>
        </span>
        <Wrench size={17} className="text-graphite/80" />
      </button>
      {isOpen ? (
        <div className="mt-4 space-y-4">
          {message ? <p className="rounded-lg bg-paper px-3 py-2 text-xs leading-5 text-graphite/80">{message}</p> : null}
          <DeveloperStatGrid
            items={[
              ['Version', import.meta.env.VITE_APP_VERSION ?? '0.1.0'],
              ['Environment', import.meta.env.DEV ? 'development' : 'production'],
              ['Storage mode', storageLabel],
              ['Supabase', isSupabaseEnabled ? 'enabled' : 'disabled'],
              ['Signed-in email', user?.email ?? 'none'],
              ['User id', user?.id ?? 'none'],
              ['RLS path', storageStatus === 'connected' && user ? 'user-scoped' : 'not ready'],
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
              label="Re-run extraction for all documents"
              disabled={!state.documents.some((document) => document.extractedText?.trim())}
              reason={!state.documents.some((document) => document.extractedText?.trim()) ? 'No readable documents to analyse.' : undefined}
              onClick={() => rerunMetadataExtraction(state.documents.map((document) => document.id), 'All document extraction')}
            />
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
              label="Re-run extraction for one document"
              disabled={!documentId || !state.documents.find((document) => document.id === documentId)?.extractedText?.trim()}
              reason={!documentId ? 'Choose a document first.' : !state.documents.find((document) => document.id === documentId)?.extractedText?.trim() ? 'Selected document has no readable text.' : undefined}
              onClick={() => rerunMetadataExtraction([documentId], 'Document extraction')}
            />
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
          <span className="text-graphite/80">{label}</span>
          <span className="max-w-[130px] truncate font-semibold text-ink">{value}</span>
        </div>
      ))}
    </div>
  );
}

function DeveloperSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink/10 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">{title}</p>
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
      {disabled && reason ? <p className="mt-1 text-xs leading-5 text-graphite/80">{reason}</p> : null}
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
      <div role="dialog" aria-modal="true" aria-labelledby="developer-dialog-title" aria-describedby="developer-dialog-body" className="w-full max-w-lg rounded-xl border border-ink/10 bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Developer confirmation</p>
        <h2 id="developer-dialog-title" className="mt-3 text-xl font-semibold text-ink">{action.title}</h2>
        <p id="developer-dialog-body" className="mt-3 text-sm leading-7 text-graphite/80">{action.body}</p>
        <div className="mt-6 grid gap-2 sm:flex sm:justify-end">
          <button type="button" onClick={onClose} disabled={isWorking} className="min-h-10 rounded-lg border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-paper/50">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={isWorking} className="min-h-10 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:bg-red-400">
            {isWorking ? 'Working…' : action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
