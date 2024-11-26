import jwt from 'jsonwebtoken';

import { _d } from '../data/data.js';

// 生成token
export function jwten(data, exp = 60 * 60 * 24 * 2) {
  return jwt.sign(
    {
      exp: Math.floor(Date.now() / 1000) + exp,
      data,
    },
    _d.tokenKey
  );
}

// 解密token
export function jwtde(token) {
  try {
    return jwt.verify(token, _d.tokenKey);
  } catch {
    return {};
  }
}

// 设置cookie
export function setCookie(res, userinfo) {
  res.cookie('token', jwten(userinfo), {
    maxAge: 1000 * 60 * 60 * 24 * 2,
    httpOnly: true,
  });
}
