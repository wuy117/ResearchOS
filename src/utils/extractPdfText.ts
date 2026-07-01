import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { getWordCount } from './chunkText';

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

type PdfJsLib = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PromiseWithResolvers<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

let pdfjsLibPromise: Promise<PdfJsLib> | null = null;

function installSafariUploadCompat() {
  const promiseConstructor = Promise as PromiseConstructor & {
    withResolvers?: <T>() => PromiseWithResolvers<T>;
  };

  if (typeof promiseConstructor.withResolvers !== 'function') {
    promiseConstructor.withResolvers = <T,>() => {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
      });

      return { promise, resolve, reject };
    };
  }

  const arrayPrototype = Array.prototype as unknown as { at?: (index: number) => unknown };

  if (typeof arrayPrototype.at !== 'function') {
    Object.defineProperty(Array.prototype, 'at', {
      configurable: true,
      writable: true,
      value(index: number) {
        const length = this.length >>> 0;
        const relativeIndex = Math.trunc(index) || 0;
        const actualIndex = relativeIndex < 0 ? length + relativeIndex : relativeIndex;
        return actualIndex < 0 || actualIndex >= length ? undefined : this[actualIndex];
      },
    });
  }
}

async function getPdfJsLib() {
  installSafariUploadCompat();

  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();
      return pdfjsLib;
    });
  }

  return pdfjsLibPromise;
}

function isTextItem(item: unknown): item is TextItem {
  return Boolean(item && typeof item === 'object' && 'str' in item && typeof (item as TextItem).str === 'string');
}

function normalizePageText(text: string) {
  return text.replace(/[ \t]+/g, ' ').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function extractPdfText(file: File): Promise<ExtractedPdfText> {
  const pdfjsLib = await getPdfJsLib();
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
