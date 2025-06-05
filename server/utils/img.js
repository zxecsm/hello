import sharp from 'sharp';

import _f from './f.js';

sharp.cache(false);

// 压缩图片
export async function compressionImg(path, x = 400, y = 400, quality) {
  const inputBuf = await _f.fsp.readFile(path);
  const img = sharp(inputBuf);
  const meta = await img.metadata();
  const buf = await img
    .resize(x, y, { fit: 'inside' }) // 保持比例
    .png(
      ['gif', 'raw', 'tile'].includes(meta.format) || !quality
        ? {}
        : { quality }
    )
    .toBuffer();
  return buf;
}

// 读取图片信息
export async function getImgInfo(path) {
  const inputBuf = await _f.fsp.readFile(path);
  const img = sharp(inputBuf);
  return img.metadata();
}

// 计算图片压缩尺寸
export function getCompressionSize(type) {
  let x = 400,
    y = 400;
  if (type === 'pic') {
    x = y = 500;
  } else if (type === 'bg') {
    x = 600;
  } else if (type === 'bgxs') {
    y = 800;
  }
  return { x, y };
}
