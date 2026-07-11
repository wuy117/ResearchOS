import { describe, expect, it } from 'vitest';
import { buildProgressRecommendations, buildTeacherInsights } from '../src/App';
import { initialState } from '../src/data/initialState';
import type { PerformanceRecord } from '../src/types/research';

function record(id: string, subject: string, comment: string, weaknesses: string[], actionPoints: string[]): PerformanceRecord {
  return {
    id,
    title: 'Summer Report',
    sourceDocumentId: 'report-summer',
    date: '',
    academicYear: '2025-2026',
    term: 'Summer',
    subject,
    assessmentType: 'report',
    teacherComment: comment,
    strengths: [],
    weaknesses,
    actionPoints,
    createdAt: '2026-07-01',
  };
}

describe('Progress tutor reasoning', () => {
  it('groups differently worded teacher feedback by meaning', () => {
    const records = [
      record('english', 'English', 'Support each argument with a short quotation.', ['Evidence selection'], ['Use evidence for each conclusion']),
      record('biology', 'Biology', 'Explain how the results support the conclusion.', ['Data interpretation'], ['Link results to conclusions']),
    ];

    const insights = buildTeacherInsights(records);
    const reasoning = insights.find((insight) => insight.theme === 'Reasoning & Evidence');

    expect(reasoning?.classification).toBe('Priority');
    expect(reasoning?.subjects).toEqual(['English', 'Biology']);
    expect(insights.some((insight) => insight.theme === 'Evidence Selection')).toBe(false);
    expect(insights.some((insight) => insight.theme === 'Link Results To Conclusions')).toBe(false);
  });

  it('makes every recommendation actionable and explains why it matters now', () => {
    const records = [
      record('maths', 'Mathematics', 'Check calculations and verify units before submitting.', ['Careless arithmetic'], ['Check every calculation']),
      record('english', 'English', 'Support each argument with evidence.', ['Evidence selection'], ['Use evidence for each conclusion']),
    ];

    const recommendations = buildProgressRecommendations(records, [], [], initialState.tutorMemory, [], 'All Subjects');

    expect(recommendations).toHaveLength(3);
    recommendations.forEach((recommendation) => {
      expect(recommendation.action.length).toBeGreaterThan(20);
      expect(recommendation.why.length).toBeGreaterThan(20);
    });
  });
});
