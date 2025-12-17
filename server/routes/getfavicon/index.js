import express from 'express';

import { resolve } from 'path';

import cheerio from '../bmk/cheerio.js';

import axios from 'axios';

import {
  _err,
  errLog,
  extractFullHead,
  getDirname,
  isurl,
  paramErr,
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

const route = express.Router();

const __dirname = getDirname(import.meta);

const defaultIcon = resolve(__dirname, '../../img/default-icon.png');

// 定期清理图标缓存
timedTask.add(async (flag) => {
  if (flag.slice(-6) === '002000') {
    await cleanFavicon();
  }
});

// 下载图标
async function downFile(url, path) {
  const res = await axios({
    method: 'get',
    url,
    responseType: 'arraybuffer',
    timeout: 5000,
    maxContentLength: 500 * 1024,
  });

  if (res.data && res.data.length > 0) {
    await _f.writeFile(path, res.data);
  }
}

// 提取图标
function extractIconUrl($, host, protocol) {
  const prefix = `${protocol}//${host}`;
  const defaultIcon = `${prefix}/favicon.ico`;

  if (!$) return defaultIcon;

  for (const el of $('link')) {
    const { rel, href } = el.attribs;
    if (!href || !rel?.includes('icon') || /^data:image/i.test(href)) continue;
    if (/^http/i.test(href)) return href;
    // //aa.com/img/xxx.png
    if (/^\/\//.test(href)) return protocol + href;
    // /img/xxx.png
    if (/^\//.test(href)) return prefix + href;
    // ./img/xxx.png
    if (/^\./.test(href)) return prefix + href.slice(1);
    // img/xxx.png
    return `${prefix}/${href}`;
  }
  return defaultIcon;
}

route.get(
  '/',
  validate(
    'query',
    V.object({
      u: V.string().trim().min(1).max(fieldLength.url),
    })
  ),
  async (req, res) => {
    try {
      const urlStr = req._vdata.u;

      // 检查接口是否开启
      if (!_d.pubApi.faviconApi && !req._hello.userinfo.account) {
        return _err(res, '接口未开放')(req, urlStr, 1);
      }

      let protocol = 'https:'; // 默认https
      const url = `${
        urlStr.startsWith('http') ? '' : `${protocol}//`
      }${urlStr}`;

      if (!isurl(url)) {
        paramErr(res, req, 'url 格式错误', { url });
        return;
      }

      let iconPath = '',
        missFlagPath = '';

      try {
        const { host } = new URL(url);

        iconPath = appConfig.faviconDir(`${_crypto.getStringHash(host)}.png`);

        missFlagPath = `${iconPath}.miss`;

        if (await _f.exists(iconPath)) {
          res.sendFile(iconPath, { dotfiles: 'allow' });
          return;
        }

        if (await _f.exists(missFlagPath)) {
          res.sendFile(defaultIcon, { dotfiles: 'allow' });
          return;
        }

        try {
          // 自行解析获取图标
          let htmlResp;
          try {
            htmlResp = await axios.get(`${protocol}//${host}`, {
              timeout: 5000,
            });
          } catch {
            protocol = 'http:';
            htmlResp = await axios.get(`${protocol}//${host}`, {
              timeout: 5000,
            });
          }
          if (
            !htmlResp?.headers ||
            !htmlResp.headers['content-type']?.includes('text/html')
          ) {
            throw new Error('只允许获取HTML文件');
          }

          const head = extractFullHead(htmlResp.data);

          const $ =
            _f.getTextSize(head) > 300 * 1024 ? null : cheerio.load(head);

          await downFile(extractIconUrl($, host, protocol), iconPath);
        } catch (err) {
          // 调用备用接口获取图标
          if (_d.faviconSpareApi) {
            await downFile(
              tplReplace(_d.faviconSpareApi, {
                host,
              }),
              iconPath
            );

            await uLog(req, `调用备用接口获取图标(${urlStr})`);
          } else {
            throw err;
          }
        }

        if (await _f.exists(iconPath)) {
          try {
            const buf = await convertImageFormat(iconPath, {
              format: 'png',
              width: 100,
              height: 100,
            });

            if (buf) {
              await _f.writeFile(iconPath, buf);
            }
          } catch (error) {
            await errLog(req, `${error}(${urlStr})`);
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
      _err(res)(req, error);
    }
  }
);

export default route;
