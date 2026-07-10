import { describe, expect, it } from 'vitest';
import {
  buildExtractionQualityReport,
  classifyMusicRecord,
  deduplicateExtractionRecords,
  evaluateEvidenceConfidence,
  normalizeOcrText,
  parseReportText,
  shouldRecordNeedReview,
  type ValidatedExtractionRecord,
} from '../../src/utils/extractionValidation';

function record(overrides: Partial<ValidatedExtractionRecord> = {}): ValidatedExtractionRecord {
  return {
    subject: 'Biology',
    percentage: 72,
    rawEvidence: ['Biology 72%'],
    confidence: 'High',
    confidenceReasons: ['Subject recognised', 'Percentage is valid'],
    fieldConfidence: { subject: 'High', percentage: 'High' },
    classification: 'academic',
    excludeFromAcademicAnalysis: false,
    ...overrides,
  };
}

describe('OCR cleaner', () => {
  it('repairs percentage substitutions and broken words without changing line order', () => {
    expect(normalizeOcrText('Biology 8O % under-\nstanding\nHistory 62%')).toBe('Biology 80% understanding\nHistory 62%');
  });
});

describe('parser and validation guards', () => {
  it('preserves subject ordering and attaches comments to the nearest subject', () => {
    const result = parseReportText('Report', 'Biology | Teacher: W Jolly | Mark: 72%\nComment: Cells secure\nChemistry | Teacher: R Shah | Mark: 81%\nComment: Bonding secure');
    expect(result.records.map((item) => item.subject)).toEqual(['Biology', 'Chemistry']);
    expect(result.records[0].teacher).toBe('W Jolly');
    expect(result.records[0].teacherComment).toBe('Cells secure');
    expect(result.records[1].teacher).toBe('R Shah');
    expect(result.records[1].teacherComment).toBe('Bonding secure');
  });

  it('does not invent grades in comments-only reports', () => {
    const result = parseReportText('Report', 'Biology - Teacher: Mrs Green\nComment: Progress is secure.');
    expect(result.records[0].grade).toBeUndefined();
    expect(result.records[0].predictedGrade).toBeUndefined();
    expect(result.records[0].percentage).toBeUndefined();
  });

  it('rejects impossible percentages and explains review', () => {
    const result = parseReportText('Scan', 'Biology Mrs Green 140% cells secure');
    expect(result.records[0].percentage).toBeUndefined();
    expect(result.records[0].confidence).toBe('Low');
    expect(result.records[0].needsReviewReason).toContain('140%');
    expect(shouldRecordNeedReview(result.records[0])).toBe(true);
  });

  it('splits merged OCR rows and records the problem', () => {
    const result = parseReportText('Scan', 'Biology Mrs Green 72% cells secure Chemistry Mr Shah 81% bonding secure');
    expect(result.records.map((item) => item.subject)).toEqual(['Biology', 'Chemistry']);
    expect(result.warnings).toContain('Merged OCR row detected');
  });
});

describe('confidence scoring', () => {
  it('uses evidence quality and explains why', () => {
    const strong = evaluateEvidenceConfidence({
      subject: 'Biology',
      teacher: 'W Jolly',
      teacherComment: 'Cells secure',
      percentage: 72,
      warnings: [],
      rowIntact: true,
    });
    const weak = evaluateEvidenceConfidence({
      subject: 'Biology',
      invalidPercentage: 140,
      warnings: ['Impossible percentage rejected'],
      rowIntact: false,
    });
    expect(strong.confidence).toBe('High');
    expect(strong.reasons).toContain('Teacher recognised');
    expect(strong.reasons).toContain('Row structure intact');
    expect(weak.confidence).toBe('Low');
    expect(weak.reasons).toContain('Impossible percentage rejected');
  });
});

describe('classification and duplicate detection', () => {
  it('keeps GCSE Music academic and excludes instrumental lessons', () => {
    expect(classifyMusicRecord('Music Appraising', 'GCSE coursework report')).toBe('academic');
    expect(classifyMusicRecord('Piano', 'ABRSM instrumental lesson')).toBe('instrumental');
  });

  it('merges duplicate subjects and lowers confidence for contradictory marks', () => {
    const result = deduplicateExtractionRecords([record(), record({ percentage: 81 })]);
    expect(result.duplicateRows).toBe(1);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].confidence).toBe('Low');
    expect(result.records[0].needsReviewReason).toContain('Contradictory');
  });

  it('produces a complete internal extraction report', () => {
    const quality = buildExtractionQualityReport([record({ teacher: 'W Jolly', teacherComment: 'Cells secure' })], { expectedSubjects: 1 });
    expect(quality).toMatchObject({
      subjectsFound: 1,
      subjectsMatched: 1,
      marksFound: 1,
      teachersFound: 1,
      commentsLinked: 1,
      ocrConsistency: 'Excellent',
      confidence: 'High',
    });
  });
});
