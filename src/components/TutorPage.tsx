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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useMemo, useState } from 'react';
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
import { SectionHeader } from './SectionHeader';
import { getDocumentMetadata } from '../utils/learningModel';

type TutorView = 'home' | 'lesson' | 'socratic' | 'exam';

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
  const metadataTopics = documents
    .flatMap((document) => {
      const metadata = getDocumentMetadata(document, records);
      return [...metadata.topics, ...metadata.skills, ...metadata.subjects];
    })
    .filter((topic) => !/upload|failed/i.test(topic));
  const staleTopics = memory.topicsStudied
    .filter((topic) => {
      const daysSinceReview = Math.floor((Date.now() - new Date(topic.lastReviewed).getTime()) / 86_400_000);
      return topic.confidence < 70 || daysSinceReview >= 14;
    })
    .map((topic) => topic.topic);

  return [...new Set([...weakTopics, ...staleTopics, ...metadataTopics].map((topic) => topic.trim()).filter(Boolean))].slice(0, 8);
}

function formatChunkLocation(result: RetrievedChunk) {
  if (result.pageStart && result.pageEnd) {
    return result.pageStart === result.pageEnd ? `p. ${result.pageStart}` : `pp. ${result.pageStart}-${result.pageEnd}`;
  }

  return `chunk ${result.chunk.chunkIndex + 1}`;
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
  setState,
}: TutorPageProps) {
  const weakTopics = useMemo(() => getWeakTopics(performanceRecords, performanceSummaries, tutorMemory), [performanceRecords, performanceSummaries, tutorMemory]);
  const recommendedTopics = useMemo(() => getRecommendedTopics(documents, weakTopics, performanceRecords, tutorMemory), [documents, weakTopics, performanceRecords, tutorMemory]);
  const hasReadableSources = documents.some((document) => document.extractedText?.trim() && document.status !== 'Failed');
  const recentTopics = tutorMemory.topicsStudied.slice(0, 5);
  const activeLesson = tutorLessons.find((lesson) => lesson.workspaceId === workspaceId && lesson.status === 'in_progress') ?? tutorLessons.find((lesson) => lesson.workspaceId === workspaceId);
  const latestExam = tutorExamSessions.find((exam) => exam.workspaceId === workspaceId);
  const weakestTopic = weakTopics[0] ?? [...tutorMemory.topicsStudied].sort((a, b) => a.confidence - b.confidence)[0]?.topic ?? recommendedTopics[0] ?? 'Upload a source';
  const suggestedTopic = recommendedTopics[0] ?? activeLesson?.topic ?? '';
  const [view, setView] = useState<TutorView>('home');
  const [topic, setTopic] = useState(suggestedTopic);
  const [difficulty, setDifficulty] = useState<TutorDifficulty>('Core');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Tutor uses retrieved source chunks before teaching or questioning.');
  const [currentLessonId, setCurrentLessonId] = useState(activeLesson?.id ?? '');
  const [checkpointAnswers, setCheckpointAnswers] = useState<Record<string, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [socraticAnswer, setSocraticAnswer] = useState('');
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [examFeedback, setExamFeedback] = useState<Record<string, TutorMarkResponse>>({});

  const currentLesson = tutorLessons.find((lesson) => lesson.id === currentLessonId) ?? activeLesson;
  const latestSocraticTurn = tutorSocraticTurns.find((turn) => turn.workspaceId === workspaceId);

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
    if (!cleanTopic) {
      setStatus(hasReadableSources ? 'Choose a topic before starting a lesson.' : 'Upload a readable source before starting a source-grounded lesson.');
      return;
    }

    setIsLoading(true);
    setStatus(`Retrieving source context for ${cleanTopic}...`);

    try {
      const retrieved = await retrieveForTutor(`${cleanTopic} explanation checkpoint active recall`);
      setStatus('Generating a structured lesson from retrieved evidence...');
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
      setStatus(error instanceof Error ? error.message : 'AI Tutor could not create a lesson right now.');
    } finally {
      setIsLoading(false);
    }
  }

  function revealCheckpoint(questionId: string) {
    if (!checkpointAnswers[questionId]?.trim()) {
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
    if (!cleanTopic) {
      setStatus(hasReadableSources ? 'Choose a topic before Socratic mode.' : 'Upload a readable source before starting Socratic mode.');
      return;
    }

    setIsLoading(true);
    setStatus(`Retrieving source context for a Socratic question on ${cleanTopic}...`);

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
      setStatus(error instanceof Error ? error.message : 'AI Tutor could not continue Socratic mode.');
    } finally {
      setIsLoading(false);
    }
  }

  async function generateExam(nextTopic = topic || suggestedTopic) {
    const cleanTopic = nextTopic.trim();
    if (!cleanTopic) {
      setStatus(hasReadableSources ? 'Choose a topic before exam mode.' : 'Upload a readable source before generating exam questions.');
      return;
    }

    setIsLoading(true);
    setStatus(`Retrieving source context for exam questions on ${cleanTopic}...`);

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
      setStatus(error instanceof Error ? error.message : 'AI Tutor could not generate exam questions.');
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
    setStatus('Retrieving evidence again before marking the answer...');

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
      setStatus(error instanceof Error ? error.message : 'AI Tutor could not mark that answer.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <SectionHeader
        eyebrow="AI Tutor"
        title="Tutor"
        copy="Lessons, active recall, Socratic questioning, and exam practice grounded in retrieved source chunks."
      />

      <div className="rounded-2xl border border-ink/8 bg-white p-4 shadow-sm">
        <p className="text-sm leading-7 text-graphite/74">{isLoading ? 'Working with retrieved context...' : status}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder={suggestedTopic || 'Topic to study'}
            className="min-w-0 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 transition focus:ring-4"
          />
          <select
            value={difficulty}
            onChange={(event) => setDifficulty(normalizeDifficulty(event.target.value))}
            className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 transition focus:ring-4"
          >
            <option>Foundation</option>
            <option>Core</option>
            <option>Stretch</option>
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => startLesson()} disabled={isLoading} className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-graphite/55">
            Lesson
          </button>
          <button type="button" onClick={() => askSocratic()} disabled={isLoading} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm disabled:cursor-not-allowed disabled:text-graphite/45">
            Socratic
          </button>
          <button type="button" onClick={() => generateExam()} disabled={isLoading} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm disabled:cursor-not-allowed disabled:text-graphite/45">
            Exam
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['home', 'lesson', 'socratic', 'exam'] as TutorView[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setView(item)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${view === item ? 'bg-ink text-white' : 'bg-white text-graphite ring-1 ring-ink/8'}`}
          >
            {item}
          </button>
        ))}
      </div>

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
          <EmptyPanel title="No exam set yet" copy="Generate exam-style questions from uploaded documents." />
        )
      ) : null}
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
    <div className="space-y-7">
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-ink/8 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">
            <GraduationCap size={15} />
            Continue learning
          </div>
          <h3 className="mt-4 font-serif text-4xl font-semibold text-ink">{activeLesson?.topic ?? suggestedTopic ?? 'Build a lesson from your sources'}</h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-graphite/72">
            {activeLesson
              ? activeLesson.objective
              : hasReadableSources
                ? 'Tutor will retrieve source chunks, teach the topic, and test recall before showing answers.'
                : 'Upload a readable TXT, PDF, or DOCX source first. Tutor needs extracted chunks before it can teach from your material.'}
          </p>
          <button
            type="button"
            onClick={onContinue}
            disabled={!activeLesson && !hasReadableSources}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-graphite/55"
          >
            {activeLesson ? 'Continue previous lesson' : hasReadableSources ? 'Start suggested lesson' : 'Upload sources first'}
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <TutorMetric icon={Target} label="Weakest topic" value={weakestTopic} />
          <TutorMetric icon={Flame} label="Revision streak" value={`${tutorMemory.revisionStreak} day${tutorMemory.revisionStreak === 1 ? '' : 's'}`} />
          <TutorMetric icon={CheckCircle2} label="Lessons completed" value={tutorMemory.lessonsCompleted.toLocaleString()} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <TopicPanel title="Recommended topics" icon={Sparkles} topics={recommendedTopics} onStartTopic={onStartTopic} emptyCopy="Upload readable documents to create source-grounded recommendations." />
        <TopicPanel title="Weak topics from Performance" icon={Lightbulb} topics={weakTopics} onStartTopic={onStartTopic} emptyCopy={hasReadableSources ? 'Performance weaknesses will appear here.' : 'Upload readable source material before turning performance weaknesses into lessons.'} />
        <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">
            <RotateCcw size={15} />
            Recently studied
          </div>
          <div className="mt-5 space-y-3">
            {recentTopics.length ? (
              recentTopics.map((topic) => (
                <button key={topic.topic} type="button" onClick={() => onStartTopic(topic.topic)} className="w-full rounded-xl border border-ink/8 bg-paper/65 p-4 text-left transition hover:border-ink/14">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{topic.topic}</p>
                    <span className="text-sm font-semibold text-graphite/70">{topic.confidence}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-moss" style={{ width: `${topic.confidence}%` }} />
                  </div>
                </button>
              ))
            ) : (
              <p className="rounded-xl bg-paper/70 p-4 text-sm leading-7 text-graphite/70">Recent progress appears after the first recall attempt.</p>
            )}
          </div>
          {latestAttempt ? <p className="mt-4 text-sm leading-7 text-graphite/70">Recent progress: {latestAttempt.feedback}</p> : null}
        </div>
      </section>
    </div>
  );
}

function TutorMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">
        <Icon size={15} />
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
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
    <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">
        <Icon size={15} />
        {title}
      </div>
      <div className="mt-5 space-y-2">
        {topics.length ? (
          topics.map((topic) => (
            <button key={topic} type="button" onClick={() => onStartTopic(topic)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-paper/70 px-4 py-3 text-left text-sm font-semibold text-ink transition hover:bg-paper">
              <span>{topic}</span>
              <ArrowRight size={16} />
            </button>
          ))
        ) : (
          <p className="rounded-xl bg-paper/70 p-4 text-sm leading-7 text-graphite/70">{emptyCopy}</p>
        )}
      </div>
    </div>
  );
}

function LessonView({
  lesson,
  checkpointAnswers,
  revealedAnswers,
  onAnswerChange,
  onReveal,
  onRecord,
  onComplete,
  onNext,
}: {
  lesson: TutorLesson;
  checkpointAnswers: Record<string, string>;
  revealedAnswers: Record<string, boolean>;
  onAnswerChange: (id: string, value: string) => void;
  onReveal: (id: string) => void;
  onRecord: (lesson: TutorLesson, questionId: string, answer: string) => void;
  onComplete: (lesson: TutorLesson) => void;
  onNext: (topic: string) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="space-y-6">
        <div className="rounded-2xl border border-ink/8 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-3">
            <TutorMetric icon={Target} label="Objective" value={lesson.objective} />
            <TutorMetric icon={BookMarked} label="Duration" value={lesson.estimatedDuration} />
            <TutorMetric icon={GraduationCap} label="Difficulty" value={lesson.difficulty} />
          </div>
          <div className="mt-6 border-t border-ink/8 pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Explanation</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-graphite/78">{lesson.explanation}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-ink/8 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">
            <ClipboardCheck size={15} />
            Active recall checkpoints
          </div>
          <div className="mt-5 space-y-5">
            {lesson.checkpointQuestions.map((question) => (
              <div key={question.id} className="rounded-2xl border border-ink/8 bg-paper/60 p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-semibold leading-7 text-ink">{question.prompt}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-graphite/70">{question.difficulty}</span>
                </div>
                <textarea
                  value={checkpointAnswers[question.id] ?? ''}
                  onChange={(event) => onAnswerChange(question.id, event.target.value)}
                  rows={3}
                  placeholder="Attempt from memory before revealing the answer."
                  className="mt-4 w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onRecord(lesson, question.id, checkpointAnswers[question.id] ?? '')} className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm">
                    Record attempt
                  </button>
                  <button type="button" onClick={() => onReveal(question.id)} className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm">
                    Reveal answer
                  </button>
                </div>
                {revealedAnswers[question.id] ? (
                  <div className="mt-4 rounded-xl border border-moss/20 bg-white p-4">
                    <p className="text-sm font-semibold text-ink">{question.answer}</p>
                    <p className="mt-2 text-sm leading-7 text-graphite/72">{question.explanation}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-ink/8 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Recap</p>
          <p className="mt-3 text-sm leading-8 text-graphite/78">{lesson.recap}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => onComplete(lesson)} className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm">
              Mark lesson complete
            </button>
            <button type="button" onClick={() => onNext(lesson.nextRecommendation)} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm">
              Study next recommendation
            </button>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Next recommendation</p>
          <p className="mt-3 text-sm leading-7 text-graphite/74">{lesson.nextRecommendation}</p>
        </div>
        {lesson.citations.length ? lesson.citations.map((citation) => <CitationCard key={`${citation.documentTitle}-${citation.location}`} citation={citation} />) : null}
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-2xl border border-ink/8 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">
          <MessageCircleQuestion size={15} />
          One question at a time
        </div>
        {turn.feedback ? <p className="mt-5 rounded-xl bg-paper/70 p-4 text-sm leading-7 text-graphite/74">{turn.feedback}</p> : null}
        <h3 className="mt-5 font-serif text-3xl font-semibold leading-tight text-ink">{turn.question}</h3>
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          rows={6}
          placeholder="Answer before requesting the next follow-up."
          className="mt-6 w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4"
        />
        <button type="button" onClick={onNext} disabled={disabled} className="mt-4 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-graphite/55">
          Submit and adapt
        </button>
      </section>
      <aside className="space-y-4">
        <TutorMetric icon={GraduationCap} label="Difficulty" value={turn.difficulty} />
        {turn.citations.map((citation) => <CitationCard key={`${citation.documentTitle}-${citation.location}`} citation={citation} />)}
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="space-y-5">
        {exam.questions.map((question, index) => {
          const marked = feedback[question.id];

          return (
            <article key={question.id} className="rounded-2xl border border-ink/8 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">
                <span>Question {index + 1}</span>
                <span>/</span>
                <span>{question.commandWord}</span>
                <span>/</span>
                <span>{question.marks} marks</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold leading-7 text-ink">{question.prompt}</h3>
              <details className="mt-4 rounded-xl bg-paper/70 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink">View mark scheme</summary>
                <p className="mt-3 text-sm leading-7 text-graphite/74">{question.markScheme}</p>
              </details>
              <textarea
                value={answers[question.id] ?? ''}
                onChange={(event) => onAnswerChange(question.id, event.target.value)}
                rows={5}
                placeholder="Write an exam-style answer."
                className="mt-4 w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none ring-ink/10 focus:ring-4"
              />
              <button type="button" onClick={() => onMark(exam, question)} disabled={disabled} className="mt-3 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-graphite/55">
                Mark answer
              </button>
              {marked ? (
                <div className="mt-5 rounded-2xl border border-moss/20 bg-paper/60 p-5">
                  <p className="text-lg font-semibold text-ink">
                    {marked.score}/{marked.maxScore}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-graphite/74">{marked.feedback}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Mark scheme reasoning</p>
                  <p className="mt-2 text-sm leading-7 text-graphite/74">{marked.markSchemeReasoning}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Suggested improvements</p>
                  <ul className="mt-2 space-y-2 text-sm leading-7 text-graphite/74">
                    {marked.suggestedImprovements.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Model answer</p>
                  <p className="mt-2 text-sm leading-7 text-graphite/74">{marked.modelAnswer}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
      <aside className="space-y-4">
        <TutorMetric icon={ClipboardCheck} label="Exam topic" value={exam.topic} />
        {exam.citations.map((citation) => <CitationCard key={`${citation.documentTitle}-${citation.location}`} citation={citation} />)}
      </aside>
    </div>
  );
}

function EmptyPanel({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/14 bg-white/70 p-8 text-center">
      <p className="font-serif text-2xl font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-graphite/70">{copy}</p>
    </div>
  );
}
