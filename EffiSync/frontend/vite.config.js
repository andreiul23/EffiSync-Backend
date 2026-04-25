import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '..',
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
