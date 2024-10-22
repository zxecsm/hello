import py from 'pinyin';

function pinyin(text) {
  if (/^[A-Za-z]+$/.test(text)) return text.toLowerCase();

  try {
    return py
      .pinyin(text, {
        style: py.pinyin.STYLE_NORMAL, // 普通风格，不带音调
        heteronym: false, // 不返回多音字
      })
      .flat()
      .join('')
      .toLowerCase();
  } catch {
    return text.toLowerCase();
  }
}

export default pinyin;
