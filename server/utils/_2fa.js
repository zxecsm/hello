import speakeasy from 'speakeasy';
import { CacheByExpire } from './cache.js';

const cache = new CacheByExpire(10 * 60 * 1000, 30 * 60 * 1000);

function create(acc) {
  const data = cache.get(acc);

  if (data) {
    return data.verify;
  } else {
    const verify = speakeasy.generateSecret().base32;

    cache.set(acc, { verify });

    return verify;
  }
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
