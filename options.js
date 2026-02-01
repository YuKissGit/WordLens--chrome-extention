// options.js

// 保存设置
document.getElementById('save').addEventListener('click', () => {
  const googleApiKey = document.getElementById('apiKey').value.trim();
  const googleCx = document.getElementById('cx').value.trim();
  const customUrl = document.getElementById('customUrl').value.trim();

  chrome.storage.sync.set({
    googleApiKey: googleApiKey,
    googleCx: googleCx,
    customUrl: customUrl
  }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });
});

// 加载设置
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['googleApiKey', 'googleCx', 'customUrl'], (items) => {
    if (items.googleApiKey) document.getElementById('apiKey').value = items.googleApiKey;
    if (items.googleCx) document.getElementById('cx').value = items.googleCx;
    if (items.customUrl) document.getElementById('customUrl').value = items.customUrl;
  });
});
