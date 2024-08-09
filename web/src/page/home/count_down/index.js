import $ from 'jquery';
import {
  debounce,
  formatDate,
  toHide,
  toSetSize,
  toCenter,
  _getTarget,
  isMobile,
  myDrag,
  myToMax,
  myToRest,
  getSelectText,
  myResize,
  _mySlide,
  getScreenSize,
  encodeHtml,
  isValidDate,
  _setTimeout,
  readableTime,
  myOpen,
  isurl,
  isInteger,
  _getData,
  _setData,
  isFullScreen,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import _msg from '../../../js/plugins/message';
import _pop from '../../../js/plugins/popConfirm';
import { backWindow, setZidx } from '../backWindow.js';
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
const $countBox = $('.count_box'),
  $cheadBtns = $countBox.find('.c_head_btns'),
  $countList = $countBox.find('.count_list');
let countList = [],
  countPageNo = 1,
  expireCount = 0,
  countPageSize = 40,
  countDownIsTop = _getData('countDownIsTop');
function switchCountDownTop() {
  countDownIsTop = !countDownIsTop;
  setTop();
  _setData('countDownIsTop', countDownIsTop);
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
  if (expireCount == 0) return;
  _msg.msg(
    {
      message: `您有 ${expireCount} 条已到期或即将到期的倒计时`,
      type: 'warning',
      icon: 'iconfont icon-shalou',
      duration: 8000,
    },
    (type) => {
      if (type == 'click') {
        showCountBox();
      }
    },
    1
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
  new Array(30).fill(null).forEach(() => {
    let w = Math.round(Math.random() * (90 - 20) + 20);
    str += `<p style="pointer-events: none;background-color:var(--color9);height:30px;width:100%;margin:10px 0;"></p>
              ${
                w % 2 === 0
                  ? '<p style="pointer-events: none;background-color:var(--color9);height:30px;width:100%;margin:10px 0;"></p>'
                  : ''
              }
              <p style="pointer-events: none;background-color:var(--color9);height:30px;width:${w}%;margin:10px 0;"></p>
        `;
  });
  $countList.html(str).scrollTop(0);
}
// 获取列表
export function getCountList(toTop) {
  if (toTop) {
    countLoading();
  }
  reqCountList({ pageNo: countPageNo, pageSize: countPageSize }).then((res) => {
    if (res.code == 0) {
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
  let str = `<div style="padding-bottom: 10px;">
      <button cursor class="add_btn btn btn_primary">添加</button>${
        countList.some((item) => item.remain <= 0 && item.state == 0)
          ? '<button cursor class="clear_btn btn btn_danger">清除已到期</button>'
          : ''
      }
      ${
        countList.length > 0
          ? '<button cursor class="clear_all_btn btn btn_danger">清空</button>'
          : ''
      }
          </div>`;
  if (countList.length == 0) {
    str += `<p style="padding: 20px 0;pointer-events: none;text-align: center;">暂无倒计时项</p>`;
    $countList.html(str);
    return;
  }
  countList.forEach((item) => {
    const { id, title, total, past, remain, link, state, top } = item;
    str += `<div data-id="${id}" class="item_box${state == 1 ? ' close' : ''}">
        <div class="title">${
          link
            ? '<span cursor class="iconfont iconfont icon-link1 icon">'
            : '<span class="iconfont iconfont icon-shalou icon">'
        }</span><span class="text">${encodeHtml(title)}</span>${
      top == 0 ? '' : '<span class="top_btn iconfont icon-zhiding"></span>'
    }
    <span cursor class="set_btn iconfont icon-icon"></span></div>
        ${
          state == 0
            ? `<div class="info">${readableTime(total)} - ${readableTime(
                past
              )} = ${readableTime(remain)}</div>
              <div class="pro">
                <div class="bar">
                  <div class="num"></div>
                </div>
              </div>`
            : ''
        }
      </div>`;
  });
  str += `<div class="count_paging_box">`;
  str += countPgnt.getHTML({
    pageNo: countPageNo,
    pageSize: countPageSize,
    total,
    small: getScreenSize().w <= _d.screen,
  });
  str += `</div > `;
  $countList.html(str);
  if (toTop) {
    $countList.scrollTop(0);
  }
  _setTimeout(() => {
    $countList.find('.item_box').each((_, item) => {
      const $item = $(item);
      const id = $item.data('id');
      const { percent, state } = getCount(id);
      if (state == 1) return;
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
    $countList.stop().animate(
      {
        scrollTop: 0,
      },
      _d.speed
    );
  },
});
// 获取数据
function getCount(id) {
  return countList.find((item) => item.id == id);
}
// 显示
export function showCountBox() {
  hideRightMenu();
  setZidx($countBox[0], 'count', closeCountBox, countDownIsTop);
  $countBox.stop().fadeIn(_d.speed, () => {
    getCountList(true);
  });
  $countBox.css('display', 'flex');
  if (!$countBox._once) {
    $countBox._once = true;
    toSetSize($countBox[0], 800, 800);
    toCenter($countBox[0]);
  }
}
// 关闭
export function closeCountBox() {
  toHide(
    $countBox[0],
    {
      to: 'bottom',
      scale: 'small',
    },
    () => {
      backWindow.remove('count');
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
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        title: {
          beforeText: '标题：',
          verify(val) {
            if (val.trim() == '') {
              return '请输入标题';
            } else if (val.trim().length > 200) {
              return '标题内容过长';
            }
          },
        },
        link: {
          beforeText: '链接：',
          placeholder: 'https://',
          verify(val) {
            val = val.trim();
            if (!val) return;
            if (val.length > 1000) {
              return '链接过长';
            } else if (!isurl(val)) {
              return '请输入正确的链接';
            }
          },
        },
        start: {
          beforeText: '开始日期：',
          placeholder: 'YYYY-MM-DD',
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
          inputType: 'date',
          verify(val) {
            if (!isValidDate(val)) {
              return '请输入正确的日期';
            }
          },
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        if (!verifyDate(inp)) return;
        reqCountAdd(inp)
          .then((result) => {
            if (parseInt(result.code) === 0) {
              close();
              _msg.success(result.codeText);
              getCountList();
              return;
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '新增倒计时'
  );
}
// 删除
function delCount(e, id, cb) {
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
    if (id == 'all') {
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
  _pop(opt, (type) => {
    if (type == 'confirm') {
      reqCountDelete(param)
        .then((result) => {
          if (parseInt(result.code) === 0) {
            _msg.success(result.codeText);
            getCountList();
            cb && cb();
            return;
          }
        })
        .catch(() => {});
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
            if (val.trim() == '') {
              return '请输入标题';
            } else if (val.trim().length > 200) {
              return '标题内容过长';
            }
          },
        },
        link: {
          beforeText: '链接：',
          placeholder: 'https://',
          value: count.link,
          verify(val) {
            val = val.trim();
            if (!val) return;
            if (val.length > 1000) {
              return '链接过长';
            } else if (!isurl(val)) {
              return '请输入正确的链接';
            }
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
    debounce(
      function ({ close, inp }) {
        if (!verifyDate(inp)) return;
        reqCountEdit({ id: count.id, ...inp })
          .then((result) => {
            if (parseInt(result.code) === 0) {
              close(true);
              _msg.success(result.codeText);
              getCountList();
              return;
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '编辑倒计时'
  );
}
function verifyDate(obj) {
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
      text: count.state == 0 ? '关闭' : '开启',
      beforeIcon: `iconfont ${
        count.state == 0 ? 'icon-shibai' : 'icon-zhengque_chenggong_shibai'
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
    function ({ e, close, id }) {
      if (id == 'edit') {
        editCount(e, count);
      } else if (id == 'del') {
        delCount(e, count.id, () => {
          close();
        });
      } else if (id == 'top') {
        toTop(e, count);
      } else if (id == 'state') {
        reqCountState({ id: count.id, state: count.state == 0 ? '1' : '0' })
          .then((res) => {
            if (res.code == 0) {
              close(1);
              getCountList();
              _msg.success(res.codeText);
            }
          })
          .catch(() => {});
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
            val = val.trim();
            if (val == '') {
              return '请输入权重数';
            } else if (!isInteger(+val) || val < 0 || val > 9999) {
              return '请输入4位正整数';
            }
          },
        },
      },
    },
    debounce(
      function ({ inp, close }) {
        const top = inp.num;
        if (obj.top == top) return;
        reqCountTop({ id: obj.id, top })
          .then((res) => {
            if (res.code == 0) {
              close(1);
              getCountList();
              _msg.success(res.codeText);
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '置顶'
  );
}
$countList
  .on('click', '.add_btn', addCount)
  .on('click', '.clear_btn', delCount)
  .on('click', '.clear_all_btn', function (e) {
    delCount(e, 'all');
  })
  .on('mouseenter', '.item_box', function () {
    const $this = $(this);
    const id = $this.attr('data-id');
    const { start, end, link, state, top } = getCount(id);
    const str = `状态：${state == 0 ? '开启' : '关闭'}\n开始日期：${formatDate({
      template: '{0}-{1}-{2}',
      timestamp: start,
    })}\n结束日期：${formatDate({
      template: '{0}-{1}-{2}',
      timestamp: end,
    })}\n权重：${top}\n链接：${link || '--'}`;
    toolTip.setTip(str).show();
  })
  .on('mouseleave', '.item_box', function () {
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
    const h = window.innerHeight;
    if (y <= 0 || y >= h) {
      myToMax(target);
    } else {
      target._op = { x, y };
      myToRest(target, pointerX);
    }
  },
});
// 调整大小
myResize({
  target: $countBox[0],
  down(target) {
    target.style.transition = '0s';
    showIframeMask();
  },
  up(target) {
    hideIframeMask();
    target._os = {
      w: target.offsetWidth,
      h: target.offsetHeight,
    };
  },
});
// 手势关闭
_mySlide({
  el: $countList[0],
  right(e) {
    if (
      getSelectText() !== '' ||
      _getTarget(this, e, '.count_list .count_paging_box')
    )
      return;
    closeCountBox();
  },
});
