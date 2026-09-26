import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates the PWA / favicon PNGs in public/ from public/favicon.svg.
// Run `npm run generate-icons` after changing the logo, and commit the output.
const brandNavy = '#0b1d3a';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Maskable and Apple icons are shown full-bleed (cropped to a circle/squircle), so pad the
    // logo into the safe zone on a solid navy background (matching the header).
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background: brandNavy } },
    apple: { sizes: [180], padding: 0.2, resizeOptions: { background: brandNavy } },
  },
  images: ['public/favicon.svg'],
});
