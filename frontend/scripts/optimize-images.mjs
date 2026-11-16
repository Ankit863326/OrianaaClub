import sharp from 'sharp';
import { readdir, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'src', 'assets');
const outputDir = path.join(__dirname, '..', 'public', 'images', 'optimized');

await mkdir(outputDir, { recursive: true });

const files = await readdir(assetsDir);
const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));

console.log(`Found ${imageFiles.length} images to process...`);

for (const file of imageFiles) {
  const inputPath = path.join(assetsDir, file);
  const baseName = path.basename(file, path.extname(file));
  const outputPath = path.join(outputDir, `${baseName}.webp`);

  try {
    const info = await sharp(inputPath)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outputPath);

    console.log(`✅ Converted: ${file} → ${baseName}.webp (${Math.round(info.size / 1024)}KB)`);
  } catch (err) {
    console.error(`❌ Failed: ${file} — ${err.message}`);
  }
}

console.log('\nDone!');
