import { reqUserAllowLogin } from '../../api/user';
import _d from '../../js/common/config';
import _msg from '../../js/plugins/message';
import _pop from '../../js/plugins/popConfirm';
import {
  _getData,
  _setTimeout,
  debounce,
  isIframe,
  isLogin,
  myOpen,
} from '../../js/utils/utils';

let allowLoginPop = null,
  isLoding = false;
// 批准登录
export function handleAllowLoginMsg(data) {
  const { ip, code, addr, os } = data;

  const msg = `设备：${os}\nIP：${ip}\n位置：${addr}\n验证码：${code.slice(
    0,
    3
  )} ${code.slice(3)}\n\n请求允许登录。`;

  if (allowLoginPop) {
    allowLoginPop.close();
  }

  allowLoginPop = _pop(
    {
      text: msg,
      confirm: {
        text: '批准登录',
      },
    },
    (type) => {
      allowLoginPop = null;
      if (type === 'confirm') {
        if (isLoding) {
          _msg.info('正在认证中');
          return;
        }
        isLoding = true;
        let num = 0;
        let timer = setInterval(() => {
          _msg.botMsg(`认证中…${++num}`, 1);
        }, 1000);
        function closeLogin() {
          clearInterval(timer);
          timer = null;
          isLoding = false;
          _msg.botMsg(`认证失败`, 1);
        }
        reqUserAllowLogin({ code })
          .then((res) => {
            closeLogin();
            if (res.code === 1) {
              _msg.success(res.codeText);
              _msg.botMsg(`认证成功`, 1);
            }
          })
          .catch(() => {
            closeLogin();
          });
      }
    }
  );
}
const closeShake = debounce((target) => {
  target.classList.remove('shake');
}, 500);
export function shakeChat() {
  const target = document.documentElement;
  target.classList.add('shake');
  closeShake(target);
}

export function otherWindowMsg(msg) {
  if (isIframe()) return;
  const { type, data } = msg;
  if (type === 'online') {
    _msg.online(data.text, (type) => {
      if (type === 'click') {
        myOpen(`${_d.originURL}?c=${data.account}`);
      }
    });
  } else if (type === 'allowLogin') {
    handleAllowLoginMsg(data);
  } else if (type === 'chat') {
    const { flag, from, msgData } = data;
    if (from.account === _getData('account')) return;
    let text = '';
    // 新消息处理
    if (flag === 'addmsg') {
      text = msgData.content;
      // 撤回消息
    } else if (flag === 'del') {
      text = '撤回消息';
      //清空聊天框
    } else if (flag === 'clear') {
      text = '清空聊天记录';
    } else if (flag === 'shake') {
      text = '抖了你一下';
      shakeChat();
    }
    if (text === '') return;
    _msg.msg(
      {
        message: `${from.des || from.username}: ${text}`,
        type: 'warning',
        icon: 'iconfont icon-zaixianzixun',
        duration: 8000,
      },
      (type) => {
        if (type === 'click') {
          myOpen(`${_d.originURL}?c=${from.account}`);
        }
      },
      1
    );
  }
}
export function waitLogin(callback) {
  if (isLogin()) {
    callback && callback();
  } else {
    _setTimeout(() => waitLogin(callback), 5000);
  }
}
