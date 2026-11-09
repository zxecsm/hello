import speakeasy from 'speakeasy';
import { CacheByExpire } from './cache.js';

const cache = new CacheByExpire(10 * 60 * 1000, 10 * 60 * 1000);

function create(acc) {
  return cache.getOrSet(acc, () => speakeasy.generateSecret().base32, {
    // 命中后续期：用户正在完成绑定流程时不至于 10 分钟后突然失效
    refresh: true,
  });
}

function getToken(verify) {
  return speakeasy.totp({
    secret: verify,
    encoding: 'base32',
  });
}

function verify(verify, token) {
  return speakeasy.totp.verify({
    secret: verify,
    encoding: 'base32',
    token,
  });
}

function del(acc) {
  cache.delete(acc);
}

const _2fa = { create, getToken, verify, del };

export default _2fa;
