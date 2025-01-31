// 转换为 Unix 风格的路径
function toUnixPath(path) {
  return path.replace(/\\+/g, '/');
}

// 规范化路径
function normalize(path) {
  path = toUnixPath(path);

  if (path === '/') {
    return '/';
  }

  const parts = path.split('/');

  const stack = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part === '' || part === '.') {
      // 忽略空字符串和当前目录标记 `.`
      continue;
    } else if (part === '..') {
      // 如果遇到 `..`，则回退一级目录，弹出栈顶元素
      if (stack.length > 0) {
        stack.pop();
      }
    } else {
      // 其他合法的路径片段，推入栈
      stack.push(part);
    }
  }

  // 使用 `/` 重新组合栈中的路径
  let normalizedPath = stack.join('/');

  // 确保如果输入路径是以 `/` 开头的，输出路径也应该以 `/` 开头
  if (path.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }

  // 确保如果输入路径是以 `/` 结尾的，输出路径也应该以 `/` 结尾
  if (path.endsWith('/') && normalizedPath !== '/') {
    normalizedPath += '/';
  }

  return normalizedPath;
}

// 获取文件名
function basename(path) {
  path = toUnixPath(path);
  const filename = path.substring(path.lastIndexOf('/') + 1).split('?')[0];
  return [filename, ...extname(filename)];
}

// 获取目录名
function dirname(path) {
  path = toUnixPath(path);
  return normalize(path.substring(0, path.lastIndexOf('/')) || '/');
}

// 合并路径
function join(...paths) {
  return normalize(paths.join('/'));
}

// 是否包含在另一个路径
function isPathWithin(parentP, childP) {
  const normalizedParent = normalize(parentP).replace(/\/$/, '');
  const normalizedChild = normalize(childP).replace(/\/$/, '');

  return (
    normalizedChild.startsWith(normalizedParent + '/') &&
    normalizedChild !== normalizedParent
  );
}

// 获取扩展名
function extname(path) {
  const idx = path.lastIndexOf('.');
  return idx === -1
    ? [path, '', '']
    : [path.slice(0, idx), '.', path.slice(idx + 1)];
}

// 获取随机后缀文件名
function randomFilenameSuffix(
  filename,
  r = Math.random().toString().slice(-6)
) {
  r = '_' + r;
  const [a, b, c] = extname(filename);

  return a ? `${a}${r}${b}${c}` : `${b}${c}${r}`;
}

const _path = {
  toUnixPath,
  normalize,
  basename,
  dirname,
  join,
  extname,
  isPathWithin,
  randomFilenameSuffix,
};

export default _path;
