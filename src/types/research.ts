export type PageId = 'dashboard' | 'library' | 'performance' | 'upload' | 'chat' | 'study' | 'map';

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
  status: 'Indexed' | 'Ready' | 'Extracting' | 'Analysing' | 'Failed' | 'Needs review';
  tags: string[];
  insightCount: number;
  summary: string;
  extractedText?: string;
  wordCount?: number;
  pageCount?: number;
  chunkIds?: string[];
  extractionError?: string;
};

export type DocumentChunk = {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  wordCount: number;
  pageStart?: number;
  pageEnd?: number;
  createdAt: string;
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

export type AssessmentType = 'exam' | 'report' | 'coursework' | 'music' | 'mock' | 'other';

export type PerformanceRecord = {
  id: string;
  title: string;
  sourceDocumentId?: string;
  date: string;
  term?: string;
  academicYear?: string;
  subject: string;
  assessmentType: AssessmentType;
  score?: number;
  maxScore?: number;
  percentage?: number;
  grade?: string;
  rank?: string;
  teacherComment?: string;
  strengths: string[];
  weaknesses: string[];
  actionPoints: string[];
  createdAt: string;
};

export type PerformanceSummary = {
  id: string;
  generatedAt: string;
  subjects: string[];
  strongestSubjects: string[];
  weakestSubjects: string[];
  improvingSubjects: string[];
  decliningSubjects: string[];
  recurringStrengths: string[];
  recurringWeaknesses: string[];
  recommendedActions: string[];
  overallCommentary: string;
};

export type ResearchState = {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  documents: ResearchDocument[];
  chunks: DocumentChunk[];
  insights: Insight[];
  actions: SuggestedAction[];
  chat: ChatMessage[];
  performanceRecords: PerformanceRecord[];
  performanceSummaries: PerformanceSummary[];
};
