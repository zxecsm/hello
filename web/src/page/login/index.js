import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';
import $ from 'jquery';
import md5 from 'md5';
import './coloured.js';
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
} from '../../js/utils/utils';
import _d from '../../js/common/config';
import validateImg from './validate';
import '../../js/common/common.js';
import _msg from '../../js/plugins/message';
import {
  reqUserCodeLogin,
  reqUserEmailCode,
  reqUserLogin,
  reqUserRegister,
  reqUserRegisterState,
  reqUserResetPass,
  reqUserVerifyLogin,
} from '../../api/user.js';
import rMenu from '../../js/plugins/rightMenu/index.js';
import _pop from '../../js/plugins/popConfirm/index.js';
import changeDark from '../../js/utils/changeDark.js';
const $box = $('.box'),
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
  myOpen('/note/?v=about');
});
if (_getData('account')) {
  myOpen('/');
}
const accInp = wrapInput($account[0], {
  change(val) {
    val = val.trim();
    if (val == '') {
      $account.next().css('display', 'none');
    } else {
      $account.next().css('display', 'block');
    }
  },
  focus(target) {
    $(target).parent().addClass('focus');
  },
  blur(target) {
    checkUserName();
    $(target).parent().removeClass('focus');
  },
});
const pdInp = wrapInput($password[0], {
  change(val) {
    val = val.trim();
    if (val == '') {
      $password.next().css('display', 'none');
    } else {
      $password.next().css('display', 'block');
    }
  },
  focus(target) {
    $(target).parent().addClass('focus');
  },
  blur(target) {
    checkPassword();
    $(target).parent().removeClass('focus');
  },
});
const rePdInp = wrapInput($repassword[0], {
  change(val) {
    val = val.trim();
    if (val == '') {
      $repassword.next().css('display', 'none');
    } else {
      $repassword.next().css('display', 'block');
    }
  },
  focus(target) {
    $(target).parent().addClass('focus');
  },
  blur(target) {
    checkPassword();
    $(target).parent().removeClass('focus');
  },
});
let code = '';
// 免密登录
function hdNopdLogin() {
  if (code) {
    reqUserCodeLogin({ code })
      .then((res) => {
        if (res.code == 0) {
          const { username, account } = res.data;
          _setData('username', username);
          _setData('loginName', username);
          _setData('account', account);
          myOpen(originurl);
          return;
        }
        throw '';
      })
      .catch(() => {
        _setTimeout(hdNopdLogin, 1000);
      });
  }
}
$nopd
  .on('click', '.nopd_login', function () {
    // 显示登录码
    code = Math.random().toFixed(6).slice(2);
    $ratify
      .css('display', 'flex')
      .find('.code_box')
      .stop()
      .fadeIn(_d.speed)
      .find('.code span')
      .html(`<i>${code.slice(0, 3)}</i><i>${code.slice(3)}</i>`);
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
      const acc = accInp.getValue().trim();
      reqUserEmailCode({ acc })
        .then((res) => {
          if (res.code == 0) {
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
                      val = val.trim();
                      if (val == '') {
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
              debounce(
                ({ inp, close }) => {
                  const code = inp.pass;
                  reqUserResetPass({ email, account, code })
                    .then((res) => {
                      if (res.code == 0) {
                        const { username, account } = res.data;
                        close();
                        _setData('username', username);
                        _setData('loginName', acc);
                        _setData('account', account);
                        _msg.success(res.codeText, () => {
                          myOpen(originurl);
                        });
                      }
                    })
                    .catch(() => {});
                },
                1000,
                true
              ),
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
$ratify.on('click', '.close', function () {
  $ratify.css('display', 'none').find('.code_box').css('display', 'none');
  code = '';
});
window.addEventListener('load', function () {
  $box.addClass('open');
});
accInp.setValue(_getData('loginName'));
reqUserRegisterState()
  .then((res) => {
    if (res.code == 0) {
      if (res.data == 'y') {
        $register.css('display', 'block');
      }
    }
  })
  .catch(() => {});
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
  if (dark == 'y') {
    dark = 'n';
    _msg.success('关闭黑暗模式');
  } else if (dark == 'n') {
    dark = 's';
    _msg.success('跟随系统');
  } else if (dark == 's') {
    dark = 'y';
    _msg.success('开启黑暗模式');
  }
  changeTheme(dark);
  _setData('dark', dark);
});
function changeTheme(flag) {
  dark = flag;
  if (dark == 'y') {
    $darkState.attr('class', 'dark_state iconfont icon-icon_yejian-yueliang');
  } else if (dark == 'n') {
    $darkState.attr('class', 'dark_state iconfont icon-taiyangtianqi');
  } else if (dark == 's') {
    $darkState.attr('class', 'dark_state iconfont icon-xianshiqi');
  }
  darkMode(dark);
}
window.changeTheme = changeTheme;
changeTheme(dark);
$box.on('keyup', function (e) {
  if (e.key === 'Enter') {
    $submit.click();
  }
});

$account.next().on('click', function () {
  accInp.setValue('');
  accInp.target.focus();
});
$repassword.next().on('click', function () {
  rePdInp.setValue('');
  rePdInp.target.focus();
});
$password.next().on('click', function () {
  pdInp.setValue('');
  pdInp.target.focus();
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
          if (parseInt(result.code) === 0) {
            const { account, verify, username } = result.data;
            if (verify) {
              rMenu.inpMenu(
                false,
                {
                  items: {
                    pass: {
                      beforeText: '验证码：',
                      inputType: 'number',
                      verify(val) {
                        val = val.trim();
                        if (val == '') {
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
                ({ inp }) => {
                  const token = inp.pass;
                  reqUserVerifyLogin({
                    acc: account,
                    token,
                    password: obj.password,
                  })
                    .then((res) => {
                      if (res.code == 0) {
                        const { account, username } = res.data;
                        _setData('username', username);
                        _setData('loginName', obj.account);
                        _setData('account', account);
                        myOpen(originurl);
                      }
                    })
                    .catch(() => {});
                },
                '两步验证',
                1,
                1
              );
            } else {
              _setData('username', username);
              _setData('loginName', obj.account);
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
          if (parseInt(result.code) === 0) {
            const { username, account } = result.data;
            _setData('username', username);
            _setData('loginName', obj.username);
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
$submit.on('click', function () {
  const account = accInp.getValue().trim(),
    password = pdInp.getValue().trim();
  if (isLoginState) {
    hdLogin({
      account: account,
      password: md5(password),
    });
  } else {
    hdRegister({
      username: account,
      password: md5(password),
    });
  }
});
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
  if (isLoginState) {
    accInp.target.setAttribute('placeholder', '用户名/账号/邮箱');
    if (username.length < 1) {
      $accountErr.text('请输入用户名/账号/邮箱');
      return false;
    }
  } else {
    accInp.target.setAttribute('placeholder', '用户名');
    if (username.length < 1 || username.length > 20) {
      $accountErr.text('请输入1-20位用户名');
      return false;
    }
  }
  $accountErr.text('');
  return true;
}
function shake() {
  const box = $box[0];
  box.style.animation = `tada .5s ease-in-out`;
  _setTimeout(() => {
    box.style.animation = `none`;
  }, 500);
}
wave();
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  darkMode(dark);
});
