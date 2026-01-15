import { createWorker } from 'tesseract.js';

export async function extractTextFromImage(base64: string): Promise<string> {
  const worker = createWorker();
  try {
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text } } = await worker.recognize(base64);
    await worker.terminate();
    return text || '';
  } catch (err) {
    try { await worker.terminate(); } catch (e) {}
    throw err;
  }
}
