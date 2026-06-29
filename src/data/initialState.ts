import type { ResearchState, Workspace } from '../types/research';

export const workspaces: Workspace[] = [
  {
    id: 'workspace-biology',
    name: 'Biology',
    description: 'Papers, notes, and source material for biological research.',
    documentCount: 0,
    color: 'bg-moss',
  },
  {
    id: 'workspace-history',
    name: 'History',
    description: 'Primary sources, articles, and argument notes for historical research.',
    documentCount: 0,
    color: 'bg-brass',
  },
  {
    id: 'workspace-ai-medicine',
    name: 'AI in Medicine',
    description: 'Clinical AI papers, evaluation notes, and policy references.',
    documentCount: 0,
    color: 'bg-graphite',
  },
  {
    id: 'workspace-music-analysis',
    name: 'Music Analysis',
    description: 'Scores, listening notes, and analytical writing.',
    documentCount: 0,
    color: 'bg-moss',
  },
  {
    id: 'workspace-classical-civilisation',
    name: 'Classical Civilisation',
    description: 'Texts, lecture notes, and comparison material.',
    documentCount: 0,
    color: 'bg-brass',
  },
];

export const initialState: ResearchState = {
  workspaces,
  activeWorkspaceId: workspaces[0].id,
  documents: [],
  chunks: [],
  insights: [],
  actions: [],
  chat: [],
  performanceRecords: [],
  performanceSummaries: [],
};
