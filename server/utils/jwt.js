import { createSecretKey } from 'crypto';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { _d } from '../data/data.js';

// 是否启用 Secure Cookie（仅通过 HTTPS 才发送 Cookie）
// 环境变量 COOKIE_SECURE 可强制覆盖：true/1 开启，false/0 关闭
// 未设置时：development 环境关闭，其它环境（含 Docker 的 production）开启
function isSecureCookie() {
  const value = process.env.COOKIE_SECURE;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return process.env.NODE_ENV !== 'development';
}

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
      secure: isSecureCookie(), // 仅 HTTPS 下发送 Cookie，可用 COOKIE_SECURE 覆盖
    });
  },
};

export default jwt;
