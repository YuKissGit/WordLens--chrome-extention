// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const pixabayKeyInput = document.getElementById('pixabayKey');
    const customDictUrlInput = document.getElementById('customDictUrl');
    const saveBtn = document.getElementById('saveBtn');
    const instructionBtn = document.getElementById('instructionBtn');
    const statusDiv = document.getElementById('status');

    // Load existing
    chrome.storage.sync.get(['pixabayKey', 'customDictUrl'], (items) => {
        if (items.pixabayKey) pixabayKeyInput.value = items.pixabayKey;
        if (items.customDictUrl) customDictUrlInput.value = items.customDictUrl;
    });

    saveBtn.addEventListener('click', () => {
        const url = customDictUrlInput.value.trim();

        if (url && !/^https?:\/\/.+/.test(url)) {
            statusDiv.textContent = 'Invalid URL format';
            statusDiv.className = 'error';
            return;
        }

        chrome.storage.sync.set({
            pixabayKey: pixabayKeyInput.value.trim(),
            customDictUrl: url || 'https://dictionary.cambridge.org/dictionary/english/{%s}'
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
