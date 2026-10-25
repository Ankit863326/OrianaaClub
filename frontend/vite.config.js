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

export default defineConfig(({ command, mode }) => {
  const {
    VITE_BACKEND_URL: backendUrl,
    VITE_SITE_URL: siteUrl,
  } = loadEnv(mode, frontendDirectory, 'VITE_');
  const fallbackSiteUrl = siteUrl || (command === 'serve' ? 'http://localhost:5173' : undefined);
  if (!fallbackSiteUrl) throw new Error('VITE_SITE_URL must be configured for production builds.');
  const backendTarget = backendUrl || 'http://localhost:5000';
  return {
    plugins: [react(), tailwindcss(), productionFallbackOrigin(fallbackSiteUrl)],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: backendTarget, changeOrigin: true },
        '/terms': { target: backendTarget, changeOrigin: true },
      },
    },
    build: { sourcemap: false },
    resolve: {
      alias: {
        '@': path.resolve(frontendDirectory, './src'),
      },
    },
  };
});