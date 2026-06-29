import type { DocumentChunk } from '../types/research';

const DEFAULT_CHUNK_WORDS = 800;
const DEFAULT_OVERLAP_WORDS = 100;
type ChunkWord = { word: string; pageNumber?: number };
const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'because',
  'before',
  'between',
  'could',
  'first',
  'from',
  'have',
  'into',
  'more',
  'only',
  'other',
  'over',
  'should',
  'such',
  'than',
  'that',
  'their',
  'there',
  'these',
  'this',
  'through',
  'were',
  'when',
  'where',
  'which',
  'while',
  'with',
  'would',
]);

export function getWords(text: string) {
  return text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)?/g) ?? [];
}

export function getWordCount(text: string) {
  return getWords(text).length;
}

export function chunkText({
  text,
  documentId,
  pages,
  chunkWords = DEFAULT_CHUNK_WORDS,
  overlapWords = DEFAULT_OVERLAP_WORDS,
}: {
  text: string;
  documentId: string;
  pages?: { pageNumber: number; text: string }[];
  chunkWords?: number;
  overlapWords?: number;
}): DocumentChunk[] {
  const words: ChunkWord[] = pages?.length
    ? pages.flatMap((page) => getWords(page.text).map((word) => ({ word, pageNumber: page.pageNumber })))
    : getWords(text).map((word) => ({ word }));
  const chunks: DocumentChunk[] = [];
  const step = Math.max(1, chunkWords - overlapWords);
  const createdAt = new Date().toISOString();

  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + chunkWords);
    const pageNumbers = slice
      .map((word) => word.pageNumber)
      .filter((pageNumber): pageNumber is number => typeof pageNumber === 'number');

    if (slice.length === 0) {
      break;
    }

    chunks.push({
      id: `${documentId}-chunk-${chunks.length}`,
      documentId,
      chunkIndex: chunks.length,
      text: slice.map((word) => word.word).join(' '),
      wordCount: slice.length,
      pageStart: pageNumbers.length ? Math.min(...pageNumbers) : undefined,
      pageEnd: pageNumbers.length ? Math.max(...pageNumbers) : undefined,
      createdAt,
    });

    if (start + chunkWords >= words.length) {
      break;
    }
  }

  return chunks;
}

export function extractTopics(text: string, maxTopics = 6) {
  const counts = new Map<string, number>();

  getWords(text).forEach((word) => {
    const normalized = word.toLowerCase();

    if (normalized.length < 4 || STOP_WORDS.has(normalized)) {
      return;
    }

    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxTopics)
    .map(([word]) => word);
}

export function summarizeText(text: string, maxLength = 220) {
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) {
    return cleaned || 'No text content found.';
  }

  return `${cleaned.slice(0, maxLength).trim()}...`;
}
