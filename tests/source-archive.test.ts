import { describe, expect, it } from 'vitest';
import { buildSourceArchiveGroups, documentMatchesSourceQuery, sortSourceArchiveDocuments } from '../src/App';
import type { DocumentMetadata, PerformanceRecord, ResearchDocument } from '../src/types/research';

const emptyMetadata: DocumentMetadata = {
  subjects: [],
  topics: [],
  academicYears: [],
  terms: [],
  assessments: [],
  documentTypes: [],
  teacherNames: [],
  skills: [],
  performanceRecords: [],
  collections: [],
  tags: [],
};

function source(id: string, metadata: Partial<DocumentMetadata> = {}, addedAt = '2026-07-14T00:00:00.000Z'): ResearchDocument {
  return {
    id,
    title: id.replace(/-/g, ' '),
    type: 'PDF',
    workspaceId: 'workspace-test',
    authors: '',
    addedAt,
    status: 'Ready',
    tags: [],
    insightCount: 0,
    summary: 'A source about evidence and explanation.',
    metadata: { ...emptyMetadata, ...metadata },
  };
}

function record(sourceDocumentId: string): PerformanceRecord {
  return {
    id: 'record-biology',
    title: 'Michaelmas report',
    sourceDocumentId,
    date: '',
    academicYear: '2025-2026',
    term: 'Michaelmas',
    subject: 'Biology',
    assessmentType: 'report',
    teacher: 'Ms. R. Shah',
    teacherComment: 'Connect concentration language to water potential.',
    strengths: ['Clear observation'],
    weaknesses: ['Scientific vocabulary'],
    actionPoints: ['Name the membrane explicitly'],
    createdAt: '2026-07-13T00:00:00.000Z',
  };
}

describe('Sources knowledge archive', () => {
  it('searches across document context and linked learning evidence using every query term', () => {
    const report = source('biology-report', {
      academicYear: '2025-2026',
      term: 'Michaelmas',
      documentCategory: 'Report',
      subjects: ['Biology'],
    });
    const linkedRecord = record(report.id);

    expect(documentMatchesSourceQuery(report, [linkedRecord], 'water potential')).toBe(true);
    expect(documentMatchesSourceQuery(report, [linkedRecord], 'biology shah')).toBe(true);
    expect(documentMatchesSourceQuery(report, [linkedRecord], 'biology algebra')).toBe(false);
  });

  it('orders explicit academic time before upload time and keeps later terms first', () => {
    const documents = [
      source('unsorted-new-upload', {}, '2026-07-14T00:00:00.000Z'),
      source('older-summer', { academicYear: '2024-2025', term: 'Summer' }),
      source('current-michaelmas', { academicYear: '2025-2026', term: 'Michaelmas' }),
      source('current-summer', { academicYear: '2025-2026', term: 'Summer' }),
    ];

    expect(sortSourceArchiveDocuments(documents, []).map((document) => document.id)).toEqual([
      'current-summer',
      'current-michaelmas',
      'older-summer',
      'unsorted-new-upload',
    ]);
  });

  it('groups only by explicit academic context and leaves uploads without it unsorted', () => {
    const documents = sortSourceArchiveDocuments([
      source('report-one', { academicYear: '2025-2026', term: 'Michaelmas' }),
      source('notes-one', { academicYear: '2025-2026', term: 'Michaelmas' }),
      source('without-context'),
    ], []);

    const groups = buildSourceArchiveGroups(documents, []);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ academicYear: '2025-2026', term: 'Michaelmas' });
    expect(groups[0].documents.map((document) => document.id)).toEqual(['notes-one', 'report-one']);
    expect(groups[1]).toMatchObject({ academicYear: 'Unsorted knowledge', term: '' });
  });

  it('uses linked learning evidence when saved document metadata has no academic context', () => {
    const report = source('linked-context');
    const linkedRecord = record(report.id);
    const groups = buildSourceArchiveGroups([report], [linkedRecord]);

    expect(groups[0]).toMatchObject({ academicYear: '2025-2026', term: 'Michaelmas' });
    expect(documentMatchesSourceQuery(report, [linkedRecord], '2025-2026 Michaelmas')).toBe(true);
  });
});
