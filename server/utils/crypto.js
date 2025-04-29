import { createHash, randomBytes, pbkdf2 } from 'crypto';
import fs from 'fs';

// 计算文件的 MD5 值
function getFileMD5Hash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('md5');
    const stream = fs.createReadStream(filePath);

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

// 生成安全密钥
function generateSecureKey(length = 64) {
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
    pbkdf2(
      inputPassword,
      storedSalt,
      iterations,
      keyLength,
      digest,
      (err, derivedKey) => {
        if (err) {
          return reject(err); // 错误处理
        }

        // 比较加密后的结果与存储的密码哈希值
        if (derivedKey.toString('hex') === storedHashedPassword) {
          resolve(true); // 密码匹配
        } else {
          resolve(false); // 密码不匹配
        }
      }
    );
  });
}

const _crypto = {
  getFileMD5Hash,
  getStringHash,
  hashPassword,
  verifyPassword,
  generateSecureKey,
};

export default _crypto;
