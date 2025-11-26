import '../../css/common/common.css';
import './index.less';
import '../../font/iconfont.css';
import '../../js/common/common';
import {
  copyText,
  debounce,
  isIframe,
  isLogin,
  myOpen,
  queryURLParams,
} from '../../js/utils/utils';
import { reqUserFileToken } from '../../api/user';
import toolTip from '../../js/plugins/tooltip';
import { initRainCodeSleep } from '../../js/common/codeRain';
import realtime from '../../js/plugins/realtime';
import { otherWindowMsg, waitLogin } from '../home/home';
import _d from '../../js/common/config';
import rMenu from '../../js/plugins/rightMenu';
const vd = document.querySelector('video'),
  playLink = document.querySelector('.play_link');
const url = queryURLParams(myOpen()).HASH;
if (!isIframe()) {
  waitLogin(() => {
    // 同步数据
    realtime.init().add((res) => {
      res.forEach((item) => {
        otherWindowMsg(item);
      });
    });
  });
}
async function copyLink() {
  let path = url;
  const ourl = url.slice(_d.getFileURL.length);
  const p = ourl.split('?')[0];
  if (!queryURLParams(ourl).token && isLogin()) {
    let token = '';
    try {
      const res = await reqUserFileToken({ p });
      if (res.code === 1) {
        token = res.data;
      }
    } catch {}
    if (!token) return;
    path = url + (url.includes('?') ? '&' : '?') + `token=${token}`;
  }
  path = `${_d.originURL}${path}`;
  copyText(path);
}
playLink.addEventListener('click', copyLink);
playLink.addEventListener('mouseenter', () => {
  toolTip.setTip('复制直链').show();
});
playLink.addEventListener('mouseleave', () => {
  toolTip.hide();
});
const hidePlayLink = debounce(() => {
  playLink.style.display = 'none';
}, 5000);
function showPlayLink() {
  playLink.style.display = 'block';
  hidePlayLink();
}
document.addEventListener('mousemove', showPlayLink);
document.addEventListener('touchstart', showPlayLink);
vd.src = _d.originURL + url;
vd.play();
vd.onerror = function () {
  rMenu.pop({ e: false, text: '播放失败，复制直链？' }, async (type) => {
    if (type === 'confirm') {
      copyLink();
    }
  });
};
vd.ontimeupdate = initRainCodeSleep;
