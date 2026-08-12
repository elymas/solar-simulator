import { defineConfig } from 'vitest/config';

// Separate config for test/pwa.build.spec.js (D-4, SPEC-PWA-001): the default
// vitest.config.js only includes *.test.js so the ~2.2s / 197-test default
// suite (`npm test`) is unaffected. This one targets the *.spec.js build
// artifact suite only, reading dist/ as plain text — no DOM needed.
export default defineConfig({
  test: {
    include: ['test/pwa.build.spec.js'],
    environment: 'node',
  },
});
