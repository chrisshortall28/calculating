import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates the PWA / favicon PNGs in public/ from public/favicon.svg.
// Run `npm run generate-icons` after changing the logo, and commit the output.
const brandBlue = '#1c7ed6';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Maskable and Apple icons are shown full-bleed (cropped to a circle/squircle), so pad the
    // logo into the safe zone on a solid brand-coloured background.
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background: brandBlue } },
    apple: { sizes: [180], padding: 0.2, resizeOptions: { background: brandBlue } },
  },
  images: ['public/favicon.svg'],
});
