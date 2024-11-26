class Storage {
    static async getNotes(url) {
        return new Promise((resolve) => {
            chrome.storage.local.get(url, (result) => {
                const data = result[url] || { content: '', createdAt: '', lastEdited: '', tags: [], collectionId: null };
                console.log('Retrieved notes for URL', url, ':', data);
                resolve(data);
            });
        });
    }

    static async saveNotes(url, notes, tags = [], collectionId = null) {
        return new Promise((resolve) => {
            chrome.storage.local.get(url, (result) => {
                const existingData = result[url] || {};
                const currentTime = new Date().toISOString();
                
                // Ensure we're not overwriting existing metadata if not provided
                const updatedData = {
                    content: notes,
                    lastEdited: currentTime,
                    createdAt: existingData.createdAt || currentTime,
                    tags: Array.isArray(tags) ? tags : existingData.tags || [],
                    collectionId: collectionId !== undefined ? collectionId : existingData.collectionId
                };

                console.log('Saving note with data:', { url, updatedData });
                
                chrome.storage.local.set({ [url]: updatedData }, () => {
                    console.log('Saved notes for URL', url, ':', updatedData);
                    const hasNotes = notes.trim().length > 0;
                    chrome.runtime.sendMessage({
                        type: 'updateBadge',
                        payload: { url, hasNotes },
                    });
                    resolve(updatedData);
                });
            });
        });
    }

    static async getAllNotes() {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, (result) => {
                // Filter out the collections key from the notes
                const notes = Object.fromEntries(
                    Object.entries(result).filter(([key]) => key !== 'collections')
                );
                console.log('All stored notes:', notes);
                resolve(notes);
            });
        });
    }

    static async getAllNotesWithUrls() {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, (result) => {
                const notesWithUrls = Object.entries(result)
                    .filter(([key]) => key !== 'collections') // Exclude the collections data
                    .map(([url, data]) => ({
                        url,
                        notes: data.content,
                        createdAt: data.createdAt,
                        lastEdited: data.lastEdited,
                        tags: Array.isArray(data.tags) ? data.tags : [],
                        collectionId: data.collectionId
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

    static async getAllTags() {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, (result) => {
                const allTags = new Set();
                Object.values(result).forEach(data => {
                    if (Array.isArray(data.tags)) {
                        data.tags.forEach(tag => allTags.add(tag));
                    }
                });
                resolve(Array.from(allTags));
            });
        });
    }

    static async getCollections() {
        return new Promise((resolve) => {
            chrome.storage.local.get('collections', (result) => {
                resolve(result.collections || []);
            });
        });
    }

    static async saveCollection(collection) {
        return new Promise((resolve) => {
            chrome.storage.local.get('collections', (result) => {
                const collections = result.collections || [];
                const collectionId = collection.id || crypto.randomUUID();
                
                const newCollection = {
                    id: collectionId,
                    name: collection.name,
                    createdAt: collection.createdAt || new Date().toISOString(),
                    color: collection.color || '#808080'
                };

                const existingIndex = collections.findIndex(c => c.id === collectionId);
                if (existingIndex !== -1) {
                    collections[existingIndex] = newCollection;
                } else {
                    collections.push(newCollection);
                }

                chrome.storage.local.set({ collections }, () => resolve(newCollection));
            });
        });
    }

    static async deleteCollection(collectionId) {
        return new Promise((resolve) => {
            Promise.all([
                // Remove collection from collections list
                new Promise((res) => {
                    chrome.storage.local.get('collections', (result) => {
                        const collections = (result.collections || []).filter(c => c.id !== collectionId);
                        chrome.storage.local.set({ collections }, res);
                    });
                }),
                // Remove collection reference from all notes
                this.getAllNotes().then(async (notes) => {
                    const updates = {};
                    Object.entries(notes).forEach(([url, data]) => {
                        if (data.collectionId === collectionId) {
                            updates[url] = { ...data, collectionId: null };
                        }
                    });
                    if (Object.keys(updates).length > 0) {
                        await new Promise(res => chrome.storage.local.set(updates, res));
                    }
                })
            ]).then(resolve);
        });
    }
}