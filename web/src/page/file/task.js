import $ from 'jquery';
import { reqTaskCancel, reqTaskInfo } from '../../api/task';
import { _mySlide, _setTimeout } from '../../js/utils/utils';
import _d from '../../js/common/config';

const $taskBox = $('.task_box'),
  $zoomBtn = $taskBox.find('.zoom_btn'),
  $list = $taskBox.find('.list');

// 显示任务框
function showTask() {
  $taskBox.css('display', 'flex');
}

// 隐藏任务框
function hideTask() {
  $taskBox.css('display', 'none');
}

// 显示任务列表
function showTasksList() {
  $list.stop().slideDown(_d.speed);
  $zoomBtn.attr('class', 'zoom_btn iconfont icon-xiala');
}

// 显示任务列表
function hideTasksList() {
  $list.stop().slideUp(_d.speed);
  $zoomBtn.attr('class', 'zoom_btn iconfont icon-shang');
}

// 手势
_mySlide({
  el: $taskBox[0],
  right() {
    hideTasksList();
  },
});

$zoomBtn.on('click', () => {
  if ($list.is(':hidden')) {
    showTasksList();
  } else {
    hideTasksList();
  }
});

let taskList = [];

class CreateTask {
  constructor(key, cb, token) {
    this.key = key;
    this.cb = cb;
    this.token = token;
    this.init();
    this.updateProgress();
    taskList.push({ key, task: this });
  }
  init() {
    this.task = document.createElement('div');
    this.task.className = 'task';
    this.progress = document.createElement('div');
    this.progress.className = 'progress';
    this.progress.textContent = '...';
    this.cancelBtn = document.createElement('div');
    this.cancelBtn.className = 'cancel_task iconfont icon-shibai';
    this.cancelBtn.setAttribute('cursor', 'y');
    this.cancelBtn.dataset.key = this.key;
    this.task.appendChild(this.progress);
    this.task.appendChild(this.cancelBtn);
  }
  // 轮询更新进度
  async updateProgress() {
    if (!this.key) return;

    try {
      const res = await reqTaskInfo({ key: this.key, token: this.token });

      if (res.code === 1) {
        const { state, text } = res.data;
        if (text) {
          this.progress.textContent = text;
        }
        if (state === 1) {
          this.task.classList.add('done');
          this.cancel();
        } else if (state === -1) {
          this.task.classList.add('failed');
          this.cancel();
        }
      }
    } catch {
    } finally {
      _setTimeout(() => {
        this.updateProgress();
      }, 1000);
    }
  }
  cancel(delay = 2000) {
    taskList = taskList.filter((item) => item.key !== this.key);
    this.key = '';
    this.cb && this.cb();
    _setTimeout(() => {
      this.task.remove();
      if ($list.children().length === 0) {
        hideTask();
      }
    }, delay);
  }
}
export function addTask(key, cb, token = '') {
  showTask();
  const task = new CreateTask(key, cb, token);
  $list.append(task.task);
}

$taskBox.on('click', '.cancel_task', async (e) => {
  const key = e.target.dataset.key;
  const item = taskList.find((item) => item.key === key);
  try {
    const res = await reqTaskCancel({ key, token: item.task.token });

    if (res.code === 1) {
      item.task.cancel(0);
    }
  } catch {}
});
// addTask('test');
