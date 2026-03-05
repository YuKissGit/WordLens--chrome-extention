// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const pixabayKeyInput = document.getElementById('pixabayKey');
    const dictionariesList = document.getElementById('dictionariesList');
    const addDictBtn = document.getElementById('addDictBtn');
    const saveBtn = document.getElementById('saveBtn');
    const instructionBtn = document.getElementById('instructionBtn');
    const statusDiv = document.getElementById('status');

    // Load existing
    chrome.storage.sync.get(['pixabayKey', 'customDictUrl', 'dictionaries'], (items) => {
        if (items.pixabayKey) pixabayKeyInput.value = items.pixabayKey;

        let dicts = [];
        if (items.dictionaries && items.dictionaries.length > 0) {
            dicts = items.dictionaries;
        } else if (items.customDictUrl) {
            // Migrate old customDictUrl
            dicts = [{ name: 'Dictionary', url: items.customDictUrl }];
        } else {
            // Default
            dicts = [{ name: 'Cambridge', url: 'https://dictionary.cambridge.org/dictionary/english/' }];
        }

        dicts.forEach(d => addDictionaryRow(d.name, d.url));
    });

    function addDictionaryRow(name = '', url = '') {
        const item = document.createElement('div');
        item.className = 'dict-item';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'dict-name';
        nameInput.placeholder = 'Name';
        nameInput.value = name;

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.className = 'dict-url';
        urlInput.placeholder = 'URL';
        urlInput.value = url;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-icon dict-btn-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remove';
        removeBtn.onclick = () => item.remove();

        item.appendChild(nameInput);
        item.appendChild(urlInput);
        item.appendChild(removeBtn);

        dictionariesList.appendChild(item);
    }

    addDictBtn.addEventListener('click', () => {
        const dictItems = dictionariesList.querySelectorAll('.dict-item');
        if (dictItems.length >= 5) {
            alert('You can only add up to 5 custom dictionaries.');
            return;
        }
        addDictionaryRow('', '');
    });

    saveBtn.addEventListener('click', () => {
        const dictItems = dictionariesList.querySelectorAll('.dict-item');
        const dictionaries = [];
        let hasError = false;

        dictItems.forEach(item => {
            const name = item.querySelector('.dict-name').value.trim();
            const url = item.querySelector('.dict-url').value.trim();
            if (name || url) {
                if (url && !/^https?:\/\/.+/.test(url)) {
                    hasError = true;
                }
                dictionaries.push({ name: name || 'Dict', url });
            }
        });

        if (hasError) {
            statusDiv.textContent = 'Invalid URL format in dictionaries';
            statusDiv.className = 'error';
            return;
        }

        if (dictionaries.length === 0) {
            dictionaries.push({ name: 'Cambridge', url: 'https://dictionary.cambridge.org/dictionary/english/' });
        }

        chrome.storage.sync.set({
            pixabayKey: pixabayKeyInput.value.trim(),
            dictionaries: dictionaries
        }, () => {
            statusDiv.textContent = 'Saved successfully!';
            statusDiv.className = '';
            setTimeout(() => {
                statusDiv.textContent = '';
            }, 2000);
        });
    });

    instructionBtn.addEventListener('click', () => {
        window.open('https://github.com/your-repo/wordlens-extension', '_blank');
    });
});
