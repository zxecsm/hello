import fs from 'fs';
import { resolve } from 'path';
import sharp from 'sharp';
import { getDirname } from '../src/utils/common/utils.js';

const __dirname = getDirname(import.meta);

// scripts/gicon.js -> 仓库根目录
const rootDir = resolve(__dirname, '../..');
const basePath = resolve(rootDir, 'web/src');
const expandedPath = resolve(rootDir, 'expand');
const iconSrcDir = resolve(__dirname, '../src/resources/icons');

const visibleIcon = fs.readFileSync(resolve(iconSrcDir, 'icon-visible.svg'));
const hiddenIcon = fs.readFileSync(resolve(iconSrcDir, 'icon-hidden.svg'));
const notifyIcon = fs.readFileSync(resolve(iconSrcDir, 'icon-notify.svg'));
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
  console.log('图标已生成');
});
