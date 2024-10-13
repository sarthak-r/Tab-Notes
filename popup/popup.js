document.addEventListener('DOMContentLoaded', async () => {
	console.log('Popup script loaded');
	const errorMessageElement = document.getElementById('error-message');
	const editor = document.getElementById('editor');
	const boldButton = document.getElementById('bold');
	const italicButton = document.getElementById('italic');
	const underlineButton = document.getElementById('underline');

	try {
		// Get current tab URL
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		const url = tab.url;

		console.log('Current tab URL:', url);

		// Load existing notes
		const { content: notes } = await Storage.getNotes(url);
		editor.innerHTML = notes;

		console.log('Notes loaded:', notes);

		// Save notes on input
		editor.addEventListener('input', () => {
			Storage.saveNotes(url, editor.innerHTML);
			console.log('Notes saved');
		});

		// Implement basic text formatting
		boldButton.addEventListener('click', () => document.execCommand('bold', false, null));
		italicButton.addEventListener('click', () => document.execCommand('italic', false, null));
		underlineButton.addEventListener('click', () => document.execCommand('underline', false, null));

		// Debug: Log all stored notes
		const allNotes = await Storage.getAllNotes();
		console.log('All stored notes:', allNotes);

		const viewAllNotesButton = document.getElementById('view-all-notes');
		viewAllNotesButton.addEventListener('click', () => {
			const allNotesUrl = chrome.runtime.getURL('./all-notes/all-notes.html');
			chrome.tabs.create({ url: allNotesUrl });
		});

	} catch (error) {
		console.error('Error in popup script:', error);
		errorMessageElement.textContent = 'An error occurred: ' + error.message;
	}
});