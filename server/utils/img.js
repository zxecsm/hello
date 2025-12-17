import sharp from 'sharp';

import _f from './f.js';

sharp.cache(false); // 禁用缓存，适合处理大量不同图片的场景

// 读取图片信息
export async function getImgInfo(path) {
  const inputBuf = await _f.fsp.readFile(path);
  const img = sharp(inputBuf);
  return img.metadata();
}

export async function convertImageFormat(
  path,
  { format, width, height, quality, fit = 'inside' } = {}
) {
  let inputBuf;
  try {
    inputBuf = await _f.fsp.readFile(path);
  } catch (err) {
    throw new Error(`读取文件失败: ${path} - ${err.message}`);
  }

  const img = sharp(inputBuf);
  const metadata = await img.metadata();
  const originFormat = metadata.format?.toLowerCase() || 'unknown';

  // 确定目标格式（未指定则保持原格式）
  const targetFormat = format ? format.toLowerCase() : originFormat;

  // 支持的输出格式映射
  const formatHandlers = {
    jpeg: (i, opts) => i.jpeg(opts),
    jpg: (i, opts) => i.jpeg(opts),
    png: (i, opts) => i.png(opts),
    webp: (i, opts) => i.webp(opts),
    avif: (i, opts) => i.avif(opts),
    tiff: (i, opts) => i.tiff(opts),
  };

  const handler = formatHandlers[targetFormat];
  if (!handler) {
    throw new Error(`不支持的目标格式: ${format || originFormat}`);
  }

  // 调整尺寸（仅在指定 width 或 height 时）
  if (width !== undefined || height !== undefined) {
    img.resize({
      width: width ?? null,
      height: height ?? null,
      fit,
      withoutEnlargement: true,
    });
  }

  // 构建压缩选项
  const compressionOptions = {};

  if (quality !== undefined && quality >= 1 && quality <= 100) {
    const isCompressibleSource = [
      'jpeg',
      'jpg',
      'webp',
      'avif',
      'tiff',
      'png',
    ].includes(originFormat);

    // 只有源图是可压缩格式时，才应用 quality（避免对 gif/heif 等无效设置）
    if (isCompressibleSource) {
      switch (targetFormat) {
        case 'png':
          // PNG compressionLevel: 0（最快）~9（最大压缩）
          compressionOptions.compressionLevel = Math.round(
            9 * (1 - quality / 100)
          );
          break;
        case 'jpeg':
        case 'jpg':
        case 'webp':
        case 'avif':
        case 'tiff':
          compressionOptions.quality = quality;
          break;
      }
    }
  }

  // 应用格式转换和压缩选项
  const processedImg = handler(img, compressionOptions);

  try {
    return await processedImg.toBuffer();
  } catch (err) {
    throw new Error(
      `图片转换失败 (${originFormat} → ${targetFormat}): ${err.message}`
    );
  }
}
