import Recorder from 'js-audio-recorder';
import _msg from '../plugins/message';
import { _setTimeout } from './utils';

let recorder = null;
let starting = false;

// 立即销毁录音实例（释放麦克风）
async function destroyRecorder() {
  const r = recorder;
  recorder = null;
  if (!r) return;
  try {
    await r.destroy();
  } catch {}
}

async function start() {
  // 正在启动或已经在录音时，忽略重复触发
  if (starting || recorder) return;

  starting = true;

  try {
    // 释放可能残留的旧实例
    await destroyRecorder();

    recorder = new Recorder();
    recorder.onprogress = function (params) {
      _msg.botMsg(`录音中：${params.duration.toFixed(2)}s`, 1);
    };

    await recorder.start();
  } catch {
    _msg.error('没有开启权限或浏览器不支持语音输入');
    await destroyRecorder();
  } finally {
    starting = false;
  }
}

function stop() {
  const r = recorder;
  if (!r) return {};

  r.stop();

  const res = {
    blob: r.getWAVBlob(),
    duration: r.duration.toFixed(2),
    size: r.fileSize,
  };

  _msg.botMsg(`录音结束：${res.duration}s`, 1);

  recorder = null;

  // 延迟销毁，避免影响刚读取到的录音数据
  _setTimeout(() => {
    r.destroy().catch(() => {});
  }, 1000);

  return res;
}

const record = {
  start,
  stop,
};

export default record;
