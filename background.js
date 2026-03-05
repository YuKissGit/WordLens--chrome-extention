// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchData') {
        handleFetch(request.word).then(sendResponse);
        return true; // Keep message channel open for async response
    }
    if (request.action === 'openWordbook') {
        chrome.tabs.create({ url: chrome.runtime.getURL('wordbook.html') });
        sendResponse({ success: true });
    }
    if (request.action === 'playAudio') {
        if (request.url) {
            setupOffscreenDocument('offscreen.html')
                .then(() => {
                    chrome.runtime.sendMessage({
                        action: 'offscreenPlayAudio',
                        url: request.url,
                        target: 'offscreen'
                    });
                })
                .catch(err => console.error('Error setting up offscreen document:', err));
            sendResponse({ success: true });
        }
    }
});

let creating; // A global promise to avoid race conditions
async function setupOffscreenDocument(path) {
    if (await chrome.offscreen.hasDocument()) return;

    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
            justification: 'To play dictionary pronunciation audio'
        });
        await creating;
        creating = null;
    }
}

async function handleFetch(word) {
    try {
        const syncData = await chrome.storage.sync.get(['pixabayKey']);
        const { pixabayKey } = syncData;

        let images = [];
        let imageError = null;

        if (!pixabayKey) {
            imageError = 'Pixabay API Key not configured in Popup.';
        } else {
            try {
                // Fetch 12 images from Pixabay
                const pixabayRes = await fetch(`https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(word)}&per_page=12&image_type=photo`);

                if (!pixabayRes.ok) {
                    const errorText = await pixabayRes.text();
                    imageError = `Pixabay API Error: ${errorText || pixabayRes.statusText}`;
                } else {
                    const pixabayData = await pixabayRes.json();
                    if (pixabayData.hits) {
                        const pixabayImages = pixabayData.hits.map(item => ({
                            thumbnail: item.previewURL,
                            contextLink: item.pageURL,
                            source: 'pixabay'
                        }));
                        images = images.concat(pixabayImages);
                    } else if (pixabayData.error) {
                        imageError = 'Pixabay Error: ' + pixabayData.error;
                    }
                }
            } catch (e) {
                imageError = e.message;
            }
        }

        let dictData = null;
        let dictError = null;
        try {
            const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
            if (dictRes.ok) {
                const json = await dictRes.json();
                dictData = json;
            } else {
                dictError = 'Word meaning not found.';
            }
        } catch (e) {
            dictError = e.message;
        }

        return { images, imageError, dictData, dictError };
    } catch (error) {
        return { error: error.message };
    }
}
