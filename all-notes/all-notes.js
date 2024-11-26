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

    let autoSaveTimeout;
    const AUTOSAVE_DELAY = 1000; // 1 second delay after typing stops

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
            case 'edited-desc':
                return notes.sort((a, b) => new Date(b.lastEdited) - new Date(a.lastEdited));
            case 'edited-asc':
                return notes.sort((a, b) => new Date(a.lastEdited) - new Date(b.lastEdited));
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
            <div class="section-header">
                <h3>Tags</h3>
                ${activeFilters.tags.size > 0 ? `
                    <button class="reset-tags-button" title="Reset Tags">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
            </div>
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

        const resetTagsButton = filterPanel.querySelector('.reset-tags-button');
        if (resetTagsButton) {
            resetTagsButton.addEventListener('click', () => {
                activeFilters.tags.clear();
                loadNotes();
            });
        }
    }

    async function loadNotes() {
        try {
            // Capture current note contents before resorting
            const currentContents = new Map();
            document.querySelectorAll('.note').forEach(noteElement => {
                const url = noteElement.querySelector('.save-note').dataset.url;
                const content = noteElement.querySelector('.note-content').innerHTML;
                currentContents.set(url, content);
            });

            // Get notes if not already loaded
            if (!allNotes.length) {
                allNotes = await Storage.getAllNotesWithUrls();
            }

            allTags = [...new Set(allNotes.flatMap(note => note.tags || []))];
            
            // Get collections
            // Update allNotes with current content
            allNotes = allNotes.map(note => {
                if (currentContents.has(note.url)) {
                    return {
                        ...note,
                        notes: currentContents.get(note.url)
                    };
                }
                return note;
            });

            // Get collections and apply filters/sorting
            collections = await Storage.getCollections();

            // Render filter panel
            renderFilterPanel();

            // Apply filters
            let filteredNotes = filterNotes(allNotes);

            // Apply sorting
            const sortCriteria = sortSelect.value;
            filteredNotes = sortNotes(filteredNotes, sortCriteria);

            // Render notes
            notesContainer.innerHTML = '';
            if (filteredNotes.length === 0) {
                notesContainer.innerHTML = '<p class="no-notes">No notes found.</p>';
                return;
            }

            filteredNotes.forEach(({ url, notes, createdAt, lastEdited, tags = [], collectionId }) => {
                const collection = collections.find(c => c.id === collectionId);
                const trimmedUrl = url.length > 15 ? url.substring(0, 15) + '...' : url;
                const noteElement = document.createElement('div');
                noteElement.className = 'note';
                noteElement.innerHTML = `
                    <div class="note-header">
                        <h2><a href="#" data-url="${url}" title="${url}">
                            <i class="fas fa-link" aria-hidden="true"></i> ${trimmedUrl}
                        </a></h2>
                        <div class="note-actions">
                            <div class="note-menu">
                                <button class="menu-trigger">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <div class="menu-dropdown">
                                    <div class="menu-item timestamps">
                                        <div><i class="fas fa-calendar-alt"></i> Created: ${formatDate(createdAt)}</div>
                                        <div><i class="fas fa-edit"></i> Last edited: ${formatDate(lastEdited)}</div>
                                    </div>
                                    <div class="menu-separator"></div>
                                    <div class="menu-item collection-selector">
                                        <i class="fas fa-folder"></i> Collection:
                                        <select class="collection-select" data-url="${url}">
                                            <option value="">No Collection</option>
                                            ${collections.map(c => `
                                                <option value="${c.id}" ${c.id === collectionId ? 'selected' : ''}>
                                                    ${c.name}
                                                </option>
                                            `).join('')}
                                        </select>
                                    </div>
                                    <div class="menu-item tags-editor">
                                        <i class="fas fa-tags"></i> Tags:
                                        <input type="text" class="tags-input" data-url="${url}" placeholder="Add tags and press enter...">
                                        <div class="tags-container">
                                            ${tags.map(tag => `
                                                <span class="tag">
                                                    ${tag}
                                                    <span class="remove-tag" data-tag="${tag}">&times;</span>
                                                </span>
                                            `).join('')}
                                        </div>
                                    </div>
                                    <div class="menu-separator"></div>
                                    <button class="menu-item delete-note" data-url="${url}">
                                        <i class="fas fa-trash-alt"></i> Delete Note
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="note-content" contenteditable="true">${notes}</div>
                    <div class="note-footer">
                        <div class="note-tags">
                            ${tags.map(tag => `
                                <span class="tag">${tag}</span>
                            `).join('')}
                        </div>
                        ${collection ? `
                            <div class="note-collection" style="background: ${collection.color}">
                                ${collection.name}
                            </div>
                        ` : ''}
                    </div>
                    <div class="action-buttons">
                        <button class="save-note" data-url="${url}">
                            <i class="fas fa-save"></i> Save
                        </button>
                    </div>
                `;
                notesContainer.appendChild(noteElement);
                initializeNoteEditor(noteElement);
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

            // Collection change handler
            document.querySelectorAll('.collection-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    e.stopPropagation();
                    const url = e.target.dataset.url;
                    const newCollectionId = e.target.value;
                    const note = allNotes.find(n => n.url === url);
                    await Storage.saveNotes(url, note.notes, note.tags, newCollectionId);
                    allNotes = await Storage.getAllNotesWithUrls(); // Refresh notes
                    loadNotes();
                });
            });

            // Tags input handler
            document.querySelectorAll('.tags-input').forEach(input => {
                input.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter' && input.value.trim()) {
                        e.preventDefault();
                        const url = input.dataset.url;
                        const note = allNotes.find(n => n.url === url);
                        const newTag = input.value.trim();
                        
                        // Add new tag if it doesn't exist
                        if (!note.tags.includes(newTag)) {
                            const updatedTags = [...note.tags, newTag];
                            await Storage.saveNotes(url, note.notes, updatedTags, note.collectionId);
                            allNotes = await Storage.getAllNotesWithUrls(); // Refresh notes
                            loadNotes();
                        }
                        input.value = ''; // Clear input after adding tag
                    }
                });
            });

            // Add tag removal handler
            document.querySelectorAll('.remove-tag').forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const url = e.target.closest('.tags-editor').querySelector('.tags-input').dataset.url;
                    const tagToRemove = e.target.dataset.tag;
                    const note = allNotes.find(n => n.url === url);
                    const updatedTags = note.tags.filter(t => t !== tagToRemove);
                    await Storage.saveNotes(url, note.notes, updatedTags, note.collectionId);
                    allNotes = await Storage.getAllNotesWithUrls(); // Refresh notes
                    loadNotes();
                });
            });

            // Add menu toggle handlers
            document.querySelectorAll('.menu-trigger').forEach(trigger => {
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const dropdown = e.target.closest('.note-menu').querySelector('.menu-dropdown');
                    document.querySelectorAll('.menu-dropdown.show').forEach(menu => {
                        if (menu !== dropdown) menu.classList.remove('show');
                    });
                    dropdown.classList.toggle('show');
                });
            });

            // Close menus when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.note-menu')) {
                    document.querySelectorAll('.menu-dropdown.show').forEach(menu => {
                        menu.classList.remove('show');
                    });
                }
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

    function initializeNoteEditor(noteElement) {
        const content = noteElement.querySelector('.note-content');
        const saveButton = noteElement.querySelector('.save-note');
        const url = saveButton.dataset.url;

        let autoSaveTimeout;
        const AUTOSAVE_DELAY = 1000;

        content.addEventListener('input', () => {
            clearTimeout(autoSaveTimeout);
            saveButton.innerHTML = '<i class="fas fa-save"></i> Save';
            
            autoSaveTimeout = setTimeout(async () => {
                const note = allNotes.find(n => n.url === url);
                const currentTime = new Date().toISOString();
                await Storage.saveNotes(url, content.innerHTML, note.tags, note.collectionId);
                
                // Update the note's lastEdited time in our local array
                note.lastEdited = currentTime;
                
                // Update the timestamp display in the menu
                const timestampDiv = noteElement.querySelector('.timestamps');
                if (timestampDiv) {
                    timestampDiv.innerHTML = `
                        <div><i class="fas fa-calendar-alt"></i> Created: ${formatDate(note.createdAt)}</div>
                        <div><i class="fas fa-edit"></i> Last edited: ${formatDate(currentTime)}</div>
                    `;
                }
                
                saveButton.innerHTML = '<i class="fas fa-check"></i> Saved';
                
                // If currently sorted by edit time, refresh the sort
                const currentSort = document.getElementById('sort').value;
                if (currentSort.startsWith('edited-')) {
                    loadNotes();
                }
                
                setTimeout(() => {
                    saveButton.innerHTML = '<i class="fas fa-save"></i> Save';
                }, 2000);
            }, AUTOSAVE_DELAY);
        });
    }

    async function exportData() {
        try {
            const data = {
                notes: allNotes,
                collections: collections,
                exportDate: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `tab-notes-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting data:', error);
        }
    }

    // Add this to your DOMContentLoaded event listener
    document.getElementById('export-data').addEventListener('click', exportData);
});
