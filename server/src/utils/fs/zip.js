import { ZipArchive } from 'archiver';
import unzipper from 'unzipper';
import _f from './f.js';
import _path from '../common/path.js';
import { concurrencyTasks } from '../common/utils.js';

// 压缩文件
async function zip(froms, to, { signal, progress } = {}) {
  const output = await _f.createWriteStream(to, { flags: 'w' });
  const archive = new ZipArchive({ zlib: { level: 9 } });

  const progressInfo = {
    size: 0,
    count: 0,
  };

  // 进度回调
  archive.on('progress', (pro) => {
    progressInfo.count += pro.entries.processed;
    progress && progress(progressInfo);
  });

  try {
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
      { signal },
    );

    return archive.pointer();
  } catch (error) {
    // 失败/取消时删掉写了一半的压缩包
    try {
      archive.destroy();
      output.destroy();
    } catch {}

    await _f.del(to);

    throw error;
  }
}

// 解压文件
async function unzip(from, to, { signal, progress, ignoreLink } = {}) {
  const directory = await unzipper.Open.file(from);

  // 记录目标目录是否本来存在，避免失败时误删已有目录
  const existed = await _f.exists(to);

  const progressInfo = {
    size: 0,
    count: 0,
  };

  let failed = null;

  await concurrencyTasks(directory.files, 5, async (file) => {
    if (failed || signal?.aborted) return;

    try {
      const rawPath = _path.toUnixPath(file.path);

      // 拒绝绝对路径、盘符路径和包含 .. 的条目
      if (
        rawPath.startsWith('/') ||
        /^[a-zA-Z]:\//.test(rawPath) ||
        rawPath.split('/').includes('..')
      ) {
        failed = failed || new Error(`压缩包包含非法路径: ${file.path}`);
        return;
      }

      const outputPath = _path.normalizeNoSlash(to, file.path);

      // 双重校验：最终路径必须位于目标目录内
      if (!_path.isPathWithin(to, outputPath, true)) {
        failed = failed || new Error(`压缩包包含非法路径: ${file.path}`);
        return;
      }

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
          { signal },
        );
        progressInfo.count += 1;
        progress && progress(progressInfo);
        if (ignoreLink && (await _f.getType(outputPath)) === 'symlink') {
          await _f.del(outputPath);
        }
      }
    } catch (error) {
      // 记录第一个错误，等其余任务收尾后统一清理
      failed = failed || error;
    }
  });

  if (signal?.aborted) {
    failed = failed || new Error('Aborted');
  }

  if (failed) {
    // 只清理本次新建的目标目录
    if (!existed) {
      await _f.del(to);
    }
    throw failed;
  }
}

const zipper = {
  zip,
  unzip,
};

export default zipper;
