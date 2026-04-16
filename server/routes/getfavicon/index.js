import { resolve } from 'path';

import express from 'express';

import * as cheerio from 'cheerio';

import { isICO } from 'icojs';

import { extractFullHead, getDirname, isurl, tplReplace, writelog } from '../../utils/utils.js';

import appConfig from '../../data/config.js';

import _f from '../../utils/f.js';

import timedTask from '../../utils/timedTask.js';
import { convertImageFormat, iconToPng } from '../../utils/img.js';
import _crypto from '../../utils/crypto.js';
import { cleanFavicon } from '../bmk/bmk.js';
import { _d } from '../../data/data.js';
import { fieldLength } from '../config.js';
import V from '../../utils/validRules.js';
import request from '../../utils/request.js';
import resp from '../../utils/response.js';
import { asyncHandler, openCors, validate } from '../../utils/customMiddleware.js';

const route = express.Router();

const __dirname = getDirname(import.meta);

const defaultIcon = resolve(__dirname, '../../img/default-icon.png');

// 定期清理图标缓存
timedTask.add(async (flag) => {
  if (flag.slice(-6) === '002000') {
    await cleanFavicon();
  }
});

// 下载图片
async function downloadImage(url) {
  // console.log('download', url);
  try {
    const res = await request({
      method: 'get',
      url,
      responseType: 'arraybuffer',
      maxContentLength: 500 * 1024,
    });

    const type = (res.headers?.['content-type'] || '').toLowerCase();

    if (res.data && res.data.length > 0 && type.startsWith('image/')) {
      return res.data;
    }
    return null;
  } catch {
    return null;
  }
}

// 提取 icon
function extractIconUrl($, baseUrl) {
  if (!$) return '';

  const icons = [];
  for (const el of $('link')) {
    const attrs = el.attribs;
    const rel = (attrs.rel || '').toLowerCase();
    const href = attrs.href;
    const sizes = attrs.sizes;

    if (!href || /^data:image/i.test(href)) continue;

    const isIcon =
      rel.includes('icon') ||
      rel === 'apple-touch-icon' ||
      rel === 'mask-icon' ||
      rel === 'fluid-icon';

    if (!isIcon) continue;

    let score = 0;

    // 类型权重
    if (rel === 'apple-touch-icon') score += 10000;
    if (rel === 'fluid-icon') score += 8000;
    if (rel === 'mask-icon') score += 6000;
    if (rel.includes('icon')) score += 3000;

    // size 权重
    if (sizes) {
      for (const s of sizes.split(/\s+/)) {
        const [w, h] = s.split('x').map(Number);
        if (w && h) score += w * h;
      }
    } else if (rel === 'apple-touch-icon') {
      score += 180 * 180;
    }

    try {
      const absUrl = new URL(href, baseUrl).href;
      icons.push({ href: absUrl, score });
    } catch {}
  }

  // console.log('icons', icons);
  if (!icons.length) return '';

  icons.sort((a, b) => b.score - a.score);
  return icons[0].href;
}

route.get(
  '/',
  openCors,
  validate(
    'query',
    V.object({
      u: V.string().trim().min(2).max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    const urlStr = res.locals.ctx.u;

    // 检查接口是否开启
    if (!_d.pubApi.faviconApi && !res.locals.hello.userinfo.account) {
      return resp.forbidden(res, '接口未开放')();
    }

    let protocol = 'https:'; // 默认https
    const url = `${urlStr.startsWith('http') ? '' : `${protocol}//`}${urlStr}`;

    if (!isurl(url)) {
      return resp.badRequest(res)('url 格式错误', 1);
    }

    let iconPath = '',
      missFlagPath = '';

    try {
      const { host } = new URL(url);

      iconPath = appConfig.faviconDir(`${_crypto.getStringHash(host)}.png`);

      missFlagPath = `${iconPath}.miss`;

      if ((await _f.getType(iconPath)) === 'file') {
        res.sendFile(iconPath, { dotfiles: 'allow' });
        return;
      }

      // miss 防抖
      if ((await _f.getType(missFlagPath)) === 'file') {
        const stat = await _f.lstat(missFlagPath);
        if (Date.now() - stat.mtimeMs > 60 * 1000) {
          await _f.del(missFlagPath);
        } else {
          res.sendFile(defaultIcon, { dotfiles: 'allow' });
          return;
        }
      }

      let iconBuf = null;
      try {
        // 自行解析获取图标
        let htmlResp;
        try {
          htmlResp = await request.get(`${protocol}//${host}`);
        } catch {
          protocol = 'http:';
          htmlResp = await request.get(`${protocol}//${host}`);
        }

        const baseUrl = `${protocol}//${host}`;

        const type = (htmlResp.headers?.['content-type'] || '').toLowerCase();

        if (!type.includes('text/html')) {
          throw new Error('只允许获取HTML文件');
        }

        const head = extractFullHead(htmlResp.data);
        if (_f.getTextSize(head) > 300 * 1024) {
          throw new Error('HTML文件过大');
        }

        const $ = cheerio.load(head);
        const iconUrl = extractIconUrl($, baseUrl) || new URL('/favicon.ico', baseUrl).href;

        iconBuf = await downloadImage(iconUrl);

        if (!iconBuf) {
          throw new Error('解析获取图标失败');
        }
      } catch (err) {
        // 调用备用接口获取图标
        if (_d.faviconSpareApi) {
          iconBuf = await downloadImage(
            tplReplace(_d.faviconSpareApi, {
              host: encodeURIComponent(host),
            }),
          );
          if (!iconBuf) {
            throw new Error('备用接口获取图标失败');
          }
        } else {
          throw err;
        }
      }

      if (iconBuf) {
        try {
          if (isICO(iconBuf)) {
            iconBuf = await iconToPng(iconBuf);
          }
          const buf = await convertImageFormat(iconBuf, {
            format: 'png',
            width: 200,
            height: 200,
            fit: 'cover',
          });

          if (buf) {
            await _f.writeFile(iconPath, buf);
          } else {
            throw new Error('转换图标失败');
          }
        } catch (error) {
          throw new Error(`转换图标失败: ${error}`);
        }
        res.sendFile(iconPath, { dotfiles: 'allow' });
      } else {
        throw new Error(`获取图标失败`);
      }
    } catch (error) {
      if (missFlagPath) {
        try {
          await _f.writeFile(missFlagPath, '');
        } catch (err) {
          await writelog(res, err, 500);
        }
      }

      await writelog(res, error, 403);

      res.sendFile(defaultIcon, { dotfiles: 'allow' });
    }
  }),
);

export default route;
