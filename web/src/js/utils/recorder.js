import _msg from '../plugins/message';

// 语音统一编码为 16kHz 单声道 MP3，体积小且兼容性好
const TARGET_SAMPLE_RATE = 16000;
const MP3_BIT_RATE = 64;
// MediaRecorder 优先使用的录音格式（仅用于采集，最终会转成 MP3）
const RECORD_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/webm',
];

let session = null;
let starting = null;

function isSupported() {
  return (
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

function getMimeType() {
  if (!isSupported()) return '';
  if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
  for (const type of RECORD_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function releaseStream(s) {
  try {
    s.stream.getTracks().forEach((track) => track.stop());
  } catch {}
}

function clearTimer(s) {
  if (s.timer) {
    clearInterval(s.timer);
    s.timer = null;
  }
}

// 停止 MediaRecorder 并取回完整的录音数据
function stopMediaRecorder(s) {
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimer(s);
      resolve(new Blob(s.chunks, { type: s.mimeType }));
    };

    s.mediaRecorder.onstop = done;
    s.mediaRecorder.onerror = (e) => {
      clearTimer(s);
      reject((e && e.error) || new Error('recorder error'));
    };

    if (s.mediaRecorder.state === 'inactive') {
      done();
      return;
    }

    try {
      s.mediaRecorder.stop();
    } catch (err) {
      clearTimer(s);
      reject(err);
    }
  });
}

async function start() {
  // 正在启动或已经在录音时，忽略重复触发
  if (session) return;
  if (starting) return starting;

  starting = (async () => {
    let stream = null;
    try {
      if (!isSupported()) throw new Error('unsupported');

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = getMimeType();
      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, audioBitsPerSecond: 128000 } : undefined,
      );

      const s = {
        stream,
        mediaRecorder,
        chunks: [],
        mimeType: mediaRecorder.mimeType || mimeType || 'audio/webm',
        startTime: Date.now(),
        timer: null,
      };

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) s.chunks.push(e.data);
      };

      // 定时切片，避免停止时丢失尾部数据
      try {
        mediaRecorder.start(500);
      } catch {
        mediaRecorder.start();
      }

      s.timer = setInterval(() => {
        _msg.botMsg(`录音中：${((Date.now() - s.startTime) / 1000).toFixed(2)}s`, 1);
      }, 200);

      session = s;
    } catch {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      _msg.error('没有开启权限或浏览器不支持语音输入');
    }
  })();

  try {
    await starting;
  } finally {
    starting = null;
  }
}

// 把录到的音频解码为指定采样率的单声道 PCM
async function decodeToSamples(blob, sampleRate) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('AudioContext unsupported');

  const ctx = new AudioCtx();
  let buffer;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    // 同时兼容 Promise 和回调两种写法
    buffer = await new Promise((resolve, reject) => {
      const ret = ctx.decodeAudioData(arrayBuffer, resolve, reject);
      if (ret && typeof ret.then === 'function') ret.then(resolve, reject);
    });
  } finally {
    try {
      const p = ctx.close && ctx.close();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {}
  }

  return resample(downmix(buffer), buffer.sampleRate, sampleRate);
}

function downmix(buffer) {
  const { numberOfChannels, length } = buffer;
  if (numberOfChannels === 1) return buffer.getChannelData(0);

  const out = new Float32Array(length);
  for (let c = 0; c < numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) out[i] += data[i];
  }
  for (let i = 0; i < length; i++) out[i] /= numberOfChannels;
  return out;
}

// 线性重采样，语音场景足够用，且不依赖 OfflineAudioContext 的采样率限制
function resample(input, inRate, outRate) {
  if (inRate === outRate) return input;

  const ratio = inRate / outRate;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = input[idx] || 0;
    const b = input[idx + 1] !== undefined ? input[idx + 1] : a;
    out[i] = a + (b - a) * frac;
  }

  return out;
}

function floatTo16BitPCM(input) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

async function encodeMp3(samples) {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const encoder = new Mp3Encoder(1, TARGET_SAMPLE_RATE, MP3_BIT_RATE);
  const blockSize = 1152;
  const chunks = [];

  for (let i = 0; i < samples.length; i += blockSize) {
    const block = floatTo16BitPCM(samples.subarray(i, i + blockSize));
    const buf = encoder.encodeBuffer(block);
    if (buf.length > 0) chunks.push(buf);
  }

  const end = encoder.flush();
  if (end.length > 0) chunks.push(end);

  return new Blob(chunks, { type: 'audio/mpeg' });
}

function encodeWav(samples) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

// MP3 编码失败时退回 WAV，保证语音仍可发送
async function encodeAudio(rawBlob) {
  const samples = await decodeToSamples(rawBlob, TARGET_SAMPLE_RATE);

  try {
    return { blob: await encodeMp3(samples), ext: 'mp3' };
  } catch {
    return { blob: encodeWav(samples), ext: 'wav' };
  }
}

function getRawExt(mimeType) {
  if (/mp4|aac/i.test(mimeType)) return 'm4a';
  if (/ogg/i.test(mimeType)) return 'ogg';
  return 'webm';
}

async function stop() {
  // 启动尚未完成时先等它完成，避免快速松开导致拿不到录音
  if (starting) {
    try {
      await starting;
    } catch {}
  }

  const s = session;
  if (!s) return {};
  session = null;

  const duration = Math.max(0, (Date.now() - s.startTime) / 1000);
  let rawBlob = null;

  try {
    rawBlob = await stopMediaRecorder(s);
  } catch {
    rawBlob = null;
  } finally {
    clearTimer(s);
    releaseStream(s);
  }

  _msg.botMsg(`录音结束：${duration.toFixed(2)}s`, 1);

  if (!rawBlob || rawBlob.size === 0) {
    return { blob: null, duration: duration.toFixed(2), size: 0, ext: '' };
  }

  // 过短的录音不编码，交给上层做时长校验
  if (duration < 1) {
    return {
      blob: rawBlob,
      duration: duration.toFixed(2),
      size: rawBlob.size,
      ext: getRawExt(s.mimeType),
    };
  }

  try {
    const { blob, ext } = await encodeAudio(rawBlob);
    return { blob, duration: duration.toFixed(2), size: blob.size, ext };
  } catch {
    return { blob: null, duration: duration.toFixed(2), size: 0, ext: '' };
  }
}

// 取消录音：直接丢弃数据，不做编码
async function cancel() {
  if (starting) {
    try {
      await starting;
    } catch {}
  }

  const s = session;
  if (!s) return;
  session = null;

  clearTimer(s);
  try {
    if (s.mediaRecorder.state !== 'inactive') s.mediaRecorder.stop();
  } catch {}
  releaseStream(s);
}

const record = {
  start,
  stop,
  cancel,
};

export default record;
