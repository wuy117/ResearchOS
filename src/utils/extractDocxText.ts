import mammoth from 'mammoth';
import { getWordCount } from './chunkText';

export type ExtractedDocxText = {
  text: string;
  wordCount: number;
};

function normalizeDocxText(text: string) {
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export async function extractDocxText(file: File): Promise<ExtractedDocxText> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = normalizeDocxText(result.value);
  const wordCount = getWordCount(text);

  if (!text || wordCount === 0) {
    throw new Error('No readable text found in this DOCX.');
  }

  return {
    text,
    wordCount,
  };
}
