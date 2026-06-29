import type { ResearchState, Workspace } from '../types/research';

export const workspaces: Workspace[] = [
  {
    id: 'workspace-personal-research',
    name: 'Personal Research',
    description: 'Create your own learning spaces and let uploads connect subjects, collections, performance, Tutor, and the timeline.',
    documentCount: 0,
    color: 'bg-moss',
  },
];

export const initialState: ResearchState = {
  workspaces,
  activeWorkspaceId: workspaces[0].id,
  collections: [],
  documents: [],
  chunks: [],
  insights: [],
  actions: [],
  chat: [],
  performanceRecords: [],
  performanceSummaries: [],
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
