import type { ChatMessage, Insight, MapEdge, MapNode, ResearchDocument, ResearchState, SuggestedAction, Workspace } from '../types/research';

export const workspaces: Workspace[] = [
  {
    id: 'workspace-attention',
    name: 'Attention & Learning',
    description: 'Reading notes, papers, and teaching references for cognitive load research.',
    documentCount: 14,
    color: 'bg-moss',
  },
  {
    id: 'workspace-climate',
    name: 'Climate Adaptation',
    description: 'Policy memos, field studies, and adaptation frameworks.',
    documentCount: 9,
    color: 'bg-brass',
  },
  {
    id: 'workspace-thesis',
    name: 'Thesis Drafting',
    description: 'Chapter sources, outline fragments, and argument maps.',
    documentCount: 22,
    color: 'bg-graphite',
  },
];

export const documents: ResearchDocument[] = [
  {
    id: 'doc-1',
    title: 'Working Memory Limits in Applied Learning Environments',
    type: 'PDF',
    workspaceId: 'workspace-attention',
    authors: 'M. Hartwell, L. Chen',
    addedAt: '2026-06-24',
    status: 'Indexed',
    tags: ['cognition', 'instructional design', 'load theory'],
    insightCount: 8,
    summary: 'Finds that guided retrieval and staged complexity reduce overload in early-stage learners.',
  },
  {
    id: 'doc-2',
    title: 'Design Notes: Longitudinal Reading Study',
    type: 'DOCX',
    workspaceId: 'workspace-attention',
    authors: 'Research OS draft',
    addedAt: '2026-06-22',
    status: 'Needs review',
    tags: ['methods', 'study design'],
    insightCount: 4,
    summary: 'A draft protocol for measuring how note-taking density affects later synthesis quality.',
  },
  {
    id: 'doc-3',
    title: 'Coastal Adaptation Funding Models 2025',
    type: 'PDF',
    workspaceId: 'workspace-climate',
    authors: 'Urban Resilience Lab',
    addedAt: '2026-06-20',
    status: 'Indexed',
    tags: ['policy', 'resilience', 'funding'],
    insightCount: 11,
    summary: 'Compares grant, bond, and pooled-risk models for municipal climate adaptation.',
  },
  {
    id: 'doc-4',
    title: 'Chapter 2 Argument Fragments',
    type: 'TXT',
    workspaceId: 'workspace-thesis',
    authors: 'Personal notes',
    addedAt: '2026-06-18',
    status: 'Extracting',
    tags: ['chapter 2', 'argument'],
    insightCount: 6,
    summary: 'Loose notes connecting attention, reading rhythm, and knowledge retention.',
  },
];

export const insights: Insight[] = [
  {
    id: 'insight-1',
    title: 'Staged complexity may be the strongest cross-source pattern',
    body: 'Three recent sources point to progressive disclosure as a practical bridge between learner confidence and conceptual accuracy.',
    sourceId: 'doc-1',
    confidence: 92,
  },
  {
    id: 'insight-2',
    title: 'Funding model comparisons need a local governance lens',
    body: 'Adaptation funding mechanisms appear less transferable when procurement authority differs across regions.',
    sourceId: 'doc-3',
    confidence: 87,
  },
  {
    id: 'insight-3',
    title: 'Reading notes show a useful distinction',
    body: 'The thesis material separates capture quality from later synthesis quality, which could become a chapter structure.',
    sourceId: 'doc-4',
    confidence: 81,
  },
];

export const actions: SuggestedAction[] = [
  {
    id: 'action-1',
    title: 'Review 2 unresolved extractions',
    detail: 'Confirm author names and headings before adding them to your knowledge map.',
    page: 'upload',
  },
  {
    id: 'action-2',
    title: 'Generate flashcards from cognitive load notes',
    detail: 'The newest document has enough definitions and claims for a clean revision set.',
    page: 'study',
  },
  {
    id: 'action-3',
    title: 'Ask for contradictions across policy sources',
    detail: 'Climate adaptation papers contain competing assumptions about public-private finance.',
    page: 'chat',
  },
];

export const chatMessages: ChatMessage[] = [
  {
    id: 'chat-1',
    role: 'user',
    content: 'What is the strongest recurring theme in the attention workspace?',
  },
  {
    id: 'chat-2',
    role: 'assistant',
    content: 'The clearest theme is that learners retain more when complexity is staged and retrieval is guided. The sources differ in method, but they converge on reducing early ambiguity while still preserving active recall.',
    citations: [
      {
        documentTitle: 'Working Memory Limits in Applied Learning Environments',
        location: 'pp. 8-11',
        excerpt: 'Guided retrieval reduced error rates during the second practice interval.',
      },
      {
        documentTitle: 'Design Notes: Longitudinal Reading Study',
        location: 'Method draft',
        excerpt: 'Later synthesis quality should be measured separately from note volume.',
      },
    ],
  },
];

export const mapNodes: MapNode[] = [
  { id: 'n1', label: 'Working Memory', x: 48, y: 44, size: 90, tone: 'moss' },
  { id: 'n2', label: 'Guided Retrieval', x: 24, y: 26, size: 72, tone: 'brass' },
  { id: 'n3', label: 'Staged Complexity', x: 68, y: 24, size: 78, tone: 'graphite' },
  { id: 'n4', label: 'Synthesis Quality', x: 72, y: 66, size: 74, tone: 'brass' },
  { id: 'n5', label: 'Learning Confidence', x: 30, y: 70, size: 68, tone: 'ink' },
  { id: 'n6', label: 'Assessment Design', x: 50, y: 82, size: 58, tone: 'moss' },
];

export const mapEdges: MapEdge[] = [
  { from: 'n1', to: 'n2' },
  { from: 'n1', to: 'n3' },
  { from: 'n3', to: 'n4' },
  { from: 'n2', to: 'n5' },
  { from: 'n5', to: 'n6' },
  { from: 'n4', to: 'n6' },
];

export const initialState: ResearchState = {
  workspaces,
  activeWorkspaceId: workspaces[0].id,
  documents,
  insights,
  actions,
  chat: chatMessages,
};
