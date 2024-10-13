document.addEventListener('DOMContentLoaded', async () => {
    const notesContainer = document.getElementById('notes-container');

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

    async function loadNotes() {
        try {
            const allNotes = await Storage.getAllNotesWithUrls();
            notesContainer.innerHTML = '';
            allNotes.forEach(({ url, notes, createdAt, lastEdited }) => {
                const noteElement = document.createElement('div');
                noteElement.className = 'note';
                noteElement.innerHTML = `
                    <h2><a href="#" data-url="${url}">${url}</a></h2>
                    <div class="note-content" contenteditable="true">${notes}</div>
                    <div class="note-timestamps">
                        <span>Created: ${formatDate(createdAt)}</span>
                        <span>Last edited: ${formatDate(lastEdited)}</span>
                    </div>
                    <button class="save-note" data-url="${url}">Save</button>
                    <button class="delete-note" data-url="${url}">Delete</button>
                `;
                notesContainer.appendChild(noteElement);
            });

            // Add event listeners for delete buttons
            document.querySelectorAll('.delete-note').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const url = e.target.getAttribute('data-url');
                    await Storage.deleteNotes(url);
                    await loadNotes(); // Reload notes after deletion
                });
            });

            // Add event listeners for save buttons
            document.querySelectorAll('.save-note').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const url = e.target.getAttribute('data-url');
                    const noteContent = e.target.parentElement.querySelector('.note-content').innerHTML;
                    await Storage.saveNotes(url, noteContent);
                    await loadNotes(); // Reload notes after saving
                });
            });

            // Add event listeners for note links
            document.querySelectorAll('.note h2 a').forEach(link => {
                link.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const url = e.target.getAttribute('data-url');
                    await openOrSwitchToTab(url);
                });
            });
        } catch (error) {
            console.error('Error loading all notes:', error);
            notesContainer.innerHTML = '<p>Error loading notes. Please try again.</p>';
        }
    }

    await loadNotes();
});