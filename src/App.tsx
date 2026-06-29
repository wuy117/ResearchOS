import { ArrowRight, BrainCircuit, CalendarDays, CheckCircle2, Clock3, FilePlus2, LibraryBig, Network, Send, Sparkles, Tags, UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from './components/AppShell';
import { CitationCard } from './components/CitationCard';
import { DocumentCard } from './components/DocumentCard';
import { SectionHeader } from './components/SectionHeader';
import { mapEdges, mapNodes } from './data/mockData';
import { useResearchState } from './hooks/useResearchState';
import type { ChatMessage, DocumentChunk, PageId, ResearchDocument } from './types/research';
import { askResearchChat } from './utils/api';
import { chunkText, extractTopics, getWordCount, summarizeText } from './utils/chunkText';
import { extractPdfText } from './utils/extractPdfText';

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
    library: <Library documents={workspaceDocuments} chunks={state.chunks} />,
    upload: <Upload stateDocuments={state.documents} activeWorkspaceId={state.activeWorkspaceId} setState={setState} />,
    chat: <ResearchChat chat={state.chat} workspaceName={activeWorkspaceName} documents={workspaceDocuments} chunks={state.chunks} setState={setState} />,
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
  const newestDocuments = [...documents].slice(0, 2);
  const primaryAction = state.actions[0];

  return (
    <div className="mx-auto max-w-6xl space-y-9">
      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-ink/8 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Continue</p>
          <h2 className="mt-4 max-w-2xl font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Return to your active reading desk.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-graphite/72">
            {indexedCount} indexed sources are ready in this workspace. Use chat for synthesis or open the library to keep reviewing source material.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActivePage('chat')}
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm"
            >
              Ask research chat
              <ArrowRight size={17} />
            </button>
            <button
              type="button"
              onClick={() => setActivePage('library')}
              className="inline-flex items-center gap-2 rounded-xl border border-ink/10 bg-paper px-4 py-3 text-sm font-semibold text-ink"
            >
              Open library
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
          ) : null}
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
        <EmptyState title="Your library is empty" copy="Upload a PDF or TXT file to create searchable source material for this workspace." />
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [failedPdfUpload, setFailedPdfUpload] = useState<{ file: File; documentId: string; title: string; cleanName: string } | null>(null);
  const [note, setNote] = useState('TXT and PDF files are extracted locally and chunked into searchable research context. DOCX stays mocked for now.');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recentUploads = stateDocuments.filter((document) => document.status !== 'Indexed' || document.type === 'TXT' || document.type === 'PDF').slice(0, 4);

  function resetUploadFields() {
    setSelectedFile(null);
    setFileName('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
    setFailedPdfUpload(null);

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
      setNote(
        `${cleanName} is ready with ${extracted.pages.length.toLocaleString()} pages, ${extracted.wordCount.toLocaleString()} words, and ${chunks.length} chunks.`,
      );
      resetUploadFields();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Research OS could not extract text from ${cleanName}. Please try another PDF.`;
      const failedDocument: ResearchDocument = {
        ...processingDocument,
        status: 'Failed',
        tags: ['pdf upload', 'failed'],
        summary: message,
        extractionError: message,
      };

      setState((current) => ({
        ...current,
        documents: current.documents.map((document) => (document.id === documentId ? failedDocument : document)),
        chunks: current.chunks.filter((chunk) => chunk.documentId !== documentId),
      }));
      setFailedPdfUpload({ file, documentId, title, cleanName });
      setNote(`${message} You can retry the extraction without selecting the file again.`);
    } finally {
      setIsReading(false);
    }
  }

  async function handleUpload() {
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
        const chunks = chunkText({ text: extractedText, documentId });
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
        setNote(`${cleanName} was read locally, saved with ${wordCount.toLocaleString()} words, and split into ${chunks.length} chunks.`);
      } catch {
        setNote(`Research OS could not read ${cleanName}. Please try a plain UTF-8 text file.`);
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

    const newDocument: ResearchDocument = {
      id: documentId,
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
    setNote(`${cleanName} was added to the library and queued for mock extraction. Real extraction is currently enabled for TXT and PDF files.`);
    resetUploadFields();
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-7 xl:grid-cols-[1.35fr_0.65fr]">
      <section>
        <SectionHeader
          eyebrow="Upload"
          title="Add research material"
          copy="Choose a source and let Research OS prepare it for the local library. TXT and PDF extraction stay in your browser."
        />
        <div className="rounded-2xl border border-dashed border-ink/16 bg-white p-5 shadow-sm">
          <div className="grid min-h-[340px] place-items-center rounded-2xl bg-paper/65 px-5 py-10 text-center">
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-ink/8 bg-white text-ink shadow-sm">
                <UploadCloud size={28} />
              </div>
              <h3 className="mt-5 font-serif text-3xl font-semibold text-ink">Place a source on the desk</h3>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-graphite/72">
                Select a TXT, PDF, or DOCX file. PDFs and text files are read locally; DOCX keeps the existing queued extraction path.
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
                  {isReading ? 'Processing...' : selectedFile?.name.toLowerCase().endsWith('.txt') ? 'Ingest TXT' : selectedFile?.name.toLowerCase().endsWith('.pdf') ? 'Extract PDF' : 'Mock Extract'}
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
                    ]
                      .filter(Boolean)
                      .join(' / ')}
                  </p>
                  {document.status === 'Failed' && failedPdfUpload?.documentId === document.id ? (
                    <button
                      type="button"
                      onClick={() => processPdfUpload(failedPdfUpload)}
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

function getQuestionTerms(question: string) {
  return new Set(
    question
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((term) => term.length > 3) ?? [],
  );
}

function scoreChunk(chunk: DocumentChunk, terms: Set<string>) {
  const text = chunk.text.toLowerCase();

  return [...terms].reduce((score, term) => {
    return text.includes(term) ? score + 1 : score;
  }, 0);
}

function buildResearchChatContext(question: string, documents: ResearchDocument[], chunks: DocumentChunk[]) {
  const documentById = new Map(documents.map((document) => [document.id, document]));
  const terms = getQuestionTerms(question);
  const matchingChunks = chunks
    .filter((chunk) => documentById.has(chunk.documentId))
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, terms),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex)
    .slice(0, 6);

  if (matchingChunks.length > 0) {
    return matchingChunks.map(({ chunk }) => {
      const document = documentById.get(chunk.documentId)!;
      const location =
        chunk.pageStart && chunk.pageEnd
          ? chunk.pageStart === chunk.pageEnd
            ? `p. ${chunk.pageStart}`
            : `pp. ${chunk.pageStart}-${chunk.pageEnd}`
          : `chunk ${chunk.chunkIndex + 1}`;

      return {
        title: document.title,
        location,
        summary: document.summary,
        topics: document.tags,
        extractedText: chunk.text,
      };
    });
  }

  return documents.map((document) => ({
    title: document.title,
    location: document.pageCount ? `${document.pageCount.toLocaleString()} page PDF` : 'Supplied document context',
    summary: document.summary,
    topics: document.tags,
    extractedText: document.extractedText ? document.extractedText.slice(0, 2400) : document.summary,
  }));
}

function ResearchChat({
  chat,
  workspaceName,
  documents,
  chunks,
  setState,
}: {
  chat: ChatMessage[];
  workspaceName: string;
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
      const response = await askResearchChat({
        question,
        workspaceName,
        documents: buildResearchChatContext(question, documents, chunks),
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
    <div className="mx-auto grid h-[calc(100vh-23rem)] min-h-[420px] max-w-7xl gap-5 sm:h-[calc(100vh-12rem)] sm:min-h-[480px] xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm">
        <div className="shrink-0 border-b border-ink/8 p-5">
          <SectionHeader eyebrow="Research chat" title="Ask with sources" copy="A fixed research conversation area with source material kept close, but out of the way." />
        </div>
        <div className="scrollbar-soft min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {chat.map((message) => (
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
                      <CitationCard key={`${message.id}-${citation.documentTitle}`} citation={citation} />
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ))}
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
          {latestCitations.length ? (
            latestCitations.map((citation) => <CitationCard key={`${citation.documentTitle}-${citation.location}`} citation={citation} />)
          ) : (
            <p className="rounded-2xl bg-paper/70 p-4 text-sm leading-7 text-graphite/70">
              Source cards will appear here after the assistant answers with citations.
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
            {activeTool} output would be generated from {documents.length} workspace sources. This preview keeps the interaction model visible while the
            backend is still intentionally absent.
          </p>
          <div className="mt-7 space-y-3">
            {documents.slice(0, 4).map((document) => (
              <div key={document.id} className="rounded-xl border border-ink/8 bg-paper/65 p-4">
                <p className="font-semibold text-ink">{document.title}</p>
                <p className="mt-2 line-clamp-2 text-sm leading-7 text-graphite/72">{document.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KnowledgeMap() {
  const [selectedNodeId, setSelectedNodeId] = useState(mapNodes[0]?.id ?? '');
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
        copy="A quieter map of relationships across the active research area. Select a node to inspect its role without treating the mock graph as final ontology."
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="relative min-h-[560px] overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {mapEdges.map((edge) => {
              const from = nodeById[edge.from];
              const to = nodeById[edge.to];
              return <line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(68,81,94,0.18)" strokeWidth="0.28" />;
            })}
          </svg>
          <div className="absolute left-5 top-5 z-10 rounded-xl border border-ink/8 bg-paper/80 px-4 py-3 text-ink">
            <div className="flex items-center gap-2">
              <Network size={18} />
              <span className="text-sm font-semibold">6 topics / 6 links</span>
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
              <p className="mt-2 text-sm font-semibold text-ink">Learning mechanics</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Strongest bridge</p>
              <p className="mt-2 text-sm leading-7 text-graphite/72">Staged Complexity to Synthesis Quality</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Next useful action</p>
              <p className="mt-2 text-sm leading-7 text-graphite/72">Ask for missing evidence connected to this theme.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
