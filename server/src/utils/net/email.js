import nodemailer from 'nodemailer';
import { _d } from '../../config/store.js';
import { CacheByExpire } from '../common/cache.js';

const cache = new CacheByExpire(10 * 60 * 1000, 10 * 60 * 1000, { maxSize: 5000 });

// 邮箱统一转小写作为缓存 key，避免大小写造成验证码匹配失败或重复发送
const normalizeEmail = (email) =>
  String(email ?? '')
    .trim()
    .toLowerCase();

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
  const key = normalizeEmail(to);
  const previous = cache.get(key);

  // 先写入缓存占位，避免发信期间并发请求绕过「验证码已发送」的校验
  cache.set(key, code);

  try {
    await sendMail(to, 'Hello账号验证邮件', html);
  } catch (error) {
    // 发送失败：只在缓存里仍是本次验证码时恢复，避免覆盖并发写入的新验证码
    if (cache.get(key) === code) {
      if (previous !== null) {
        cache.set(key, previous);
      } else {
        cache.delete(key);
      }
    }
    throw error;
  }
}

function get(email) {
  return cache.get(normalizeEmail(email)) || '';
}

function del(email) {
  cache.delete(normalizeEmail(email));
}

const mailer = {
  get,
  del,
  sendMail,
  sendCode,
};

export default mailer;
