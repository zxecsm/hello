import $ from 'jquery';
import '../../font/iconfont.css';
import '../../css/common/common.css';
import './index.less';
import '../note/md.css';
import {
  queryURLParams,
  myOpen,
  _setData,
  _getData,
  throttle,
  debounce,
  formatDate,
  imgPreview,
  isImgFile,
  toLogin,
  isIframe,
  wrapInput,
  getFiles,
  getSuffix,
  _progressBar,
  percentToValue,
  _getDataTem,
  _setDataTem,
  _setTimeout,
  LazyLoad,
  imgjz,
  isDarkMode,
  isLogin,
  wave,
  darkMode,
} from '../../js/utils/utils';
import '../../js/common/common';
import _msg from '../../js/plugins/message';
import { UpProgress } from '../../js/plugins/UpProgress';
import createEditer from '../../js/utils/editor';
import _pop from '../../js/plugins/popConfirm';
import gqImg from '../../images/img/gqimg.png';
import { reqNoteEdit, reqNoteRead } from '../../api/note';
import { reqPicRepeat, reqPicUp } from '../../api/pic';
import rMenu from '../../js/plugins/rightMenu';
import MdWorker from '../../js/utils/md.worker.js';
import fileSlice from '../../js/utils/fileSlice.js';
import changeDark from '../../js/utils/changeDark.js';
const mdWorker = new MdWorker();
const $contentWrap = $('.content_wrap'),
  $headBtns = $contentWrap.find('.head_btns'),
  $editWrap = $contentWrap.find('.edit_wrap'),
  $editBox = $editWrap.find('.edit_box'),
  $themeCss = $('.theme_css'),
  $previewBox = $editWrap.find('.preview_box'),
  $resize = $previewBox.find('.resize');

let editNoteCodeNum = _getData('editNoteCodeNum');
let editNoteFontSize = _getData('editNoteFontSize');
// 更改主题
function changeTheme(dark) {
  if (dark == 'y') {
    $themeCss.attr('href', '/css/notethem/notecode1.css');
    editor.setTheme('ace/theme/github_dark');
  } else if (dark == 'n') {
    $themeCss.attr('href', '/css/notethem/notecode.css');
    editor.setTheme('ace/theme/chrome');
  } else if (dark == 's') {
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
// 创建编辑器
const editor = createEditer($editBox[0]);
editor.getSession().setMode('ace/mode/markdown');
changeTheme(_getData('dark'));
// 快捷键
editor.getSession().on(
  'change',
  debounce(function () {
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
      accept: '.jpg,.jpeg,.png,.ico,.svg,.webp,.gif',
    });
    if (files.length == 0) return;
    hdUpFile(files);
  },
});
const $aceScroll = $editBox.find('.ace_scrollbar-v');
// 标题
const wInput = wrapInput($headBtns.find('.note_title input')[0], {
  change(val) {
    val = val.trim();
    if (val == '') {
      $headBtns.find('.note_title i').css('display', 'none');
    } else {
      $headBtns.find('.note_title i').css('display', 'block');
    }
    handleSave();
  },
});
function initValue(obj) {
  wInput.setValue(obj.name);
  editor.setValue(obj.data);
  editor.gotoLine(1);
  // editor.focus();
  orginData = obj;
}
let urlObj = queryURLParams(myOpen()),
  { HASH } = urlObj;
// 对比记录
let orginData = {
  name: '',
  data: '',
};
if (!HASH) {
  HASH = 'new';
  myOpen(`/edit/#new`);
}
// 临时草稿
let temNoteObj = _getDataTem('temNote') || {};
function updateIframeTitle(title) {
  if (isIframe()) {
    try {
      // 更新标题
      window.parent.openInIframe.hdTitle.updateTitle(window.iframeId, title);
      // eslint-disable-next-line no-unused-vars
    } catch (error) {}
  }
}
if (HASH === 'new') {
  //新增笔记
  initValue({
    name: formatDate({ template: '{0}-{1}-{2} {3}:{4}' }),
    data: _getData('newNote'),
  });
  orginData.data = '';
  $headBtns.addClass('open');
  $editWrap.addClass('open');
} else {
  //获取内容编辑笔记
  if (!isLogin()) {
    toLogin();
  } else {
    reqNoteRead({ v: HASH })
      .then((result) => {
        if (parseInt(result.code) === 0) {
          initValue(result.data);
          _setTimeout(() => {
            updateIframeTitle(result.data.name);
          }, 1000);
          $headBtns.addClass('open');
          $editWrap.addClass('open');
          if (temNoteObj[HASH] && temNoteObj[HASH] != result.data.data) {
            _pop({ text: '恢复：未保存的笔记？' }, (type) => {
              if (type == 'confirm') {
                editor.setValue(temNoteObj[HASH]);
                editor.gotoLine(1);
              }
            });
          }
        }
      })
      .catch(() => {});
  }
}
// 渲染转换显示
function rende() {
  let text = editor.getValue();
  if (HASH === 'new') {
    // 新笔记未上传则保存在本地
    _setData('newNote', text);
  } else {
    if ($editBox.flag) {
      temNoteObj[HASH] = text;
      _setDataTem('temNote', temNoteObj);
    }
    $editBox.flag = true;
  }
  handleSave(); // 处理保存按钮
  if ($previewBox.is(':hidden')) return;
  if (text.trim() == '') {
    $previewBox.find('.content').html('');
    return;
  }
  mdWorker.postMessage(text);
}
mdWorker.addEventListener('message', (event) => {
  $previewBox.find('.content').html(event.data);
  imgLazy.bind(
    $previewBox.find('.content')[0].querySelectorAll('img'),
    (item) => {
      const url = item.getAttribute('data-src');
      imgjz(
        url,
        () => {
          item.src = url;
        },
        () => {
          item.src = gqImg;
        }
      );
    }
  );
  hdScroll();
});
const imgLazy = new LazyLoad();
// 处理保存按钮
function handleSave() {
  let name = wInput.getValue().trim(),
    data = editor.getValue();
  // 对比内容
  if (orginData.name + orginData.data == name + data) {
    $headBtns.find('.save_btn').removeClass('active');
    return;
  }
  $headBtns.find('.save_btn').addClass('active');
}
// 查看图片
$previewBox.on('click', 'img', function () {
  const imgs = $previewBox.find('img');
  let idx = 0;
  const arr = [];
  imgs.each((i, item) => {
    if (item == this) {
      idx = i;
    }
    arr.push({
      u1: item.getAttribute('data-src'),
    });
  });
  imgPreview(arr, idx);
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
  if (files.length == 0) return;
  e.preventDefault();
  hdUpFile(files);
}
// 拖拽调整宽度
~(function () {
  let previeW, editW, x;
  function hdDown(e) {
    $editWrap.addClass('jzxz');
    previeW = $previewBox[0].offsetWidth;
    editW = $editBox[0].offsetWidth;
    if (e.type == 'touchstart') {
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
    if (e.type == 'touchmove') {
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
    $editWrap.removeClass('jzxz');
    this.removeEventListener('touchmove', hdMove);
    document.removeEventListener('mousemove', hdMove);
    this.removeEventListener('touchend', hdUp);
    document.removeEventListener('mouseup', hdUp);
  }
  $resize[0].addEventListener('mousedown', hdDown);
  $resize[0].addEventListener('touchstart', hdDown);
})();
$aceScroll.on('scroll', hdScroll);
// 滚动同步
function hdScroll() {
  if ($previewBox.is(':hidden')) return;
  let CT = $aceScroll.scrollTop(),
    CBH = $editBox.outerHeight(),
    CH = $aceScroll[0].scrollHeight - CBH,
    SH = $previewBox.find('.content')[0].scrollHeight - CBH,
    ST = (CT / CH) * SH;
  $previewBox.find('.content').scrollTop(ST);
}
// 删除图片
async function hdUpFile(files) {
  if (!isLogin()) {
    toLogin();
    return;
  }
  const fData = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const { name, size } = file;
    const pro = new UpProgress(name);
    if (!isImgFile(name)) {
      pro.fail();
      _msg.error(`图片格式错误`);
      continue;
    }
    if (size <= 0 || size >= 5 * 1024 * 1024) {
      pro.fail();
      _msg.error(`图片大小必须0~5M范围`);
      continue;
    }
    try {
      //文件切片
      const { HASH } = await fileSlice(file, (percent) => {
        pro.loading(percent);
      });
      const isrepeat = await reqPicRepeat({
        HASH,
      }); //是否已经存在文件

      if (parseInt(isrepeat.code) === 0) {
        pro.close('文件已存在');
        const { url } = isrepeat.data;
        fData.push({
          filename: getSuffix(name)[0],
          url: `/api/pub/picture/${url}`,
        });
        //文件已经存在操作
        continue;
      }
      const result = await reqPicUp(
        {
          name,
          HASH,
        },
        file,
        (percent) => {
          pro.update(percent);
        }
      );
      if (parseInt(result.code) === 0) {
        const { url } = result.data;
        fData.push({
          filename: getSuffix(name)[0],
          url: `/api/pub/picture/${url}`,
        });
        pro.close();
      } else {
        pro.fail();
      }
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      pro.fail();
    }
  }
  let str = '';
  fData.forEach((item) => {
    let { filename, url } = item;
    str += `\n![${filename}](${url})\n`;
  });
  editor.insert(str);
  editor.focus();
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
    if (files.length == 0) return;
    hdUpFile(files);
  });
})();
// 快捷键
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
function setNoteFontSize() {
  $editWrap.css({
    'font-size': percentToValue(12, 40, editNoteFontSize),
  });
}
setNoteFontSize();
function changeCodeNum() {
  editor.setOption('showGutter', editNoteCodeNum);
}
changeCodeNum();
// 设置
function settingEdit(e) {
  const data = [
    { id: 'size', text: '字体大小', beforeIcon: 'iconfont icon-font-size' },
    {
      id: 'num',
      text: '行号',
      beforeIcon: 'iconfont icon-bianhao',
      afterIcon: editNoteCodeNum
        ? 'iconfont icon-kaiguan-kai1'
        : 'iconfont icon-kaiguan-guan',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, resetMenu, id }) => {
      if (id == 'size') {
        _progressBar(e, editNoteFontSize, (percent) => {
          editNoteFontSize = percent;
          setNoteFontSize();
          _setData('editNoteFontSize', editNoteFontSize);
        });
      } else if (id == 'num') {
        editNoteCodeNum = !editNoteCodeNum;
        _setData('editNoteCodeNum', editNoteCodeNum);
        data[1].afterIcon = editNoteCodeNum
          ? 'iconfont icon-kaiguan-kai1'
          : 'iconfont icon-kaiguan-guan';
        resetMenu(data);
        changeCodeNum();
      }
    },
    '设置'
  );
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
      .attr('class', 'preview_state iconfont icon-yanjing_yincang_o');
    $previewBox.css('display', 'none');
    $editBox.addClass('open');
    $headBtns.find('.to_max_btn').css('display', 'none');
  } else {
    $headBtns._flag = 'y';
    $headBtns
      .find('.preview_state')
      .attr('class', 'preview_state iconfont icon-yanjing_xianshi_o');
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
  .on('click', '.table_btn', createTable)
  .on('click', '.code_btn', createCodeBlock)
  .on('click', '.link_btn', createLink)
  .on('click', '.img_btn', async function hdClickImgBtn() {
    if (!isLogin()) {
      toLogin();
      return;
    }
    const files = await getFiles({
      multiple: true,
      accept: '.jpg,.jpeg,.png,.ico,.svg,.webp,.gif',
    });
    if (files.length == 0) return;
    hdUpFile(files);
  })
  .on('click', '.note_title i', function () {
    wInput.setValue('');
    wInput.target.focus();
  })
  .on('click', '.preview_state', previewState)
  .on('click', '.to_max_btn', function () {
    $editBox.toggle();
  })
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.save_btn', hdClickSaveBtn);
if (isIframe()) {
  $headBtns.find('.h_go_home').remove();
}
// 保存笔记
function saveNote() {
  if (!isLogin()) {
    toLogin();
    return;
  }
  const name = wInput.getValue().trim(),
    data = editor.getValue();
  if (name === '') {
    _msg.error('请输入标题');
    return;
  }
  if (name > 100) {
    _msg.error('标题过长');
    return;
  }
  if (name === orginData.name && data === orginData.data) return;
  reqNoteEdit({ id: HASH, name, data })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        orginData.data = data;
        orginData.name = name;
        updateIframeTitle(name);
        $headBtns.find('.save_btn').removeClass('active');
        if (result.data) {
          // 新建笔记成功
          if (HASH === 'new') {
            // 新笔记,则清除本地保存内容
            _setData('newNote', '');
          }
          HASH = result.data.id;
          myOpen(`/edit/#${encodeURIComponent(HASH)}`);
          _msg.success(result.codeText);
          return;
        }
        delete temNoteObj[HASH];
        _setDataTem('temNote', temNoteObj);
        // 更新笔记成功
        _msg.success(result.codeText);
      }
    })
    .catch(() => {});
}
if (!isIframe()) {
  // 禁止后退
  function pushHistory() {
    window.history.pushState(null, '', myOpen());
  }
  pushHistory();
  window.addEventListener('popstate', function () {
    pushHistory();
    // to do something
  });
}
if (!isIframe()) wave(5);
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  changeTheme(dark);
  darkMode(dark);
});
