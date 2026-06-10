import resp from './response.js';
import V from './validRules.js';

// 参数验证中间件
export function validate(...rules) {
  return async (req, res, next) => {
    try {
      rules = Array.isArray(rules[0]) ? rules : [rules];

      res.locals.ctx = {};
      for (const [type, schema, path = ''] of rules) {
        try {
          const result = await V.parse(req[type], schema, path);
          if (rules.length === 1) {
            res.locals.ctx = result;
          } else {
            res.locals.ctx[type] = result;
          }
        } catch (err) {
          return resp.badRequest(res)(err, 1);
        }
      }

      next();
    } catch (error) {
      resp.error(res)(error);
    }
  };
}

// 错误处理中间件
export function asyncHandler(fn) {
  return async (req, res, ...args) => {
    try {
      await fn(req, res, ...args);
    } catch (error) {
      resp.error(res)(error);
    }
  };
}

// 开启跨域
export function openCors(req, res, next) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  } catch (error) {
    resp.error(res)(error);
  }
}

// 设置下载头
export function setDownloadHeader(res, fileName) {
  // 1. 兜底逻辑：防止 fileName 为空或不是字符串导致 encodeURIComponent 报错
  const safeFileName = typeof fileName === 'string' ? fileName : 'download';

  // 2. 安全过滤：移除换行符 (\r, \n)，防止 HTTP 头部注入攻击
  const cleanFileName = safeFileName.replace(/[\r\n]/g, '');

  // 3. 现代浏览器标准设置
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(cleanFileName)}`,
  );

  // 4. 允许前端（如 Axios/Fetch）读取到该 Header
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

  res.setHeader('Content-Type', 'application/octet-stream');
}
