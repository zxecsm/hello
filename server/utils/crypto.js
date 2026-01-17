import { createHash, randomBytes, pbkdf2 } from 'crypto';
import { createReadStream } from 'fs';
import { Writable } from 'stream';
import { pipeline } from 'stream/promises';
import fsp from 'fs/promises';

async function sampleHash(filePath) {
  let fd;
  try {
    const stats = await fsp.lstat(filePath);
    const fileSize = stats.size;
    const chunkSize = 256;

    if (fileSize <= chunkSize) {
      const buf = await fsp.readFile(filePath);
      return createHash('md5').update(buf).digest('hex');
    }

    const maxSampleCount = 100; // 最大取样点数
    const minSampleCount = 4; // 最小取样点数
    const sampleCount = Math.min(
      Math.max(Math.floor(fileSize / 1024), minSampleCount),
      maxSampleCount,
    );
    const maxOffset = fileSize - chunkSize; // 防止读取超出文件范围

    let seed = fileSize;
    const rng = (seed) => {
      seed = (seed * 9301 + 49297) % 233280; // 线性同余生成器
      return seed / 233280; // 归一化到 [0, 1)
    };

    const hash = createHash('md5');

    fd = await fsp.open(filePath, 'r');

    // 读取指定位置的样本
    const readSample = async (offset) => {
      const buffer = Buffer.alloc(chunkSize);
      await fd.read(buffer, 0, chunkSize, offset);
      hash.update(buffer);
    };

    // 1. 读取文件头部的样本
    await readSample(0);

    // 2. 读取随机位置的样本
    for (let i = 0; i < sampleCount; i++) {
      const randomValue = rng(seed); // 获取伪随机数
      seed = (seed * 9301 + 49297) % 233280; // 更新种子

      const offset = Math.min(Math.floor(randomValue * maxOffset), maxOffset);
      await readSample(offset); // 读取随机位置的样本
    }

    // 3. 读取文件尾部的样本
    await readSample(maxOffset);

    return hash.digest('hex');
  } catch {
    return '';
  } finally {
    if (fd) {
      await fd.close();
    }
  }
}

// 计算文件的 MD5 值
async function getFileMD5Hash(filePath, signal) {
  const hash = createHash('md5');

  await pipeline(
    createReadStream(filePath),
    new Writable({
      write(chunk, _, callback) {
        hash.update(chunk);
        callback();
      },
    }),
    { signal },
  );

  return hash.digest('hex');
}

// 生成安全密钥
function generateSecureKey(length = 32) {
  return randomBytes(length).toString('base64url');
}

// 获取字符串的哈希值
function getStringHash(inputString, algorithm = 'md5') {
  const hash = createHash(algorithm);
  hash.update(inputString); // 更新哈希值
  return hash.digest('hex'); // 返回哈希值的十六进制字符串
}

// 加密密码
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex'); // 生成盐值
    const iterations = 100000; // 迭代次数
    const keyLength = 64; // 密钥长度
    const digest = 'sha512'; // 哈希算法

    // 进行密码加密
    pbkdf2(password, salt, iterations, keyLength, digest, (err, derivedKey) => {
      if (err) {
        return reject(err); // 错误处理
      }

      // 将盐值与密码哈希拼接
      resolve(salt + '.' + derivedKey.toString('hex'));
    });
  });
}

// 验证密码
function verifyPassword(inputPassword, hashWithSalt) {
  return new Promise((resolve, reject) => {
    const [storedSalt, storedHashedPassword] = hashWithSalt.split('.'); // 提取盐值和密码哈希

    const iterations = 100000; // 迭代次数
    const keyLength = 64; // 密钥长度
    const digest = 'sha512'; // 哈希算法

    // 密码进行加密
    pbkdf2(inputPassword, storedSalt, iterations, keyLength, digest, (err, derivedKey) => {
      if (err) {
        return reject(err); // 错误处理
      }

      // 比较加密后的结果与存储的密码哈希值
      if (derivedKey.toString('hex') === storedHashedPassword) {
        resolve(true); // 密码匹配
      } else {
        resolve(false); // 密码不匹配
      }
    });
  });
}

const _crypto = {
  createHash,
  getFileMD5Hash,
  getStringHash,
  hashPassword,
  verifyPassword,
  generateSecureKey,
  sampleHash,
};

export default _crypto;
