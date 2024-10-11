importScripts('lib/storage.js');

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        const notes = await Storage.getNotes(tab.url);
        if (notes) {
            chrome.action.setBadgeText({ text: '📝', tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#FFA500', tabId });
        } else {
            chrome.action.setBadgeText({ text: '', tabId });
        }
    }
});

// Update badge when notes are saved
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'updateBadge') {
        const { url, hasNotes } = request.payload;
        chrome.tabs.query({ url }, (tabs) => {
            tabs.forEach(tab => {
                if (hasNotes) {
                    chrome.action.setBadgeText({ text: '📝', tabId: tab.id });
                    chrome.action.setBadgeBackgroundColor({ color: '#FFA500', tabId: tab.id });
                } else {
                    chrome.action.setBadgeText({ text: '', tabId: tab.id });
                }
            });
        });
    }
});