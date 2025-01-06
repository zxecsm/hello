import { nanoid } from './utils.js';

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
  get(key) {
    return this.tasks.get(key) || null;
  },
  getTaskList(account) {
    return Array.from(this.tasks.keys()).filter((key) =>
      key.startsWith(`${account}_`)
    );
  },
};

export default taskState;
