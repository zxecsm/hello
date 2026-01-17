import $ from 'jquery';
import '../../font/iconfont.css';
import '../../css/common/common.css';
import './index.less';
import '../note/md.less';
import {
  queryURLParams,
  myOpen,
  throttle,
  debounce,
  formatDate,
  isImgFile,
  toLogin,
  isIframe,
  wrapInput,
  getFiles,
  percentToValue,
  _setTimeout,
  LazyLoad,
  imgjz,
  isDarkMode,
  isLogin,
  concurrencyTasks,
  copyText,
  getMinIndex,
  getScreenSize,
  _myOpen,
  getTextSize,
  toggleUserSelect,
  getFilePath,
} from '../../js/utils/utils';
import '../../js/common/common';
import _msg from '../../js/plugins/message';
import { UpProgress } from '../../js/plugins/UpProgress';
import aceEditor from '../../js/utils/editor';
import gqImg from '../../images/img/gqimg.png';
import {
  reqNoteEdit,
  reqNoteGetHistoryState,
  reqNoteHistoryState,
  reqNoteRead,
} from '../../api/note';
import { reqPicRepeat, reqPicUp } from '../../api/pic';
import rMenu from '../../js/plugins/rightMenu';
import MdWorker from '../../js/utils/md.worker.js';
import _d from '../../js/common/config.js';
import md5 from '../../js/utils/md5.js';
import _path from '../../js/utils/path.js';
import { setEditor } from './setEditor.js';
import cacheFile from '../../js/utils/cacheFile.js';
import imgPreview from '../../js/plugins/imgPreview/index.js';
import realtime from '../../js/plugins/realtime/index.js';
import { otherWindowMsg, waitLogin } from '../home/home.js';
import localData from '../../js/common/localData.js';
import { insertBlock } from './edit.js';
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
// 更改主题
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
window.changeTheme = changeTheme;
// 创建编辑器
const editor = aceEditor.createEditor($editBox[0]);
aceEditor.setMode(editor, 'x.md');
changeTheme(localData.get('dark'));
// 快捷键
editor.getSession().on(
  'change',
  debounce(function () {
    switchUndoState();
    rende();
  }, 1000),
);
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
editor.getSession().on('change', handleSave);
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
  // let firstElement = $previewBox[0].querySelector(
  //   `[data-line="${firstVisibleRow}"]`
  // );
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
// 标题
const wInput = wrapInput($headBtns.find('.note_title input')[0], {
  update(val) {
    if (val === '') {
      $headBtns.find('.note_title i').css('display', 'none');
    } else {
      $headBtns.find('.note_title i').css('display', 'block');
    }
    handleSave();
  },
  focus() {
    $headBtns.find('.note_title').addClass('focus');
  },
  blur() {
    $headBtns.find('.note_title').removeClass('focus');
  },
});
function initValue(obj) {
  editor.setValue(obj.content);
  wInput.setValue(obj.title);
  editor.gotoLine(1);
  aceEditor.reset(editor);
  switchUndoState();
  if (obj.content === '') {
    editor.focus();
  }
}
let urlObj = queryURLParams(myOpen()),
  { HASH } = urlObj;
// 对比记录
let orginData = {
  title: '',
  content: '',
};
if (!HASH) {
  HASH = 'new';
  myOpen(`#new`);
}
function updateIframeTitle(title) {
  if (isIframe()) {
    try {
      // 更新标题
      window.parent.openInIframe.iframes.get(window.iframeId).updateTitle(title);
    } catch {}
  }
}
if (HASH === 'new') {
  cacheFile.getData('newNote').then((text) => {
    initValue({
      title: formatDate({ template: '{0}-{1}-{2} {3}:{4}' }),
      content: text,
    });
  });
  //新增笔记
  $headBtns.addClass('open');
  $editWrap.addClass('open');
} else {
  //获取内容编辑笔记
  if (!isLogin()) {
    toLogin();
  } else {
    reqNoteRead({ v: HASH })
      .then(async (result) => {
        if (result.code === 1) {
          orginData = result.data;
          initValue(result.data);
          _setTimeout(() => {
            updateIframeTitle(result.data.title);
          }, 1000);
          $headBtns.addClass('open');
          $editWrap.addClass('open');
          const temNoteObj = (await cacheFile.getData('temNote')) || {};
          if (temNoteObj[HASH] && temNoteObj[HASH] != result.data.content) {
            rMenu.pop({ text: '恢复：未保存的笔记？' }, (type) => {
              if (type === 'confirm') {
                editor.setValue(temNoteObj[HASH]);
                editor.gotoLine(1);
              } else if (type === 'cancel') {
                delete temNoteObj[HASH];
                cacheFile.setData('temNote', temNoteObj);
              }
            });
          }
        }
      })
      .catch(() => {});
  }
}
// 渲染转换显示
let temNoteFlag = false;
async function rende() {
  let text = editor.getValue();
  if (HASH === 'new') {
    // 新笔记未上传则保存在本地
    await cacheFile.setData('newNote', text);
  } else {
    if (temNoteFlag) {
      const temNoteObj = (await cacheFile.getData('temNote')) || {};
      temNoteObj[HASH] = text;
      await cacheFile.setData('temNote', temNoteObj);
    }
    temNoteFlag = true;
  }
  if ($previewBox.is(':hidden')) return;
  if (text.trim() === '') {
    $previewBox.find('.content').html('');
    return;
  }
  if (getTextSize(text) > _d.fieldLength.noteSize) {
    $previewBox.find('.content').html(`<h1>笔记内容过长</h1>`);
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
    imgjz(item.getAttribute('data-src'))
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
// 处理保存按钮
function handleSave() {
  const title = wInput.getValue().trim(),
    content = editor.getValue();
  // 对比内容
  if (orginData.title + orginData.content === title + content) {
    $headBtns.find('.save_btn').removeClass('active');
    return;
  }
  $headBtns.find('.save_btn').addClass('active');
}
// 查看图片
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
$editBox
  .on('keydown', function (e) {
    const key = e.key,
      ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && key === 's') {
      if (HASH) {
        hdClickSaveBtn();
        e.preventDefault();
      }
    }
  })[0]
  .addEventListener('paste', pasteImg);
// 粘贴图片
function pasteImg(e) {
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
}
// 拖拽调整宽度
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
    toggleUserSelect();
    this.removeEventListener('touchmove', hdMove);
    document.removeEventListener('mousemove', hdMove);
    this.removeEventListener('touchend', hdUp);
    document.removeEventListener('mouseup', hdUp);
  }
  $resize[0].addEventListener('mousedown', hdDown);
  $resize[0].addEventListener('touchstart', hdDown);
})();
// 上传图片
async function hdUpFile(files) {
  if (!isLogin()) {
    toLogin();
    return;
  }
  const controller = new AbortController();
  const signal = controller.signal;

  const upPro = new UpProgress(() => {
    controller.abort();
  });
  const fData = [];
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
    const { filename, url } = item;
    insertBlock(editor, 'img', { alt: filename, src: url });
  });
}
// 拖拽上传
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

function setNoteFontSize() {
  $editWrap.css({
    'font-size': percentToValue(12, 40, editNoteFontSize),
  });
}
setNoteFontSize();
// 设置
async function settingEdit(e) {
  let noteHistoryState = 0;
  if (isLogin()) {
    try {
      const res = await reqNoteGetHistoryState();
      if (res.code === 1) {
        noteHistoryState = res.data.note_history;
      }
    } catch {}
  }
  const data = [
    {
      id: 'size',
      beforeIcon: 'iconfont icon-font-size',
      text: '字体大小',
    },
    {
      id: 'setEditor',
      text: '编辑器配置',
      beforeIcon: 'iconfont icon-liebiao',
    },
  ];
  if (isLogin()) {
    data.push({
      id: 'history',
      text: '保存笔记历史',
      beforeIcon: 'iconfont icon-history',
      afterIcon: 'iconfont ' + (noteHistoryState ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'),
      param: { value: noteHistoryState },
    });
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, id, param, loading, resetMenu }) => {
      const curItem = data.find((item) => item.id === id);
      if (id === 'size') {
        rMenu.percentBar(e, editNoteFontSize, (percent) => {
          editNoteFontSize = percent;
          setNoteFontSize();
          localData.set('editNoteFontSize', editNoteFontSize, 200);
        });
      } else if (id === 'setEditor') {
        setEditor(e, editor, () => {
          handleSave();
        });
      } else if (id === 'history') {
        loading.start();
        reqNoteHistoryState({ state: param.value ? 0 : 1 })
          .then((res) => {
            if (res.code === 1) {
              loading.end();
              if (param.value) {
                curItem.afterIcon = 'iconfont icon-kaiguan-guan';
                curItem.param.value = false;
                _msg.success('关闭成功');
              } else {
                curItem.afterIcon = 'iconfont icon-kaiguan-kai1';
                curItem.param.value = true;
                _msg.success('开启成功');
              }
              resetMenu(data);
            }
          })
          .catch(() => {
            loading.end();
          });
      }
    },
    '设置',
  );
}
if (getScreenSize().w <= _d.screen) {
  previewState();
}
// 预览切换
let previewStateFlag = '';
function previewState() {
  if (!previewStateFlag) {
    previewStateFlag = 'y';
  }
  if (previewStateFlag === 'y') {
    previewStateFlag = 'n';
    $headBtns.find('.preview_state').attr('class', 'preview_state iconfont icon-kejian');
    $previewBox.css('display', 'none');
    $editBox.addClass('open');
    $headBtns.find('.to_max_btn').css('display', 'none');
  } else {
    previewStateFlag = 'y';
    $headBtns.find('.preview_state').attr('class', 'preview_state iconfont icon-bukejian');
    $previewBox.css('display', 'block');
    $editBox.removeClass('open');
    $headBtns.find('.to_max_btn').css('display', 'block');
    rende();
  }
  $editBox.css('display', 'block');
}
const hdClickSaveBtn = throttle(saveNote, 1000);
$headBtns
  .on('click', '.setting_btn', settingEdit)
  .on('click', '.history_btn', () => {
    if (!isLogin()) {
      toLogin();
      return;
    }
    _myOpen(`/file#${_d.noteHistoryDir}/${HASH}`, '文件管理');
  })
  .on('click', '.table_btn', () => insertBlock(editor, 'table'))
  .on('click', '.code_btn', () => insertBlock(editor, 'code'))
  .on('click', '.link_btn', () => insertBlock(editor, 'link'))
  .on('click', '.img_btn', async function hdClickImgBtn() {
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
  .on('click', '.note_title i', function () {
    wInput.setValue('').focus();
  })
  .on('click', '.preview_state', previewState)
  .on('click', '.to_max_btn', function () {
    $editBox.toggle();
  })
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.save_btn', hdClickSaveBtn)
  .on('click', '.undo_btn', function () {
    editor.undo();
  })
  .on('click', '.redo_btn', function () {
    editor.redo();
  });
if (isIframe()) {
  $headBtns.find('.h_go_home').remove();
}
// 保存笔记
function saveNote() {
  if (!isLogin()) {
    toLogin();
    return;
  }
  const title = wInput.getValue().trim(),
    content = editor.getValue();
  if (title === '') {
    _msg.error('请输入标题');
    return;
  }
  if (title > _d.fieldLength.title) {
    _msg.error('标题过长');
    return;
  }
  if (getTextSize(content) > _d.fieldLength.noteSize) {
    _msg.error('笔记内容过长');
    return;
  }
  if (title === orginData.title && content === orginData.content) return;
  reqNoteEdit({ id: HASH, title, content })
    .then(async (result) => {
      if (result.code === 1) {
        orginData.content = content;
        orginData.title = title;
        updateIframeTitle(title);
        $headBtns.find('.save_btn').removeClass('active');
        if (result.data) {
          // 新建笔记成功
          if (HASH === 'new') {
            // 新笔记,则清除本地保存内容
            await cacheFile.setData('newNote', '');
          }
          HASH = result.data.id;
          myOpen(`#${encodeURIComponent(HASH)}`);
          _msg.success(result.codeText);
          return;
        }
        const temNoteObj = (await cacheFile.getData('temNote')) || {};
        delete temNoteObj[HASH];
        await cacheFile.setData('temNote', temNoteObj);
        // 更新笔记成功
        _msg.success(result.codeText);
      }
    })
    .catch(() => {});
}
