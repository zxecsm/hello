import archiver from 'archiver';
import unzipper from 'unzipper';
import _f from './f.js';
import _path from './path.js';
import { concurrencyTasks } from './utils.js';

// 压缩文件
function zip(froms, to, { signal, progress } = {}) {
  return new Promise((resolve, reject) => {
    // 创建输出流
    const output = _f.fs.createWriteStream(to);

    // 创建 archiver 实例，设置压缩格式为 'zip'
    const archive = archiver('zip', {
      zlib: { level: 9 }, // 设置压缩级别（0-9，9为最大压缩）
    });

    // 设置文件压缩流
    output.on('close', () => {
      resolve(archive.pointer());
    });

    archive.on('error', (err) => {
      reject(err);
    });

    // 监听中断信号
    if (signal && !signal.aborted) {
      signal.addEventListener('abort', () => {
        archive.abort();
      });
    }

    // 监听进度
    archive.on('progress', (pro) => {
      progress && progress(pro); // 已压缩的文件个数
    });

    // 将数据流链接到输出流
    archive.pipe(output);

    // 添加文件到压缩包
    froms.forEach((item) => {
      const { type, name, path } = item;
      const p = `${path}/${name}`;
      if (type === 'dir') {
        archive.directory(p, name);
      } else {
        archive.file(p, { name });
      }
    });

    // 完成压缩
    archive.finalize();
  });
}

// 解压文件
async function unzip(from, to, { signal, progress } = {}) {
  const directory = await unzipper.Open.file(from);

  // 遍历所有文件并分别处理
  await concurrencyTasks(directory.files, 5, async (file) => {
    if (signal && signal.aborted) return; // 中断

    const outputPath = _path.normalize(`${to}/${file.path}`); // 保存文件的路径

    if (file.type === 'Directory') {
      await _f.mkdir(outputPath);
    } else {
      await _f.mkdir(_path.dirname(outputPath));
      await new Promise((resolve, reject) => {
        file
          .stream()
          .pipe(_f.fs.createWriteStream(outputPath))
          .on('error', reject)
          .on('finish', () => {
            resolve();
            progress && progress(outputPath);
          });
      });
    }
  });
}

const zipper = {
  zip,
  unzip,
};

export default zipper;
