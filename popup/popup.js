document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup script loaded');
    const errorMessageElement = document.getElementById('error-message');
    const editor = document.getElementById('editor');
    const tagsInput = document.getElementById('tags-input');
    const collectionSelect = document.getElementById('collection-select');
    const addCollectionButton = document.querySelector('.add-collection-button');
    const viewAllButton = document.getElementById('view-all');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    
    let currentUrl = '';
    let currentTags = [];
    let currentCollectionId = null;

    try {
        // Get current tab URL
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentUrl = tab.url;

        // Load existing notes and metadata
        const noteData = await Storage.getNotes(currentUrl);
        editor.innerHTML = noteData.content || '';
        currentTags = noteData.tags || [];
        currentCollectionId = noteData.collectionId;

        // Initialize collections and tags
        await loadCollections();
        renderTags();

        // Event Listeners
        editor.addEventListener('input', debounce(async () => {
            await Storage.saveNotes(currentUrl, editor.innerHTML, currentTags, currentCollectionId);
        }, 500));

        tagsInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && tagsInput.value.trim()) {
                e.preventDefault();
                const newTag = tagsInput.value.trim();
                if (!currentTags.includes(newTag)) {
                    currentTags.push(newTag);
                    await Storage.saveNotes(currentUrl, editor.innerHTML, currentTags, currentCollectionId);
                    renderTags();
                }
                tagsInput.value = '';
            }
        });

        collectionSelect.addEventListener('change', async () => {
            currentCollectionId = collectionSelect.value;
            await Storage.saveNotes(currentUrl, editor.innerHTML, currentTags, currentCollectionId);
        });

        addCollectionButton.addEventListener('click', async () => {
            const name = prompt('Enter collection name:');
            if (name) {
                const color = '#' + Math.floor(Math.random()*16777215).toString(16);
                const collection = await Storage.saveCollection({ name, color });
                currentCollectionId = collection.id;
                await loadCollections();
                await Storage.saveNotes(currentUrl, editor.innerHTML, currentTags, currentCollectionId);
            }
        });

        viewAllButton.addEventListener('click', () => {
            chrome.tabs.create({ url: 'all-notes/all-notes.html' });
        });

        // Dark mode
        darkModeToggle.addEventListener('change', (e) => {
            toggleDarkMode(e.target.checked);
        });

        // Load user's dark mode preference
        chrome.storage.sync.get('darkMode', (result) => {
            const isDarkMode = result.darkMode || false;
            toggleDarkMode(isDarkMode);
        });

    } catch (error) {
        console.error('Error in popup script:', error);
        if (errorMessageElement) {
            errorMessageElement.textContent = 'An error occurred: ' + error.message;
        }
    }

    // Helper functions
    async function loadCollections() {
        const collections = await Storage.getCollections();
        collectionSelect.innerHTML = '<option value="">No Collection</option>' +
            collections.map(c => `<option value="${c.id}" ${c.id === currentCollectionId ? 'selected' : ''}>${c.name}</option>`).join('');
    }

    function renderTags() {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';
        tagsContainer.innerHTML = currentTags.map(tag => `
            <span class="tag">
                ${tag}
                <span class="remove-tag" data-tag="${tag}">&times;</span>
            </span>
        `).join('');
        
        const existingContainer = document.querySelector('.tags-container');
        if (existingContainer) {
            existingContainer.replaceWith(tagsContainer);
        } else {
            tagsInput.insertAdjacentElement('afterend', tagsContainer);
        }

        // Add event listeners for tag removal
        tagsContainer.querySelectorAll('.remove-tag').forEach(button => {
            button.addEventListener('click', async () => {
                const tagToRemove = button.dataset.tag;
                currentTags = currentTags.filter(t => t !== tagToRemove);
                await Storage.saveNotes(currentUrl, editor.innerHTML, currentTags, currentCollectionId);
                renderTags();
            });
        });
    }

    function toggleDarkMode(isDark) {
        document.body.classList.toggle('dark-mode', isDark);
        darkModeToggle.checked = isDark;
        chrome.storage.sync.set({ darkMode: isDark });
    }

    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
});
