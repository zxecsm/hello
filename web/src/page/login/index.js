import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import '../home/searchBox/cat.less';
import './index.less';
import $ from 'jquery';
import {
  myOpen,
  _setData,
  _getData,
  darkMode,
  wrapInput,
  _setTimeout,
  isInteger,
  debounce,
  _getDataTem,
  wave,
  throttle,
  loadImg,
  isBigScreen,
} from '../../js/utils/utils';
import _d from '../../js/common/config';
import validateImg from './validate';
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
import _pop from '../../js/plugins/popConfirm/index.js';
import changeDark from '../../js/utils/changeDark.js';
import md5 from '../../js/utils/md5.js';
const $bg = $('.bg'),
  $box = $('.box'),
  $title = $box.find('.title'),
  $register = $box.find('.register'),
  $darkState = $box.find('.dark_state'),
  $loading = $('.loading'),
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
const originurl = _getDataTem('originurl') || '/';
$about.on('click', function () {
  myOpen('/note?v=about');
});
if (_getData('account')) {
  myOpen('/');
}
(async () => {
  const url = `/api/bg/r/${isBigScreen() ? 'big' : 'small'}`;

  try {
    await loadImg(url);
    $bg.css({
      backgroundImage: `url(${url})`,
      opacity: 0.8,
    });
  } catch {}
})();
function hdKeyUp(e) {
  if (e.key === 'Enter') {
    hdSubmit();
  }
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
    $title
      .find('.iconfont')
      .attr('class', 'iconfont icon-shuangxianxiajiantou');
  },
  blur(e) {
    checkUserName();
    $(e.target).parent().removeClass('focus');
    $title
      .find('.iconfont')
      .attr('class', 'iconfont icon-shuangxianyoujiantou');
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
    $title
      .find('.iconfont')
      .attr('class', 'iconfont icon-shuangxianxiajiantou');
  },
  blur(e) {
    checkPassword();
    $(e.target).parent().removeClass('focus');
    $title
      .find('.iconfont')
      .attr('class', 'iconfont icon-shuangxianyoujiantou');
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
    $title
      .find('.iconfont')
      .attr('class', 'iconfont icon-shuangxianxiajiantou');
  },
  blur(e) {
    checkPassword();
    $(e.target).parent().removeClass('focus');
    $title
      .find('.iconfont')
      .attr('class', 'iconfont icon-shuangxianyoujiantou');
  },
  keyup: hdKeyUp,
});
let code = '';
// 免密登录
function hdNopdLogin() {
  if (code) {
    reqUserCodeLogin({ code, username: accInp.getValue().trim() })
      .then((res) => {
        if (res.code === 1) {
          const { username, account } = res.data;
          _setData('username', username);
          _setData('account', account);
          myOpen(originurl);
          return;
        } else if (res.code === 3) {
          _setTimeout(hdNopdLogin, 1000);
        }
      })
      .catch(() => {
        closeRatify();
      });
  }
}
function changeCode() {
  // 显示登录码
  code = Math.random().toFixed(6).slice(2);
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
    if (!checkUserName()) {
      shake();
      return;
    }
    changeCode();
    sendLoginRequest();
    hdNopdLogin();
  })
  .on('click', '.resetpd', resetPassword);
// 重置密码
function resetPassword(e) {
  if (!checkUserName()) {
    shake();
    return;
  }
  _pop({ e, text: '获取邮箱验证码？' }, (type) => {
    if (type === 'confirm') {
      reqUserEmailCode({ username: accInp.getValue().trim() })
        .then((res) => {
          if (res.code === 1) {
            _msg.success(res.codeText);
            const { account, email } = res.data;
            rMenu.inpMenu(
              false,
              {
                items: {
                  pass: {
                    beforeText: '邮箱验证码：',
                    inputType: 'number',
                    verify(val) {
                      if (val === '') {
                        return '请输入验证码';
                      } else if (
                        val.length !== 6 ||
                        !isInteger(+val) ||
                        val < 0
                      ) {
                        return '请输入6位正整数';
                      }
                    },
                  },
                },
              },
              ({ inp, close, loading }) => {
                const code = inp.pass;
                loading.start();
                reqUserResetPass({ email, account, code })
                  .then((res) => {
                    loading.end();
                    if (res.code === 1) {
                      const { username, account } = res.data;
                      close();
                      _setData('username', username);
                      _setData('account', account);
                      _msg.success(res.codeText, () => {
                        myOpen(originurl);
                      });
                    }
                  })
                  .catch(() => {
                    loading.end();
                  });
              },
              '输入邮箱验证码，重置密码',
              0,
              1
            );
          }
        })
        .catch(() => {});
    }
  });
}
$ratify.on('click', '.close', closeRatify).on('click', '.resend', () => {
  changeCode();
  sendLoginRequest();
});
// 发送登录请求
function sendLoginRequest() {
  if (code) {
    reqUserAllowLoginReq({ code, username: accInp.getValue().trim() })
      .then((res) => {
        if (res.code === 1) {
          _msg.success(res.codeText);
        }
      })
      .catch(() => {});
  }
}
function closeRatify() {
  $ratify.css('display', 'none').find('.code_box').css('display', 'none');
  code = '';
}
window.addEventListener('load', function () {
  $box.addClass('open');
});
accInp.setValue(_getData('username'));
let showpd = _getData('showpd');
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
  _setData('showpd', showpd);
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
let dark = _getData('dark');
// 切换黑暗模式
$darkState.on('click', function () {
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
  changeTheme(dark);
  _setData('dark', dark);
});
function changeTheme(flag) {
  dark = flag;
  if (dark === 'y') {
    $darkState.attr('class', 'dark_state iconfont icon-icon_yejian-yueliang');
  } else if (dark === 'n') {
    $darkState.attr('class', 'dark_state iconfont icon-taiyangtianqi');
  } else if (dark === 's') {
    $darkState.attr('class', 'dark_state iconfont icon-xianshiqi');
  }
  darkMode(dark);
}
window.changeTheme = changeTheme;
changeTheme(dark);

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
  if (!checkUserName() || !_flag) {
    shake();
    return;
  }
  _flag = false;
  validateImg({
    success() {
      _flag = true;
      $loading.stop().fadeIn();
      reqUserLogin(obj)
        .then((result) => {
          $loading.stop().fadeOut();
          if (result.code === 1) {
            const { account, verify, username } = result.data;
            if (verify) {
              document.body.innerHTML = ''; // 方便填充两步验证码
              rMenu.inpMenu(
                false,
                {
                  items: {
                    pass: {
                      beforeText: '验证码：',
                      inputType: 'number',
                      autocomplete: 'one-time-code',
                      verify(val) {
                        if (val === '') {
                          return '请输入验证码';
                        } else if (
                          val.length !== 6 ||
                          !isInteger(+val) ||
                          val < 0
                        ) {
                          return '请输入6位正整数';
                        }
                      },
                    },
                  },
                },
                ({ inp, loading }) => {
                  const token = inp.pass;
                  loading.start();
                  reqUserVerifyLogin({
                    account,
                    token,
                    password: obj.password,
                  })
                    .then((res) => {
                      loading.end();
                      if (res.code === 1) {
                        const { account, username } = res.data;
                        _setData('username', username);
                        _setData('account', account);
                        myOpen(originurl);
                      }
                    })
                    .catch(() => {
                      loading.end();
                    });
                },
                '两步验证',
                1,
                1
              );
            } else {
              _setData('username', username);
              _setData('account', account);
              myOpen(originurl);
            }
          }
        })
        .catch(() => {
          $loading.stop().fadeOut();
        });
    },
    fail() {
      _msg.error('验证失败');
    },
    close() {
      _flag = true;
    },
  });
}
// 注册
function hdRegister(obj) {
  if (!checkUserName() || !checkPassword() || !_flag) {
    shake();
    return;
  }
  _flag = false;
  validateImg({
    success() {
      _flag = true;
      $loading.stop().fadeIn();
      reqUserRegister(obj)
        .then((result) => {
          $loading.stop().fadeOut();
          if (result.code === 1) {
            const { username, account } = result.data;
            _setData('username', username);
            _setData('account', account);
            myOpen(originurl);
          }
        })
        .catch(() => {
          $loading.stop().fadeOut();
        });
    },
    fail() {
      _msg.error('验证失败');
    },
    close() {
      _flag = true;
    },
  });
}
let _flag = true;
$submit.on('click', hdSubmit);
function hdSubmit() {
  const account = accInp.getValue().trim(),
    password = pdInp.getValue().trim();
  if (isLoginState) {
    hdLogin({
      username: account,
      password: md5.getStringHash(password),
    });
  } else {
    hdRegister({
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
  if (username.length < 1 || username.length > 20) {
    $accountErr.text('请输入1-20位用户名');
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
wave();
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  darkMode(dark);
});
window.addEventListener('resize', throttle(setCatSize, 1000));
function setCatSize() {
  const $cat = $box.find('.cat');
  const fontSize = ($box.width() / 2) * (100 / 150);
  $cat.css('font-size', parseInt(fontSize));
}
setCatSize();
