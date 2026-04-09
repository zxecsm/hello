import { resolve } from 'path';

import express from 'express';

import * as cheerio from 'cheerio';

import {
  errLog,
  extractFullHead,
  getDirname,
  isurl,
  tplReplace,
  uLog,
  validate,
} from '../../utils/utils.js';

import appConfig from '../../data/config.js';

import _f from '../../utils/f.js';

import timedTask from '../../utils/timedTask.js';
import { convertImageFormat } from '../../utils/img.js';
import _crypto from '../../utils/crypto.js';
import { cleanFavicon } from '../bmk/bmk.js';
import { _d } from '../../data/data.js';
import { fieldLength } from '../config.js';
import V from '../../utils/validRules.js';
import { sym } from '../../utils/symbols.js';
import request from '../../utils/request.js';
import resp from '../../utils/response.js';

const route = express.Router();

const __dirname = getDirname(import.meta);

const defaultIcon = resolve(__dirname, '../../img/default-icon.png');

const kHello = sym('hello');
const kValidate = sym('validate');

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
  validate(
    'query',
    V.object({
      u: V.string().trim().min(2).max(fieldLength.url),
    }),
  ),
  async (req, res) => {
    try {
      const urlStr = req[kValidate].u;

      // 检查接口是否开启
      if (!_d.pubApi.faviconApi && !req[kHello].userinfo.account) {
        return resp.forbidden(res, '接口未开放')(req, urlStr, 1);
      }

      let protocol = 'https:'; // 默认https
      const url = `${urlStr.startsWith('http') ? '' : `${protocol}//`}${urlStr}`;

      if (!isurl(url)) {
        resp.badRequest(res, req, 'url 格式错误', { url });
        return;
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
            throw new Error(`解析获取图标失败: ${iconUrl}`);
          }
        } catch (err) {
          // 调用备用接口获取图标
          if (_d.faviconSpareApi) {
            await uLog(req, `调用备用接口获取图标(${urlStr})`);

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
            const buf = await convertImageFormat(iconBuf, {
              format: 'png',
              width: 200,
              height: 200,
              fit: 'cover',
            });

            if (buf) {
              await _f.writeFile(iconPath, buf);
            }
          } catch (error) {
            await errLog(req, `${error}(${urlStr})`);
            await _f.writeFile(iconPath, iconBuf);
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
            await errLog(req, `${err}(${urlStr})`);
          }
        }

        await errLog(req, `${error}(${urlStr})`);

        res.sendFile(defaultIcon, { dotfiles: 'allow' });
      }
    } catch (error) {
      resp.error(res)(req, error);
    }
  },
);

export default route;
