import { callOpenRouterChat } from "./_openrouter.js";
import {
  buildExtractionQualityReport,
  runLocalExtractionPipeline,
  validateExternalExtractionRecords,
  type ExtractionTimings,
  type ValidatedExtractionRecord,
} from '../src/utils/extractionValidation.js';

type ApiRequest = {
  method?: string;
  body?: unknown;
};

type ApiResponse = {
  status: (statusCode: number) => {
    json: (body: unknown) => void;
  };
  setHeader?: (name: string, value: string) => void;
};

type MetadataBody = {
  title?: unknown;
  text?: unknown;
  uploadMetadata?: unknown;
  pipelineTimings?: unknown;
};

type Confidence = 'High' | 'Medium' | 'Low';

type SectionResult = {
  sections?: Array<{
    id?: string;
    subject?: string | null;
    teacher?: string | null;
    rawSectionText?: string | null;
    pageRange?: string | null;
    lineRange?: string | null;
    confidence?: Confidence | null;
    warnings?: string[];
  }>;
  expectedVisibleSubjectCount?: number | null;
  warnings?: string[];
};

type SubjectResult = {
  subject?: string | null;
  teacher?: string | null;
  percentage?: number | null;
  rawMarkText?: string | null;
  grade?: string | null;
  effort?: string | null;
  attainment?: string | null;
  rank?: string | null;
  target?: string | null;
  predictedGrade?: string | null;
  teacherComment?: string | null;
  strengths?: string[];
  weaknesses?: string[];
  actionPoints?: string[];
  rawEvidence?: string[];
  confidence?: Confidence | null;
  fieldConfidence?: Record<string, Confidence>;
  needsReviewReason?: string | null;
};

type FinalExtractionResult = {
  documentSummary?: string;
  subjects?: SubjectResult[];
  extractionWarnings?: string[];
  missingLikelySubjects?: string[];
  confidence?: Confidence | null;
  metadata?: Record<string, unknown>;
  summary?: Record<string, unknown>;
};

function parseBody(body: unknown): MetadataBody {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as MetadataBody;
    } catch {
      return {};
    }
  }

  if (body && typeof body === 'object') {
    return body as MetadataBody;
  }

  return {};
}

function parseJsonObject(rawJson: string) {
  try {
    return JSON.parse(rawJson) as unknown;
  } catch {
    const repaired = rawJson
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u0000-\u001f]+/g, ' ')
      .trim();
    return JSON.parse(repaired) as unknown;
  }
}

function extractJsonObject(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced ?? content;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found.');
  }

  return parseJsonObject(raw.slice(start, end + 1));
}

function safeString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function safeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()) : [];
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function normalizeConfidence(value: unknown): Confidence {
  return value === 'High' || value === 'Medium' || value === 'Low' ? value : 'Medium';
}

function lowerConfidence(values: Confidence[]) {
  if (values.includes('Low')) return 'Low';
  if (values.includes('Medium')) return 'Medium';
  return 'High';
}

function normalizePercentage(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value >= 0 && value <= 100 ? value : null;
}

function buildCommonSystem() {
  return [
    'You are Research OS extraction. Extract school reports, exam results, mark sheets, coursework feedback, subject notes, and academic source documents.',
    'Return JSON only. Do not wrap it in Markdown.',
    'Never invent marks, scores, grades, ranks, set positions, targets, predicted grades, teachers, or teacher comments. Use null or empty arrays when absent.',
    'Never discard lines before analysis. Treat the supplied document text as raw evidence, including messy OCR, wrapped table cells, page breaks, repeated headers, and merged rows.',
    'Missing optional fields are not errors. Clear percentage plus subject is trusted. Teacher comments can exist without marks.',
    'Handle Music carefully: GCSE Music, Music Appraising, Composition, Coursework, Listening, Set Works, and marked/report-based Music Theory are academic records. Instrumental lessons, ABRSM, Trinity, graded instrument exams, violin/piano/organ/flute/singing comments, ensemble, choir, and orchestra feedback are performance records unless explicitly academic.',
    'Use Low confidence only for genuine ambiguity: unreadable names, merged OCR rows, contradictory values, impossible marks, unknown subjects, or possible mark/comment confusion. Medium confidence is acceptable by default.',
  ].join(' ');
}

async function callJson(messages: Array<{ role: 'system' | 'user'; content: string }>) {
  const content = await callOpenRouterChat(messages);
  return extractJsonObject(content);
}

function buildSectionMessages(title: string, text: string, uploadMetadata: unknown) {
  return [
    {
      role: 'system' as const,
      content: `${buildCommonSystem()} Pass 1: detect likely subject sections. Do not extract final marks yet. Teachers are not subjects. Preserve each section's raw text.`,
    },
    {
      role: 'user' as const,
      content: [
        `Document title: ${title}`,
        '',
        'User-supplied upload metadata:',
        JSON.stringify(uploadMetadata ?? {}).slice(0, 4000),
        '',
        'Return this exact JSON shape:',
        '{"sections":[{"id":"string","subject":"string|null","teacher":"string|null","rawSectionText":"string","pageRange":"string|null","lineRange":"string|null","confidence":"High|Medium|Low","warnings":["string"]}],"expectedVisibleSubjectCount":number|null,"warnings":["string"]}',
        '',
        'Document text:',
        text,
      ].join('\n'),
    },
  ];
}

function buildMarksMessages(title: string, sections: SectionResult) {
  return [
    {
      role: 'system' as const,
      content: `${buildCommonSystem()} Pass 2: extract marks only inside each detected section. Never infer a mark unless it is clearly present.`,
    },
    {
      role: 'user' as const,
      content: [
        `Document title: ${title}`,
        'Detected sections:',
        JSON.stringify(sections).slice(0, 70000),
        '',
        'Return this exact JSON shape:',
        '{"subjects":[{"sectionId":"string","subject":"string|null","percentage":number|null,"rawMarkText":"string|null","grade":"string|null","effort":"string|null","attainment":"string|null","rank":"string|null","target":"string|null","predictedGrade":"string|null","confidence":"High|Medium|Low","fieldConfidence":{"percentage":"High|Medium|Low","grade":"High|Medium|Low","effort":"High|Medium|Low","attainment":"High|Medium|Low","rank":"High|Medium|Low","target":"High|Medium|Low","predictedGrade":"High|Medium|Low"}}],"warnings":["string"]}',
      ].join('\n'),
    },
  ];
}

function buildCommentMessages(title: string, sections: SectionResult) {
  return [
    {
      role: 'system' as const,
      content: `${buildCommonSystem()} Pass 3: extract full teacher comments and learning themes inside each detected section. Avoid truncating comments. Do not treat comments as marks.`,
    },
    {
      role: 'user' as const,
      content: [
        `Document title: ${title}`,
        'Detected sections:',
        JSON.stringify(sections).slice(0, 70000),
        '',
        'Return this exact JSON shape:',
        '{"subjects":[{"sectionId":"string","subject":"string|null","teacher":"string|null","teacherComment":"string|null","strengths":["string"],"weaknesses":["string"],"actionPoints":["string"],"rawEvidence":["string"],"confidence":"High|Medium|Low","fieldConfidence":{"teacher":"High|Medium|Low","teacherComment":"High|Medium|Low","strengths":"High|Medium|Low","weaknesses":"High|Medium|Low","actionPoints":"High|Medium|Low"}}],"warnings":["string"]}',
      ].join('\n'),
    },
  ];
}

function buildFinalMessages(title: string, text: string, uploadMetadata: unknown, sections: SectionResult, marks: unknown, comments: unknown) {
  return [
    {
      role: 'system' as const,
      content: [
        buildCommonSystem(),
        'Pass 4 and 5: validate, repair using the original raw text, then produce the final strict JSON.',
        'Validation checklist: subject count matches visible subjects where possible; marks are between 0 and 100; teachers are not subjects; comments are not marks; rows are not merged incorrectly; duplicated subjects are merged; missing likely subjects are flagged.',
        'If a field cannot be repaired, mark only that field Low confidence and explain in needsReviewReason. Do not mark the whole report bad when only one field is uncertain.',
      ].join(' '),
    },
    {
      role: 'user' as const,
      content: [
        `Document title: ${title}`,
        '',
        'User-supplied upload metadata:',
        JSON.stringify(uploadMetadata ?? {}).slice(0, 4000),
        '',
        'Section detection result:',
        JSON.stringify(sections).slice(0, 50000),
        '',
        'Marks pass result:',
        JSON.stringify(marks).slice(0, 30000),
        '',
        'Teacher comment pass result:',
        JSON.stringify(comments).slice(0, 30000),
        '',
        'Original raw text for repair and final validation:',
        text.slice(0, 90000),
        '',
        'Return this exact JSON shape:',
        '{"documentSummary":"string","subjects":[{"subject":"string","teacher":"string|null","percentage":number|null,"rawMarkText":"string|null","grade":"string|null","effort":"string|null","attainment":"string|null","rank":"string|null","target":"string|null","predictedGrade":"string|null","teacherComment":"string|null","strengths":["string"],"weaknesses":["string"],"actionPoints":["string"],"rawEvidence":["string"],"confidence":"High|Medium|Low","fieldConfidence":{"subject":"High|Medium|Low","teacher":"High|Medium|Low","percentage":"High|Medium|Low","grade":"High|Medium|Low","effort":"High|Medium|Low","attainment":"High|Medium|Low","rank":"High|Medium|Low","target":"High|Medium|Low","predictedGrade":"High|Medium|Low","teacherComment":"High|Medium|Low"},"needsReviewReason":"string|null"}],"extractionWarnings":["string"],"missingLikelySubjects":["string"],"confidence":"High|Medium|Low","metadata":{"sourceDate":"YYYY-MM-DD or null","academicYear":"string|null","term":"Michaelmas|Lent|Summer|Other|string|null","linkedAssessmentName":"string|null","documentCategory":"Report|Exam result|Mark sheet|Coursework|Assessment|Notes|Past paper|Mark scheme|Essay|Other","subjects":["string"],"topics":["string"],"teacherNames":["string"],"skills":["string"],"tags":["string"],"ignoreInstrumentalMusic":boolean,"shouldAffectAcademicPerformance":boolean,"metadataConfidence":"High|Medium|Low","extractedFacts":["string"],"inferredMetadata":["string"]},"summary":{"sourceType":"string","mainSubjects":["string"],"mainTopics":["string"],"keyEvidence":["string"],"importantCommentsOrResults":["string"],"suggestedUse":"string","summaryText":"string"}}',
      ].join('\n'),
    },
  ];
}

function normalizeFieldConfidence(value: unknown): Record<string, Confidence> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, confidence]) => [key, normalizeConfidence(confidence)] as const)
      .filter(([, confidence]) => Boolean(confidence)),
  );
}

function countUncertainFields(subjects: SubjectResult[]) {
  return subjects.reduce((total, subject) => {
    const fieldConfidence = normalizeFieldConfidence(subject.fieldConfidence);
    return total + Object.values(fieldConfidence).filter((confidence) => confidence === 'Low').length + (subject.needsReviewReason ? 1 : 0);
  }, 0);
}

function toPerformanceRecords(finalResult: FinalExtractionResult, validatedRecords: ValidatedExtractionRecord[]) {
  const sourceSubjects = Array.isArray(finalResult.subjects) ? finalResult.subjects : [];
  return validatedRecords.map((record) => {
      const subject = sourceSubjects.find((item) => safeString(item.subject)?.toLowerCase() === record.subject.toLowerCase());
      const percentage = record.percentage ?? null;
      const grade = record.grade;
      const effort = record.effort;
      const attainment = record.attainment;
      const predictedGrade = record.predictedGrade;
      const targetGrade = record.targetGrade;
      const rank = record.rank;
      const marksExtracted = Boolean(percentage !== null || grade || effort || attainment || predictedGrade || targetGrade || rank || safeString(subject?.rawMarkText));

      return {
        title: safeString((finalResult.metadata ?? {}).linkedAssessmentName) ?? 'Extracted report record',
        date: safeString((finalResult.metadata ?? {}).sourceDate) ?? '',
        term: safeString((finalResult.metadata ?? {}).term) ?? null,
        academicYear: safeString((finalResult.metadata ?? {}).academicYear) ?? null,
        subject: record.subject,
        assessmentType: record.classification === 'instrumental' ? 'music' : 'report',
        teacher: record.teacher ?? null,
        teacherComment: record.teacherComment ?? null,
        effort: effort ?? null,
        attainment: attainment ?? null,
        score: null,
        maxScore: null,
        percentage,
        grade: grade ?? null,
        predictedGrade: predictedGrade ?? null,
        targetGrade: targetGrade ?? null,
        rank: rank ?? null,
        marksExtracted,
        extractionConfidence: record.confidence,
        fieldConfidence: record.fieldConfidence,
        strengths: safeStringArray(subject?.strengths),
        weaknesses: safeStringArray(subject?.weaknesses),
        actionPoints: safeStringArray(subject?.actionPoints),
        rawEvidence: record.rawEvidence,
        needsReviewReason: record.needsReviewReason ?? null,
        confidenceReasons: record.confidenceReasons,
        excludeFromAcademicAnalysis: record.excludeFromAcademicAnalysis,
      };
    });
}

function normalizeFinalResult(
  result: unknown,
  title: string,
  rawText: string,
  sections: SectionResult,
  marks: unknown,
  comments: unknown,
  timings: ExtractionTimings,
  metadataSource: 'AI generated' | 'Local fallback' = 'AI generated',
): FinalExtractionResult & Record<string, unknown> {
  const input = result && typeof result === 'object' ? (result as FinalExtractionResult) : {};
  const subjects = Array.isArray(input.subjects) ? input.subjects : [];
  const extractionWarnings = uniqueStrings([
    ...safeStringArray(input.extractionWarnings),
    ...safeStringArray(sections.warnings),
    ...safeStringArray((marks as { warnings?: unknown })?.warnings),
    ...safeStringArray((comments as { warnings?: unknown })?.warnings),
  ]);
  const subjectNames = uniqueStrings(subjects.map((subject) => safeString(subject.subject)));
  const teacherNames = uniqueStrings(subjects.map((subject) => safeString(subject.teacher)));
  const confidences = subjects.map((subject) => normalizeConfidence(subject.confidence));
  const confidence = input.confidence ? normalizeConfidence(input.confidence) : confidences.length ? lowerConfidence(confidences) : 'Low';
  const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  const summary = input.summary && typeof input.summary === 'object' ? input.summary : {};
  const validated = validateExternalExtractionRecords(subjects, `${title}\n${rawText}`);
  const validationStarted = Date.now();
  const validationWarnings = uniqueStrings([...extractionWarnings, ...validated.warnings]);
  const quality = buildExtractionQualityReport(validated.records, {
    expectedSubjects: typeof sections.expectedVisibleSubjectCount === 'number' ? sections.expectedVisibleSubjectCount : undefined,
    duplicateRows: validated.duplicateRows,
    warnings: validationWarnings,
  });
  const hasAcademicRecords = validated.records.some((record) => record.classification === 'academic');
  const onlyInstrumentalRecords = validated.records.length > 0 && validated.records.every((record) => record.classification === 'instrumental');
  timings.validationMs += Date.now() - validationStarted;
  timings.totalMs = Math.max(timings.totalMs, timings.aiLatencyMs + timings.validationMs);
  const performanceRecords = toPerformanceRecords({ ...input, subjects, metadata, confidence }, validated.records);
  const diagnostics = {
    detectedSubjectSections: Array.isArray(sections.sections) ? sections.sections.length : 0,
    subjectsWithMarks: performanceRecords.filter((record) => record.marksExtracted).length,
    subjectsWithComments: subjects.filter((subject) => safeString(subject.teacherComment)).length,
    uncertainFields: countUncertainFields(subjects),
    duplicateRows: validated.duplicateRows,
    ocrConsistency: quality.ocrConsistency,
    confidenceReasons: quality.confidenceReasons,
    warnings: validationWarnings,
  };

  return {
    documentSummary: safeString(input.documentSummary) ?? safeString((summary as { summaryText?: unknown }).summaryText) ?? `${title} was analysed for subjects, marks, and teacher evidence.`,
    subjects,
    extractionWarnings: validationWarnings,
    missingLikelySubjects: safeStringArray(input.missingLikelySubjects),
    confidence: quality.confidence,
    extractionDiagnostics: diagnostics,
    metadata: {
      sourceDate: safeString((metadata as { sourceDate?: unknown }).sourceDate) ?? null,
      academicYear: safeString((metadata as { academicYear?: unknown }).academicYear) ?? null,
      term: safeString((metadata as { term?: unknown }).term) ?? null,
      linkedAssessmentName: safeString((metadata as { linkedAssessmentName?: unknown }).linkedAssessmentName) ?? title,
      documentCategory: safeString((metadata as { documentCategory?: unknown }).documentCategory) ?? 'Report',
      subjects: uniqueStrings([...safeStringArray((metadata as { subjects?: unknown }).subjects), ...subjectNames]),
      topics: safeStringArray((metadata as { topics?: unknown }).topics),
      teacherNames: uniqueStrings([...safeStringArray((metadata as { teacherNames?: unknown }).teacherNames), ...teacherNames]),
      skills: safeStringArray((metadata as { skills?: unknown }).skills),
      tags: uniqueStrings([...safeStringArray((metadata as { tags?: unknown }).tags), ...subjectNames, 'extracted-report']),
      ignoreInstrumentalMusic: onlyInstrumentalRecords || Boolean((metadata as { ignoreInstrumentalMusic?: unknown }).ignoreInstrumentalMusic),
      shouldAffectAcademicPerformance: onlyInstrumentalRecords
        ? false
        : typeof (metadata as { shouldAffectAcademicPerformance?: unknown }).shouldAffectAcademicPerformance === 'boolean'
          ? Boolean((metadata as { shouldAffectAcademicPerformance?: boolean }).shouldAffectAcademicPerformance) && hasAcademicRecords
          : hasAcademicRecords,
      metadataConfidence: quality.confidence,
      extractedFacts: uniqueStrings([
        ...safeStringArray((metadata as { extractedFacts?: unknown }).extractedFacts),
        ...subjects.flatMap((subject) => safeStringArray(subject.rawEvidence).slice(0, 2)),
      ]).slice(0, 12),
      inferredMetadata: uniqueStrings([
        ...safeStringArray((metadata as { inferredMetadata?: unknown }).inferredMetadata),
        'Multi-pass extraction: section detection, marks, comments, validation, and repair.',
      ]),
      metadataSource,
    },
    summary: {
      sourceType: safeString((summary as { sourceType?: unknown }).sourceType) ?? 'Report',
      mainSubjects: subjectNames,
      mainTopics: safeStringArray((summary as { mainTopics?: unknown }).mainTopics),
      keyEvidence: subjects.flatMap((subject) => safeStringArray(subject.rawEvidence).slice(0, 1)).slice(0, 6),
      importantCommentsOrResults: subjects
        .map((subject) => {
          const mark = typeof subject.percentage === 'number' ? `${subject.percentage}%` : safeString(subject.grade);
          const comment = safeString(subject.teacherComment);
          return [safeString(subject.subject), mark, comment ? comment.slice(0, 160) : undefined].filter(Boolean).join(': ');
        })
        .filter(Boolean)
        .slice(0, 8),
      suggestedUse: safeString((summary as { suggestedUse?: unknown }).suggestedUse) ?? 'Progress evidence and source-grounded revision.',
      summaryText: safeString(input.documentSummary) ?? safeString((summary as { summaryText?: unknown }).summaryText) ?? `${title} was analysed using a multi-pass extraction pipeline.`,
    },
    performanceRecords,
    extractionQuality: quality,
    extractionTimings: timings,
    message: validationWarnings.length ? validationWarnings.join(' ') : `${metadataSource === 'AI generated' ? 'Multi-pass' : 'Deterministic fallback'} extraction completed.`,
  };
}

function buildLocalFallbackResult(title: string, rawText: string, uploadMetadata: unknown, startedAt: number, ocrMs: number) {
  const local = runLocalExtractionPipeline({ title, text: rawText, ocrMs });
  const supplied = uploadMetadata && typeof uploadMetadata === 'object' ? uploadMetadata as Record<string, unknown> : {};
  const subjects: SubjectResult[] = local.records.map((record) => ({
    subject: record.subject,
    teacher: record.teacher ?? null,
    percentage: record.percentage ?? null,
    grade: record.grade ?? null,
    effort: record.effort ?? null,
    attainment: record.attainment ?? null,
    rank: record.rank ?? null,
    target: record.targetGrade ?? null,
    predictedGrade: record.predictedGrade ?? null,
    teacherComment: record.teacherComment ?? null,
    rawEvidence: record.rawEvidence,
    confidence: record.confidence,
    fieldConfidence: record.fieldConfidence as Record<string, Confidence>,
    needsReviewReason: record.needsReviewReason ?? null,
    strengths: [],
    weaknesses: [],
    actionPoints: [],
  }));
  const metadata = {
    ...supplied,
    sourceDate: safeString(supplied.sourceDate) ?? null,
    academicYear: safeString(supplied.academicYear) ?? local.metadata.academicYear ?? null,
    term: safeString(supplied.term) ?? local.metadata.term ?? null,
    linkedAssessmentName: safeString(supplied.linkedAssessmentName) ?? title,
    documentCategory: safeString(supplied.documentCategory) ?? local.metadata.documentCategory,
    subjects: uniqueStrings([...safeStringArray(supplied.subjects), ...local.records.map((record) => record.subject)]),
    topics: safeStringArray(supplied.topics),
    teacherNames: uniqueStrings(local.records.map((record) => record.teacher)),
    skills: [],
    tags: uniqueStrings([...local.records.map((record) => record.subject), 'deterministic-extraction']),
    ignoreInstrumentalMusic: local.metadata.ignoreInstrumentalMusic || Boolean(supplied.ignoreInstrumentalMusic),
    shouldAffectAcademicPerformance: local.metadata.shouldAffectAcademicPerformance,
    metadataConfidence: local.quality.confidence,
    extractedFacts: local.records.flatMap((record) => record.rawEvidence.slice(0, 1)).slice(0, 12),
    inferredMetadata: ['AI extraction was unavailable; deterministic validation fallback was used.'],
  };
  const finalResult: FinalExtractionResult = {
    documentSummary: `${title} was analysed using the deterministic extraction fallback.`,
    subjects,
    extractionWarnings: local.warnings,
    missingLikelySubjects: [],
    confidence: local.quality.confidence,
    metadata,
    summary: {
      sourceType: local.metadata.documentCategory,
      mainSubjects: local.records.map((record) => record.subject),
      mainTopics: [],
      keyEvidence: local.records.flatMap((record) => record.rawEvidence.slice(0, 1)).slice(0, 6),
      importantCommentsOrResults: local.records.map((record) => [record.subject, record.percentage !== undefined ? `${record.percentage}%` : undefined, record.teacherComment].filter(Boolean).join(': ')).slice(0, 8),
      suggestedUse: 'Progress evidence and source-grounded revision.',
      summaryText: `${title} was analysed locally because AI extraction was unavailable.`,
    },
  };
  const sections: SectionResult = {
    expectedVisibleSubjectCount: local.records.length,
    sections: local.records.map((record, index) => ({ id: `local-${index}`, subject: record.subject, teacher: record.teacher, rawSectionText: record.rawEvidence.join('\n'), confidence: record.confidence, warnings: [] })),
    warnings: local.warnings,
  };

  return normalizeFinalResult(
    finalResult,
    title,
    rawText,
    sections,
    { warnings: [] },
    { warnings: [] },
    { ...local.timings, totalMs: Date.now() - startedAt + ocrMs, aiCalls: 0, aiLatencyMs: 0 },
    'Local fallback',
  );
}

function logExtractionReport(response: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return;
  const records = Array.isArray(response.performanceRecords) ? response.performanceRecords as Array<Record<string, unknown>> : [];
  const quality = response.extractionQuality && typeof response.extractionQuality === 'object' ? response.extractionQuality as Record<string, unknown> : {};
  console.debug(`[Extraction] ${records.length} subjects found`);
  console.debug(`[Extraction] ${records.filter((record) => Boolean(record.teacherComment)).length} comments linked`);
  console.debug(`[Extraction] ${quality.duplicateRows ?? 0} duplicate rows`);
  console.debug(`[Extraction] Confidence ${quality.confidence ?? response.confidence ?? 'Low'}`);
}

function shouldUseMultiPassExtraction(text: string) {
  const lines = text.split(/\r?\n/);
  return text.length > 12000
    || /\b\d*[Oo]\d*\s*%|SUBJ\s+TCHR|\?/.test(text)
    || lines.some((line) => (line.match(/\b\d{1,3}\s*%/g)?.length ?? 0) > 1 || line.length > 220);
}

function buildLocalSections(title: string, rawText: string): SectionResult {
  const local = runLocalExtractionPipeline({ title, text: rawText });
  return {
    sections: local.records.map((record, index) => ({
      id: `deterministic-${index}`,
      subject: record.subject,
      teacher: record.teacher,
      rawSectionText: record.rawEvidence.join('\n'),
      confidence: record.confidence,
      warnings: record.needsReviewReason ? [record.needsReviewReason] : [],
    })),
    expectedVisibleSubjectCount: local.records.length || null,
    warnings: local.warnings,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const body = parseBody(req.body);
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Uploaded document';
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (!text) {
    return res.status(400).json({ error: 'Document text is required.' });
  }

  const startedAt = Date.now();
  const pipelineTimings = body.pipelineTimings && typeof body.pipelineTimings === 'object' ? body.pipelineTimings as Record<string, unknown> : {};
  const ocrMs = typeof pipelineTimings.ocrMs === 'number' && Number.isFinite(pipelineTimings.ocrMs) && pipelineTimings.ocrMs >= 0 ? pipelineTimings.ocrMs : 0;

  try {
    const rawText = typeof body.text === 'string' ? body.text : '';
    const useMultiPass = shouldUseMultiPassExtraction(rawText);
    const sections = useMultiPass
      ? (await callJson(buildSectionMessages(title, rawText, body.uploadMetadata))) as SectionResult
      : buildLocalSections(title, rawText);
    const [marks, comments] = useMultiPass
      ? await Promise.all([
          callJson(buildMarksMessages(title, sections)),
          callJson(buildCommentMessages(title, sections)),
        ])
      : [{ subjects: [], warnings: [] }, { subjects: [], warnings: [] }];
    const finalResult = await callJson(buildFinalMessages(title, rawText, body.uploadMetadata, sections, marks, comments));
    const aiLatencyMs = Date.now() - startedAt;
    const response = normalizeFinalResult(
      finalResult,
      title,
      rawText,
      sections,
      marks,
      comments,
      { ocrMs, extractionMs: aiLatencyMs, aiLatencyMs, validationMs: 0, totalMs: aiLatencyMs + ocrMs, aiCalls: useMultiPass ? 4 : 1 },
    );

    logExtractionReport(response);

    return res.status(200).json(response);
  } catch (error: unknown) {
    if (process.env.NODE_ENV !== 'production') console.debug('Document metadata AI analysis failed; using deterministic fallback.', error instanceof Error ? error.message : 'Unknown AI error');
    const response = buildLocalFallbackResult(title, typeof body.text === 'string' ? body.text : '', body.uploadMetadata, startedAt, ocrMs);
    logExtractionReport(response);
    return res.status(200).json(response);
  }
}
