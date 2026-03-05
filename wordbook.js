// wordbook.js
document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('#wordTable tbody');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    let currentWords = [];

    function loadWords() {
        chrome.storage.local.get(['wordbook'], (res) => {
            currentWords = res.wordbook || [];
            renderTable();
        });
    }

    function renderTable() {
        tbody.innerHTML = '';
        if (currentWords.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No words saved yet.</td></tr>';
            return;
        }

        currentWords.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td><strong>${escapeHtml(item.word)}</strong></td>
        <td>${escapeHtml(item.definition || '')}</td>
        <td>${escapeHtml(item.example || '')}</td>
        <td>${escapeHtml((item.synonyms || []).join(', '))}</td>
        <td>${escapeHtml((item.antonyms || []).join(', '))}</td>
      `;
            tbody.appendChild(tr);
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

    copyBtn.addEventListener('click', () => {
        if (currentWords.length === 0) return alert('Wordbook is empty.');

        let text = 'Word\tDefinition\tExample\tSynonyms\tAntonyms\n';
        currentWords.forEach(item => {
            text += `${item.word}\t${item.definition || ''}\t${item.example || ''}\t${(item.synonyms || []).join(', ')}\t${(item.antonyms || []).join(', ')}\n`;
        });

        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        }).catch(err => {
            alert('Failed to copy. Please allow clipboard permissions.');
        });
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your entire wordbook?')) {
            chrome.storage.local.set({ wordbook: [] }, () => {
                loadWords();
            });
        }
    });

    loadWords();
});
