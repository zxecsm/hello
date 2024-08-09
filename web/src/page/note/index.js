import $ from 'jquery';
import '../../font/iconfont.css';
import '../../css/common/common.css';
import './index.less';
import './md.css';
import {
  queryURLParams,
  myOpen,
  _setData,
  _getData,
  _setTimeout,
  throttle,
  debounce,
  copyText,
  _position,
  _myOpen,
  imgPreview,
  getPageScrollTop,
  pageErr,
  darkMode,
  getDateDiff,
  formatNum,
  showQcode,
  isIframe,
  _progressBar,
  percentToValue,
  getTextImg,
  wrapInput,
  hdPath,
  userLogoMenu,
  noteReadInfo,
  formatDate,
  imgjz,
  LazyLoad,
  isDarkMode,
  encodeHtml,
  wave,
} from '../../js/utils/utils';
import _d from '../../js/common/config';
import '../../js/common/common';
import _msg from '../../js/plugins/message';
import HighlightWord from './highlightWord';
import realtime from '../../js/plugins/realtime';
import gqImg from '../../images/img/gqimg.png';
import { reqNoteCategory, reqNoteRead } from '../../api/note';
import { createNoteDir, showNoteDir } from './noteDir';
import rMenu from '../../js/plugins/rightMenu';
import MdWorker from '../../js/utils/md.worker.js';
import loadingPage from '../../js/plugins/loading/index.js';
import changeDark from '../../js/utils/changeDark.js';
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
_d.isNote = true;
let noteFontSize = _getData('noteFontSize'),
  dark = _getData('dark'),
  noteWiden = _getData('noteWiden'),
  highlightnum = 0,
  $highlightWords = [],
  titleName = '';
// 加宽
if (noteWiden) {
  $contentWrap.addClass('big');
}
// 显示搜索
function showSearchBox() {
  $pageSearchWrap.css('display', 'flex');
}
$setBtnsWrap
  .on('click', '.edit_note_btn', function (e) {
    e.stopPropagation();
    _myOpen(`/edit/#${encodeURIComponent(urlparmes.v)}`, titleName);
  })
  .on('click', '.to_top_btn', function () {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  })
  .on('click', '.show_search_wrap', () => {
    showSearchBox();
    hdSearchWord();
    searchInp.target.focus();
    searchInp.target.select();
  })
  .on('click', '.change_theme_btn', function () {
    // 切换黑暗模式
    if (dark == 'y') {
      dark = 'n';
      _msg.success('关闭黑暗模式');
    } else if (dark == 'n') {
      dark = 's';
      _msg.success('跟随系统');
    } else if (dark == 's') {
      dark = 'y';
      _msg.success('开启黑暗模式');
    }
    changeTheme(dark);
    _setData('dark', dark);
  })
  .on('click', '.note_box_width', function () {
    if (!noteWiden) {
      noteWiden = true;
      $contentWrap.addClass('big');
      _setData('noteWiden', noteWiden);
    } else {
      noteWiden = false;
      $contentWrap.removeClass('big');
      _setData('noteWiden', noteWiden);
    }
  })
  .on('click', '.font_size_btn', (e) => {
    _progressBar(e, noteFontSize, (percent) => {
      $contentWrap.css({
        'font-size': percentToValue(12, 30, percent),
      });
      noteFontSize = percent;
      _setData('noteFontSize', noteFontSize);
    });
  })
  .on('click', '.show_navigation_btn', (e) => {
    e.stopPropagation();
    showNoteDir();
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
const highlightWord = new HighlightWord($noteBox[0]);
if (urlparmes.v) {
  reqNoteRead({ v: urlparmes.v })
    .then((result) => {
      if (parseInt(result.code) === 0) {
        const {
          name,
          data,
          account,
          username,
          time,
          utime,
          logo,
          category,
          email,
          visit_count = 0,
        } = result.data;
        noteObj.md = data;
        const readInfo = noteReadInfo(data);
        titleName = name;
        _setTimeout(() => {
          if (isIframe()) {
            try {
              // 更新标题
              window.parent.openInIframe.hdTitle.updateTitle(
                window.iframeId,
                titleName
              );
              // eslint-disable-next-line no-unused-vars
            } catch (error) {}
          }
        }, 1000);
        $authorInfo._uobj = {
          account,
          username,
          email,
        };
        if (_getData('account') && account === _getData('account')) {
          realtime.init().add((res) => {
            res.forEach((item) => {
              const {
                type,
                data: { flag, id },
              } = item;
              if (
                type === 'updatedata' &&
                flag === 'note' &&
                urlparmes.v === id
              ) {
                window.location.reload();
              }
            });
          });
        }
        const logoUrl = logo
          ? hdPath(`/api/pub/logo/${account}/${logo}`)
          : getTextImg(username);
        imgjz(
          logoUrl,
          () => {
            $authorInfo
              .find('.logo')
              .attr('title', username)
              .css('background-image', `url(${logoUrl})`);
          },
          () => {
            $authorInfo
              .find('.logo')
              .attr('title', username)
              .css('background-image', `url(${getTextImg(username)})`);
          }
        );
        mdWorker.postMessage(data);
        $noteInfo.find('h1').text(name);
        document.title = name;
        if (!['about', 'tips'].includes(urlparmes.v)) {
          const $headInfo = $noteInfo.find('div');
          $headInfo.html(`<span>创建：${formatDate({
            template: '{0}-{1}-{2}',
            timestamp: time,
          })}</span>
          <span class="iconfont icon-fenge"></span><span title='${formatDate({
            template: '{0}-{1}-{2}',
            timestamp: utime || time,
          })}'>更新：${getDateDiff(utime || time)}</span>
          <span class="iconfont icon-fenge"></span><span>阅读量：${formatNum(
            visit_count
          )}</span><span class="iconfont icon-fenge"></span><span>字数：${
            readInfo.word
          }</span><span class="iconfont icon-fenge"></span><span>阅读：约${
            readInfo.time
          }分钟</span>`);
          if (category) {
            reqNoteCategory({ acc: account })
              .then((res) => {
                if (res.code == 0) {
                  let str = `<span class="iconfont icon-fenge"></span><span>分类：</span>`;
                  const list = res.data.filter((item) =>
                    category.includes(item.id)
                  );
                  list.forEach((item) => {
                    const { id, title } = item;
                    str += `<span cursor class="category" data-id="${id}">${encodeHtml(
                      title
                    )}</span>`;
                  });
                  $headInfo.append(str);
                }
              })
              .catch(() => {});
          }
        }
      }
    })
    .catch(() => {
      pageErr();
    });
} else {
  pageErr();
}
mdWorker.addEventListener('message', (event) => {
  mdWorker.terminate();
  noteObj.html = event.data;
  $noteBox.html(event.data);
  const $pre = $noteBox.find('pre');
  $pre.each((_, item) => {
    const $item = $(item);
    $item.append(`<div cursor class="codeCopy iconfont icon-fuzhi"><div>`);
    const $code = $item.find('code');
    if ($code.height() > 400) {
      $code.addClass('hide');
      $item.append(
        '<div data-flag="y" cursor class="shrink iconfont icon-Down"><div>'
      );
    }
  });
  hdNoteDirPosition = createNoteDir($noteBox);
  if (!hdNoteDirPosition) {
    $setBtnsWrap.find('.show_navigation_btn').remove();
  }
  loadingPage.end();
  $setBtnsWrap.addClass('open');
  $contentWrap.addClass('open');
  if (HASH) {
    HASH = decodeURIComponent(HASH);
    showSearchBox();
    searchInp.setValue(HASH);
  }
  imgLazy.bind($noteBox[0].querySelectorAll('img'), (item) => {
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
  const url = `/notes/?acc=${encodeURIComponent(account)}#${id}`;
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
        class: 'shrink iconfont icon-up',
      });
      $this.parent().find('code').removeClass('hide');
    } else {
      $this.attr({
        'data-flag': 'y',
        class: 'shrink iconfont icon-Down',
      });
      $this.parent().find('code').addClass('hide');
    }
  })
  .on('click', 'img', function () {
    const imgs = $noteBox.find('img');
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
const searchInp = wrapInput($pageSearchWrap.find('.inp_box .search_inp')[0], {
  focus() {
    $pageSearchWrap.find('.inp_box').addClass('focus');
  },
  blur() {
    $pageSearchWrap.find('.inp_box').removeClass('focus');
  },
  change(val) {
    val = val.trim();
    if (val) {
      $pageSearchWrap.find('.inp_box .clear').css('display', 'block');
    } else {
      $pageSearchWrap.find('.inp_box .clear').css('display', 'none');
    }
    myOpen(`#${val ? encodeURIComponent(val) : ''}`);
    hdSearchWord();
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
    searchInp.setValue('');
    searchInp.target.focus();
  })
  .on('mouseenter', '.search_inp', function () {
    this.focus();
  })
  .on('keydown', '.search_inp', function (e) {
    const key = e.key;
    if (key === 'Enter') {
      nextPrevSearch(1);
      e.preventDefault();
    }
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
  const pageTop = getPageScrollTop();
  const DH = window.innerHeight,
    _top = _position($highlightWords.eq(num)[0], true).top + pageTop;
  $highlightWords.removeClass('active').eq(num).addClass('active');
  if (_top > pageTop && _top < pageTop + DH) {
  } else {
    window.scrollTo({
      top: _top - 60,
      behavior: 'smooth',
    });
  }
}
$contentWrap.css({
  'font-size': percentToValue(12, 30, noteFontSize),
});
// 黑暗模式
function changeTheme(flag) {
  dark = flag;
  if (dark == 'y') {
    $setBtnsWrap
      .find('.change_theme_btn')
      .attr('class', 'change_theme_btn iconfont icon-icon_yejian-yueliang');
  } else if (dark == 'n') {
    $setBtnsWrap
      .find('.change_theme_btn')
      .attr('class', 'change_theme_btn iconfont icon-taiyangtianqi');
  } else if (dark == 's') {
    $setBtnsWrap
      .find('.change_theme_btn')
      .attr('class', 'change_theme_btn iconfont icon-xianshiqi');
  }
  darkMode(dark);
  hdTheme(dark);
}
function hdTheme(dark) {
  if (dark == 'y') {
    $themeCss.attr('href', '/css/notethem/notecode1.css');
  } else if (dark == 'n') {
    $themeCss.attr('href', '/css/notethem/notecode.css');
  } else if (dark == 's') {
    if (isDarkMode()) {
      $themeCss.attr('href', '/css/notethem/notecode1.css');
    } else {
      $themeCss.attr('href', '/css/notethem/notecode.css');
    }
  }
}
window.changeTheme = changeTheme;
changeTheme(dark);
window.addEventListener('scroll', function () {
  const p = getPageScrollTop();
  if (p >= 60) {
    $authorInfo.addClass('active');
    $fillBox.css('display', 'block');
  } else {
    $authorInfo.removeClass('active');
    $fillBox.css('display', 'none');
  }
});
window.addEventListener(
  'scroll',
  throttle(function () {
    const p = getPageScrollTop();
    if (p <= 100) {
      $setBtnsWrap.find('.to_top_btn').stop().slideUp(_d.speed);
    } else {
      $setBtnsWrap.find('.to_top_btn').stop().slideDown(_d.speed);
    }
    const H = window.innerHeight,
      CH = document.documentElement.scrollHeight - H;
    pagepro(p / CH);
  }, 500)
);
const pagepro = (function () {
  const div = document.createElement('div');
  div.style.cssText = `
    width: 0;
    height: 3px;
    position: fixed;
    bottom: 0;
    left: 0;
    border-radio:20px;
    pointer-events: none;
    transition: width .5s ease-in-out;
    background-image: linear-gradient(to right, green, orange);
    z-index: 20;
  `;
  document.body.appendChild(div);
  return function (percent) {
    div.style.width = percent * 100 + '%';
  };
})();
if (!isIframe()) wave();
changeDark.bind((isDark) => {
  if (_getData('dark') != 's') return;
  const dark = isDark ? 'y' : 'n';
  darkMode(dark);
  hdTheme(dark);
});
