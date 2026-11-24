import '../../assets/css/common/reset.css';
import '../../assets/css/common/common.css';
import '../../assets/fonts/iconfont.css';
import '../home/searchBox/cat.less';
import './index.less';
import $ from 'jquery';
import {
  myOpen,
  wrapInput,
  _setTimeout,
  debounce,
  throttle,
  isLogin,
  isDark,
  getDarkIcon,
} from '../../js/utils/utils';
import _d from '../../js/common/config';
import '../../js/common/common.js';
import _msg from '../../js/plugins/message';
import {
  reqUserAllowLoginReq,
  reqUserCodeLogin,
  reqUserEmailCode,
  reqUserLogin,
  reqUserRegister,
  reqUserResetPass,
  reqUserVerifyLogin,
} from '../../api/user.js';
import rMenu from '../../js/plugins/rightMenu/index.js';
import md5 from '../../js/utils/md5.js';
import localData from '../../js/common/localData.js';
import { maskLoading } from '../../js/plugins/loadingBar/index.js';
import captcha from '../../js/plugins/captcha/index.js';
import codeRain from '../../js/plugins/codeRain/index.js';
const $box = $('.box'),
  $title = $box.find('.title'),
  $register = $box.find('.register'),
  $darkState = $box.find('.dark_state'),
  $submit = $box.find('.submit'),
  $account = $box.find('.account input'),
  $accountErr = $box.find('.account p'),
  $password = $box.find('.password input'),
  $repassword = $box.find('.repassword input'),
  $passwordErr = $box.find('.repassword p'),
  $showPd = $box.find('.show_pd'),
  $nopd = $box.find('.nopd'),
  $ratify = $('#ratify'),
  $about = $box.find('.about');
const originurl = localData.session.get('originurl') || '/';
// 代码雨背景
const codeRainBg = codeRain(document.getElementById('code_rain'));
$about.on('click', function () {
  myOpen('/note?v=about');
});
if (isLogin()) {
  myOpen('/');
}
function hdKeyUp(e) {
  if (e.key.toLowerCase() === 'enter') {
    hdSubmit();
  }
}
function hdFocus() {
  $box.addClass('close');
}
function hdBlur() {
  $box.removeClass('close');
}
const accInp = wrapInput($account[0], {
  update(val) {
    if (val === '') {
      $account.next().css('display', 'none');
    } else {
      $account.next().css('display', 'block');
    }
  },
  focus(e) {
    $(e.target).parent().addClass('focus');
  },
  blur(e) {
    checkUserName();
    $(e.target).parent().removeClass('focus');
  },
  keyup: hdKeyUp,
});
const pdInp = wrapInput($password[0], {
  update(val) {
    if (val === '') {
      $password.next().css('display', 'none');
    } else {
      $password.next().css('display', 'block');
    }
  },
  focus(e) {
    $(e.target).parent().addClass('focus');
    hdFocus();
  },
  blur(e) {
    checkPassword();
    $(e.target).parent().removeClass('focus');
    hdBlur();
  },
  keyup: hdKeyUp,
});
const rePdInp = wrapInput($repassword[0], {
  update(val) {
    if (val === '') {
      $repassword.next().css('display', 'none');
    } else {
      $repassword.next().css('display', 'block');
    }
  },
  focus(e) {
    $(e.target).parent().addClass('focus');
    hdFocus();
  },
  blur(e) {
    checkPassword();
    $(e.target).parent().removeClass('focus');
    hdBlur();
  },
  keyup: hdKeyUp,
});
let code = '';
let nopdUsername = '';
let nopdPollTimer = null;
let captchaId = '';
let isCaptcha = false;
// 免密登录轮询：只在登录请求确认送达后才开始
function hdNopdLogin(reqCode) {
  // 登录码已被刷新或弹窗已关闭，丢弃这次轮询
  if (!reqCode || reqCode !== code) return;
  reqUserCodeLogin({ code: reqCode, username: nopdUsername })
    .then((res) => {
      // 等待期间刷新过登录码或关闭了弹窗，忽略旧结果
      if (reqCode !== code) return;
      if (res.code === 1) {
        const { username, account } = res.data;
        localData.set('username', username);
        localData.set('account', account);
        myOpen(originurl);
        return;
      } else if (res.code === 3) {
        nopdPollTimer = _setTimeout(() => hdNopdLogin(reqCode), 1000);
      }
    })
    .catch((err) => {
      if (reqCode !== code) return;
      closeRatify();
      // 轮询接口默认不弹错误提示，这里补上失败原因，避免静默结束
      const codeText = err?.responseJSON?.codeText;
      if (codeText) _msg.error(codeText);
    });
}
// 停止轮询（刷新登录码、取消、重新发起时都要停）
function stopNopdLogin() {
  if (nopdPollTimer) {
    clearTimeout(nopdPollTimer);
    nopdPollTimer = null;
  }
}
// 6 位登录码（CSPRNG，避免 Math.random 可预测）
function createLoginCode() {
  const buf = new Uint32Array(1);
  const max = Math.floor(0x100000000 / 1000000) * 1000000;
  let value;

  do {
    globalThis.crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= max);

  return String(value % 1000000).padStart(6, '0');
}
function changeCode() {
  // 显示登录码
  code = createLoginCode();
  $ratify
    .css('display', 'flex')
    .find('.code_box')
    .stop()
    .fadeIn(_d.speed)
    .find('.code span')
    .html(`<i>${code.slice(0, 3)}</i><i>${code.slice(3)}</i>`);
}
$nopd
  .on('click', '.nopd_login', function () {
    if (isCaptcha) return;
    if (!checkUserName()) {
      shake();
      return;
    }
    startNopdLogin();
  })
  .on('click', '.resetpd', resetPassword);
// 发起（或重新发起）一次免密登录
function startNopdLogin() {
  stopNopdLogin();
  // 新的一次尝试不复用上一次的验证码
  captchaId = '';
  nopdUsername = accInp.getValue().trim();
  changeCode();
  sendLoginRequest();
}
// 重置密码
function resetPassword() {
  if (!checkUserName()) {
    shake();
    return;
  }

  // 固定本次重置使用的用户名，避免弹窗期间输入框被修改
  const username = accInp.getValue().trim();

  maskLoading.show();
  reqUserEmailCode({ username, captchaId })
    .then((res) => {
      if (res.code === 1) {
        const { needCaptcha } = res.data;

        if (needCaptcha) {
          captcha(username, {
            success({ id }) {
              captchaId = id;
              resetPassword();
            },
          });
        } else {
          _msg.success(res.codeText);

          // 不返回邮箱，只返回账号；邮箱由服务端根据账号查询
          const { account } = res.data;

          rMenu.inpMenu(
            false,
            {
              items: {
                pass: {
                  beforeText: '邮箱验证码：',
                  inputType: 'number',
                  verify(val) {
                    return (
                      rMenu.validInteger(val) ||
                      rMenu.validNumber(val, 0) ||
                      rMenu.validString(val, 6, 6)
                    );
                  },
                },
              },
            },
            ({ inp, close, loading, submit }) => {
              if (isCaptcha) return;
              const code = inp.pass;
              loading.start();
              // 只提交账号 + 验证码，邮箱由服务端根据账号查询
              reqUserResetPass({ account, code, captchaId })
                .then((res) => {
                  if (res.code === 1) {
                    const { username: resUsername, account, needCaptcha } = res.data;

                    if (needCaptcha) {
                      isCaptcha = true;
                      captcha(account, {
                        success({ id }) {
                          captchaId = id;
                          isCaptcha = false;
                          submit();
                        },
                        close() {
                          isCaptcha = false;
                        },
                      });
                    } else {
                      close();
                      localData.set('username', resUsername);
                      localData.set('account', account);
                      _msg.success(res.codeText, () => {
                        myOpen(originurl);
                      });
                    }
                  }
                })
                .catch(() => {})
                .finally(() => {
                  loading.end();
                });
            },
            '输入邮箱验证码，重置密码',
            0,
            1,
          );
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      maskLoading.hide();
    });
}
$ratify.on('click', '.close', closeRatify).on('click', '.resend', () => {
  if (isCaptcha) return;
  startNopdLogin();
});
// 发送登录请求
function sendLoginRequest() {
  const reqCode = code;
  if (!reqCode || !nopdUsername) return;
  reqUserAllowLoginReq({ code: reqCode, username: nopdUsername, captchaId })
    .then((res) => {
      // 弹窗已关闭或登录码已刷新，丢弃旧结果
      if (reqCode !== code) return;
      if (res.code !== 1) return;
      const { needCaptcha } = res.data || {};
      if (needCaptcha) {
        isCaptcha = true;
        captcha(nopdUsername, {
          success({ id }) {
            isCaptcha = false;
            if (reqCode !== code) return;
            captchaId = id;
            sendLoginRequest();
          },
          close() {
            isCaptcha = false;
            closeRatify();
          },
        });
        return;
      }
      // 验证码已被服务端消费，后续不能再带这个 id
      captchaId = '';
      _msg.success(res.codeText);
      // 请求已送达目标设备，开始轮询批准结果
      hdNopdLogin(reqCode);
    })
    .catch(() => {
      if (reqCode !== code) return;
      closeRatify();
    });
}
function closeRatify() {
  stopNopdLogin();
  $ratify.css('display', 'none').find('.code_box').css('display', 'none');
  code = '';
  captchaId = '';
}
// 登录页使用代码雨画布作背景，不请求随机壁纸
window.addEventListener('load', function () {
  $box.addClass('open');
});
accInp.setValue(localData.get('username'));
let showpd = localData.get('showpd');
// 显示密码切换
function hdShowPd() {
  if (showpd) {
    $showPd.find('i').attr('class', 'iconfont icon-xuanzeyixuanze');
    $password.attr('type', 'text');
    $repassword.attr('type', 'text');
  } else {
    $showPd.find('i').attr('class', 'iconfont icon-xuanzeweixuanze');
    $password.attr('type', 'password');
    $repassword.attr('type', 'password');
  }
}
hdShowPd();
$showPd.on('click', function () {
  showpd = !showpd;
  localData.set('showpd', showpd);
  hdShowPd();
});
let isLoginState = true;
// 切换登录/注册
$register.on('click', () => {
  if (isLoginState) {
    isLoginState = false;
    $repassword
      .parent()
      .parent()
      .stop()
      .slideDown(300, () => {
        $register.text('登录');
        $submit.text('注册');
        $title.find('span').eq(1).text('注册');
        document.title = '注册';
        $nopd.css('display', 'none');
      });
  } else {
    isLoginState = true;
    $repassword
      .parent()
      .parent()
      .stop()
      .slideUp(300, () => {
        $register.text('注册');
        $submit.text('登录');
        $title.find('span').eq(1).text('登录');
        document.title = '登录';
        $nopd.css('display', 'block');
      });
  }
  checkUserName();
});
// 切换黑暗模式
$darkState.on('click', function () {
  let dark = localData.get('dark');
  if (dark === 'y') {
    dark = 'n';
    _msg.success('关闭黑暗模式');
  } else if (dark === 'n') {
    dark = 's';
    _msg.success('跟随系统');
  } else if (dark === 's') {
    dark = 'y';
    _msg.success('开启黑暗模式');
  }
  localData.set('dark', dark);
});
function changeTheme(dark) {
  $darkState.attr('class', `dark_state iconfont ${getDarkIcon(dark)}`);
  codeRainBg.setTheme(isDark());
}
window.changeTheme = changeTheme;
changeTheme(localData.get('dark'));

$account.next().on('click', function () {
  accInp.setValue('').focus();
});
$repassword.next().on('click', function () {
  rePdInp.setValue('').focus();
});
$password.next().on('click', function () {
  pdInp.setValue('').focus();
});
// 登录
function hdLogin(obj) {
  if (isCaptcha) return;
  if (!checkUserName()) {
    shake();
    return;
  }
  maskLoading.show();
  reqUserLogin(obj)
    .then((result) => {
      if (result.code === 1) {
        const { account, verify, username, needCaptcha } = result.data;
        if (verify) {
          $box.remove(); // 方便填充两步验证码
          rMenu.inpMenu(
            false,
            {
              items: {
                pass: {
                  beforeText: '验证码：',
                  inputType: 'number',
                  autocomplete: 'one-time-code',
                  verify(val) {
                    return (
                      rMenu.validInteger(val) ||
                      rMenu.validNumber(val, 0) ||
                      rMenu.validString(val, 6, 6)
                    );
                  },
                },
              },
            },
            ({ inp, loading, submit }) => {
              if (isCaptcha) return;
              const token = inp.pass;
              loading.start();
              reqUserVerifyLogin({
                account,
                token,
                password: obj.password,
                captchaId,
              })
                .then((res) => {
                  if (res.code === 1) {
                    const { account, username, needCaptcha } = res.data;
                    if (needCaptcha) {
                      isCaptcha = true;
                      captcha(account, {
                        success({ id }) {
                          captchaId = id;
                          isCaptcha = false;
                          submit();
                        },
                        close() {
                          isCaptcha = false;
                        },
                      });
                    } else {
                      localData.set('username', username);
                      localData.set('account', account);
                      myOpen(originurl);
                    }
                  }
                })
                .catch(() => {})
                .finally(() => {
                  loading.end();
                });
            },
            '两步验证',
            1,
            1,
          );
        } else if (needCaptcha) {
          isCaptcha = true;
          captcha(username, {
            success({ id }) {
              captchaId = id;
              isCaptcha = false;
              hdSubmit();
            },
            close() {
              isCaptcha = false;
            },
          });
        } else {
          localData.set('username', username);
          localData.set('account', account);
          myOpen(originurl);
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      maskLoading.hide();
    });
}
// 注册
function hdRegister(obj) {
  if (isCaptcha) return;
  if (!checkUserName() || !checkPassword()) {
    shake();
    return;
  }
  maskLoading.show();
  reqUserRegister(obj)
    .then((result) => {
      if (result.code === 1) {
        const { username, account, needCaptcha } = result.data;
        if (needCaptcha) {
          isCaptcha = true;
          captcha(username, {
            success({ id }) {
              captchaId = id;
              isCaptcha = false;
              hdSubmit();
            },
            close() {
              isCaptcha = false;
            },
          });
        } else {
          localData.set('username', username);
          localData.set('account', account);
          myOpen(originurl);
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      maskLoading.hide();
    });
}
$submit.on('click', hdSubmit);
function hdSubmit() {
  const account = accInp.getValue().trim(),
    password = pdInp.getValue().trim();
  if (isLoginState) {
    hdLogin({
      captchaId,
      username: account,
      password: md5.getStringHash(password),
    });
  } else {
    hdRegister({
      captchaId,
      username: account,
      password: md5.getStringHash(password),
    });
  }
}
// 验证密码
function checkPassword() {
  if (isLoginState) return true;
  const password = pdInp.getValue().trim(),
    repassword = rePdInp.getValue().trim();
  if (password !== repassword) {
    $passwordErr.text('密码不一致');
    return false;
  }
  $passwordErr.text('');
  return true;
}
// 验证用户名
function checkUserName() {
  const username = accInp.getValue().trim();
  if (username.length < 1 || username.length > _d.fieldLength.username) {
    $accountErr.text(`请输入1-${_d.fieldLength.username}位用户名`);
    return false;
  }
  const errText = rMenu.validAlphanumeric(username);
  if (errText) {
    $accountErr.text(errText);
    return false;
  }
  $accountErr.text('');
  return true;
}
const closeShake = debounce((box) => {
  box.classList.remove('shake');
}, 500);
function shake() {
  const box = $box[0];
  box.classList.add('shake');
  closeShake(box);
}
window.addEventListener('resize', throttle(setCatSize, 1000));
function setCatSize() {
  const $cat = $box.find('.cat');
  const fontSize = ($box.width() / 2) * (100 / 150);
  $cat.css('font-size', parseInt(fontSize) + 'px');
}
setCatSize();
localData.onChange(({ key }) => {
  if (!key || key === 'htmlFontSize') {
    setCatSize();
  }
});
