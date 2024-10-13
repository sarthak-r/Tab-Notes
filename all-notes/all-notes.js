document.addEventListener('DOMContentLoaded', async () => {
    const notesContainer = document.getElementById('notes-container');
    const searchInput = document.getElementById('search');
    const sortSelect = document.getElementById('sort');
    const backToTopButton = document.getElementById('back-to-top');
    const darkModeToggle = document.getElementById('dark-mode-toggle');

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
            case 'alphabet-asc':
                return notes.sort((a, b) => a.url.localeCompare(b.url));
            case 'alphabet-desc':
                return notes.sort((a, b) => b.url.localeCompare(a.url));
            default:
                return notes;
        }
    }

    function filterNotes(notes, query) {
        return notes.filter(note => note.url.toLowerCase().includes(query.toLowerCase()) || note.notes.toLowerCase().includes(query.toLowerCase()));
    }

    async function loadNotes() {
        try {
            let allNotes = await Storage.getAllNotesWithUrls();

            // Apply search filter
            const searchQuery = searchInput.value.trim();
            if (searchQuery !== '') {
                allNotes = filterNotes(allNotes, searchQuery);
            }

            // Apply sorting
            const sortCriteria = sortSelect.value;
            allNotes = sortNotes(allNotes, sortCriteria);

            notesContainer.innerHTML = '';
            if (allNotes.length === 0) {
                notesContainer.innerHTML = '<p>No notes found.</p>';
                return;
            }

            allNotes.forEach(({ url, notes, createdAt, lastEdited }) => {
                const noteElement = document.createElement('div');
                noteElement.className = 'note';
                noteElement.innerHTML = `
                    <h2><a href="#" data-url="${url}"><i class="fas fa-link" aria-hidden="true"></i> ${url}</a></h2>
                    <div class="note-content" contenteditable="true">${notes}</div>
                    <div class="note-timestamps">
                        <span><i class="fas fa-calendar-alt" aria-hidden="true"></i> Created: ${formatDate(createdAt)}</span>
                        <span><i class="fas fa-edit" aria-hidden="true"></i> Last edited: ${formatDate(lastEdited)}</span>
                    </div>
                    <div class="action-buttons">
                        <button class="save-note" data-url="${url}"><i class="fas fa-save" aria-hidden="true"></i> Save</button>
                        <button class="delete-note" data-url="${url}"><i class="fas fa-trash-alt" aria-hidden="true"></i> Delete</button>
                    </div>
                `;
                notesContainer.appendChild(noteElement);
            });

            // Add event listeners for delete buttons
            document.querySelectorAll('.delete-note').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const url = e.target.getAttribute('data-url');
                    const confirmDelete = confirm('Are you sure you want to delete this note?');
                    if (confirmDelete) {
                        await Storage.deleteNotes(url);
                        await loadNotes(); // Reload notes after deletion
                    }
                });
            });

            // Add event listeners for save buttons
            document.querySelectorAll('.save-note').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const url = e.target.getAttribute('data-url');
                    const noteContent = e.target.closest('.note').querySelector('.note-content').innerHTML;
                    await Storage.saveNotes(url, noteContent);
                    alert('Note saved successfully!');
                    await loadNotes(); // Reload notes after saving
                });
            });

            // Add event listeners for note links
            document.querySelectorAll('.note h2 a').forEach(link => {
                link.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const url = e.target.getAttribute('data-url') || e.target.parentElement.getAttribute('data-url');
                    await openOrSwitchToTab(url);
                });
            });
        } catch (error) {
            // console.error('Error loading all notes:', error);
            notesContainer.innerHTML = '<p>Error loading notes. Please try again.</p>';
        }
    }

    // Search functionality with debounce to improve performance
    function debounce(func, delay) {
        let debounceTimer;
        return function(...args) {
            const context = this;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(context, args), delay);
        };
    }

    searchInput.addEventListener('input', debounce(() => {
        loadNotes();
    }, 300));

    // Sort functionality
    sortSelect.addEventListener('change', () => {
        loadNotes();
    });

    // Back to Top button functionality
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopButton.style.display = 'block';
        } else {
            backToTopButton.style.display = 'none';
        }
    });

    backToTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Dark mode toggle functionality
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

    await loadNotes();
});
