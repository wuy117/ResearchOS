import { describe, expect, it } from 'vitest';
import { extractionFixtures } from '../../src/data/extractionFixtures';
import { runLocalExtractionPipeline, shouldRecordNeedReview } from '../../src/utils/extractionValidation';

describe('golden extraction dataset', () => {
  it.each(extractionFixtures)('$id matches every expected value', (fixture) => {
    const result = runLocalExtractionPipeline({
      title: fixture.title,
      text: fixture.text,
      expectedSubjects: fixture.expected.subjects.length,
    });

    expect(result.metadata.term).toBe(fixture.expected.term);
    expect(result.metadata.academicYear).toBe(fixture.expected.academicYear);
    expect(result.metadata.shouldAffectAcademicPerformance).toBe(fixture.expected.shouldAffectAcademicPerformance);
    expect(result.records.map((record) => record.subject)).toEqual(fixture.expected.subjects.map((record) => record.subject));
    expect(result.records.filter((record) => record.teacherComment)).toHaveLength(fixture.expected.comments);
    expect(result.records.filter((record) => record.predictedGrade)).toHaveLength(fixture.expected.predictedGrades);
    expect(result.records.filter(shouldRecordNeedReview)).toHaveLength(fixture.expected.needsReview);
    expect(result.quality.confidence).toBe(fixture.expected.confidence);

    fixture.expected.subjects.forEach((expectedRecord, index) => {
      const record = result.records[index];
      expect(record, `Missing ${expectedRecord.subject}`).toBeDefined();
      expect(record.subject).toBe(expectedRecord.subject);
      expect(record.percentage).toBe(expectedRecord.percentage);
      expect(record.teacher).toBe(expectedRecord.teacher);
      expect(record.grade).toBe(expectedRecord.grade);
      expect(record.effort).toBe(expectedRecord.effort);
      expect(record.attainment).toBe(expectedRecord.attainment);
      expect(record.targetGrade).toBe(expectedRecord.targetGrade);
      expect(record.predictedGrade).toBe(expectedRecord.predictedGrade);
      expect(record.classification).toBe(expectedRecord.classification ?? 'academic');
      if (expectedRecord.commentIncludes) expect(record.teacherComment).toContain(expectedRecord.commentIncludes);
    });

    fixture.expected.warnings?.forEach((warning) => {
      expect(result.quality.potentialProblems).toContain(warning);
    });
  });
});
