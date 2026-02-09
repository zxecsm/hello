import $ from 'jquery';
import aceEditor from '../../js/utils/editor';
import {
  ContentScroll,
  _myOpen,
  debounce,
  getTextSize,
  isDarkMode,
  isLogin,
  percentToValue,
} from '../../js/utils/utils';
import _msg from '../../js/plugins/message';
import { reqFileGetHistoryState, reqFileHistoryState, reqFileSaveFile } from '../../api/file';
import bus from '../../js/utils/bus';
import rMenu from '../../js/plugins/rightMenu';
import _path from '../../js/utils/path';
import { setEditor } from '../edit/setEditor';
import _d from '../../js/common/config';
import cacheFile from '../../js/utils/cacheFile';
import localData from '../../js/common/localData';
const $editFile = $('.edit_file');
const $container = $('#app .container');
let oText = '';
let originText = '';
let readOnly = false;
const editor = aceEditor.createEditor($editFile.find('.editor')[0]);
let fileFontSize = localData.get('fileFontSize');
export function editFileIsHiden() {
  return $editFile.is(':hidden');
}
// 切换黑暗模式
function changeTheme(dark) {
  if (dark === 'y') {
    editor.setTheme('ace/theme/github_dark');
  } else if (dark === 'n') {
    editor.setTheme('ace/theme/github_light_default');
  } else if (dark === 's') {
    if (isDarkMode()) {
      editor.setTheme('ace/theme/github_dark');
    } else {
      editor.setTheme('ace/theme/github_light_default');
    }
  }
}
let filePath = '';
window.changeTheme = changeTheme;
changeTheme(localData.get('dark'));

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
  aceEditor.setMode(editor, path);
  originText = oText = text;
  editor.setValue(text);
  editor.gotoLine(1);
  aceEditor.reset(editor);
  switchUndoState();
  if (text === '') {
    editor.focus();
  }
}
// 生成标题
function renderTitle(path) {
  editTitleContentScroll.init(path);
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
  if (aceEditor.hasUndo(editor)) {
    $editFile.find('.head_btn .undo').removeClass('deactive');
  } else {
    $editFile.find('.head_btn .undo').addClass('deactive');
  }
  if (aceEditor.hasRedo(editor)) {
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
const editTitleContentScroll = new ContentScroll($editFile.find('.head_btn .text .scroll_text')[0]);
// 设置
async function settingMenu(e) {
  let fileHistoryState = 0;
  if (isLogin()) {
    try {
      const res = await reqFileGetHistoryState();
      if (res.code === 1) {
        fileHistoryState = res.data.file_history;
      }
    } catch {}
  }
  const data = [
    { id: 'size', text: '字体大小', beforeIcon: 'iconfont icon-font-size' },
    {
      id: 'setEditor',
      text: '编辑器配置',
      beforeIcon: 'iconfont icon-liebiao',
    },
    { id: 'code', text: '语言', beforeIcon: 'iconfont icon-daimakuai' },
  ];
  if (isLogin()) {
    data.push({
      id: 'history',
      text: '保存文件历史',
      beforeIcon: 'iconfont icon-history',
      afterIcon: 'iconfont ' + (fileHistoryState ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'),
      param: { value: fileHistoryState },
    });
  }
  rMenu.selectMenu(
    e,
    data,
    ({ e, id, loading, resetMenu, param }) => {
      const curItem = data.find((item) => item.id === id);
      if (id === 'size') {
        rMenu.percentBar(e, fileFontSize, (percent) => {
          $editFile.find('.editor').css({
            'font-size': percentToValue(12, 30, percent),
          });
          fileFontSize = percent;
          localData.set('fileFontSize', fileFontSize, 200);
        });
      } else if (id === 'setEditor') {
        setEditor(e, editor, () => {
          saveState();
        });
      } else if (id === 'code') {
        function fn() {
          const curMode = editor.session.getMode().$id;
          let data = [];
          aceEditor.modelist.modes.forEach(({ caption, mode }, idx) => {
            data.push({
              id: idx + '',
              text: caption,
              active: curMode === mode,
              param: { mode },
            });
          });
          return data;
        }
        rMenu.selectMenu(
          e,
          fn(),
          ({ resetMenu, id, param }) => {
            if (id) {
              editor.session.setMode(param.mode);
              resetMenu(fn());
            }
          },
          '选择语言',
        );
      } else if (id === 'history') {
        loading.start();
        reqFileHistoryState({ state: param.value ? 0 : 1 })
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
    _myOpen('/edit#new', '新笔记', 'edit');
  })
  .on('click', '.close', function (e) {
    if (readOnly) {
      hdClose();
      return;
    }
    if (editor.getValue() != oText) {
      rMenu.pop(
        {
          e,
          text: '文件未保存，确认关闭吗？',
        },
        (type) => {
          if (type === 'confirm') {
            hdClose();
          }
        },
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
    if (getTextSize(text) > _d.fieldLength.textFileSize) {
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
  $editFile.hide();
  document.documentElement.classList.remove('notScroll');
  init();
}
