import $ from 'jquery';
import { reqTaskCancel, reqTaskInfo, reqTaskList } from '../../api/task';
import { _setTimeout } from '../../js/utils/utils';
import _d from '../../js/common/config';

const $taskBox = $('.task_box'),
  $zoomBtn = $taskBox.find('.zoom_btn'),
  $container = $taskBox.find('.container');

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
  $container.stop().slideDown(_d.speed);
  $zoomBtn.attr('class', 'zoom_btn iconfont icon-xiala');
}

// 显示任务列表
function hideTasksList() {
  $container.stop().slideUp(_d.speed);
  $zoomBtn.attr('class', 'zoom_btn iconfont icon-shang');
}

$zoomBtn.on('click', () => {
  if ($container.is(':hidden')) {
    showTasksList();
  } else {
    hideTasksList();
  }
});

let tastList = [];

class CreateTask {
  constructor(key) {
    this.key = key;
    this.init();
    this.updateProgress();
    tastList.push({ key, task: this });
  }
  init() {
    this.task = document.createElement('div');
    this.task.className = 'task';
    this.progress = document.createElement('div');
    this.progress.className = 'progress';
    this.progress.innerText = '...';
    this.cancelBtn = document.createElement('div');
    this.cancelBtn.className = 'cancel_task iconfont icon-close-bold';
    this.cancelBtn.setAttribute('cursor', 'y');
    this.cancelBtn.dataset.key = this.key;
    this.task.appendChild(this.progress);
    this.task.appendChild(this.cancelBtn);
  }
  // 轮询更新进度
  async updateProgress() {
    if (!this.key) return;

    try {
      const res = await reqTaskInfo({ key: this.key });

      if (res.code === 1) {
        if (res.data.text) {
          this.progress.innerText = res.data.text;
        } else {
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
  cancel() {
    tastList = tastList.filter((item) => item.key !== this.key);
    this.key = '';
    this.task.remove();
    if (tastList.length === 0) {
      hideTask();
    }
  }
}

export function addTask(key) {
  showTask();
  const task = new CreateTask(key);
  $container.append(task.task);
}

// 刷新继续显示任务
reqTaskList()
  .then((res) => {
    if (res.code === 1) {
      res.data.forEach((key) => {
        addTask(key);
      });
    }
  })
  .catch(() => {});

$taskBox.on('click', '.cancel_task', async (e) => {
  const key = e.target.dataset.key;
  const task = tastList.find((item) => item.key === key);
  try {
    const res = await reqTaskCancel({ key });

    if (res.code === 1) {
      task.cancel();
    }
  } catch {}
});
