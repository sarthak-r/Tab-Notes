class Storage {
    static async getNotes(url) {
        return new Promise((resolve) => {
            chrome.storage.local.get(url, (result) => {
                const data = result[url] || { content: '', createdAt: '', lastEdited: '' };
                console.log('Retrieved notes for URL', url, ':', data);
                resolve(data);
            });
        });
    }

    static async saveNotes(url, notes) {
        return new Promise((resolve) => {
            chrome.storage.local.get(url, (result) => {
                const existingData = result[url] || {};
                const currentTime = new Date().toISOString();
                const updatedData = {
                    content: notes,
                    lastEdited: currentTime,
                    createdAt: existingData.createdAt || currentTime
                };
                chrome.storage.local.set({ [url]: updatedData }, () => {
                    console.log('Saved notes for URL', url, ':', updatedData);
                    const hasNotes = notes.trim().length > 0;
                    chrome.runtime.sendMessage({
                        type: 'updateBadge',
                        payload: { url, hasNotes },
                    });
                    resolve();
                });
            });
        });
    }

    static async getAllNotes() {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, (result) => {
                console.log('All stored notes:', result);
                resolve(result);
            });
        });
    }

    static async getAllNotesWithUrls() {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, (result) => {
                const notesWithUrls = Object.entries(result).map(([url, data]) => ({
                    url,
                    notes: data.content,
                    createdAt: data.createdAt,
                    lastEdited: data.lastEdited
                }));
                console.log('All stored notes with URLs:', notesWithUrls);
                resolve(notesWithUrls);
            });
        });
    }

    static async deleteNotes(url) {
        return new Promise((resolve) => {
            chrome.storage.local.remove(url, () => {
                console.log('Deleted notes for URL:', url);
                resolve();
            });
        });
    }
}