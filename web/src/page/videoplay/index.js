import '../../css/common/common.css';
import './index.less';
import '../../font/iconfont.css';
import '../../js/common/common';
import {
  _delData,
  _getData,
  _getTarget,
  copyText,
  darkMode,
  debounce,
  getFileKey,
  isLogin,
  myOpen,
  queryURLParams,
  readableTime,
} from '../../js/utils/utils';
import changeDark from '../../js/utils/changeDark';
import rMenu from '../../js/plugins/rightMenu';
import { reqUserClearFileKey, reqUserPlayerConfig } from '../../api/user';
import toolTip from '../../js/plugins/tooltip';
import _pop from '../../js/plugins/popConfirm';
import { _tpl } from '../../js/utils/template';
import videoLinkLogo from '../../images/img/videoLink.png';
import refreshLogo from '../../images/img/refresh.png';
import _msg from '../../js/plugins/message';
import { initRainCodeSleep } from '../../js/common/codeRain';
const vd = document.querySelector('video'),
  playIn = document.querySelector('.playIn');
const url = queryURLParams(myOpen()).HASH;
let playerList = [];
reqUserPlayerConfig()
  .then((res) => {
    if (res.code === 1) {
      playerList = res.data;
    }
  })
  .catch(() => {});
playIn.addEventListener('click', async function (e) {
  if (isLogin()) {
    const sign = await getFileKey(queryURLParams(url).p);
    const fPath = url + `&sign=${sign}`;
    selectPlayIn(e, fPath, sign);
  } else {
    selectPlayIn(e, url);
  }
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
function selectPlayIn(e, url, sign) {
  let expTime = '';
  if (sign) {
    expTime = readableTime(
      +sign.split('-')[1] + 5 * 60 * 60 * 1000 - Date.now()
    );
  }
  const html = _tpl(
    `
    <div v-if="expTime" cursor="y" class="item" data-xi="refresh">
      <img style="width: 40px;height: 40px;border-radius: 4px;" :data-src="refreshLogo"/>
      <span style="margin-left:10px;">更新链接（{{expTime}} 后过期）</span>
    </div>
    <div cursor="y" class="item" data-xi="copy">
      <img style="width: 40px;height: 40px;border-radius: 4px;" :data-src="videoLinkLogo"/>
      <span style="margin-left:10px;">复制直链</span>
    </div>
    <div v-for="{name,logo},i in playerList" cursor="y" class="item" :data-xi="i">
      <img style="width: 40px;height: 40px;border-radius: 4px;" :data-src="logo"/>
      <span style="margin-left:10px;">{{name}}</span>
    </div>
    `,
    {
      expTime,
      playerList,
      videoLinkLogo,
      refreshLogo,
    }
  );
  rMenu.rightMenu(
    e,
    html,
    function ({ close, e, box }) {
      const _this = _getTarget(box, e, '.item');
      if (_this) {
        const xi = _this.dataset.xi;
        if (xi === 'copy') {
          copyText(url);
          close();
          return;
        }
        if (xi === 'refresh') {
          reqUserClearFileKey()
            .then((res) => {
              if (res.code === 1) {
                _delData('fileKeys');
                close();
                _msg.success();
              }
            })
            .catch(() => {});
          return;
        }
        const { link } = playerList[xi];
        close(true);
        url = link.replace(/\{\{\}\}/, url);
        myOpen(url, '_blank');
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
      if (isLogin()) {
        const sign = await getFileKey(queryURLParams(url).p);
        const fPath = url + `&sign=${sign}`;
        selectPlayIn(false, fPath, sign);
      } else {
        selectPlayIn(false, url);
      }
    }
  });
};
vd.ontimeupdate = initRainCodeSleep;
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  darkMode(dark);
});
