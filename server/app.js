import os from 'os';
import { resolve } from 'path';
// Cookie
import cookieParser from 'cookie-parser';

import express from 'express';

import * as cheerio from 'cheerio';

// 获取访问设备信息
import { UAParser } from 'ua-parser-js';

import {
  writelog,
  getIn,
  debounce,
  getDirname,
  isurl,
  uLog,
  parseJson,
  extractFullHead,
  errLog,
  validate,
} from './utils/utils.js';

import appConfig from './data/config.js';

import verifyLimit from './utils/verifyLimit.js';

import { heperMsgAndForward } from './routes/chat/chat.js';

import jwt from './utils/jwt.js';

import { getUserInfo } from './routes/user/user.js';

import initDatabase from './data/initDatabase.js';

import bgRoute from './routes/bg/index.js';
import bmkRoute from './routes/bmk/index.js';
import chatRoute from './routes/chat/index.js';
import countRoute from './routes/count/index.js';
import fileRoute from './routes/file/index.js';
import getfaviconRoute from './routes/getfavicon/index.js';
import noteRoute from './routes/note/index.js';
import notepadRoute from './routes/notepad/index.js';
import picRoute from './routes/pic/index.js';
import playerRoute from './routes/player/index.js';
import rootRoute from './routes/root/index.js';
import searchRoute from './routes/search/index.js';
import todoRoute from './routes/todo/index.js';
import userRoute from './routes/user/index.js';
import taskRoute from './routes/task/index.js';
import echoRoute from './routes/echo/index.js';
import sshRoute from './routes/ssh/index.js';
import { fieldLength } from './routes/config.js';
import getClientIp from './utils/getClientIp.js';
import getFile from './routes/getfile/index.js';
import { _d } from './data/data.js';
import _crypto from './utils/crypto.js';
import _f from './utils/f.js';
import { db } from './utils/sqlite.js';
import V from './utils/validRules.js';
import { sym } from './utils/symbols.js';
import getCity from './utils/getCity.js';
import request from './utils/request.js';
import resp from './utils/response.js';

const __dirname = getDirname(import.meta);
const kHello = sym('hello');
const kValidate = sym('validate');

const app = express();
app.disable('x-powered-by');

//  Cookie 解析
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(
  express.urlencoded({
    extended: true, // 支持复杂对象
    limit: '10mb',
  }),
);

app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); // 防止 MIME 类型嗅探
  res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // 防止 iframe 嵌套攻击
  next();
});

const staticOptions = {
  dotfiles: 'allow', // 允许访问 .xxx 文件
  maxAge: '7d', // 强缓存
  etag: true, // 文件指纹缓存
  lastModified: true, // 修改时间缓存
};
app.use(express.static(resolve(__dirname, 'static'), staticOptions));

// 同一ip在10秒内最多允许500个请求
const reqLimit = verifyLimit({ space: 10, count: 500 }, false);

const informReqLimit = debounce(
  async (req) => {
    try {
      const { os, ip } = req[kHello];
      await heperMsgAndForward(req, appConfig.adminAccount, `[${os}(${ip})] 请求频率超过限制`);
    } catch (error) {
      await writelog(req, `[ informReqLimit ] - ${error}`, 'error');
    }
  },
  5000,
  1,
);

app.use(async (req, res, next) => {
  try {
    const ip = getClientIp(req); // 客户端ip
    const method = req.method.toLocaleLowerCase(); // 请求类型
    // 身份验证
    const jwtData = await jwt.get(req.cookies.token);
    const userinfo = jwtData && jwtData.data.type === 'authentication' ? jwtData.data.data : {}; // 用户信息

    req[kHello] = {
      userinfo,
      path: decodeURIComponent(req.path),
      temid: '',
      ip,
      os: formatClientInfo(req.headers['user-agent']),
      method,
      jwtData,
    };

    if (req.headers['x-source-service'] === appConfig.appFlag) {
      resp.forbidden(res, '请求被禁止')(req);
      return;
    }

    // 客户端临时ID格式
    let temid = req.headers['x-tem-id'] || '';
    try {
      temid = await V.parse(
        temid,
        V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
        'temid',
      );
    } catch (error) {
      resp.badRequest(res, req, error, { temid });
      return;
    }

    req[kHello].temid = temid;

    // 限制请求频率
    const flag = userinfo.account || '';

    if (reqLimit.verify(ip, flag)) {
      reqLimit.add(ip, flag);

      await writelog(req, `${method}(${req[kHello].path})`);
      next();
    } else {
      informReqLimit(req);
      resp.forbidden(res, '请求频率超过限制')(req);
    }
  } catch (error) {
    await writelog(req, `[ app.use ] - ${error}`, 'error');
    resp.error(res);
  }
});

app.use('/api/font', express.static(appConfig.fontDir(), staticOptions));

app.use(async (req, res, next) => {
  try {
    const {
      temid,
      jwtData,
      userinfo: { account },
    } = req[kHello];

    req[kHello].userinfo = {}; // 清空用户信息

    if (
      jwtData &&
      jwtData.data.type === 'authentication' &&
      account &&
      account !== appConfig.notifyAccount
    ) {
      const { iat, exp } = jwtData; // token有效期范围
      const user = await getUserInfo(account, '*');

      //  对比token生成的时间
      if (user && (user.exp_token_time || 0) < iat) {
        if (temid) {
          // 客户端ID绑定账号
          req[kHello].temid = user.account + temid;
        }
        req[kHello].userinfo = user; // 验证身份成功，保存用户信息
        req[kHello].isRoot = user.account === appConfig.adminAccount;

        // token剩下一半时间到期，重置token
        if (Date.now() / 1000 - iat >= (exp - iat) / 2) {
          const { account, username } = req[kHello].userinfo;
          await jwt.setCookie(res, { account, username });
        }
      }
    }
    next();
  } catch (error) {
    await writelog(req, `[ app.use ] - ${error}`, 'error');
    resp.error(res);
  }
});

app.use('/api/user', userRoute);
app.use('/api/bg', bgRoute);
app.use('/api/pic', picRoute);
app.use('/api/root', rootRoute);
app.use('/api/player', playerRoute);
app.use('/api/bmk', bmkRoute);
app.use('/api/chat', chatRoute);
app.use('/api/search', searchRoute);
app.use('/api/note', noteRoute);
app.use('/api/todo', todoRoute);
app.use('/api/count', countRoute);
app.use('/api/file', fileRoute);
app.use('/api/notepad', notepadRoute);
app.use('/api/task', taskRoute);
app.use('/api/icon', getfaviconRoute);
app.use('/api/echo', echoRoute);
app.use('/api/ssh', sshRoute);

// 收信接口
app.all(
  '/api/s/:chat_id',
  validate(
    'params',
    V.object({
      chat_id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  async (req, res) => {
    try {
      const { method } = req[kHello];

      let text = '';
      if (method === 'get') {
        text = req.query.text;
      } else if (method === 'post') {
        text = req.body.text;

        if (!text) {
          text = req.query.text;
        }
      }

      const { chat_id } = req[kValidate];

      try {
        text = await V.parse(text, V.string().trim().min(1).max(fieldLength.chatContent), 'text');
      } catch (error) {
        resp.badRequest(res, req, error, { text });
      }

      const user = await db('user')
        .select('account')
        .where({ chat_id, state: 1, receive_chat_state: 1 })
        .findOne();

      if (!user) {
        resp.forbidden(res, `${appConfig.notifyAccountDes}未开启收信接口`)(req);
        return;
      }

      await heperMsgAndForward(req, user.account, text);

      resp.success(res, `接收${appConfig.notifyAccountDes}消息成功`)(req, text, 1);
    } catch (error) {
      resp.error(res)(req, error);
    }
  },
);

// 获取页面信息
app.get(
  '/api/site-info',
  validate(
    'query',
    V.object({
      u: V.string().trim().min(1).max(fieldLength.url),
    }),
  ),
  async (req, res) => {
    try {
      const { u } = req[kValidate];

      // 检查接口是否开启
      if (!_d.pubApi.siteInfoApi && !req[kHello].userinfo.account) {
        return resp.forbidden(res, '接口未开放')(req, u, 1);
      }

      let protocol = 'https:'; // 默认https
      const url = `${u.startsWith('http') ? '' : `${protocol}//`}${u}`;

      if (!isurl(url)) {
        resp.badRequest(res, req, 'url 格式错误', { url });
        return;
      }

      const obj = { title: '', des: '' };
      let p = '',
        miss = '';

      try {
        await uLog(req, `获取网站信息(${u})`);
        const { host, pathname } = new URL(url);

        p = appConfig.siteinfoDir(`${_crypto.getStringHash(`${host}${pathname}`)}.json`);

        miss = p + '.miss';

        // 缓存存在，则使用缓存
        if ((await _f.getType(p)) === 'file') {
          resp.success(res, 'ok', parseJson((await _f.fsp.readFile(p)).toString(), {}));
          return;
        }

        if ((await _f.getType(miss)) === 'file') {
          const stat = await _f.lstat(miss);
          if (Date.now() - stat.mtimeMs > 60 * 1000) {
            await _f.del(miss);
          } else {
            resp.success(res, 'ok', obj);
            return;
          }
        }

        let result;
        try {
          result = await request.get(`${protocol}//${host}${pathname}`);
        } catch {
          protocol = 'http:';
          result = await request.get(`${protocol}//${host}${pathname}`);
        }

        const type = (result.headers?.['content-type'] || '').toLowerCase();

        if (!type.includes('text/html')) {
          throw new Error('只允许获取HTML文件');
        }

        const head = extractFullHead(result.data);

        if (_f.getTextSize(head) > 300 * 1024) {
          throw new Error('HTML文件过大');
        }

        const $ = cheerio.load(head);
        const $title = $('title');
        const $des = $('meta[name="description"]');

        obj.title = $title.text() || '';
        obj.des = $des.attr('content') || '';

        await _f.writeFile(p, JSON.stringify(obj));

        resp.success(res, 'ok', obj);
      } catch (error) {
        if (miss) {
          try {
            await _f.writeFile(miss, '');
          } catch (err) {
            await errLog(req, `${err}(${u})`);
          }
        }

        await errLog(req, `${error}(${u})`);
        resp.success(res, 'ok', obj);
      }
    } catch (error) {
      resp.error(res)(req, error);
    }
  },
);

// ip地理位置
app.get(
  '/api/ip-location',
  validate(
    'query',
    V.object({
      ip: V.string().trim().min(1).custom(getClientIp.isIp, 'ip 格式错误'),
    }),
  ),
  async (req, res) => {
    try {
      const { ip } = req[kValidate];

      // 检查接口是否开启
      if (!_d.pubApi.ipLocationApi) {
        return resp.forbidden(res, '接口未开放')(req, ip, 1);
      }

      resp.success(res, '获取ip地理位置成功', getCity(ip))(req, ip, 1);
    } catch (error) {
      resp.error(res)(req, error);
    }
  },
);

app.use(async (req, res, next) => {
  const path = req[kHello].path;
  const routePath = '/api/f/';
  if (path.startsWith(routePath)) {
    const filePath = path.slice(routePath.length);
    req[kHello].path = routePath;
    await getFile(req, res, filePath);
  } else {
    next();
  }
});

app.use((_, res) => {
  res.status(404).redirect('/404');
});

initDatabase()
  .then((initPassword) => {
    app.listen(appConfig.port, (err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
      }
      const arr = getLocalhost().map(
        (item) => `http://${item}${appConfig.port === 80 ? '' : `:${appConfig.port}`}`,
      );
      // eslint-disable-next-line no-console
      console.log(`
 __   __  ______  __     __       __ 
|  | |  ||  ____||  |   |  |    / __ \\
|  |_|  || |____ |  |   |  |   | |  | |
|   _   ||  ____||  |   |  |   | |  | |
|  | |  || |____ |  |__ |  |__ | |__| |
|__| |__||______||_____||_____| \\ __ / 
   `);
      if (initPassword) {
        // eslint-disable-next-line no-console
        console.log(`\nusername: ${appConfig.adminUsername}\npassword: ${initPassword}
       `);
      }
      // eslint-disable-next-line no-console
      console.log(`服务开启成功，访问地址为：\n${arr.join('\n')}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`init database error - ${err}`);
    process.exit(1);
  });

function getLocalhost() {
  const obj = os.networkInterfaces();
  let arr = [];
  Object.keys(obj).forEach((item) => {
    let value = obj[item];
    if (Object.prototype.toString.call(value).slice(8, -1) === 'Array') {
      arr = [...arr, ...value.filter((item) => item.family === 'IPv4').map((item) => item.address)];
    }
  });
  return arr;
}

// 格式化客户端信息
function formatClientInfo(userAgent) {
  const config = new UAParser(userAgent).getResult();

  const osName = getIn(config, ['os', 'name'], '未知系统');
  const browser = getIn(config, ['browser', 'name'], '');
  const osVendor = getIn(config, ['device', 'vendor'], '');
  const osModel = getIn(config, ['device', 'model'], '');
  const cpu = getIn(config, ['cpu', 'architecture'], '');

  const mainParts = [osName];
  if (cpu) mainParts.push(cpu);

  const deviceParts = [osVendor, osModel, browser].filter(Boolean);

  if (deviceParts.length > 0) {
    mainParts.push(`(${deviceParts.join(' ')})`);
  }

  return mainParts.join(' ');
}
