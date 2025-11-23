import $ from 'jquery';
import {
  _mySlide,
  _position,
  debounce,
  pageScrollTop,
  getScreenSize,
} from '../../js/utils/utils';
import _d from '../../js/common/config';
import { _tpl } from '../../js/utils/template';
import { contentWrapCenterState, getContentW } from '.';
const $noteDirWrap = $('.note_dir_wrap'),
  $listBox = $noteDirWrap.find('.list_box');

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
  let num = 1;
  if ($allH.length < 1) return false;
  const fra = _tpl.createFrag();
  (function next(data, level, fra) {
    data.forEach((item) => {
      const text = item.node.textContent;
      const id = `hello_${num++}`;
      item.node.id = id;
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
        }
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
    const id = $this.attr('data-id'),
      $curH = $box.find(`#${id}`),
      _top = _position($curH[0], true).top + pageScrollTop();
    pageScrollTop(_top - 60);
    const $ul = $this.next();
    const isShow = $ul.attr('data-show');
    if (!isShow) return;
    const $icon = $this.find('.icon');
    if (isShow === 'y') {
      $icon.attr('class', 'icon iconfont icon-you');
      $ul.stop().slideUp(_d.speed).attr('data-show', 'n');
    } else {
      $icon.attr('class', 'icon iconfont icon-xiala');
      $ul.stop().slideDown(_d.speed).attr('data-show', 'y');
    }
  });
  // 手势关闭
  _mySlide({
    el: '.note_dir_wrap',
    right() {
      hideNoteDir();
    },
  });
  // 目录同步页面滚动
  function hdNoteDirPosition() {
    if (!$noteDirWrap.hasClass('open')) return;
    $allLi.removeClass('active');
    let $positionTargetH = $allH
      .filter((_, item) => _position(item, true).top >= 0)
      .eq(0);
    $positionTargetH.length > 0 ? null : ($positionTargetH = $allH.last());
    if ($positionTargetH.length > 0) {
      const $targetLi = $listBox.find(`[data-id=${$positionTargetH[0].id}]`);
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
              $listBox.scrollTop() +
              _position($targetLi[0], true).top -
              $noteDirWrap.height() / 4,
          },
          _d.speed
        );
      }
    }
  }
  window.addEventListener('scroll', debounce(hdNoteDirPosition, 100));
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
    }, 200)
  );
  return hdNoteDirPosition;
}
