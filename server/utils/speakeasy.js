const speakeasy = require('speakeasy');
const temObj = {};
function create(acc) {
  clean();
  if (temObj.hasOwnProperty(acc)) {
    return temObj[acc].verify;
  } else {
    const verify = speakeasy.generateSecret().base32;
    temObj[acc] = { t: Date.now(), verify };
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
function clean() {
  const now = Date.now();
  Object.keys(temObj).forEach((item) => {
    const { t } = temObj[item];
    if (now - t > 10 * 60 * 1000) {
      del(item);
    }
  });
}
function del(acc) {
  delete temObj[acc];
}
const _2fa = { create, getToken, verify, del };
module.exports = _2fa;
