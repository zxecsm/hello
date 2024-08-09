import $ from 'jquery';
import {
  _getTarget,
  _mySlide,
  _position,
  debounce,
  encodeHtml,
  getPageScrollTop,
} from '../../js/utils/utils';
import _d from '../../js/common/config';
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
export function showNoteDir() {
  $noteDirWrap.addClass('open');
}
export function createNoteDir($box) {
  const treeData = toTree($box[0]);
  const $allH = $box.find('h1,h2,h3,h4,h5,h6');
  let str = '';
  let num = 1;
  if ($allH.length < 1) return false;
  (function next(data, level) {
    data.forEach((item) => {
      const text = encodeHtml(item.node.innerText);
      const id = `hello_${num++}`;
      item.node.id = id;
      str += `<li title="${text}" cursor h="${level}" data-id="${id}">
      <span style="${
        item.children.length === 0 ? 'opacity:0;' : ''
      }" class="icon iconfont icon-page-next"></span>
      <span class="text">${text}</span>
      </li>`;
      if (item.children.length > 0) {
        str += `<ul data-show="n">`;
        next(item.children, level + 1);
        str += '</ul>';
      }
    });
  })(treeData, 1);
  $listBox.html(str);

  const $allLi = $noteDirWrap.find('li');
  document.addEventListener('click', function (e) {
    if (!_getTarget(this, e, '.note_dir_wrap')) {
      $noteDirWrap.removeClass('open');
    }
  });
  $noteDirWrap.on('click', 'li', function () {
    const $this = $(this);
    $allLi.removeClass('active');
    $this.addClass('active');
    const id = $this.attr('data-id'),
      $curH = $box.find(`#${id}`),
      _top = _position($curH[0], true).top + getPageScrollTop();
    // setPageScrollTop(_top - 60);
    window.scrollTo({
      top: _top - 60,
      behavior: 'smooth',
    });
    const $ul = $this.next();
    const isShow = $ul.attr('data-show');
    if (!isShow) return;
    const $icon = $this.find('.icon');
    if (isShow === 'y') {
      $icon.attr('class', 'icon iconfont icon-page-next');
      $ul.stop().slideUp(_d.speed).attr('data-show', 'n');
    } else {
      $icon.attr('class', 'icon iconfont icon-Down');
      $ul.stop().slideDown(_d.speed).attr('data-show', 'y');
    }
  });
  // 手势关闭
  _mySlide({
    el: '.note_dir_wrap',
    right() {
      $noteDirWrap.removeClass('open');
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
            $icon.attr('class', 'icon iconfont icon-Down');
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
  return hdNoteDirPosition;
}
