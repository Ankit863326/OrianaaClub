import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const frontendDirectory = fileURLToPath(new URL('.', import.meta.url));

function productionFallbackOrigin(siteUrl) {
  const site = new URL(siteUrl);
  if (!['http:', 'https:'].includes(site.protocol) || site.pathname !== '/' || site.search || site.hash) {
    throw new Error('VITE_SITE_URL must be an HTTP(S) origin without a path.');
  }
  const origin = site.origin;
  return {
    name: 'replace-library-localhost-fallback',
    enforce: 'post',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') output.code = output.code.replaceAll('http://localhost', origin);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const { VITE_SITE_URL: siteUrl } = loadEnv(mode, frontendDirectory, 'VITE_');
  if (!siteUrl) throw new Error('VITE_SITE_URL must be configured for the current Vite mode.');
  return {
    plugins: [react(), tailwindcss(), productionFallbackOrigin(siteUrl)],
    server: { port: 5173, strictPort: true },
    build: { sourcemap: false },
    resolve: {
      alias: {
        '@': path.resolve(frontendDirectory, './src'),
      },
    },
  };
});