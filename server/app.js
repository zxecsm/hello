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
  parseJson,
  extractFullHead,
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
import getCity from './utils/getCity.js';
import request from './utils/request.js';
import resp from './utils/response.js';
import { asyncHandler, openCors, validate } from './utils/customMiddleware.js';

const __dirname = getDirname(import.meta);

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
  async (res) => {
    try {
      const { os, ip } = res.locals.hello;
      await heperMsgAndForward(res, appConfig.adminAccount, `[${os}(${ip})] 请求频率超过限制`);
    } catch (error) {
      await writelog(res, `[ informReqLimit ] - ${error}`, 500);
    }
  },
  5000,
  1,
);

// 记录日志
app.use((_, res, next) => {
  const start = Date.now();
  let logged = false;

  function done() {
    if (logged) return;
    logged = true;

    const duration = Date.now() - start;
    writelog(
      res,
      [res.locals.codeText, `${duration}ms`, 'auto'].filter(Boolean).join(' - '),
      res.statusCode,
    );
  }

  res.on('finish', done);
  res.on('close', done);

  next();
});

app.use(async (req, res, next) => {
  try {
    const ip = getClientIp(req); // 客户端ip
    const method = req.method.toLocaleLowerCase(); // 请求类型
    // 身份验证
    const jwtData = await jwt.get(req.cookies.token);
    const userinfo = jwtData && jwtData.data.type === 'authentication' ? jwtData.data.data : {}; // 用户信息

    res.locals.hello = {
      userinfo,
      path: decodeURIComponent(req.path),
      temid: '',
      ip,
      ipLocation: getCity(ip),
      os: formatClientInfo(req.headers['user-agent']),
      method,
      jwtData,
    };

    if (req.headers['x-source-service'] === appConfig.appFlag) {
      return resp.forbidden(res, '请求被禁止')('x-source-service', 1);
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
      return resp.badRequest(res)(error, 1);
    }

    res.locals.hello.temid = temid;

    // 限制请求频率
    const flag = userinfo.account || '';

    if (!reqLimit.verify(ip, flag)) {
      informReqLimit(res);
      return resp.forbidden(res, '请求频率超过限制')();
    }

    reqLimit.add(ip, flag);

    next();
  } catch (error) {
    resp.error(res)(`[ app.use reqLimit ] - ${error}`);
  }
});

app.use('/api/font', express.static(appConfig.fontDir(), staticOptions));

app.use(async (_, res, next) => {
  try {
    const {
      temid,
      jwtData,
      userinfo: { account },
    } = res.locals.hello;

    res.locals.hello.userinfo = {}; // 清空用户信息

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
          res.locals.hello.temid = user.account + temid;
        }
        res.locals.hello.userinfo = user; // 验证身份成功，保存用户信息
        res.locals.hello.isRoot = user.account === appConfig.adminAccount;

        // token剩下一半时间到期，重置token
        if (Date.now() / 1000 - iat >= (exp - iat) / 2) {
          const { account, username } = res.locals.hello.userinfo;
          await jwt.setCookie(res, { account, username });
        }
      }
    }
    next();
  } catch (error) {
    resp.error(res)(`[ app.use userinfo ] - ${error}`);
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
  openCors,
  validate(
    'params',
    V.object({
      chat_id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { method } = res.locals.hello;

    let text = '';
    if (method === 'get') {
      text = req.query.text;
    } else if (method === 'post') {
      text = req.body.text;

      if (!text) {
        text = req.query.text;
      }
    }

    const { chat_id } = res.locals.ctx;

    try {
      text = await V.parse(text, V.string().trim().min(1).max(fieldLength.chatContent), 'text');
    } catch (error) {
      return resp.badRequest(res)(error, 1);
    }

    const user = await db('user')
      .select('account')
      .where({ chat_id, state: 1, receive_chat_state: 1 })
      .findOne();

    if (!user) {
      return resp.forbidden(res, `${appConfig.notifyAccountDes}未开启收信接口`)();
    }

    await heperMsgAndForward(res, user.account, text);

    resp.success(res, `接收${appConfig.notifyAccountDes}消息成功`)();
  }),
);

// 获取页面信息
app.get(
  '/api/site-info',
  openCors,
  validate(
    'query',
    V.object({
      u: V.string().trim().min(1).max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { u } = res.locals.ctx;

    // 检查接口是否开启
    if (!_d.pubApi.siteInfoApi && !res.locals.hello.userinfo.account) {
      return resp.forbidden(res, '接口未开放')();
    }

    let protocol = 'https:'; // 默认https
    const url = `${u.startsWith('http') ? '' : `${protocol}//`}${u}`;

    if (!isurl(url)) {
      return resp.badRequest(res)('url 格式错误', 1);
    }

    const obj = { title: '', des: '' };
    let p = '',
      miss = '';

    try {
      const { host, pathname } = new URL(url);

      p = appConfig.siteinfoDir(`${_crypto.getStringHash(`${host}${pathname}`)}.json`);

      miss = p + '.miss';

      // 缓存存在，则使用缓存
      if ((await _f.getType(p)) === 'file') {
        return resp.success(
          res,
          '获取网站信息成功',
          parseJson((await _f.fsp.readFile(p)).toString(), {}),
        )();
      }

      if ((await _f.getType(miss)) === 'file') {
        const stat = await _f.lstat(miss);
        if (Date.now() - stat.mtimeMs > 60 * 1000) {
          await _f.del(miss);
        } else {
          return resp.success(res, '获取网站信息成功', obj)();
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

      resp.success(res, '获取网站信息成功', obj)();
    } catch (error) {
      if (miss) {
        try {
          await _f.writeFile(miss, '');
        } catch (err) {
          await writelog(res, err, 500);
        }
      }

      await writelog(res, error, 403);
      resp.success(res, '获取网站信息成功', obj)();
    }
  }),
);

// ip地理位置
app.get(
  '/api/ip-location',
  openCors,
  validate(
    'query',
    V.object({
      ip: V.string().trim().default('').allowEmpty().min(1).custom(getClientIp.isIp, 'ip 格式错误'),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { ip } = res.locals.ctx;
    const hello = res.locals.hello;

    // 检查接口是否开启
    if (!_d.pubApi.ipLocationApi && !hello.userinfo.account) {
      return resp.forbidden(res, '接口未开放')();
    }

    const result = ip ? { ...getCity(ip), ip } : { ...hello.ipLocation, ip: hello.ip };
    resp.success(res, '获取ip地理位置成功', result)();
  }),
);

// 随机音乐
app.get(
  '/api/music',
  openCors,
  asyncHandler(async (req, res) => {
    if (!_d.pubApi.randomMusicApi && !res.locals.hello.userinfo.account) {
      return resp.forbidden(res, '接口未开放')();
    }

    const musicData = await db('songs').select('id').getRandomOne();

    if (!musicData) {
      return resp.notFound(res, '音乐库为空')();
    }

    await db('songs').where({ id: musicData.id }).increment({ play_count: 1 });
    await getFile(req, res, `/music/url/${musicData.id}`, false);
  }),
);

app.use(
  asyncHandler(async (req, res, next) => {
    const path = res.locals.hello.path;
    const routePath = '/api/f/';
    if (path.startsWith(routePath)) {
      const filePath = req.query.p || path.slice(routePath.length);
      res.locals.hello.path = routePath;
      await getFile(req, res, filePath);
    } else {
      next();
    }
  }),
);

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
