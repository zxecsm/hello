// 加载 API 配置
chrome.storage.sync.get(['helloApi'], (res) => {
  if (res.helloApi) document.getElementById('api').value = res.helloApi;
});

// 保存 API 地址
document.getElementById('api').addEventListener('input', (e) => {
  chrome.storage.sync.set({ helloApi: e.target.value });
});
// 替换api中的占位符
function replaceApi(api, text) {
  return api.replace(/\{\{(.*?)\}\}/g, text);
}
// 点击保存按钮
document.getElementById('save').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = encodeURIComponent(tab.url);

  // 获取当前 API 地址
  let api = document.getElementById('api').value.trim();

  if (!api) return alert('请输入 API 地址');

  // 半屏居中 popup
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

  window.open(replaceApi(api, currentUrl), '_blank', features);
});
