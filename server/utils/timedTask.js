import { formatDate, writelog } from './utils.js';

const cbs = new Set();

function add(cb) {
  cbs.add(cb);
}

function remove(cb) {
  cbs.delete(cb);
}

function stop() {
  clearInterval(timer);
  timer = null;
}

let timer = setInterval(() => {
  try {
    const flag = formatDate({ template: '{0}{1}{2}{3}{4}{5}' });
    cbs.forEach((cb) => {
      try {
        cb(flag);
      } catch (error) {
        writelog(false, `[ timedTask ] - ${error}`, 'error');
      }
    });
  } catch (error) {
    stop();
    writelog(false, `[ timedTask ] - ${error}`, 'error');
  }
}, 1000);

const timedTask = {
  add,
  remove,
  stop,
};

export default timedTask;
