import archiver from 'archiver';
import unzipper from 'unzipper';
import _f from './f.js';
import _path from './path.js';
import { concurrencyTasks } from './utils.js';

// 压缩文件
async function zip(froms, to, { signal, progress } = {}) {
  const output = await _f.createWriteStream(to, { flags: 'w' });
  const archive = archiver('zip', { zlib: { level: 9 } });

  const progressInfo = {
    size: 0,
    count: 0,
  };

  // 进度回调
  archive.on('progress', (pro) => {
    progressInfo.count += pro.entries.processed;
    progress && progress(progressInfo);
  });

  // 添加文件
  for (const item of froms) {
    const { type, name, path } = item;
    const p = `${path}/${name}`;
    type === 'dir' ? archive.directory(p, name) : archive.file(p, { name });
  }

  archive.finalize();

  // 使用 pipeline 管理流和错误
  await _f.streamp.pipeline(
    archive,
    new _f.stream.Transform({
      transform(chunk, _, callback) {
        progressInfo.size += chunk.length;
        progress && progress(progressInfo);
        callback(null, chunk);
      },
    }),
    output,
    { signal }
  );

  return archive.pointer();
}

// 解压文件
async function unzip(from, to, { signal, progress } = {}) {
  const directory = await unzipper.Open.file(from);

  const progressInfo = {
    size: 0,
    count: 0,
  };

  await concurrencyTasks(directory.files, 5, async (file) => {
    if (signal && signal.aborted) throw new Error('Aborted');

    const outputPath = _path.normalize(to, file.path);

    if (file.type === 'Directory') {
      await _f.mkdir(outputPath);
    } else {
      await _f.streamp.pipeline(
        file.stream(),
        new _f.stream.Transform({
          transform(chunk, _, callback) {
            progressInfo.size += chunk.length;
            progress && progress(progressInfo);
            callback(null, chunk);
          },
        }),
        await _f.createWriteStream(outputPath, { flags: 'w' }),
        { signal }
      );
      progressInfo.count += 1;
      progress && progress(progressInfo);
    }
  });
}

const zipper = {
  zip,
  unzip,
};

export default zipper;
