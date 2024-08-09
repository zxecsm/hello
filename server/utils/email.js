const nodemailer = require('nodemailer');
const { _d } = require('../data/data');
const temData = {};
function sendMail(to, title, html) {
  return new Promise((resolve, reject) => {
    const { user, pass, host, secure, port, state } = _d.email;
    if (!state) {
      reject('未配置发信邮箱');
      return;
    }
    const transporter = nodemailer.createTransport({
      host, // SMTP服务器地址，例如：smtp.qq.com
      secure, // 是否使用tls加密。默认为false，当我们设置为true时，建议端口设置为465
      port, // SMTP服务器端口，通常为587或465
      auth: {
        user, // 发件人邮箱地址
        pass, // 发件人邮箱密码或者应用专用密码
      },
    });
    const options = {
      from: user,
      to,
      subject: title,
      html,
    };
    transporter.sendMail(options, function (err, msg) {
      if (err) {
        reject(err);
        return;
      }
      resolve(msg);
      transporter.close();
    });
  });
}
async function sendCode(to, code) {
  const html = `验证码 <span style="font-size:40px;color:#409eff;">${code}</span> 十分钟内有效，请勿泄露与转发。如非本人操作，请忽略此邮件。`;
  try {
    await sendMail(to, 'Hello账号验证邮件', html);
    temData['email' + to] = { t: Date.now(), code };
  } catch (error) {
    throw error;
  }
}
function clean() {
  const now = Date.now();
  Object.keys(temData).forEach((item) => {
    const { t } = item;
    if (now - t > 10 * 60 * 1000) {
      delete temData[item];
    }
  });
}
function get(email) {
  clean();
  const obj = temData['email' + email];
  return obj ? obj.code : '';
}
function del(email) {
  delete temData['email' + email];
}
const mailer = {
  get,
  del,
  sendMail,
  sendCode,
};
module.exports = mailer;
