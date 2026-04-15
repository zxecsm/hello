import { formatDate, writelog } from './utils.js';

const cbs = new Set();

let timer = setInterval(async () => {
  try {
    const flag = formatDate({ template: '{0}{1}{2}{3}{4}{5}' });
    const results = await Promise.allSettled([...cbs].map((cb) => cb(flag)));

    // 记录失败的回调
    const failedResults = results.filter((r) => r.status === 'rejected');
    for (const failed of failedResults) {
      await writelog(false, `[ timedTask ] - ${failed.reason}`, 500);
    }
  } catch {}
}, 1000);

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

const timedTask = {
  add,
  remove,
  stop,
};

export default timedTask;
