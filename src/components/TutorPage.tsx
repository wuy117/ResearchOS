import {
  ArrowRight,
  BookMarked,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  GraduationCap,
  Lightbulb,
  MessageCircleQuestion,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseEnabled } from '../lib/supabase';
import type {
  Citation,
  DocumentChunk,
  PerformanceRecord,
  PerformanceSummary,
  ResearchDocument,
  ResearchState,
  TutorAttempt,
  TutorDifficulty,
  TutorExamQuestion,
  TutorExamSession,
  TutorLesson,
  TutorMemory,
  TutorMemoryTopic,
  TutorSocraticTurn,
} from '../types/research';
import {
  generateTutorContent,
  semanticSearch,
  type SemanticSearchMatch,
  type TutorExamResponse,
  type TutorLessonResponse,
  type TutorMarkResponse,
  type TutorRequestDocument,
  type TutorSocraticResponse,
} from '../utils/api';
import { retrieveChunks, type RetrievedChunk } from '../utils/retrieveChunks';
import { CitationCard } from './CitationCard';
import { getDocumentMetadata } from '../utils/learningModel';
import { deleteSupabaseRows } from '../services/researchStore';
import type { AppStorageStatus } from '../hooks/useResearchState';

type TutorView = 'home' | 'lesson' | 'socratic' | 'exam';

const tutorModes: Array<{ view: TutorView; label: string; shortLabel: string }> = [
  { view: 'home', label: 'Study overview', shortLabel: 'Overview' },
  { view: 'lesson', label: 'Guided lesson', shortLabel: 'Lesson' },
  { view: 'socratic', label: 'Socratic inquiry', shortLabel: 'Socratic' },
  { view: 'exam', label: 'Exam practice', shortLabel: 'Exam' },
];

type TutorPageProps = {
  workspaceId: string;
  documents: ResearchDocument[];
  chunks: DocumentChunk[];
  performanceRecords: PerformanceRecord[];
  performanceSummaries: PerformanceSummary[];
  tutorLessons: TutorLesson[];
  tutorAttempts: TutorAttempt[];
  tutorSocraticTurns: TutorSocraticTurn[];
  tutorExamSessions: TutorExamSession[];
  tutorMemory: TutorMemory;
  storageStatus: AppStorageStatus;
  userId?: string | null;
  setState: Dispatch<SetStateAction<ResearchState>>;
};

function clampConfidence(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function wasYesterday(value?: string) {
  if (!value) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return value.slice(0, 10) === yesterday.toISOString().slice(0, 10);
}

function updateMemory(memory: TutorMemory, topic: string, correct: boolean, completedLesson: boolean): TutorMemory {
  const now = new Date().toISOString();
  const current = memory.topicsStudied.find((item) => item.topic.toLowerCase() === topic.toLowerCase());
  const attempts = (current?.attempts ?? 0) + 1;
  const correctAttempts = (current?.correctAttempts ?? 0) + (correct ? 1 : 0);
  const quizAccuracy = attempts > 0 ? Math.round((correctAttempts / attempts) * 100) : 0;
  const confidenceDelta = correct ? 8 : -6;
  const nextTopic: TutorMemoryTopic = {
    topic,
    confidence: clampConfidence((current?.confidence ?? 50) + confidenceDelta + (completedLesson ? 4 : 0)),
    quizAccuracy,
    lessonsCompleted: (current?.lessonsCompleted ?? 0) + (completedLesson ? 1 : 0),
    attempts,
    correctAttempts,
    lastReviewed: now,
  };
  const previousReview = memory.lastReviewed;
  const nextStreak =
    previousReview?.slice(0, 10) === todayKey()
      ? memory.revisionStreak
      : wasYesterday(previousReview)
        ? memory.revisionStreak + 1
        : 1;

  return {
    lessonsCompleted: memory.lessonsCompleted + (completedLesson ? 1 : 0),
    topicsStudied: [nextTopic, ...memory.topicsStudied.filter((item) => item.topic.toLowerCase() !== topic.toLowerCase())],
    revisionStreak: nextStreak,
    lastReviewed: now,
  };
}

function getWeakTopics(records: PerformanceRecord[], summaries: PerformanceSummary[], memory: TutorMemory) {
  const summaryWeaknesses = summaries.flatMap((summary) => [...summary.weakestSubjects, ...summary.recurringWeaknesses]);
  const recordWeaknesses = records.flatMap((record) => [...record.weaknesses, ...record.actionPoints, record.subject]).filter(Boolean);
  const memoryWeaknesses = memory.topicsStudied.filter((topic) => topic.confidence < 55 || topic.quizAccuracy < 60).map((topic) => topic.topic);

  return [...new Set([...memoryWeaknesses, ...summaryWeaknesses, ...recordWeaknesses].map((topic) => topic.trim()).filter(Boolean))].slice(0, 6);
}

function getRecommendedTopics(documents: ResearchDocument[], weakTopics: string[], records: PerformanceRecord[], memory: TutorMemory) {
  const scores = new Map<string, number>();
  const addScore = (topic: string, score: number) => {
    const clean = topic.trim();
    if (!clean || /upload|failed/i.test(clean)) return;
    scores.set(clean, (scores.get(clean) ?? 0) + score);
  };

  weakTopics.forEach((topic) => addScore(topic, 8));
  records.forEach((record) => {
    const percentage = typeof record.percentage === 'number' ? record.percentage : typeof record.score === 'number' && typeof record.maxScore === 'number' && record.maxScore > 0 ? Math.round((record.score / record.maxScore) * 100) : undefined;
    const performanceWeight = percentage !== undefined && percentage < 70 ? 6 : 2;
    [record.subject, ...record.weaknesses, ...record.actionPoints].forEach((topic) => addScore(topic, performanceWeight));
    if (record.teacherComment) {
      [...record.teacherComment.matchAll(/\b(evaluation|explain|essay|structure|accuracy|vocabulary|timing|recall|analysis|evidence|technique|osmosis|respiration)\b/gi)]
        .map((match) => match[1])
        .forEach((topic) => addScore(topic, 5));
    }
  });

  documents.slice(0, 8).forEach((document, index) => {
    const metadata = getDocumentMetadata(document, records);
    const recencyWeight = Math.max(1, 5 - index);
    [...metadata.topics, ...metadata.skills, ...metadata.subjects].forEach((topic) => addScore(topic, recencyWeight));
  });

  memory.topicsStudied.forEach((topic) => {
    const daysSinceReview = Math.floor((Date.now() - new Date(topic.lastReviewed).getTime()) / 86_400_000);
    if (topic.confidence < 70) addScore(topic.topic, 5);
    if (topic.quizAccuracy < 60) addScore(topic.topic, 5);
    if (daysSinceReview >= 14) addScore(topic.topic, Math.min(6, Math.floor(daysSinceReview / 7)));
  });

  return [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([topic]) => topic).slice(0, 8);
}

function formatChunkLocation(result: RetrievedChunk) {
  if (result.pageStart && result.pageEnd) {
    return result.pageStart === result.pageEnd ? `p. ${result.pageStart}` : `pp. ${result.pageStart}-${result.pageEnd}`;
  }

  return `section ${result.chunk.chunkIndex + 1}`;
}

function semanticMatchesToRetrievedChunks(matches: SemanticSearchMatch[], documents: ResearchDocument[]): RetrievedChunk[] {
  const documentById = new Map(documents.map((document) => [document.id, document]));

  return matches.map((match, index) => {
    const document = documentById.get(match.documentId) ?? {
      id: match.documentId,
      title: match.documentTitle || 'Untitled source',
      type: match.documentType === 'TXT' || match.documentType === 'DOCX' ? match.documentType : 'PDF',
      workspaceId: '',
      authors: 'Supabase semantic search',
      addedAt: '',
      status: 'Ready',
      tags: [],
      insightCount: 0,
      summary: '',
    } satisfies ResearchDocument;
    const chunk: DocumentChunk = {
      id: match.id,
      documentId: match.documentId,
      chunkIndex: index,
      text: match.text,
      wordCount: match.text.trim().split(/\s+/).filter(Boolean).length,
      pageStart: match.pageStart,
      pageEnd: match.pageEnd,
      createdAt: '',
      embeddingStatus: 'embedded',
    };

    return {
      chunk,
      document,
      score: match.similarity,
      matchedTerms: [],
      reason: 'semantic similarity',
      pageStart: match.pageStart,
      pageEnd: match.pageEnd,
    };
  });
}

function buildTutorContext(results: RetrievedChunk[]): TutorRequestDocument[] {
  return results.map((result) => ({
    title: result.document.title,
    location: formatChunkLocation(result),
    pageStart: result.pageStart,
    pageEnd: result.pageEnd,
    summary: result.document.summary,
    topics: result.document.tags,
    extractedText: result.chunk.text,
    matchedTerms: result.matchedTerms,
  }));
}

function buildCitations(results: RetrievedChunk[]): Citation[] {
  return results.map((result) => ({
    documentTitle: result.document.title,
    location: formatChunkLocation(result),
    excerpt: result.chunk.text.slice(0, 260),
    matchedTerms: result.matchedTerms,
    score: result.score,
    reason: result.reason,
  }));
}

function normalizeDifficulty(value: string): TutorDifficulty {
  return value === 'Foundation' || value === 'Stretch' ? value : 'Core';
}

function normalizeLesson(response: TutorLessonResponse, workspaceId: string, fallbackTopic: string, citations: Citation[]): TutorLesson {
  const now = new Date().toISOString();

  return {
    id: `tutor-lesson-${Date.now()}`,
    workspaceId,
    topic: response.topic || fallbackTopic,
    objective: response.objective || `Understand ${fallbackTopic}.`,
    estimatedDuration: response.estimatedDuration || '15 minutes',
    difficulty: normalizeDifficulty(response.difficulty),
    explanation: response.explanation || 'The retrieved sources did not contain enough detail for a full explanation.',
    checkpointQuestions: (response.checkpointQuestions ?? []).slice(0, 4).map((question, index) => ({
      id: `checkpoint-${Date.now()}-${index}`,
      prompt: question.prompt || `What is one key idea about ${fallbackTopic}?`,
      answer: question.answer || 'Review the cited source and state the central idea.',
      explanation: question.explanation || 'This checks whether the idea can be recalled without looking back.',
      difficulty: normalizeDifficulty(question.difficulty),
    })),
    recap: response.recap || 'Review the cited evidence and retry the checkpoint questions.',
    nextRecommendation: response.nextRecommendation || `Practise another question on ${fallbackTopic}.`,
    citations,
    status: 'in_progress',
    createdAt: now,
    updatedAt: now,
  };
}

export function TutorPage({
  workspaceId,
  documents,
  chunks,
  performanceRecords,
  performanceSummaries,
  tutorLessons,
  tutorAttempts,
  tutorSocraticTurns,
  tutorExamSessions,
  tutorMemory,
  storageStatus,
  userId,
  setState,
}: TutorPageProps) {
  const weakTopics = useMemo(() => getWeakTopics(performanceRecords, performanceSummaries, tutorMemory), [performanceRecords, performanceSummaries, tutorMemory]);
  const recommendedTopics = useMemo(() => getRecommendedTopics(documents, weakTopics, performanceRecords, tutorMemory), [documents, weakTopics, performanceRecords, tutorMemory]);
  const hasReadableSources = documents.some((document) => document.extractedText?.trim() && document.status !== 'Failed');
  const hasTutorHistory = tutorLessons.some((lesson) => lesson.workspaceId === workspaceId) || tutorSocraticTurns.some((turn) => turn.workspaceId === workspaceId) || tutorExamSessions.some((exam) => exam.workspaceId === workspaceId) || tutorAttempts.length > 0 || tutorMemory.topicsStudied.length > 0;
  const recentTopics = tutorMemory.topicsStudied.slice(0, 5);
  const inProgressLesson = tutorLessons.find((lesson) => lesson.workspaceId === workspaceId && lesson.status === 'in_progress');
  const activeLesson = inProgressLesson ?? tutorLessons.find((lesson) => lesson.workspaceId === workspaceId);
  const latestExam = tutorExamSessions.find((exam) => exam.workspaceId === workspaceId);
  const weakestTopic = weakTopics[0] ?? [...tutorMemory.topicsStudied].sort((a, b) => a.confidence - b.confidence)[0]?.topic ?? recommendedTopics[0] ?? 'Upload a source';
  const suggestedTopic = recommendedTopics[0] ?? activeLesson?.topic ?? '';
  const [view, setView] = useState<TutorView>(inProgressLesson ? 'lesson' : 'home');
  const [topic, setTopic] = useState(suggestedTopic);
  const [difficulty, setDifficulty] = useState<TutorDifficulty>('Core');
  const [isLoading, setIsLoading] = useState(false);
  const idleStatus = 'Tutor reads your sources before teaching or questioning.';
  const [status, setStatus] = useState(idleStatus);
  const [currentLessonId, setCurrentLessonId] = useState(activeLesson?.id ?? '');
  const [checkpointAnswers, setCheckpointAnswers] = useState<Record<string, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [socraticAnswer, setSocraticAnswer] = useState('');
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [examFeedback, setExamFeedback] = useState<Record<string, TutorMarkResponse>>({});
  const [setupOpen, setSetupOpen] = useState(!hasTutorHistory);
  const [confirmAction, setConfirmAction] = useState<{ title: string; body: string; confirmLabel: string; onConfirm: () => Promise<void> | void } | null>(null);
  const modeContentRef = useRef<HTMLDivElement | null>(null);

  const currentLesson = tutorLessons.find((lesson) => lesson.id === currentLessonId && lesson.workspaceId === workspaceId) ?? activeLesson;
  const latestSocraticTurn = tutorSocraticTurns.find((turn) => turn.workspaceId === workspaceId);
  const selectedMode = tutorModes.find((mode) => mode.view === view) ?? tutorModes[0];
  const readableSourceCount = documents.filter((document) => document.extractedText?.trim() && document.status !== 'Failed').length;
  const modeChangeKey = view === 'lesson'
    ? `lesson:${currentLesson?.id ?? ''}`
    : view === 'socratic'
      ? `socratic:${latestSocraticTurn?.id ?? ''}`
      : view === 'exam'
        ? `exam:${latestExam?.id ?? ''}`
        : 'home';
  const previousModeKeyRef = useRef(modeChangeKey);

  useEffect(() => {
    if (previousModeKeyRef.current === modeChangeKey) return;
    previousModeKeyRef.current = modeChangeKey;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    modeContentRef.current?.focus({ preventScroll: true });
    modeContentRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [modeChangeKey]);

  async function retrieveForTutor(query: string) {
    let retrieved: RetrievedChunk[] = [];

    if (isSupabaseEnabled) {
      try {
        const semantic = await semanticSearch({ query, workspaceId, matchCount: 7 });
        const semanticChunks = semanticMatchesToRetrievedChunks(semantic.matches, documents);
        if (semanticChunks.length > 0 && (semanticChunks[0]?.score ?? 0) >= 0.62) {
          retrieved = semanticChunks;
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug('Tutor semantic retrieval unavailable; using keyword retrieval.', error);
        }
      }
    }

    if (retrieved.length === 0) {
      retrieved = retrieveChunks(query, chunks, documents, { topK: 7, minScore: 1.7 });
    }

    return retrieved;
  }

  async function startLesson(nextTopic = topic || suggestedTopic) {
    const cleanTopic = nextTopic.trim();
    if (!hasReadableSources) {
      setStatus('Upload a readable source before starting a source-grounded lesson.');
      return;
    }
    if (!cleanTopic) {
      setStatus(hasReadableSources ? 'Choose a topic before starting a lesson.' : 'Upload a readable source before starting a source-grounded lesson.');
      return;
    }

    setIsLoading(true);
    setStatus(`Reading your sources for ${cleanTopic}…`);

    try {
      const retrieved = await retrieveForTutor(`${cleanTopic} explanation checkpoint active recall`);
      setStatus('Building a structured lesson…');
      const response = await generateTutorContent<TutorLessonResponse>({
        action: 'lesson',
        topic: cleanTopic,
        difficulty,
        documents: buildTutorContext(retrieved),
        history: tutorMemory,
      });
      const lesson = normalizeLesson(response, workspaceId, cleanTopic, buildCitations(retrieved));

      setState((current) => ({
        ...current,
        tutorLessons: [lesson, ...current.tutorLessons.filter((item) => item.id !== lesson.id)],
      }));
      setCurrentLessonId(lesson.id);
      setTopic(lesson.topic);
      setView('lesson');
      setStatus('Lesson ready. Try each checkpoint before revealing the answer.');
    } catch (error) {
      setStatus('Tutor could not create this lesson. Try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function revealCheckpoint(questionId: string, recordedAnswer?: string) {
    if (!checkpointAnswers[questionId]?.trim() && !recordedAnswer?.trim()) {
      setStatus('Attempt the checkpoint first, then reveal the answer.');
      return;
    }

    setRevealedAnswers((current) => ({ ...current, [questionId]: true }));
  }

  function recordCheckpoint(lesson: TutorLesson, questionId: string, answer: string) {
    const question = lesson.checkpointQuestions.find((item) => item.id === questionId);
    if (!question || !answer.trim()) return;

    const answerTerms = question.answer.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
    const correct = answerTerms.some((term) => answer.toLowerCase().includes(term));
    const attempt: TutorAttempt = {
      id: `tutor-attempt-${Date.now()}-${questionId}`,
      workspaceId,
      lessonId: lesson.id,
      mode: 'lesson',
      topic: lesson.topic,
      prompt: question.prompt,
      answer,
      feedback: correct ? 'Good recall. Your answer overlaps with the expected idea.' : 'Partial recall. Compare your answer with the revealed explanation.',
      correct,
      createdAt: new Date().toISOString(),
    };

    setState((current) => ({
      ...current,
      tutorAttempts: [attempt, ...current.tutorAttempts],
      tutorMemory: updateMemory(current.tutorMemory, lesson.topic, correct, false),
    }));
    setStatus(correct ? 'Checkpoint recorded as confident recall.' : 'Checkpoint recorded. The tutor will keep this topic in rotation.');
  }

  function completeLesson(lesson: TutorLesson) {
    if (lesson.status === 'completed') {
      setStatus('This lesson is already complete. Start a new session to continue.');
      return;
    }

    const completed: TutorLesson = {
      ...lesson,
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setState((current) => ({
      ...current,
      tutorLessons: current.tutorLessons.map((item) => (item.id === lesson.id ? completed : item)),
      tutorMemory: updateMemory(current.tutorMemory, lesson.topic, true, true),
    }));
    setStatus('Lesson completed. Progress and revision streak updated.');
  }

  async function askSocratic(nextTopic = topic || suggestedTopic) {
    const cleanTopic = nextTopic.trim();
    if (!hasReadableSources) {
      setStatus('Upload a readable source before starting Socratic inquiry.');
      return;
    }
    if (!cleanTopic) {
      setStatus(hasReadableSources ? 'Choose a topic before Socratic mode.' : 'Upload a readable source before starting Socratic mode.');
      return;
    }

    setIsLoading(true);
    setStatus(`Reading your sources for a Socratic question on ${cleanTopic}…`);

    try {
      const retrieved = await retrieveForTutor(`${cleanTopic} misconception reasoning question`);
      const response = await generateTutorContent<TutorSocraticResponse>({
        action: 'socratic',
        topic: cleanTopic,
        difficulty,
        documents: buildTutorContext(retrieved),
        history: { tutorMemory, latestSocraticTurn },
        question: latestSocraticTurn?.question,
        answer: socraticAnswer,
      });
      const turn: TutorSocraticTurn = {
        id: `socratic-${Date.now()}`,
        workspaceId,
        topic: cleanTopic,
        question: response.followUp || response.question,
        studentAnswer: socraticAnswer || undefined,
        feedback: response.feedback || undefined,
        followUp: response.followUp || undefined,
        difficulty: normalizeDifficulty(response.difficulty),
        citations: buildCitations(retrieved),
        createdAt: new Date().toISOString(),
      };
      const attempt = socraticAnswer.trim()
        ? ({
            id: `tutor-attempt-${Date.now()}-socratic`,
            workspaceId,
            mode: 'socratic' as const,
            topic: cleanTopic,
            prompt: latestSocraticTurn?.question ?? response.question,
            answer: socraticAnswer,
            feedback: response.feedback || 'Socratic answer reviewed.',
            correct: !/not quite|incorrect|missing|partly/i.test(response.feedback),
            createdAt: new Date().toISOString(),
          } satisfies TutorAttempt)
        : null;

      setState((current) => ({
        ...current,
        tutorSocraticTurns: [turn, ...current.tutorSocraticTurns],
        tutorAttempts: attempt ? [attempt, ...current.tutorAttempts] : current.tutorAttempts,
        tutorMemory: attempt ? updateMemory(current.tutorMemory, cleanTopic, attempt.correct, false) : current.tutorMemory,
      }));
      setSocraticAnswer('');
      setTopic(cleanTopic);
      setView('socratic');
      setStatus('Socratic mode is ready. Answer the single question before asking for the next one.');
    } catch (error) {
      setStatus('Tutor could not prepare the next question. Try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function generateExam(nextTopic = topic || suggestedTopic) {
    const cleanTopic = nextTopic.trim();
    if (!hasReadableSources) {
      setStatus('Upload a readable source before generating exam practice.');
      return;
    }
    if (!cleanTopic) {
      setStatus(hasReadableSources ? 'Choose a topic before exam mode.' : 'Upload a readable source before generating exam questions.');
      return;
    }

    setIsLoading(true);
    setStatus(`Reading your sources to prepare exam questions on ${cleanTopic}…`);

    try {
      const retrieved = await retrieveForTutor(`${cleanTopic} exam question mark scheme`);
      const response = await generateTutorContent<TutorExamResponse>({
        action: 'exam',
        topic: cleanTopic,
        difficulty,
        documents: buildTutorContext(retrieved),
        history: tutorMemory,
      });
      const exam: TutorExamSession = {
        id: `tutor-exam-${Date.now()}`,
        workspaceId,
        topic: response.topic || cleanTopic,
        questions: (response.questions ?? []).slice(0, 4).map((question, index): TutorExamQuestion => ({
          id: `exam-question-${Date.now()}-${index}`,
          prompt: question.prompt,
          marks: Number.isFinite(question.marks) ? question.marks : 4,
          commandWord: question.commandWord || 'Explain',
          markScheme: question.markScheme || 'Award marks for accurate evidence, clear reasoning, and a direct answer.',
        })),
        citations: buildCitations(retrieved),
        createdAt: new Date().toISOString(),
      };

      setState((current) => ({
        ...current,
        tutorExamSessions: [exam, ...current.tutorExamSessions],
      }));
      setTopic(exam.topic);
      setExamAnswers({});
      setExamFeedback({});
      setView('exam');
      setStatus('Exam questions ready. Submit an answer to see marking feedback and mark scheme reasoning.');
    } catch (error) {
      setStatus('Tutor could not prepare these exam questions. Try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function markExamQuestion(exam: TutorExamSession, question: TutorExamQuestion) {
    const answer = examAnswers[question.id]?.trim();
    if (!answer) {
      setStatus('Write an answer before requesting marking.');
      return;
    }

    setIsLoading(true);
    setStatus('Reading your sources before marking the answer…');

    try {
      const retrieved = await retrieveForTutor(`${exam.topic} ${question.prompt} ${question.markScheme}`);
      const response = await generateTutorContent<TutorMarkResponse>({
        action: 'mark',
        topic: exam.topic,
        documents: buildTutorContext(retrieved),
        question: `${question.prompt}\nMarks: ${question.marks}\nMark scheme: ${question.markScheme}`,
        answer,
      });
      const boundedScore = Math.max(0, Math.min(question.marks, Math.round(response.score)));
      const feedback = {
        ...response,
        score: boundedScore,
        maxScore: question.marks,
        suggestedImprovements: Array.isArray(response.suggestedImprovements) ? response.suggestedImprovements : [],
      };
      const attempt: TutorAttempt = {
        id: `tutor-attempt-${Date.now()}-exam`,
        workspaceId,
        mode: 'exam',
        topic: exam.topic,
        prompt: question.prompt,
        answer,
        feedback: feedback.feedback,
        correct: boundedScore >= Math.ceil(question.marks * 0.6),
        createdAt: new Date().toISOString(),
      };

      setExamFeedback((current) => ({ ...current, [question.id]: feedback }));
      setState((current) => ({
        ...current,
        tutorAttempts: [attempt, ...current.tutorAttempts],
        tutorMemory: updateMemory(current.tutorMemory, exam.topic, attempt.correct, false),
      }));
      setStatus('Answer marked. Feedback and progress memory updated.');
    } catch (error) {
      setStatus('Tutor could not mark that answer. Try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteTutorSession(kind: 'lesson' | 'socratic' | 'exam', id: string) {
    try {
      if (storageStatus === 'connected') {
        await deleteSupabaseRows({
          tutor_lessons: kind === 'lesson' ? [id] : [],
          tutor_socratic_turns: kind === 'socratic' ? [id] : [],
          tutor_exam_sessions: kind === 'exam' ? [id] : [],
        }, { userId });
      }

      setState((current) => ({
        ...current,
        tutorLessons: kind === 'lesson' ? current.tutorLessons.filter((lesson) => lesson.id !== id) : current.tutorLessons,
        tutorSocraticTurns: kind === 'socratic' ? current.tutorSocraticTurns.filter((turn) => turn.id !== id) : current.tutorSocraticTurns,
        tutorExamSessions: kind === 'exam' ? current.tutorExamSessions.filter((exam) => exam.id !== id) : current.tutorExamSessions,
      }));
      setStatus('Tutor session deleted.');
    } catch (error) {
      setStatus('Tutor session was not deleted. Check your connection and try again.');
    }
  }

  async function clearTutorMemory() {
    try {
      if (storageStatus === 'connected') {
        await deleteSupabaseRows({
          tutor_memory: ['tutor-memory'],
          tutor_attempts: tutorAttempts.map((attempt) => attempt.id),
        }, { userId });
      }

      setState((current) => ({
        ...current,
        tutorAttempts: [],
        tutorMemory: {
          lessonsCompleted: 0,
          topicsStudied: [],
          revisionStreak: 0,
        },
      }));
      setStatus('Tutor memory was cleared. Lessons and exam sets were kept.');
    } catch (error) {
      setStatus('Tutor memory was not cleared. Check your connection and try again.');
    }
  }

  function prepareSelectedMode() {
    if (view === 'home' || view === 'lesson') {
      startLesson();
    } else if (view === 'socratic') {
      askSocratic();
    } else if (view === 'exam') {
      generateExam();
    }
  }

  return (
    <div className="tutor-page">
      <header className="tutor-toolbar">
        <div className="tutor-toolbar__identity">
          <p>Tutor</p>
          <h2>{view === 'lesson' && currentLesson ? currentLesson.topic : view === 'socratic' && latestSocraticTurn ? latestSocraticTurn.topic : view === 'exam' && latestExam ? latestExam.topic : selectedMode.label}</h2>
          <span>{readableSourceCount} source{readableSourceCount === 1 ? '' : 's'} ready</span>
        </div>
        <div className="tutor-toolbar__actions">
          <nav className="tutor-mode-switch" aria-label="Tutor mode">
            {tutorModes.map((mode) => (
              <button
                key={mode.view}
                type="button"
                onClick={() => setView(mode.view)}
                aria-pressed={mode.view === view}
                className={mode.view === view ? 'is-active' : ''}
              >
                {mode.shortLabel}
              </button>
            ))}
          </nav>
          <label className="tutor-mode-select">
            <span>Tutor mode</span>
            <select value={view} onChange={(event) => setView(event.target.value as TutorView)}>
              {tutorModes.map((mode) => <option key={mode.view} value={mode.view}>{mode.label}</option>)}
            </select>
          </label>
          {hasReadableSources || hasTutorHistory ? (
            <button
              type="button"
              className="tutor-new-session-trigger"
              aria-label={setupOpen ? 'Close new session setup' : 'New session'}
              aria-controls="tutor-session-setup"
              aria-expanded={setupOpen}
              onClick={() => setSetupOpen((current) => !current)}
            >
              <span className="tutor-new-session-trigger__long">{setupOpen ? 'Close setup' : 'New session'}</span>
              <span className="tutor-new-session-trigger__short">{setupOpen ? 'Close' : 'New'}</span>
            </button>
          ) : null}
        </div>
      </header>

      {isLoading || status !== idleStatus ? (
        <div role="status" aria-live="polite" className="tutor-thinking status-enter">
          {isLoading ? <span className="tutor-thinking__indicator" aria-hidden="true"><i /><i /><i /></span> : null}
          <p>{status}</p>
        </div>
      ) : null}

      {hasTutorHistory ? <details className="surface-raised order-last p-5 sm:p-6">
        <summary className="flex min-h-10 cursor-pointer items-center text-sm font-semibold text-ink">Manage tutor history</summary>
        <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/80">Saved sessions</p>
            <h3 className="mt-2 font-sans text-lg font-semibold text-ink">Sessions and learning memory</h3>
          </div>
          <button
            type="button"
            onClick={() =>
              setConfirmAction({
                title: 'Clear Tutor memory?',
                body: 'This clears recall attempts, topic confidence, revision streak, and Tutor memory. Existing lesson and exam session content is kept.',
                confirmLabel: 'Clear memory',
                onConfirm: clearTutorMemory,
              })
            }
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-graphite/80 hover:bg-brass/10 hover:text-brass"
          >
            <Trash2 size={14} />
            Clear memory
          </button>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {tutorLessons.slice(0, 3).map((lesson) => (
            <TutorDataCard
              key={lesson.id}
              title={lesson.topic}
              detail={lesson.objective}
              onDelete={() =>
                setConfirmAction({
                  title: `Delete lesson on ${lesson.topic}?`,
                  body: 'This deletes the saved Tutor lesson. Tutor memory and attempts are kept unless cleared separately.',
                  confirmLabel: 'Delete lesson',
                  onConfirm: () => deleteTutorSession('lesson', lesson.id),
                })
              }
            />
          ))}
          {tutorSocraticTurns.slice(0, 2).map((turn) => (
            <TutorDataCard
              key={turn.id}
              title={turn.topic}
              detail={turn.question}
              onDelete={() =>
                setConfirmAction({
                  title: `Delete Socratic session on ${turn.topic}?`,
                  body: 'This deletes the saved Socratic turn. Tutor memory and attempts are kept unless cleared separately.',
                  confirmLabel: 'Delete session',
                  onConfirm: () => deleteTutorSession('socratic', turn.id),
                })
              }
            />
          ))}
          {tutorExamSessions.slice(0, 2).map((exam) => (
            <TutorDataCard
              key={exam.id}
              title={exam.topic}
              detail={`${exam.questions.length} exam question${exam.questions.length === 1 ? '' : 's'}`}
              onDelete={() =>
                setConfirmAction({
                  title: `Delete exam set on ${exam.topic}?`,
                  body: 'This deletes the saved Tutor exam session. Marking attempts are kept unless memory is cleared separately.',
                  confirmLabel: 'Delete exam set',
                  onConfirm: () => deleteTutorSession('exam', exam.id),
                })
              }
            />
          ))}
        </div>
      </details> : null}

      {hasReadableSources || hasTutorHistory ? (
        <section id="tutor-session-setup" className="tutor-new-session" hidden={!setupOpen} aria-label="New Tutor session">
          <div className="tutor-new-session__body">
            <div className="tutor-new-session__fields">
              <label>
                Focus topic
                <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={suggestedTopic || 'Topic to study'} />
              </label>
              <label>
                Level
                <select value={difficulty} onChange={(event) => setDifficulty(normalizeDifficulty(event.target.value))}>
                  <option>Foundation</option>
                  <option>Core</option>
                  <option>Stretch</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                setSetupOpen(false);
                prepareSelectedMode();
              }}
              disabled={isLoading || !hasReadableSources}
              className="tutor-new-session__action"
            >
              {view === 'home' || view === 'lesson' ? 'Prepare guided lesson' : view === 'socratic' ? 'Begin Socratic inquiry' : 'Prepare exam practice'}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      <div ref={modeContentRef} className="tutor-mode-content" tabIndex={-1}>
      {view === 'home' ? (
        <TutorHome
          activeLesson={activeLesson}
          weakestTopic={weakestTopic}
          suggestedTopic={hasReadableSources ? suggestedTopic : ''}
          recentTopics={recentTopics}
          weakTopics={hasReadableSources ? weakTopics : []}
          recommendedTopics={hasReadableSources ? recommendedTopics : []}
          tutorMemory={tutorMemory}
          tutorAttempts={tutorAttempts}
          hasReadableSources={hasReadableSources}
          onContinue={() => {
            if (activeLesson) {
              setCurrentLessonId(activeLesson.id);
              setView('lesson');
            } else if (!suggestedTopic) {
              setStatus(hasReadableSources ? 'Type a topic to start a lesson.' : 'Upload a readable source before starting a lesson.');
            } else {
              startLesson(suggestedTopic);
            }
          }}
          onStartTopic={(nextTopic) => {
            setTopic(nextTopic);
            startLesson(nextTopic);
          }}
        />
      ) : null}

      {view === 'lesson' ? (
        currentLesson ? (
          <LessonView
            lesson={currentLesson}
            attempts={tutorAttempts}
            checkpointAnswers={checkpointAnswers}
            revealedAnswers={revealedAnswers}
            onAnswerChange={(id, value) => setCheckpointAnswers((current) => ({ ...current, [id]: value }))}
            onReveal={revealCheckpoint}
            onRecord={recordCheckpoint}
            onComplete={completeLesson}
            onNext={(nextTopic) => {
              setTopic(nextTopic);
              startLesson(nextTopic);
            }}
          />
        ) : (
          <EmptyPanel title="No lesson yet" copy="Start a new lesson from a recommended topic or your own topic." />
        )
      ) : null}

      {view === 'socratic' ? (
        <SocraticView
          turn={latestSocraticTurn}
          answer={socraticAnswer}
          setAnswer={setSocraticAnswer}
          onNext={() => askSocratic()}
          disabled={isLoading}
        />
      ) : null}

      {view === 'exam' ? (
        latestExam ? (
          <ExamView
            exam={latestExam}
            answers={examAnswers}
            feedback={examFeedback}
            onAnswerChange={(id, value) => setExamAnswers((current) => ({ ...current, [id]: value }))}
            onMark={markExamQuestion}
            disabled={isLoading}
          />
        ) : (
          <EmptyPanel title="Generate exam practice" copy="Create exam-style questions from uploaded documents." />
        )
      ) : null}
      </div>
      <TutorConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
    </div>
  );
}

function TutorDataCard({ title, detail, onDelete }: { title: string; detail: string; onDelete: () => void }) {
  return (
    <article className="rounded-lg border border-ink/10 bg-paper/65 p-4">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-graphite/80">{detail}</p>
      <button type="button" onClick={onDelete} className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-graphite/80 hover:bg-brass/10 hover:text-brass">
        <Trash2 size={14} />
        Delete
      </button>
    </article>
  );
}

function TutorConfirmModal({
  action,
  onClose,
}: {
  action: { title: string; body: string; confirmLabel: string; onConfirm: () => Promise<void> | void } | null;
  onClose: () => void;
}) {
  const [isWorking, setIsWorking] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const isWorkingRef = useRef(isWorking);
  const onCloseRef = useRef(onClose);
  isWorkingRef.current = isWorking;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!action) return;

    const restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => (cancelButtonRef.current ?? dialogRef.current)?.focus());
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isWorkingRef.current) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const controls = dialogRef.current
        ? Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        : [];
      if (controls.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleDialogKeys);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleDialogKeys);
      if (restoreTarget && document.contains(restoreTarget)) restoreTarget.focus();
    };
  }, [action]);

  if (!action) return null;

  async function confirm() {
    if (!action) return;
    setIsWorking(true);
    try {
      await action.onConfirm();
      onClose();
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/35 px-4">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tutor-dialog-title" aria-describedby="tutor-dialog-body" className="dialog-panel w-full max-w-lg rounded-xl border border-ink/10 bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass">Confirm destructive action</p>
        <h2 id="tutor-dialog-title" className="mt-3 font-sans text-xl font-semibold text-ink">{action.title}</h2>
        <p id="tutor-dialog-body" className="mt-3 text-sm leading-7 text-graphite/80">{action.body}</p>
        <div className="mt-6 grid gap-2 sm:flex sm:justify-end">
          <button ref={cancelButtonRef} type="button" onClick={onClose} disabled={isWorking} className="min-h-10 rounded-lg border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-paper/50">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={isWorking} className="min-h-10 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:bg-brass/45">
            {isWorking ? 'Working…' : action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function TutorHome({
  activeLesson,
  weakestTopic,
  suggestedTopic,
  recentTopics,
  weakTopics,
  recommendedTopics,
  tutorMemory,
  tutorAttempts,
  hasReadableSources,
  onContinue,
  onStartTopic,
}: {
  activeLesson?: TutorLesson;
  weakestTopic: string;
  suggestedTopic: string;
  recentTopics: TutorMemoryTopic[];
  weakTopics: string[];
  recommendedTopics: string[];
  tutorMemory: TutorMemory;
  tutorAttempts: TutorAttempt[];
  hasReadableSources: boolean;
  onContinue: () => void;
  onStartTopic: (topic: string) => void;
}) {
  const latestAttempt = tutorAttempts[0];

  return (
    <div className="tutor-overview">
      <section className="tutor-overview__opening">
        <div className="tutor-overview__focus">
          <p className="tutor-overview__eyebrow">Continue learning</p>
          <h3>{activeLesson?.topic || suggestedTopic || 'Build a lesson from your sources'}</h3>
          <p>
            {activeLesson
              ? activeLesson.objective
              : hasReadableSources
                ? 'Tutor will read your sources, teach the topic, and test recall before showing answers.'
                : 'Upload a source first. Tutor needs real material before it can teach.'}
          </p>
          {activeLesson || hasReadableSources ? <button
            type="button"
            onClick={onContinue}
            className="tutor-overview__continue"
          >
            {activeLesson ? 'Continue previous lesson' : 'Start suggested lesson'}
            <ArrowRight size={17} />
          </button> : null}
        </div>
        {hasReadableSources || tutorMemory.lessonsCompleted > 0 || tutorMemory.revisionStreak > 0 ? <div className="tutor-overview__metrics">
          <TutorMetric icon={Target} label="Weakest topic" value={weakestTopic} />
          <TutorMetric icon={Flame} label="Revision streak" value={`${tutorMemory.revisionStreak} day${tutorMemory.revisionStreak === 1 ? '' : 's'}`} />
          <TutorMetric icon={CheckCircle2} label="Lessons completed" value={tutorMemory.lessonsCompleted.toLocaleString()} />
        </div> : null}
      </section>

      {hasReadableSources || recentTopics.length ? <section className="tutor-overview__topics">
        <TopicPanel title="Recommended topics" icon={Sparkles} topics={recommendedTopics} onStartTopic={onStartTopic} emptyCopy="Upload readable documents to create source-grounded recommendations." />
        <TopicPanel title="Weak topics from Performance" icon={Lightbulb} topics={weakTopics} onStartTopic={onStartTopic} emptyCopy={hasReadableSources ? 'Performance weaknesses will appear here.' : 'Upload readable source material before turning performance weaknesses into lessons.'} />
        <div className="tutor-topic-panel">
          <div className="tutor-topic-panel__heading">
            <RotateCcw size={15} />
            Recently studied
          </div>
          <div className="tutor-topic-panel__list">
            {recentTopics.length ? (
              recentTopics.map((topic) => (
                <button key={topic.topic} type="button" onClick={() => onStartTopic(topic.topic)} className="tutor-topic-panel__row">
                  <div>
                    <p className="font-semibold text-ink">{topic.topic}</p>
                    <ArrowRight size={16} className="text-graphite/80" />
                  </div>
                </button>
              ))
            ) : (
              <p className="tutor-topic-panel__empty">Recent progress appears after the first recall attempt.</p>
            )}
          </div>
          {latestAttempt ? <p className="tutor-topic-panel__progress">Recent progress: {latestAttempt.feedback}</p> : null}
        </div>
      </section> : null}
    </div>
  );
}

function TutorMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="tutor-metric">
      <div className="tutor-metric__label">
        <Icon size={15} />
        {label}
      </div>
      <p>{value}</p>
    </div>
  );
}

function TopicPanel({
  title,
  icon: Icon,
  topics,
  emptyCopy,
  onStartTopic,
}: {
  title: string;
  icon: LucideIcon;
  topics: string[];
  emptyCopy: string;
  onStartTopic: (topic: string) => void;
}) {
  return (
    <div className="tutor-topic-panel">
      <div className="tutor-topic-panel__heading">
        <Icon size={15} />
        {title}
      </div>
      <div className="tutor-topic-panel__list">
        {topics.length ? (
          topics.map((topic) => (
            <button key={topic} type="button" onClick={() => onStartTopic(topic)} className="tutor-topic-panel__row">
              <span>{topic}</span>
              <ArrowRight size={16} />
            </button>
          ))
        ) : (
          <p className="tutor-topic-panel__empty">{emptyCopy}</p>
        )}
      </div>
    </div>
  );
}

function TutorEvidenceDisclosure({
  citations,
  contextLabel,
  contextValue,
}: {
  citations: Citation[];
  contextLabel: string;
  contextValue: string;
}) {
  return (
    <details className="tutor-evidence-disclosure">
      <summary>
        <span>Session evidence</span>
        <small>{citations.length} source{citations.length === 1 ? '' : 's'}</small>
      </summary>
      <div className="tutor-evidence-disclosure__body">
        <div className="tutor-evidence-disclosure__context">
          <span>{contextLabel}</span>
          <p>{contextValue}</p>
        </div>
        {citations.map((citation, index) => <CitationCard key={`${citation.documentTitle}-${citation.location}`} citation={citation} index={index + 1} />)}
      </div>
    </details>
  );
}

function LessonView({
  lesson,
  attempts,
  checkpointAnswers,
  revealedAnswers,
  onAnswerChange,
  onReveal,
  onRecord,
  onComplete,
  onNext,
}: {
  lesson: TutorLesson;
  attempts: TutorAttempt[];
  checkpointAnswers: Record<string, string>;
  revealedAnswers: Record<string, boolean>;
  onAnswerChange: (id: string, value: string) => void;
  onReveal: (id: string, recordedAnswer?: string) => void;
  onRecord: (lesson: TutorLesson, questionId: string, answer: string) => void;
  onComplete: (lesson: TutorLesson) => void;
  onNext: (topic: string) => void;
}) {
  const recordedQuestionIds = new Set(
    attempts
      .filter((attempt) => attempt.lessonId === lesson.id)
      .map((attempt) => lesson.checkpointQuestions.find((question) => question.prompt === attempt.prompt)?.id)
      .filter(Boolean),
  );
  const completedCheckpoints = recordedQuestionIds.size;
  const activeQuestionId = lesson.checkpointQuestions.find((question) => !recordedQuestionIds.has(question.id))?.id ?? lesson.checkpointQuestions[0]?.id;
  const progress = lesson.checkpointQuestions.length ? Math.round((completedCheckpoints / lesson.checkpointQuestions.length) * 100) : 0;

  return (
    <div className="tutor-session tutor-session--lesson">
      <TutorEvidenceDisclosure citations={lesson.citations} contextLabel="Next recommendation" contextValue={lesson.nextRecommendation} />
      <section className="tutor-session__document">
        <header className="tutor-session__header">
          <div className="tutor-session__progress-label">
            <span>Guided lesson</span>
            <span>{completedCheckpoints} of {lesson.checkpointQuestions.length} checkpoints recorded</span>
          </div>
          <h3>{lesson.objective}</h3>
          <div className="tutor-session__metadata">
            <span><BookMarked size={15} aria-hidden="true" /> {lesson.estimatedDuration}</span>
            <span><GraduationCap size={15} aria-hidden="true" /> {lesson.difficulty}</span>
          </div>
          <div className="tutor-session__progress" role="progressbar" aria-label="Lesson checkpoint progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </header>

        <section className="tutor-session__section tutor-session__explanation">
          <h4>Explanation</h4>
          <p>{lesson.explanation}</p>
        </section>

        <section className="tutor-session__section tutor-checkpoints">
          <div className="tutor-session__section-heading">
            <ClipboardCheck size={15} aria-hidden="true" />
            Active recall checkpoints
          </div>
          <div className="tutor-checkpoints__list">
            {lesson.checkpointQuestions.map((question, index) => {
              const latestAttempt = attempts.find((attempt) => attempt.lessonId === lesson.id && attempt.prompt === question.prompt);
              const isActive = question.id === activeQuestionId;

              return (
              <div key={question.id} className={`tutor-checkpoint ${isActive ? 'is-active' : ''} ${latestAttempt ? 'is-recorded' : ''}`}>
                <div className="tutor-checkpoint__prompt">
                  <div>
                    <span>Checkpoint {String(index + 1).padStart(2, '0')}</span>
                    <p>{question.prompt}</p>
                  </div>
                  <span>{latestAttempt ? 'Recorded' : question.difficulty}</span>
                </div>
                <textarea
                  aria-label={`Answer: ${question.prompt}`}
                  value={checkpointAnswers[question.id] ?? latestAttempt?.answer ?? ''}
                  onChange={(event) => onAnswerChange(question.id, event.target.value)}
                  rows={3}
                  placeholder="Attempt from memory before revealing the answer."
                  className="tutor-writing-field"
                />
                {latestAttempt ? (
                  <div className={`tutor-checkpoint__feedback ${latestAttempt.correct ? 'is-correct' : ''}`}>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <div>
                      <strong>Feedback</strong>
                      <p>{latestAttempt.feedback}</p>
                    </div>
                  </div>
                ) : null}
                <div className="tutor-checkpoint__actions">
                  <button type="button" disabled={!checkpointAnswers[question.id]?.trim()} onClick={() => onRecord(lesson, question.id, checkpointAnswers[question.id] ?? '')} className="tutor-action tutor-action--primary">
                    Record attempt
                  </button>
                  <button type="button" onClick={() => onReveal(question.id, latestAttempt?.answer)} className="tutor-action">
                    Reveal answer
                  </button>
                </div>
                {revealedAnswers[question.id] ? (
                  <div className="tutor-checkpoint__answer">
                    <p>{question.answer}</p>
                    <p>{question.explanation}</p>
                  </div>
                ) : null}
              </div>
              );
            })}
          </div>
        </section>

        <section className="tutor-session__section tutor-session__recap">
          <h4>Recap</h4>
          <p>{lesson.recap}</p>
          <div className="tutor-session__recap-actions">
            <button type="button" onClick={() => onComplete(lesson)} disabled={lesson.status === 'completed'} className="tutor-action tutor-action--primary">
              {lesson.status === 'completed' ? 'Lesson complete' : 'Mark lesson complete'}
            </button>
            <button type="button" onClick={() => onNext(lesson.nextRecommendation)} className="tutor-action">
              Study next recommendation
            </button>
          </div>
        </section>
      </section>

      <aside className="tutor-reference-stack">
        <div className="tutor-reference-stack__next">
          <p>Next recommendation</p>
          <p>{lesson.nextRecommendation}</p>
        </div>
        {lesson.citations.length ? lesson.citations.map((citation, index) => <CitationCard key={`${citation.documentTitle}-${citation.location}`} citation={citation} index={index + 1} />) : null}
      </aside>
    </div>
  );
}

function SocraticView({
  turn,
  answer,
  setAnswer,
  onNext,
  disabled,
}: {
  turn?: TutorSocraticTurn;
  answer: string;
  setAnswer: (answer: string) => void;
  onNext: () => void;
  disabled: boolean;
}) {
  if (!turn) {
    return <EmptyPanel title="No Socratic question yet" copy="Start Socratic mode to receive one adaptive question at a time." />;
  }

  return (
    <div className="tutor-session tutor-session--socratic">
      <TutorEvidenceDisclosure citations={turn.citations} contextLabel="Difficulty" contextValue={turn.difficulty} />
      <section className="tutor-session__document tutor-socratic-paper">
        <div className="tutor-session__section-heading">
          <MessageCircleQuestion size={15} />
          One question at a time
        </div>
        {turn.feedback ? <p className="tutor-socratic-paper__feedback">{turn.feedback}</p> : null}
        <h3>{turn.question}</h3>
        <textarea
          aria-label={`Answer: ${turn.question}`}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          rows={6}
          placeholder="Answer before requesting the next follow-up."
          className="tutor-writing-field"
        />
        <button type="button" onClick={onNext} disabled={disabled} className="tutor-action tutor-action--primary">
          Submit and adapt
        </button>
      </section>
      <aside className="tutor-reference-stack">
        <TutorMetric icon={GraduationCap} label="Difficulty" value={turn.difficulty} />
        {turn.citations.map((citation, index) => <CitationCard key={`${citation.documentTitle}-${citation.location}`} citation={citation} index={index + 1} />)}
      </aside>
    </div>
  );
}

function ExamView({
  exam,
  answers,
  feedback,
  onAnswerChange,
  onMark,
  disabled,
}: {
  exam: TutorExamSession;
  answers: Record<string, string>;
  feedback: Record<string, TutorMarkResponse>;
  onAnswerChange: (id: string, value: string) => void;
  onMark: (exam: TutorExamSession, question: TutorExamQuestion) => void;
  disabled: boolean;
}) {
  return (
    <div className="tutor-session tutor-session--exam">
      <TutorEvidenceDisclosure citations={exam.citations} contextLabel="Exam topic" contextValue={exam.topic} />
      <section className="tutor-session__document tutor-exam-paper">
        <header className="tutor-exam-paper__header">
          <p className="tutor-session__eyebrow">Exam practice</p>
          <h3>{exam.topic}</h3>
          <p>{exam.questions.length} question{exam.questions.length === 1 ? '' : 's'} · answers are marked against source-grounded schemes.</p>
        </header>
        {exam.questions.map((question, index) => {
          const marked = feedback[question.id];

          return (
            <article key={question.id} className="tutor-exam-question">
              <div className="tutor-exam-question__metadata">
                <span>Question {index + 1}</span>
                <span>/</span>
                <span>{question.commandWord}</span>
                <span>/</span>
                <span>{question.marks} marks</span>
              </div>
              <h4>{question.prompt}</h4>
              <details className="tutor-exam-question__scheme">
                <summary>View mark scheme</summary>
                <p>{question.markScheme}</p>
              </details>
              <textarea
                aria-label={`Exam answer: ${question.prompt}`}
                value={answers[question.id] ?? ''}
                onChange={(event) => onAnswerChange(question.id, event.target.value)}
                rows={5}
                placeholder="Write an exam-style answer."
                className="tutor-writing-field"
              />
              <button type="button" onClick={() => onMark(exam, question)} disabled={disabled} className="tutor-action tutor-action--primary">
                Mark answer
              </button>
              {marked ? (
                <div className="tutor-exam-question__feedback">
                  <p className="tutor-exam-question__score">
                    {marked.score}/{marked.maxScore}
                  </p>
                  <p>{marked.feedback}</p>
                  <p className="tutor-feedback__label">Mark scheme reasoning</p>
                  <p>{marked.markSchemeReasoning}</p>
                  <p className="tutor-feedback__label">Suggested improvements</p>
                  <ul>
                    {marked.suggestedImprovements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="tutor-feedback__label">Model answer</p>
                  <p>{marked.modelAnswer}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
      <aside className="tutor-reference-stack">
        <TutorMetric icon={ClipboardCheck} label="Exam topic" value={exam.topic} />
        {exam.citations.map((citation, index) => <CitationCard key={`${citation.documentTitle}-${citation.location}`} citation={citation} index={index + 1} />)}
      </aside>
    </div>
  );
}

function EmptyPanel({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <p className="font-sans text-2xl font-semibold leading-tight text-ink sm:text-[1.75rem]">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-graphite/80">{copy}</p>
    </div>
  );
}
