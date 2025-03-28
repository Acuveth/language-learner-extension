document.addEventListener('DOMContentLoaded', async () => {
    const BACKEND_URL = 'http://localhost:3000/api';
    
    // DOM elements
    const userTargetLangEl = document.getElementById('user-target-lang');
    const cheatsheetsGridEl = document.getElementById('cheatsheets-grid');
    const createCheatsheetBtn = document.getElementById('create-cheatsheet-btn');
    
    // Cheatsheet detail modal
    const cheatsheetDetailModal = document.getElementById('cheatsheet-detail-modal');
    const cheatsheetTitleEl = document.getElementById('cheatsheet-title');
    const cheatsheetDateEl = document.getElementById('cheatsheet-date');
    const cheatsheetWordCountEl = document.getElementById('cheatsheet-word-count');
    const cheatsheetContentEl = document.getElementById('cheatsheet-content');
    const printCheatsheetBtn = document.getElementById('print-cheatsheet-btn');
    const closeCheatsheetBtn = document.getElementById('close-cheatsheet-btn');
    const deleteCheatsheetBtn = document.getElementById('delete-cheatsheet-btn');
    
    // Create cheatsheet modal
    const createCheatsheetModal = document.getElementById('create-cheatsheet-modal');
    const cheatsheetNameEl = document.getElementById('cheatsheet-name');
    const wordFilterEl = document.getElementById('word-filter');
    const maxWordsEl = document.getElementById('max-words');
    const saveNewCheatsheetBtn = document.getElementById('save-new-cheatsheet-btn');
    const cancelNewCheatsheetBtn = document.getElementById('cancel-new-cheatsheet-btn');
    
    // Print template
    const printTitleEl = document.getElementById('print-title');
    const printDateEl = document.getElementById('print-date');
    const printContentEl = document.getElementById('print-content');
    
    // State
    let currentCheatsheetId = null;
    
    // Initialize the page
    async function initPage() {
      // Get user language
      chrome.storage.local.get(['targetLanguage'], (result) => {
        if (result.targetLanguage) {
          const langMap = {
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'zh': 'Chinese',
            'ja': 'Japanese',
            'ko': 'Korean'
          };
          userTargetLangEl.textContent = langMap[result.targetLanguage] || result.targetLanguage;
        }
      });
      
      try {
        // Load cheatsheets
        await loadCheatsheets();
        
        // Set up event listeners
        setupEventListeners();
      } catch (error) {
        console.error('Error initializing page:', error);
        displayErrorMessage('Could not load cheatsheets. Make sure the backend server is running.');
      }
    }
    
    // Load cheatsheets
    async function loadCheatsheets() {
      try {
        const response = await fetch(`${BACKEND_URL}/cheatsheets`);
        const cheatsheets = await response.json();
        
        if (cheatsheets && cheatsheets.length > 0) {
          displayCheatsheets(cheatsheets);
        } else {
          cheatsheetsGridEl.innerHTML = `
            <div class="text-center py-8 col-span-full">
              <p class="text-gray-500">You don't have any cheatsheets yet.</p>
              <p class="text-gray-500 mt-2">Create one to start organizing your vocabulary!</p>
            </div>
          `;
        }
      } catch (error) {
        console.error('Error loading cheatsheets:', error);
        cheatsheetsGridEl.innerHTML = `
          <div class="text-center py-8 col-span-full">
            <p class="text-red-500">Error loading cheatsheets. Please try again.</p>
          </div>
        `;
      }
    }
    
    // Display cheatsheets
    function displayCheatsheets(cheatsheets) {
      cheatsheetsGridEl.innerHTML = '';
      
      cheatsheets.forEach(cheatsheet => {
        const date = new Date(cheatsheet.date_created);
        const formattedDate = date.toLocaleDateString();
        
        const cheatsheetEl = document.createElement('div');
        cheatsheetEl.className = 'bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow';
        cheatsheetEl.innerHTML = `
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-900 truncate">${cheatsheet.title}</h3>
            <p class="mt-1 max-w-2xl text-sm text-gray-500">Created on ${formattedDate}</p>
            <div class="mt-4 flex justify-end">
              <button data-cheatsheet-id="${cheatsheet.id}" class="view-cheatsheet text-blue-600 hover:text-blue-700 text-sm font-medium">
                View Cheatsheet
              </button>
            </div>
          </div>
        `;
        
        cheatsheetsGridEl.appendChild(cheatsheetEl);
      });
      
      // Add event listeners to view buttons
      document.querySelectorAll('.view-cheatsheet').forEach(btn => {
        btn.addEventListener('click', () => {
          const cheatsheetId = parseInt(btn.getAttribute('data-cheatsheet-id'));
          openCheatsheetDetail(cheatsheetId);
        });
      });
    }
    
    // Open cheatsheet detail
    async function openCheatsheetDetail(cheatsheetId) {
      currentCheatsheetId = cheatsheetId;
      
      try {
        // Show loading state
        cheatsheetTitleEl.textContent = 'Loading Cheatsheet...';
        cheatsheetDateEl.textContent = 'Created on: ';
        cheatsheetWordCountEl.textContent = '0 words';
        cheatsheetContentEl.innerHTML = `
          <div class="text-center py-4">
            <p class="text-gray-500">Loading content...</p>
          </div>
        `;
        
        cheatsheetDetailModal.classList.remove('hidden');
        
        // Fetch cheatsheet data
        const response = await fetch(`${BACKEND_URL}/cheatsheets/${cheatsheetId}`);
        const cheatsheet = await response.json();
        
        if (cheatsheet) {
          // Update modal with cheatsheet details
          cheatsheetTitleEl.textContent = cheatsheet.title;
          
          const date = new Date(cheatsheet.date_created);
          cheatsheetDateEl.textContent = `Created on: ${date.toLocaleDateString()}`;
          
          const wordCount = cheatsheet.words ? cheatsheet.words.length : 0;
          cheatsheetWordCountEl.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
          
          // Display cheatsheet content
          displayCheatsheetContent(cheatsheet);
        } else {
          cheatsheetContentEl.innerHTML = `
            <div class="text-center py-4">
              <p class="text-red-500">Cheatsheet not found.</p>
            </div>
          `;
        }
      } catch (error) {
        console.error('Error loading cheatsheet:', error);
        cheatsheetContentEl.innerHTML = `
          <div class="text-center py-4">
            <p class="text-red-500">Error loading cheatsheet. Please try again.</p>
          </div>
        `;
      }
    }
    
    // Display cheatsheet content
    function displayCheatsheetContent(cheatsheet) {
      if (!cheatsheet.words || cheatsheet.words.length === 0) {
        cheatsheetContentEl.innerHTML = `
          <div class="text-center py-4">
            <p class="text-gray-500">This cheatsheet is empty.</p>
          </div>
        `;
        return;
      }
      
      // Group words by part of speech
      const wordsByCategory = {};
      
      cheatsheet.words.forEach(word => {
        const category = word.part_of_speech || 'Other';
        
        if (!wordsByCategory[category]) {
          wordsByCategory[category] = [];
        }
        
        wordsByCategory[category].push(word);
      });
      
      // Create content HTML
      let contentHTML = '';
      
      // Define category order
      const categoryOrder = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Expression', 'Other'];
      
      // Sort categories based on predefined order
      const sortedCategories = Object.keys(wordsByCategory).sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        
        // If category is not in the predefined order, put it at the end
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });
      
      // Build content
      sortedCategories.forEach(category => {
        const words = wordsByCategory[category];
        
        contentHTML += `
          <div class="mb-4">
            <h4 class="text-sm font-medium text-gray-700 mb-2">${category}</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        `;
        
        words.forEach(word => {
          contentHTML += `
            <div class="p-2 bg-white border border-gray-200 rounded">
              <p class="font-medium">${word.text}</p>
              <p class="text-sm text-gray-500">${word.translation || '[No translation]'}</p>
              ${word.context ? `<p class="text-xs text-gray-400 italic mt-1">"${word.context}"</p>` : ''}
            </div>
          `;
        });
        
        contentHTML += `
            </div>
          </div>
        `;
      });
      
      cheatsheetContentEl.innerHTML = contentHTML;
    }
    
    // Print cheatsheet
    function printCheatsheet() {
      // Get current cheatsheet content
      printTitleEl.textContent = cheatsheetTitleEl.textContent;
      printDateEl.textContent = cheatsheetDateEl.textContent.replace('Created on: ', '');
      printContentEl.innerHTML = cheatsheetContentEl.innerHTML;
      
      // Create print window
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>${cheatsheetTitleEl.textContent}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
                max-width: 800px;
                margin: 0 auto;
              }
              h1 {
                font-size: 24px;
                margin-bottom: 10px;
              }
              .print-date {
                font-size: 12px;
                color: #666;
                margin-bottom: 20px;
              }
              h4 {
                font-size: 16px;
                margin-bottom: 8px;
                border-bottom: 1px solid #ddd;
                padding-bottom: 4px;
              }
              .grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
                margin-bottom: 20px;
              }
              .bg-white {
                background-color: #fff;
                border: 1px solid #ddd;
                padding: 8px;
                border-radius: 4px;
              }
              .font-medium {
                font-weight: 500;
              }
              .text-sm {
                font-size: 14px;
              }
              .text-xs {
                font-size: 12px;
              }
              .text-gray-500 {
                color: #6b7280;
              }
              .text-gray-400 {
                color: #9ca3af;
              }
              .italic {
                font-style: italic;
              }
              .mt-1 {
                margin-top: 4px;
              }
              @media print {
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <h1>${printTitleEl.textContent}</h1>
            <div class="print-date">Created: ${printDateEl.textContent}</div>
            <div>${printContentEl.innerHTML.replace(/grid grid-cols-1 sm:grid-cols-2/g, 'grid')}</div>
          </body>
        </html>
      `);
      
      // Print and close
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
    
    // Delete cheatsheet
    async function deleteCheatsheet() {
      if (!currentCheatsheetId) return;
      
      // Confirm deletion
      if (!confirm('Are you sure you want to delete this cheatsheet? This action cannot be undone.')) {
        return;
      }
      
      try {
        const response = await fetch(`${BACKEND_URL}/cheatsheets/${currentCheatsheetId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Close modal
          cheatsheetDetailModal.classList.add('hidden');
          
          // Reload cheatsheets
          await loadCheatsheets();
        } else {
          console.error('Failed to delete cheatsheet');
          alert('Failed to delete cheatsheet. Please try again.');
        }
      } catch (error) {
        console.error('Error deleting cheatsheet:', error);
        alert('Error deleting cheatsheet. Please try again.');
      }
    }
    
    // Create new cheatsheet
    async function createNewCheatsheet() {
      const title = cheatsheetNameEl.value.trim();
      
      if (!title) {
        alert('Please enter a title for your cheatsheet.');
        return;
      }
      
      const filter = wordFilterEl.value;
      const maxWords = parseInt(maxWordsEl.value) || 20;
      
      try {
        // Get words based on filter
        const wordResponse = await fetch(`${BACKEND_URL}/words?limit=${maxWords}&filter=${filter}`);
        const wordResult = await wordResponse.json();
        
        if (!wordResult.words || wordResult.words.length === 0) {
          alert('No words found matching your criteria.');
          return;
        }
        
        // Create cheatsheet
        const createResponse = await fetch(`${BACKEND_URL}/cheatsheets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            wordIds: wordResult.words.map(word => word.id)
          }),
        });
        
        if (createResponse.ok) {
          createCheatsheetModal.classList.add('hidden');
          cheatsheetNameEl.value = '';
          
          // Reload cheatsheets
          await loadCheatsheets();
          
          // Optionally, open the new cheatsheet
          const createResult = await createResponse.json();
          if (createResult.id) {
            openCheatsheetDetail(createResult.id);
          }
        } else {
          console.error('Failed to create cheatsheet');
          alert('Failed to create cheatsheet. Please try again.');
        }
      } catch (error) {
        console.error('Error creating cheatsheet:', error);
        alert('Error creating cheatsheet. Please try again.');
      }
    }
    
    // Set up event listeners
    function setupEventListeners() {
      // Cheatsheet detail modal
      closeCheatsheetBtn.addEventListener('click', () => {
        cheatsheetDetailModal.classList.add('hidden');
        currentCheatsheetId = null;
      });
      
      printCheatsheetBtn.addEventListener('click', printCheatsheet);
      
      deleteCheatsheetBtn.addEventListener('click', deleteCheatsheet);
      
      // Create cheatsheet modal
      createCheatsheetBtn.addEventListener('click', () => {
        createCheatsheetModal.classList.remove('hidden');
      });
      
      cancelNewCheatsheetBtn.addEventListener('click', () => {
        createCheatsheetModal.classList.add('hidden');
        cheatsheetNameEl.value = '';
      });
      
      saveNewCheatsheetBtn.addEventListener('click', createNewCheatsheet);
    }
    
    // Display error message
    function displayErrorMessage(message) {
      const alertElement = document.createElement('div');
      alertElement.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4';
      alertElement.innerHTML = `<p>${message}</p>`;
      
      document.querySelector('.max-w-7xl').prepend(alertElement);
    }
    
    // Initialize page
    initPage();
  });