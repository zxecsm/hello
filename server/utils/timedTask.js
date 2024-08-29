const { formatDate, writelog } = require('./utils');

let cbs = [];

function add(cb) {
  cbs.push(cb);
}
function remove(cb) {
  cbs = cbs.filter((item) => item && item !== cb);
}
let timer = setInterval(() => {
  try {
    const flag = formatDate({ template: '{0}{1}{2}{3}{4}{5}' });
    cbs.forEach((cb) => {
      try {
        typeof cb === 'function' && cb(flag);
      } catch (error) {
        remove(cb);
        writelog(false, `[ timedTask ] - ${error}`, 'error');
      }
    });
  } catch (error) {
    clearInterval(timer);
    timer = null;
    writelog(false, `[ timedTask ] - ${error}`, 'error');
  }
}, 1000);
const timedTask = {
  add,
  remove,
};
module.exports = timedTask;
