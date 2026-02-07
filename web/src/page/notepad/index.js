import $ from 'jquery';
import '../../font/iconfont.css';
import '../../css/common/common.css';
import '../edit/index.less';
import './index.less';
import '../note/md.less';
import {
  queryURLParams,
  myOpen,
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
  concurrencyTasks,
  copyText,
  getMinIndex,
  getScreenSize,
  getTextSize,
  toggleUserSelect,
  getFilePath,
} from '../../js/utils/utils';
import '../../js/common/common';
import _msg from '../../js/plugins/message';
import { UpProgress } from '../../js/plugins/UpProgress';
import aceEditor from '../../js/utils/editor';
import gqImg from '../../images/img/gqimg.png';
import { reqGetNotePad, reqNotePad } from '../../api/notepad';
import { reqPicRepeat, reqPicUp } from '../../api/pic';
import rMenu from '../../js/plugins/rightMenu';
import MdWorker from '../../js/utils/md.worker.js';
import _d from '../../js/common/config.js';
import md5 from '../../js/utils/md5.js';
import _path from '../../js/utils/path.js';
import { setEditor } from '../edit/setEditor.js';
import cacheFile from '../../js/utils/cacheFile.js';
import imgPreview from '../../js/plugins/imgPreview/index.js';
import realtime from '../../js/plugins/realtime/index.js';
import { otherWindowMsg, waitLogin } from '../home/home.js';
import localData from '../../js/common/localData.js';
import { insertBlock } from '../edit/edit.js';
const mdWorker = new MdWorker();
const $contentWrap = $('.content_wrap'),
  $headBtns = $contentWrap.find('.head_btns'),
  $editWrap = $contentWrap.find('.edit_wrap'),
  $editBox = $editWrap.find('.edit_box'),
  $themeCss = $('<link class="theme_css" rel="stylesheet" />'),
  $previewBox = $editWrap.find('.preview_box'),
  $resize = $previewBox.find('.resize');
document.head.appendChild($themeCss[0]);
let editNoteFontSize = localData.get('editNoteFontSize');
// 黑暗模式
function changeTheme(dark) {
  if (dark === 'y') {
    $themeCss.attr('href', '/css/notethem/notecode1.css');
    editor.setTheme('ace/theme/github_dark');
  } else if (dark === 'n') {
    $themeCss.attr('href', '/css/notethem/notecode.css');
    editor.setTheme('ace/theme/github_light_default');
  } else if (dark === 's') {
    if (isDarkMode()) {
      $themeCss.attr('href', '/css/notethem/notecode1.css');
      editor.setTheme('ace/theme/github_dark');
    } else {
      $themeCss.attr('href', '/css/notethem/notecode.css');
      editor.setTheme('ace/theme/github_light_default');
    }
  }
}
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
window.changeTheme = changeTheme;
// 编辑器
const editor = aceEditor.createEditor($editBox[0]);
aceEditor.setMode(editor, 'x.md');
changeTheme(localData.get('dark'));
function switchUndoState() {
  if (aceEditor.hasUndo(editor)) {
    $headBtns.find('.undo_btn').removeClass('deactive');
  } else {
    $headBtns.find('.undo_btn').addClass('deactive');
  }
  if (aceEditor.hasRedo(editor)) {
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
  }, 1000),
);
// 1. 获取当前的VSCode键盘处理器
const vscodeHandler = editor.keyBinding.getKeyboardHandler();

// 2. 批量解绑冲突的快捷键
const shortcutsToRemove = [
  'Ctrl-K', // VSCode默认的"快速打开"命令
  'Ctrl-Shift-K', // VSCode默认的"删除行"命令
  'Ctrl-B', // VSCode默认的"侧边栏切换"命令
  'Ctrl-I', // VSCode默认的"转到实现"命令
];

shortcutsToRemove.forEach((shortcut) => {
  vscodeHandler.bindKey(shortcut, null); // 解除绑定
});

// 3. 批量添加自定义命令
const customCommands = [
  {
    name: 'createLink',
    bindKey: { win: 'Ctrl-K', mac: 'Command-K' },
    exec: function () {
      insertBlock(editor, 'link');
    },
  },
  {
    name: 'codeBlock',
    bindKey: { win: 'Ctrl-Shift-K', mac: 'Command-Shift-K' },
    exec: function () {
      insertBlock(editor, 'code');
    },
  },
  {
    name: 'codeTable',
    bindKey: { win: 'Ctrl-B', mac: 'Command-B' },
    exec: function () {
      insertBlock(editor, 'table');
    },
  },
  {
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
  },
];

customCommands.forEach((cmd) => {
  // 两种方式都可以，推荐使用addCommand确保命令注册
  vscodeHandler.addCommand(cmd);
  editor.commands.addCommand(cmd); // 双重保险
});

// 4. 重新应用处理器（确保更改生效）
editor.setKeyboardHandler(vscodeHandler);
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
    previewLines.map((item) => Math.abs(firstVisibleRow - item.dataset.line)),
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
        _d.speed,
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
  }, 200),
);
// 预览区滚动同步到编辑器
function syncScrollFromPreview() {
  if (isSyncingEditorScroll) return;
  isSyncingPreviewScroll = true;
  if ($editBox.is(':hidden')) return;
  const scrollTop = $previewBox.find('.content').scrollTop();

  let firstVisibleElement = previewLines.find((el) => el.offsetTop >= scrollTop);

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
  aceEditor.reset(editor);
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
          beforeText: '便条Key：',
          verify(val) {
            return (
              rMenu.validString(val, 1, _d.fieldLength.filename) || rMenu.validAlphanumeric(val)
            );
          },
        },
      },
    },
    ({ inp }) => {
      myOpen(`/notepad?k=${inp.key}`);
    },
    0,
    1,
    1,
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
    if (getTextSize(data) > _d.fieldLength.noteSize) {
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
  if (getTextSize(text) > _d.fieldLength.noteSize) {
    $previewBox.find('.content').html(`<h1>便签内容过长</h1>`);
    return;
  }
  mdWorker.postMessage(text);
}
mdWorker.addEventListener('message', (event) => {
  $previewBox.find('.content').html(event.data);
  previewLines = [...$previewBox[0].querySelectorAll(`[data-line]`)];
  const imgs = [...$previewBox.find('.content')[0].querySelectorAll('img')].filter((item) => {
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
  .on('click', 'img', function (e) {
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
    imgPreview(arr, idx, { x: e.clientX, y: e.clientY });
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
    toggleUserSelect(false);
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
    const diff = xx - x;
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
    const eW = $editBox[0].offsetWidth;
    const pW = $previewBox[0].offsetWidth;
    const previewPercent = (pW / (eW + pW)) * 100;
    $previewBox.css({
      width: previewPercent + '%',
    });
    $editBox.css({
      width: 100 - previewPercent + '%',
    });
    toggleUserSelect();
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
      _msg.error(`不支持的图片格式：${name}`, null, { reside: true });
      return;
    }
    if (size <= 0 || size >= _d.fieldLength.maxPicSize * 1024 * 1024) {
      pro.fail();
      _msg.error(`图片限制0-${_d.fieldLength.maxPicSize}MB：${name}`, null, {
        reside: true,
      });
      return;
    }
    try {
      //文件切片
      const HASH = await md5.sampleHash(file);
      const isrepeat = await reqPicRepeat({
        HASH,
      }); //是否已经存在文件

      if (isrepeat.code === 1) {
        pro.close('图片已存在');
        const { id } = isrepeat.data;
        fData.push({
          filename: _path.extname(name)[0],
          url: getFilePath(`/pic/${id}`),
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
        signal,
      );
      if (result.code === 1) {
        const { id } = result.data;
        fData.push({
          filename: _path.extname(name)[0],
          url: getFilePath(`/pic/${id}`),
        });
        pro.close();
      } else {
        pro.fail();
        _msg.error(`上传图片失败：${name}`, null, { reside: true });
      }
    } catch {
      pro.fail();
      _msg.error(`上传图片失败：${name}`, null, { reside: true });
    }
  });
  fData.forEach((item) => {
    let { filename, url } = item;
    insertBlock(editor, 'img', { alt: filename, src: url });
  });
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
        rMenu.percentBar(e, editNoteFontSize, (percent) => {
          $editWrap.css({
            'font-size': percentToValue(12, 30, percent),
          });
          editNoteFontSize = percent;
          localData.set('editNoteFontSize', editNoteFontSize, 200);
        });
      } else if (id === 'setEditor') {
        setEditor(e, editor);
      }
    },
    '设置',
  );
}
// 预览切换
let previewFlag = false;
if (getScreenSize().w <= _d.screen) {
  previewState();
}
function previewState() {
  if (!previewFlag) {
    previewFlag = 'y';
  }
  if (previewFlag === 'y') {
    previewFlag = 'n';
    $headBtns.find('.preview_state').attr('class', 'preview_state iconfont icon-kejian');
    $previewBox.css('display', 'none');
    $editBox.addClass('open');
    $headBtns.find('.to_max_btn').css('display', 'none');
  } else {
    previewFlag = 'y';
    $headBtns.find('.preview_state').attr('class', 'preview_state iconfont icon-bukejian');
    $previewBox.css('display', 'block');
    $editBox.removeClass('open');
    $headBtns.find('.to_max_btn').css('display', 'block');
    rende();
  }
  $editBox.css('display', 'block');
}
$headBtns
  .on('click', '.setting_btn', settingEdit)
  .on('click', '.table_btn', () => insertBlock(editor, 'table'))
  .on('click', '.code_btn', () => insertBlock(editor, 'code'))
  .on('click', '.link_btn', () => insertBlock(editor, 'link'))
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
          beforeText: '便条Key：',
          verify(val) {
            return (
              rMenu.validString(val, 1, _d.fieldLength.filename) || rMenu.validAlphanumeric(val)
            );
          },
        },
      },
    },
    function ({ close, inp }) {
      close();
      myOpen(`/notepad?k=${inp.key}`);
    },
    '切换到指定便条',
  );
}
if (isIframe()) {
  $headBtns.find('.h_go_home').remove();
}
