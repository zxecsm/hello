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
