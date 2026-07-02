import { callOpenRouterChat, OpenRouterError } from "./_openrouter.js";

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

function extractJsonObject(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced ?? content;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found.');
  }

  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

function buildMessages(title: string, text: string, uploadMetadata: unknown) {
  return [
    {
      role: 'system' as const,
      content: [
        'You extract structured metadata from school reports, exam results, mark sheets, coursework feedback, subject notes, and academic source documents.',
        'Return JSON only. Do not wrap it in Markdown.',
        'Never invent marks, scores, grades, ranks, set positions, or teacher comments. Use null or empty arrays when absent.',
        'For each subject record, extract teacher, teacher comment, effort, attainment, percentage, grade, predicted grade, and target grade only when the document explicitly states them.',
        'Set marksExtracted to true only when a score, maxScore, percentage, grade, attainment, predicted grade, or target grade was actually present for that subject.',
        'Recognise marks and grades written as percentages, numeric grades such as 7 or 6, letter grades such as A or A*, effort grades, attainment grades, target grades, predicted grades, and descriptors such as Excellent, Good, or Developing.',
        'Handle tables, wrapped comments, merged OCR lines, page breaks, and teacher names carefully. If a value is plausible but uncertain, include it with Medium or Low confidence rather than pretending certainty.',
        'For every performance record, include extractionConfidence and fieldConfidence for subject, teacher, teacherComment, effort, attainment, score, maxScore, percentage, grade, predictedGrade, targetGrade, and rank when present.',
        'Clearly separate facts directly extracted from the document from metadata inferred from title, context, or user-supplied upload metadata.',
        'Handle multi-subject reports by returning one performance record per subject when evidence exists.',
        'Handle music or instrumental sections separately. Respect ignoreInstrumentalMusic: when true, music/instrumental records should not affect academic performance analysis.',
        'Use cautious confidence levels: High only when the document explicitly states the field; Medium for strong inference; Low for weak or sparse evidence.',
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
        'Return this exact JSON shape:',
        '{"metadata":{"sourceDate":"YYYY-MM-DD or null","academicYear":"string or null","term":"Michaelmas|Lent|Summer|Other|string|null","linkedAssessmentName":"string or null","documentCategory":"Report|Exam result|Mark sheet|Notes|Past paper|Mark scheme|Essay|Other","subjects":["string"],"topics":["string"],"teacherNames":["string"],"skills":["string"],"tags":["string"],"ignoreInstrumentalMusic":boolean,"shouldAffectAcademicPerformance":boolean,"metadataConfidence":"High|Medium|Low","extractedFacts":["string"],"inferredMetadata":["string"]},"summary":{"sourceType":"string","mainSubjects":["string"],"mainTopics":["string"],"keyEvidence":["string"],"importantCommentsOrResults":["string"],"suggestedUse":"string","summaryText":"string"},"performanceRecords":[{"title":"string","date":"YYYY-MM-DD or empty string","term":"string or null","academicYear":"string or null","subject":"string","assessmentType":"exam|report|coursework|music|mock|other","teacher":"string or null","teacherComment":"string or null","effort":"string or null","attainment":"string or null","score":number|null,"maxScore":number|null,"percentage":number|null,"grade":"string or null","predictedGrade":"string or null","targetGrade":"string or null","rank":"string or null","marksExtracted":boolean,"extractionConfidence":"High|Medium|Low","fieldConfidence":{"subject":"High|Medium|Low","teacher":"High|Medium|Low","teacherComment":"High|Medium|Low","effort":"High|Medium|Low","attainment":"High|Medium|Low","score":"High|Medium|Low","maxScore":"High|Medium|Low","percentage":"High|Medium|Low","grade":"High|Medium|Low","predictedGrade":"High|Medium|Low","targetGrade":"High|Medium|Low","rank":"High|Medium|Low"},"strengths":["string"],"weaknesses":["string"],"actionPoints":["string"],"excludeFromAcademicAnalysis":boolean}],"message":"string"}',
        '',
        'Document text:',
        text.slice(0, 16000),
      ].join('\n'),
    },
  ];
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

  try {
    const content = await callOpenRouterChat(buildMessages(title, text, body.uploadMetadata));
    return res.status(200).json(extractJsonObject(content));
  } catch (error: unknown) {
    console.error("Document metadata analysis error:", error);
    const statusCode = error instanceof OpenRouterError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Unknown server error";
    return res.status(statusCode).json({ error: message });
  }
}
