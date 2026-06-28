import { ArrowRight, BrainCircuit, CalendarDays, CheckCircle2, Clock3, FilePlus2, Files, LibraryBig, Network, Send, Sparkles, Tags, UploadCloud } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import { CitationCard } from './components/CitationCard';
import { DocumentCard } from './components/DocumentCard';
import { SectionHeader } from './components/SectionHeader';
import { StatCard } from './components/StatCard';
import { mapEdges, mapNodes } from './data/mockData';
import { useResearchState } from './hooks/useResearchState';
import type { ChatMessage, PageId, ResearchDocument } from './types/research';
import { askResearchChat } from './utils/api';

function App() {
  const { state, setState } = useResearchState();
  const [activePage, setActivePage] = useState<PageId>('dashboard');

  const workspaceDocuments = useMemo(
    () => state.documents.filter((document) => document.workspaceId === state.activeWorkspaceId),
    [state.activeWorkspaceId, state.documents],
  );
  const activeWorkspaceName = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.name ?? 'Research workspace';

  const page = {
    dashboard: <Dashboard state={state} documents={workspaceDocuments} setActivePage={setActivePage} />,
    library: <Library documents={workspaceDocuments} />,
    upload: <Upload stateDocuments={state.documents} activeWorkspaceId={state.activeWorkspaceId} setState={setState} />,
    chat: <ResearchChat chat={state.chat} workspaceName={activeWorkspaceName} documents={workspaceDocuments} setState={setState} />,
    study: <StudyTools documents={workspaceDocuments} />,
    map: <KnowledgeMap />,
  }[activePage];

  return (
    <AppShell state={state} activePage={activePage} setActivePage={setActivePage} setState={setState}>
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
  const indexedCount = documents.filter((document) => document.status === 'Indexed').length;
  const newestDocuments = [...documents].slice(0, 3);

  return (
    <div className="space-y-7">
      <section className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-[28px] border border-white/80 bg-ink p-6 text-white shadow-soft xl:col-span-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Today at the desk</p>
          <h2 className="mt-4 max-w-2xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
            Your research is organized, searchable, and ready for synthesis.
          </h2>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActivePage('chat')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink"
            >
              Ask AI Chat
              <ArrowRight size={17} />
            </button>
            <button
              type="button"
              onClick={() => setActivePage('library')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/18 px-4 py-3 text-sm font-bold text-white"
            >
              Open Library
            </button>
          </div>
        </div>
        <StatCard label="Documents" value={String(documents.length)} detail={`${indexedCount} indexed sources in this workspace.`} icon={Files} />
        <StatCard label="Insights" value={String(state.insights.length)} detail="Saved claims, patterns, and useful synthesis fragments." icon={Sparkles} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <div>
          <SectionHeader eyebrow="Recent documents" title="Fresh sources" copy="The documents most likely to need review, annotation, or synthesis." />
          <div className="grid gap-4 md:grid-cols-2">
            {newestDocuments.map((document) => (
              <DocumentCard key={document.id} document={document} />
            ))}
          </div>
        </div>

        <div>
          <SectionHeader eyebrow="Next actions" title="Suggested focus" />
          <div className="space-y-3">
            {state.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => setActivePage(action.page)}
                className="w-full rounded-3xl border border-white/80 bg-white/78 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-ink">{action.title}</p>
                    <p className="mt-2 text-sm leading-6 text-graphite/72">{action.detail}</p>
                  </div>
                  <ArrowRight className="mt-1 shrink-0 text-brass" size={18} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Saved insights" title="Research signals" />
        <div className="grid gap-4 lg:grid-cols-3">
          {state.insights.map((insight) => (
            <article key={insight.id} className="rounded-3xl border border-white/80 bg-white/78 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <Sparkles size={18} className="text-brass" />
                <span className="rounded-full bg-moss/10 px-2.5 py-1 text-xs font-bold text-moss">{insight.confidence}% confidence</span>
              </div>
              <h3 className="mt-4 text-lg font-extrabold leading-6 text-ink">{insight.title}</h3>
              <p className="mt-3 text-sm leading-6 text-graphite/74">{insight.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Library({ documents }: { documents: ResearchDocument[] }) {
  return (
    <div>
      <SectionHeader
        eyebrow="Document library"
        title="Sources by workspace"
        copy="A clean catalogue for your indexed and in-progress materials. Filters and full-text search can sit naturally on top of this structure later."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {documents.map((document) => (
          <DocumentCard key={document.id} document={document} />
        ))}
      </div>
    </div>
  );
}

function Upload({
  stateDocuments,
  activeWorkspaceId,
  setState,
}: {
  stateDocuments: ResearchDocument[];
  activeWorkspaceId: string;
  setState: ReturnType<typeof useResearchState>['setState'];
}) {
  const [fileName, setFileName] = useState('');
  const [note, setNote] = useState('Mock extraction will create a source record with title, type, tags, and a short summary.');
  const recentUploads = stateDocuments.filter((document) => document.status !== 'Indexed').slice(0, 3);

  function handleMockUpload() {
    const cleanName = fileName.trim() || 'Untitled Research Source.pdf';
    const extension = cleanName.split('.').pop()?.toUpperCase();
    const type = extension === 'TXT' || extension === 'DOCX' ? extension : 'PDF';
    const title = cleanName.replace(/\.(pdf|txt|docx)$/i, '').replace(/[-_]/g, ' ');

    const newDocument: ResearchDocument = {
      id: `doc-${Date.now()}`,
      title,
      type,
      workspaceId: activeWorkspaceId,
      authors: 'Pending extraction',
      addedAt: new Date().toISOString().slice(0, 10),
      status: 'Extracting',
      tags: ['new source', 'mock extraction'],
      insightCount: 0,
      summary: 'Research OS has queued this source for mock extraction. The future backend can replace this with real parsing and embeddings.',
    };

    setState((current) => ({
      ...current,
      documents: [newDocument, ...current.documents],
    }));
    setNote(`${cleanName} was added to the library and queued for mock extraction.`);
    setFileName('');
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section>
        <SectionHeader
          eyebrow="Upload"
          title="Add research material"
          copy="Drop in PDFs, text notes, or document drafts. Extraction is mocked for now, but the flow is shaped for a real ingestion pipeline."
        />
        <div className="rounded-[28px] border border-dashed border-ink/18 bg-white/78 p-6 shadow-sm">
          <div className="grid min-h-[260px] place-items-center rounded-3xl bg-paper/75 px-5 py-8 text-center">
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-ink text-white shadow-lg shadow-ink/15">
                <UploadCloud size={28} />
              </div>
              <h3 className="mt-5 font-serif text-3xl font-bold text-ink">Upload source files</h3>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-graphite/72">
                Supported in the MVP interface: PDF, TXT, and DOCX. The file is represented locally as mock metadata.
              </p>
              <div className="mx-auto mt-6 flex max-w-xl flex-col gap-3 sm:flex-row">
                <input
                  value={fileName}
                  onChange={(event) => setFileName(event.target.value)}
                  placeholder="example-paper.pdf"
                  className="min-w-0 flex-1 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-brass/30 transition focus:ring-4"
                />
                <button
                  type="button"
                  onClick={handleMockUpload}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 text-sm font-bold text-white shadow-lg shadow-ink/15"
                >
                  <FilePlus2 size={18} />
                  Mock Extract
                </button>
              </div>
              <p className="mt-4 text-sm font-medium text-moss">{note}</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Extraction queue" title="Review needed" />
        <div className="space-y-3">
          {recentUploads.map((document) => (
            <div key={document.id} className="rounded-3xl border border-white/80 bg-white/78 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold text-ink">{document.title}</p>
                  <p className="mt-2 text-sm leading-6 text-graphite/72">{document.summary}</p>
                </div>
                <Clock3 className="shrink-0 text-brass" size={20} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ResearchChat({
  chat,
  workspaceName,
  documents,
  setState,
}: {
  chat: ChatMessage[];
  workspaceName: string;
  documents: ResearchDocument[];
  setState: ReturnType<typeof useResearchState>['setState'];
}) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
      const response = await askResearchChat({
        question,
        workspaceName,
        documents: documents.map((document) => ({
          title: document.title,
          summary: document.summary,
          topics: document.tags,
          extractedText: document.summary,
        })),
      });

      const assistantMessage: ChatMessage = {
        id: `chat-${Date.now()}-assistant`,
        role: 'assistant',
        content: response.answer,
        citations: response.sources.map((source) => ({
          documentTitle: source.documentTitle,
          location: source.location,
          excerpt: source.excerpt,
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
    <div className="grid min-h-[680px] gap-5 xl:grid-cols-[1fr_360px]">
      <section className="flex min-h-0 flex-col rounded-[28px] border border-white/80 bg-white/78 shadow-sm">
        <div className="border-b border-ink/10 p-5">
          <SectionHeader eyebrow="AI research chat" title="Ask with sources" copy="A calm research assistant interface with citation cards tied to your local library." />
        </div>
        <div className="scrollbar-soft flex-1 space-y-5 overflow-auto p-5">
          {chat.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[720px]' : 'mr-auto max-w-[820px]'}>
              <div className={`rounded-3xl p-5 ${message.role === 'user' ? 'bg-ink text-white' : 'bg-paper/85 text-ink'}`}>
                <p className="text-sm leading-7">{message.content}</p>
              </div>
              {message.citations ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {message.citations.map((citation) => (
                    <CitationCard key={`${message.id}-${citation.documentTitle}`} citation={citation} />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {isLoading ? (
            <div className="mr-auto max-w-[820px]">
              <div className="rounded-3xl bg-paper/85 p-5 text-ink">
                <div className="flex items-center gap-3 text-sm font-semibold text-graphite/72">
                  <span className="size-2 animate-pulse rounded-full bg-brass" />
                  <span className="size-2 animate-pulse rounded-full bg-brass [animation-delay:120ms]" />
                  <span className="size-2 animate-pulse rounded-full bg-brass [animation-delay:240ms]" />
                  <span className="ml-1">Reading workspace sources...</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="border-t border-ink/10 p-4">
          {errorMessage ? (
            <div className="mb-3 rounded-2xl border border-brass/20 bg-brass/10 px-4 py-3 text-sm font-semibold text-graphite">
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
              className="min-w-0 flex-1 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-brass/30 transition focus:ring-4 disabled:cursor-not-allowed disabled:bg-paper"
            />
            <button
              type="button"
              aria-label="Send research question"
              title="Send research question"
              onClick={sendMessage}
              disabled={isLoading}
              className="grid size-12 place-items-center rounded-2xl bg-ink text-white shadow-lg shadow-ink/15 transition disabled:cursor-not-allowed disabled:bg-graphite/55"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </section>

      <aside className="rounded-[28px] border border-white/80 bg-ink p-5 text-white shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Citation posture</p>
        <h3 className="mt-3 font-serif text-3xl font-bold">Every answer earns its place.</h3>
        <p className="mt-4 text-sm leading-7 text-white/72">
          The MVP keeps citation cards visible beside the conversation pattern, so future retrieval can feel trustworthy from day one.
        </p>
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
    <div>
      <SectionHeader
        eyebrow="Study tools"
        title="Turn sources into learning assets"
        copy="Mock tools are wired as premium-feeling controls now, ready for real generation later."
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.label}
                type="button"
                onClick={() => setActiveTool(tool.label)}
                className={`flex w-full items-center gap-3 rounded-3xl border p-4 text-left transition ${
                  activeTool === tool.label ? 'border-ink/20 bg-ink text-white shadow-soft' : 'border-white/80 bg-white/78 text-ink shadow-sm hover:bg-white'
                }`}
              >
                <Icon size={21} />
                <span className="font-extrabold">{tool.label}</span>
              </button>
            );
          })}
        </div>
        <div className="rounded-[28px] border border-white/80 bg-white/78 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brass">Generated preview</p>
          <h3 className="mt-3 font-serif text-4xl font-bold text-ink">{activeTool}</h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-graphite/74">
            {activeTool} output would be generated from {documents.length} workspace sources. This preview keeps the interaction model visible while the
            backend is still intentionally absent.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {documents.slice(0, 4).map((document) => (
              <div key={document.id} className="rounded-3xl bg-paper/80 p-4">
                <p className="font-extrabold text-ink">{document.title}</p>
                <p className="mt-2 text-sm leading-6 text-graphite/72">{document.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KnowledgeMap() {
  const nodeById = Object.fromEntries(mapNodes.map((node) => [node.id, node]));
  const toneClasses = {
    moss: 'bg-moss text-white',
    brass: 'bg-brass text-white',
    graphite: 'bg-graphite text-white',
    ink: 'bg-ink text-white',
  };

  return (
    <div>
      <SectionHeader
        eyebrow="Knowledge map"
        title="Connected topic graph"
        copy="A mock map of how concepts relate across the active research area. Nodes are positioned to suggest clusters without implying final ontology."
      />
      <div className="relative min-h-[640px] overflow-hidden rounded-[28px] border border-white/80 bg-white/78 shadow-soft">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {mapEdges.map((edge) => {
            const from = nodeById[edge.from];
            const to = nodeById[edge.to];
            return <line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(68,81,94,0.22)" strokeWidth="0.35" />;
          })}
        </svg>
        <div className="absolute left-6 top-6 z-10 rounded-3xl bg-ink px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <Network size={18} />
            <span className="text-sm font-bold">6 topics / 6 links</span>
          </div>
        </div>
        {mapNodes.map((node) => (
          <div
            key={node.id}
            className={`absolute z-20 grid place-items-center rounded-full px-4 text-center text-sm font-extrabold leading-tight shadow-lg shadow-ink/12 ${toneClasses[node.tone]}`}
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              width: node.size,
              height: node.size,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {node.label}
          </div>
        ))}
        <div className="absolute bottom-5 left-5 right-5 z-10 grid gap-3 rounded-3xl border border-ink/10 bg-ivory/86 p-4 backdrop-blur md:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-graphite/58">
              <Tags size={14} />
              Cluster
            </p>
            <p className="mt-2 font-extrabold text-ink">Learning mechanics</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-graphite/58">Strongest bridge</p>
            <p className="mt-2 font-extrabold text-ink">Staged Complexity to Synthesis Quality</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-graphite/58">Next useful action</p>
            <p className="mt-2 font-extrabold text-ink">Ask for missing evidence</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
