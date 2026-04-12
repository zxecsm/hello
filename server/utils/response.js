function send(res, options = {}, status = 200) {
  const result = {
    code: 1,
    codeText: 'ok',
    data: null,
    ...options,
  };

  return function (txt, concat) {
    if (txt !== undefined) {
      if (concat) {
        txt = `${result.codeText}(${txt})`;
      }
    } else {
      txt = result.codeText;
    }

    res.locals.codeText = txt;
    res.status(status).json(result);
  };
}

function success(res, codeText = '操作成功', data = null, status = 200, code = 1) {
  return send(
    res,
    {
      code,
      codeText,
      data,
    },
    status,
  );
}

function error(res, codeText = '操作失败', data = null, status = 500, code = 0) {
  return send(
    res,
    {
      code,
      codeText,
      data,
    },
    status,
  );
}

function ok(res, codeText = 'ok', data = null) {
  return success(res, codeText, data, 200, 3);
}

function badRequest(res, codeText = '参数错误', data = null) {
  return error(res, codeText, data, 400);
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
