import $ from 'jquery';
import createEditer from '../../js/utils/editor';
import {
  ContentScroll,
  _getData,
  _myOpen,
  _setData,
  darkMode,
  debounce,
  getTextSize,
  isDarkMode,
  isIframe,
  percentToValue,
  toHide,
  wave,
} from '../../js/utils/utils';
import _msg from '../../js/plugins/message';
import _pop from '../../js/plugins/popConfirm';
import { reqFileSaveFile } from '../../api/file';
import bus from '../../js/utils/bus';
import rMenu from '../../js/plugins/rightMenu';
import changeDark from '../../js/utils/changeDark';
import _path from '../../js/utils/path';
import { setEditor } from '../edit/setEditor';
import _d from '../../js/common/config';
import percentBar from '../../js/plugins/percentBar';
import cacheFile from '../../js/utils/cacheFile';
const $editFile = $('.edit_file');
const $container = $('#app .container');
let oText = '';
let originText = '';
let readOnly = false;
const editor = createEditer($editFile.find('.editor')[0]);
let fileFontSize = _getData('fileFontSize');
export function editFileIsHiden() {
  return $editFile.is(':hidden');
}
changeTheme(_getData('dark'));
// 切换黑暗模式
function changeTheme(dark) {
  if (dark === 'y') {
    editor.setTheme('ace/theme/github_dark');
  } else if (dark === 'n') {
    editor.setTheme('ace/theme/chrome');
  } else if (dark === 's') {
    if (isDarkMode()) {
      editor.setTheme('ace/theme/github_dark');
    } else {
      editor.setTheme('ace/theme/chrome');
    }
  }
}
let filePath = '';
let currentCodeType = 'text'; // 语言
window.changeTheme = changeTheme;

export function setReadOnly(val) {
  readOnly = val;
  // editor.setReadOnly(readOnly);
}
// 编辑文件
export function openFile(text, path) {
  path = _path.normalize(path);
  hideContainer();
  filePath = path;
  $editFile.css('display', 'flex');
  document.documentElement.classList.add('notScroll');
  renderTitle(path);
  currentCodeType = setTextType(_path.extname(path)[2]);
  originText = oText = text;
  editor.setValue(text);
  editor.gotoLine(1);
  createEditer.reset(editor);
  switchUndoState();
  if (text === '') {
    editor.focus();
  }
}
// 生成标题
function renderTitle(path) {
  editTitleContentScroll.init(path);
}
// 语言处理
const codeTypes = [
  'text',
  'js',
  'ts',
  'md',
  'css',
  'html',
  'json',
  'less',
  'conf',
  'yaml',
  'sql',
  'sh',
];
function setTextType(type) {
  let res = 'text';
  if (type === 'js' || type === 'vue' || type === 'jsx') {
    res = 'js';
    type = 'ace/mode/javascript';
  } else if (type === 'ts') {
    res = 'ts';
    type = 'ace/mode/typescript';
  } else if (type === 'md') {
    res = 'md';
    type = 'ace/mode/markdown';
  } else if (type === 'css') {
    res = 'css';
    type = 'ace/mode/css';
  } else if (type === 'html') {
    res = 'html';
    type = 'ace/mode/html';
  } else if (type === 'json') {
    res = 'json';
    type = 'ace/mode/json';
  } else if (type === 'less' || type === 'sass') {
    res = 'less';
    type = 'ace/mode/less';
  } else if (type === 'conf') {
    res = 'conf';
    type = 'ace/mode/nginx';
  } else if (type === 'yaml' || type === 'yml') {
    res = 'yaml';
    type = 'ace/mode/yaml';
  } else if (type === 'sql') {
    res = 'sql';
    type = 'ace/mode/sql';
  } else if (type === 'sh') {
    res = 'sh';
    type = 'ace/mode/sh';
  } else {
    type = 'ace/mode/text';
  }
  editor.getSession().setMode(type);
  return res;
}
// 初始化
function init() {
  editor.setValue('');
  oText = '';
  saveState();
}
$editFile.on('keydown', function (e) {
  let key = e.key,
    ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && key === 's') {
    e.preventDefault();
    hdSave();
  }
});
// 切换保存状态
function saveState() {
  if (readOnly) return;
  if (oText === editor.getValue()) {
    $editFile.find('.head_btn .save').css('display', 'none');
  } else {
    $editFile.find('.head_btn .save').css('display', 'block');
  }
}
function switchUndoState() {
  if (createEditer.hasUndo(editor)) {
    $editFile.find('.head_btn .undo').removeClass('deactive');
  } else {
    $editFile.find('.head_btn .undo').addClass('deactive');
  }
  if (createEditer.hasRedo(editor)) {
    $editFile.find('.head_btn .redo').removeClass('deactive');
  } else {
    $editFile.find('.head_btn .redo').addClass('deactive');
  }
}
editor.getSession().on('change', saveState);
editor.getSession().on('change', debounce(switchUndoState, 1000));
$editFile.find('.editor').css({
  'font-size': percentToValue(12, 30, fileFontSize),
});
// 文件列表显示/隐藏
function hideContainer() {
  $container.css('visibility', 'hidden');
}
function showContainer() {
  $container.css('visibility', 'visible');
}
const editTitleContentScroll = new ContentScroll(
  $editFile.find('.head_btn .text .scroll_text')[0]
);
// 设置
function settingMenu(e) {
  const data = [
    { id: 'size', text: '字体大小', beforeIcon: 'iconfont icon-font-size' },
    {
      id: 'setEditor',
      text: '编辑器配置',
      beforeIcon: 'iconfont icon-liebiao',
    },
    { id: 'code', text: '语言', beforeIcon: 'iconfont icon-daimakuai' },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, id }) => {
      if (id === 'size') {
        percentBar(e, fileFontSize, (percent) => {
          $editFile.find('.editor').css({
            'font-size': percentToValue(12, 30, percent),
          });
          fileFontSize = percent;
          _setData('fileFontSize', fileFontSize);
        });
      } else if (id === 'setEditor') {
        setEditor(e, editor, () => {
          saveState();
        });
      } else if (id === 'code') {
        function fn() {
          let data = [];
          codeTypes.forEach((item) => {
            data.push({
              id: item,
              text: item,
              active: currentCodeType === item,
            });
          });
          return data;
        }
        rMenu.selectMenu(
          e,
          fn(),
          ({ resetMenu, id }) => {
            if (id) {
              currentCodeType = id;
              resetMenu(fn());
              setTextType(currentCodeType);
            }
          },
          '选择语言'
        );
      }
    },
    '设置'
  );
}
$editFile
  .find('.head_btn')
  .on('click', '.setting', settingMenu)
  .on('click', '.to_note', async () => {
    const text = editor.getValue();
    if (text === '') {
      _msg.error('文本为空');
      return;
    }
    await cacheFile.setData('newNote', text);
    _myOpen('/edit/#new', '新笔记');
  })
  .on('click', '.close', function (e) {
    if (readOnly) {
      hdClose();
      return;
    }
    if (editor.getValue() != oText) {
      _pop(
        {
          e,
          text: '文件未保存，确认关闭吗？',
        },
        (type) => {
          if (type === 'confirm') {
            hdClose();
          }
        }
      );
    } else {
      hdClose();
    }
  })
  .on('click', '.save', hdSave)
  .on('click', '.undo', () => {
    editor.undo();
  })
  .on('click', '.redo', () => {
    editor.redo();
  });
// 保存文件
async function hdSave() {
  if (readOnly) return;
  try {
    const text = editor.getValue();
    if (text === oText) return;
    if (getTextSize(text) > _d.fieldLenght.textFileSize) {
      _msg.error('文本内容过长');
      return;
    }
    const res = await reqFileSaveFile({ path: filePath, text });
    if (res.code === 1) {
      _msg.success(res.codeText);
      oText = text;
      saveState();
    }
  } catch {}
}

function hdClose() {
  showContainer();
  editTitleContentScroll.close();
  if (originText != oText) {
    bus.emit('refreshList');
  }
  toHide(
    $editFile[0],
    {
      to: 'bottom',
      scale: 'small',
    },
    () => {
      document.documentElement.classList.remove('notScroll');
      init();
    }
  );
}
if (!isIframe()) wave(11);
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  changeTheme(dark);
  darkMode(dark);
});
