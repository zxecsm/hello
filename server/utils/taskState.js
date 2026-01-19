import nanoid from './nanoid.js';

const taskState = {
  tasks: new Map(),
  add(account, text, controller) {
    const key = `${account}_${nanoid()}`;
    this.tasks.set(key, { text, controller });
    return key;
  },
  update(key, text) {
    const task = this.tasks.get(key);
    if (task) {
      task.text = text;
    }
  },
  delete(key) {
    this.tasks.delete(key);
  },
  done(key) {
    const task = this.tasks.get(key);
    if (task) {
      task.state = 1;
      task.time = new Date();
    }
  },
  get(key) {
    return this.tasks.get(key) || null;
  },
  getTaskList(account) {
    return Array.from(this.tasks.keys()).filter((key) => key.startsWith(`${account}_`));
  },
};

// 清理已完成任务
setInterval(() => {
  const now = Date.now();
  for (const [key, task] of taskState.tasks) {
    if (task.state === 1 && now - task.time > 1000 * 30) {
      taskState.delete(key);
    }
  }
}, 1000 * 60);

export default taskState;
