import $ from 'jquery';
import _msg from '../../js/plugins/message/index.js';
import aceEditor from '../../js/utils/editor.js';
import pagination from '../../js/plugins/pagination/index.js';
import { UpProgress } from '../../js/plugins/UpProgress/index.js';
import {
  ContentScroll,
  _myOpen,
  concurrencyTasks,
  copyText,
  debounce,
  downloadFiles,
  fileLogoType,
  formatBytes,
  formatDate,
  getDateDiff,
  getFiles,
  getTextSize,
  isDark,
  longPress,
  percentToValue,
} from '../../js/utils/utils.js';
import _path from '../../js/utils/path.js';
import _d from '../../js/common/config.js';
import localData from '../../js/common/localData.js';
import cacheFile from '../../js/utils/cacheFile.js';
import { _tpl } from '../../js/utils/template.js';
import rMenu from '../../js/plugins/rightMenu/index.js';
import toolTip from '../../js/plugins/tooltip/index.js';
import { showFileInfo } from '../../js/utils/showinfo.js';
import { setEditor } from '../edit/setEditor.js';
import {
  reqSSHSftpCreate,
  reqSSHSftpDelete,
  reqSSHSftpList,
  reqSSHSftpMkdir,
  reqSSHSftpRead,
  reqSSHSftpRename,
  reqSSHSftpUp,
  reqSSHSftpWrite,
} from '../../api/ssh.js';

const $app = $('#app');
const $modal = $('.fm_modal'),
  $back = $modal.find('.fm_back'),
  $crumb = $modal.find('.fm_crumb'),
  $list = $modal.find('.fm_list'),
  $listWrap = $modal.find('.fm_list_wrap'),
  $status = $modal.find('.fm_status'),
  $editorBox = $modal.find('.fm_editor'),
  $editorPath = $editorBox.find('.fm_editor_path'),
  $editorPathText = $editorBox.find('.fm_editor_path .scroll_text'),
  $editorBody = $editorBox.find('.fm_editor_body'),
  $save = $editorBox.find('.fm_save'),
  $undo = $editorBox.find('.fm_undo'),
  $redo = $editorBox.find('.fm_redo');

let pageSize = 40;

let curPath = '/';
let allFiles = [];
let fileList = [];
let pageNo = 1;
let loading = false;
let loadSeq = 0;
let editor = null;
let editingPath = '';
let editingOrigin = '';
let saving = false;
let fileFontSize = localData.get('fileFontSize');

const pathScroll = new ContentScroll($status.find('.path .scroll_text')[0]);
const editorPathScroll = new ContentScroll($editorPathText[0]);

// 有改动时才显示保存按钮
const saveState = debounce(function () {
  if (!editor) return;
  $save.css('display', editor.getValue() !== editingOrigin ? 'block' : 'none');
}, 500);
const pgnt = pagination($list[0], {
  pageSize,
  select: [20, 40, 60, 80, 100, 200],
  change(val) {
    pageNo = val;
    renderPage();
    $listWrap.scrollTop(0);
  },
  changeSize(val) {
    pageSize = val;
    pageNo = 1;
    renderPage();
    $listWrap.scrollTop(0);
  },
  toTop() {
    $listWrap.scrollTop(0);
  },
});

function normalizePath(...paths) {
  return _path.normalizeNoSlash('/', ...paths);
}

function getItem(name) {
  return allFiles.find((item) => item.name === name) || null;
}

function getName(item) {
  if (item.type === 'dir') return { a: item.name, b: '' };
  const [a, , b] = _path.extname(item.name);
  return { a, b: b ? '.' + b : '' };
}

// 跟随主题切换编辑器
function changeEditorTheme(flag) {
  if (!editor) return;

  const dark = flag === 'y' ? true : flag === 'n' ? false : isDark();
  editor.setTheme(dark ? 'ace/theme/github_dark' : 'ace/theme/github_light_default');
}
window.changeTheme = changeEditorTheme;

// 应用编辑器字体大小
function applyEditorFontSize() {
  $editorBody.css('font-size', percentToValue(12, 30, fileFontSize) + 'px');
  editor && editor.resize();
}

// 更新撤回/前进状态
function updateUndoRedoState() {
  if (!editor) return;
  $undo.toggleClass('deactive', !aceEditor.hasUndo(editor));
  $redo.toggleClass('deactive', !aceEditor.hasRedo(editor));
}

function getEditor() {
  if (!editor) {
    editor = aceEditor.createEditor($editorBody[0]);
    changeEditorTheme();
    applyEditorFontSize();
    editor.getSession().on('change', () => {
      updateUndoRedoState();
      saveState();
    });
    editor.commands.addCommand({
      name: 'saveSftpFile',
      bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
      exec() {
        saveFile();
      },
    });
  }
  return editor;
}

// 渲染路径面包屑
function renderCrumb() {
  const parts = [];
  const names = curPath === '/' ? [] : curPath.split('/').filter(Boolean);

  if (names.length > 0) {
    let acc = '';
    names.forEach((name, idx) => {
      acc += '/' + name;
      parts.push({ name, path: acc, current: idx === names.length - 1 });
    });
  }

  const html = _tpl(
    `
    <span v-if="isRoot" class="fm_crumb_item current">根目录</span>
    <span v-else class="fm_crumb_item" data-path="/" data-cursor="pointer">根目录</span>
    <span v-for="item in parts" class="fm_crumb_part">
      <span class="fm_crumb_sep">/</span>
      <span v-if="item.current" class="fm_crumb_item current">{{item.name}}</span>
      <span v-else class="fm_crumb_item" :data-path="item.path" data-cursor="pointer">{{item.name}}</span>
    </span>
    `,
    { parts, isRoot: curPath === '/' },
  );

  $crumb.empty()[0].appendChild(html);
  $crumb.scrollLeft($crumb[0].scrollWidth);
}

// 渲染状态栏
function renderStatus() {
  $status.find('.count').text(`共 ${allFiles.length} 项`);
  $back.toggleClass('disabled', curPath === '/');
}

// 渲染当前页
function renderPage() {
  const total = allFiles.length;
  const totalPage = Math.max(1, Math.ceil(total / pageSize));

  pageNo > totalPage ? (pageNo = totalPage) : null;
  pageNo < 1 ? (pageNo = 1) : null;

  fileList = allFiles.slice((pageNo - 1) * pageSize, pageNo * pageSize);

  renderList();
  renderStatus();
}

// 渲染文件列表
function renderList() {
  if (loading) {
    $list[0].replaceChildren(_tpl('<div class="fm_tip">{{text}}</div>', { text: '加载中...' }));
    return;
  }

  if (fileList.length === 0) {
    $list[0].replaceChildren(_tpl('<div class="fm_tip">{{text}}</div>', { text: _d.emptyList }));
    return;
  }

  const html = _tpl(
    `
    <div v-for="item in list" class="fm_item" :data-name="item.name" :data-type="item.type" data-cursor="pointer">
      <div class="fm_item_logo iconfont {{getLogo(item)}}"></div>
      <div class="fm_item_name">
        <span>{{getName(item).a}}</span><span class="fm_suffix">{{getName(item).b}}</span>
      </div>
      <div class="fm_item_size">{{item.type === 'dir' ? '--' : formatBytes(item.size || 0)}}</div>
      <div class="fm_item_date">{{item.mtime ? getDateDiff(item.mtime * 1000) : '--'}}</div>
      <div class="fm_item_actions">
        <div v-if="item.type === 'file'" class="fm_action iconfont icon-download" data-action="download" data-cursor="pointer"></div>
        <div v-else class="fm_action fm_action_placeholder"></div>
        <div class="fm_action iconfont icon-gl-rename" data-action="rename" data-cursor="pointer"></div>
        <div class="fm_action iconfont icon-shanchu danger" data-action="delete" data-cursor="pointer"></div>
      </div>
    </div>
    <div class="fm_pagination" v-html="getPaging()"></div>
    `,
    {
      list: fileList,
      _d,
      getLogo(item) {
        return item.type === 'dir'
          ? 'icon-gl-folder is_dir'
          : fileLogoType(item.name, item.size || 0);
      },
      getName,
      formatBytes,
      getDateDiff,
      getPaging() {
        return pgnt.getHTML({
          pageNo,
          pageSize,
          total: allFiles.length,
          small: window.innerWidth <= 800,
        });
      },
    },
  );

  $list[0].replaceChildren(html);
}

// 加载目录
async function loadDir(path = curPath, { keepPage = false, silent = false } = {}) {
  const seq = ++loadSeq;
  if (!silent) {
    loading = true;
    renderStatus();
    renderList();
  }

  try {
    const res = await reqSSHSftpList({ path });
    if (seq !== loadSeq) return;
    if (res.code === 1) {
      curPath = normalizePath(path);
      allFiles = (res.data || []).filter((item) => item.name !== '.' && item.name !== '..');
      allFiles.sort((a, b) => {
        const diff = (b.mtime || 0) - (a.mtime || 0);
        if (diff) return diff;
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name, 'zh-CN');
      });
      if (!keepPage) pageNo = 1;
    }
  } catch {
  } finally {
    if (seq === loadSeq) {
      loading = false;
      renderCrumb();
      pathScroll.init(curPath);
      renderPage();
    }
  }
}

// 打开文本编辑器
function openEditor(path, text) {
  editingPath = path;
  editingOrigin = text;
  editorPathScroll.init(path);
  $editorPath.attr('title', path);
  $editorBox.addClass('open');

  const ed = getEditor();
  aceEditor.setMode(ed, path);
  // 尽量保持原文件的换行风格
  ed.session.setNewLineMode(text.includes('\r\n') ? 'windows' : 'unix');
  ed.setValue(text);
  aceEditor.reset(ed);
  ed.clearSelection();
  updateUndoRedoState();
  $save.css('display', 'none');

  setTimeout(() => {
    ed.resize();
    ed.focus();
  }, 0);
}

// 关闭编辑器
function hideEditor() {
  $editorBox.removeClass('open');
  editorPathScroll.close();
  $save.css('display', 'none');
  $undo.addClass('deactive');
  $redo.addClass('deactive');
  editingPath = '';
  editingOrigin = '';
}

function closeEditor(e) {
  if ($editorBox.hasClass('open') && editor && editor.getValue() !== editingOrigin) {
    rMenu.pop({ e, text: '内容尚未保存，确定关闭编辑器？' }, (type) => {
      if (type === 'confirm') hideEditor();
    });
    return;
  }
  hideEditor();
}

// 打开远端文本文件；不是文本文件或超出大小限制时直接下载
async function openTextFile(item) {
  const path = normalizePath(curPath, item.name);
  try {
    const res = await reqSSHSftpRead({ path });
    if (res.code === 1) {
      const { type, data } = res.data;
      if (type === 'text') {
        openEditor(path, data);
      } else {
        downloadFile(item);
      }
    }
  } catch {}
}

// 保存远端文本文件
async function saveFile() {
  if (!editingPath || saving) return;

  const content = editor.getValue();
  if (content === editingOrigin) return;

  if (getTextSize(content) > _d.fieldLength.sftpEditSize) {
    _msg.error(`文本内容不能超过 ${formatBytes(_d.fieldLength.sftpEditSize)}`);
    return;
  }

  saving = true;
  try {
    const res = await reqSSHSftpWrite({ path: editingPath, content });
    if (res.code === 1) {
      editingOrigin = content;
      $save.css('display', 'none');
      _msg.success('保存成功');
      loadDir(curPath, { keepPage: true, silent: true });
    }
  } catch {
  } finally {
    saving = false;
  }
}

// 保存到笔记
async function saveToNote() {
  const text = editor.getValue();
  if (text === '') {
    _msg.error('文本为空');
    return;
  }
  await cacheFile.setData('newNote', text);
  _myOpen('/edit?v=new', '新笔记', 'edit');
}

// 编辑器设置
function settingMenu(e) {
  const data = [
    { id: 'size', text: '字体大小', beforeIcon: 'iconfont icon-font-size' },
    { id: 'setEditor', text: '编辑器配置', beforeIcon: 'iconfont icon-liebiao' },
  ];

  rMenu.selectMenu(
    e,
    data,
    ({ e, id }) => {
      if (id === 'size') {
        rMenu.percentBar(e, fileFontSize, (percent) => {
          fileFontSize = percent;
          applyEditorFontSize();
          localData.set('fileFontSize', fileFontSize, 200);
        });
      } else if (id === 'setEditor') {
        setEditor(e, editor, () => {
          applyEditorFontSize();
        });
      }
    },
    '设置',
  );
}

// 下载远端路径
function downloadRemotePath(path) {
  downloadFiles([
    {
      fileUrl: `${_d.apiPath}/ssh/sftp-down?path=${encodeURIComponent(path)}&id=${_d.temid}`,
      filename: _path.basename(path)[0],
    },
  ]);
}

// 下载远端文件
function downloadFile(item) {
  downloadRemotePath(normalizePath(curPath, item.name));
}

// 基础属性文本
function getItemInfoText(item) {
  const time = item.mtime
    ? formatDate({
        template: '{0}-{1}-{2} {3}:{4}',
        timestamp: item.mtime * 1000,
      })
    : '--';

  return `名称：${item.name}\n类型：${item.type === 'dir' ? '文件夹' : '文件'}\n路径：${curPath}\n大小：${
    item.type === 'dir' ? '--' : formatBytes(item.size || 0)
  }\n更新时间：${time}`;
}

// 用 RMenu 显示基础属性
function showRemoteFileInfo(e, item) {
  showFileInfo(e, {
    ...item,
    path: curPath,
    fileType: 'file',
    time: item.mtime * 1000,
  });
}

// 新建菜单
function createMenu(e) {
  rMenu.selectMenu(
    e,
    [
      { id: 'file', text: '新建文本', beforeIcon: 'iconfont icon-gl-fileEmpty' },
      { id: 'dir', text: '新建文件夹', beforeIcon: 'iconfont icon-folderPlus' },
    ],
    ({ e, id }) => {
      if (id === 'file') {
        createFile(e);
      } else if (id === 'dir') {
        createDir(e);
      }
    },
    '新建',
  );
}

// 空白区域新建菜单
function showCreateMenu(e) {
  rMenu.selectMenu(
    e,
    [
      { id: 'file', text: '新建文件', beforeIcon: 'iconfont icon-gl-fileEmpty' },
      { id: 'dir', text: '新建文件夹', beforeIcon: 'iconfont icon-folderPlus' },
    ],
    ({ e, id }) => {
      if (id === 'file') {
        createFile(e);
      } else if (id === 'dir') {
        createDir(e);
      }
    },
    '新建',
  );
}

// 新建目录
function createDir(e) {
  const path = curPath;
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        name: {
          beforeText: '文件夹名：',
          verify(val) {
            return rMenu.validString(val, 1, _d.fieldLength.filename) || rMenu.validFilename(val);
          },
        },
      },
    },
    async ({ close, inp, loading }) => {
      try {
        loading.start();
        const res = await reqSSHSftpMkdir({ path, name: inp.name });
        loading.end();
        if (res.code === 1) {
          _msg.success(res.codeText);
          close(1);
          loadDir(path, { keepPage: true });
        }
      } catch {
        loading.end();
      }
    },
    '新建文件夹',
  );
}

// 新建文本文件
function createFile(e) {
  const path = curPath;
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        name: {
          beforeText: '文件名：',
          verify(val) {
            return rMenu.validString(val, 1, _d.fieldLength.filename) || rMenu.validFilename(val);
          },
        },
      },
    },
    async ({ close, inp, loading }) => {
      try {
        const name = inp.name;
        loading.start();
        const res = await reqSSHSftpCreate({ path, name });
        loading.end();
        if (res.code === 1) {
          _msg.success(res.codeText);
          close(1);
          await loadDir(path, { keepPage: true });
          if (curPath === path) openTextFile({ name });
        }
      } catch {
        loading.end();
      }
    },
    '新建文本',
  );
}

// 重命名
function renameItem(e, item) {
  const path = normalizePath(curPath, item.name);
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        name: {
          beforeText: `${item.type === 'file' ? '文件' : '文件夹'}名：`,
          value: item.name,
          verify(val) {
            return rMenu.validString(val, 1, _d.fieldLength.filename) || rMenu.validFilename(val);
          },
        },
      },
    },
    async ({ close, inp, loading, isDiff }) => {
      try {
        if (!isDiff()) return;
        loading.start();
        const res = await reqSSHSftpRename({ path, name: inp.name });
        loading.end();
        if (res.code === 1) {
          _msg.success(res.codeText);
          close();
          loadDir(curPath, { keepPage: true, silent: true });
        }
      } catch {
        loading.end();
      }
    },
    `重命名${item.type === 'file' ? '文件' : '文件夹'}`,
  );
}

// 删除
function deleteItem(e, item) {
  const path = normalizePath(curPath, item.name);

  rMenu.pop(
    {
      e,
      text:
        item.type === 'dir'
          ? `确定删除目录「${item.name}」及其全部内容？`
          : `确定删除文件「${item.name}」？`,
      confirm: { type: 'danger', text: '删除' },
    },
    async (type) => {
      if (type !== 'confirm') return;
      try {
        const res = await reqSSHSftpDelete({ path });
        if (res.code === 1) {
          _msg.success(res.codeText);
          loadDir(curPath, { keepPage: true, silent: true });
        }
      } catch {}
    },
  );
}

// 上传文件
async function uploadFiles() {
  let files = [];
  try {
    files = await getFiles({ multiple: true });
  } catch {
    return;
  }
  if (files.length === 0) return;

  const controller = new AbortController();
  const upPro = new UpProgress(() => controller.abort(), files.length);
  const targetPath = curPath;

  await concurrencyTasks(files, 3, async (file) => {
    if (controller.signal.aborted) return;

    const { name } = file;
    const pro = upPro.add(name);

    try {
      const res = await reqSSHSftpUp(
        { path: targetPath, name },
        file,
        (percent) => pro.update(percent),
        controller.signal,
      );
      if (res.code === 1) {
        pro.close();
      } else {
        pro.fail();
        _msg.error(`上传失败：${name}`, null, { reside: true });
      }
    } catch {
      pro.fail();
      _msg.error(`上传失败：${name}`, null, { reside: true });
    }
  });

  if (curPath === targetPath) loadDir(curPath, { keepPage: true });
}

function closeManager(e) {
  if ($editorBox.hasClass('open') && editor && editor.getValue() !== editingOrigin) {
    rMenu.pop({ e, text: '内容尚未保存，确定关闭文件管理？' }, (type) => {
      if (type !== 'confirm') return;
      hideEditor();
      pathScroll.close();
      $modal.removeClass('open');
      $app.removeClass('fm_open');
    });
    return;
  }

  hideEditor();
  pathScroll.close();
  $modal.removeClass('open');
  $app.removeClass('fm_open');
}

// 打开文件管理
export function openSftpFileManager() {
  if ($modal.hasClass('open')) {
    closeManager();
    return;
  }
  $modal.addClass('open');
  $app.addClass('fm_open');
  loadDir(curPath, { keepPage: true });
}

// 事件绑定
$back.on('click', () => {
  if (curPath === '/') return;
  loadDir(_path.dirname(curPath));
});

$crumb.on('click', '.fm_crumb_item', function () {
  const path = this.dataset.path;
  if (!path) return;
  loadDir(path);
});

$status.find('.path').on('click', () => {
  copyText(curPath);
});

$modal.find('.fm_tool.upload').on('click', uploadFiles);
$modal.find('.fm_tool.add').on('click', function (e) {
  createMenu(e);
});
$modal.find('.fm_tool.refresh').on('click', () => loadDir(curPath, { keepPage: true }));
$modal.find('.fm_close, .fm_mask').on('click', closeManager);

const $panel = $modal.find('.fm_panel');

function isBlankTarget(target) {
  return !$(target).closest(
    '.fm_item, .fm_editor, .fm_tool, .fm_close, .fm_back, .fm_crumb_item, .fm_pagination, button',
  ).length;
}

// 空白区域右键新建
$panel.on('contextmenu', function (e) {
  e.preventDefault();
  if (!isBlankTarget(e.target)) return;
  showCreateMenu(e);
});

// 空白区域长按新建
longPress($panel[0], function (e) {
  if (!isBlankTarget(e.target)) return;

  const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!touch) return;

  showCreateMenu({ clientX: touch.clientX, clientY: touch.clientY });
});

$list.on('click', '.fm_item', function (e) {
  if ($(e.target).closest('.fm_action, .fm_item_size, .fm_item_date').length) return;

  const item = getItem(this.dataset.name);
  if (!item) return;

  if (item.type === 'dir') {
    loadDir(normalizePath(curPath, item.name));
  } else {
    openTextFile(item);
  }
});

$list.on('click', '.fm_item_size, .fm_item_date', function (e) {
  e.stopPropagation();

  const item = getItem($(this).closest('.fm_item').attr('data-name'));
  if (item) showRemoteFileInfo(e, item);
});

$list
  .on('mouseenter', '.fm_item_name', function () {
    const item = getItem($(this).closest('.fm_item').attr('data-name'));
    if (item) toolTip.setTip(getItemInfoText(item)).show();
  })
  .on('mouseleave', '.fm_item_name', () => {
    toolTip.hide();
  });

$list.on('click', '.fm_action', function (e) {
  e.stopPropagation();

  const item = getItem($(this).closest('.fm_item').attr('data-name'));
  if (!item) return;

  const action = $(this).attr('data-action');

  if (action === 'download') {
    downloadFile(item);
  } else if (action === 'rename') {
    renameItem(e, item);
  } else if (action === 'delete') {
    deleteItem(e, item);
  }
});

$editorBox.find('.fm_save').on('click', saveFile);
$editorBox.find('.fm_editor_close').on('click', closeEditor);
$editorBox.find('.fm_undo').on('click', () => {
  editor && editor.undo();
  updateUndoRedoState();
});
$editorBox.find('.fm_redo').on('click', () => {
  editor && editor.redo();
  updateUndoRedoState();
});
$editorBox.find('.fm_to_note').on('click', saveToNote);
$editorBox.find('.fm_setting').on('click', settingMenu);
$editorPath.on('click', () => {
  if (editingPath) copyText(editingPath);
});

// Ctrl+S 保存
$(document).on('keydown', (e) => {
  if (!$editorBox.hasClass('open')) return;
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
  e.preventDefault();
  saveFile();
});
