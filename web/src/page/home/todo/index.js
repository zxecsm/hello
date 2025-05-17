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
} from '../../../js/utils/utils.js';
import _d from '../../../js/common/config';
import _msg from '../../../js/plugins/message';
import _pop from '../../../js/plugins/popConfirm';
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
const $todoBox = $('.todo_box'),
  $theadBtns = $todoBox.find('.t_head_btns'),
  $todoList = $todoBox.find('.todo_list');
let todoList = [],
  todoPageNo = 1,
  todoPageSize = 40,
  undoneCount = 0,
  todoIsTop = localData.get('todoIsTop');
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
    1
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
  $todoList.html(str).scrollTop(0);
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
// 生成列表
function renderTodoList(total, toTop) {
  if ($todoBox.is(':hidden')) return;
  const html = _tpl(
    `
    <div style="padding-bottom: 1rem;">
      <button cursor="y" class="add_btn btn btn_primary">添加</button>
      <button v-if="hasFinish()" cursor="y" class="clear_btn btn btn_danger">清除已完成</button>
      <button v-if="todoList.length > 0" cursor="y" class="clear_all_btn btn btn_danger">清空</button>
    </div>
    <p v-if="total === 0" style="padding: 2rem 0;pointer-events: none;text-align: center;">暂无待办事项</p>
    <template v-else>
      <ul v-for="{id, content, state, update_at} in todoList" :data-id="id">
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
    }
  );
  $todoList.html(html);
  if (toTop) {
    $todoList.scrollTop(0);
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
    $todoList.stop().scrollTop(0);
  },
});
// 获取todo数据
function getTodo(id) {
  return todoList.find((item) => item.id === id) || {};
}
// 显示todo
export function showTodoBox() {
  const tBox = $todoBox[0];
  hideRightMenu();
  const isHide = $todoBox.is(':hidden');
  $todoBox.css('display', 'flex');
  setZidx(tBox, 'todo', closeTodoBox, todoIsTop);
  getTodoList(true);
  if (!$todoBox._once) {
    $todoBox._once = true;
    toSetSize(tBox, 800, 800);
    toCenter(tBox);
  } else {
    myToRest(tBox);
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
    }
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
          placeholder: '待办内容',
          verify(val) {
            if (val === '') {
              return '请输入待办内容';
            } else if (val.length > _d.fieldLenght.todoContent) {
              return '待办内容过长';
            }
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
    '新增待办事项'
  );
}
// 删除事项
function delTodo(e, id, cb, loading = { start() {}, end() {} }) {
  let opt = {
      e,
      text: '确认清除：当页已完成事项？',
      confirm: { type: 'danger', text: '清除' },
    },
    param = {
      ids: todoList.filter((item) => item.state === 0).map((item) => item.id),
    };
  if (id) {
    param = { ids: [id] };
    if (id === 'all') {
      param = { ids: todoList.map((item) => item.id) };
      opt = {
        e,
        text: '确认清空：当页事项？',
        confirm: { type: 'danger', text: '清空' },
      };
    } else {
      opt = {
        e,
        text: '确认删除：事项？',
        confirm: { type: 'danger', text: '删除' },
      };
    }
  }
  _pop(opt, (type) => {
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
          placeholder: '待办内容',
          value: todo.content,
          verify(val) {
            if (val === '') {
              return '请输入待办内容';
            } else if (val.length > _d.fieldLenght.todoContent) {
              return '待办内容过长';
            }
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
    '编辑待办事项'
  );
}
// 菜单
function todoMenu(e) {
  const todo = getTodo($(this).parent().attr('data-id'));
  const data = [
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
    function ({ e, close, id, loading }) {
      if (id === 'edit') {
        editTodo(e, todo);
      } else if (id === 'del') {
        delTodo(
          e,
          todo.id,
          () => {
            close();
          },
          loading
        );
      } else if (id === 'copy') {
        copyText(todo.content);
        close();
      }
    },
    todo.content
  );
}
$todoList
  .on('click', '.add_btn', addTodo)
  .on('click', '.clear_btn', delTodo)
  .on('click', '.clear_all_btn', function (e) {
    delTodo(e, 'all');
  })
  .on('click', '.set_btn', todoMenu)
  .on('click', '.todo_state', function () {
    changeTodoState($(this).parent().attr('data-id'));
  });

function changeTodoState(id) {
  const todo = getTodo(id);
  let obj = { id: todo.id, state: 1 };
  if (todo.state === 1) {
    obj.state = 0;
  }

  reqTodoState(obj)
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
      target.dataset.x = x;
      target.dataset.y = y;
      myToRest(target, pointerX);
    }
  },
});
// 调整大小
myResize({
  target: $todoBox[0],
  down({ target }) {
    target.style.transition = '0s';
    showIframeMask();
  },
  up({ target, x, y }) {
    hideIframeMask();
    target.dataset.w = target.offsetWidth;
    target.dataset.h = target.offsetHeight;
    target.dataset.x = x;
    target.dataset.y = y;
  },
});
// 手势关闭
_mySlide({
  el: $todoList[0],
  right(e) {
    if (_getTarget(this, e, '.todo_list .todo_paging_box')) return;
    closeTodoBox();
  },
});
