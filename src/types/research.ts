export type PageId = 'dashboard' | 'library' | 'performance' | 'timeline' | 'tutor' | 'upload' | 'chat' | 'study' | 'map';

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
  embeddingStatus?: 'not_embedded' | 'embedding' | 'embedded' | 'failed' | 'keyword_only';
  embeddingError?: string;
  metadata?: DocumentMetadata;
  collectionIds?: string[];
};

export type DocumentMetadata = {
  subjects: string[];
  topics: string[];
  academicYears: string[];
  terms: string[];
  assessments: string[];
  documentTypes: string[];
  teacherNames: string[];
  skills: string[];
  performanceRecords: string[];
  collections: string[];
  tags: string[];
};

export type Collection = {
  id: string;
  name: string;
  description?: string;
  source: 'system' | 'user' | 'metadata';
  createdAt: string;
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
  embeddingStatus?: 'pending' | 'embedded' | 'failed';
  embeddingModel?: string;
  embeddingError?: string;
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
  matchedTerms?: string[];
  score?: number;
  reason?: string;
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

export type TutorDifficulty = 'Foundation' | 'Core' | 'Stretch';

export type TutorCheckpointQuestion = {
  id: string;
  prompt: string;
  answer: string;
  explanation: string;
  difficulty: TutorDifficulty;
};

export type TutorLesson = {
  id: string;
  workspaceId: string;
  topic: string;
  objective: string;
  estimatedDuration: string;
  difficulty: TutorDifficulty;
  explanation: string;
  checkpointQuestions: TutorCheckpointQuestion[];
  recap: string;
  nextRecommendation: string;
  citations: Citation[];
  status: 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type TutorMemoryTopic = {
  topic: string;
  confidence: number;
  quizAccuracy: number;
  lessonsCompleted: number;
  attempts: number;
  correctAttempts: number;
  lastReviewed: string;
};

export type TutorAttempt = {
  id: string;
  workspaceId: string;
  lessonId?: string;
  mode: 'lesson' | 'socratic' | 'exam';
  topic: string;
  prompt: string;
  answer: string;
  feedback: string;
  correct: boolean;
  createdAt: string;
};

export type TutorSocraticTurn = {
  id: string;
  workspaceId: string;
  topic: string;
  question: string;
  studentAnswer?: string;
  feedback?: string;
  followUp?: string;
  difficulty: TutorDifficulty;
  citations: Citation[];
  createdAt: string;
};

export type TutorExamQuestion = {
  id: string;
  prompt: string;
  marks: number;
  commandWord: string;
  markScheme: string;
};

export type TutorExamSession = {
  id: string;
  workspaceId: string;
  topic: string;
  questions: TutorExamQuestion[];
  citations: Citation[];
  createdAt: string;
};

export type TutorMemory = {
  lessonsCompleted: number;
  topicsStudied: TutorMemoryTopic[];
  revisionStreak: number;
  lastReviewed?: string;
};

export type ResearchState = {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  collections: Collection[];
  documents: ResearchDocument[];
  chunks: DocumentChunk[];
  insights: Insight[];
  actions: SuggestedAction[];
  chat: ChatMessage[];
  performanceRecords: PerformanceRecord[];
  performanceSummaries: PerformanceSummary[];
  tutorLessons: TutorLesson[];
  tutorAttempts: TutorAttempt[];
  tutorSocraticTurns: TutorSocraticTurn[];
  tutorExamSessions: TutorExamSession[];
  tutorMemory: TutorMemory;
};
