import { reqUserAllowLogin, reqUserIpLocation } from '../../api/user';
import _d from '../../js/common/config';
import localData from '../../js/common/localData';
import _msg from '../../js/plugins/message';
import rMenu from '../../js/plugins/rightMenu';
import { _setTimeout, debounce, isIframe, isLogin, myOpen } from '../../js/utils/utils';

let allowLoginPop = null,
  isLoding = false;
// 批准登录
export function handleAllowLoginMsg(data) {
  const { ip, code, addr, os } = data;

  const msg = `设备：${os}\nIP：${ip}\n位置：${addr}\n验证码：${code.slice(
    0,
    3,
  )} ${code.slice(3)}\n\n请求允许登录。`;

  if (allowLoginPop) {
    allowLoginPop.close();
  }

  allowLoginPop = rMenu.pop(
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
    },
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
  const { type, data, notify } = msg;
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
    if (from.account === localData.get('account') || notify === 0) return;
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
      text = '抖了一下窗口';
      if (notify === 1) {
        shakeChat();
      }
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
      1,
    );
  } else if (type === 'errMsg') {
    _msg.error(data.text, null, { reside: true });
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
  if (isIframe()) return;
  const hour = new Date().getHours();
  let msg = '';
  let icon = '';
  if (hour >= 0 && hour < 5) {
    msg = '🌙夜深了，星星都困得眨眼啦~早点休息哦，明天又是元气满满的一天！';
    icon = 'iconfont icon-icon_yejian-yueliang';
  } else if (hour >= 5 && hour < 7) {
    msg = '🌅天微微亮啦！新的一天准备起航，来杯温水唤醒身体吧~';
    icon = 'iconfont icon-a-056_richu';
  } else if (hour >= 7 && hour < 9) {
    msg = '🌞早安呀！阳光正好，微风不燥，今天也要像向日葵一样向阳生长呀~';
    icon = 'iconfont icon-a-056_richu';
  } else if (hour >= 9 && hour < 11) {
    msg = '☕上午黄金时间到！来杯咖啡提提神，今天的你闪闪发光呢✨';
    icon = 'iconfont icon-xiawucha';
  } else if (hour >= 11 && hour < 13) {
    msg = '🍱午餐时间来啦！辛苦的你要好好犒劳自己哦~';
    icon = 'iconfont icon-mifan';
  } else if (hour >= 13 && hour < 15) {
    msg = '😴吃饱了就眯一会吧~午休时间别太长，轻松一下刚刚好~';
    icon = 'iconfont icon-taiyangtianqi';
  } else if (hour >= 15 && hour < 17) {
    msg = '🌈下午茶时间到！来块小蛋糕犒劳自己吧，今天也辛苦啦~';
    icon = 'iconfont icon-xiawucha';
  } else if (hour >= 17 && hour < 19) {
    msg = '🌇傍晚时分，忙碌即将结束，是不是已经开始惦记晚餐了呢？';
    icon = 'iconfont icon-yewan-bangwan';
  } else if (hour >= 19 && hour < 21) {
    msg = '🍽️晚餐时间！来点喜欢的美食慰劳一下自己吧~';
    icon = 'iconfont icon-yewan-bangwan';
  } else if (hour >= 21 && hour < 23) {
    msg = '🌌夜幕降临~卸下一天的疲惫，泡个热水澡，好好享受属于自己的时光吧💖';
    icon = 'iconfont icon-icon_yejian-yueliang';
  } else {
    msg = '😴夜深人静了，早点睡觉哦~愿你今晚好梦连连🌟';
    icon = 'iconfont icon-icon_yejian-yueliang';
  }

  const lastMsg = localData.get('timeMsg');

  if (msg === lastMsg) return;

  localData.set('timeMsg', msg);
  _msg.msg({ message: msg, icon, duration: 5000 });
}
export function welcomeMsg() {
  if (isIframe()) return;
  reqUserIpLocation()
    .then((res) => {
      if (res.code === 1) {
        const { ip, province, country } = res.data;
        if (localData.get('ip') === ip) return;
        localData.set('ip', ip);
        _msg.msg({
          type: 'success',
          message: `✨✨✨欢迎来自 ${country} ${province} 的朋友！🎈🎈🎈`,
          icon: 'iconfont icon-cat',
          duration: 5000,
        });
        fireworks();
      }
    })
    .catch(() => {});
}
export function fireworks(count = 6) {
  const colors = ['#ff4d4f', '#40a9ff', '#73d13d', '#faad14', '#9254de'];

  function explode(x, y) {
    for (let i = 0; i < 80; i++) {
      const el = document.createElement('div');

      el.style.cssText = `
        position: fixed;
        width: 6px;
        height: 6px;
        left: ${x}px;
        top: ${y}px;
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
      `;

      document.body.appendChild(el);

      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 300 + 50;

      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      const duration = 2500 + Math.random() * 1000;

      el.animate(
        [
          { transform: 'translate(0,0)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
        ],
        {
          duration,
          easing: 'cubic-bezier(0,0.8,0.2,1)',
          fill: 'forwards',
        },
      );

      setTimeout(() => el.remove(), duration);
    }
  }

  // 连续触发多个烟花
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight * 0.6; // 上半部分更像烟花
      explode(x, y);
    }, i * 500); // 每隔0.5秒一个
  }
}
