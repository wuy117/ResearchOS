import type { DocumentChunk, ResearchDocument } from '../types/research';

export type RetrievedChunk = {
  chunk: DocumentChunk;
  document: ResearchDocument;
  score: number;
  matchedTerms: string[];
  reason: string;
  pageStart?: number;
  pageEnd?: number;
};

export type RetrieveChunksOptions = {
  topK?: number;
  minScore?: number;
};

const DEFAULT_TOP_K = 6;
const DEFAULT_MIN_SCORE = 2.2;
const HIGH_RELEVANCE_SCORE = 7;

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'but',
  'by',
  'can',
  'could',
  'did',
  'do',
  'does',
  'for',
  'from',
  'had',
  'has',
  'have',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'may',
  'might',
  'not',
  'of',
  'on',
  'or',
  'our',
  'should',
  'so',
  'than',
  'that',
  'the',
  'their',
  'there',
  'these',
  'this',
  'to',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
]);

function normalizeText(text: string) {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(text: string) {
  return normalizeText(text).match(/[a-z0-9]+(?:['-][a-z0-9]+)?/g) ?? [];
}

function normalizeTerm(term: string) {
  const normalized = normalizeText(term).replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');

  if (normalized.length > 4 && normalized.endsWith("'s")) {
    return normalized.slice(0, -2);
  }

  if (normalized.length > 5 && normalized.endsWith('ies')) {
    return `${normalized.slice(0, -3)}y`;
  }

  if (normalized.length > 4 && normalized.endsWith('s')) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

function getQueryTerms(query: string) {
  const terms = tokenize(query)
    .map(normalizeTerm)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));

  return [...new Set(terms)];
}

function getExactPhrase(query: string) {
  const significantTerms = tokenize(query).filter((term) => term.length > 2 && !STOP_WORDS.has(term));

  return significantTerms.length >= 2 ? significantTerms.join(' ') : '';
}

function countTerms(text: string) {
  const counts = new Map<string, number>();

  tokenize(text).forEach((token) => {
    const term = normalizeTerm(token);

    if (term.length > 2 && !STOP_WORDS.has(term)) {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  });

  return counts;
}

function pageKey(result: RetrievedChunk) {
  if (result.pageStart && result.pageEnd) {
    return `${result.chunk.documentId}:${result.pageStart}-${result.pageEnd}`;
  }

  return '';
}

function formatReason(parts: string[]) {
  if (parts.length === 0) {
    return 'Weak local keyword match';
  }

  return parts.slice(0, 3).join(', ');
}

export function retrieveChunks(
  query: string,
  chunks: DocumentChunk[],
  documents: ResearchDocument[],
  options: RetrieveChunksOptions = {},
): RetrievedChunk[] {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const terms = getQueryTerms(query);
  const exactPhrase = getExactPhrase(query);
  const documentById = new Map(documents.map((document) => [document.id, document]));

  if (!query.trim() || terms.length === 0 || topK <= 0) {
    return [];
  }

  const ranked = chunks
    .map((chunk): RetrievedChunk | null => {
      const document = documentById.get(chunk.documentId);

      if (!document) {
        return null;
      }

      const chunkCounts = countTerms(chunk.text);
      const titleCounts = countTerms(document.title);
      const tagCounts = countTerms(document.tags.join(' '));
      const matchedTerms = terms.filter((term) => chunkCounts.has(term) || titleCounts.has(term) || tagCounts.has(term));
      const reasonParts: string[] = [];
      let score = 0;

      terms.forEach((term) => {
        const chunkMatches = chunkCounts.get(term) ?? 0;
        const titleMatches = titleCounts.get(term) ?? 0;
        const tagMatches = tagCounts.get(term) ?? 0;

        if (chunkMatches > 0) {
          score += 1.25 + Math.min(chunkMatches - 1, 5) * 0.35;
        }

        if (titleMatches > 0) {
          score += 1.6;
        }

        if (tagMatches > 0) {
          score += 1.35;
        }
      });

      if (exactPhrase && normalizeText(chunk.text).includes(exactPhrase)) {
        score += 3.5;
        reasonParts.push('exact phrase match');
      }

      const overlapRatio = matchedTerms.length / terms.length;
      score += overlapRatio * 2.4;

      if (matchedTerms.some((term) => titleCounts.has(term))) {
        reasonParts.push('document title match');
      }

      if (matchedTerms.some((term) => tagCounts.has(term))) {
        reasonParts.push('tag/topic match');
      }

      if (matchedTerms.some((term) => chunkCounts.has(term))) {
        reasonParts.push(`${matchedTerms.length} query term${matchedTerms.length === 1 ? '' : 's'} in chunk`);
      }

      if (chunk.wordCount > 0 && chunk.wordCount <= 450) {
        score += 0.45;
      } else if (chunk.wordCount > 0 && chunk.wordCount <= 700) {
        score += 0.2;
      }

      if (matchedTerms.length === 0 || score < minScore) {
        return null;
      }

      const result: RetrievedChunk = {
        chunk,
        document,
        score,
        matchedTerms,
        reason: formatReason(reasonParts),
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
      };

      return result;
    })
    .filter((item): item is RetrievedChunk => Boolean(item))
    .sort((a, b) => b.score - a.score || b.matchedTerms.length - a.matchedTerms.length || a.chunk.chunkIndex - b.chunk.chunkIndex);

  const selected: RetrievedChunk[] = [];
  const usedPages = new Set<string>();

  for (const candidate of ranked) {
    const isAdjacent = selected.some((item) => item.chunk.documentId === candidate.chunk.documentId && Math.abs(item.chunk.chunkIndex - candidate.chunk.chunkIndex) <= 1);
    const duplicatePage = pageKey(candidate) && usedPages.has(pageKey(candidate));

    if ((isAdjacent || duplicatePage) && candidate.score < HIGH_RELEVANCE_SCORE) {
      continue;
    }

    selected.push(candidate);

    const key = pageKey(candidate);
    if (key) {
      usedPages.add(key);
    }

    if (selected.length >= topK) {
      break;
    }
  }

  if (selected.length < topK) {
    for (const candidate of ranked) {
      if (selected.some((item) => item.chunk.id === candidate.chunk.id)) {
        continue;
      }

      selected.push(candidate);

      if (selected.length >= topK) {
        break;
      }
    }
  }

  return selected;
}
