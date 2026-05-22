import $ from 'jquery';
import {
  formatDate,
  copyText,
  hdTextMsg,
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
  isFullScreen,
  getCenterPointDistance,
  _animate,
  savePopLocationInfo,
  switchFullScreenStateStyle,
  removeFullScreenStateStyle,
  longPress,
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import _msg from '../../../js/plugins/message';
import {
  reqTodoAdd,
  reqTodoDelete,
  reqTodoEdit,
  reqTodoList,
  reqTodoState,
} from '../../../api/todo.js';
import { popWindow, setZidx } from '../popWindow.js';
import pagination from '../../../js/plugins/pagination/index.js';
import rMenu from '../../../js/plugins/rightMenu/index.js';
import { hideRightMenu } from '../rightSetting/index.js';
import { hideIframeMask, showIframeMask } from '../iframe.js';
import { changeLogoAlertStatus } from '../index.js';
import { _tpl } from '../../../js/utils/template.js';
import localData from '../../../js/common/localData.js';
import { BoxSelector } from '../../../js/utils/boxSelector.js';
const $todoBox = $('.todo_box'),
  $theadBtns = $todoBox.find('.t_head_btns'),
  $todoListWrap = $todoBox.find('.todo_list_wrap'),
  $todoFooter = $todoBox.find('.todo_footer'),
  $todoList = $todoListWrap.find('.todo_list');
let todoList = [],
  todoPageNo = 1,
  todoPageSize = 40,
  undoneCount = 0,
  todoIsTop = localData.get('todoIsTop'),
  todoSize = localData.get('todoSize');
function switchTodoTop() {
  todoIsTop = !todoIsTop;
  setTop();
  localData.set('todoIsTop', todoIsTop);
  setZidx($todoBox[0], 'todo', closeTodoBox, todoIsTop);
}
setTop();
function setTop() {
  if (todoIsTop) {
    $theadBtns.find('.top').attr('class', 'top iconfont icon-zhiding1');
  } else {
    $theadBtns.find('.top').attr('class', 'top iconfont icon-zhiding');
  }
}
function isSelecting() {
  return !$todoFooter.is(':hidden');
}
function startSelect() {
  $todoList.find('ul .check_level').css('display', 'block');
  $todoFooter
    .stop()
    .slideDown(_d.speed, () => {
      todoBoxSelector.start();
    })
    .find('span')
    .attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
}
function stopSelect() {
  $todoList
    .find('ul .check_level')
    .css('display', 'none')
    .attr('check', 'n')
    .css('background-color', 'transparent');
  $todoFooter.stop().slideUp(_d.speed, () => {
    todoBoxSelector.stop();
  });
}
// 设置待办列表
export function setTodoUndone(val) {
  if (val === undefined) {
    return undoneCount;
  }
  undoneCount = val;
  changeLogoAlertStatus();
}
// 提醒消息
export function todoMsg() {
  if (undoneCount === 0) return;
  _msg.msg(
    {
      message: `您有 ${undoneCount} 条未完成事项`,
      type: 'warning',
      icon: 'iconfont icon-xuanzeyixuanze',
      duration: 8000,
    },
    (type) => {
      if (type === 'click') {
        showTodoBox();
      }
    },
  );
}
// 加载
function todoLoading() {
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
  $todoList.html(str);
  $todoListWrap.scrollTop(0);
}
// 获取待办列表
export function getTodoList(toTop) {
  if (toTop) {
    todoLoading();
  }
  reqTodoList({ pageNo: todoPageNo, pageSize: todoPageSize }).then((res) => {
    if (res.code === 1) {
      const { total, pageNo, data } = res.data;
      setTodoUndone(res.data.undoneCount);
      todoList = data;
      todoPageNo = pageNo;
      renderTodoList(total, toTop);
    }
  });
}
const todoBoxSelector = new BoxSelector($todoListWrap[0], {
  selectables: 'ul',
  onSelectStart({ e, container }) {
    const item = _getTarget(container, e, 'ul');
    if (item) return true;
  },
  onSelectEnd() {
    updateSelectInfo();
  },
  onSelectUpdate({ selectedItems, allItems, isKeepOld }) {
    allItems.forEach((item) => {
      const needCheck = selectedItems.includes(item);
      const $cItem = $(item).find('.check_level');
      const isChecked = $cItem.attr('check') === 'y';
      if (needCheck && !isChecked) {
        $cItem
          .css({
            'background-color': _d.checkColor,
          })
          .attr('check', 'y');
      } else if (!needCheck && isChecked && !isKeepOld) {
        $cItem
          .css({
            'background-color': 'transparent',
          })
          .attr('check', 'n');
      }
    });
  },
});
todoBoxSelector.stop();
// 生成列表
function renderTodoList(total, toTop) {
  if ($todoBox.is(':hidden')) return;
  const html = _tpl(
    `
    <div style="padding-bottom: 1rem;">
      <button cursor="y" class="add_btn btn btn_primary">添加</button>
      <button v-if="todoList.length > 0" cursor="y" class="clear_all_btn btn btn_primary">多选</button>
      <button v-if="hasFinish()" cursor="y" class="clear_btn btn btn_danger">清除已完成</button>
    </div>
    <p v-if="total === 0" style="padding: 2rem 0;pointer-events: none;text-align: center;">暂无待办事项</p>
    <template v-else>
      <ul v-for="{id, content, state, update_at} in todoList" :data-id="id">
        <div cursor="y" check="n" class="check_level"></div>
        <li cursor="y" class="todo_state iconfont {{state === 1 ? 'icon-xuanzeweixuanze' : 'icon-xuanzeyixuanze'}}"></li>
        <li class="todo_text">
          <div v-html="hdTextMsg(content)" class="text {{state === 1 ? '' : 'del'}}"></div>
          <div class="time">更新：{{formatDate({template: '{0}-{1}-{2} {3}:{4}',timestamp: update_at})}}</div>
        </li>
        <li cursor="y" class="set_btn iconfont icon-maohao"></li>
      </ul>
      <div v-html="getPaging()" class="todo_paging_box"></div> 
    </template>
    `,
    {
      total,
      todoList,
      hasFinish() {
        return todoList.some((item) => item.state === 0);
      },
      hdTextMsg,
      formatDate,
      getPaging() {
        return todoPgnt.getHTML({
          pageNo: todoPageNo,
          pageSize: todoPageSize,
          total,
          small: getScreenSize().w <= _d.screen,
        });
      },
    },
  );
  stopSelect();
  $todoList.html(html);
  if (toTop) {
    $todoListWrap.scrollTop(0);
  }
}
// 分页
const todoPgnt = pagination($todoList[0], {
  select: [40, 60, 80, 100, 200],
  change(val) {
    todoPageNo = val;
    getTodoList(true);
    _msg.botMsg(`第 ${todoPageNo} 页`);
  },
  changeSize(val) {
    todoPageSize = val;
    todoPageNo = 1;
    getTodoList(true);
    _msg.botMsg(`第 ${todoPageNo} 页`);
  },
  toTop() {
    $todoListWrap.stop().scrollTop(0);
  },
});
// 获取todo数据
function getTodo(id) {
  return todoList.find((item) => item.id === id) || {};
}
// 显示todo
let showTodoOnce = false;
export function showTodoBox() {
  const tBox = $todoBox[0];
  hideRightMenu();
  const isHide = $todoBox.is(':hidden');
  $todoBox.css('display', 'block');
  setZidx(tBox, 'todo', closeTodoBox, todoIsTop);
  if (isHide) getTodoList(true);
  if (!showTodoOnce) {
    showTodoOnce = true;
    const { x, y, w, h } = todoSize;
    toSetSize(tBox, w, h);
    const obj = x && y ? { left: x, top: y } : null;
    toCenter(tBox, obj);
  } else {
    myToRest(tBox, false, false);
  }
  if (isHide) {
    const screen = getScreenSize();
    const { x, y } = getCenterPointDistance(tBox, {
      x: screen.w,
      y: screen.h / 2,
    });
    _animate(tBox, {
      to: {
        transform: `translate(${x}px,${y}px) scale(0)`,
        opacity: 0,
      },
      direction: 'reverse',
    });
  }
}
// 关闭todo
export function closeTodoBox() {
  const tBox = $todoBox[0];
  const screen = getScreenSize();
  const { x, y } = getCenterPointDistance(tBox, {
    x: screen.w,
    y: screen.h / 2,
  });
  _animate(
    tBox,
    {
      to: {
        transform: `translate(${x}px,${y}px) scale(0)`,
        opacity: 0,
      },
    },
    (target) => {
      target.style.display = 'none';
      popWindow.remove('todo');
      $todoList.html('');
    },
  );
}
$theadBtns
  .on('click', '.t_close_btn', closeTodoBox)
  .on('click', '.top', switchTodoTop)
  .on('click', '.t_refresh_btn', function () {
    getTodoList(1);
  });
// 新增事项
function addTodo(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        text: {
          type: 'textarea',
          beforeText: '待办内容：',
          verify(val) {
            return rMenu.validString(val, 1, _d.fieldLength.todoContent);
          },
        },
      },
    },
    function ({ close, inp, loading }) {
      loading.start();
      reqTodoAdd({ content: inp.text })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close();
            _msg.success(result.codeText);
            getTodoList();
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '新增待办事项',
  );
}
// 删除事项
function delTodo(e, ids, cb, loading = { start() {}, end() {} }) {
  let opt = {
      e,
      text: '确认清除：当页已完成事项？',
      confirm: { type: 'danger', text: '清除' },
    },
    param = {
      ids: todoList.filter((item) => item.state === 0).map((item) => item.id),
    };
  if (ids) {
    opt = {
      e,
      text: '确认删除：事项？',
      confirm: { type: 'danger', text: '删除' },
    };
    param.ids = ids;
  }
  rMenu.pop(opt, (type) => {
    if (type === 'confirm') {
      loading.start();
      reqTodoDelete(param)
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            _msg.success(result.codeText);
            getTodoList();
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
// 编辑事项
function editTodo(e, todo) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        text: {
          type: 'textarea',
          beforeText: '待办内容：',
          value: todo.content,
          verify(val) {
            return rMenu.validString(val, 1, _d.fieldLength.todoContent);
          },
        },
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      const content = inp.text;
      loading.start();
      reqTodoEdit({ id: todo.id, content })
        .then((result) => {
          loading.end();
          if (result.code === 1) {
            close(true);
            _msg.success(result.codeText);
            getTodoList();
            return;
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '编辑待办事项',
  );
}
longPress($todoList[0], 'ul', function () {
  if (isSelecting()) return;
  startSelect();
  checkedTodo(this.querySelector('.check_level'));
});
// 菜单
function todoMenu(e) {
  const todo = getTodo($(this).parent().attr('data-id'));
  const data = [
    {
      id: 'check',
      text: '选中',
      beforeIcon: 'iconfont icon-duoxuan',
    },
    {
      id: 'copy',
      text: '复制',
      beforeIcon: 'iconfont icon-fuzhi',
    },
  ];
  if (todo.state === 1) {
    data.push({
      id: 'edit',
      text: '编辑',
      beforeIcon: 'iconfont icon-bianji',
    });
  }
  data.push({
    id: 'del',
    text: '删除',
    beforeIcon: 'iconfont icon-shanchu',
  });
  rMenu.selectMenu(
    e,
    data,
    ({ e, close, id, loading }) => {
      if (id === 'edit') {
        editTodo(e, todo);
      } else if (id === 'del') {
        delTodo(
          e,
          [todo.id],
          () => {
            close();
          },
          loading,
        );
      } else if (id === 'copy') {
        copyText(todo.content);
        close();
      } else if (id === 'check') {
        close();
        startSelect();
        checkedTodo(this.parentNode.parentNode.querySelector('.check_level'));
      }
    },
    todo.content,
  );
}
// 选中
function checkedTodo(el) {
  const $this = $(el);
  const check = $this.attr('check');
  if (check === 'n') {
    $this.attr('check', 'y').css('background-color', _d.checkColor);
  } else {
    $this.attr('check', 'n').css('background-color', 'transparent');
  }
  updateSelectInfo();
}
function updateSelectInfo() {
  const $todoItems = $todoList.find('ul'),
    $checkList = $todoItems.filter((_, item) => $(item).find('.check_level').attr('check') === 'y');
  _msg.botMsg(`选中：${$checkList.length}项`);
  if ($checkList.length === $todoItems.length) {
    $todoFooter.find('span').attr({
      class: 'iconfont icon-xuanzeyixuanze',
      check: 'y',
    });
  } else {
    $todoFooter.find('span').attr({
      class: 'iconfont icon-xuanzeweixuanze',
      check: 'n',
    });
  }
}
function getCheckTodoIds() {
  const $todoItems = $todoList.find('ul'),
    $checkArr = $todoItems.filter((_, item) => $(item).find('.check_level').attr('check') === 'y');
  if ($checkArr.length === 0) return [];
  const arr = [];
  $checkArr.each((_, v) => {
    arr.push(v.getAttribute('data-id'));
  });
  return arr;
}
$todoFooter
  .on('click', '.f_delete', function (e) {
    const list = getCheckTodoIds();
    if (list.length === 0) return;
    delTodo(e, list);
  })
  .on('click', '.f_finish', function () {
    const list = getCheckTodoIds();
    if (list.length === 0) return;
    changeTodosState(list, 0);
  })
  .on('click', '.f_unfinish', function () {
    const list = getCheckTodoIds();
    if (list.length === 0) return;
    changeTodosState(list, 1);
  })
  .on('click', '.f_close', stopSelect)
  .on('click', 'span', function () {
    let che = $(this).attr('check');
    che === 'y' ? (che = 'n') : (che = 'y');
    $todoFooter.find('span').attr({
      class: che === 'y' ? 'iconfont icon-xuanzeyixuanze' : 'iconfont icon-xuanzeweixuanze',
      check: che,
    });
    const $todoItems = $todoList.find('ul');
    $todoItems
      .find('.check_level')
      .attr('check', che)
      .css('background-color', che === 'y' ? _d.checkColor : 'transparent');
    _msg.botMsg(`选中：${che === 'y' ? $todoItems.length : 0}项`);
  });
$todoList
  .on('click', '.add_btn', addTodo)
  .on('click', '.clear_btn', delTodo)
  .on('click', '.check_level', function () {
    checkedTodo(this);
  })
  .on('contextmenu', 'ul', function (e) {
    e.preventDefault();
    if (isMobile() || isSelecting()) return;
    startSelect();
    checkedTodo(this.querySelector('.check_level'));
  })
  .on('click', '.clear_all_btn', function () {
    if (isSelecting()) {
      stopSelect();
    } else {
      startSelect();
    }
  })
  .on('click', '.set_btn', todoMenu)
  .on('click', '.todo_state', function () {
    changeTodoState($(this).parent().attr('data-id'));
  });

function changeTodoState(id) {
  const todo = getTodo(id);
  changeTodosState([id], todo.state === 1 ? 0 : 1);
}
function changeTodosState(ids, state) {
  reqTodoState({ ids, state })
    .then((res) => {
      if (res.code === 1) {
        _msg.success(res.codeText);
        getTodoList();
      }
    })
    .catch(() => {});
}
// 层级
function todoIndex(e) {
  if (_getTarget(this, e, '.todo_box')) {
    setZidx($todoBox[0], 'todo', closeTodoBox, todoIsTop);
  }
}
document.addEventListener('mousedown', (e) => {
  if (isMobile()) return;
  todoIndex(e);
});
document.addEventListener('touchstart', (e) => {
  if (!isMobile()) return;
  todoIndex(e.changedTouches[0]);
});
// 拖动
myDrag({
  trigger: $theadBtns.find('.t_space')[0],
  target: $todoBox[0],
  down() {
    showIframeMask();
  },
  move({ target }) {
    removeFullScreenStateStyle(target);
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
      todoSize.x = x;
      todoSize.y = y;
      localData.set('todoSize', todoSize);
      myToRest(target, pointerX);
    }
  },
});
// 调整大小
myResize({
  target: $todoBox[0],
  down() {
    showIframeMask();
  },
  move({ target }) {
    removeFullScreenStateStyle(target);
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
    todoSize = obj;
    localData.set('todoSize', todoSize);
    switchFullScreenStateStyle(target);
  },
});
// 手势关闭
_mySlide({
  el: $todoListWrap[0],
  right(e) {
    if (isSelecting() || _getTarget(this, e, '.todo_list .todo_paging_box')) return;
    closeTodoBox();
  },
});
