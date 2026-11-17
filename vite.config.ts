/// <reference types="vitest" />
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

interface NodeFsModule {
  existsSync(path: string): boolean;
  readdirSync(path: string, options: { withFileTypes: true }): Array<{
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }>;
  readFileSync(path: string): Uint8Array;
  writeFileSync(path: string, data: Uint8Array): void;
}

interface NodePathModule {
  resolve(...paths: string[]): string;
  join(...paths: string[]): string;
  extname(path: string): string;
}

interface NodeZlibModule {
  constants: { BROTLI_PARAM_QUALITY: number };
  gzipSync(buf: Uint8Array, options?: { level?: number }): Uint8Array;
  brotliCompressSync(
    buf: Uint8Array,
    options?: { params?: Record<number, number> }
  ): Uint8Array;
}

const COMPRESSIBLE_EXTENSIONS = new Set(['.js', '.css', '.html', '.svg']);

function precompressAssetsPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | null = null;

  return {
    name: 'rua-escura-precompress',
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config;
    },
    async closeBundle() {
      const [fs, path, zlib] = (await Promise.all([
        import(/* @vite-ignore */ ('node:fs' as string)),
        import(/* @vite-ignore */ ('node:path' as string)),
        import(/* @vite-ignore */ ('node:zlib' as string)),
      ])) as [NodeFsModule, NodePathModule, NodeZlibModule];

      const outDir = resolvedConfig
        ? path.resolve(resolvedConfig.root, resolvedConfig.build.outDir)
        : path.resolve('dist');

      if (!fs.existsSync(outDir)) return;

      const walkAndCompress = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkAndCompress(fullPath);
            continue;
          }
          if (!entry.isFile()) continue;
          const ext = path.extname(entry.name).toLowerCase();
          if (!COMPRESSIBLE_EXTENSIONS.has(ext)) continue;

          const source = fs.readFileSync(fullPath);
          const gzipped = zlib.gzipSync(source, { level: 9 });
          const brotli = zlib.brotliCompressSync(source, {
            params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
          });

          fs.writeFileSync(`${fullPath}.gz`, gzipped);
          fs.writeFileSync(`${fullPath}.br`, brotli);
        }
      };

      walkAndCompress(outDir);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), precompressAssetsPlugin()],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ['leaflet'],
          motion: ['motion'],
          zod: ['zod'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
