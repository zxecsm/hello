import FileWorker from './fileSlice.worker.js';
import { getSuffix } from './utils.js';
// 切片
function fileSlice(file, callback) {
  return new Promise((resolve, reject) => {
    const w = new FileWorker();
    let chunkSize = file.size / 100;
    const max = 50 * 1024 * 1024,
      min = 5 * 1024 * 1024;
    if (chunkSize > max) {
      chunkSize = max;
    } else if (chunkSize < min) {
      chunkSize = min;
    }
    const [a, b] = getSuffix(file.name || ''),
      count = Math.ceil(file.size / chunkSize),
      chunks = [];
    for (let i = 0; i < count; i++) {
      const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
      chunks.push(chunk);
    }
    w.postMessage({ chunks });
    w.onmessage = function (e) {
      const { type, value, HASH } = e.data;
      if (type === 'progress') {
        callback && callback(value);
      } else if (type === 'result') {
        w.onmessage = w.onerror = null;
        resolve({
          HASH,
          chunks: value,
          count,
          suffix: b,
          filename: a,
          size: file.size,
        });
      }
    };
    w.onerror = function (err) {
      w.onmessage = w.onerror = null;
      reject(err);
    };
  });
}
export default fileSlice;
