import { EncryptJWT, jwtDecrypt } from 'jose';
import { createSecretKey } from 'crypto';
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
      maxAge: 1000 * 60 * 60 * 24 * 2,
      httpOnly: true,
    });
  },
};

export default jwt;
