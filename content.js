let popupNode = null;
let currentWord = '';
let isAutoAddOn = false;
let isAutoPlayOn = false;
let fetchedDataCache = null;

function createPopup() {
    if (popupNode) return popupNode;
    const host = document.createElement('div');
    host.id = 'wordlens-extension-host';
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    host.style.display = 'none';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content.css');
    shadow.appendChild(link);

    const container = document.createElement('div');
    container.className = 'container';
    shadow.appendChild(container);

    popupNode = { host, shadow, container };

    let isDragging = false, startX, startY, initialLeft, initialTop;
    container.addEventListener('mousedown', e => {
        if (e.target.closest('.wl-header-drag')) {
            isDragging = true;
            const rect = host.getBoundingClientRect();
            host.style.transform = 'none';
            host.style.left = rect.left + 'px';
            host.style.top = rect.top + 'px';
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = rect.left;
            initialTop = rect.top;
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

    host.style.left = '50%';
    host.style.top = '50%';
    host.style.transform = 'translate(-50%, -50%)';
    host.style.display = 'block';

    container.innerHTML = `
  

        <div class="wl-header wl-header-drag">
            <div class="wl-title">${text}</div>
            
            <button class="wl-close">&times;</button>
        </div>

        <div class="wl-toolbar">
            <div class="wl-btn-dictionarys" id="wl-dictionaries-container">
                <!-- Dictionary buttons will be injected here -->
            </div>

            <div class="wl-btn-wordbook">
                <button id="wl-btn-wordbook">Wordbook</button>
                <button id="wl-btn-add" class="wl-btn-action">Add this word</button>
                <button id="wl-btn-remove" class="wl-btn-action">Remove this word</button>
                <label class="wl-toggle"><input type="checkbox" id="wl-auto-add"> Auto-add</label>
            </div>
        </div>

        <div class="wl-content">
            <div class="wl-section">
                <div id="wl-images-container">Loading images...</div>
            </div>

            <div class="wl-section">
                <div id="wl-dict-container">Loading dictionary...</div>
            </div>
        </div>


  `;

    shadow.querySelector('.wl-close').onclick = () => {
        host.style.display = 'none';
        host.style.left = '-9999px';
    };

    // Load custom dictionaries and render buttons
    chrome.storage.sync.get(['dictionaries', 'customDictUrl'], (syncData) => {
        const dictContainer = shadow.querySelector('#wl-dictionaries-container');
        let dicts = [];

        if (syncData.dictionaries && syncData.dictionaries.length > 0) {
            dicts = syncData.dictionaries;
        } else if (syncData.customDictUrl) {
            dicts = [{ name: 'Dictionary', url: syncData.customDictUrl }];
        } else {
            dicts = [{ name: 'Cambridge', url: 'https://dictionary.cambridge.org/dictionary/english/' }];
        }

        dicts.forEach(d => {
            const btn = document.createElement('button');
            btn.textContent = d.name || 'Dict';
            btn.className = 'wl-btn-dict';
            btn.onclick = (e) => {
                let url = d.url;
                // Make sure the base URL ends appropriately before appending
                if (!url.endsWith('/') && !url.includes('=')) {
                    url += '/';
                }
                url += encodeURIComponent(text);
                window.open(url, '_blank');
            };
            btn.oncontextmenu = (e) => {
                e.preventDefault();
                alert('Please go to the extension popup to modify dictionaries.');
            };
            dictContainer.appendChild(btn);
        });
    });

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
}

async function loadSettingsAndState() {
    const shadow = popupNode.shadow;
    const autoAddCheckbox = shadow.querySelector('#wl-auto-add');
    const wordbookBtn = shadow.querySelector('#wl-btn-wordbook');

    const res = await chrome.storage.local.get(['autoAddConfig', 'autoPlayConfig', 'wordbook']);
    isAutoAddOn = !!res.autoAddConfig;
    isAutoPlayOn = !!res.autoPlayConfig;
    const wbLength = (res.wordbook || []).length;

    if (wbLength >= 100) {
        isAutoAddOn = false;
        autoAddCheckbox.checked = false;
        autoAddCheckbox.disabled = true;
        shadow.querySelector('#wl-btn-add').disabled = true;
        shadow.querySelector('#wl-btn-remove').disabled = true;
        if (wordbookBtn) {
            wordbookBtn.classList.add('wl-btn-full');
            wordbookBtn.title = 'wordbook is full, please clear wordbook';
        }
    } else {
        autoAddCheckbox.disabled = false;
        autoAddCheckbox.checked = isAutoAddOn;
        updateActionButtons();
        if (wordbookBtn) {
            wordbookBtn.classList.remove('wl-btn-full');
            wordbookBtn.title = '';
        }
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
                    meaningsHtml += ` <button class="wl-meaning-audio-btn" data-audio="${extractedData.audio}">&#128266;</button>`;
                    meaningsHtml += ` <label class="wl-toggle wl-audio-auto-play"><input type="checkbox" id="wl-auto-play"> Auto-play</label>`;
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

                const audioBtn = dictCont.querySelector('.wl-meaning-audio-btn');
                const autoPlayCheckbox = dictCont.querySelector('#wl-auto-play');

                if (audioBtn) {
                    const audioUrl = audioBtn.getAttribute('data-audio');
                    audioBtn.onclick = () => {
                        chrome.runtime.sendMessage({ action: 'playAudio', url: audioUrl });
                    };

                    if (autoPlayCheckbox) {
                        autoPlayCheckbox.checked = isAutoPlayOn;
                        autoPlayCheckbox.onchange = async (e) => {
                            isAutoPlayOn = e.target.checked;
                            await chrome.storage.local.set({ autoPlayConfig: isAutoPlayOn });
                        };

                        if (isAutoPlayOn) {
                            chrome.runtime.sendMessage({ action: 'playAudio', url: audioUrl });
                        }
                    }
                }

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

async function saveWordData() {
    if (!fetchedDataCache || !fetchedDataCache.extracted) return;
    const { wordbook } = await chrome.storage.local.get(['wordbook']);
    const wb = wordbook || [];

    if (wb.length >= 100) {
        alert('Wordbook is full');
        const shadow = popupNode.shadow;
        shadow.querySelector('#wl-btn-add').disabled = true;
        shadow.querySelector('#wl-auto-add').disabled = true;
        isAutoAddOn = false;
        shadow.querySelector('#wl-auto-add').checked = false;

        const wordbookBtn = shadow.querySelector('#wl-btn-wordbook');
        if (wordbookBtn) {
            wordbookBtn.classList.add('wl-btn-full');
            wordbookBtn.title = 'wordbook is full, please clear wordbook';
        }

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

        showWordbookCounterAnim('+1');

        if (wb.length >= 100) {
            await loadSettingsAndState();
        }
    }
}

async function removeWordData() {
    const { wordbook } = await chrome.storage.local.get(['wordbook']);
    if (!wordbook) return;

    // Only animate if the word was actually removed
    const existingIndex = wordbook.findIndex(item => item.word === currentWord);
    if (existingIndex === -1) return;

    const newWb = wordbook.filter(item => item.word !== currentWord);
    await chrome.storage.local.set({ wordbook: newWb });

    showWordbookCounterAnim('-1');

    // Check if we dropped below 100 and need to clear the full status
    if (wordbook.length >= 100 && newWb.length < 100) {
        await loadSettingsAndState();
    }
}

function showWordbookCounterAnim(text) {
    const shadow = popupNode.shadow;
    const wordbookBtn = shadow.querySelector('#wl-btn-wordbook');
    if (!wordbookBtn) return;

    const container = shadow.querySelector('.wl-btn-wordbook');

    const animEl = document.createElement('div');
    animEl.className = 'wl-counter-anim';
    animEl.textContent = text;
    if (text === '-1') {
        animEl.style.color = '#dc3545'; // red for remove
    }

    container.appendChild(animEl);

    // Trigger animation then remove
    setTimeout(() => {
        animEl.remove();
    }, 1500);
}
