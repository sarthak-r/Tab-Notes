document.addEventListener('DOMContentLoaded', async () => {
    const notesContainer = document.getElementById('notes-container');
    const searchInput = document.getElementById('search');
    const sortSelect = document.getElementById('sort');
    const backToTopButton = document.getElementById('back-to-top');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const filterPanel = document.getElementById('filter-panel');
    const closeModalButton = document.querySelector('.close');
    const addCollectionButton = document.getElementById('add-collection');
    const collectionNameInput = document.getElementById('collection-name');
    const collectionColorInput = document.getElementById('collection-color');
    
    console.log('Modal elements:', { 
        filterPanel, 
        closeModalButton, 
        addCollectionButton, 
        collectionNameInput, 
        collectionColorInput 
    });

    let allNotes = [];
    let allTags = [];
    let collections = [];
    let activeFilters = {
        tags: new Set(),
        collection: null,
        search: ''
    };

    function formatDate(dateString) {
        return new Date(dateString).toLocaleString();
    }

    async function openOrSwitchToTab(url) {
        return new Promise((resolve) => {
            chrome.tabs.query({}, (tabs) => {
                const existingTab = tabs.find(tab => tab.url === url);
                if (existingTab) {
                    chrome.tabs.update(existingTab.id, { active: true });
                    chrome.windows.update(existingTab.windowId, { focused: true });
                    resolve();
                } else {
                    chrome.tabs.create({ url: url }, resolve);
                }
            });
        });
    }

    function sortNotes(notes, criteria) {
        switch(criteria) {
            case 'date-desc':
                return notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            case 'date-asc':
                return notes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            default:
                return notes;
        }
    }

    function filterNotes(notes) {
        return notes.filter(note => {
            // Search filter
            const searchMatch = !activeFilters.search || 
                note.url.toLowerCase().includes(activeFilters.search.toLowerCase()) || 
                note.notes.toLowerCase().includes(activeFilters.search.toLowerCase());

            // Tags filter
            const tagMatch = activeFilters.tags.size === 0 || 
                note.tags.some(tag => activeFilters.tags.has(tag));

            // Collection filter
            let collectionMatch = true;
            if (activeFilters.collection === 'uncategorized') {
                collectionMatch = !note.collectionId;
            } else if (activeFilters.collection) {
                collectionMatch = note.collectionId === activeFilters.collection;
            }

            return searchMatch && tagMatch && collectionMatch;
        });
    }

    function renderFilterPanel() {
        // Render collections list
        const collectionsContainer = document.createElement('div');
        collectionsContainer.className = 'filter-section collections-section';
        
        const collectionsList = collections.map(c => {
            const noteCount = allNotes.filter(note => note.collectionId === c.id).length;
            return `
                <div class="collection-item ${activeFilters.collection === c.id ? 'active' : ''}" 
                     data-id="${c.id}">
                    <div class="collection-color" style="background: ${c.color}"></div>
                    <div class="collection-info">
                        <span class="collection-name">${c.name}</span>
                        <span class="note-count">${noteCount} note${noteCount !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            `;
        });

        const uncategorizedCount = allNotes.filter(note => !note.collectionId).length;
        
        collectionsContainer.innerHTML = `
            <div class="collections-header">
                <h3>Collections</h3>
                <button type="button" class="add-collection-button" title="Add Collection">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div class="collection-form" style="display: none;">
                <div class="inline-collection-form">
                    <input type="text" id="collection-name" placeholder="Collection name">
                    <div class="color-picker-wrapper">
                        <input type="color" id="collection-color" value="#1a73e8">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="save-collection" title="Save">
                            <i class="fas fa-check"></i>
                        </button>
                        <button type="button" class="cancel-collection" title="Cancel">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="collections-list">
                <div class="collection-item ${!activeFilters.collection ? 'active' : ''}" 
                     data-id="">
                    <div class="collection-color" style="background: #808080"></div>
                    <div class="collection-info">
                        <span class="collection-name">All Notes</span>
                        <span class="note-count">${allNotes.length} note${allNotes.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                ${collectionsList.join('')}
                <div class="collection-item ${activeFilters.collection === 'uncategorized' ? 'active' : ''}" 
                     data-id="uncategorized">
                    <div class="collection-color" style="background: #d3d3d3"></div>
                    <div class="collection-info">
                        <span class="collection-name">Uncategorized</span>
                        <span class="note-count">${uncategorizedCount} note${uncategorizedCount !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners for collections
        filterPanel.innerHTML = '';
        filterPanel.appendChild(collectionsContainer);

        // Collection form handlers
        const addButton = filterPanel.querySelector('.add-collection-button');
        const collectionForm = filterPanel.querySelector('.collection-form');
        const nameInput = filterPanel.querySelector('#collection-name');
        const colorInput = filterPanel.querySelector('#collection-color');
        const saveButton = filterPanel.querySelector('.save-collection');
        const cancelButton = filterPanel.querySelector('.cancel-collection');

        addButton.addEventListener('click', () => {
            collectionForm.style.display = 'block';
            nameInput.focus();
        });

        saveButton.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (name) {
                await Storage.saveCollection({
                    name,
                    color: colorInput.value
                });
                nameInput.value = '';
                collectionForm.style.display = 'none';
                await loadNotes();
            }
        });

        cancelButton.addEventListener('click', () => {
            nameInput.value = '';
            collectionForm.style.display = 'none';
        });

        nameInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const name = nameInput.value.trim();
                if (name) {
                    await Storage.saveCollection({
                        name,
                        color: colorInput.value
                    });
                    nameInput.value = '';
                    collectionForm.style.display = 'none';
                    await loadNotes();
                }
            }
        });

        // Collection item click handlers
        document.querySelectorAll('.collection-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                document.querySelectorAll('.collection-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                activeFilters.collection = id || null;
                loadNotes();
            });
        });

        // Render tags section...
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'filter-section';
        tagsContainer.innerHTML = `
            <h3>Tags</h3>
            <div class="tags-list">
                ${allTags.map(tag => `
                    <label class="tag-filter">
                        <input type="checkbox" value="${tag}" 
                            ${activeFilters.tags.has(tag) ? 'checked' : ''}>
                        ${tag}
                    </label>
                `).join('')}
            </div>
        `;

        filterPanel.appendChild(tagsContainer);

        // Add event listeners for tags
        document.querySelectorAll('.tag-filter input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    activeFilters.tags.add(e.target.value);
                } else {
                    activeFilters.tags.delete(e.target.value);
                }
                loadNotes();
            });
        });
    }

    async function loadNotes() {
        try {
            // Get notes
            if (!allNotes.length) {
                allNotes = await Storage.getAllNotesWithUrls();
            }
            
            // Get all unique tags
            allTags = [...new Set(allNotes.flatMap(note => note.tags || []))];
            
            // Get collections
            collections = await Storage.getCollections();

            // Render filter panel
            renderFilterPanel();

            // Apply filters
            let filteredNotes = filterNotes(allNotes);

            // Apply sorting
            const sortCriteria = sortSelect.value;
            filteredNotes = sortNotes(filteredNotes, sortCriteria);

            notesContainer.innerHTML = '';
            if (filteredNotes.length === 0) {
                notesContainer.innerHTML = '<p class="no-notes">No notes found.</p>';
                return;
            }

            filteredNotes.forEach(({ url, notes, createdAt, lastEdited, tags = [], collectionId }) => {
                const collection = collections.find(c => c.id === collectionId);
                const noteElement = document.createElement('div');
                noteElement.className = 'note';
                noteElement.innerHTML = `
                    <div class="note-header">
                        <h2><a href="#" data-url="${url}">
                            <i class="fas fa-link" aria-hidden="true"></i> ${url}
                        </a></h2>
                        ${collection ? `
                            <div class="note-collection" style="background: ${collection.color}">
                                ${collection.name}
                            </div>
                        ` : ''}
                    </div>
                    <div class="note-content" contenteditable="true">${notes}</div>
                    <div class="note-tags">
                        ${tags.map(tag => `
                            <span class="tag">${tag}</span>
                        `).join('')}
                    </div>
                    <div class="note-timestamps">
                        <span><i class="fas fa-calendar-alt" aria-hidden="true"></i> Created: ${formatDate(createdAt)}</span>
                        <span><i class="fas fa-edit" aria-hidden="true"></i> Last edited: ${formatDate(lastEdited)}</span>
                    </div>
                    <div class="action-buttons">
                        <button class="save-note" data-url="${url}">
                            <i class="fas fa-save" aria-hidden="true"></i> Save
                        </button>
                        <button class="delete-note" data-url="${url}">
                            <i class="fas fa-trash-alt" aria-hidden="true"></i> Delete
                        </button>
                    </div>
                `;
                notesContainer.appendChild(noteElement);
            });

            // Add event listeners
            document.querySelectorAll('.note a').forEach(link => {
                link.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const url = e.target.closest('a').dataset.url;
                    await openOrSwitchToTab(url);
                });
            });

            document.querySelectorAll('.save-note').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const url = e.target.closest('.save-note').dataset.url;
                    const noteElement = e.target.closest('.note');
                    const content = noteElement.querySelector('.note-content').innerHTML;
                    const note = allNotes.find(n => n.url === url);
                    await Storage.saveNotes(url, content, note.tags, note.collectionId);
                });
            });

            document.querySelectorAll('.delete-note').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const url = e.target.closest('.delete-note').dataset.url;
                    const confirmDelete = confirm('Are you sure you want to delete this note?');
                    if (confirmDelete) {
                        await Storage.deleteNotes(url);
                        allNotes = await Storage.getAllNotesWithUrls(); // Refresh notes
                        loadNotes();
                    }
                });
            });
        } catch (error) {
            console.error('Error loading notes:', error);
            notesContainer.innerHTML = '<p class="error">Error loading notes. Please try again.</p>';
        }
    }

    // Search functionality with debounce
    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    searchInput.addEventListener('input', debounce(() => {
        activeFilters.search = searchInput.value.trim();
        loadNotes();
    }, 300));

    sortSelect.addEventListener('change', () => {
        loadNotes();
    });

    // Back to top button
    window.addEventListener('scroll', () => {
        if (document.documentElement.scrollTop > 100) {
            backToTopButton.style.display = 'block';
        } else {
            backToTopButton.style.display = 'none';
        }
    });

    backToTopButton.addEventListener('click', () => {
        document.documentElement.scrollTop = 0;
    });

    // Dark mode toggle
    function toggleDarkMode(isDark) {
        document.body.classList.toggle('dark-mode', isDark);
        darkModeToggle.checked = isDark;
        chrome.storage.sync.set({ darkMode: isDark });
    }

    darkModeToggle.addEventListener('change', (e) => {
        toggleDarkMode(e.target.checked);
    });

    // Load user's dark mode preference
    chrome.storage.sync.get('darkMode', (result) => {
        const isDarkMode = result.darkMode || false;
        toggleDarkMode(isDarkMode);
    });

    // Initial load
    await loadNotes();
});
