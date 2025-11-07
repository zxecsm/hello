import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';
import '../../js/common/common';
import {
  LazyLoad,
  _getTarget,
  _myOpen,
  formatBytes,
  concurrencyTasks,
  copyText,
  createShare,
  downloadFile,
  fileLogoType,
  formatDate,
  getFilePath,
  getFiles,
  pageScrollTop,
  getScreenSize,
  imgjz,
  isFilename,
  isIframe,
  isImgFile,
  isLogin,
  isMobile,
  isRoot,
  isVideoFile,
  longPress,
  myOpen,
  toLogin,
  wrapInput,
  getDuplicates,
  isurl,
  _mySlide,
  isInteger,
} from '../../js/utils/utils';
import pagination from '../../js/plugins/pagination';
import _msg from '../../js/plugins/message';
import _d from '../../js/common/config';
import curmb from './crumb/index';
import { editFileIsHiden, openFile } from './edit';
import { UpProgress } from '../../js/plugins/UpProgress';
import bus from '../../js/utils/bus';
import loadfailImg from '../../images/img/loadfail.png';
import {
  reqFileBreakpoint,
  reqFileCdHistory,
  reqFileChown,
  reqFileClearTrash,
  reqFileCopy,
  reqFileCreateDir,
  reqFileCreateFile,
  reqFileDelete,
  reqFileDownload,
  reqFileFavorites,
  reqFileGetFavorites,
  reqFileMerge,
  reqFileMode,
  reqFileMove,
  reqFileReadDir,
  reqFileReadDirSize,
  reqFileReadFile,
  reqFileRename,
  reqFileRepeat,
  reqFileSameName,
  reqFileShare,
  reqFileUnZip,
  reqFileUp,
  reqFileZip,
} from '../../api/file';
import toolTip from '../../js/plugins/tooltip';
import { showFileInfo } from '../../js/utils/showinfo';
import rMenu from '../../js/plugins/rightMenu';
import realtime from '../../js/plugins/realtime';
import { _tpl } from '../../js/utils/template';
import md5 from '../../js/utils/md5';
import _path from '../../js/utils/path';
import { addTask } from './task';
import { reqTaskList } from '../../api/task';
import cacheFile from '../../js/utils/cacheFile';
import imgPreview from '../../js/plugins/imgPreview';
import {
  BoxSelector,
  getEventPoints,
  MouseElementTracker,
} from '../../js/utils/boxSelector';
import { otherWindowMsg } from '../home/home';
import localData from '../../js/common/localData';
import { reqUserFileToken } from '../../api/user';
const $contentWrap = $('.content_wrap');
const $pagination = $('.pagination');
const $curmbBox = $('.crumb_box');
const $search = $('.search');
const $header = $('.header');
const $footer = $('.footer');
let pageSize = localData.get('filesPageSize');
let curFileDirPath = curmb.getHash();
let fileShowGrid = localData.get('fileShowGrid');
let hiddenFile = localData.get('hiddenFile');
let fileSort = localData.get('fileSort');
let subDir = localData.get('searchFileSubDir'); // 搜索子目录
let skipUpSameNameFiles = localData.get('skipUpSameNameFiles'); // 上传略过同名文件
// 更改显示隐藏文件模式
function changeHiddenFileModel() {
  $header
    .find('.h_hidden_file_btn')
    .attr(
      'class',
      `h_btn h_hidden_file_btn iconfont ${
        hiddenFile ? 'icon-kejian' : 'icon-bukejian'
      }`
    );
}
changeHiddenFileModel();
// 更改显示模式
function changeListShowModel() {
  $header
    .find('.h_showmodel_btn')
    .attr(
      'class',
      `h_btn h_showmodel_btn iconfont ${
        fileShowGrid ? 'icon-liebiao' : 'icon-liebiao1'
      }`
    );
  $contentWrap
    .find('.container')
    .attr('class', `container ${fileShowGrid ? 'grid' : ''}`);
}
changeListShowModel();
let pageNo = 1;
let waitObj = {};
if (!isLogin()) {
  toLogin();
}
// 同步数据
realtime.init().add((res) => {
  res.forEach((item) => {
    const {
      type,
      data: { flag },
    } = item;
    if (type === 'updatedata' && flag === 'file') {
      updateCurPage();
    } else if (type === 'pastefiledata') {
      waitObj = item.data;
      if (waitObj.type) {
        showPaste();
      } else {
        hidePaste();
      }
    } else if (type === 'errMsg') {
      _msg.error(item.data.text);
    }
    otherWindowMsg(item);
  });
});
// 绑定面包屑
curmb.bind($curmbBox.find('.container')[0], (path, param) => {
  if (param.pageNo) {
    pageNo = param.pageNo;
  }
  if (path !== curFileDirPath) {
    curFileDirPath = path;
    // 打开新的目录，清空搜索框
    wInput.setValue('');
  }
  openDir(curFileDirPath, param);
});
// 选定搜索子目录状态
function changeSubDirState() {
  const $check = $search.find('.check_box i');
  if (subDir) {
    $check.attr('class', 'iconfont icon-xuanzeyixuanze');
  } else {
    $check.attr('class', 'iconfont icon-xuanzeweixuanze');
  }
}
changeSubDirState();
// 搜索
const wInput = wrapInput($search.find('.inp_box input')[0], {
  update(val) {
    if (val === '') {
      $search.find('.inp_box .clean_btn').css('display', 'none');
    } else {
      $search.find('.inp_box .clean_btn').css('display', 'block');
    }
  },
  focus(e) {
    $(e.target).parent().addClass('focus');
  },
  blur(e) {
    $(e.target).parent().removeClass('focus');
  },
  keyup(e) {
    if (e.key === 'Enter') {
      curmb.toGo(curFileDirPath, { pageNo: 1, top: 0 });
    }
  },
});
$search
  .on('click', '.inp_box .clean_btn', function () {
    wInput.setValue('').focus();
    curmb.toGo(curFileDirPath, { pageNo: 1, top: 0 });
  })
  .on('click', '.inp_box .search_btn', function () {
    curmb.toGo(curFileDirPath, { pageNo: 1, top: 0 });
  })
  .on('click', '.check_box', () => {
    subDir = !subDir;
    changeSubDirState();
    localData.set('searchFileSubDir', subDir);
  });
// 显示搜索
function openSearch() {
  $search.stop().slideDown(_d.speed, () => {
    wInput.focus();
  });
}
// 隐藏搜索
function closeSearch() {
  if (wInput.getValue()) {
    wInput.setValue('');
    updateCurPage();
  }
  $search.stop().slideUp(_d.speed);
}
// 生成列表
async function renderList(top) {
  closeCheck();
  const html = _tpl(
    `
    <template v-if="total > 0">
      <ul v-for="{type, name, size, time, id, mode, gid, uid, favorite} in list" class="file_item" :data-id="id">
        <li class="check_state" check="n"></li>
        <li cursor="y" class="logo iconfont {{hdLogo(name,type,size) || 'is_img'}}"></li>
        <li v-if="favorite" class='favorite iconfont icon-shoucang'></li>
        <li cursor="y" class="name">
          <span class="text">{{getText(name,type).a}}<span class="suffix">{{getText(name,type).b}}</span>
          </span>
        </li>
        <li v-if="mode" class='mode'>{{mode}} {{uid}}:{{gid}}</li>
        <li :cursor="type === 'file' ? '' : 'cursor'" class="size">{{size ? formatBytes(size) : type === 'file' ? '--' : '计算'}}</li>
        <li class="date">{{formatDate({template: '{0}-{1}-{2} {3}:{4}',timestamp: time})}}</li>
      </ul>
      <i v-for="item in 10" class='fill'></i>
    </template>
    <p v-else>{{_d.emptyList}}</p>
    `,
    {
      total: fileListData.total,
      formatDate,
      list: fileListData.data,
      hdLogo(name, type, size) {
        let logo = '';
        if (!isImgFile(name)) {
          if (type === 'file') {
            logo = fileLogoType(name, size);
          } else {
            logo = 'icon-24gl-folder';
          }
          return logo;
        }
      },
      formatBytes,
      getText(name, type) {
        let [a, , b] = _path.extname(name);
        if (type === 'file') {
          b = b ? '.' + b : '';
        } else {
          a = name;
          b = '';
        }
        return { a, b };
      },
      _d,
    }
  );

  if (fileListData.total > 0) {
    pageNo = fileListData.pageNo;

    $pagination.css('display', 'block');
    pgnt.render({
      pageNo,
      pageSize,
      total: fileListData.total,
      small: getScreenSize().w <= _d.screen,
    });
  } else {
    $pagination.css('display', 'none');
  }
  $contentWrap.find('.container').html(html);
  $contentWrap.addClass('open');
  $pagination.addClass('open');
  $header.addClass('open');
  $curmbBox.addClass('open');
  const logoImgs = [...$contentWrap[0].querySelectorAll('.logo.is_img')].filter(
    (item) => {
      const $item = $(item);
      const { path, name, size } = getFileItem($item.parent().data('id'));
      if (isImgFile(name)) {
        const url = getFilePath(`/file/${path}/${name}`, { t: 1 }) + `#${size}`;
        const cache = cacheFile.hasUrl(url, 'image');
        if (cache) {
          $item.css('background-image', `url(${cache})`);
        }
        return !cache;
      }
      return false;
    }
  );
  lazyImg.bind(logoImgs, async (item) => {
    const $item = $(item);
    const { path, name, size } = getFileItem($item.parent().data('id'));
    if (isImgFile(name)) {
      const url = getFilePath(`/file/${path}/${name}`, { t: 1 }) + `#${size}`;
      imgjz(url)
        .then((cache) => {
          $item.css('background-image', `url(${cache})`);
        })
        .catch(() => {
          $item.css('background-image', `url(${loadfailImg})`);
        });
    }
  });
  if (top !== undefined) {
    pageScrollTop(top);
  }
}
const lazyImg = new LazyLoad();
const mouseElementTracker = new MouseElementTracker(document, {
  delay: 300,
  onStart({ e }) {
    const item = _getTarget($contentWrap[0], e, '.content_wrap .file_item');
    if (
      isSelecting() &&
      item &&
      $(item).find('.check_state').attr('check') === 'y'
    ) {
      $contentWrap.fromDom = item;
      mouseElementTracker.changeInfo(`选中 ${getCheckDatas().length} 项`);
    } else {
      return true;
    }
  },
  onEnd({ e, dropElement }) {
    e = getEventPoints(e)[0];
    if (
      isSelecting() &&
      $contentWrap.fromDom &&
      $($contentWrap.fromDom).find('.check_state').attr('check') === 'y'
    ) {
      const to = dropElement
        ? _getTarget(
            $contentWrap[0],
            { target: dropElement },
            '.content_wrap .file_item'
          )
        : null;
      if (to) {
        const toId = to.dataset.id;
        const data = getCheckDatas();
        const toData = getFileItem(toId);
        if (!data.some((item) => item.id === toId) && toData.type === 'dir') {
          hdCut(
            e,
            data,
            false,
            `${toData.path}/${toData.name}`,
            `移动 ${data.length} 项到：${toData.name}？`
          );
        }
      }
      $contentWrap.fromDom = null;
    }
  },
});
// 分页
const pgnt = pagination($pagination.find('.container')[0], {
  change(val) {
    curmb.toGo(curFileDirPath, { pageNo: val, top: 0 });
    _msg.botMsg(`第 ${pageNo} 页`);
  },
  changeSize(val) {
    pageSize = val;
    curmb.toGo(curFileDirPath, { pageNo: 1, top: 0 });
    _msg.botMsg(`第 ${pageNo} 页`);
    localData.set('filesPageSize', pageSize);
  },
  toTop() {
    pageScrollTop(0);
  },
});
function updateCurPage() {
  curmb.toGo(curFileDirPath);
}
bus.on('getPageInfo', updatePageInfo).on('refreshList', updateCurPage);

function updatePageInfo() {
  bus.emit('setPageInfo', { pageNo, top: pageScrollTop() });
}
updateCurPage();
let fileListData = { data: [] };
// 打开目录
async function openDir(path, { top, update = 0 }) {
  try {
    const $clearTrashBtn = $header.find('.clear_trash_btn');

    if (path === `/${_d.trashDirName}`) {
      $clearTrashBtn.css('display', 'block');
    } else {
      $clearTrashBtn.css('display', 'none');
    }

    const res = await reqFileReadDir({
      path,
      pageNo,
      pageSize,
      sortType: fileSort.type,
      isDesc: fileSort.isDes ? 1 : 0,
      subDir: subDir ? 1 : 0,
      update,
      hidden: hiddenFile ? 1 : 0,
      word: wInput.getValue().trim(),
    });
    if (res.code === 1) {
      const taskKey = res.data.key;
      if (taskKey) {
        addTask(taskKey, updateCurPage);
      } else {
        fileListData = res.data;
        fileListData.data = fileListData.data.map((item, idx) => ({
          id: idx + 1 + '',
          ...item,
        }));
        renderList(top);
      }
    }
  } catch {}
}
// 获取文件信息
function getFileItem(id) {
  return fileListData.data.find((item) => item.id === id + '') || {};
}
// 刷新继续显示任务
reqTaskList()
  .then((res) => {
    if (res.code === 1) {
      res.data.forEach((key) => {
        addTask(key, updateCurPage);
      });
    }
  })
  .catch(() => {});
// 读取文件和目录
async function readFileAndDir(obj, e) {
  const { type, name, path, size } = obj;
  const p = `${path}/${name}`;
  if (type === 'dir') {
    updatePageInfo();
    curmb.toGo(p, { pageNo: 1, top: 0 });
  } else if (type === 'file') {
    try {
      const res = await reqFileReadFile({ path: p });
      if (res.code === 1) {
        if (res.data.type === 'text') {
          // 文本
          openFile(res.data.data, p);
        } else if (res.data.type === 'other') {
          const fPath = getFilePath(`/file/${p}`);
          // 图片
          if (isImgFile(p)) {
            const list = fileListData.data.filter(
              (item) => item.type === 'file' && isImgFile(item.name)
            );
            const arr = list.map((item) => {
              const p = `${item.path}/${item.name}`;
              return {
                u1: getFilePath(`/file/${p}`) + `#${item.size}`,
                u2: getFilePath(`/file/${p}`, { t: 1 }) + `#${item.size}`,
              };
            });
            if (arr.length === 0) return;
            imgPreview(
              arr,
              list.findIndex((item) => item.id === obj.id),
              { x: e.clientX, y: e.clientY }
            );
          } else if (isVideoFile(p)) {
            // 视频
            _myOpen(`/videoplay#${encodeURIComponent(fPath)}`, obj.name);
          } else if (/(\.mp3|\.aac|\.wav|\.ogg)$/gi.test(p)) {
            // 音频
            _myOpen(fPath, obj.name);
          } else {
            // 其他下载
            downloadFile(
              [{ fileUrl: fPath + `#${size}`, filename: name }],
              'image'
            );
          }
        }
      }
    } catch {}
  }
}
$contentWrap
  .on('click', '.logo', function (e) {
    const id = this.parentNode.dataset.id;
    if (fileShowGrid) {
      readFileAndDir(getFileItem(id), e);
    } else {
      rightList(
        e,
        getFileItem(id),
        this.parentNode.querySelector('.check_state')
      );
    }
  })
  .on('click', '.size', function () {
    const id = this.parentNode.dataset.id;
    const { type, name, path } = getFileItem(id);
    if (type === 'file') return;
    const p = `${path}/${name}`;
    reqFileReadDirSize({ path: p })
      .then((res) => {
        if (res.code === 1) {
          addTask(res.data.key, updateCurPage);
        }
      })
      .catch(() => {});
  })
  .on('click', '.name', function (e) {
    const id = this.parentNode.dataset.id;
    if (fileShowGrid) {
      rightList(
        e,
        getFileItem(id),
        this.parentNode.querySelector('.check_state')
      );
    } else {
      readFileAndDir(getFileItem(id), e);
    }
  })
  .on('click', '.check_state', function (e) {
    e.stopPropagation();
    hdCheckItem(this);
  })
  .on('mouseenter', '.file_item .name', function () {
    const { name, type, path, mode, size, time, uid, gid, favorite } =
      getFileItem($(this).parent().attr('data-id'));
    const str = `名称：${name}\n类型：${
      type === 'dir' ? '文件夹' : '文件'
    }\n路径：${path}${
      mode ? `\n权限：${mode}\n用户ID：${uid}\n用户组ID：${gid}` : ''
    }${
      type === 'dir' && favorite !== undefined
        ? `\n收藏状态：${favorite ? '已收藏' : '未收藏'}`
        : ''
    }\n大小：${size ? formatBytes(size) : '--'}\n更新时间：${formatDate({
      template: '{0}-{1}-{2} {3}:{4}',
      timestamp: time,
    })}`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.file_item .name', function () {
    toolTip.hide();
  })
  .on('contextmenu', function (e) {
    e.preventDefault();
    if (isMobile() || isSelecting()) return;
    const fileItem = _getTarget(this, e, '.content_wrap .file_item');
    if (fileItem) {
      rightList(
        e,
        getFileItem(fileItem.dataset.id),
        fileItem.querySelector('.check_state')
      );
    } else {
      hdContextMenu(e);
    }
  });
function hdContextMenu(e) {
  const data = [
    { id: 'select', text: '多选', beforeIcon: 'iconfont icon-duoxuan' },
    {
      id: 'create',
      text: '新建',
      beforeIcon: 'iconfont icon-tianjia',
    },
    {
      id: 'up',
      text: '上传',
      beforeIcon: 'iconfont icon-upload',
    },
  ];
  rMenu.selectMenu(e, data, async ({ e, close, id }) => {
    if (id === 'select') {
      close();
      if (!isSelecting()) {
        startCheck();
      }
    } else if (id === 'create') {
      createFileAndDir(e);
    } else if (id === 'up') {
      upFileAndDir(e);
    }
  });
}
longPress($contentWrap[0], function (e) {
  if (isSelecting()) return;
  const ev = e.changedTouches[0];
  const fileItem = _getTarget(this, ev, '.content_wrap .file_item');
  if (fileItem) {
    rightList(
      ev,
      getFileItem(fileItem.dataset.id),
      fileItem.querySelector('.check_state')
    );
  } else {
    hdContextMenu(ev);
  }
});
// 操作菜单
function rightList(e, obj, el) {
  const data = [
    {
      id: 'copyPath',
      text: '复制路径',
      beforeIcon: 'iconfont icon-fuzhi',
    },
  ];
  if (obj.type === 'file') {
    data.push({
      id: 'copyLink',
      text: '复制链接',
      beforeIcon: 'iconfont icon-link1',
    });
  }
  if (obj.type === 'dir') {
    data.push(
      {
        id: 'favorite',
        text: `${obj.favorite ? '取消' : ''}收藏`,
        beforeIcon: 'iconfont icon-shoucang',
      },
      {
        id: 'newPage',
        text: '新窗口打开',
        beforeIcon: 'iconfont icon-24gl-minimize',
      }
    );
  }
  data.push({
    id: 'share',
    text: '分享',
    beforeIcon: 'iconfont icon-fenxiang_2',
  });
  if (obj.type === 'file') {
    data.push({
      id: 'download',
      text: '下载',
      beforeIcon: 'iconfont icon-download',
    });
  }
  data.push(
    {
      id: 'check',
      text: '选中',
      beforeIcon: 'iconfont icon-duoxuan',
    },
    {
      id: 'rename',
      text: '重命名',
      beforeIcon: 'iconfont icon-24gl-rename',
    },
    {
      id: 'copy',
      text: '复制',
      beforeIcon: 'iconfont icon-fuzhi',
    },
    {
      id: 'cut',
      text: '剪切',
      beforeIcon: 'iconfont icon-jiandao',
    }
  );
  if (_path.extname(obj.name)[2].toLowerCase() === 'zip') {
    data.push({
      id: 'decompress',
      text: '解压',
      beforeIcon: 'iconfont icon-yasuobao1',
    });
  } else {
    data.push({
      id: 'compress',
      text: '压缩',
      beforeIcon: 'iconfont icon-yasuobao1',
    });
  }
  data.push({
    id: 'info',
    text: '属性',
    beforeIcon: 'iconfont icon-about',
  });
  if (isRoot()) {
    data.push(
      {
        id: 'mode',
        text: '权限',
        beforeIcon: 'iconfont icon-user_root',
      },
      {
        id: 'user',
        text: '用户组',
        beforeIcon: 'iconfont icon-chengyuan',
      }
    );
  }
  data.push({
    id: 'del',
    text: '删除',
    beforeIcon: 'iconfont icon-shanchu',
  });
  rMenu.selectMenu(
    e,
    data,
    ({ e, id, close, loading }) => {
      // 编辑列表
      if (id === 'download') {
        close();
        downloadFile(
          [
            {
              fileUrl:
                getFilePath(`/file/${obj.path}/${obj.name}`) + `#${obj.size}`,
              filename: obj.name,
            },
          ],
          'image'
        );
      } else if (id === 'copyLink') {
        loading.start();
        const p = _path.normalize('/file', obj.path, obj.name);
        reqUserFileToken({ p })
          .then((res) => {
            if (res.code === 1) {
              loading.end();
              close();
              copyText(
                `${_d.originURL}${getFilePath(p, {
                  token: res.data,
                })}`
              );
            }
          })
          .catch(() => {
            loading.end();
          });
      } else if (id === 'share') {
        hdShare(e, obj);
      } else if (id === 'favorite') {
        rMenu.pop(
          {
            e,
            text: `${obj.favorite ? '取消' : ''}收藏文件夹：${obj.name}？`,
            type: 'confirm',
          },
          (type) => {
            if (type === 'confirm') {
              loading.start();
              reqFileFavorites({
                data: obj,
                type: obj.favorite ? 'del' : 'add',
              })
                .then((res) => {
                  if (res.code === 1) {
                    loading.end();
                    close();
                    updateCurPage();
                  }
                })
                .catch(() => {
                  loading.end();
                });
            }
          }
        );
      } else if (id === 'rename') {
        hdRename(e, obj, () => {
          close();
        });
      } else if (id === 'copy') {
        waitObj = {
          type: 'copy',
          data: [obj],
        };
        realtime.send({ type: 'pastefiledata', data: waitObj });
        showPaste();
        close();
      } else if (id === 'del') {
        hdDel(
          e,
          [obj],
          () => {
            close();
          },
          loading
        );
      } else if (id === 'cut') {
        waitObj = {
          type: 'cut',
          data: [obj],
        };
        realtime.send({ type: 'pastefiledata', data: waitObj });
        showPaste();
        close();
      } else if (id === 'compress') {
        hdCompress(
          e,
          obj,
          () => {
            close();
          },
          loading
        );
      } else if (id === 'decompress') {
        hdDeCompress(
          e,
          obj,
          () => {
            close();
          },
          loading
        );
      } else if (id === 'info') {
        showFileInfo(e, obj);
      } else if (id === 'check') {
        close();
        if (!isSelecting()) {
          startCheck();
          hdCheckItem(el);
        }
      } else if (id === 'mode') {
        editFileMode(e, [obj]);
      } else if (id === 'user') {
        editFileChown(e, [obj]);
      } else if (id === 'copyPath') {
        copyText(_path.normalize('/', obj.path, obj.name));
        close();
      } else if (id === 'newPage') {
        close();
        e.stopPropagation();
        _myOpen(
          `/file#${_path.normalize('/', obj.path, obj.name)}`,
          '文件管理'
        );
      }
    },
    obj.name
  );
}
// 编辑权限
function editFileMode(e, data) {
  const firstItem = data[0];
  rMenu.inpMenu(
    e,
    {
      items: {
        mode: {
          placeholder: '777',
          beforeText: '权限码：r=4,w=2,x=1',
          inputType: 'number',
          value: data.length > 1 ? '' : `${firstItem.mode.slice(-3)}`,
          verify(val) {
            if (!/^[0-7]{3}$/.test(val)) {
              return '请输入正确权限码';
            }
          },
        },
        r: {
          beforeText: '递归修改子文件和文件夹：',
          type: 'select',
          value: 'n',
          selectItem: [
            { value: 'y', text: '开启' },
            { value: 'n', text: '关闭' },
          ],
        },
      },
    },
    function ({ close, inp, loading, isDiff, e }) {
      if (!isDiff()) return;
      const filename = data.length > 1 ? '' : ` ${firstItem.name} `;
      const { mode, r } = inp;
      rMenu.pop(
        {
          e,
          text: `确认修改${filename}权限：(${mode})？`,
        },
        async (type) => {
          if (type === 'confirm') {
            loading.start();
            reqFileMode({ data, mode, r: r === 'y' ? 1 : 0 })
              .then((res) => {
                loading.end();
                if (res.code === 1) {
                  close(1);
                  addTask(res.data.key, updateCurPage);
                }
              })
              .catch(() => {
                loading.end();
              });
          }
        }
      );
    },
    '修改权限'
  );
}
// 编辑用户组
function editFileChown(e, data) {
  const firstItem = data[0];
  rMenu.inpMenu(
    e,
    {
      items: {
        uid: {
          beforeText: '用户ID：',
          inputType: 'number',
          value: data.length > 1 ? '' : `${firstItem.uid}`,
          verify(val) {
            val = parseFloat(val);
            if (!isInteger(val) || val < 0) {
              return '请输入正整数';
            }
          },
        },
        gid: {
          beforeText: '用户组ID：',
          inputType: 'number',
          value: data.length > 1 ? '' : `${firstItem.gid}`,
          verify(val) {
            val = parseFloat(val);
            if (!isInteger(val) || val < 0) {
              return '请输入正整数';
            }
          },
        },
        r: {
          beforeText: '递归修改子文件和文件夹：',
          type: 'select',
          value: 'n',
          selectItem: [
            { value: 'y', text: '开启' },
            { value: 'n', text: '关闭' },
          ],
        },
      },
    },
    function ({ close, inp, loading, isDiff, e }) {
      if (!isDiff()) return;
      const { gid, uid, r } = inp;
      const filename = data.length > 1 ? '' : ` ${firstItem.name} `;
      rMenu.pop(
        {
          e,
          text: `确认修改${filename}用户组：(UID：${uid} GID：${gid})？`,
        },
        async (type) => {
          if (type === 'confirm') {
            loading.start();
            reqFileChown({ data, uid, gid, r: r === 'y' ? 1 : 0 })
              .then((res) => {
                loading.end();
                if (res.code === 1) {
                  close(1);
                  addTask(res.data.key, updateCurPage);
                }
              })
              .catch(() => {
                loading.end();
              });
          }
        }
      );
    },
    '修改用户组'
  );
}
// 分享
function hdShare(e, obj) {
  createShare(
    e,
    { name: obj.name, title: `分享${obj.type === 'file' ? '文件' : '文件夹'}` },
    ({ close, inp, loading }) => {
      const { title, pass, expireTime } = inp;
      loading.start();
      reqFileShare({ data: obj, title, pass, expireTime })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close(1);
            _myOpen(`/sharelist`, '分享列表');
          }
        })
        .catch(() => {
          loading.end();
        });
    }
  );
}
// 粘贴文件
function pasteFile(e) {
  if (!editFileIsHiden() || waitObj.type) return;
  const files = [];
  const data = e.clipboardData || window.clipboardData;
  [...data.items].forEach((item) => {
    const blob = item.getAsFile();
    if (blob) {
      files.push(blob);
    }
  });
  if (files.length === 0) return;
  e.preventDefault();
  hdUp(files);
}
document.addEventListener('paste', pasteFile);
// 拖拽文件上传
~(function () {
  $contentWrap[0].addEventListener('dragenter', function (e) {
    e.preventDefault();
  });
  $contentWrap[0].addEventListener('dragover', function (e) {
    e.preventDefault();
  });
  $contentWrap[0].addEventListener('drop', function (e) {
    e.preventDefault();
    const files = [...e.dataTransfer.files];
    if (files.length === 0) return;
    hdUp(files);
  });
})();
// 解压
async function hdDeCompress(e, obj, cb, loading) {
  rMenu.pop(
    {
      e,
      text: `确认解压文件：${obj.name}？`,
    },
    async (type) => {
      if (type === 'confirm') {
        try {
          loading.start();
          const res = await reqFileUnZip({ data: obj });
          loading.end();
          if (res.code === 1) {
            addTask(res.data.key, updateCurPage);
            cb && cb();
          }
        } catch (error) {
          loading.end();
          if (error.statusText === 'timeout') {
            _msg.success(`文件后台处理中`);
          }
          cb && cb();
        }
      }
    }
  );
}
// 压缩
async function hdCompress(e, obj, cb, loading = { start() {}, end() {} }) {
  rMenu.pop(
    {
      e,
      text: `确认压缩${obj.type === 'dir' ? '文件夹' : '文件'}：${obj.name}？`,
    },
    async (type) => {
      if (type === 'confirm') {
        try {
          loading.start();
          const res = await reqFileZip({ data: obj });
          loading.end();
          if (res.code === 1) {
            addTask(res.data.key, updateCurPage);
            cb && cb();
          }
        } catch (error) {
          loading.end();
          if (error.statusText === 'timeout') {
            _msg.success(`文件后台处理中`);
          }
          cb && cb();
        }
      }
    }
  );
}
// 选中
function hdCheckItem(el) {
  const $el = $(el);
  if ($el.attr('check') === 'y') {
    $el.css('background-color', 'transparent').attr('check', 'n');
  } else {
    $el.css('background-color', _d.checkColor).attr('check', 'y');
  }
  renderFoot();
}
if (isIframe()) {
  $header.find('.h_go_home').remove();
}
// 上传
async function hdUp(files) {
  const controller = new AbortController();
  const signal = controller.signal;

  const upPro = new UpProgress(() => {
    controller.abort();
  });

  await concurrencyTasks(files, 3, async (file) => {
    if (signal.aborted) return;
    const { name, size, webkitRelativePath } = file;
    let path = curFileDirPath;
    if (webkitRelativePath) {
      path = `${path}/${webkitRelativePath}`;
    } else {
      path = `${path}/${name}`;
    }
    path = _path.normalize(path);
    const pro = upPro.add(name);
    if (size === 0) {
      pro.fail();
      _msg.error(`不能上传空文件`);
      return;
    }
    if (size > _d.fieldLength.maxFileSize) {
      pro.fail();
      _msg.error(`上传文件限制0-9.7G`);
      return;
    }
    if (skipUpSameNameFiles) {
      const res = await reqFileRepeat({ path });
      if (res.code === 1) {
        pro.close('略过同名文件');
        return;
      }
    }

    try {
      //文件切片
      const { chunks, count, HASH } = await md5.fileSlice(
        file,
        (percent) => {
          pro.loading(percent);
        },
        signal
      );
      const breakpointarr = (await reqFileBreakpoint({ HASH })).data; //断点续传

      function compale(index) {
        pro.update(index / count);
      }
      let index = breakpointarr.length;
      compale(index);
      await concurrencyTasks(chunks, 3, async (chunk) => {
        if (signal.aborted) return;
        const { filename, file } = chunk;
        if (breakpointarr.includes(filename)) return;
        await reqFileUp({ name: filename, HASH }, file, false, signal);
        index++;
        compale(index);
      });
      if (signal.aborted) return;
      try {
        const mergeRes = await reqFileMerge({
          HASH,
          count,
          path,
        }); //合并切片
        if (mergeRes.code === 1) {
          pro.close();
        } else {
          pro.fail();
        }
      } catch (error) {
        if (error.statusText === 'timeout') {
          pro.close(`文件后台处理中`);
        } else {
          pro.fail();
        }
      }
    } catch {
      pro.fail();
    }
  });
  realtime.send({ type: 'updatedata', data: { flag: 'file' } });
  updateCurPage();
}
// 新建文件
function createFile(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        name: {
          placeholder: '文件名',
          verify(val) {
            if (val === '') {
              return '请输入名称';
            } else if (val.length > _d.fieldLength.filename) {
              return '名称过长';
            } else if (!isFilename(val)) {
              return '名称包含了不允许的特殊字符';
            }
          },
        },
      },
    },
    async function ({ close, inp, loading }) {
      try {
        const name = inp.name;
        loading.start();
        const res = await reqFileCreateFile({
          path: curFileDirPath,
          name,
        });
        loading.end();
        if (res.code === 1) {
          _msg.success(res.codeText);
          updateCurPage();
          openFile('', curFileDirPath + '/' + name);
          close(1);
        }
      } catch {
        loading.end();
      }
    },
    '新建文本'
  );
}
// 创建目录
function createDir(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        name: {
          placeholder: '文件夹名',
          verify(val) {
            if (val === '') {
              return '请输入名称';
            } else if (val.length > _d.fieldLength.filename) {
              return '名称过长';
            } else if (!isFilename(val)) {
              return '名称包含了不允许的特殊字符';
            }
          },
        },
      },
    },
    async function ({ close, inp, loading }) {
      try {
        const name = inp.name;
        loading.start();
        const res = await reqFileCreateDir({
          path: curFileDirPath,
          name,
        });
        loading.end();
        if (res.code === 1) {
          _msg.success(res.codeText);
          updateCurPage();
          close(1);
        }
      } catch {
        loading.end();
      }
    },
    '新建文件夹'
  );
}
$header
  .on('click', '.h_showmodel_btn', function () {
    fileShowGrid = !fileShowGrid;
    localData.set('fileShowGrid', fileShowGrid);
    changeListShowModel();
  })
  .on('click', '.h_hidden_file_btn', function () {
    hiddenFile = !hiddenFile;
    localData.set('hiddenFile', hiddenFile);
    changeHiddenFileModel();
    curmb.toGo(curFileDirPath, { pageNo: 1, top: 0 });
  })
  .on('click', '.h_search_btn', function () {
    if ($search.is(':hidden')) {
      pageScrollTop(0);
      openSearch();
    } else {
      closeSearch();
    }
  })
  .on('click', '.h_trash_btn', function () {
    updatePageInfo();
    curmb.toGo(`/${_d.trashDirName}`, { pageNo: 1, top: 0 });
  })
  .on('click', '.h_go_home', function () {
    myOpen('/');
  })
  .on('click', '.h_check_item_btn', function () {
    if (!isSelecting()) {
      startCheck();
    } else {
      closeCheck();
    }
  })
  .on('click', '.h_upload_btn', upFileAndDir)
  .on('click', '.h_download_btn', handleDownloadFile)
  .on('click', '.h_add_item_btn', createFileAndDir)
  .on('click', '.h_sort_btn', hdFileSort)
  .on('click', '.paste_btn .text', hdPaste)
  .on('click', '.paste_btn .type', hdPaste)
  .on('click', '.clear_trash_btn', hdClearTrash)
  .on('click', '.h_history', (e) => {
    let data = [];
    reqFileCdHistory()
      .then((res) => {
        if (res.code === 1) {
          data = res.data;
        }
      })
      .catch(() => {
        data = localData.get('fileHistory');
      })
      .finally(() => {
        if (data.length === 0) {
          _msg.error('暂无历史记录');
          return;
        }
        data = data.map((item, idx) => {
          return {
            id: idx + '',
            beforeIcon: 'iconfont icon-history',
            text: item,
            param: { path: item },
          };
        });
        data.reverse();
        rMenu.selectMenu(
          e,
          data,
          ({ id, close, param }) => {
            if (id) {
              close();
              if (param.path === curFileDirPath) return;
              updatePageInfo();
              curmb.toGo(param.path, { pageNo: 1, top: 0 });
            }
          },
          '历史文件夹'
        );
      });
  })
  .on('click', '.h_favorite_btn', (e) => {
    reqFileGetFavorites()
      .then((res) => {
        if (res.code === 1) {
          const data = res.data.map((item, idx) => {
            return {
              id: idx + '',
              beforeIcon: 'iconfont icon-shoucang',
              text: item,
              param: { path: item },
            };
          });

          if (data.length === 0) {
            _msg.error('暂无收藏文件夹');
            return;
          }

          rMenu.selectMenu(
            e,
            data,
            ({ id, close, param }) => {
              if (id) {
                close();
                if (param.path === curFileDirPath) return;
                updatePageInfo();
                curmb.toGo(param.path, { pageNo: 1, top: 0 });
              }
            },
            '收藏文件夹'
          );
        }
      })
      .catch(() => {});
  })
  .on('click', '.paste_btn .close', () => {
    waitObj = {};
    realtime.send({ type: 'pastefiledata', data: waitObj });
    hidePaste();
  })
  .on('mouseenter', '.paste_btn', function () {
    const { type, data } = waitObj;
    let str = `操作：${type === 'copy' ? '复制' : '剪切'}`;
    data.forEach((item) => {
      const { name, type, size } = item;
      str += `\n${type === 'file' ? '文件' : '目录'}：${name}${
        size ? ` (${formatBytes(size)})` : ''
      }`;
    });
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.paste_btn', function () {
    toolTip.hide();
  });

// 离线下载
function handleDownloadFile(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        url: {
          placeholder: '仅支持http/https网络链接',
          verify(val) {
            if (!isurl(val)) {
              return '请输入正确的外链地址';
            }
          },
        },
      },
    },
    async function ({ close, inp }) {
      close();
      reqFileDownload({ url: inp.url, path: curFileDirPath })
        .then((res) => {
          if (res.code === 1) {
            addTask(res.data.key, updateCurPage);
          }
        })
        .catch(() => {});
    },
    '离线下载文件'
  );
}
function upFileAndDir(e) {
  const data = [
    { id: '1', text: '上传文件', beforeIcon: 'iconfont icon-24gl-fileEmpty' },
    {
      id: '2',
      text: '上传文件夹',
      beforeIcon: 'iconfont icon-24gl-folderPlus',
    },
    {
      id: '3',
      text: '忽略同名文件',
      beforeIcon: 'iconfont icon-hulve',
      afterIcon:
        'iconfont ' +
        (skipUpSameNameFiles ? 'icon-kaiguan-kai1' : 'icon-kaiguan-guan'),
      param: { value: skipUpSameNameFiles },
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    async ({ close, id, param, resetMenu }) => {
      const curItem = data.find((item) => item.id === id);
      if (id === '1') {
        const files = await getFiles({
          multiple: true,
        });
        if (files.length === 0) return;
        hdUp(files);
        close(1);
      } else if (id === '2') {
        const files = await getFiles({
          webkitdirectory: true,
        });
        if (files.length === 0) return;
        hdUp(files);
        close(1);
      } else if (id === '3') {
        if (param.value) {
          curItem.afterIcon = 'iconfont icon-kaiguan-guan';
          curItem.param.value = false;
          skipUpSameNameFiles = false;
          localData.set('skipUpSameNameFiles', false);
        } else {
          curItem.afterIcon = 'iconfont icon-kaiguan-kai1';
          curItem.param.value = true;
          skipUpSameNameFiles = true;
          localData.set('skipUpSameNameFiles', true);
        }
        resetMenu(data);
      }
    },
    '上传选项'
  );
}
function createFileAndDir(e) {
  const data = [
    { id: '1', text: '新建文本', beforeIcon: 'iconfont icon-24gl-fileEmpty' },
    {
      id: '2',
      text: '新建文件夹',
      beforeIcon: 'iconfont icon-24gl-folderPlus',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    async ({ e, id }) => {
      if (id === '1') {
        createFile(e);
      } else if (id === '2') {
        createDir(e);
      }
    },
    '新建选项'
  );
}
// 处理粘贴
function hdPaste(e) {
  const { type, data } = waitObj;
  if (type === 'copy') {
    hdCopy(e, data);
  } else if (type === 'cut') {
    hdCut(e, data);
  }
}
// 清空回收站
function hdClearTrash(e) {
  rMenu.pop(
    { e, text: '确认清空回收站？', confirm: { type: 'danger', text: '清空' } },
    (type) => {
      if (type === 'confirm') {
        reqFileClearTrash()
          .then((res) => {
            if (res.code === 1) {
              addTask(res.data.key, updateCurPage);
            }
          })
          .catch((error) => {
            if (error.statusText === 'timeout') {
              _msg.success(`文件后台处理中`);
            }
          });
      }
    }
  );
}
// 排序
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
        curmb.toGo(curFileDirPath, { pageNo: 1, top: 0 });
        localData.set('fileSort', fileSort);
      }
    },
    '选择列表排序方式'
  );
}
// 复制
async function hdCopy(e, data, cb) {
  const type = await rMenu.pop.p({ e, text: '确认粘贴？' });
  if (type === 'confirm') {
    try {
      if (getDuplicates(data, ['name']).length > 0) {
        _msg.error('复制项中存在同名文件或文件夹');
        return;
      }

      if (
        !data.every((item) => {
          const { path, name } = item;
          const f = _path.normalize(path, name);
          const t = _path.normalize(curFileDirPath, name);
          return !_path.isPathWithin(f, t);
        })
      ) {
        _msg.error('发现错误，不能复制到子目录中');
        return;
      }

      const same = await reqFileSameName({ data, path: curFileDirPath });

      if (same.code === 1) {
        const { hasSameName } = same.data;
        let rename = 0;

        // 有重名文件
        if (hasSameName) {
          const type = await rMenu.pop.p({
            top: true,
            text: '如何处理同名文件？',
            cancel: { text: '重命名' },
            confirm: { text: '覆盖' },
          });
          if (type === 'close') return;
          if (type === 'confirm') {
            rename = 0;
          } else {
            rename = 1;
          }
        }
        const res = await reqFileCopy({
          data,
          path: curFileDirPath,
          rename,
        });
        if (res.code === 1) {
          addTask(res.data.key, updateCurPage);
          waitObj = {};
          realtime.send({ type: 'pastefiledata', data: waitObj });
          hidePaste();
          cb && cb();
        }
      }
    } catch (error) {
      if (error.statusText === 'timeout') {
        _msg.success(`文件后台处理中`);
      }
      cb && cb();
    }
  }
}
// 移动
async function hdCut(
  e,
  data,
  cb,
  toPath = curFileDirPath,
  text = '确认粘贴？'
) {
  const type = await rMenu.pop.p({ e, text });
  if (type === 'confirm') {
    try {
      if (getDuplicates(data, ['name']).length > 0) {
        _msg.error('剪切项中存在同名文件或文件夹');
        return;
      }

      if (
        !data.every((item) => {
          const { path, name } = item;
          const f = _path.normalize(path, name);
          const t = _path.normalize(toPath, name);
          return f !== t && !_path.isPathWithin(f, t);
        })
      ) {
        _msg.error('发现错误，不能剪切到子目录和当前目录中');
        return;
      }

      const same = await reqFileSameName({ data, path: toPath });

      if (same.code === 1) {
        const { hasSameName } = same.data;
        let rename = 0;

        // 有重名文件
        if (hasSameName) {
          const type = await rMenu.pop.p({
            top: true,
            text: '如何处理同名文件？',
            cancel: { text: '重命名' },
            confirm: { text: '覆盖' },
          });
          if (type === 'close') return;
          if (type === 'confirm') {
            rename = 0;
          } else {
            rename = 1;
          }
        }

        const res = await reqFileMove({ data, path: toPath, rename });
        if (res.code === 1) {
          addTask(res.data.key, updateCurPage);
          waitObj = {};
          realtime.send({ type: 'pastefiledata', data: waitObj });
          hidePaste();
          cb && cb();
        }
      }
    } catch (error) {
      if (error.statusText === 'timeout') {
        _msg.success(`文件后台处理中`);
      }
      waitObj = {};
      realtime.send({ type: 'pastefiledata', data: waitObj });
      hidePaste();
      cb && cb();
    }
  }
}
// 获取选中
function getCheckItem() {
  const $cItem = $contentWrap.find('.file_item');
  return $cItem.filter(
    (_, item) => $(item).find('.check_state').attr('check') === 'y'
  );
}
function getCheckDatas() {
  let arr = [];
  getCheckItem().each((_, item) => {
    arr.push(getFileItem($(item).data('id')));
  });
  return arr;
}
const boxSelector = new BoxSelector(document, {
  selectables: '.content_wrap .file_item',
  onSelectStart({ e }) {
    const item = _getTarget($contentWrap[0], e, '.content_wrap .file_item');
    if (item) return true;
  },
  onSelectEnd() {
    renderFoot();
  },
  onSelectUpdate({ selectedItems, allItems, isKeepOld }) {
    allItems.forEach((item) => {
      const needCheck = selectedItems.includes(item);
      const $cItem = $(item).find('.check_state');
      const isChecked = $cItem.attr('check') === 'y';
      if (needCheck && !isChecked) {
        $cItem
          .css({
            display: 'block',
            'background-color': _d.checkColor,
          })
          .attr('check', 'y');
      } else if (!needCheck && isChecked && !isKeepOld) {
        $cItem
          .css({
            display: 'block',
            'background-color': 'transparent',
          })
          .attr('check', 'n');
      }
    });
  },
});
boxSelector.stop();
function isSelecting() {
  return !$footer.is(':hidden');
}
// 开启选中
function startCheck() {
  $contentWrap
    .find('.check_state')
    .css({
      display: 'block',
      'background-color': 'transparent',
    })
    .attr('check', 'n');
  renderFoot();
  $footer.stop().slideDown(_d.speed, () => {
    boxSelector.start();
    mouseElementTracker.start();
  });
}
// 关闭选中
function closeCheck() {
  $contentWrap.find('.check_state').css('display', 'none');
  $footer.stop().slideUp(_d.speed, () => {
    boxSelector.stop();
    mouseElementTracker.stop();
  });
}
// 更新底部菜单
function renderFoot() {
  const items = $contentWrap.find('.file_item');
  const checkData = getCheckDatas();
  const len = checkData.length;
  const html = _tpl(
    `
    <span cursor="y" :data-check="items.length === len ? 'y' : 'n'" class="iconfont {{items.length === len ? 'icon-xuanzeyixuanze' : 'icon-xuanzeweixuanze'}}"></span>
    <template v-if="len > 0">
      <button cursor="y" class="f_copy btn btn_primary">复制</button>
      <button cursor="y" class="f_cut btn btn_primary">剪切</button>
      <template v-if="len === 1">
        <button cursor="y" class="f_share btn btn_primary">分享</button>
        <button cursor="y" class="f_rename btn btn_primary">重命名</button>
        <button v-if="isZip()" cursor="y" class="f_decompress btn btn_primary">解压缩</button>
        <button v-else cursor="y" class="f_compress btn btn_primary">压缩</button>
      </template>
      <button v-if="isRoot()" cursor="y" class="f_mode btn btn_primary">权限</button>
      <button v-if="isRoot()" cursor="y" class="f_user btn btn_primary">用户组</button>
      <button v-if="checkIsFile()" cursor="y" class="f_download btn btn_primary">下载</button>
      <button cursor="y" class="f_delete btn btn_danger">删除</button>
    </template>
    <button cursor="y" class="f_close btn btn_info">取消</button>
    `,
    {
      items,
      len,
      isZip() {
        return _path.extname(checkData[0].name)[2].toLowerCase() === 'zip';
      },
      checkIsFile() {
        return checkData.every((item) => item.type === 'file');
      },
      isRoot,
    }
  );
  if (isSelecting()) {
    _msg.botMsg(`选中：${len}项`);
  }
  $footer.find('.container').html(html);
}
function switchCheckAll(el) {
  const $this = $(el);
  const $items = $contentWrap.find('.file_item');
  if ($this.data('check') === 'y') {
    $items
      .find('.check_state')
      .css({
        'background-color': 'transparent',
      })
      .attr('check', 'n');
    renderFoot();
  } else {
    $items
      .find('.check_state')
      .css({
        'background-color': _d.checkColor,
      })
      .attr('check', 'y');
    renderFoot();
  }
}
$footer
  .on('click', 'span', function () {
    switchCheckAll(this);
  })
  .on('click', '.f_download', function () {
    downloadFile(
      getCheckDatas().reduce((pre, cur) => {
        const { name, path, type, size } = cur;
        if (type === 'file') {
          pre.push({
            fileUrl: getFilePath(`/file/${path}/${name}`) + `#${size}`,
            filename: name,
          });
        }
        return pre;
      }, []),
      'image'
    );
    closeCheck();
  })
  .on('click', '.f_copy', function () {
    waitObj = {
      type: 'copy',
      data: getCheckDatas(),
    };
    realtime.send({ type: 'pastefiledata', data: waitObj });
    showPaste();
    closeCheck();
  })
  .on('click', '.f_cut', function () {
    waitObj = {
      type: 'cut',
      data: getCheckDatas(),
    };
    realtime.send({ type: 'pastefiledata', data: waitObj });
    showPaste();
    closeCheck();
  })
  .on('click', '.f_rename', function (e) {
    const obj = getCheckDatas()[0];
    hdRename(e, obj);
  })
  .on('click', '.f_mode', function (e) {
    editFileMode(e, getCheckDatas());
  })
  .on('click', '.f_user', function (e) {
    editFileChown(e, getCheckDatas());
  })
  .on('click', '.f_close', function () {
    closeCheck();
  })
  .on('click', '.f_delete', function (e) {
    hdDel(e, getCheckDatas());
  })
  .on('click', '.f_compress', function (e) {
    hdCompress(e, getCheckDatas()[0]);
  })
  .on('click', '.f_decompress', function (e) {
    hdDeCompress(e, getCheckDatas()[0]);
  })
  .on('click', '.f_share', function (e) {
    hdShare(e, getCheckDatas()[0]);
  });
// 删除
function hdDel(e, arr, cb, loading = { start() {}, end() {} }) {
  if (
    arr.some(
      (item) => _path.normalize(item.path, item.name) === `/${_d.trashDirName}`
    )
  ) {
    _msg.error(`不能删除回收站目录：/${_d.trashDirName}`);
    return;
  }
  let text = '确认删除？';
  if (arr.length === 1) {
    text = `确认删除：${arr[0].name}？`;
  }
  const opt = {
    e,
    text,
    confirm: { type: 'danger', text: '删除' },
  };
  // 不是回收站目录
  if (
    curFileDirPath !== `/${_d.trashDirName}` &&
    !_path.isPathWithin(`/${_d.trashDirName}`, curFileDirPath)
  ) {
    opt.cancel = { text: '放入回收站', type: 'primary' };
    opt.confirm.text = '直接删除';
  }
  rMenu.pop(opt, async (type) => {
    if (type === 'confirm' || type === 'cancel') {
      try {
        const force = type === 'confirm' ? 1 : 0;
        loading.start();
        const res = await reqFileDelete({ data: arr, force });
        loading.end();
        if (res.code === 1) {
          addTask(res.data.key, updateCurPage);
          cb && cb();
        }
      } catch (error) {
        loading.end();
        if (error.statusText === 'timeout') {
          _msg.success(`文件后台处理中`);
        }
        cb && cb();
      }
    }
  });
}
// 重命名
function hdRename(e, obj, cb) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        name: {
          placeholder: `${obj.type === 'file' ? '文件名' : '文件夹名'}`,
          value: obj.name,
          verify(val) {
            if (val === '') {
              return '请输入名称';
            } else if (val.length > _d.fieldLength.filename) {
              return '名称过长';
            } else if (!isFilename(val)) {
              return '名称包含了不允许的特殊字符';
            }
          },
        },
      },
    },
    async function ({ close, inp, loading, isDiff }) {
      try {
        if (!isDiff()) return;
        let name = inp.name;
        loading.start();
        const res = await reqFileRename({ data: obj, name });
        loading.end();
        if (res.code === 1) {
          updateCurPage();
          close();
          cb && cb();
          _msg.success(res.codeText);
        }
      } catch {
        loading.end();
      }
    },
    `重命名${obj.type === 'file' ? '文件' : '文件夹'}`
  );
}
// 显示/隐藏粘贴
function showPaste() {
  $header
    .find('.paste_btn')
    .html(
      _tpl(
        `<span cursor="y" class="type iconfont {{waitObj.type==='copy'?'icon-fuzhi':'icon-jiandao'}}"></span>
        <span cursor="y" class="text">粘贴({{waitObj.data.length}})</span>
        <span cursor="y" class="close iconfont icon-close-bold"></span>`,
        { waitObj }
      )
    )
    .css('display', 'block');
}
function hidePaste() {
  $header.find('.paste_btn').css('display', 'none');
}
document.addEventListener('keydown', function (e) {
  if (!editFileIsHiden()) return;
  const key = e.key,
    ctrl = e.ctrlKey || e.metaKey;
  const isFocus = $('input').is(':focus') || $('textarea').is(':focus');
  if (isFocus) return;
  if (ctrl && key === 'a') {
    e.preventDefault();
    if (!isSelecting()) {
      startCheck();
    }
    switchCheckAll($footer.find('span')[0]);
  } else if (ctrl && key === 'v') {
    const { type, data } = waitObj;
    if (type === 'copy') {
      hdCopy(false, data);
    } else if (type === 'cut') {
      hdCut(false, data);
    }
  }
  const data = getCheckDatas();
  if (data.length === 0) return;
  if (ctrl && key === 'c') {
    waitObj = {
      type: 'copy',
      data,
    };
    realtime.send({ type: 'pastefiledata', data: waitObj });
    showPaste();
    closeCheck();
  } else if (ctrl && key === 'x') {
    waitObj = {
      type: 'cut',
      data,
    };
    realtime.send({ type: 'pastefiledata', data: waitObj });
    showPaste();
    closeCheck();
  }
});
// 手势右划后退
_mySlide({
  el: '.content_wrap',
  right() {
    if (!isSelecting()) {
      curmb.hashRouter.back();
    }
  },
  left() {
    if (!isSelecting()) {
      curmb.hashRouter.forward();
    }
  },
});
