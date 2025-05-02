import '../../css/common/common.css';
import './index.less';
import '../../font/iconfont.css';
import '../../js/common/common';
import {
  _getData,
  _getTarget,
  copyText,
  darkMode,
  debounce,
  isIframe,
  isLogin,
  myOpen,
  queryURLParams,
} from '../../js/utils/utils';
import changeDark from '../../js/utils/changeDark';
import rMenu from '../../js/plugins/rightMenu';
import { reqUserFileToken, reqUserPlayerConfig } from '../../api/user';
import toolTip from '../../js/plugins/tooltip';
import _pop from '../../js/plugins/popConfirm';
import { _tpl } from '../../js/utils/template';
import videoLinkLogo from '../../images/img/videoLink.png';
import { initRainCodeSleep } from '../../js/common/codeRain';
import realtime from '../../js/plugins/realtime';
import { otherWindowMsg, waitLogin } from '../home/home';
const vd = document.querySelector('video'),
  playIn = document.querySelector('.playIn');
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
let playerList = [];
reqUserPlayerConfig()
  .then((res) => {
    if (res.code === 1) {
      playerList = res.data;
    }
  })
  .catch(() => {});
playIn.addEventListener('click', function (e) {
  selectPlayIn(e, url);
});
playIn.addEventListener('mouseenter', () => {
  toolTip.setTip('使用其他应用播放').show();
});
playIn.addEventListener('mouseleave', () => {
  toolTip.hide();
});
const hidePlayIn = debounce(() => {
  playIn.style.display = 'none';
}, 5000);
function showPlayIn() {
  if (playerList.length > 0) {
    playIn.style.display = 'block';
    hidePlayIn();
  }
}
document.addEventListener('mousemove', showPlayIn);
document.addEventListener('touchstart', showPlayIn);
function selectPlayIn(e, url) {
  const html = _tpl(
    `<div cursor="y" class="item" data-xi="copy">
      <img style="width: 40px;height: 40px;border-radius: 4px;" :data-src="videoLinkLogo"/>
      <span style="margin-left:10px;">复制直链</span>
    </div>
    <div v-for="{name,logo},i in playerList" cursor="y" class="item" :data-xi="i">
      <img style="width: 40px;height: 40px;border-radius: 4px;" :data-src="logo"/>
      <span style="margin-left:10px;">{{name}}</span>
    </div>
    `,
    {
      playerList,
      videoLinkLogo,
    }
  );
  rMenu.rightMenu(
    e,
    html,
    async function ({ close, e, box, loading }) {
      const _this = _getTarget(box, e, '.item');
      if (_this) {
        let path = url;
        if (!queryURLParams(url).token && isLogin()) {
          let token = '';
          loading.start();
          try {
            const res = await reqUserFileToken({ p: queryURLParams(url).p });
            if (res.code === 1) {
              token = res.data;
            }
          } catch {}
          loading.end();
          path = url + `&token=${token}`;
        }
        const xi = _this.dataset.xi;
        if (xi === 'copy') {
          copyText(path);
          close();
          return;
        }
        const { link } = playerList[xi];
        close(true);
        myOpen(link.replace(/\{\{(.*?)\}\}/g, path), '_blank');
      }
    },
    '选择播放视频应用'
  );
}
vd.src = url;
vd.play();
vd.onerror = function () {
  _pop({ e: false, text: '播放失败，使用其他应用打开？' }, async (type) => {
    if (type === 'confirm') {
      selectPlayIn(false, url);
    }
  });
};
vd.ontimeupdate = initRainCodeSleep;
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  darkMode(dark);
});
