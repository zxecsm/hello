import fs from 'fs';
import sharp from 'sharp';

const basePath = '../../web/src';

const svg = fs.readFileSync('./icon.svg');
const svg1 = fs.readFileSync('./icon1.svg');
const sizes = [48, 72, 96, 192, 512];
async function generateIcons() {
  for (const size of sizes) {
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(`${basePath}/icons/icon-${size}.png`);
  }

  await sharp(svg)
    .resize(16, 16)
    .png()
    .toFile(`${basePath}/images/img/icon.png`);
  await sharp(svg1)
    .resize(16, 16)
    .png()
    .toFile(`${basePath}/images/img/icon1.png`);
  await sharp(svg).resize(256, 256).toFile(`${basePath}/favicon.ico`);
}

generateIcons().then(() => {
  // eslint-disable-next-line no-console
  console.log('✅ 图标已生成');
});
