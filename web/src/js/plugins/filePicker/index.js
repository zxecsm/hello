import './index.less';
import _d from '../../common/config';
import _path from '../../utils/path';
import { _tpl } from '../../utils/template';
import { ContentScroll, fileLogoType, formatBytes, getDateDiff } from '../../utils/utils';
import { reqFileReadDirAll } from '../../../api/file';
import rMenu from '../rightMenu';

const PAGE_SIZE = 200;

const TITLE_MAP = {
  file: '选择文件',
  dir: '选择目录',
  all: '选择文件或目录',
};

function normalizePath(...paths) {
  return _path.normalizeNoSlash('/', ...paths);
}

function isDir(item) {
  return (
    item.type === 'dir' ||
    (item.type === 'file' && item.fileType === 'symlink' && item.linkTargetType === 'dir')
  );
}

function getNameParts(item) {
  if (isDir(item)) return { name: item.name, suffix: '' };
  const [name, , ext] = _path.extname(item.name);
  return { name, suffix: ext ? '.' + ext : '' };
}

// 文件/目录选择器
// type: file 只选文件，dir 只选目录，all 文件和目录都可以
export default function filePicker(opt = {}) {
  const type = ['file', 'dir', 'all'].includes(opt.type) ? opt.type : 'all';
  const allowDir = type !== 'file';
  const allowFile = type !== 'dir';
  const title = opt.title || TITLE_MAP[type];
  const callback = typeof opt.callback === 'function' ? opt.callback : null;

  let destroyed = false;
  let loadSeq = 0;
  let curPath = normalizePath(opt.path || '/');
  let allFiles = [];
  let list = [];
  let total = 0;
  let pageNo = 0;
  let loading = false;
  let selected = null;
  let navigated = false;
  let confirmOpen = false;
  let resolveFn = null;

  const promise = new Promise((resolve) => {
    resolveFn = resolve;
  });

  const el = document.createElement('div');
  el.className = 'hello_file_picker';
  el.style.zIndex = _d.levelObj.rightBox;
  el.innerHTML = `
    <div class="fp_mask"></div>
    <div class="fp_panel">
      <div class="fp_head">
        <div class="fp_close iconfont icon-close-bold" data-cursor="pointer"></div>
        <div class="fp_refresh iconfont icon-suijibofang" data-cursor="pointer"></div>
        <div class="fp_title"></div>
      </div>
      <div class="fp_path">
        <div class="fp_back iconfont icon-shang" data-cursor="pointer"></div>
        <div class="fp_crumb"></div>
      </div>
      <div class="fp_list_wrap">
        <div class="fp_list"></div>
        <button class="fp_more btn btn_info" type="button" data-cursor="pointer" style="display: none">加载更多</button>
      </div>
      <div class="fp_footer">
        <div class="fp_selected"><span class="scroll_text"></span></div>
        <div class="fp_actions"></div>
      </div>
    </div>
  `;

  const $title = el.querySelector('.fp_title');
  const $back = el.querySelector('.fp_back');
  const $crumb = el.querySelector('.fp_crumb');
  const $list = el.querySelector('.fp_list');
  const $more = el.querySelector('.fp_more');
  const $selected = el.querySelector('.fp_selected');
  const $selectedText = $selected.querySelector('.scroll_text');
  const $actions = el.querySelector('.fp_actions');
  const selectedScroll = new ContentScroll($selectedText);

  $title.textContent = title;

  if (type === 'file') {
    $actions.innerHTML = `<button class="btn btn_primary fp_confirm_file" type="button" data-cursor="pointer" disabled>选择文件</button>`;
  } else if (type === 'dir') {
    $actions.innerHTML = `<button class="btn btn_primary fp_choose_cur" type="button" data-cursor="pointer">选择当前目录</button>`;
  } else {
    $actions.innerHTML = `
      <button class="btn btn_info fp_choose_cur" type="button" data-cursor="pointer">选择当前目录</button>
      <button class="btn btn_primary fp_confirm_file" type="button" data-cursor="pointer" disabled>选择文件</button>
    `;
  }

  document.documentElement.classList.add('notScroll');
  document.addEventListener('keydown', onKeydown, true);
  document.body.appendChild(el);

  function getFullPath(item) {
    return normalizePath(curPath, item.name);
  }

  // 按时间倒序，最新在前，和 SSH 文件管理器保持一致
  function sortAll() {
    allFiles.sort((a, b) => {
      const diff = (b.time || 0) - (a.time || 0);
      if (diff) return diff;
      if (isDir(a) !== isDir(b)) return isDir(a) ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
  }

  function renderCrumb() {
    const parts = [];
    if (curPath !== '/') {
      let acc = '';
      const names = curPath.split('/').filter(Boolean);
      names.forEach((name, idx) => {
        acc += '/' + name;
        parts.push({ name, path: acc, current: idx === names.length - 1 });
      });
    }

    const html = _tpl(
      `
      <span v-if="isRoot" class="fp_crumb_item current">根目录</span>
      <span v-else class="fp_crumb_item" data-path="/" data-cursor="pointer">根目录</span>
      <span v-for="item in parts" class="fp_crumb_part">
        <span class="fp_crumb_sep">/</span>
        <span class="fp_crumb_item {{item.current ? 'current' : ''}}" :data-path="item.path" data-cursor="pointer">{{item.name}}</span>
      </span>
      `,
      { isRoot: curPath === '/', parts },
    );

    $crumb.replaceChildren(html);
    $crumb.scrollLeft = $crumb.scrollWidth;
    $back.classList.toggle('disabled', curPath === '/');
  }

  function updateFooter() {
    const fileBtn = $actions.querySelector('.fp_confirm_file');
    if (fileBtn) fileBtn.disabled = !selected;

    const text = selected ? `已选择：${selected.path}` : `当前目录：${curPath}`;
    $selected.title = text;
    selectedScroll.init(text);
  }

  function renderList() {
    if (loading) {
      $more.style.display = 'none';
      $list.replaceChildren(_tpl('<div class="fp_tip">{{text}}</div>', { text: '读取中...' }));
      return;
    }

    if (!list.length) {
      $more.style.display = 'none';
      $list.replaceChildren(_tpl('<div class="fp_tip">{{text}}</div>', { text: _d.emptyList }));
      return;
    }

    const html = _tpl(
      `
      <div
        v-for="item in list"
        class="fp_item {{selectedPath === getFullPath(item) ? 'active' : ''}}"
        :data-name="item.name"
        data-cursor="pointer"
      >
        <div class="fp_item_logo iconfont {{getLogo(item)}}"></div>
        <div class="fp_item_name">
          <span>{{getNameParts(item).name}}</span><span class="fp_suffix">{{getNameParts(item).suffix}}</span>
          <span v-if="isDir(item) && item.fileType === 'symlink' && item.linkTarget" class="fp_link">=> {{item.linkTarget}}</span>
        </div>
        <div class="fp_item_size">{{isDir(item) ? '--' : formatBytes(item.size || 0)}}</div>
        <div class="fp_item_date">{{item.time ? getDateDiff(item.time) : '--'}}</div>
        <div class="fp_item_actions">
          <button v-if="allowDir && isDir(item)" type="button" class="fp_choose_dir" data-cursor="pointer">选择这个目录</button>
        </div>
      </div>
      `,
      {
        list,
        selectedPath: selected ? selected.path : '',
        allowDir,
        isDir,
        getNameParts,
        getFullPath,
        getLogo(item) {
          return isDir(item) ? 'icon-gl-folder is_dir' : fileLogoType(item.name, item.size || 0);
        },
        formatBytes,
        getDateDiff,
      },
    );

    $list.replaceChildren(html);
    $more.style.display = list.length < total ? '' : 'none';
    $more.textContent = '加载更多';
  }

  function renderAll() {
    renderCrumb();
    renderList();
    updateFooter();
  }

  async function fetchAll(path) {
    const res = await reqFileReadDirAll({ path, hidden: 0 });

    if (!res || res.code !== 1) return null;

    return res.data.list || [];
  }

  async function loadDir(path, { append = false } = {}) {
    if (destroyed) return;

    if (append) {
      if (loading || list.length >= allFiles.length) return;
      pageNo++;
      list = allFiles.slice(0, pageNo * PAGE_SIZE);
      renderList();
      return;
    }

    loadSeq++;
    loading = true;
    allFiles = [];
    list = [];
    total = 0;
    pageNo = 0;
    selected = null;
    const nextPath = normalizePath(path);
    if (nextPath !== curPath) navigated = true;
    curPath = nextPath;
    renderAll();

    const seq = loadSeq;

    try {
      const data = await fetchAll(curPath);
      if (destroyed || seq !== loadSeq) return;

      allFiles = data || [];
      sortAll();
      total = allFiles.length;
      pageNo = 1;
      list = allFiles.slice(0, PAGE_SIZE);
    } catch {
      if (destroyed || seq !== loadSeq) return;
      allFiles = [];
      total = 0;
      list = [];
    } finally {
      if (!destroyed && seq === loadSeq) {
        loading = false;
        renderAll();
      }
    }
  }

  function finish(path) {
    if (destroyed) return;
    destroyed = true;
    confirmOpen = false;
    loadSeq++;
    selectedScroll.close();
    document.removeEventListener('keydown', onKeydown, true);
    el.removeEventListener('click', onClick);
    document.documentElement.classList.remove('notScroll');
    el.remove();
    resolveFn && resolveFn(path);
    callback && callback(path);
  }

  // 已选文件或切换过目录时，关闭前确认
  function requestClose(e) {
    if (destroyed || confirmOpen) return;
    if (!selected && !navigated) {
      finish(null);
      return;
    }

    confirmOpen = true;
    try {
      rMenu.pop(
        {
          e: e && typeof e.clientX === 'number' ? e : null,
          text: '关闭后当前选择将丢失，确定关闭？',
        },
        (type) => {
          confirmOpen = false;
          if (type === 'confirm') finish(null);
        },
      );
    } catch {
      confirmOpen = false;
    }
  }

  function onKeydown(e) {
    // 确认框自己处理 Enter / Esc
    if (confirmOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      requestClose();
    }
  }

  function enterDir(name) {
    selected = null;
    loadDir(normalizePath(curPath, name));
  }

  function selectFile(item) {
    selected = { name: item.name, path: getFullPath(item) };
    renderList();
    updateFooter();
  }

  function onClick(e) {
    e.stopPropagation();
    const target = e.target;

    // 关闭按钮直接关闭，和 RMenu 一致
    if (target.closest('.fp_close')) {
      finish(null);
      return;
    }

    // 点击遮罩关闭时才需要确认
    if (target.closest('.fp_mask')) {
      requestClose(e);
      return;
    }

    if (target.closest('.fp_refresh')) {
      loadDir(curPath);
      return;
    }

    if (target.closest('.fp_back')) {
      if (curPath !== '/') loadDir(_path.dirname(curPath));
      return;
    }

    const crumb = target.closest('.fp_crumb_item[data-path]');
    if (crumb) {
      if (crumb.dataset.path !== curPath) loadDir(crumb.dataset.path);
      return;
    }

    const chooseDirBtn = target.closest('.fp_choose_dir');
    const itemEl = target.closest('.fp_item');

    if (chooseDirBtn && itemEl) {
      finish(normalizePath(curPath, itemEl.dataset.name));
      return;
    }

    if (itemEl) {
      const item = list.find((it) => it.name === itemEl.dataset.name);
      if (!item) return;
      if (isDir(item)) {
        enterDir(item.name);
      } else if (allowFile) {
        selectFile(item);
      }
      return;
    }

    if (target.closest('.fp_choose_cur')) {
      finish(curPath);
      return;
    }

    if (target.closest('.fp_confirm_file')) {
      if (selected) finish(selected.path);
      return;
    }

    if (target.closest('.fp_more')) {
      loadDir(curPath, { append: true });
    }
  }

  el.addEventListener('click', onClick);

  loadDir(curPath);

  return promise;
}

export function pickFile(opt = {}) {
  return filePicker({ ...opt, type: 'file' });
}

export function pickDir(opt = {}) {
  return filePicker({ ...opt, type: 'dir' });
}
