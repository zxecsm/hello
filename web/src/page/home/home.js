import { reqUserAllowLogin } from '../../api/user';
import _d from '../../js/common/config';
import localData from '../../js/common/localData';
import _msg from '../../js/plugins/message';
import _pop from '../../js/plugins/popConfirm';
import {
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
    if (from.account === localData.get('account')) return;
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
export function timeMsg() {
  const hour = new Date().getHours();
  let msg = '';
  let icon = '';
  if (hour <= 5) {
    msg = '🌙夜深了，星星都困得眨眼啦~早点休息哦，明天又是元气满满的一天！';
    icon = 'iconfont icon-icon_yejian-yueliang';
  } else if (hour <= 9) {
    msg = '🌞早安呀！阳光正好，微风不燥，今天也要像向日葵一样向阳生长呀~';
    icon = 'iconfont icon-a-056_richu';
  } else if (hour === 10) {
    msg = '☕上午黄金时间到！来杯咖啡提提神，今天的你闪闪发光呢✨';
    icon = 'iconfont icon-a-056_richu';
  } else if (hour === 11) {
    msg = '⏰11点啦！坚持就是胜利，午餐已经在向你招手啦~想想待会吃什么美味呢？';
    icon = 'iconfont icon-taiyangtianqi';
  } else if (hour <= 14) {
    msg = '😴午安小憩时间~吃饱饱后记得眯一会儿，下午才能电量满格哦！';
    icon = 'iconfont icon-taiyangtianqi';
  } else if (hour <= 18) {
    msg = '🌈下午茶时间到！来块小蛋糕犒劳自己吧，今天也辛苦啦~';
    icon = 'iconfont icon-xiawucha';
  } else if (hour === 19) {
    msg = '🍽️晚餐时间！19点的钟声敲响啦~今天想宠幸哪家美食呢？';
    icon = 'iconfont icon-yewan-bangwan';
  } else {
    msg = '🌃晚上好呀~卸下一天的疲惫，泡个热水澡，好好享受属于自己的时光吧💖';
    icon = 'iconfont icon-icon_yejian-yueliang';
  }

  _msg.msg({ message: msg, icon, duration: 5000 });
}
