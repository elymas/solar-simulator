// One-time input for `npx @vite-pwa/assets-generator` (T-002). Not a runtime
// file — the generator reads this to emit public/icons/*.png from icon.svg.
// Custom preset (not a built-in one) because REQ-PWA-101 needs maskable at
// BOTH 192 and 512, and the default white padding fill fights the app's dark
// (#0a0a0f) theme for the maskable/apple variants.
const iconBackground = '#0a0a0f';

export default {
  preset: {
    transparent: {
      sizes: [192, 512],
      resizeOptions: { background: iconBackground },
    },
    maskable: {
      sizes: [192, 512],
      resizeOptions: { background: iconBackground },
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { background: iconBackground },
    },
  },
  images: ['public/icons/icon.svg'],
};
