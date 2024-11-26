import Recorder from 'js-audio-recorder';
import _msg from '../plugins/message';
import { _setTimeout } from './utils';
let recorder = null;
async function start() {
  try {
    recorder = new Recorder();
    recorder.onprogress = function (params) {
      _msg.botMsg(`录音中：${params.duration.toFixed(2)}s`, 1);
    };
    await recorder.start();
  } catch {
    _msg.error('没有开启权限或浏览器不支持语音输入');
    close();
  }
}
function stop() {
  if (!recorder) return {};
  recorder.stop();
  const res = {
    blob: recorder.getWAVBlob(),
    duration: recorder.duration.toFixed(2),
    size: recorder.fileSize,
  };
  _msg.botMsg(`录音结束：${res.duration}s`, 1);
  close();
  recorder = null;
  return res;
}
function close() {
  let r = recorder;
  if (r) {
    _setTimeout(() => {
      r.destroy().finally(() => {
        r = null;
      });
    }, 1000);
  }
}
const record = {
  start,
  stop,
};
export default record;
