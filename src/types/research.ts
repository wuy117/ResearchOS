export type PageId = 'dashboard' | 'library' | 'upload' | 'chat' | 'study' | 'map';

export type Workspace = {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  color: string;
};

export type ResearchDocument = {
  id: string;
  title: string;
  type: 'PDF' | 'TXT' | 'DOCX';
  workspaceId: string;
  authors: string;
  addedAt: string;
  status: 'Indexed' | 'Extracting' | 'Needs review';
  tags: string[];
  insightCount: number;
  summary: string;
};

export type Insight = {
  id: string;
  title: string;
  body: string;
  sourceId: string;
  confidence: number;
};

export type SuggestedAction = {
  id: string;
  title: string;
  detail: string;
  page: PageId;
};

export type Citation = {
  documentTitle: string;
  location: string;
  excerpt: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
};

export type MapNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  tone: 'moss' | 'brass' | 'graphite' | 'ink';
};

export type MapEdge = {
  from: string;
  to: string;
};

export type ResearchState = {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  documents: ResearchDocument[];
  insights: Insight[];
  actions: SuggestedAction[];
  chat: ChatMessage[];
};
