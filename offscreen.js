// offscreen.js
chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message) {
    if (message.target !== 'offscreen') {
        return false;
    }

    if (message.action === 'offscreenPlayAudio') {
        playAudio(message.url);
    }
}

function playAudio(url) {
    const audio = new Audio(url);
    audio.play().catch(e => console.error('Offscreen Audio play failed:', e));
}
