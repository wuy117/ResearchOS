import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_openrouter.js', () => ({
  callOpenRouterChat: vi.fn(),
}));

import handler from '../../api/analyse-document-metadata';
import { callOpenRouterChat } from '../../api/_openrouter.js';

const mockedChat = vi.mocked(callOpenRouterChat);

function responseRecorder() {
  let statusCode = 0;
  let body: unknown;
  return {
    response: {
      status(code: number) {
        statusCode = code;
        return {
          json(value: unknown) {
            body = value;
          },
        };
      },
      setHeader() {},
    },
    read: () => ({ statusCode, body: body as Record<string, unknown> }),
  };
}

describe('metadata extraction API safeguards', () => {
  beforeEach(() => mockedChat.mockReset());

  it('uses one AI call for a clean report and emits validation telemetry', async () => {
    mockedChat.mockResolvedValue(JSON.stringify({
      documentSummary: 'Clean report',
      subjects: [{
        subject: 'Biology',
        teacher: 'W Jolly',
        percentage: 72,
        teacherComment: 'Cells secure',
        rawEvidence: ['Biology | Teacher: W Jolly | Mark: 72% | Comment: Cells secure'],
        confidence: 'High',
        fieldConfidence: { subject: 'High', teacher: 'High', percentage: 'High', teacherComment: 'High' },
      }],
      confidence: 'High',
      metadata: { term: 'Michaelmas', academicYear: '2025-2026', documentCategory: 'Report', subjects: ['Biology'] },
      summary: { summaryText: 'Clean report' },
    }));
    const recorder = responseRecorder();

    await handler(
      { method: 'POST', body: { title: 'Michaelmas Report', text: 'Biology | Teacher: W Jolly | Mark: 72% | Comment: Cells secure' } },
      recorder.response,
    );
    const result = recorder.read();

    expect(result.statusCode).toBe(200);
    expect(mockedChat).toHaveBeenCalledTimes(1);
    expect(result.body.extractionQuality).toMatchObject({ subjectsFound: 1, marksFound: 1, commentsLinked: 1, confidence: 'High' });
    expect(result.body.extractionTimings).toMatchObject({ aiCalls: 1 });
  });

  it('falls back deterministically when AI is unavailable or malformed', async () => {
    mockedChat.mockResolvedValue('unreadable AI response');
    const recorder = responseRecorder();

    await handler(
      { method: 'POST', body: { title: 'Marks report', text: 'Biology | Teacher: W Jolly | Mark: 72%' } },
      recorder.response,
    );
    const result = recorder.read();
    const metadata = result.body.metadata as Record<string, unknown>;
    const records = result.body.performanceRecords as Array<Record<string, unknown>>;

    expect(result.statusCode).toBe(200);
    expect(metadata.metadataSource).toBe('Local fallback');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ subject: 'Biology', percentage: 72, excludeFromAcademicAnalysis: false });
    expect(result.body.extractionTimings).toMatchObject({ aiCalls: 0, aiLatencyMs: 0 });
  });

  it('keeps the multi-pass path for genuinely messy OCR', async () => {
    mockedChat
      .mockResolvedValueOnce(JSON.stringify({ sections: [{ id: '1', subject: 'Biology', rawSectionText: 'Biology 8O%' }], expectedVisibleSubjectCount: 1, warnings: [] }))
      .mockResolvedValueOnce(JSON.stringify({ subjects: [{ sectionId: '1', subject: 'Biology', percentage: 80 }], warnings: [] }))
      .mockResolvedValueOnce(JSON.stringify({ subjects: [{ sectionId: '1', subject: 'Biology', teacherComment: 'Cells secure' }], warnings: [] }))
      .mockResolvedValueOnce(JSON.stringify({ subjects: [{ subject: 'Biology', percentage: 80, teacherComment: 'Cells secure', confidence: 'Medium', fieldConfidence: { subject: 'High', percentage: 'Medium', teacherComment: 'Medium' } }], confidence: 'Medium', metadata: { subjects: ['Biology'] }, summary: {} }));
    const recorder = responseRecorder();

    await handler(
      { method: 'POST', body: { title: 'OCR report', text: 'Biology 8O% cells secure', pipelineTimings: { ocrMs: 17 } } },
      recorder.response,
    );
    const result = recorder.read();

    expect(result.statusCode).toBe(200);
    expect(mockedChat).toHaveBeenCalledTimes(4);
    expect(result.body.extractionTimings).toMatchObject({ aiCalls: 4, ocrMs: 17 });
  });

  it('keeps instrumental lessons out of academic Progress even if AI metadata is permissive', async () => {
    mockedChat.mockResolvedValue(JSON.stringify({
      subjects: [{ subject: 'Piano', teacher: 'Susan Wang', teacherComment: 'Scales are more even.', confidence: 'High' }],
      confidence: 'High',
      metadata: { subjects: ['Piano'], shouldAffectAcademicPerformance: true, ignoreInstrumentalMusic: false },
      summary: {},
    }));
    const recorder = responseRecorder();

    await handler(
      { method: 'POST', body: { title: 'Piano lesson feedback', text: 'Piano lesson feedback\nTeacher: Susan Wang\nComment: Scales are more even.' } },
      recorder.response,
    );
    const result = recorder.read();
    const metadata = result.body.metadata as Record<string, unknown>;
    const records = result.body.performanceRecords as Array<Record<string, unknown>>;

    expect(metadata.shouldAffectAcademicPerformance).toBe(false);
    expect(metadata.ignoreInstrumentalMusic).toBe(true);
    expect(records[0]).toMatchObject({ assessmentType: 'music', excludeFromAcademicAnalysis: true });
  });

  it('merges duplicated AI subject rows before creating Progress records', async () => {
    mockedChat.mockResolvedValue(JSON.stringify({
      subjects: [
        { subject: 'Biology', percentage: 72, confidence: 'High' },
        { subject: 'Biology', percentage: 72, teacherComment: 'Cells secure', confidence: 'High' },
      ],
      confidence: 'High',
      metadata: { subjects: ['Biology'] },
      summary: {},
    }));
    const recorder = responseRecorder();

    await handler(
      { method: 'POST', body: { title: 'Biology report', text: 'Biology | Mark: 72% | Comment: Cells secure' } },
      recorder.response,
    );
    const result = recorder.read();
    const records = result.body.performanceRecords as Array<Record<string, unknown>>;

    expect(records).toHaveLength(1);
    expect(result.body.extractionQuality).toMatchObject({ duplicateRows: 1 });
  });
});
