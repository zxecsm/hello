import fs from 'fs';
import sharp from 'sharp';

const basePath = '../../web/src';
const expandedPath = '../../expand';

const visibleIcon = fs.readFileSync('./icon-visible.svg');
const hiddenIcon = fs.readFileSync('./icon-hidden.svg');
const notifyIcon = fs.readFileSync('./icon-notify.svg');
const sizes = [48, 72, 96, 192, 512];
const expandedSizes = [16, 32, 48, 128];
async function generateIcons() {
  for (const size of sizes) {
    await sharp(visibleIcon).resize(size, size).png().toFile(`${basePath}/icons/icon-${size}.png`);
  }

  for (const size of expandedSizes) {
    await sharp(visibleIcon)
      .resize(size, size)
      .png()
      .toFile(`${expandedPath}/icons/icon-${size}.png`);
  }

  fs.writeFileSync(`${basePath}/images/img/icon-visible.svg`, visibleIcon);
  fs.writeFileSync(`${basePath}/images/img/icon-hidden.svg`, hiddenIcon);
  fs.writeFileSync(`${basePath}/images/img/icon-notify.svg`, notifyIcon);
  await sharp(visibleIcon).resize(256, 256).toFile(`${basePath}/favicon.ico`);
}

generateIcons().then(() => {
  // eslint-disable-next-line no-console
  console.log('✅ 图标已生成');
});
