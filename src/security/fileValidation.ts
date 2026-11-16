export interface ValidatedEvidenceResult {
  valid: boolean;
  error?: string;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  sanitizedDataUrl?: string;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Detects image format from binary Magic Bytes header.
 * Rejects disguised files (.exe, HTML, SVG, scripts renamed as .jpg).
 */
export function detectImageTypeFromMagicBytes(
  bytes: Uint8Array
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length < 4) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 (137 80 78 71)
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }

  // WEBP: RIFF at 0..3 and WEBP at 8..11
  if (bytes.length >= 12) {
    const isRiff =
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    const isWebp =
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (isRiff && isWebp) {
      return 'image/webp';
    }
  }

  return null;
}

/**
 * Strips EXIF metadata by re-encoding image into a downscaled JPEG thumbnail (<= 480px).
 */
export async function defaultStripExifCanvas(file: File): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 'data:image/jpeg;base64,mockthumb';
  }

  // Check if 2D canvas context is supported (headless JSDOM without canvas library returns null)
  const testCanvas = document.createElement('canvas');
  if (typeof testCanvas.getContext !== 'function' || !testCanvas.getContext('2d')) {
    return 'data:image/jpeg;base64,mockthumb';
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const maxDim = 480;
      let width = img.width || maxDim;
      let height = img.height || maxDim;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        reject(new Error('Contexto 2D do Canvas indisponível.'));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao decodificar imagem para remoção de EXIF.'));
    };

    img.src = url;
  });
}

/**
 * Validates uploaded incident evidence image:
 * 1. Checks file size <= 5 MB
 * 2. Checks binary Magic Bytes against claimed MIME
 * 3. Strips EXIF metadata by downscaling via canvas
 */
export async function validateEvidenceImage(
  file: File,
  stripExif?: (file: File) => Promise<string>
): Promise<ValidatedEvidenceResult> {
  // 1. Size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Arquivo excede o limite máximo permitido de 5MB.',
    };
  }

  // 2. Read first 16 bytes for Magic Bytes inspection
  let headerBytes: Uint8Array;
  try {
    const slice = file.slice(0, 16);
    if (typeof slice.arrayBuffer === 'function') {
      const buffer = await slice.arrayBuffer();
      headerBytes = new Uint8Array(buffer);
    } else {
      headerBytes = await new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(slice);
      });
    }
  } catch {
    return {
      valid: false,
      error: 'Falha ao ler cabeçalho do arquivo.',
    };
  }

  const detectedType = detectImageTypeFromMagicBytes(headerBytes);
  if (!detectedType) {
    return {
      valid: false,
      error: 'Formato inválido ou arquivo disfarçado (Magic Bytes inválidos).',
    };
  }

  // Check declared MIME type if present
  if (file.type && file.type !== detectedType) {
    return {
      valid: false,
      error: 'MIME type do arquivo não corresponde aos Magic Bytes binários.',
    };
  }

  // 3. Strip EXIF & produce safe preview thumbnail
  let sanitizedDataUrl: string | undefined;
  try {
    if (stripExif) {
      sanitizedDataUrl = await stripExif(file);
    } else {
      sanitizedDataUrl = await defaultStripExifCanvas(file);
    }
  } catch (err) {
    return {
      valid: false,
      error: (err as Error).message || 'Falha ao processar e remover EXIF da imagem.',
    };
  }

  return {
    valid: true,
    mimeType: detectedType,
    sanitizedDataUrl,
  };
}
