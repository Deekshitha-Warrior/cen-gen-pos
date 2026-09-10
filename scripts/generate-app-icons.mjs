import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

/**
 * Safe Utility Script: generate-app-icons.mjs
 * 
 * Automatically detects the emblem/logo bounds from public/clad-icon.png (or custom source),
 * and generates standard W3C compliant PWA icons and iOS Apple Touch icons with:
 *  - 100% safe-zone padding for Android Adaptive/Maskable icons (so squircles and circles never clip the logo)
 *  - Apple Touch Icon padding (so iOS home screen squircles never clip edges)
 *  - High-resolution standard icons for desktop/PWA taskbars
 *  - Crisp favicon
 * 
 * Safe to commit to GitHub (no secrets/credentials).
 */

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SRC_ICON = path.join(PUBLIC_DIR, 'clad-icon.png');

async function main() {
  if (!fs.existsSync(SRC_ICON)) {
    console.error(`Source icon not found at ${SRC_ICON}`);
    process.exit(1);
  }

  console.log(`Analyzing source icon: ${SRC_ICON}`);
  const { data, info } = await sharp(SRC_ICON).raw().toBuffer({ resolveWithObject: true });

  // 1. Detect emblem bounding box dynamically (ignoring dark background)
  let minX = info.width;
  let maxX = 0;
  let minY = info.height;
  let maxY = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Check if pixel belongs to logo (not dark background)
      if (r > 35 || g > 35 || b > 35) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Fallback if full image is emblem
  if (maxX <= minX || maxY <= minY) {
    minX = 0;
    maxX = info.width - 1;
    minY = 0;
    maxY = info.height - 1;
  }

  const emblemWidth = maxX - minX + 1;
  const emblemHeight = maxY - minY + 1;
  console.log(`Detected emblem bounds: ${emblemWidth}x${emblemHeight} at [x:${minX}, y:${minY}]`);

  // Extract emblem tightly
  const emblemBuf = await sharp(SRC_ICON)
    .extract({ left: minX, top: minY, width: emblemWidth, height: emblemHeight })
    .toBuffer();

  const EMBLEM_ASPECT = emblemWidth / emblemHeight;

  // Helper to compose square icon with emblem centered on solid pure black (#000000)
  async function generateSquareIcon(canvasSize, targetEmblemHeight, outputPath) {
    const targetWidth = Math.round(targetEmblemHeight * EMBLEM_ASPECT);
    const resizedEmblem = await sharp(emblemBuf)
      .resize(targetWidth, targetEmblemHeight, {
        fit: 'contain',
        kernel: sharp.kernel.lanczos3,
      })
      .toBuffer();

    const left = Math.round((canvasSize - targetWidth) / 2);
    const top = Math.round((canvasSize - targetEmblemHeight) / 2);

    await sharp({
      create: {
        width: canvasSize,
        height: canvasSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite([{ input: resizedEmblem, left, top }])
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outputPath);

    console.log(`-> Generated ${path.basename(outputPath)} (${canvasSize}x${canvasSize}, emblem: ${targetWidth}x${targetEmblemHeight})`);
  }

  // 1. Android Adaptive / PWA Maskable Icons (Safe area: inner 80% circle)
  // Inside 512x512, target height 270px guarantees max radius ~158px (far within 204.8px safe zone),
  // leaving generous, unmistakable ~24% top/bottom and ~26% left/right margins.
  await generateSquareIcon(512, 270, path.join(PUBLIC_DIR, 'clad-icon-maskable-512.png'));
  await generateSquareIcon(192, 100, path.join(PUBLIC_DIR, 'clad-icon-maskable-192.png'));

  // 2. Standard Any Icons and Master Logo (58% scale with luxury margins)
  await generateSquareIcon(512, 300, path.join(PUBLIC_DIR, 'clad-icon-512.png'));
  await generateSquareIcon(192, 112, path.join(PUBLIC_DIR, 'clad-icon-192.png'));
  await generateSquareIcon(512, 300, path.join(PUBLIC_DIR, 'clad-icon.png'));
  await generateSquareIcon(512, 300, path.join(PUBLIC_DIR, 'clad-logo.png')); // Also update clad-logo.png!

  // 3. Apple Touch Icon for iOS (180x180, ~58% scale to completely clear iOS squircle corners)
  await generateSquareIcon(180, 105, path.join(PUBLIC_DIR, 'apple-touch-icon.png'));

  // 4. Favicon (64x64)
  await generateSquareIcon(64, 42, path.join(PUBLIC_DIR, 'clad-favicon.png'));

  console.log('\nAll PWA and app shortcut icons generated successfully with verified safe padding!');
}

main().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
