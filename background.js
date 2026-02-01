// background.js

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "FETCH_DATA") {
    handleRequests(request.word).then(sendResponse);
    return true; // 保持消息通道开启以进行异步响应
  }
});

async function handleRequests(word) {
  try {
    // 1. 获取存储的配置
    const settings = await chrome.storage.sync.get(['googleApiKey', 'googleCx', 'customUrl']);
    
    // 2. 并行发起请求
    const [images, definitions] = await Promise.allSettled([
      fetchGoogleImages(word, settings.googleApiKey, settings.googleCx),
      fetchDictionary(word)
    ]);

    return {
      images: images.status === 'fulfilled' ? images.value : [],
      definitions: definitions.status === 'fulfilled' ? definitions.value : null,
      customUrl: settings.customUrl || "",
      error: null
    };

  } catch (error) {
    return { error: error.message };
  }
}

// Google Custom Search API
async function fetchGoogleImages(query, apiKey, cx) {
  if (!apiKey || !cx) return []; // 未配置时不请求

  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&searchType=image&num=10`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.items) {
    return data.items.map(item => ({
      thumbnail: item.image.thumbnailLink || item.link,
      link: item.link,
      title: item.title
    }));
  }
  return [];
}

// DictionaryAPI.dev
async function fetchDictionary(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const response = await fetch(url);
  
  if (!response.ok) return null;
  
  const data = await response.json();
  return data; // 返回数组
}
