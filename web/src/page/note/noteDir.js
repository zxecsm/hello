import $ from 'jquery';
import { _mySlide, _position, debounce, getScreenSize } from '../../js/utils/utils';
import { slugifyHeading, decodeHashId } from '../../js/utils/mdSlug.js';
import _d from '../../js/common/config';
import { _tpl } from '../../js/utils/template';
import { contentWrapCenterState, getContentW } from '.';
const $noteDirWrap = $('.note_dir_wrap'),
  $listBox = $noteDirWrap.find('.list_box');

// 滚动到标题锚点。首次加载时页面内容是异步渲染的，
// 浏览器自己按 hash 定位可能失败，需要内容生成后再调用一次。
export function scrollToNoteAnchor(id, smooth = true) {
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({
    behavior: smooth ? 'smooth' : 'auto',
    block: 'start',
  });
}

// 标题生成树结构
function toTree(box) {
  // 祖先
  const root = { node: 'root', children: [] };
  let cur = root;
  // 遍历所有子孙
  box.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((item) => {
    // 生成子孙对象
    const obj = { node: item, children: [] };
    // 找父亲
    while (cur !== root && obj.node.tagName[1] <= cur.node.tagName[1]) {
      cur = cur.parent;
    }
    // 儿子认父亲
    obj.parent = cur;
    // 父亲认儿子
    obj.parent.children.push(obj);
    cur = obj;
  });
  return root.children;
}
export function toggleNoteDir() {
  if ($noteDirWrap.hasClass('open')) {
    hideNoteDir();
  } else {
    showNoteDir();
  }
}
function showNoteDir() {
  contentWrapCenterState(getScreenSize().w > getContentW() + 800);
  $noteDirWrap.addClass('open');
}
function hideNoteDir() {
  contentWrapCenterState(1);
  $noteDirWrap.removeClass('open');
}
export function createNoteDir($box) {
  const treeData = toTree($box[0]);
  const $allH = $box.find('h1,h2,h3,h4,h5,h6');
  if ($allH.length < 1) return false;
  // 优先使用 markdown-it-anchor 根据标题生成的 id；
  // 原始 HTML 标题没有 id 时，用同样的规则补一个
  const usedIds = new Set();
  $allH.each((_, item) => {
    if (item.id) usedIds.add(item.id);
  });
  const fra = _tpl.createFrag();
  (function next(data, level, fra) {
    data.forEach((item) => {
      const text = item.node.textContent;
      let id = item.node.id;
      if (!id) {
        const base = slugifyHeading(text);
        id = base;
        let index = 1;
        while (usedIds.has(id)) {
          id = `${base}-${index++}`;
        }
        item.node.id = id;
      }
      usedIds.add(id);
      const oLi = _tpl.getDom(
        `
        <li :title="text" cursor="y" :h="level" :data-id="id">
          <span :style="item.children.length === 0 ? 'opacity:0;' : ''" class="icon iconfont icon-you"></span>
          <span class="text">{{text}}</span>
        </li>
        `,
        {
          text,
          level,
          id,
          item,
        },
      )[0];
      const oUl = _tpl.getDom(`<ul data-show="n"></ul>`)[0];
      fra.appendChild(oLi);
      fra.appendChild(oUl);
      if (item.children.length > 0) {
        next(item.children, level + 1, oUl);
      }
    });
  })(treeData, 1, fra);
  $listBox.html(fra);

  const $allLi = $noteDirWrap.find('li');
  $noteDirWrap.on('click', 'li', function () {
    const $this = $(this);
    $allLi.removeClass('active');
    $this.addClass('active');
    const id = $this.attr('data-id');
    const $ul = $this.next();
    const isShow = $ul.attr('data-show');
    if (isShow) {
      const $icon = $this.find('.icon');
      if (isShow === 'y') {
        $icon.attr('class', 'icon iconfont icon-you');
        $ul.stop().slideUp(_d.speed).attr('data-show', 'n');
      } else {
        $icon.attr('class', 'icon iconfont icon-xiala');
        $ul.stop().slideDown(_d.speed).attr('data-show', 'y');
      }
    }
    // data-id 就是标题的 id，用 hash 锚点跳转
    if (!id) return;
    if (decodeHashId(location.hash) === id) {
      scrollToNoteAnchor(id);
    } else {
      location.hash = id;
    }
  });
  // 手势关闭
  _mySlide({
    el: '.note_dir_wrap',
    right() {
      hideNoteDir();
    },
  });
  // 目录同步页面滚动，同时让 URL 上的 hash 跟随当前阅读位置
  function hdNoteDirPosition(syncHash) {
    // 最后一个滚动到视口顶部附近的标题，就是当前所在的章节
    const $currentH = $allH.filter((_, item) => _position(item, true).top <= 80).last();

    // 初始化时不改 hash，避免覆盖地址栏里已有的锚点
    if (syncHash) {
      if ($currentH.length > 0) {
        const id = $currentH[0].id;
        if (decodeHashId(location.hash) !== id) {
          try {
            // replaceState 不会触发跳转，也不会新增历史记录
            history.replaceState(null, '', `#${id}`);
          } catch {}
        }
      } else if (location.hash) {
        // 还没滚动到第一个标题时，不保留旧的 hash
        try {
          history.replaceState(null, '', location.pathname + location.search);
        } catch {}
      }
    }

    if (!$noteDirWrap.hasClass('open')) return;
    $allLi.removeClass('active');
    // 页面顶部还没有标题到达时，默认高亮第一个标题
    const $activeH = $currentH.length > 0 ? $currentH : $allH.first();
    if ($activeH.length > 0) {
      const activeId = $activeH[0].id;
      const $targetLi = $listBox
        .find('li')
        .filter((_, item) => item.getAttribute('data-id') === activeId);
      if ($targetLi.length > 0) {
        $targetLi.addClass('active');
        let flag = $targetLi;
        while (flag[0] != $listBox[0]) {
          flag = flag.parent();
          if (flag.attr('data-show') === 'n') {
            const $icon = flag.prev().find('.icon');
            $icon.attr('class', 'icon iconfont icon-xiala');
            flag.stop().slideDown(_d.speed).attr('data-show', 'y');
          }
        }
        $listBox.stop().animate(
          {
            scrollTop:
              $listBox.scrollTop() + _position($targetLi[0], true).top - $noteDirWrap.height() / 4,
          },
          _d.speed,
        );
      }
    }
  }
  window.addEventListener(
    'scroll',
    debounce(() => hdNoteDirPosition(true), 100),
  );
  if (getScreenSize().w > getContentW() + 400) {
    showNoteDir();
    hdNoteDirPosition();
  }

  let curScreenWidth = getScreenSize().w;
  window.addEventListener(
    'resize',
    debounce(() => {
      const screenWidth = getScreenSize().w;
      if (curScreenWidth !== screenWidth) {
        curScreenWidth = screenWidth;
        if ($noteDirWrap.hasClass('open')) {
          showNoteDir();
        }
      }
    }, 200),
  );
  return hdNoteDirPosition;
}
