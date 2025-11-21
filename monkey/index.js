// ==UserScript==
// @name         Text Selection Toolbox
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  选中文本后显示操作框
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  /* ---------------------- 主题 ---------------------- */

  function getTheme() {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return dark
      ? {
          bg: 'rgba(30,30,30,0.95)',
          btnBg: '#444',
          text: '#fff',
          shadow: '0 2px 10px rgba(0,0,0,0.35)',
        }
      : {
          bg: 'rgba(255,255,255,0.90)',
          btnBg: '#e0e0e0',
          text: '#000',
          shadow: '0 2px 10px rgba(0,0,0,0.15)',
        };
  }

  let toastContainer = null;

  function createToastContainer() {
    toastContainer = document.createElement('div');
    toastContainer.style.position = 'fixed';
    toastContainer.style.top = '20px';
    toastContainer.style.left = '50%';
    toastContainer.style.transform = 'translateX(-50%)';
    toastContainer.style.zIndex = 9999999;
    toastContainer.style.display = 'flex';
    toastContainer.style.flexDirection = 'column';
    toastContainer.style.alignItems = 'center';
    toastContainer.style.pointerEvents = 'none'; // 不阻塞点击
    document.body.appendChild(toastContainer);
  }

  function showToast(message, duration = 2000) {
    if (!toastContainer) createToastContainer();

    const theme = getTheme();

    const t = document.createElement('div');
    t.textContent = message;
    t.style.background = theme.bg; // 背景跟主题
    t.style.color = theme.text; // 文字跟主题
    t.style.padding = '6px 12px';
    t.style.borderRadius = '6px';
    t.style.marginTop = '6px';
    t.style.fontSize = '14px';
    t.style.pointerEvents = 'auto';
    t.style.boxShadow = theme.shadow; // 阴影跟主题
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';

    toastContainer.appendChild(t);

    // 渐显
    requestAnimationFrame(() => {
      t.style.opacity = '1';
    });

    // 自动消失
    setTimeout(() => {
      t.style.opacity = '0';
      t.addEventListener('transitionend', () => t.remove());
    }, duration);
  }

  /* ---------------------- 工具框 ---------------------- */

  let toolbox = null;

  function createToolbox() {
    toolbox = document.createElement('div');
    toolbox.style.position = 'fixed';
    toolbox.style.zIndex = 999999;
    toolbox.style.padding = '6px 8px';
    toolbox.style.borderRadius = '6px';
    toolbox.style.fontSize = '14px';
    toolbox.style.display = 'none';
    toolbox.style.userSelect = 'none';
    toolbox.style.whiteSpace = 'nowrap';

    applyTheme();
    document.body.appendChild(toolbox);
  }

  function applyTheme() {
    if (!toolbox) return;

    const t = getTheme();
    toolbox.style.background = t.bg;
    toolbox.style.color = t.text;
    toolbox.style.boxShadow = t.shadow;

    [...toolbox.querySelectorAll('.tool-btn')].forEach((b) => {
      b.style.background = t.btnBg;
      b.style.color = t.text;

      // 清除旧 hover
      b.onmouseenter = null;
      b.onmouseleave = null;

      // hover 高亮色（根据主题自动调整）
      const hoverColor = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'rgba(255,255,255,0.20)' // 深色主题：亮一点
        : 'rgba(0,0,0,0.10)'; // 浅色主题：暗一点

      b.onmouseenter = () => {
        b.style.background = hoverColor;
      };

      b.onmouseleave = () => {
        b.style.background = t.btnBg;
      };
    });
  }

  /* ---------------------- 按钮生成 ---------------------- */

  function makeBtn(label, onClick, icon) {
    const btn = document.createElement('span');
    btn.className = 'tool-btn';
    btn.style.padding = '4px 6px';
    btn.style.margin = '0 4px';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '3px';

    if (icon) {
      try {
        const i = document.createElement('span');
        i.innerHTML = icon;
        i.style.display = 'inline-block';
        i.style.width = '14px';
        i.style.height = '14px';
        btn.appendChild(i);
      } catch {}
    }

    btn.appendChild(document.createTextNode(label));
    btn.onclick = () => {
      onClick();
    };
    return btn;
  }

  function addButton(label, icon, callback) {
    toolbox.appendChild(makeBtn(label, callback, icon));
    applyTheme();
  }

  /* ---------------------- 显示/隐藏 ---------------------- */
  function hideToolbox() {
    toolbox.style.display = 'none';
  }

  /* ---------------------- 图标 ---------------------- */

  const ICON_COPY = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1m3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2m0 16H8V7h11v14Z"/></svg>`;
  const ICON_SEARCH = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.57 4.23l.27.27h.8l5 5-1.5 1.5-5-5v-.8l-.27-.27A6.516 6.516 0 0 1 9.5 16A6.5 6.5 0 0 1 3 9.5A6.5 6.5 0 0 1 9.5 3m0 2A4.5 4.5 0 0 0 5 9.5A4.5 4.5 0 0 0 9.5 14A4.5 4.5 0 0 0 14 9.5A4.5 4.5 0 0 0 9.5 5Z"/></svg>`;
  const ICON_TRANSLATE = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12.87 15.07L10.33 12.5l.02-.02A8.97 8.97 0 0 0 13 7h3V5h-5V3H9v2H4v2h7c-.58 1.72-1.61 3.22-2.97 4.47c-.91-.82-1.7-1.76-2.33-2.82H4.07c.73 1.47 1.76 2.82 3.04 4.04L3 17l1.41 1.41l4.11-4.11l3.04 3.04M18.5 10h-2L13 21h2l1.12-3h3.75L21 21h2M16.88 16l1.12-3.38L19.12 16Z"/></svg>`;
  const ICON_SAVE = `
<svg viewBox="0 0 24 24">
  <path fill="currentColor" d="M17 3H7a2 2 0 0 0-2 2v16l7-3l7 3V5a2 2 0 0 0-2-2Z"/>
</svg>`;
  const ICON_PUSH = `
<svg viewBox="0 0 24 24">
  <path fill="currentColor" d="m2 21 21-9L2 3v7l15 2-15 2v7Z"/>
</svg>`;

  const SEARCH_API = 'https://duckduckgo.com/?q={{}}';
  const TRANSLATOR_API = 'https://bing.com/translator?text={{}}';
  const SAVEBMK_API = 'http://localhost:55555/addbmk#{{}}';
  const PUSH_API =
    'http://localhost:55555/api/chat/xxxxxx/sendMessage?text={{}}';

  // 替换api中的占位符
  function replaceApi(api, text) {
    return api.replace(/\{\{(.*?)\}\}/g, text);
  }
  function openInWindow(url) {
    const width = window.screen.width / 2;
    const height = window.screen.height / 2;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const features = `
        popup=yes,
        width=${width},
        height=${height},
        left=${left},
        top=${top}
    `.replace(/\s+/g, '');

    window.open(url, '_blank', features);
  }
  function init() {
    createToolbox();

    // 默认按钮
    addButton('复制', ICON_COPY, () => {
      try {
        GM_setClipboard(window.getSelection().toString());
        showToast('复制成功');
      } catch {
        showToast('复制失败');
      }
    });

    // 搜索
    addButton('搜索', ICON_SEARCH, () => {
      const t = encodeURIComponent(window.getSelection().toString());
      window.open(replaceApi(SEARCH_API, t));
    });

    // 翻译
    addButton('翻译', ICON_TRANSLATE, () => {
      const t = encodeURIComponent(window.getSelection().toString());
      openInWindow(replaceApi(TRANSLATOR_API, t));
    });

    // 保存书签到HELLO
    addButton('保存书签', ICON_SAVE, () => {
      const url = replaceApi(SAVEBMK_API, window.location.href);
      openInWindow(url);
    });

    // 推送到HELLO
    addButton('推送消息', ICON_PUSH, () => {
      const text = window.getSelection().toString().trim();
      if (!text) return;

      GM_xmlhttpRequest({
        method: 'GET',
        url: replaceApi(PUSH_API, decodeURIComponent(text)),
        onload: function () {
          showToast('推送成功');
        },
        onerror: function (err) {
          showToast('推送失败: ' + err.status + ' ' + err.statusText);
        },
      });
    });

    // 系统主题变化
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', applyTheme);

    // 全局事件
    document.addEventListener('selectionchange', handle);
    let selTimer = null;
    function handle() {
      if (selTimer) clearTimeout(selTimer);

      selTimer = setTimeout(() => {
        selTimer = null;

        const sel = window.getSelection();
        const text = sel.toString().trim();

        if (!text) {
          hideToolbox();
          return;
        }

        const active = document.activeElement;

        // ⭐ 只要选中的是 input / textarea → 根据输入框定位
        if (
          active &&
          (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
        ) {
          const rect = active.getBoundingClientRect();
          showToolboxAtRect(rect);
          return;
        }

        // 普通文本
        if (sel.rangeCount) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          if (rect.width !== 0 || rect.height !== 0) {
            showToolboxAtRect(rect);
            return;
          }
        }

        // rect 获取失败 → 居中兜底
        showToolboxCenter();
      }, 200);
    }
    function showToolboxAtRect(rect) {
      toolbox.style.display = 'flex';

      const w = toolbox.offsetWidth;
      const h = toolbox.offsetHeight;

      let left = rect.left + rect.width / 2 - w / 2;
      let top = rect.top - h - 10;

      if (left < 6) left = 6;
      if (left + w > window.innerWidth - 6) left = window.innerWidth - w - 6;
      if (top < 6) top = rect.bottom + 10;

      toolbox.style.left = left + 'px';
      toolbox.style.top = top + 'px';
    }
    function showToolboxCenter() {
      toolbox.style.display = 'flex';
      toolbox.style.left = (window.innerWidth - toolbox.offsetWidth) / 2 + 'px';
      toolbox.style.top =
        (window.innerHeight - toolbox.offsetHeight) / 2 + 'px';
    }

    window.SelectionToolbox = { addButton };
  }

  init();
})();
