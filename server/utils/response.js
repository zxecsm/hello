import { errLog, uLog } from './utils.js';

function send(res, options = {}, status = 200) {
  res.status(status).json({
    code: 1,
    codeText: 'ok',
    data: null,
    ...options,
  });
}

function success(res, codeText = '操作成功', data = null, status = 200, code = 1) {
  send(
    res,
    {
      code,
      codeText,
      data,
    },
    status,
  );

  return function (req, txt, concat) {
    if (txt) {
      if (concat) {
        txt = `${codeText}(${txt})`;
      }
    } else {
      txt = codeText;
    }
    uLog(req, txt);
  };
}

function error(res, codeText = '操作失败', data = null, status = 500, code = 0) {
  send(
    res,
    {
      code,
      codeText,
      data,
    },
    status,
  );

  return function (req, txt, concat) {
    if (txt) {
      if (concat) {
        txt = `${codeText}(${txt})`;
      }
    } else {
      txt = codeText;
    }
    errLog(req, txt);
  };
}

function ok(res, codeText = 'ok', data = null) {
  return success(res, codeText, data, 200, 3);
}

function badRequest(res, req, err = '', data = {}) {
  let str = '';
  try {
    if (typeof data === 'string') {
      str = JSON.stringify(req[data]);
    } else {
      str = JSON.stringify(data);
    }
  } catch {}

  error(res, '参数错误', null, 400)(req, `${err}${str ? ` - ${str}` : ''}`, 1);
}

function unauthorized(res, codeText = '未登录，请登录后再操作', data = null) {
  return error(res, codeText, data, 401, 2);
}

function forbidden(res, codeText = '无权限', data = null) {
  return error(res, codeText, data, 403);
}

function notFound(res, codeText = '不存在', data = null) {
  return error(res, codeText, data, 404);
}

const resp = {
  send,
  ok,
  success,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
};

export default resp;
