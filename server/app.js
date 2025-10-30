import os from 'os';
// Cookie
import cookieParser from 'cookie-parser';

import express from 'express';

// 获取访问设备信息
import { UAParser } from 'ua-parser-js';

import {
  writelog,
  getClientIp,
  getIn,
  _err,
  debounce,
  getDirname,
  validaString,
  paramErr,
} from './utils/utils.js';

import { resolve } from 'path';

import appConfig from './data/config.js';

import verifyLimit from './utils/verifyLimit.js';

import { heperMsgAndForward } from './routes/chat/chat.js';

import jwt from './utils/jwt.js';

import { getUserInfo } from './routes/user/user.js';

import './data/createData.js';

import bgRoute from './routes/bg/index.js';
import bmkRoute from './routes/bmk/index.js';
import chatRoute from './routes/chat/index.js';
import countRoute from './routes/count/index.js';
import fileRoute from './routes/file/index.js';
import getfaviconRoute from './routes/getfavicon/index.js';
import getfileRoute from './routes/getfile/index.js';
import noteRoute from './routes/note/index.js';
import notepadRoute from './routes/notepad/index.js';
import picRoute from './routes/pic/index.js';
import playerRoute from './routes/player/index.js';
import rootRoute from './routes/root/index.js';
import searchRoute from './routes/search/index.js';
import todoRoute from './routes/todo/index.js';
import userRoute from './routes/user/index.js';
import taskRoute from './routes/task/index.js';
import _path from './utils/path.js';
import { fieldLength } from './routes/config.js';

const __dirname = getDirname(import.meta);

const app = express();

app.set('trust proxy', 'loopback');

// Cookie
app.use(cookieParser());
app.use(express.json({ limit: '10250kb' }));
app.use(express.urlencoded({ extended: true, limit: '10250kb' }));
app.use(express.static(resolve(__dirname, 'static'), { dotfiles: 'allow' }));

// 同一ip在10秒内最多允许500个请求
const reqLimit = verifyLimit({ space: 10, count: 500 }, false);

const informReqLimit = debounce(
  async (req) => {
    try {
      const { os, ip } = req._hello;
      await heperMsgAndForward(req, 'root', `[${os}(${ip})] 请求频率超过限制`);
    } catch (error) {
      await writelog(req, `[ informReqLimit ] - ${error}`, 'error');
    }
  },
  5000,
  1
);

app.use(async (req, res, next) => {
  try {
    // 客户端临时ID格式
    const temid = req.headers['x-tem-id'] || '';
    if (!validaString(temid, 0, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const ip = getClientIp(req); // 客户端ip
    const method = req.method.toLocaleLowerCase(); // 请求类型

    // 身份验证
    const jwtData = jwt.get(req.cookies.token);
    const userinfo =
      jwtData && jwtData.data.type === 'authentication'
        ? jwtData.data.data
        : {}; // 用户信息

    req._hello = {
      userinfo,
      path: req.path,
      temid,
      ip,
      os: formatClientInfo(req.headers['user-agent']),
      method,
      jwtData,
    };

    // 限制请求频率
    const flag = userinfo.account || '';

    if (reqLimit.verify(ip, flag)) {
      reqLimit.add(ip, flag);

      await writelog(req, `${method}(${req._hello.path})`);
      next();
    } else {
      informReqLimit(req);
      _err(res, '请求频率超过限制')(req);
    }
  } catch (error) {
    await writelog(req, `[ app.use ] - ${error}`, 'error');
    _err(res);
  }
});

app.use(
  '/api/pub/font',
  express.static(_path.normalize(appConfig.appData, 'font'), {
    dotfiles: 'allow',
    maxAge: 2592000000,
  })
);
app.use(
  '/api/pub/share',
  express.static(_path.normalize(appConfig.appData, 'share'), {
    dotfiles: 'allow',
    maxAge: 2592000000,
  })
);
app.use(
  '/api/pub/logo',
  express.static(_path.normalize(appConfig.appData, 'logo'), {
    dotfiles: 'allow',
    maxAge: 2592000000,
  })
);
app.use(
  '/api/pub/picture',
  express.static(_path.normalize(appConfig.appData, 'pic'), {
    dotfiles: 'allow',
    maxAge: 2592000000,
  })
);
app.use(
  '/api/pub/searchlogo',
  express.static(_path.normalize(appConfig.appData, 'searchlogo'), {
    dotfiles: 'allow',
    maxAge: 2592000000,
  })
);
app.use(
  '/api/pub/playerlogo',
  express.static(_path.normalize(appConfig.appData, 'playerlogo'), {
    dotfiles: 'allow',
    maxAge: 2592000000,
  })
);

app.use(async (req, res, next) => {
  try {
    const {
      jwtData,
      userinfo: { account },
    } = req._hello;

    req._hello.userinfo = {}; // 清空用户信息

    if (
      jwtData &&
      jwtData.data.type === 'authentication' &&
      account &&
      account !== 'hello'
    ) {
      const { iat, exp } = jwtData; // token有效期范围
      const user = await getUserInfo(account, '*');

      //  对比token生成的时间
      if (user && (user.exp_token_time || 0) < iat) {
        req._hello.userinfo = user; // 验证身份成功，保存用户信息
        req._hello.isRoot = user.account === 'root';

        // token剩下一半时间到期，重置token
        if (Date.now() / 1000 - iat >= (exp - iat) / 2) {
          const { account, username } = req._hello.userinfo;
          jwt.setCookie(res, { account, username });
        }
      }
    }
    next();
  } catch (error) {
    await writelog(req, `[ app.use ] - ${error}`, 'error');
    _err(res);
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
app.use('/api/getfile', getfileRoute);
app.use('/api/todo', todoRoute);
app.use('/api/count', countRoute);
app.use('/api/file', fileRoute);
app.use('/api/notepad', notepadRoute);
app.use('/api/task', taskRoute);
app.use('/api/getfavicon', getfaviconRoute);

app.use((_, res) => {
  res.status(404).redirect('/404');
});

app.listen(appConfig.port, () => {
  const arr = getLocalhost().map(
    (item) =>
      `http://${item}${appConfig.port === 80 ? '' : `:${appConfig.port}`}`
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
  // eslint-disable-next-line no-console
  console.log(`服务开启成功，访问地址为：\n${arr.join('\n')}`);
});

function getLocalhost() {
  const obj = os.networkInterfaces();
  let arr = [];
  Object.keys(obj).forEach((item) => {
    let value = obj[item];
    if (Object.prototype.toString.call(value).slice(8, -1) === 'Array') {
      arr = [
        ...arr,
        ...value
          .filter((item) => item.family === 'IPv4')
          .map((item) => item.address),
      ];
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
