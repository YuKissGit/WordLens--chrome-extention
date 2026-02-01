// content.js

let popupElement = null;

// 监听鼠标抬起事件
document.addEventListener('mouseup', (event) => {
  const selection = window.getSelection().toString().trim();
  
  // 简单的验证：必须是英文，长度适中
  if (selection.length > 1 && /^[a-zA-Z\s-]+$/.test(selection)) {
    createOrUpdatePopup(selection, event.pageX, event.pageY);
  } else {
    // 如果点击了非浮窗区域，且没有选词，则关闭浮窗
    if (popupElement && !popupElement.contains(event.target)) {
      removePopup();
    }
  }
});

function createOrUpdatePopup(word, x, y) {
  removePopup(); // 清除旧的

  // 创建浮窗容器
  popupElement = document.createElement('div');
  popupElement.id = 'my-extension-popup';
  popupElement.innerHTML = `
    <div class="popup-header">
      <span class="popup-title">${word}</span>
      <span class="popup-close">×</span>
    </div>
    <div class="popup-content">
      <div class="section-loading">Loading...</div>
    </div>
  `;

  // 计算位置，防止溢出屏幕
  const offsetX = 10;
  const offsetY = 20;
  popupElement.style.left = `${x + offsetX}px`;
  popupElement.style.top = `${y + offsetY}px`;

  document.body.appendChild(popupElement);

  // 绑定关闭事件
  popupElement.querySelector('.popup-close').addEventListener('click', removePopup);

  // 简单的拖拽功能
  enableDrag(popupElement);

  // 向后台请求数据
  chrome.runtime.sendMessage({ action: "FETCH_DATA", word: word }, (response) => {
    if (chrome.runtime.lastError) {
      renderError("Extension Error: " + chrome.runtime.lastError.message);
      return;
    }
    renderContent(response, word);
  });
}

function removePopup() {
  if (popupElement) {
    popupElement.remove();
    popupElement = null;
  }
}

function renderContent(data, word) {
  const contentDiv = popupElement.querySelector('.popup-content');
  contentDiv.innerHTML = ''; // 清空 loading

  if (data.error) {
    contentDiv.innerHTML = `<div class="error-msg">${data.error}</div>`;
    return;
  }

  // 1. Google 图片区域
  if (data.images && data.images.length > 0) {
    const imgSection = document.createElement('div');
    imgSection.className = 'section-images';
    imgSection.innerHTML = `<h4>Images</h4><div class="img-grid"></div>`;
    
    const grid = imgSection.querySelector('.img-grid');
    data.images.forEach(img => {
      const imgEl = document.createElement('img');
      imgEl.src = img.thumbnail;
      imgEl.title = img.title;
      imgEl.onclick = () => window.open(img.link, '_blank');
      grid.appendChild(imgEl);
    });
    contentDiv.appendChild(imgSection);
  } else {
    contentDiv.innerHTML += `<div class="info-msg">No images found or API Key missing.</div>`;
  }

  // 2. 词典释义区域
  if (data.definitions && data.definitions.length > 0) {
    const defSection = document.createElement('div');
    defSection.className = 'section-def';
    const entry = data.definitions[0]; // 取第一个词条
    
    let phonetic = entry.phonetic || (entry.phonetics.find(p => p.text)?.text) || '';
    let html = `<h4>Definition <span class="phonetic">${phonetic}</span></h4>`;

    entry.meanings.forEach(meaning => {
      html += `<div class="meaning-block">
        <span class="part-of-speech">${meaning.partOfSpeech}</span>
        <ul>`;
      meaning.definitions.slice(0, 2).forEach(def => {
        html += `<li>${def.definition}</li>`;
        if (def.example) html += `<li class="example">"${def.example}"</li>`;
      });
      html += `</ul></div>`;
    });
    
    defSection.innerHTML = html;
    contentDiv.appendChild(defSection);
  } else {
    contentDiv.innerHTML += `<div class="info-msg">No definition found.</div>`;
  }

  // 3. 自定义词典按钮
  if (data.customUrl) {
    const btnSection = document.createElement('div');
    btnSection.className = 'section-action';
    const btn = document.createElement('button');
    btn.className = 'custom-btn';
    btn.textContent = 'View in Custom Dictionary';
    btn.onclick = () => {
      const targetUrl = data.customUrl + encodeURIComponent(word);
      window.open(targetUrl, '_blank');
    };
    btnSection.appendChild(btn);
    contentDiv.appendChild(btnSection);
  }
}

function renderError(msg) {
  const contentDiv = popupElement.querySelector('.popup-content');
  contentDiv.innerHTML = `<div class="error-msg">${msg}</div>`;
}

// 简单的拖拽实现
function enableDrag(element) {
  const header = element.querySelector('.popup-header');
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  header.onmousedown = (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = element.offsetLeft;
    initialTop = element.offsetTop;
    header.style.cursor = 'grabbing';
  };

  document.onmousemove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    element.style.left = `${initialLeft + dx}px`;
    element.style.top = `${initialTop + dy}px`;
  };

  document.onmouseup = () => {
    isDragging = false;
    header.style.cursor = 'grab';
  };
}
