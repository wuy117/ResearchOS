import { getWordCount } from './chunkText';

export type ExtractedImageText = {
  text: string;
  wordCount: number;
  confidence: number;
};

type PromiseWithResolvers<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const MIN_OCR_CONFIDENCE = 35;
const IMAGE_OCR_ERROR = "This image doesn't appear to contain readable text. Try a higher-quality image.";

function installSafariImageUploadCompat() {
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

function normalizeOcrText(text: string) {
  return text.replace(/[ \t]+/g, ' ').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function extractImageText(file: File): Promise<ExtractedImageText> {
  installSafariImageUploadCompat();

  let result: Awaited<ReturnType<typeof import('tesseract.js')['recognize']>>;

  try {
    const { recognize } = await import('tesseract.js');
    result = await recognize(file, 'eng', {
      logger: (message) => {
        if (import.meta.env.DEV && message.status) {
          console.debug(`[OCR] ${message.status}`, Math.round((message.progress ?? 0) * 100));
        }
      },
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[OCR] extraction failed', error);
    }
    throw new Error(IMAGE_OCR_ERROR);
  }

  const text = normalizeOcrText(result.data.text ?? '');
  const wordCount = getWordCount(text);
  const confidence = Number.isFinite(result.data.confidence) ? result.data.confidence : 0;

  if (!text || wordCount === 0 || confidence < MIN_OCR_CONFIDENCE) {
    throw new Error(IMAGE_OCR_ERROR);
  }

  return {
    text,
    wordCount,
    confidence,
  };
}

export function isSupportedImageFile(file: File, fileName = file.name) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return file.type.startsWith('image/') || extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'heic';
}
