import $ from 'jquery';
import {
  formatDate,
  toSetSize,
  toCenter,
  _getTarget,
  isMobile,
  myDrag,
  myToMax,
  myToRest,
  myResize,
  _mySlide,
  getScreenSize,
  isValidDate,
  _setTimeout,
  readableTime,
  myOpen,
  isFullScreen,
  getCenterPointDistance,
  _animate,
  savePopLocationInfo,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import _msg from '../../../js/plugins/message';
import { popWindow, setZidx } from '../popWindow.js';
import pagination from '../../../js/plugins/pagination/index.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
import {
  reqCountAdd,
  reqCountDelete,
  reqCountEdit,
  reqCountList,
  reqCountState,
  reqCountTop,
} from '../../../api/count.js';
import toolTip from '../../../js/plugins/tooltip/index.js';
import { showCountInfo } from '../../../js/utils/showinfo.js';
import { hideRightMenu } from '../rightSetting/index.js';
import { hideIframeMask, showIframeMask } from '../iframe.js';
import { changeLogoAlertStatus } from '../index.js';
import { _tpl } from '../../../js/utils/template.js';
import localData from '../../../js/common/localData.js';
const $countBox = $('.count_box'),
  $cheadBtns = $countBox.find('.c_head_btns'),
  $countListWrap = $countBox.find('.count_list_wrap'),
  $countList = $countListWrap.find('.count_list');
let countList = [],
  countPageNo = 1,
  expireCount = 0,
  countPageSize = 40,
  countDownIsTop = localData.get('countDownIsTop'),
  countDownSize = localData.get('countDownSize');
function switchCountDownTop() {
  countDownIsTop = !countDownIsTop;
  setTop();
  localData.set('countDownIsTop', countDownIsTop);
  setZidx($countBox[0], 'count', closeCountBox, countDownIsTop);
}
setTop();
function setTop() {
  if (countDownIsTop) {
    $cheadBtns.find('.top').attr('class', 'top iconfont icon-zhiding1');
  } else {
    $cheadBtns.find('.top').attr('class', 'top iconfont icon-zhiding');
  }
}
// 提醒消息
export function countMsg() {
  if (expireCount === 0) return;
  _msg.msg(
    {
      message: `您有 ${expireCount} 条已到期或即将到期的倒计时`,
      type: 'warning',
      icon: 'iconfont icon-shalou',
      duration: 8000,
    },
    (type) => {
      if (type === 'click') {
        showCountBox();
      }
    }
  );
}
export function setExpireCount(val) {
  if (val === undefined) {
    return expireCount;
  }
  expireCount = val;
  changeLogoAlertStatus();
}
// 加载
function countLoading() {
  let str = '';
  new Array(5).fill(null).forEach(() => {
    let w = Math.round(Math.random() * (90 - 20) + 20);
    str += `<p style="pointer-events: none;background-color:var(--color9);height:3rem;width:100%;margin:1rem 0;"></p>
              ${
                w % 2 === 0
                  ? '<p style="pointer-events: none;background-color:var(--color9);height:3rem;width:100%;margin:1rem 0;"></p>'
                  : ''
              }
              <p style="pointer-events: none;background-color:var(--color9);height:3rem;width:${w}%;margin:1rem 0;"></p>
        `;
  });
  $countList.html(str);
  $countListWrap.scrollTop(0);
}
// 获取列表
export function getCountList(toTop) {
  if (toTop) {
    countLoading();
  }
  reqCountList({ pageNo: countPageNo, pageSize: countPageSize }).then((res) => {
    if (res.code === 1) {
      const { total, pageNo, data, expireCount } = res.data;
      setExpireCount(expireCount);
      countList = data;
      countPageNo = pageNo;
      renderCountList(total, toTop);
    }
  });
}
// 生成列表
function renderCountList(total, toTop) {
  if ($countBox.is(':hidden')) return;
  const html = _tpl(
    `
    <div style="padding-bottom: 1rem;">
      <button cursor="y" class="add_btn btn btn_primary">添加</button>
      <button v-if="hasRemain(countList)" cursor="y" class="clear_btn btn btn_danger">清除已到期</button>
      <button v-if="countList.length > 0" cursor="y" class="clear_all_btn btn btn_danger">清空</button>
    </div>
    <p v-if="total <= 0" style="padding: 2rem 0;pointer-events: none;text-align: center;">暂无倒计时项</p>
    <template v-else>
      <div v-for="{id, title, total:tt, past, remain, link, state, top} in countList" :data-id="id" class="item_box {{state === 0 ? 'close' : ''}}">
        <div class="title">
          <span :cursor="link?'y':''" class="iconfont {{link?'icon-link1':'icon-shalou'}} icon"></span>
          <span class="text">{{title}}</span>
          <span v-if="top != 0" class="top_btn iconfont icon-zhiding"></span>
          <span cursor="y" class="set_btn iconfont icon-maohao"></span>
        </div>
        <div class="info">{{readableTime(tt)}} - {{readableTime(past)}} = <span style="padding-left:0.4rem;" :style="remain<0?'color:var(--btn-danger-color);':''">{{readableTime(remain)}}</span></div>
        <div class="pro">
          <div class="bar">
            <div class="num"></div>
          </div>
        </div>
      </div>
      <div v-html="getPaging()" class="count_paging_box"></div>
    </template>
    `,
    {
      total,
      readableTime,
      countList,
      hasRemain(countList) {
        return countList.some((item) => item.remain <= 0 && item.state === 1);
      },
      getPaging() {
        return countPgnt.getHTML({
          pageNo: countPageNo,
          pageSize: countPageSize,
          total,
          small: getScreenSize().w <= _d.screen,
        });
      },
    }
  );
  $countList.html(html);
  if (toTop) {
    $countListWrap.scrollTop(0);
  }
  _setTimeout(() => {
    $countList.find('.item_box').each((_, item) => {
      const $item = $(item);
      const id = $item.data('id');
      let { percent, state } = getCount(id);
      if (percent < 0) percent = 0;
      if (state === 0) return;
      let bgColor = '';
      let color = '';
      if (percent < 80) {
        bgColor = 'var(--message-success-border)';
        color = 'var(--message-success-color)';
      } else if (percent < 90) {
        bgColor = 'var(--message-warning-border)';
        color = 'var(--message-warning-color)';
      } else {
        bgColor = 'var(--message-error-border)';
        color = 'var(--message-error-color)';
      }
      $item
        .find('.bar')
        .css({ width: `${percent}%`, 'background-color': bgColor, color })
        .find('.num')
        .text(`${percent}%`);
    });
  }, 500);
}
// 分页
const countPgnt = pagination($countList[0], {
  select: [40, 60, 80, 100, 200],
  change(val) {
    countPageNo = val;
    getCountList(true);
    _msg.botMsg(`第 ${countPageNo} 页`);
  },
  changeSize(val) {
    countPageSize = val;
    countPageNo = 1;
    getCountList(true);
    _msg.botMsg(`第 ${countPageNo} 页`);
  },
  toTop() {
    $countListWrap.scrollTop(0);
  },
});
// 获取数据
function getCount(id) {
  return countList.find((item) => item.id === id) || {};
}
// 显示
export function showCountBox() {
  const cBox = $countBox[0];
  hideRightMenu();
  const isHide = $countBox.is(':hidden');
  cBox.style.display = 'flex';
  setZidx(cBox, 'count', closeCountBox, countDownIsTop);
  if (isHide) getCountList(true);
  if (!$countBox._once) {
    $countBox._once = true;
    const { x, y, w, h } = countDownSize;
    toSetSize(cBox, w, h);
    const obj = x && y ? { left: x, top: y } : null;
    toCenter(cBox, obj);
  } else {
    myToRest(cBox, false, false);
  }
  if (isHide) {
    const screen = getScreenSize();
    const { x, y } = getCenterPointDistance(cBox, {
      x: screen.w,
      y: screen.h / 2,
    });
    _animate(cBox, {
      to: {
        transform: `translate(${x}px,${y}px) scale(0)`,
        opacity: 0,
      },
      direction: 'reverse',
    });
  }
}
// 关闭
export function closeCountBox() {
  const cBox = $countBox[0];
  const screen = getScreenSize();
  const { x, y } = getCenterPointDistance(cBox, {
    x: screen.w,
    y: screen.h / 2,
  });
  _animate(
    cBox,
    {
      to: {
        transform: `translate(${x}px,${y}px) scale(0)`,
        opacity: 0,
      },
    },
    (target) => {
      target.style.display = 'none';
      popWindow.remove('count');
      $countList.html('');
    }
  );
}
$cheadBtns
  .on('click', '.c_close_btn', closeCountBox)
  .on('click', '.top', switchCountDownTop)
  .on('click', '.c_refresh_btn', function () {
    getCountList(1);
  });
// 新增
function addCount(e) {
  const today = formatDate({ template: '{0}-{1}-{2}' });
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        title: {
          beforeText: '标题：',
          verify(val) {
            return rMenu.validString(val, 1, _d.fieldLength.countTitle);
          },
        },
        link: {
          beforeText: '链接：',
          placeholder: 'https://',
          verify(val) {
            if (!val) return;
            return (
              rMenu.validString(val, 0, _d.fieldLength.url) ||
              rMenu.validUrl(val)
            );
          },
        },
        start: {
          beforeText: '开始日期：',
          placeholder: 'YYYY-MM-DD',
          value: today,
          inputType: 'date',
          verify(val) {
            if (!isValidDate(val)) {
              return '请输入正确的日期';
            }
          },
        },
        end: {
          beforeText: '结束日期：',
          placeholder: 'YYYY-MM-DD',
          value: today,
          inputType: 'date',
          verify(val) {
            if (!isValidDate(val)) {
              return '请输入正确的日期';
            }
          },
        },
      },
    },
    function ({ close, inp, loading }) {
      if (!verifyDate(inp)) return;
      loading.start();
      reqCountAdd(inp)
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close();
            _msg.success(result.codeText);
            getCountList();
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '新增倒计时'
  );
}
// 删除
function delCount(e, id, cb, loading = { start() {}, end() {} }) {
  let opt = {
      e,
      text: '确认清除：当页已到期倒计时？',
      confirm: { type: 'danger', text: '清除' },
    },
    param = {
      ids: countList.filter((item) => item.remain <= 0).map((item) => item.id),
    };
  if (id) {
    param = { ids: [id] };
    if (id === 'all') {
      param = { ids: countList.map((item) => item.id) };
      opt = {
        e,
        text: '确认清空：当页倒计时？',
        confirm: { type: 'danger', text: '清空' },
      };
    } else {
      opt = {
        e,
        text: '确认删除：倒计时？',
        confirm: { type: 'danger', text: '删除' },
      };
    }
  }
  rMenu.pop(opt, (type) => {
    if (type === 'confirm') {
      loading.start();
      reqCountDelete(param)
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            _msg.success(result.codeText);
            getCountList();
            cb && cb();
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    }
  });
}
// 编辑
function editCount(e, count) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        title: {
          beforeText: '标题：',
          value: count.title,
          verify(val) {
            return rMenu.validString(val, 1, _d.fieldLength.countTitle);
          },
        },
        link: {
          beforeText: '链接：',
          placeholder: 'https://',
          value: count.link,
          verify(val) {
            if (!val) return;
            return (
              rMenu.validString(val, 0, _d.fieldLength.url) ||
              rMenu.validUrl(val)
            );
          },
        },
        start: {
          beforeText: '开始日期：',
          placeholder: 'YYYY-MM-DD',
          inputType: 'date',
          value: formatDate({
            template: '{0}-{1}-{2}',
            timestamp: count.start,
          }),
          verify(val) {
            if (!isValidDate(val)) {
              return '请输入正确的日期';
            }
          },
        },
        end: {
          beforeText: '结束日期：',
          placeholder: 'YYYY-MM-DD',
          inputType: 'date',
          value: formatDate({
            template: '{0}-{1}-{2}',
            timestamp: count.end,
          }),
          verify(val) {
            if (!isValidDate(val)) {
              return '请输入正确的日期';
            }
          },
        },
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff() || !verifyDate(inp)) return;
      loading.start();
      reqCountEdit({ id: count.id, ...inp })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close(true);
            _msg.success(result.codeText);
            getCountList();
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '编辑倒计时'
  );
}
export function verifyDate(obj) {
  let { start, end } = obj;
  start = new Date(start).getTime();
  end = new Date(end).getTime();
  if (start >= end) {
    _msg.error('结束日期必须大于开始日期');
    return false;
  }
  return true;
}
// 菜单
function countMenu(e) {
  const count = getCount($(this).parent().parent().attr('data-id'));
  const data = [
    { id: 'top', text: '置顶', beforeIcon: 'iconfont icon-zhiding' },
    {
      id: 'state',
      text: count.state === 1 ? '关闭' : '开启',
      beforeIcon: `iconfont ${
        count.state === 1 ? 'icon-shibai' : 'icon-chenggong'
      }`,
    },
    {
      id: 'edit',
      text: '编辑',
      beforeIcon: 'iconfont icon-bianji',
    },
    {
      id: 'del',
      text: '删除',
      beforeIcon: 'iconfont icon-shanchu',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    function ({ e, close, id, loading }) {
      if (id === 'edit') {
        editCount(e, count);
      } else if (id === 'del') {
        delCount(
          e,
          count.id,
          () => {
            close();
          },
          loading
        );
      } else if (id === 'top') {
        toTop(e, count);
      } else if (id === 'state') {
        loading.start();
        reqCountState({ id: count.id, state: count.state === 0 ? 1 : 0 })
          .then((res) => {
            loading.end();
            if (res.code === 1) {
              close(1);
              getCountList();
              _msg.success(res.codeText);
            }
          })
          .catch(() => {
            loading.end();
          });
      }
    },
    count.title
  );
}
// 置顶
function toTop(e, obj) {
  rMenu.inpMenu(
    e,
    {
      items: {
        num: {
          beforeText: '权重数 (数值越大越靠前)：',
          value: obj.top,
          inputType: 'number',
          placeholder: '0：取消；数值越大越靠前',
          verify(val) {
            return (
              rMenu.validInteger(val) ||
              rMenu.validNumber(val, 0, _d.fieldLength.top)
            );
          },
        },
      },
    },
    function ({ inp, close, loading, isDiff }) {
      if (!isDiff()) return;
      const top = inp.num;
      if (obj.top === top) return;
      loading.start();
      reqCountTop({ id: obj.id, top })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            close(1);
            getCountList();
            _msg.success(res.codeText);
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '置顶'
  );
}
$countList
  .on('click', '.add_btn', addCount)
  .on('click', '.clear_btn', delCount)
  .on('click', '.clear_all_btn', function (e) {
    delCount(e, 'all');
  })
  .on('mouseenter', '.pro', function () {
    const $this = $(this).parent();
    const id = $this.attr('data-id');
    const { start, end, link, state, top } = getCount(id);
    const str = `状态：${state === 1 ? '开启' : '关闭'}\n开始日期：${formatDate(
      {
        template: '{0}-{1}-{2}',
        timestamp: start,
      }
    )}\n结束日期：${formatDate({
      template: '{0}-{1}-{2}',
      timestamp: end,
    })}\n权重：${top}\n链接：${link || '--'}`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.pro', function () {
    toolTip.hide();
  })
  .on('click', '.icon', function () {
    const $this = $(this).parent().parent();
    const id = $this.attr('data-id');
    const { link } = getCount(id);
    if (!link) return;
    myOpen(link, '_blank');
  })
  .on('click', '.set_btn', countMenu)
  .on('click', '.pro', function (e) {
    const $this = $(this).parent();
    const id = $this.attr('data-id');
    showCountInfo(e, getCount(id));
  });
// 层级
function countIndex(e) {
  if (_getTarget(this, e, '.count_box')) {
    setZidx($countBox[0], 'count', closeCountBox, countDownIsTop);
  }
}
document.addEventListener('mousedown', (e) => {
  if (isMobile()) return;
  countIndex(e);
});
document.addEventListener('touchstart', (e) => {
  if (!isMobile()) return;
  countIndex(e.changedTouches[0]);
});
// 拖动
myDrag({
  trigger: $cheadBtns.find('.c_space')[0],
  target: $countBox[0],
  down({ target }) {
    target.style.transition = '0s';
    showIframeMask();
  },
  dblclick({ target }) {
    if (isFullScreen(target)) {
      myToRest(target);
    } else {
      myToMax(target);
    }
  },
  up({ target, x, y, pointerX }) {
    hideIframeMask();
    const { h, w } = getScreenSize();
    if (y <= 0 || y >= h || x > w || 0 - x > target.offsetWidth) {
      myToMax(target);
    } else {
      savePopLocationInfo(target, { x, y });
      countDownSize.x = x;
      countDownSize.y = y;
      localData.set('countDownSize', countDownSize);
      myToRest(target, pointerX);
    }
  },
});
// 调整大小
myResize({
  target: $countBox[0],
  down({ target }) {
    target.style.transition = '0s';
    showIframeMask();
  },
  up({ target, x, y }) {
    hideIframeMask();
    const obj = {
      x,
      y,
      w: target.offsetWidth,
      h: target.offsetHeight,
    };
    savePopLocationInfo(target, obj);
    countDownSize = obj;
    localData.set('countDownSize', countDownSize);
  },
});
// 手势关闭
_mySlide({
  el: $countList[0],
  right(e) {
    if (_getTarget(this, e, '.count_list .count_paging_box')) return;
    closeCountBox();
  },
});
