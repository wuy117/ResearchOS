import { describe, expect, it } from 'vitest';
import { buildProgressRecommendations, getAcademicPerformanceRecords } from '../../src/App';
import { extractionFixtures } from '../../src/data/extractionFixtures';
import { initialState } from '../../src/data/initialState';
import type { ResearchDocument, ResearchState } from '../../src/types/research';
import { createProgressRecordsFromExtraction, runExtractionWorkflow } from '../../src/utils/extractionValidation';
import { buildTimelineEvents } from '../../src/utils/learningModel';

describe('upload to recommendations regression path', () => {
  it.each(extractionFixtures)('$id completes every deterministic stage', async (fixture) => {
    const documentId = `doc-${fixture.id}`;
    const stages: string[] = [];
    const extraction = await runExtractionWorkflow({
      title: fixture.title,
      source: fixture.sourceKind === 'ocr' ? { kind: 'ocr', input: fixture.text } : { kind: 'text', text: fixture.text },
      expectedSubjects: fixture.expected.subjects.length,
      extractOcr: async (input) => String(input),
      onStage: (stage) => stages.push(stage),
    });
    const performanceRecords = createProgressRecordsFromExtraction({
      documentId,
      title: fixture.title,
      records: extraction.records,
      academicYear: extraction.metadata.academicYear,
      term: extraction.metadata.term,
      createdAt: '2026-07-10T00:00:00.000Z',
    });
    const document: ResearchDocument = {
      id: documentId,
      title: fixture.title,
      type: fixture.sourceKind === 'ocr' ? 'IMAGE' : 'TXT',
      workspaceId: initialState.activeWorkspaceId,
      authors: 'Regression fixture',
      addedAt: '2026-07-10T00:00:00.000Z',
      status: extraction.quality.needsReview ? 'Needs review' : 'Ready',
      tags: ['regression fixture'],
      insightCount: 0,
      summary: fixture.description,
      extractedText: fixture.text,
      metadata: {
        academicYear: extraction.metadata.academicYear,
        term: extraction.metadata.term,
        linkedAssessmentName: fixture.title,
        documentCategory: extraction.metadata.documentCategory,
        ignoreInstrumentalMusic: extraction.metadata.ignoreInstrumentalMusic,
        shouldAffectAcademicPerformance: extraction.metadata.shouldAffectAcademicPerformance,
        metadataConfidence: extraction.quality.confidence,
        metadataSource: 'Local fallback',
        subjects: extraction.records.map((record) => record.subject),
        topics: [],
        academicYears: extraction.metadata.academicYear ? [extraction.metadata.academicYear] : [],
        terms: extraction.metadata.term ? [extraction.metadata.term] : [],
        assessments: [fixture.title],
        documentTypes: [extraction.metadata.documentCategory],
        teacherNames: extraction.records.flatMap((record) => record.teacher ? [record.teacher] : []),
        skills: [],
        performanceRecords: performanceRecords.map((record) => record.title),
        collections: [],
        tags: [],
      },
    };
    const state: ResearchState = {
      ...initialState,
      documents: [document],
      performanceRecords,
    };
    const academicRecords = getAcademicPerformanceRecords(performanceRecords);
    const timeline = buildTimelineEvents(state);
    const recommendations = buildProgressRecommendations(
      academicRecords,
      [],
      [],
      initialState.tutorMemory,
      [document],
      'All Subjects',
    );

    expect(extraction.records).toHaveLength(fixture.expected.subjects.length);
    expect(stages).toEqual(fixture.sourceKind === 'ocr' ? ['Upload', 'OCR Complete', 'Extraction', 'Validation'] : ['Upload', 'Extraction', 'Validation']);
    expect(performanceRecords).toHaveLength(extraction.records.length);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].subjects).toEqual(extraction.records.map((record) => record.subject));
    expect(recommendations).toHaveLength(3);

    if (fixture.id === 'instrumental-lesson-report') {
      expect(academicRecords).toHaveLength(0);
      expect(performanceRecords.every((record) => record.excludeFromAcademicAnalysis)).toBe(true);
    } else {
      expect(academicRecords.length).toBeGreaterThan(0);
    }
  });
});
