import _pop from '../../js/plugins/popConfirm';
import { _getData, _setData } from '../../js/utils/utils';
const link = document.createElement('link');
link.setAttribute('rel', 'manifest');
link.href = 'manifest.json';
document.head.appendChild(link);

window.addEventListener('beforeinstallprompt', (e) => {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    // don't display install banner when installed
    return e.preventDefault();
  } else {
    const install = _getData('install') || 0;
    const t = Date.now();
    if (t - install < 5 * 24 * 60 * 60 * 1000) return;
    _pop(
      {
        e: false,
        text: '安装应用？',
        confirm: { text: '安装' },
        cancel: { text: '暂不安装' },
      },
      (type) => {
        if (type === 'confirm') {
          e.prompt();
        } else if (type === 'cancel') {
          _setData('install', t);
        }
      }
    );
    return e.preventDefault();
  }
});
