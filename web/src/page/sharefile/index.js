import $ from 'jquery';
import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import '../file/index.less';
import './index.less';
import '../../js/common/common';
import {
  LazyLoad,
  _myOpen,
  formatBytes,
  copyText,
  downloadFiles,
  enterPassCode,
  fileLogoType,
  formatDate,
  getFilePath,
  getScreenSize,
  getTextImg,
  imgjz,
  isImgFile,
  isMobile,
  isVideoFile,
  longPress,
  myOpen,
  pageErr,
  queryURLParams,
  pageScrollTop,
  userLogoMenu,
  wrapInput,
  loadImg,
  _mySlide,
  isIframe,
  getDateDiff,
} from '../../js/utils/utils';
import pagination from '../../js/plugins/pagination';
import _msg from '../../js/plugins/message';
import _d from '../../js/common/config';
import curmb from '../file/crumb/index';
import { openFile, setReadOnly } from '../file/edit';
import bus from '../../js/utils/bus';
import loadfailImg from '../../images/img/loadfail.png';
import { reqFileGetShare, reqFileReadDir, reqFileReadFile } from '../../api/file';
import toolTip from '../../js/plugins/tooltip';
import { showFileInfo } from '../../js/utils/showinfo';
import rMenu from '../../js/plugins/rightMenu';
import { _tpl } from '../../js/utils/template';
import _path from '../../js/utils/path';
import { addTask } from '../file/task';
import { imgCache } from '../../js/utils/imgCache';
import imgPreview from '../../js/plugins/imgPreview';
import realtime from '../../js/plugins/realtime';
import { otherWindowMsg, waitLogin } from '../home/home';
import localData from '../../js/common/localData';
import captcha from '../../js/plugins/captcha';
const $contentWrap = $('.content_wrap');
const $pagination = $('.pagination');
const $curmbBox = $('.crumb_box');
const $search = $('.search');
const $header = $('.header');
const $shareInfo = $('.share_info');
const $fileBox = $('.file_box');
let pageSize = localData.get('filesPageSize');
let curFileDirPath = curmb.getHash();
let fileShowGrid = localData.get('fileShowGrid');
let hiddenFile = localData.get('hiddenFile');
let fileSort = localData.get('fileSort'); // 排序
let subDir = localData.get('searchFileSubDir'); // 搜索子目录
const urlparmes = queryURLParams(myOpen()),
  shareId = urlparmes.s;
if (!shareId) {
  pageErr();
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
let passCode = localData.session.get('passCode', shareId) || '';
let shareToken = '';
let shareObj = {};
let uObj = {};
let captchaId = '';
let isCaptcha = false;
setReadOnly(true); // 只读
enterPassCode(({ close, val, loading, submit }) => {
  passCode = val;
  if (isCaptcha) return;
  loading.start();
  reqFileGetShare({ id: shareId, pass: passCode, captchaId })
    .then((res) => {
      if (res.code === 1) {
        const { username, logo, account, data, exp_time, title, email, token, needCaptcha, id } =
          res.data;
        if (needCaptcha) {
          isCaptcha = true;
          captcha(id, {
            success({ id }) {
              captchaId = id;
              submit();
            },
            close() {
              isCaptcha = false;
            },
          });
        } else {
          localData.session.set('passCode', passCode, shareId); // 缓存
          close && close();
          shareToken = token;
          uObj = { username, account, email };
          shareObj = data;
          if (logo) {
            imgjz(getFilePath(`/logo/${account}/${logo}`))
              .then((cache) => {
                $shareInfo.find('.logo').css('background-image', `url(${cache})`);
              })
              .catch(() => {
                $shareInfo.find('.logo').css('background-image', `url(${getTextImg(username)})`);
              });
          } else {
            $shareInfo.find('.logo').css('background-image', `url(${getTextImg(username)})`);
          }

          $shareInfo.find('.from').text(username);
          $shareInfo.find('.title').text(title);
          $shareInfo.find('.valid').text(
            exp_time === 0
              ? '永久'
              : formatDate({
                  template: '{0}-{1}-{2} {3}:{4}',
                  timestamp: exp_time,
                }),
          );
          if (data.type === 'file') {
            $contentWrap.remove();
            $pagination.remove();
            $curmbBox.remove();
            $search.remove();
            $header.remove();
            const [a, , b] = _path.extname(data.name);
            $fileBox.find('.name').html(
              _tpl(
                `
                        <template>
                        {{a}}<span class="suffix">{{b?'.'+b:''}}</span>
                        </template>
                        `,
                { a, b },
              ),
            );
            $fileBox.find('.download').text(`下载 (${formatBytes(data.size)})`);
            if (isImgFile(data.name)) {
              const url = getFilePath(`/sharefile/${data.path}/${data.name}`, {
                w: 256,
                token: shareToken,
              });
              loadImg(url)
                .then((img) => {
                  $fileBox.find('.logo').html(img);
                })
                .catch((img) => {
                  img.src = loadfailImg;
                  $fileBox.find('.logo').html(img);
                });
            } else {
              $fileBox
                .find('.logo')
                .attr('class', `logo iconfont ${fileLogoType(data.name, data.size)}`);
            }
            $shareInfo.addClass('open');
            $fileBox.addClass('open');
          } else if (data.type === 'dir') {
            $fileBox.remove();
            updateCurPage();
          }
        }
      } else if (res.code === 3) {
        _msg.error('提取码错误');
      }
    })
    .catch(() => {})
    .finally(() => {
      loading.end();
    });
}, passCode)();
// 更改显示隐藏文件模式
function changeHiddenFileModel() {
  $header
    .find('.h_hidden_file_btn')
    .attr(
      'class',
      `h_btn h_hidden_file_btn iconfont ${hiddenFile ? 'icon-kejian' : 'icon-bukejian'}`,
    );
}
changeHiddenFileModel();
// 显示模式
function changeListShowModel() {
  $header
    .find('.h_showmodel_btn')
    .attr(
      'class',
      `h_btn h_showmodel_btn iconfont ${fileShowGrid ? 'icon-liebiao1' : 'icon-liebiao'}`,
    );
  $contentWrap.find('.container').attr('class', `container ${fileShowGrid ? 'grid' : ''}`);
}
changeListShowModel();
let pageNo = 1;
// 面包屑
curmb.bind($curmbBox.find('.container')[0], (path, param) => {
  if (param.pageNo) {
    pageNo = param.pageNo;
  }
  if (path !== curFileDirPath) {
    curFileDirPath = path;
    wInput.setValue('');
  }
  openDir(curFileDirPath, param);
});
// 搜索子目录状态
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
    wInput.focus();
    localData.set('searchFileSubDir', subDir);
  });
function openSearch() {
  $search.stop().slideDown(_d.speed, () => {
    wInput.focus();
  });
}
function closeSearch() {
  if (wInput.getValue()) {
    wInput.setValue('');
    updateCurPage();
  }
  $search.stop().slideUp(_d.speed);
}
// 生成列表
async function renderList(top) {
  const html = _tpl(
    `
    <template v-if="total > 0">
      <ul v-for="{type,fileType,name,size,time,id,mode,uid,gid,linkTarget,linkTargetTypeName} in paging.list" class="file_item" :data-id="id">
        <li class="check_state" check="n"></li>
        <li cursor="y" class="logo {{logoColor(type, fileType)}} iconfont {{getLogo(name,type,size) || 'is_img'}}"></li>
        <li cursor="y" class="name">
          <span class="text">{{getText(name,type).a}}
            <span class="suffix">{{getText(name,type).b}}</span>
            <span v-if="type === 'file' && fileType === 'symlink'" class="link_target">=> {{linkTarget}}({{linkTargetTypeName}})</span>
          </span>
        </li>
        <li v-if="mode" class='mode'>{{mode}} {{uid}}:{{gid}}</li>
        <li class="size">{{size ? formatBytes(size) : '--'}}</li>
        <li class="date">{{getDateDiff(time)}}</li>
      </ul>
      <i v-for="item in 10" class='fill'></i>
    </template>
    <p v-else>{{_d.emptyList}}</p>
    `,
    {
      total: fileListData.total,
      _d,
      paging: { list: fileListData.data },
      getDateDiff,
      formatBytes,
      logoColor(type, fileType) {
        if (type === 'dir') return type;
        if (type === 'file' && (fileType === 'symlink' || fileType === 'file')) return '';
        return 'other';
      },
      getLogo(name, type, size) {
        let logo = '';
        if (!isImgFile(name)) {
          if (type === 'file') {
            logo = fileLogoType(name, size);
          } else {
            logo = 'icon-gl-folder';
          }
        }
        return logo;
      },
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
    },
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
  $shareInfo.addClass('open');
  $contentWrap.addClass('open');
  $pagination.addClass('open');
  $curmbBox.addClass('open');
  $header.addClass('open');
  const logos = [...$contentWrap[0].querySelectorAll('.logo.is_img')].filter((item) => {
    const $item = $(item);
    const { path, name } = getFileItem($item.parent().data('id'));
    if (isImgFile(name)) {
      const url = getFilePath(`/sharefile/${path}/${name}`, {
        w: 256,
        token: shareToken,
      });
      const cache = imgCache.get(url);
      if (cache) {
        $item.css('background-image', `url(${cache})`);
      }
      return !cache;
    }
    return false;
  });
  lazyImg.bind(logos, async (item) => {
    const $item = $(item);
    const { path, name } = getFileItem($item.parent().data('id'));
    if (isImgFile(name)) {
      const url = getFilePath(`/sharefile/${path}/${name}`, {
        w: 256,
        token: shareToken,
      });
      loadImg(url)
        .then(() => {
          $item.css('background-image', `url(${url})`);
          imgCache.add(url, url);
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
let fileListData = { data: [] };
// 打开目录
async function openDir(path, { top, update = 0 }) {
  try {
    localData.session.set('curFileDirPath', path);
    const res = await reqFileReadDir({
      path,
      pageNo,
      pageSize,
      sortType: fileSort.type,
      isDesc: fileSort.isDes ? 1 : 0,
      subDir: subDir ? 1 : 0,
      word: wInput.getValue().trim(),
      token: shareToken,
      update,
      hidden: hiddenFile ? 1 : 0,
    });
    if (res.code === 1) {
      const taskKey = res.data.key;
      if (taskKey) {
        addTask(taskKey, updateCurPage, shareToken);
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
function getFileItem(id) {
  return fileListData.data.find((item) => item.id === id + '') || {};
}
async function readFileAndDir(obj, e) {
  const { type, name, path } = obj;
  const p = `${path}/${name}`;
  if (
    type === 'dir' ||
    (type === 'file' &&
      obj.fileType === 'symlink' &&
      obj.linkTargetType === 'dir' &&
      obj.linkTarget)
  ) {
    updatePageInfo();
    curmb.toGo(p, { pageNo: 1, top: 0 });
  } else if (type === 'file') {
    try {
      const res = await reqFileReadFile({
        path: p,
        token: shareToken,
      });
      if (res.code === 1) {
        if (res.data.type === 'text') {
          openFile(res.data.data, p);
        } else if (res.data.type === 'other') {
          const fPath = getFilePath(`/sharefile/${p}`, { token: shareToken });
          if (isImgFile(p)) {
            const list = fileListData.data.filter(
              (item) => item.type === 'file' && isImgFile(item.name),
            );
            const arr = list.map((item) => {
              const p = `${item.path}/${item.name}`;
              return {
                u1: getFilePath(`/sharefile/${p}`, { token: shareToken }),
                u2: getFilePath(`/sharefile/${p}`, {
                  w: 256,
                  token: shareToken,
                }),
              };
            });
            if (arr.length === 0) return;
            imgPreview(
              arr,
              list.findIndex((item) => item.id === obj.id),
              { x: e.clientX, y: e.clientY },
            );
          } else if (isVideoFile(p)) {
            _myOpen(`/videoplay#${encodeURIComponent(fPath)}`, obj.name, 'video');
          } else if (/(\.mp3|\.aac|\.wav|\.ogg)$/gi.test(p)) {
            _myOpen(fPath, obj.name, 'music');
          } else {
            downloadFiles([{ fileUrl: fPath, filename: name }]);
          }
        }
      }
    } catch {}
  }
}
$fileBox
  .on('click', '.name', readFile)
  .on('click', '.logo', readFile)
  .on('click', '.download', function () {
    const p = `/sharefile/${shareObj.path}/${shareObj.name}`;
    const fPath = getFilePath(p, { token: shareToken });
    downloadFiles([{ fileUrl: fPath, filename: shareObj.name }]);
  });
// 读取文件
async function readFile(e) {
  if (shareObj.type === 'file') {
    try {
      const res = await reqFileReadFile({
        token: shareToken,
      });
      if (res.code === 1) {
        if (res.data.type === 'text') {
          openFile(res.data.data, shareObj.name);
        } else if (res.data.type === 'other') {
          const fPath = getFilePath(`/sharefile/${shareObj.path}/${shareObj.name}`, {
            token: shareToken,
          });
          if (isImgFile(shareObj.name)) {
            imgPreview(
              [
                {
                  u1: fPath,
                  u2: getFilePath(`/sharefile/${shareObj.path}/${shareObj.name}`, {
                    w: 256,
                    token: shareToken,
                  }),
                },
              ],
              0,
              { x: e.clientX, y: e.clientY },
            );
          } else if (isVideoFile(shareObj.name)) {
            _myOpen(`/videoplay#${encodeURIComponent(fPath)}`, shareObj.name, 'video');
          } else if (/(\.mp3|\.aac|\.wav|\.ogg)$/gi.test(shareObj.name)) {
            _myOpen(fPath, shareObj.name, 'music');
          } else {
            downloadFiles([{ fileUrl: fPath, filename: shareObj.name }]);
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
      rightList(e, getFileItem(id));
    }
  })
  .on('click', '.name', function (e) {
    const id = this.parentNode.dataset.id;
    if (fileShowGrid) {
      rightList(e, getFileItem(id));
    } else {
      readFileAndDir(getFileItem(id), e);
    }
  })
  .on('click', '.mode', function (e) {
    const id = this.parentNode.dataset.id;
    showFileInfo(e, getFileItem(id));
  })
  .on('click', '.date', function (e) {
    const id = this.parentNode.dataset.id;
    showFileInfo(e, getFileItem(id));
  })
  .on('mouseenter', '.file_item .name', function () {
    const {
      name,
      fileType,
      linkTarget,
      type,
      path,
      mode,
      size,
      time,
      uid,
      gid,
      fileTypeName,
      linkTargetTypeName,
    } = getFileItem($(this).parent().attr('data-id'));
    const str = `名称：${name}\n类型：${type === 'dir' ? '文件夹' : '文件'}${
      type === 'file' && fileType !== 'file' ? `(${fileTypeName})` : ''
    }\n路径：${path}${
      type === 'file' && fileType === 'symlink' ? ` => ${linkTarget}(${linkTargetTypeName})` : ''
    }${
      mode ? `\n权限：${mode}\n用户ID：${uid}\n用户组ID：${gid}` : ''
    }\n大小：${size ? formatBytes(size) : '--'}\n更新时间：${formatDate({
      template: '{0}-{1}-{2} {3}:{4}',
      timestamp: time,
    })}`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.file_item .name', function () {
    toolTip.hide();
  })
  .on('contextmenu', '.file_item', function (e) {
    e.preventDefault();
    if (isMobile()) return;
    rightList(e, getFileItem(this.dataset.id));
  });
longPress($contentWrap[0], '.file_item', function (e) {
  const ev = e.changedTouches[0];
  rightList(ev, getFileItem(this.dataset.id));
});
// 菜单
function rightList(e, obj) {
  let data = [];
  if (obj.type === 'file') {
    data.push(
      {
        id: 'download',
        text: '下载',
        beforeIcon: 'iconfont icon-download',
      },
      {
        id: 'copy',
        text: '复制链接',
        beforeIcon: 'iconfont icon-link1',
      },
    );
  }
  data.push({
    id: 'info',
    text: '属性',
    beforeIcon: 'iconfont icon-about',
  });
  rMenu.selectMenu(
    e,
    data,
    ({ e, id, close }) => {
      if (id === 'copy') {
        close();
        copyText(
          getFilePath(
            `/sharefile/${obj.path}/${obj.name}`,
            {
              token: shareToken,
            },
            1,
          ),
        );
      } else if (id === 'download') {
        close();
        downloadFiles([
          {
            fileUrl: getFilePath(`/sharefile/${obj.path}/${obj.name}`, {
              token: shareToken,
            }),
            filename: obj.name,
          },
        ]);
      } else if (id === 'info') {
        showFileInfo(e, obj);
      }
    },
    obj.name,
  );
}
$shareInfo.on('click', '.logo', function (e) {
  const { account, username, email } = uObj;
  userLogoMenu(e, account, username, email);
});
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
    '选择列表排序方式',
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
  .on('click', '.h_history', (e) => {
    const data = localData.get('fileHistory').map((item, idx) => {
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
      '历史目录',
    );
  })
  .on('click', '.h_sort_btn', hdFileSort);
// 手势右划后退
_mySlide({
  el: '.content_wrap',
  right() {
    curmb.hashRouter.back();
  },
  left() {
    curmb.hashRouter.forward();
  },
});
