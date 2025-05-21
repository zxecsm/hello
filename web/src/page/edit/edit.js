export function editorSmoothScrollToLine(editor, targetLine, duration) {
  const totalLines = editor.session.getLength(); // 获取总行数
  const startScrollTop = editor.session.getScrollTop(); // 当前滚动的垂直位置（像素）
  const targetScrollTop =
    (targetLine / totalLines) * editor.renderer.scrollBarV.element.scrollHeight; // 计算目标滚动的垂直位置（像素）

  const distance = targetScrollTop - startScrollTop; // 滚动距离
  let startTime = null;

  function step(currentTime) {
    if (!startTime) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1); // 进度从 0 到 1

    // 计算当前滚动位置
    const currentScrollTop = startScrollTop + distance * progress;
    editor.session.setScrollTop(currentScrollTop); // 设置滚动位置

    if (progress < 1) {
      window.requestAnimationFrame(step); // 继续下一帧
    }
  }

  window.requestAnimationFrame(step); // 启动动画
}
export function getLineText(editor) {
  const selectedText = editor.session.getTextRange(editor.getSelectionRange());
  const { row } = editor.getCursorPosition();
  const lineText = editor.session.getLine(row);

  return {
    selectedText,
    lineText,
    isFullLineSelected: selectedText.trim() === lineText.trim(),
  };
}

export function insertBlock(editor, type, options = {}) {
  const { selectedText, lineText, isFullLineSelected } = getLineText(editor);
  const prefix = isFullLineSelected || lineText.trim() === '' ? '' : '\n';

  let insertText = '';
  let goto = null;

  switch (type) {
    case 'link': {
      const text = options.text || selectedText || '';
      const href = options.href || 'https://';
      insertText = `[${text}](${href})`;
      if (!options.href) {
        goto = (editor) => {
          const row = editor.selection.getCursor().row;
          const col = editor.session.getLine(row).indexOf('https://');
          editor.gotoLine(row + 1, col + 8);
        };
      }
      break;
    }

    case 'img': {
      const alt = options.alt || selectedText || '描述';
      const src = options.src;
      insertText = `${prefix}![${alt}](${src})\n`;
      if (!options.src) {
        goto = (editor) => {
          const row = editor.selection.getCursor().row;
          const col = editor.session.getLine(row).indexOf('https://');
          editor.gotoLine(row + 1, col + 8);
        };
      }
      break;
    }

    case 'code': {
      const lang = options.lang || 'javascript';
      if (selectedText) {
        insertText = `${prefix}\`\`\`${lang}\n${selectedText}\n\`\`\`\n`;
      } else {
        insertText = `${prefix}\`\`\`${lang}\n\n\`\`\`\n`;
        goto = (editor) => {
          const row = editor.selection.getCursor().row;
          editor.gotoLine(row - 2, lang.length + 3);
        };
      }
      break;
    }

    case 'table':
      insertText = `${prefix}|列1|列2|列3|\n|:--:|--|--|\n|行1|  |  |\n|行2|  |  |\n`;
      break;

    default:
      return;
  }

  editor.insert(insertText);
  if (goto) goto(editor);
  editor.focus();
}
