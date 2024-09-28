const jwt = require('jsonwebtoken');
const { _d } = require('../data/data');

// 生成token
function jwten(userinfo) {
  return jwt.sign(
    {
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 2,
      userinfo,
    },
    _d.tokenKey
  );
}

// 解密token
function jwtde(token) {
  try {
    let obj = jwt.verify(token, _d.tokenKey);
    obj.userinfo = obj.userinfo || {};
    return obj;
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return { userinfo: {} };
  }
}

// 设置cookie
function setCookie(res, userinfo) {
  let token = jwten(userinfo);
  res.cookie('token', token, {
    maxAge: 1000 * 60 * 60 * 24 * 2,
    httpOnly: true,
  });
}

module.exports = {
  jwtde,
  jwten,
  setCookie,
};
