import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { getWordCount } from './chunkText';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
  wordCount: number;
};

export type ExtractedPdfText = {
  text: string;
  pages: ExtractedPdfPage[];
  wordCount: number;
};

function isTextItem(item: unknown): item is TextItem {
  return Boolean(item && typeof item === 'object' && 'str' in item && typeof (item as TextItem).str === 'string');
}

function normalizePageText(text: string) {
  return text.replace(/[ \t]+/g, ' ').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function extractPdfText(file: File): Promise<ExtractedPdfText> {
  const data = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages: ExtractedPdfPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = normalizePageText(
        textContent.items
          .filter(isTextItem)
          .map((item) => item.str)
          .join(' '),
      );

      pages.push({
        pageNumber,
        text,
        wordCount: getWordCount(text),
      });
      page.cleanup();
    }
  } finally {
    await pdf.cleanup();
    await loadingTask.destroy();
  }

  const text = pages
    .map((page) => `Page ${page.pageNumber}\n${page.text}`)
    .join('\n\n')
    .trim();

  return {
    text,
    pages,
    wordCount: pages.reduce((total, page) => total + page.wordCount, 0),
  };
}
