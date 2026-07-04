import { defineConfig } from 'vitest/config';

// jsdom is required because PlanetFactory / PlanetList / InfoPanel construct
// real DOM and THREE.TextureLoader (which needs Image). Pure-logic tests run
// fine under jsdom too, so a single environment keeps config minimal.
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.test.js', 'src/**/*.test.js'],
  },
});
