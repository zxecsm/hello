import jsonwebtoken from 'jsonwebtoken';

import { _d } from '../data/data.js';

const jwt = {
  set(data = {}, exp = 60 * 60 * 24 * 2) {
    return jsonwebtoken.sign(
      {
        exp: Math.floor(Date.now() / 1000) + exp,
        data,
      },
      _d.tokenKey
    );
  },
  get(token) {
    try {
      return jsonwebtoken.verify(token, _d.tokenKey);
    } catch {
      return null;
    }
  },
  setCookie(res, data) {
    res.cookie('token', this.set({ type: 'authentication', data }), {
      maxAge: 1000 * 60 * 60 * 24 * 2,
      httpOnly: true,
    });
  },
};

export default jwt;
