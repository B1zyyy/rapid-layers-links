// Generates the web-ready brand images from the original logo file.
// Run once after replacing brand/rapid-layers-logo-original.jpg:  npm run brand:assets
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SOURCE = 'brand/rapid-layers-logo-original.jpg';
const OUT_ASSETS = 'src/assets/brand';
const OUT_PUBLIC = 'public';

// Square crop around the lightning-bolt mark (measured on the 1600×1600 original).
// The bolt spans roughly x 616–984, y 365–907; this box keeps it centred with breathing room
// so it sits comfortably inside the circular avatar.
const MARK_CROP = { left: 455, top: 291, width: 690, height: 690 };

// Crop that keeps the bolt plus the "RAPID LAYERS" wordmark, used for the social share image.
const FULL_CROP = { left: 300, top: 300, width: 1000, height: 810 };

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

await mkdir(OUT_ASSETS, { recursive: true });
await mkdir(OUT_PUBLIC, { recursive: true });

const mark = () => sharp(SOURCE).extract(MARK_CROP);

// Header avatar: displayed at 96 CSS px, exported at 3× for sharp phone screens.
await mark().resize(288, 288).webp({ quality: 88 }).toFile(`${OUT_ASSETS}/mark-288.webp`);
await mark().resize(288, 288).png({ compressionLevel: 9 }).toFile(`${OUT_ASSETS}/mark-288.png`);

// Favicons and home-screen icon.
await mark().resize(32, 32).png().toFile(`${OUT_PUBLIC}/favicon-32.png`);
await mark().resize(192, 192).png().toFile(`${OUT_PUBLIC}/icon-192.png`);
await mark().resize(180, 180).png().toFile(`${OUT_PUBLIC}/apple-touch-icon.png`);

// Open Graph image (1200×630) — full logo with wordmark on white.
const full = await sharp(SOURCE).extract(FULL_CROP).resize({ height: 560 }).toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: WHITE } })
  .composite([{ input: full, gravity: 'center' }])
  .jpeg({ quality: 86 })
  .toFile(`${OUT_PUBLIC}/og-image.jpg`);

console.log('Brand assets generated.');
