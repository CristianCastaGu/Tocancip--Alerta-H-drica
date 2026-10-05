import { promises as fs } from 'fs';
import path from 'path';
import { AlertLevel } from './types';

const IMAGE_DIR = path.join(process.cwd(), 'public', 'whatsapp');

// Debe coincidir con LEVEL_PREVIEW_IMAGES de components/AlertModal.tsx
const LEVEL_IMAGES: Partial<Record<AlertLevel, string>> = {
  INFORMATIVO: 'preventivo.png',
  PREVENTIVO: 'preventivo.png',
};

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export interface AlertImage {
  base64: string;
  mimetype: string;
  fileName: string;
}

export async function loadLevelImage(level: AlertLevel): Promise<AlertImage | null> {
  const file = LEVEL_IMAGES[level];
  if (!file) return null;
  try {
    const buf = await fs.readFile(path.join(IMAGE_DIR, file));
    return {
      base64: buf.toString('base64'),
      mimetype: MIME[path.extname(file).toLowerCase()] ?? 'image/jpeg',
      fileName: file,
    };
  } catch (err) {
    console.error(`[whatsapp] No se pudo leer la imagen ${file}: ${(err as Error).message}`);
    return null; // si la imagen falla, se envía solo el texto
  }
}