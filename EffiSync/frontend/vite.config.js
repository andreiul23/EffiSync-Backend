import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '..',
  // Strip console.* and debugger statements from the production bundle.
  // Errors still surface via the global ErrorBoundary; keeps bundle small
  // and avoids leaking dev-time logs to end users.
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'vendor-react';
          }

          if (id.includes('three') || id.includes('ogl') || id.includes('motion')) {
            return 'vendor-graphics';
          }

          return 'vendor-misc';
        },
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "src/styles/variables"; @import "src/styles/mixins";\n`,
        quietDeps: true,
        silenceDeprecations: ['legacy-js-api', 'import'],
      }
    }
  }
});
