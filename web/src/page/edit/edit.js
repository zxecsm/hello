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
