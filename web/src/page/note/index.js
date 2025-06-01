import $ from 'jquery';
import '../../font/iconfont.css';
import '../../css/common/common.css';
import './index.less';
import './md.less';
import {
  queryURLParams,
  myOpen,
  _setTimeout,
  throttle,
  debounce,
  copyText,
  _position,
  _myOpen,
  pageScrollTop,
  pageErr,
  getDateDiff,
  formatNum,
  showQcode,
  isIframe,
  percentToValue,
  getTextImg,
  wrapInput,
  userLogoMenu,
  noteReadInfo,
  formatDate,
  imgjz,
  LazyLoad,
  isDarkMode,
  getDarkIcon,
} from '../../js/utils/utils';
import _d from '../../js/common/config';
import '../../js/common/common';
import _msg from '../../js/plugins/message';
import HighlightWord from './highlightWord';
import realtime from '../../js/plugins/realtime';
import gqImg from '../../images/img/gqimg.png';
import { reqNoteCategory, reqNoteRead } from '../../api/note';
import { createNoteDir, toggleNoteDir } from './noteDir';
import rMenu from '../../js/plugins/rightMenu';
import MdWorker from '../../js/utils/md.worker.js';
import loadingPage from '../../js/plugins/loading/index.js';
import { _tpl } from '../../js/utils/template.js';
import _path from '../../js/utils/path.js';
import imgPreview from '../../js/plugins/imgPreview/index.js';
import { otherWindowMsg, timeMsg, waitLogin } from '../home/home.js';
import localData from '../../js/common/localData.js';
const mdWorker = new MdWorker();
let urlparmes = queryURLParams(myOpen()),
  HASH = urlparmes.HASH;
let hdNoteDirPosition = () => {};
const $setBtnsWrap = $('.set_btns_wrap'),
  $contentWrap = $('.content_wrap'),
  $themeCss = $('.theme_css'),
  $noteInfo = $contentWrap.find('.note_info'),
  $noteBox = $contentWrap.find('.note_box'),
  $pageSearchWrap = $('.page_search_wrap'),
  $authorInfo = $contentWrap.find('.author_info'),
  $fillBox = $contentWrap.find('.fill_box');
let noteFontSize = localData.get('noteFontSize'),
  noteWiden = localData.get('noteWiden'),
  highlightnum = 0,
  $highlightWords = [],
  titleName = '';
// 加宽
if (noteWiden) {
  $contentWrap.addClass('big');
}
export function getContentW() {
  return $contentWrap.outerWidth();
}
export function contentWrapCenterState(toCenter) {
  if (toCenter) {
    $contentWrap.addClass('center');
  } else {
    $contentWrap.removeClass('center');
  }
}
contentWrapCenterState(1);
// 显示搜索
function showSearchBox() {
  $pageSearchWrap.css('display', 'flex');
}
$setBtnsWrap
  .on('click', '.edit_note_btn', function (e) {
    e.stopPropagation();
    _myOpen(`/edit#${encodeURIComponent(urlparmes.v)}`, titleName);
  })
  .on('click', '.to_top_btn', function () {
    pageScrollTop(0);
  })
  .on('click', '.show_search_wrap', () => {
    showSearchBox();
    hdSearchWord();
    searchInp.focus();
    searchInp.select();
  })
  .on('click', '.change_theme_btn', function () {
    let dark = localData.get('dark');
    // 切换黑暗模式
    if (dark === 'y') {
      dark = 'n';
      _msg.success('关闭黑暗模式');
    } else if (dark === 'n') {
      dark = 's';
      _msg.success('跟随系统');
    } else if (dark === 's') {
      dark = 'y';
      _msg.success('开启黑暗模式');
    }
    localData.set('dark', dark);
  })
  .on('click', '.note_box_width', function () {
    if (!noteWiden) {
      noteWiden = true;
      $contentWrap.addClass('big');
      localData.set('noteWiden', noteWiden);
    } else {
      noteWiden = false;
      $contentWrap.removeClass('big');
      localData.set('noteWiden', noteWiden);
    }
  })
  .on('click', '.font_size_btn', (e) => {
    rMenu.percentBar(e, noteFontSize, (percent) => {
      $contentWrap.css({
        'font-size': percentToValue(12, 30, percent),
      });
      noteFontSize = percent;
      localData.set('noteFontSize', noteFontSize, 200);
    });
  })
  .on('click', '.show_navigation_btn', () => {
    toggleNoteDir();
    hdNoteDirPosition && hdNoteDirPosition();
  })
  .on('click', '.show_erweima_btn', (e) => {
    showQcode(e, myOpen()).catch(() => {});
  })
  .on('click', '.copy_md_btn', (e) => {
    const data = [
      { id: 'md', text: 'Markdown' },
      { id: 'html', text: 'HTML' },
    ];
    rMenu.selectMenu(
      e,
      data,
      ({ close, id }) => {
        close();
        let text = '';
        if (id === 'html') {
          text = noteObj.html;
        } else if (id === 'md') {
          text = noteObj.md;
        }
        copyText(text);
      },
      '复制笔记'
    );
  })
  .on('click', '.set_btn', () => {
    $setBtnsWrap.find('.set_top').stop().slideToggle();
  });
const noteObj = {};
let noteInfo = {};
const highlightWord = new HighlightWord($noteBox[0]);
if (urlparmes.v) {
  reqNoteRead({ v: urlparmes.v })
    .then((result) => {
      if (result.code === 1) {
        const { title, content, account, username, logo, category, email } =
          result.data;
        noteInfo = result.data;
        noteObj.md = content;
        titleName = title;
        _setTimeout(() => {
          if (isIframe()) {
            try {
              // 更新标题
              window.parent.openInIframe.iframes
                .get(window.iframeId)
                .updateTitle(titleName);
            } catch {}
          }
        }, 1000);
        $authorInfo._uobj = {
          account,
          username,
          email,
        };
        waitLogin(() => {
          realtime.init().add((res) => {
            res.forEach((item) => {
              if (account === localData.get('account')) {
                const {
                  type,
                  data: { flag, id },
                } = item;
                if (
                  type === 'updatedata' &&
                  ((flag === 'note' && urlparmes.v === id) ||
                    (flag === 'category' && category.includes(id)))
                ) {
                  window.location.reload();
                }
              }
              otherWindowMsg(item);
            });
          });
        });

        if (logo) {
          imgjz(_path.normalize(`/api/pub/logo/${account}/${logo}`))
            .then((cache) => {
              $authorInfo
                .find('.logo')
                .attr('title', username)
                .css('background-image', `url(${cache})`);
            })
            .catch(() => {
              $authorInfo
                .find('.logo')
                .attr('title', username)
                .css('background-image', `url(${getTextImg(username)})`);
            });
        } else {
          $authorInfo
            .find('.logo')
            .attr('title', username)
            .css('background-image', `url(${getTextImg(username)})`);
        }
        mdWorker.postMessage(content);
        $noteInfo.find('h1').text(title);
        document.title = title;
      }
    })
    .catch(() => {
      pageErr();
    });
} else {
  pageErr();
}
function updateNoteInfo(
  { create_at, visit_count, update_at, category, account } = {},
  content
) {
  if (!['about', 'tips'].includes(urlparmes.v)) {
    const readInfo = noteReadInfo(content);
    const $headInfo = $noteInfo.find('div');
    $headInfo.html(
      _tpl(
        `
          <span>创建：{{formatDate({template: '{0}-{1}-{2}',timestamp: create_at})}}</span>
          <span class="iconfont icon-fenge"></span><span :title="formatDate({template: '{0}-{1}-{2}',timestamp: update_at || create_at})">更新：{{getDateDiff(update_at || create_at)}}</span>
          <span class="iconfont icon-fenge"></span><span>查看：{{formatNum(visit_count)}}</span>
          <span class="iconfont icon-fenge"></span><span>字数：{{readInfo.word}}</span>
          <span class="iconfont icon-fenge"></span><span>阅读：{{readInfo.time === 1 ? '小于' : '约'}} {{readInfo.time}} 分钟</span>
          `,
        {
          formatDate,
          create_at,
          visit_count,
          getDateDiff,
          formatNum,
          readInfo,
          update_at,
        }
      )
    );
    if (category) {
      reqNoteCategory({ account })
        .then((res) => {
          if (res.code === 1) {
            const list = res.data.filter((item) => category.includes(item.id));
            const html = _tpl(
              `
              <span class="iconfont icon-fenge"></span><span>分类：</span>
              <span v-for="{id, title} in list" cursor="y" class="category" :data-id="id">{{title}}</span>
              `,
              {
                list,
              }
            );
            $headInfo.append(html);
          }
        })
        .catch(() => {});
    }
  }
}
mdWorker.addEventListener('message', (event) => {
  mdWorker.terminate();
  noteObj.html = event.data;
  $noteBox.html(event.data);
  updateNoteInfo(noteInfo, $noteBox.text());
  hdNoteDirPosition = createNoteDir($noteBox);
  if (!hdNoteDirPosition) {
    $setBtnsWrap.find('.show_navigation_btn').remove();
  }
  loadingPage.end();
  if (!isIframe()) {
    timeMsg();
  }
  $setBtnsWrap.addClass('open');
  $contentWrap.addClass('open');
  if (HASH) {
    HASH = decodeURIComponent(HASH);
    showSearchBox();
    searchInp.setValue(HASH);
  }
  imgLazy.bind($noteBox[0].querySelectorAll('img'), (item) => {
    const url = item.getAttribute('data-src');
    imgjz(url)
      .then((cache) => {
        item.src = cache;
      })
      .catch(() => {
        item.src = gqImg;
      });
  });
});
const imgLazy = new LazyLoad();
$authorInfo.on('click', '.logo', function (e) {
  const { account, username, email } = $authorInfo._uobj;
  userLogoMenu(e, account, username, email);
});
$noteInfo.on('click', '.category', function () {
  const id = $(this).data('id');
  const { account, username } = $authorInfo._uobj;
  const url = `/notes?acc=${encodeURIComponent(account)}#${id}`;
  if (isIframe()) {
    _myOpen(url, username + '的笔记本');
  } else {
    myOpen(url);
  }
});
$noteBox
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
    hdWindowScroll();
  })
  .on('click', 'img', function () {
    const imgs = $noteBox.find('img');
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
    imgPreview(arr, idx);
  });
const searchInp = wrapInput($pageSearchWrap.find('.inp_box .search_inp')[0], {
  focus() {
    $pageSearchWrap.find('.inp_box').addClass('focus');
  },
  blur() {
    $pageSearchWrap.find('.inp_box').removeClass('focus');
  },
  update(val) {
    if (val) {
      $pageSearchWrap.find('.inp_box .clear').css('display', 'block');
    } else {
      $pageSearchWrap.find('.inp_box .clear').css('display', 'none');
    }
    val = val.trim();
    myOpen(`#${val ? encodeURIComponent(val) : ''}`);
    hdSearchWord();
  },
  keydown(e) {
    const key = e.key;
    if (key === 'Enter') {
      nextPrevSearch(1);
      e.preventDefault();
    }
  },
});
// 搜索高亮
const hdSearchWord = debounce(function () {
  $pageSearchWrap.find('.res_total_num').text(``);
  const val = searchInp.getValue();
  if (!val) {
    highlightWord.init();
    return;
  }
  highlightWord.highlight(val);
  $highlightWords = $noteBox.find('span.highlight_word');
  const _length = $highlightWords.length;
  highlightnum = 0;
  if (_length > 0) {
    $pageSearchWrap
      .find('.res_total_num')
      .text(`${highlightnum + 1}/${_length}`);
    highlightPosition(highlightnum);
  }
}, 500);
$pageSearchWrap
  .on('click', (e) => {
    const target = e.target;
    if (target.tagName === 'DIV') {
      if ($(target).attr('flag') === 'x') {
        highlightWord.init();
        $pageSearchWrap.css('display', 'none');
      } else {
        if ($(target).attr('flag') === 'next') {
          nextPrevSearch(1);
        } else if ($(target).attr('flag') === 'pre') {
          nextPrevSearch();
        }
      }
    }
  })
  .on('click', '.inp_box .clear', function () {
    searchInp.setValue('').focus();
  })
  .on('mouseenter', '.search_inp', function () {
    this.focus();
  });
function nextPrevSearch(isNext) {
  const _length = $highlightWords.length;
  if (_length === 0) return;
  if (isNext) {
    highlightnum++;
  } else {
    highlightnum--;
  }
  highlightnum >= _length
    ? (highlightnum = 0)
    : highlightnum < 0
    ? (highlightnum = _length - 1)
    : null;
  $pageSearchWrap.find('.res_total_num').text(`${highlightnum + 1}/${_length}`);
  highlightPosition(highlightnum);
}
// 高亮定位
function highlightPosition(num) {
  const pageTop = pageScrollTop();
  const DH = window.innerHeight,
    _top = _position($highlightWords.eq(num)[0], true).top + pageTop;
  $highlightWords.removeClass('active').eq(num).addClass('active');
  if (_top > pageTop && _top < pageTop + DH) {
  } else {
    pageScrollTop(_top - 60);
  }
}
$contentWrap.css({
  'font-size': percentToValue(12, 30, noteFontSize),
});
// 黑暗模式
function changeTheme(dark) {
  $setBtnsWrap
    .find('.change_theme_btn')
    .attr('class', `change_theme_btn iconfont ${getDarkIcon(dark)}`);
  hdTheme(dark);
}
function hdTheme(dark) {
  if (dark === 'y') {
    $themeCss.attr('href', '/css/notethem/notecode1.css');
  } else if (dark === 'n') {
    $themeCss.attr('href', '/css/notethem/notecode.css');
  } else if (dark === 's') {
    if (isDarkMode()) {
      $themeCss.attr('href', '/css/notethem/notecode1.css');
    } else {
      $themeCss.attr('href', '/css/notethem/notecode.css');
    }
  }
}
window.changeTheme = changeTheme;
changeTheme(localData.get('dark'));
window.addEventListener('scroll', hdWindowScroll);
function hdWindowScroll() {
  const p = pageScrollTop();
  if (p >= 60) {
    $authorInfo.addClass('active');
    $fillBox.css('display', 'block');
  } else {
    $authorInfo.removeClass('active');
    $fillBox.css('display', 'none');
  }
  const H = window.innerHeight,
    CH = document.documentElement.scrollHeight - H;
  pagepro(p / CH);
  changeToTopState(p);
}
const changeToTopState = throttle(function (p) {
  if (p <= 100) {
    $setBtnsWrap.find('.to_top_btn').slideUp(_d.speed);
  } else {
    $setBtnsWrap.find('.to_top_btn').slideDown(_d.speed);
  }
}, 500);
const pagepro = (function () {
  const div = document.createElement('div');
  div.style.cssText = `
    width: 0;
    height: 0.3rem;
    position: fixed;
    bottom: 0;
    left: 0;
    border-radio:2rem;
    pointer-events: none;
    background-image: linear-gradient(to right, green, orange);
    z-index: 20;
  `;
  document.body.appendChild(div);
  return function (percent) {
    div.style.width = percent * 100 + '%';
  };
})();
