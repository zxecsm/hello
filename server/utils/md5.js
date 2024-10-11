import { createHash } from 'crypto';
import _f from './f.js';

// 计算文件的 MD5 值
function getFileMD5Hash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('md5');
    const stream = _f.fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk); // 更新哈希值
    });

    stream.on('end', () => {
      resolve(hash.digest('hex')); // 返回最终的哈希值
    });

    stream.on('error', (err) => {
      reject(err); // 错误处理
      stream.destroy(); // 在发生错误时，销毁流
    });
  });
}

// 获取字符串的哈希值
function getStringHash(inputString, algorithm = 'md5') {
  const hash = createHash(algorithm);
  hash.update(inputString); // 更新哈希值
  return hash.digest('hex'); // 返回哈希值的十六进制字符串
}

const md5 = {
  getFileMD5Hash,
  getStringHash,
};

export default md5;
