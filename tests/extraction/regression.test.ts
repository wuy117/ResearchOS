import { describe, expect, it } from 'vitest';
import { extractionFixtures } from '../../src/data/extractionFixtures';
import { runLocalExtractionPipeline } from '../../src/utils/extractionValidation';

describe('extraction regression and benchmark summary', () => {
  it('does not regress any golden document and reports stage timings', () => {
    let passed = 0;
    const failures: string[] = [];
    const timings: Array<{ id: string; extractionMs: number; validationMs: number; totalMs: number }> = [];

    extractionFixtures.forEach((fixture) => {
      const result = runLocalExtractionPipeline({
        title: fixture.title,
        text: fixture.text,
        expectedSubjects: fixture.expected.subjects.length,
      });
      const actualSubjects = result.records.map((record) => record.subject);
      const expectedSubjects = fixture.expected.subjects.map((record) => record.subject);
      const matches = JSON.stringify(actualSubjects) === JSON.stringify(expectedSubjects)
        && result.quality.needsReview === fixture.expected.needsReview
        && result.quality.confidence === fixture.expected.confidence;

      if (matches) passed += 1;
      else failures.push(fixture.id);
      timings.push({
        id: fixture.id,
        extractionMs: Number(result.timings.extractionMs.toFixed(3)),
        validationMs: Number(result.timings.validationMs.toFixed(3)),
        totalMs: Number(result.timings.totalMs.toFixed(3)),
      });
    });

    const totalMs = timings.reduce((total, timing) => total + timing.totalMs, 0);
    console.info('\nExtraction regression summary');
    console.info(JSON.stringify({ passed, failed: failures.length, failures, aiCalls: 0, aiLatencyMs: 0, totalMs: Number(totalMs.toFixed(3)), timings }, null, 2));

    expect(failures).toEqual([]);
    expect(passed).toBe(extractionFixtures.length);
  });
});
