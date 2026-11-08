import nodemailer from 'nodemailer';
import { _d } from '../data/data.js';
import { CacheByExpire } from './cache.js';

const cache = new CacheByExpire(10 * 60 * 1000, 10 * 60 * 1000);

// 复用 transporter，配置变化时重建
let transporter = null;
let transporterKey = '';

function getTransporter() {
  const key = JSON.stringify(_d.email);

  if (transporter && transporterKey === key) {
    return transporter;
  }

  // 释放旧配置的实例
  transporter?.close();

  transporter = nodemailer.createTransport({
    host: _d.email.host,
    secure: _d.email.secure,
    port: _d.email.port,
    auth: {
      user: _d.email.user,
      pass: _d.email.pass,
    },
    pool: false, // 单发模式，不保持长连接
    // ---- 超时设置 ----
    connectionTimeout: 5000, // 连接服务器超时 5s
    greetingTimeout: 5000, // 等待 greeting 超时 5s
    socketTimeout: 5000, // 整个会话最长空闲 5s
  });

  transporterKey = key;

  return transporter;
}

async function sendMail(to, title, html) {
  const { user, state } = _d.email;

  if (!state) throw new Error('未配置发信邮箱');

  const t = getTransporter();

  try {
    return await t.sendMail({
      from: user,
      to,
      subject: title,
      html,
    });
  } finally {
    // 无论成功失败都释放本次连接
    t.close();
  }
}

async function sendCode(to, code) {
  const html = `验证码 <span style="font-size:40px;color:#409eff;">${code}</span> 十分钟内有效，请勿泄露与转发。如非本人操作，请忽略此邮件。`;
  await sendMail(to, 'Hello账号验证邮件', html);
  cache.set(to, code);
}

function get(email) {
  return cache.get(email) || '';
}

function del(email) {
  cache.delete(email);
}

const mailer = {
  get,
  del,
  sendMail,
  sendCode,
};

export default mailer;
