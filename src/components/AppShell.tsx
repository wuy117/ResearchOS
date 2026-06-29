import { BookOpen, BrainCircuit, Files, LayoutDashboard, Map, MessageSquareText, Search, UploadCloud } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import type { PageId, ResearchState } from '../types/research';

const navItems: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'library', label: 'Library', icon: Files },
  { id: 'upload', label: 'Upload', icon: UploadCloud },
  { id: 'chat', label: 'AI Chat', icon: MessageSquareText },
  { id: 'study', label: 'Study Tools', icon: BrainCircuit },
  { id: 'map', label: 'Knowledge Map', icon: Map },
];

type AppShellProps = {
  state: ResearchState;
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  setState: Dispatch<SetStateAction<ResearchState>>;
  children: React.ReactNode;
};

export function AppShell({ state, activePage, setActivePage, setState, children }: AppShellProps) {
  const activeWorkspace = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
  const getWorkspaceDocumentCount = (workspaceId: string) => state.documents.filter((document) => document.workspaceId === workspaceId).length;

  return (
    <div className="min-h-screen p-0 text-ink sm:p-4 lg:p-6">
      <div className="mx-auto flex min-h-screen max-w-[1480px] overflow-hidden border border-ink/8 bg-ivory shadow-soft sm:min-h-[calc(100vh-2rem)] sm:rounded-[24px] lg:min-h-[calc(100vh-3rem)]">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-ink/8 bg-white/70 p-5 lg:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-ink/8 bg-paper text-ink">
              <BookOpen size={21} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Research OS</p>
              <p className="text-xs text-graphite/65">Personal knowledge desk</p>
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-ink/8 bg-paper/70 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm text-graphite/70">
              <Search size={16} />
              <span>Search papers, notes, insights</span>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePage(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    active ? 'bg-paper text-ink shadow-sm ring-1 ring-ink/8' : 'text-graphite hover:bg-paper/70 hover:text-ink'
                  }`}
                >
                  <Icon size={17} className={active ? 'text-ink' : 'text-graphite/70'} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Workspaces</p>
            </div>
            <div className="space-y-2">
              {state.workspaces.map((workspace) => {
                const active = workspace.id === state.activeWorkspaceId;
                return (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => setState((current) => ({ ...current, activeWorkspaceId: workspace.id }))}
                    className={`w-full rounded-xl border p-3 text-left transition ${
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

          <div className="mt-auto rounded-2xl border border-ink/8 bg-paper/75 p-4">
            <p className="text-sm font-semibold text-ink">Desk focus</p>
            <p className="mt-2 text-sm leading-6 text-graphite/72">
              {activeWorkspace?.description ?? 'Choose a workspace to focus your desk.'}
            </p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-col gap-4 border-b border-ink/8 bg-white/55 px-4 py-4 sm:px-6 xl:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Active workspace</p>
                <h1 className="mt-1 font-serif text-3xl font-semibold text-ink sm:text-4xl">{activeWorkspace?.name}</h1>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('upload')}
                className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-graphite"
              >
                <UploadCloud size={18} />
                Add Source
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActivePage(item.id)}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                      activePage === item.id ? 'bg-paper text-ink ring-1 ring-ink/8' : 'bg-white/70 text-graphite'
                    }`}
                  >
                    <Icon size={15} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </header>

          <div className="scrollbar-soft min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
