import { createSecretKey } from 'crypto';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { _d } from '../data/data.js';

const jwt = {
  async set(data = {}, exp = 60 * 60 * 24 * 2) {
    const expSec = Math.floor(Date.now() / 1000) + exp;
    return await new EncryptJWT({ data })
      .setProtectedHeader({ alg: 'A256GCMKW', enc: 'A256GCM' }) // 对称加密
      .setExpirationTime(expSec)
      .setIssuedAt()
      .encrypt(createSecretKey(Buffer.from(_d.tokenKey, 'base64url')));
  },
  async get(token) {
    try {
      const { payload } = await jwtDecrypt(
        token,
        createSecretKey(Buffer.from(_d.tokenKey, 'base64url')),
      );
      return payload;
    } catch {
      return null;
    }
  },
  async setCookie(res, data) {
    const token = await this.set({ type: 'authentication', data });

    res.cookie('token', token, {
      maxAge: 1000 * 60 * 60 * 24 * 2, // 有效期 2 天，过期后浏览器自动删除
      httpOnly: true, // 禁止 JS 读取，防止 XSS 窃取 token
      sameSite: 'lax', // 防 CSRF，跨站 POST 请求不携带此 Cookie
      path: '/', // 全站路径生效，所有接口请求都会带上
      secure: process.env.NODE_ENV !== 'development', // 仅 HTTPS 下发送 Cookie，开发环境允许 HTTP
    });
  },
};

export default jwt;
