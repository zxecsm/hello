import $ from 'jquery';
import _msg from '../../js/plugins/message/index.js';
import aceEditor from '../../js/utils/editor.js';
import pagination from '../../js/plugins/pagination/index.js';
import { UpProgress } from '../../js/plugins/UpProgress/index.js';
import {
  ContentScroll,
  _myOpen,
  _mySlide,
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
  mixedSort,
  percentToValue,
} from '../../js/utils/utils.js';
import _path from '../../js/utils/path.js';
import { isKeyDown } from '../../js/utils/boxSelector.js';
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
  $panel = $modal.find('.fm_panel'),
  $status = $modal.find('.fm_status'),
  $selectBar = $modal.find('.fm_select_bar'),
  $selectAll = $selectBar.find('.fm_select_all'),
  $deleteSelected = $selectBar.find('.fm_delete_selected'),
  $cancelSelect = $selectBar.find('.fm_cancel_select'),
  $checkBtn = $modal.find('.fm_tool.check'),
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
let selecting = false;
let fileFontSize = localData.get('fileFontSize') || 0.22;
let fileSort = localData.get('sshFileSort') || { type: 'time', isDes: true };

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

// 是否按目录处理：真实目录，或指向目录的符号链接
function isDirItem(item) {
  return item.type === 'dir' || (item.fileType === 'symlink' && item.linkTargetType === 'dir');
}

// 跟随主题切换编辑器
export function changeEditorTheme(flag) {
  if (!editor) return;

  const dark = flag === 'y' ? true : flag === 'n' ? false : isDark();
  editor.setTheme(dark ? 'ace/theme/github_dark' : 'ace/theme/github_light_default');
}

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
    changeEditorTheme(localData.get('dark'));
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
  closeCheck();

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
    <div v-for="item in list" class="fm_item" :data-name="item.name" :data-type="item.type">
      <div class="check_state" check="n" data-cursor="pointer"></div>
      <div class="fm_item_logo iconfont {{getLogo(item)}} {{item.name.startsWith('.') ? 'is_hidden' : ''}}" data-cursor="pointer"></div>
      <div class="fm_item_name" data-cursor="pointer">
        <span>{{getName(item).a}}</span><span class="fm_suffix">{{getName(item).b}}</span>
        <span v-if="item.fileType === 'symlink' && item.linkTarget" class="fm_link_target">=> {{item.linkTarget}}({{item.linkTargetTypeName}})</span>
      </div>
      <div class="fm_item_size">{{item.type === 'dir' || !item.size ? '--' : formatBytes(item.size)}}</div>
      <div class="fm_item_date">{{item.mtime ? getDateDiff(item.mtime) : '--'}}</div>
      <div class="fm_item_actions">
        <div v-if="!isDirItem(item)" class="fm_action iconfont icon-download" data-action="download" data-cursor="pointer"></div>
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
      isDirItem,
      getLogo(item) {
        if (item.type === 'dir') return 'icon-gl-folder is_dir';
        // 按大小选择图标（大小为 0 时是空文件图标）
        return fileLogoType(item.name, item.size || 0);
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

// 排序（与 File 页文件管理器一致）
function sortFiles() {
  const { type, isDes } = fileSort;

  allFiles.sort((a, b) => {
    if (type === 'name') {
      return isDes ? mixedSort(b.name, a.name) : mixedSort(a.name, b.name);
    }

    if (type === 'size') {
      return isDes ? (b.size || 0) - (a.size || 0) : (a.size || 0) - (b.size || 0);
    }

    // 时间排序；类别排序同样先按时间排，再按类型分组
    if (isDes || type === 'type') return (b.mtime || 0) - (a.mtime || 0);
    return (a.mtime || 0) - (b.mtime || 0);
  });

  if (type === 'type') {
    const files = allFiles.filter((item) => item.type === 'file');
    const dirs = allFiles.filter((item) => item.type === 'dir');
    allFiles = isDes ? [...files, ...dirs] : [...dirs, ...files];
  }
}

// 选择排序方式
function hdFileSort(e) {
  const { type, isDes } = fileSort;
  const data = [
    {
      id: '1',
      text: '名称排序',
      param: { value: 'name' },
    },
    {
      id: '2',
      text: '时间排序',
      param: { value: 'time' },
    },
    {
      id: '3',
      text: '大小排序',
      param: { value: 'size' },
    },
    {
      id: '4',
      text: '类别排序',
      param: { value: 'type' },
    },
    {
      id: '5',
      text: '升序',
      param: { value: false },
      beforeIcon: 'iconfont icon-jiantou_qiehuanxiangshang',
    },
    {
      id: '6',
      text: '降序',
      param: { value: true },
      beforeIcon: 'iconfont icon-jiantou_qiehuanxiangxia',
    },
  ];
  data.forEach((item) => {
    if (item.param.value === isDes || item.param.value === type) {
      item.active = true;
    } else {
      item.active = false;
    }
  });
  rMenu.selectMenu(
    e,
    data,
    ({ close, id, param }) => {
      if (id) {
        if (+id > 0 && +id <= 4) {
          fileSort.type = param.value;
        } else {
          fileSort.isDes = param.value;
        }
        close();
        localData.set('sshFileSort', fileSort);
        sortFiles();
        pageNo = 1;
        renderPage();
        $listWrap.scrollTop(0);
      }
    },
    '选择列表排序方式',
  );
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
      sortFiles();
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
    rMenu.pop({ e, text: '确认关闭：编辑器（内容未保存）？' }, (type) => {
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
        timestamp: item.mtime,
      })
    : '--';

  let type = item.type === 'dir' ? '文件夹' : '文件';
  if (item.fileType === 'symlink') type += '（符号链接）';
  else if (item.hardLink) type += '（硬链接）';

  // 路径显示条目自身完整路径，符号链接用箭头指向目标与类型
  const fullPath = normalizePath(curPath, item.name);
  const link =
    item.fileType === 'symlink' && item.linkTarget
      ? ` => ${item.linkTarget}(${item.linkTargetTypeName || '未知'})`
      : '';

  return `名称：${item.name}\n类型：${type}\n路径：${fullPath}${link}\n大小：${
    item.type === 'dir' || !item.size ? '--' : formatBytes(item.size)
  }\n更新时间：${time}`;
}

// 用 RMenu 显示基础属性
function showRemoteFileInfo(e, item) {
  showFileInfo(e, {
    ...item,
    path: curPath,
    fileType: item.fileType || 'file',
    fileTypeName: item.fileType === 'symlink' ? '符号链接' : '文件',
    time: item.mtime,
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
          close();
          _msg.success(res.codeText);
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
      text: `确认删除：${item.name}？`,
      confirm: { type: 'danger', text: '删除' },
    },
    async (type) => {
      if (type !== 'confirm') return;
      try {
        const res = await reqSSHSftpDelete({ paths: [path] });
        if (res.code === 1) {
          loadDir(curPath, { keepPage: true, silent: true });
        }
      } catch {}
    },
  );
}

// 是否处于多选模式
function isSelecting() {
  return selecting;
}

// 获取已选中的行
function getCheckItem() {
  return $list.find('.fm_item').filter((_, el) => $(el).find('.check_state').attr('check') === 'y');
}

// 获取已选中的数据
function getCheckDatas() {
  const arr = [];
  getCheckItem().each((_, el) => {
    const item = getItem(el.dataset.name);
    if (item) arr.push(item);
  });
  return arr;
}

// 更新底部多选栏
function renderSelectBar() {
  const len = getCheckDatas().length;
  const all = fileList.length > 0 && len === fileList.length;
  $selectAll
    .attr('data-check', all ? 'y' : 'n')
    .toggleClass('icon-xuanzeyixuanze', all)
    .toggleClass('icon-xuanzeweixuanze', !all);
  _msg.botMsg(`选中：${len}项`);
  $deleteSelected.toggle(len > 0);
}

// 开启多选
function startCheck() {
  selecting = true;
  $checkBtn.addClass('active');
  $panel.addClass('fm_selecting');
  $list
    .find('.check_state')
    .css({ display: 'block', 'background-color': 'transparent' })
    .attr('check', 'n');
  renderSelectBar();
  $selectBar.addClass('open');
}

// 关闭多选
function closeCheck() {
  if (!selecting) return;
  selecting = false;
  $checkBtn.removeClass('active');
  $panel.removeClass('fm_selecting');
  $list
    .find('.check_state')
    .css({ display: 'none', 'background-color': 'transparent' })
    .attr('check', 'n');
  $selectBar.removeClass('open');
}

// 选中/取消选中一项
function hdCheckItem(el, updateSelect = true) {
  const $el = $(el);
  if ($el.attr('check') === 'y') {
    $el.css('background-color', 'transparent').attr('check', 'n');
  } else {
    $el.css('background-color', _d.checkColor).attr('check', 'y');
  }
  if (updateSelect) renderSelectBar();
}

// Shift 连续选中
function shiftCheck(el) {
  const list = [...$list[0].querySelectorAll('.fm_item .check_state')];
  const sidx = list.findIndex((item) => item === el);
  const cidx = list.findIndex((item) => item.getAttribute('check') === 'y');
  if (sidx === cidx) hdCheckItem(el);
  list.forEach((item, idx) => {
    if (
      ((cidx > sidx && idx >= sidx && idx <= cidx) ||
        (cidx < sidx && idx >= cidx && idx <= sidx)) &&
      item.getAttribute('check') === 'n'
    ) {
      hdCheckItem(item, false);
    }
  });
  renderSelectBar();
}

// 全选/取消全选当前页
function switchCheckAll() {
  const $items = $list.find('.fm_item');
  if ($selectAll.attr('data-check') === 'y') {
    $items.find('.check_state').css('background-color', 'transparent').attr('check', 'n');
  } else {
    $items.find('.check_state').css('background-color', _d.checkColor).attr('check', 'y');
  }
  renderSelectBar();
}

// 批量删除
function deleteSelected(e) {
  const items = getCheckDatas();
  if (items.length === 0) return;

  let text = `确认删除：选中的 ${items.length} 项？`;
  if (items.length === 1) {
    text = `确认删除：${items[0].name}？`;
  }

  rMenu.pop(
    {
      e,
      text,
      confirm: { type: 'danger', text: '删除' },
    },
    async (type) => {
      if (type !== 'confirm') return;

      const paths = items.map((item) => normalizePath(curPath, item.name));

      try {
        await reqSSHSftpDelete({ paths });
      } catch {}

      closeCheck();
      loadDir(curPath, { keepPage: true, silent: true });
    },
  );
}

// 上传文件
async function uploadFiles(files) {
  if (!files) {
    try {
      files = await getFiles({ multiple: true });
    } catch {
      return;
    }
  }

  files = [...files];
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
    rMenu.pop({ e, text: '确认关闭：文件管理（内容未保存）？' }, (type) => {
      if (type !== 'confirm') return;
      hideEditor();
      pathScroll.close();
      closeCheck();
      $modal.removeClass('open');
      $app.removeClass('fm_open');
    });
    return;
  }

  hideEditor();
  pathScroll.close();
  closeCheck();
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

// 手势右划返回上级目录（与 File 页文件管理器一致）
_mySlide({
  el: $listWrap[0],
  right() {
    if (curPath === '/') return;
    loadDir(_path.dirname(curPath));
  },
});

$crumb.on('click', '.fm_crumb_item', function () {
  const path = this.dataset.path;
  if (!path) return;
  loadDir(path);
});

$status.find('.path').on('click', () => {
  copyText(curPath);
});

$checkBtn.on('click', () => {
  if (isSelecting()) {
    closeCheck();
  } else {
    startCheck();
  }
});
$selectAll.on('click', () => switchCheckAll());
$deleteSelected.on('click', function (e) {
  deleteSelected(e);
});
$cancelSelect.on('click', () => closeCheck());

$modal.find('.fm_tool.upload').on('click', () => uploadFiles());
$modal.find('.fm_tool.add').on('click', function (e) {
  createMenu(e);
});
$modal.find('.fm_tool.sort').on('click', function (e) {
  hdFileSort(e);
});
$modal.find('.fm_tool.refresh').on('click', () => loadDir(curPath, { keepPage: true }));
$modal.find('.fm_close').on('click', closeManager);

// 拖拽文件上传
$listWrap[0].addEventListener('dragenter', (e) => {
  e.preventDefault();
});
$listWrap[0].addEventListener('dragover', (e) => {
  e.preventDefault();
});
$listWrap[0].addEventListener('drop', (e) => {
  e.preventDefault();
  const files = [...(e.dataTransfer?.files || [])];
  if (files.length === 0) return;
  uploadFiles(files);
});

function isBlankTarget(target) {
  return !$(target).closest(
    '.fm_item, .fm_editor, .fm_tool, .fm_close, .fm_back, .fm_crumb_item, .fm_pagination, .fm_select_bar, button',
  ).length;
}

// 空白区域右键新建
$panel.on('contextmenu', function (e) {
  e.preventDefault();
  if (isSelecting()) return;
  if (!isBlankTarget(e.target)) return;
  showCreateMenu(e);
});

// 空白区域长按新建
longPress($panel[0], function (e) {
  if (isSelecting()) return;
  if (!isBlankTarget(e.target)) return;

  const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!touch) return;

  showCreateMenu({ clientX: touch.clientX, clientY: touch.clientY });
});

$list.on('click', '.fm_item', function (e) {
  if (isSelecting()) return;

  // 只有点击图标或名称才打开，避免点大小、日期时点到行内空白处误触
  if (!$(e.target).closest('.fm_item_logo, .fm_item_name').length) return;

  const item = getItem(this.dataset.name);
  if (!item) return;

  if (isDirItem(item)) {
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

$list.on('click', '.check_state', function (e) {
  e.stopPropagation();
  if ((isKeyDown('control') || isKeyDown('shift')) && getCheckDatas().length > 0) {
    shiftCheck(this);
  } else {
    hdCheckItem(this);
  }
});

$list.on('click', '.fm_action', function (e) {
  e.stopPropagation();
  if (isSelecting()) return;

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

// 多选快捷键
$(document).on('keydown', (e) => {
  if (!$modal.hasClass('open')) return;
  if ($editorBox.hasClass('open')) return;
  const key = e.key.toLowerCase();
  const ctrl = e.ctrlKey || e.metaKey;
  const isFocus = $('input').is(':focus') || $('textarea').is(':focus');
  if (isFocus) return;

  if (ctrl && key === 'a') {
    e.preventDefault();
    if (!isSelecting()) startCheck();
    switchCheckAll();
  } else if (key === 'escape' && isSelecting()) {
    closeCheck();
  } else if (key === 'delete' && isSelecting()) {
    deleteSelected(null);
  }
});
