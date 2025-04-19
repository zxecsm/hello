import $ from 'jquery';
import '../../font/iconfont.css';
import '../../css/common/common.css';
import '../edit/index.less';
import './index.less';
import '../note/md.less';
import {
  queryURLParams,
  myOpen,
  _setData,
  _getData,
  debounce,
  isImgFile,
  toLogin,
  isIframe,
  getFiles,
  percentToValue,
  LazyLoad,
  imgjz,
  _setTimeout,
  showQcode,
  isDarkMode,
  isLogin,
  wave,
  darkMode,
  concurrencyTasks,
  copyText,
  getMinIndex,
  getScreenSize,
  getTextSize,
} from '../../js/utils/utils';
import '../../js/common/common';
import _msg from '../../js/plugins/message';
import { UpProgress } from '../../js/plugins/UpProgress';
import createEditer from '../../js/utils/editor';
import gqImg from '../../images/img/gqimg.png';
import { reqGetNotePad, reqNotePad } from '../../api/notepad';
import { reqPicRepeat, reqPicUp } from '../../api/pic';
import rMenu from '../../js/plugins/rightMenu';
import MdWorker from '../../js/utils/md.worker.js';
import changeDark from '../../js/utils/changeDark.js';
import _d from '../../js/common/config.js';
import md5 from '../../js/utils/md5.js';
import _path from '../../js/utils/path.js';
import { setEditor } from '../edit/setEditor.js';
import cacheFile from '../../js/utils/cacheFile.js';
import { percentBar } from '../../js/plugins/percentBar/index.js';
import imgPreview from '../../js/plugins/imgPreview/index.js';
const mdWorker = new MdWorker();
const $contentWrap = $('.content_wrap'),
  $headBtns = $contentWrap.find('.head_btns'),
  $editWrap = $contentWrap.find('.edit_wrap'),
  $editBox = $editWrap.find('.edit_box'),
  $themeCss = $('.theme_css'),
  $previewBox = $editWrap.find('.preview_box'),
  $resize = $previewBox.find('.resize');

let editNoteFontSize = _getData('editNoteFontSize');
// 黑暗模式
function changeTheme(dark) {
  if (dark === 'y') {
    $themeCss.attr('href', '/css/notethem/notecode1.css');
    editor.setTheme('ace/theme/github_dark');
  } else if (dark === 'n') {
    $themeCss.attr('href', '/css/notethem/notecode.css');
    editor.setTheme('ace/theme/chrome');
  } else if (dark === 's') {
    if (isDarkMode()) {
      $themeCss.attr('href', '/css/notethem/notecode1.css');
      editor.setTheme('ace/theme/github_dark');
    } else {
      $themeCss.attr('href', '/css/notethem/notecode.css');
      editor.setTheme('ace/theme/chrome');
    }
  }
}
window.changeTheme = changeTheme;
// 编辑器
const editor = createEditer($editBox[0]);
editor.getSession().setMode('ace/mode/markdown');
changeTheme(_getData('dark'));
function switchUndoState() {
  if (createEditer.hasUndo(editor)) {
    $headBtns.find('.undo_btn').removeClass('deactive');
  } else {
    $headBtns.find('.undo_btn').addClass('deactive');
  }
  if (createEditer.hasRedo(editor)) {
    $headBtns.find('.redo_btn').removeClass('deactive');
  } else {
    $headBtns.find('.redo_btn').addClass('deactive');
  }
}
// 快捷键
editor.getSession().on(
  'change',
  debounce(function () {
    switchUndoState();
    rende();
  }, 1000)
);
editor.commands.addCommand({
  name: 'createLink',
  bindKey: { win: 'Ctrl-K', mac: 'Command-K' },
  exec: function () {
    createLink();
  },
});
editor.commands.addCommand({
  name: 'codeBlock',
  bindKey: { win: 'Ctrl-Shift-K', mac: 'Command-Shift-K' },
  exec: function () {
    createCodeBlock();
  },
});
editor.commands.addCommand({
  name: 'codeTable',
  bindKey: { win: 'Ctrl-B', mac: 'Command-B' },
  exec: function () {
    createTable();
  },
});
editor.commands.addCommand({
  name: 'upImg',
  bindKey: { win: 'Ctrl-I', mac: 'Command-I' },
  exec: async function () {
    if (!isLogin()) {
      toLogin();
      return;
    }
    const files = await getFiles({
      multiple: true,
      accept: 'image/*',
    });
    if (files.length === 0) return;
    hdUpFile(files);
  },
});
let previewLines = [];
// 同步滚动逻辑，基于编辑器当前可见行
let isSyncingEditorScroll = false;
let isSyncingPreviewScroll = false;
const initState = debounce(() => {
  isSyncingEditorScroll = false;
  isSyncingPreviewScroll = false;
}, 1000);
// 编辑器滚动同步到预览区
function syncScrollFromEditor(noAnimate) {
  if (isSyncingPreviewScroll) return;
  isSyncingEditorScroll = true;
  if ($previewBox.is(':hidden')) return;
  // 获取编辑器中可见的第一个行号
  const firstVisibleRow = editor.getFirstVisibleRow();

  // 获取预览最靠近编辑器第一行的行号
  const curLine = getMinIndex(
    previewLines.map((item) => Math.abs(firstVisibleRow - item.dataset.line))
  );
  let firstElement = previewLines[curLine];
  if (firstElement) {
    if (firstElement.tagName && firstElement.tagName.toLowerCase() === 'tr') {
      firstElement = firstElement.parentNode.parentNode;
    }
    const offset = firstElement.offsetTop;
    if (noAnimate) {
      $previewBox.find('.content').scrollTop(offset);
    } else {
      // 滚动预览区域到对应的行
      $previewBox.find('.content').stop().animate(
        {
          scrollTop: offset,
        },
        _d.speed
      );
    }
  }
  initState();
}
// 监听 Ace 编辑器的滚动事件
editor.session.on(
  'changeScrollTop',
  debounce(() => {
    syncScrollFromEditor();
  }, 200)
);
// 预览区滚动同步到编辑器
function syncScrollFromPreview() {
  if (isSyncingEditorScroll) return;
  isSyncingPreviewScroll = true;
  if ($editBox.is(':hidden')) return;
  const scrollTop = $previewBox.find('.content').scrollTop();

  let firstVisibleElement = previewLines.find(
    (el) => el.offsetTop >= scrollTop
  );

  if (firstVisibleElement) {
    const line = parseInt(firstVisibleElement.getAttribute('data-line'), 10);
    editor.scrollToLine(line);
  }
  initState();
}
$previewBox.find('.content').on('scroll', debounce(syncScrollFromPreview, 200));
// 对比记录
let orginData = {
  data: '',
};
function initValue(obj) {
  editor.setValue(obj.data);
  editor.gotoLine(1);
  createEditer.reset(editor);
  switchUndoState();
  if (obj.data === '') {
    editor.focus();
  }
  orginData = obj;
}
let { k } = queryURLParams(myOpen());
if (!k || !/^[\w]+$/.test(k)) {
  rMenu.inpMenu(
    false,
    {
      items: {
        key: {
          placeholder: '请输入便条Key',
          beforeText: '便条Key：',
          verify(val) {
            if (val === '') {
              return '请输入便条Key';
            } else if (val.length > _d.fieldLenght.filename) {
              return '便条key过长';
            } else if (!/^[\w]+$/.test(val)) {
              return '只能包含数字、字母和下划线';
            }
          },
        },
      },
    },
    ({ inp }) => {
      myOpen(`/notepad/?k=${inp.key}`);
    },
    0,
    1,
    1
  );
} else {
  reqGetNotePad({ k })
    .then((res) => {
      if (res.code === 1) {
        document.title = k;
        initValue({ data: res.data });
        $headBtns.addClass('open');
        $editWrap.addClass('open');
        upData();
      }
    })
    .catch(() => {});
}
// 保存便条
function upData() {
  const data = editor.getValue();
  if (data === orginData.data) {
    _setTimeout(upData, 1000);
  } else {
    orginData.data = data;
    if (getTextSize(data) > _d.fieldLenght.noteSize) {
      _msg.error('便签内容过长');
      upData();
      return;
    }
    reqNotePad({ k, data }).finally(upData);
  }
}
// 预览
function rende() {
  const text = editor.getValue();
  if ($previewBox.is(':hidden')) return;
  if (text.trim() === '') {
    $previewBox.find('.content').html('');
    return;
  }
  if (getTextSize(text) > _d.fieldLenght.noteSize) {
    $previewBox.find('.content').html(`<h1>便签内容过长</h1>`);
    return;
  }
  mdWorker.postMessage(text);
}
mdWorker.addEventListener('message', (event) => {
  $previewBox.find('.content').html(event.data);
  previewLines = [...$previewBox[0].querySelectorAll(`[data-line]`)];
  const imgs = [
    ...$previewBox.find('.content')[0].querySelectorAll('img'),
  ].filter((item) => {
    const url = item.getAttribute('data-src');
    const cache = cacheFile.hasUrl(url, 'image');
    if (cache) {
      item.src = cache;
    }
    return !cache;
  });
  imgLazy.bind(imgs, async (item) => {
    const url = item.getAttribute('data-src');
    imgjz(url)
      .then((cache) => {
        item.src = cache;
      })
      .catch(() => {
        item.src = gqImg;
      });
  });
  syncScrollFromEditor(1);
});
const imgLazy = new LazyLoad();
$previewBox
  .on('click', 'img', function () {
    const imgs = $previewBox.find('img');
    let idx = 0;
    const arr = [];
    imgs.each((i, item) => {
      if (item === this) {
        idx = i;
      }
      arr.push({
        u1: item.getAttribute('data-src'),
      });
    });
    imgPreview(arr, idx);
  })
  .on('click', '.codeCopy', function () {
    const str = $(this).parent().find('code').text();
    copyText(str);
  })
  .on('click', '.shrink', function () {
    const $this = $(this);
    const flag = $this.attr('data-flag');
    if (flag === 'y') {
      $this.attr({
        'data-flag': 'n',
        class: 'shrink iconfont icon-shang',
      });
      $this.parent().find('code').removeClass('hide');
    } else {
      $this.attr({
        'data-flag': 'y',
        class: 'shrink iconfont icon-xiala',
      });
      $this.parent().find('code').addClass('hide');
    }
  });
// 粘贴图片
$editBox[0].addEventListener('paste', function (e) {
  const files = [];
  const data = e.clipboardData || window.clipboardData;
  [...data.items].forEach((item) => {
    const blob = item.getAsFile();
    if (blob && isImgFile(blob.name)) {
      files.push(blob);
    }
  });
  if (files.length === 0) return;
  e.preventDefault();
  hdUpFile(files);
});
// 调整宽度
~(function () {
  let previeW, editW, x;
  function hdDown(e) {
    $editWrap.addClass('no_select');
    previeW = $previewBox[0].offsetWidth;
    editW = $editBox[0].offsetWidth;
    if (e.type === 'touchstart') {
      x = e.touches[0].clientX;
    } else if (e.type === 'mousedown') {
      x = e.clientX;
    }
    this.addEventListener('touchmove', hdMove);
    document.addEventListener('mousemove', hdMove);
    this.addEventListener('touchend', hdUp);
    document.addEventListener('mouseup', hdUp);
  }
  function hdMove(e) {
    e.preventDefault();
    let xx;
    if (e.type === 'touchmove') {
      xx = e.touches[0].clientX;
    } else if (e.type === 'mousemove') {
      xx = e.clientX;
    }
    let diff = xx - x;
    x = xx;
    editW += diff;
    previeW -= diff;
    if (editW > 100 && previeW > 100) {
      $editBox.css({
        width: editW + 'px',
      });
      $previewBox.css({
        width: previeW + 'px',
      });
    }
  }
  function hdUp() {
    $editWrap.removeClass('no_select');
    this.removeEventListener('touchmove', hdMove);
    document.removeEventListener('mousemove', hdMove);
    this.removeEventListener('touchend', hdUp);
    document.removeEventListener('mouseup', hdUp);
  }
  $resize[0].addEventListener('mousedown', hdDown);
  $resize[0].addEventListener('touchstart', hdDown);
})();
// 上传
async function hdUpFile(files) {
  if (!isLogin()) {
    toLogin();
    return;
  }
  const fData = [];
  const controller = new AbortController();
  const signal = controller.signal;

  const upPro = new UpProgress(() => {
    controller.abort();
  });
  await concurrencyTasks(files, 3, async (file) => {
    if (signal.aborted) return;
    const { name, size } = file;
    const pro = upPro.add(name);
    if (!isImgFile(name)) {
      pro.fail();
      _msg.error(`图片格式错误`);
      return;
    }
    if (size <= 0 || size >= 5 * 1024 * 1024) {
      pro.fail();
      _msg.error(`图片限制0-5M`);
      return;
    }
    try {
      //文件切片
      const { HASH } = await md5.fileSlice(
        file,
        (percent) => {
          pro.loading(percent);
        },
        signal
      );
      const isrepeat = await reqPicRepeat({
        HASH,
      }); //是否已经存在文件

      if (isrepeat.code === 1) {
        pro.close('文件已存在');
        const { url } = isrepeat.data;
        fData.push({
          filename: _path.extname(name)[0],
          url: `/api/pub/picture/${url}`,
        });
        //文件已经存在操作
        return;
      }
      const result = await reqPicUp(
        {
          name,
          HASH,
        },
        file,
        (percent) => {
          pro.update(percent);
        },
        signal
      );
      if (result.code === 1) {
        const { url } = result.data;
        fData.push({
          filename: _path.extname(name)[0],
          url: `/api/pub/picture/${url}`,
        });
        pro.close();
      } else {
        pro.fail();
      }
    } catch {
      pro.fail();
    }
  });
  let str = '';
  fData.forEach((item) => {
    let { filename, url } = item;
    str += `\n![${filename}](${url})\n`;
  });
  editor.insert(str);
  editor.focus();
}
// 拖入上传
~(function () {
  document.addEventListener('dragenter', function (e) {
    e.preventDefault();
  });
  document.addEventListener('dragover', function (e) {
    e.preventDefault();
  });
  document.addEventListener('drop', function (e) {
    e.preventDefault();
    const files = [...e.dataTransfer.files];
    if (files.length === 0) return;
    hdUpFile(files);
  });
})();
function createLink() {
  editor.insert(`\n[](https://)\n`);
  let row = editor.selection.getCursor().row;
  editor.gotoLine(row, 1);
  editor.focus();
}
function createCodeBlock() {
  editor.insert(`\n\`\`\`javascript\n\n\`\`\`\n`);
  let row = editor.selection.getCursor().row;
  editor.gotoLine(row - 2, 13);
  editor.focus();
}
function createTable() {
  editor.insert(`\n|列1|列2|列3|\n|:--:|--|--|\n|行1|  |  |\n|行2|  |  |\n`);
  editor.focus();
}
$editWrap.css({
  'font-size': percentToValue(12, 40, editNoteFontSize),
});
// 设置
function settingEdit(e) {
  const data = [
    { id: 'size', text: '字体大小', beforeIcon: 'iconfont icon-font-size' },
    {
      id: 'setEditor',
      text: '编辑器配置',
      beforeIcon: 'iconfont icon-liebiao',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, id }) => {
      if (id === 'size') {
        percentBar(e, editNoteFontSize, (percent) => {
          $editWrap.css({
            'font-size': percentToValue(12, 30, percent),
          });
          editNoteFontSize = percent;
          _setData('editNoteFontSize', editNoteFontSize);
        });
      } else if (id === 'setEditor') {
        setEditor(e, editor);
      }
    },
    '设置'
  );
}
if (getScreenSize().w <= _d.screen) {
  previewState();
}
// 预览切换
function previewState() {
  if (!$headBtns._flag) {
    $headBtns._flag = 'y';
  }
  if ($headBtns._flag === 'y') {
    $headBtns._flag = 'n';
    $headBtns
      .find('.preview_state')
      .attr('class', 'preview_state iconfont icon-kejian');
    $previewBox.css('display', 'none');
    $editBox.addClass('open');
    $headBtns.find('.to_max_btn').css('display', 'none');
  } else {
    $headBtns._flag = 'y';
    $headBtns
      .find('.preview_state')
      .attr('class', 'preview_state iconfont icon-bukejian');
    $previewBox.css('display', 'block');
    $editBox.removeClass('open');
    $headBtns.find('.to_max_btn').css('display', 'block');
    rende();
  }
  $editBox.css('display', 'block');
}
$headBtns
  .on('click', '.setting_btn', settingEdit)
  .on('click', '.table_btn', createTable)
  .on('click', '.code_btn', createCodeBlock)
  .on('click', '.link_btn', createLink)
  .on('click', '.img_btn', async function () {
    if (!isLogin()) {
      toLogin();
      return;
    }
    const files = await getFiles({
      multiple: true,
      accept: 'image/*',
    });
    if (files.length === 0) return;
    hdUpFile(files);
  })
  .on('click', '.preview_state', previewState)
  .on('click', '.to_max_btn', function () {
    $editBox.toggle();
  })
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.share_btn', function (e) {
    showQcode(e, myOpen(), '扫码打开便条').catch(() => {});
  })
  .on('click', '.open_btn', openNotepad)
  .on('click', '.undo_btn', function () {
    editor.undo();
  })
  .on('click', '.redo_btn', function () {
    editor.redo();
  });
// 切换便条
function openNotepad(e) {
  rMenu.inpMenu(
    e,
    {
      items: {
        key: {
          placeholder: '请输入便条Key',
          beforeText: '便条Key：',
          verify(val) {
            if (val === '') {
              return '请输入便条Key';
            } else if (val.length > 20) {
              return '便条key过长';
            } else if (!/^[\w]+$/.test(val)) {
              return '只能包含数字、字母和下划线';
            }
          },
        },
      },
    },
    function ({ close, inp }) {
      close();
      myOpen(`/notepad/?k=${inp.key}`);
    },
    '切换到指定便条'
  );
}
if (isIframe()) {
  $headBtns.find('.h_go_home').remove();
}
if (!isIframe()) wave(5);
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  darkMode(dark);
  changeTheme(dark);
});
