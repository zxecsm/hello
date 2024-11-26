// 页面搜索高亮
class HighlightWord {
  constructor(target) {
    this.target = target;
  }
  init() {
    const hWordNodes = this.target.querySelectorAll('span.highlight_word');
    for (let i = 0; i < hWordNodes.length; i++) {
      const node = hWordNodes[i];
      const nodeParent = node.parentNode;
      nodeParent.replaceChild(node.firstChild, node);
      this.initNode(nodeParent);
    }
  }
  initNode(node) {
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (child.nodeType === 1) {
        this.initNode(child);
      } else if (child.nodeType === 3) {
        // 如果当前为文本节点，并且下一个兄弟也是文本节点，合并为一个文本节点
        const next = child.nextSibling;
        if (next && next.nodeType === 3) {
          const newText = document.createTextNode(
            child.nodeValue + next.nodeValue
          );
          node.insertBefore(newText, child);
          node.removeChild(child);
          node.removeChild(next);
          i--;
        }
      }
    }
  }
  highlight(word) {
    word = word.trim();
    this.init();
    if (word) {
      this.hdHighlight(this.target, word.trim().toLowerCase());
    }
  }
  hdHighlight(node, word) {
    let flag = 0;
    if (node.nodeType === 3) {
      const idx = node.nodeValue.toLowerCase().indexOf(word);
      if (idx >= 0) {
        const oText = node.splitText(idx);
        oText.splitText(word.length);
        const oSpan = document.createElement('span');
        oSpan.className = 'highlight_word';
        oSpan.appendChild(oText.cloneNode(true));
        oText.parentNode.replaceChild(oSpan, oText);
        flag = 1;
      }
    } else if (
      node.nodeType === 1 &&
      node.childNodes &&
      !/(script|style)/i.test(node.tagName)
    ) {
      for (let i = 0; i < node.childNodes.length; i++) {
        i += this.hdHighlight(node.childNodes[i], word);
      }
    }
    return flag;
  }
}
export default HighlightWord;
