// content.js
let popupNode = null;
let currentWord = '';
let isAutoAddOn = false;
let fetchedDataCache = null;

function createPopup() {
    if (popupNode) return popupNode;
    const host = document.createElement('div');
    host.id = 'wordlens-extension-host';
    host.style.position = 'absolute';
    host.style.zIndex = '2147483647';
    host.style.display = 'none';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content.css');
    shadow.appendChild(link);

    const container = document.createElement('div');
    container.className = 'wl-container';
    shadow.appendChild(container);

    popupNode = { host, shadow, container };

    let isDragging = false, startX, startY, initialLeft, initialTop;
    container.addEventListener('mousedown', e => {
        if (e.target.closest('.wl-header-drag')) {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = host.offsetLeft;
            initialTop = host.offsetTop;
            e.preventDefault();
        }
    });
    window.addEventListener('mousemove', e => {
        if (isDragging) {
            host.style.left = initialLeft + e.clientX - startX + 'px';
            host.style.top = initialTop + e.clientY - startY + 'px';
        }
    });
    window.addEventListener('mouseup', () => { isDragging = false; });

    return popupNode;
}

document.addEventListener('mouseup', async (e) => {
    if (e.target.closest('#wordlens-extension-host')) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (/^[A-Za-z\s\-]{1,50}$/.test(text)) {
        currentWord = text;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
            showPopup(rect, text);
            await loadSettingsAndState();
            fetchWordData(text);
        }
    } else {
        if (popupNode && popupNode.host) {
            popupNode.host.style.display = 'none';
            popupNode.host.style.left = '-9999px';
        }
    }
});

function showPopup(rect, text) {
    const { host, container, shadow } = createPopup();
    fetchedDataCache = null; // reset cache for new word

    let top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX;

    host.style.display = 'block';

    container.innerHTML = `
    <div class="wl-header wl-header-drag">
      <div class="wl-title">${text}</div>
      <button class="wl-close">&times;</button>
    </div>
    <div class="wl-toolbar">
      <button id="wl-btn-custom-dict">Dictionary</button>
      <button id="wl-btn-wordbook">View Wordbook</button>
      <button id="wl-btn-add" class="wl-btn-action">Add</button>
      <button id="wl-btn-remove" class="wl-btn-action">Remove</button>
      <label class="wl-toggle"><input type="checkbox" id="wl-auto-add"> Auto-add</label>
    </div>
    <div class="wl-content">
      <div class="wl-section">
        <h3>Images</h3>
        <div id="wl-images-container">Loading images...</div>
      </div>
      <div class="wl-section">
        <h3>Definition</h3>
        <div id="wl-dict-container">Loading dictionary...</div>
      </div>
    </div>
  `;

    shadow.querySelector('.wl-close').onclick = () => {
        host.style.display = 'none';
        host.style.left = '-9999px';
    };

    shadow.querySelector('#wl-btn-custom-dict').onclick = (e) => handleCustomDictClick(e, text);
    shadow.querySelector('#wl-btn-custom-dict').oncontextmenu = (e) => {
        e.preventDefault();
        alert('Please go to the extension popup to modify the custom dictionary URL.');
    };

    shadow.querySelector('#wl-btn-wordbook').onclick = () => {
        chrome.runtime.sendMessage({ action: 'openWordbook' });
    };

    const autoAddCheckbox = shadow.querySelector('#wl-auto-add');
    autoAddCheckbox.onchange = async (e) => {
        isAutoAddOn = e.target.checked;
        await chrome.storage.local.set({ autoAddConfig: isAutoAddOn });
        updateActionButtons();
        if (isAutoAddOn && fetchedDataCache) {
            saveWordData();
        }
    };

    shadow.querySelector('#wl-btn-add').onclick = () => saveWordData();
    shadow.querySelector('#wl-btn-remove').onclick = () => removeWordData();

    setTimeout(() => {
        const hostRect = container.getBoundingClientRect();
        if (left + hostRect.width > window.innerWidth + window.scrollX) {
            left = window.innerWidth + window.scrollX - hostRect.width - 20;
        }
        if (top + hostRect.height > window.innerHeight + window.scrollY) {
            top = rect.top + window.scrollY - hostRect.height - 10;
        }
        host.style.left = Math.max(0, left) + 'px';
        host.style.top = Math.max(0, top) + 'px';
    }, 0);
}

async function loadSettingsAndState() {
    const shadow = popupNode.shadow;
    const autoAddCheckbox = shadow.querySelector('#wl-auto-add');

    const res = await chrome.storage.local.get(['autoAddConfig', 'wordbook']);
    isAutoAddOn = !!res.autoAddConfig;
    const wbLength = (res.wordbook || []).length;

    if (wbLength >= 100) {
        isAutoAddOn = false;
        autoAddCheckbox.checked = false;
        autoAddCheckbox.disabled = true;
        shadow.querySelector('#wl-btn-add').disabled = true;
        shadow.querySelector('#wl-btn-remove').disabled = true;
    } else {
        autoAddCheckbox.disabled = false;
        autoAddCheckbox.checked = isAutoAddOn;
        updateActionButtons();
    }
}

function updateActionButtons() {
    const shadow = popupNode.shadow;
    const btnAdd = shadow.querySelector('#wl-btn-add');
    const btnRemove = shadow.querySelector('#wl-btn-remove');

    if (isAutoAddOn) {
        btnAdd.disabled = true;
        btnRemove.disabled = false;
    } else {
        btnAdd.disabled = false;
        btnRemove.disabled = true;
    }
}

async function fetchWordData(word) {
    const shadow = popupNode.shadow;
    const imgCont = shadow.querySelector('#wl-images-container');
    const dictCont = shadow.querySelector('#wl-dict-container');

    chrome.runtime.sendMessage({ action: 'fetchData', word }, (response) => {
        if (!response) {
            imgCont.innerHTML = 'Error communicating with background script.';
            dictCont.innerHTML = 'Error communicating with background script.';
            return;
        }

        fetchedDataCache = response;

        // Images
        if (response.imageError) {
            imgCont.innerHTML = `<div class="wl-error">${response.imageError}</div>`;
        } else {
            const images = response.images || [];
            if (images.length === 0) {
                imgCont.innerHTML = '<div>No images found.</div>';
            } else {
                const grid = document.createElement('div');
                grid.className = 'wl-images-grid';
                images.forEach(img => {
                    const a = document.createElement('a');
                    a.href = img.contextLink;
                    a.target = '_blank';
                    const i = document.createElement('img');
                    i.src = img.thumbnail;
                    i.onerror = () => { i.src = 'https://via.placeholder.com/80?text=Error'; };
                    a.appendChild(i);
                    grid.appendChild(a);
                });
                imgCont.innerHTML = '';
                imgCont.appendChild(grid);
            }
        }

        // Dictionary Render
        if (response.dictError) {
            dictCont.innerHTML = `<div class="wl-error">${response.dictError}</div>`;
        } else {
            const data = response.dictData && response.dictData[0];
            if (!data) {
                dictCont.innerHTML = '<div>No definitions found.</div>';
            } else {
                let meaningsHtml = '';
                let extractedData = {
                    word: data.word,
                    phonetic: data.phonetic || '',
                    audio: '',
                    meanings: []
                };

                // phonetics.audio
                if (data.phonetics) {
                    const audioPhonetic = data.phonetics.find(p => p.audio);
                    if (audioPhonetic) extractedData.audio = audioPhonetic.audio;
                    if (!extractedData.phonetic && data.phonetics.length > 0) {
                        const textPhonetic = data.phonetics.find(p => p.text);
                        if (textPhonetic) extractedData.phonetic = textPhonetic.text;
                    }
                }

                // Header
                meaningsHtml += `<div class="wl-meaning-header"><strong>${escapeHtml(extractedData.word)}</strong>`;
                if (extractedData.phonetic) {
                    meaningsHtml += ` <span class="wl-meaning-phonetic">${escapeHtml(extractedData.phonetic)}</span>`;
                }
                if (extractedData.audio) {
                    meaningsHtml += ` <button class="wl-meaning-audio-btn" onclick="new Audio('${extractedData.audio}').play()">&#128266;</button>`;
                }
                meaningsHtml += `</div>`;

                // meanings limits
                const topMeanings = data.meanings.slice(0, 2);

                topMeanings.forEach((m, mIndex) => {
                    let meaningObj = {
                        partOfSpeech: m.partOfSpeech,
                        definitions: [],
                        synonyms: m.synonyms || [],
                        antonyms: m.antonyms || []
                    };

                    meaningsHtml += `<div class="wl-meaning-pos">`;
                    meaningsHtml += `<em>${escapeHtml(m.partOfSpeech)}</em>`;

                    if (m.synonyms && m.synonyms.length > 0) {
                        meaningsHtml += `<div class="wl-meaning-synonyms">Synonyms: ${escapeHtml(m.synonyms.join(', '))}</div>`;
                    }
                    if (m.antonyms && m.antonyms.length > 0) {
                        meaningsHtml += `<div class="wl-meaning-antonyms">Antonyms: ${escapeHtml(m.antonyms.join(', '))}</div>`;
                    }

                    const topDefs = m.definitions.slice(0, 2);
                    topDefs.forEach((def, dIndex) => {
                        let defObj = {
                            definition: def.definition,
                            examples: []
                        };

                        meaningsHtml += `<div class="wl-meaning-def-container">`;
                        meaningsHtml += `<div>${dIndex + 1}. ${escapeHtml(def.definition)}</div>`;

                        let examplesArray = [];
                        if (Array.isArray(def.example)) {
                            examplesArray = def.example;
                        } else if (def.example) {
                            examplesArray = [def.example];
                        } else if (def.examples && Array.isArray(def.examples)) {
                            examplesArray = def.examples;
                        }

                        const topExamples = examplesArray.slice(0, 5);
                        defObj.examples = topExamples;

                        if (topExamples.length > 0) {
                            meaningsHtml += `<div class="wl-meaning-examples">`;
                            topExamples.forEach(ex => {
                                meaningsHtml += `<div>- ${escapeHtml(ex)}</div>`;
                            });
                            meaningsHtml += `</div>`;
                        }
                        meaningsHtml += `</div>`;
                        meaningObj.definitions.push(defObj);
                    });

                    meaningsHtml += `</div>`;
                    extractedData.meanings.push(meaningObj);
                });

                // Store for auto-add/wordbook
                fetchedDataCache.extracted = extractedData;
                dictCont.innerHTML = meaningsHtml;

                if (isAutoAddOn) saveWordData();
            }
        }
    });
}

function escapeHtml(unsafe) {
    return (unsafe || '').toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function handleCustomDictClick(e, word) {
    const syncData = await chrome.storage.sync.get(['customDictUrl']);
    const urlTemplate = syncData.customDictUrl || 'https://dictionary.cambridge.org/dictionary/english/{%s}';
    const url = urlTemplate.replace('{%s}', encodeURIComponent(word));
    window.open(url, '_blank');
}

async function saveWordData() {
    if (!fetchedDataCache || !fetchedDataCache.extracted) return;
    const { wordbook } = await chrome.storage.local.get(['wordbook']);
    const wb = wordbook || [];

    if (wb.length >= 100) {
        alert('单词本已满 (Wordbook is full)');
        const shadow = popupNode.shadow;
        shadow.querySelector('#wl-btn-add').disabled = true;
        shadow.querySelector('#wl-auto-add').disabled = true;
        isAutoAddOn = false;
        shadow.querySelector('#wl-auto-add').checked = false;
        await chrome.storage.local.set({ autoAddConfig: false });
        updateActionButtons();
        return;
    }

    const existingIndex = wb.findIndex(item => item.word === currentWord);
    if (existingIndex === -1) {
        // Flatten extracted complex data for the wordbook table
        const exData = fetchedDataCache.extracted;
        let defText = '';
        let exText = '';
        let synText = [];
        let antText = [];

        exData.meanings.forEach(m => {
            m.definitions.forEach(d => {
                if (!defText) defText = d.definition;
                if (!exText && d.examples.length > 0) exText = d.examples[0];
            });
            if (m.synonyms) synText = synText.concat(m.synonyms);
            if (m.antonyms) antText = antText.concat(m.antonyms);
        });

        const flattened = {
            word: currentWord,
            definition: defText || '',
            example: exText || '',
            synonyms: [...new Set(synText)],
            antonyms: [...new Set(antText)],
            rawDictData: exData // Save raw data for future usage if needed
        };

        wb.push(flattened);
        await chrome.storage.local.set({ wordbook: wb });
    }
}

async function removeWordData() {
    const { wordbook } = await chrome.storage.local.get(['wordbook']);
    if (!wordbook) return;
    const newWb = wordbook.filter(item => item.word !== currentWord);
    await chrome.storage.local.set({ wordbook: newWb });
}
