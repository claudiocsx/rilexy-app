const { Jimp, loadFont, HorizontalAlign, VerticalAlign, ResizeStrategy } = require('jimp');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets');
const SIZE = 1024;
const PURPLE = 0x7c3aedff;

const FONT_PATH = path.join(
  __dirname, '..',
  'node_modules', '@jimp', 'plugin-print', 'fonts', 'open-sans',
  'open-sans-128-white', 'open-sans-128-white.fnt'
);

async function main() {
  const font = await loadFont(FONT_PATH);

  // Render "R" at native font size on a temp canvas
  const tmp = new Jimp({ width: SIZE, height: SIZE, color: 0x00000000 });
  tmp.print({
    font,
    x: 0,
    y: 0,
    text: { text: 'R', alignmentX: HorizontalAlign.CENTER, alignmentY: VerticalAlign.MIDDLE },
    maxWidth: SIZE,
    maxHeight: SIZE,
  });

  // Find bounding box of non-transparent pixels
  let minX = SIZE, minY = SIZE, maxX = 0, maxY = 0;
  tmp.scan(0, 0, SIZE, SIZE, function (x, y, idx) {
    const a = this.bitmap.data[idx + 3];
    if (a > 0) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  });

  const charW = maxX - minX + 1;
  const charH = maxY - minY + 1;
  const margin = Math.round(SIZE * 0.2);
  const targetSize = SIZE - margin * 2;
  const scale = targetSize / Math.max(charW, charH);

  // Crop and scale up smoothly
  const charImg = tmp.clone();
  charImg.crop({ x: minX, y: minY, w: charW, h: charH });
  charImg.resize({ w: Math.round(charW * scale), h: Math.round(charH * scale), mode: ResizeStrategy.BICUBIC });
  const scaled = charImg;

  const cx = Math.round((SIZE - scaled.bitmap.width) / 2);
  const cy = Math.round((SIZE - scaled.bitmap.height) / 2);

  // iOS icon: purple bg + white R
  const icon = new Jimp({ width: SIZE, height: SIZE, color: PURPLE });
  icon.composite(scaled, cx, cy);
  await icon.write(path.join(ASSETS_DIR, 'icon.png'));
  console.log('✓ icon.png');

  // Android adaptive-icon foreground: transparent bg + white R
  const adaptive = new Jimp({ width: SIZE, height: SIZE, color: 0x00000000 });
  adaptive.composite(scaled, cx, cy);
  await adaptive.write(path.join(ASSETS_DIR, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png');

  console.log('Done');
}

main().catch(console.error);
