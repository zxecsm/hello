import '../../css/common/common.css';
import './index.less';
import '../../js/common/common';
import {
  _getData,
  darkMode,
  myOpen,
  pageErr,
  queryURLParams,
} from '../../js/utils/utils';
import changeDark from '../../js/utils/changeDark';
const vd = document.querySelector('video');
vd.src = queryURLParams(myOpen()).HASH;
vd.play();
vd.onerror = function () {
  pageErr();
};
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  darkMode(dark);
});
