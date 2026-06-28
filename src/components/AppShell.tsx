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

  return (
    <div className="min-h-screen p-3 text-ink sm:p-5 lg:p-7">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1500px] overflow-hidden rounded-[28px] border border-white/75 bg-ivory/78 shadow-soft backdrop-blur-xl">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-ink/10 bg-white/54 p-5 lg:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-ink text-white shadow-lg shadow-ink/15">
              <BookOpen size={21} />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-brass">Research OS</p>
              <p className="text-xs text-graphite/70">Personal knowledge desk</p>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-ink/10 bg-white/72 px-3 py-2.5">
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
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                    active ? 'bg-ink text-white shadow-lg shadow-ink/12' : 'text-graphite hover:bg-white hover:text-ink'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-graphite/60">Workspaces</p>
              <span className="rounded-full bg-ink/7 px-2 py-1 text-xs font-bold text-graphite">{state.workspaces.length}</span>
            </div>
            <div className="space-y-2">
              {state.workspaces.map((workspace) => {
                const active = workspace.id === state.activeWorkspaceId;
                return (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => setState((current) => ({ ...current, activeWorkspaceId: workspace.id }))}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      active ? 'border-ink/20 bg-white shadow-sm' : 'border-transparent hover:border-ink/10 hover:bg-white/70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 size-2.5 rounded-full ${workspace.color}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-ink">{workspace.name}</span>
                        <span className="mt-1 block text-xs leading-5 text-graphite/70">{workspace.documentCount} documents</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto rounded-3xl bg-ink p-4 text-white">
            <p className="font-serif text-2xl font-bold leading-tight">Desk focus</p>
            <p className="mt-2 text-sm leading-6 text-white/72">
              {activeWorkspace?.description ?? 'Choose a workspace to focus your desk.'}
            </p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-col gap-4 border-b border-ink/10 bg-white/35 px-4 py-4 sm:px-6 xl:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brass">Active workspace</p>
                <h1 className="mt-1 font-serif text-3xl font-bold text-ink sm:text-4xl">{activeWorkspace?.name}</h1>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('upload')}
                className="inline-flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white shadow-lg shadow-ink/15 transition hover:bg-graphite"
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
                    className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold ${
                      activePage === item.id ? 'bg-ink text-white' : 'bg-white/70 text-graphite'
                    }`}
                  >
                    <Icon size={15} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </header>

          <div className="scrollbar-soft min-h-0 flex-1 overflow-auto desk-grid px-4 py-5 sm:px-6 xl:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
