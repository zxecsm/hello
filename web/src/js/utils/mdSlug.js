// 把标题文本转成锚点 id：保留中英文、数字、下划线和连字符，
// 空格与标点统一转成连字符，英文转小写。
export function slugifyHeading(text = '') {
  const slug = String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'heading';
}

// 解码 location.hash，兼容中文标题 id
export function decodeHashId(hash = '') {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
