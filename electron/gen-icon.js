/**
 * Generates a Windows .ico file from the project logo using sharp.
 * Builds the ICO binary manually (1 image: 256x256 RGBA PNG).
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const logoSrc = path.join(__dirname, '..', 'frontend', 'public', 'logo.jpg');
const icoOut = path.join(__dirname, 'assets', 'icon.ico');

if (fs.existsSync(icoOut)) {
  console.log('icon.ico already exists, skipping.');
  process.exit(0);
}

async function buildIco() {
  console.log('Generating icon.ico from logo.jpg...');

  // Resize logo to 256x256 PNG
  const pngBuf = await sharp(logoSrc)
    .resize(256, 256, { fit: 'cover' })
    .ensureAlpha()
    .png()
    .toBuffer();

  // Build ICO file header manually
  // ICO format: ICONDIR + ICONDIRENTRY[] + PNG data
  const numImages = 1;
  const headerSize = 6;           // ICONDIR
  const entrySize = 16;           // ICONDIRENTRY per image
  const dataOffset = headerSize + entrySize * numImages;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);       // reserved (0)
  header.writeUInt16LE(1, 2);       // type (1 = ICO)
  header.writeUInt16LE(numImages, 4); // image count

  const entry = Buffer.alloc(entrySize);
  entry.writeUInt8(0, 0);           // width (0 = 256)
  entry.writeUInt8(0, 1);           // height (0 = 256)
  entry.writeUInt8(0, 2);           // color count (0 = >256)
  entry.writeUInt8(0, 3);           // reserved
  entry.writeUInt16LE(1, 4);        // color planes
  entry.writeUInt16LE(32, 6);       // bits per pixel
  entry.writeUInt32LE(pngBuf.length, 8);  // size of image data
  entry.writeUInt32LE(dataOffset, 12);    // offset of image data

  const ico = Buffer.concat([header, entry, pngBuf]);
  fs.writeFileSync(icoOut, ico);
  console.log(`✅ icon.ico created (${ico.length} bytes)`);
}

buildIco().catch(err => {
  console.warn('Icon generation failed (non-fatal):', err.message);
  process.exit(0);
});
