document.addEventListener('DOMContentLoaded', async () => {
    const BACKEND_URL = 'http://localhost:3000/api';
    
    // DOM elements
    const knownTotalEl = document.getElementById('known-total');
    const learningTotalEl = document.getElementById('learning-total');
    const todayTotalEl = document.getElementById('today-total');
    const pagesVisitedEl = document.getElementById('pages-visited');
    const userTargetLangEl = document.getElementById('user-target-lang');
    const wordsTableBodyEl = document.getElementById('words-table-body');
    const wordFilterEl = document.getElementById('word-filter');
    const wordCountInfoEl = document.getElementById('word-count-info');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const categoriesListEl = document.getElementById('categories-list');
    
    // Pagination state
    let currentPage = 1;
    const itemsPerPage = 10;
    let totalWords = 0;
    let currentFilter = 'all';
    
    // Initialize the dashboard
    async function initDashboard() {
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
        // Load user stats
        const statsResponse = await fetch(`${BACKEND_URL}/user/stats`);
        const stats = await statsResponse.json();
        
        // Update stats
        knownTotalEl.textContent = stats.knownWords || 0;
        learningTotalEl.textContent = stats.learningWords || 0;
        todayTotalEl.textContent = stats.todayWords || 0;
        pagesVisitedEl.textContent = stats.pagesVisited || 0;
        
        // Load word categories
        const categoriesResponse = await fetch(`${BACKEND_URL}/words/categories`);
        const categories = await categoriesResponse.json();
        
        // Update categories list
        updateCategoriesList(categories);
        
        // Initialize progress chart
        initProgressChart();
        
        // Load words
        loadWords();
        
      } catch (error) {
        console.error('Error initializing dashboard:', error);
        displayErrorMessage('Could not load dashboard data. Make sure the backend server is running.');
      }
    }
    
    // Load words with pagination and filtering
    async function loadWords() {
      try {
        const response = await fetch(
          `${BACKEND_URL}/words?page=${currentPage}&limit=${itemsPerPage}&filter=${currentFilter}`
        );
        const result = await response.json();
        
        if (result.words && result.words.length > 0) {
          displayWords(result.words);
          totalWords = result.total;
        } else {
          wordsTableBodyEl.innerHTML = `
            <tr>
              <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">No words found.</td>
            </tr>
          `;
        }
        
        // Update pagination info
        updatePaginationInfo();
        
      } catch (error) {
        console.error('Error loading words:', error);
        wordsTableBodyEl.innerHTML = `
          <tr>
            <td colspan="5" class="px-6 py-4 text-center text-sm text-red-500">Error loading words.</td>
          </tr>
        `;
      }
    }
    
    // Display words in the table
    function displayWords(words) {
      wordsTableBodyEl.innerHTML = '';
      
      words.forEach(word => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-medium text-gray-900">${word.text}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-gray-500">${word.translation}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
              word.category === 'Known' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }">${word.category}</span>
            ${word.partOfSpeech ? `<span class="ml-1 text-xs text-gray-500">${word.partOfSpeech}</span>` : ''}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${new Date(word.dateAdded).toLocaleDateString()}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button data-word-id="${word.id}" class="toggle-status text-blue-600 hover:text-blue-900 mr-2">
              ${word.category === 'Known' ? 'Mark as Learning' : 'Mark as Known'}
            </button>
            <button data-word-id="${word.id}" class="remove-word text-red-600 hover:text-red-900">
              Remove
            </button>
          </td>
        `;
        wordsTableBodyEl.appendChild(row);
      });
      
      // Add event listeners for action buttons
      document.querySelectorAll('.toggle-status').forEach(btn => {
        btn.addEventListener('click', handleToggleStatus);
      });
      
      document.querySelectorAll('.remove-word').forEach(btn => {
        btn.addEventListener('click', handleRemoveWord);
      });
    }
    
    // Update pagination info and buttons
    function updatePaginationInfo() {
      const start = (currentPage - 1) * itemsPerPage + 1;
      const end = Math.min(currentPage * itemsPerPage, totalWords);
      
      if (totalWords > 0) {
        wordCountInfoEl.textContent = `Showing ${start}-${end} of ${totalWords} words`;
      } else {
        wordCountInfoEl.textContent = 'No words found';
      }
      
      // Update button states
      prevPageBtn.disabled = currentPage <= 1;
      nextPageBtn.disabled = currentPage * itemsPerPage >= totalWords;
    }
    
    // Update categories list
    function updateCategoriesList(categories) {
      if (!categories || Object.keys(categories).length === 0) {
        categoriesListEl.innerHTML = `
          <p class="text-sm text-gray-500">No categories data available.</p>
        `;
        return;
      }
      
      const categoryColors = {
        'Noun': 'blue',
        'Verb': 'green',
        'Adjective': 'yellow',
        'Adverb': 'purple',
        'Expression': 'red',
        'Other': 'gray'
      };
      
      categoriesListEl.innerHTML = '';
      
      Object.entries(categories).forEach(([category, count]) => {
        const color = categoryColors[category] || 'gray';
        
        const categoryElement = document.createElement('div');
        categoryElement.className = 'flex items-center justify-between';
        categoryElement.innerHTML = `
          <div class="flex items-center">
            <div class="w-3 h-3 rounded-full bg-${color}-500 mr-2"></div>
            <span class="text-sm font-medium text-gray-700">${category}</span>
          </div>
          <span class="text-sm text-gray-500">${count}</span>
        `;
        
        categoriesListEl.appendChild(categoryElement);
      });
    }
    
    // Initialize progress chart
    async function initProgressChart() {
      try {
        const response = await fetch(`${BACKEND_URL}/user/progress`);
        const progressData = await response.json();
        
        const ctx = document.getElementById('progress-chart').getContext('2d');
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: progressData.labels || [],
            datasets: [
              {
                label: 'Words Learned',
                data: progressData.known || [],
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                tension: 0.1
              },
              {
                label: 'Words in Learning',
                data: progressData.learning || [],
                borderColor: 'rgb(245, 158, 11)',
                backgroundColor: 'rgba(245, 158, 11, 0.5)',
                tension: 0.1
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Word Count'
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Date'
                }
              }
            }
          }
        });
      } catch (error) {
        console.error('Error initializing progress chart:', error);
        document.getElementById('progress-chart').parentNode.innerHTML = `
          <p class="text-sm text-red-500 text-center mt-10">Could not load progress chart data.</p>
        `;
      }
    }
    
    // Handle toggle word status
    async function handleToggleStatus() {
      const wordId = this.getAttribute('data-word-id');
      
      try {
        const response = await fetch(`${BACKEND_URL}/words/${wordId}/toggle-status`, {
          method: 'POST'
        });
        
        if (response.ok) {
          // Reload words to reflect changes
          loadWords();
          
          // Refresh stats
          const statsResponse = await fetch(`${BACKEND_URL}/user/stats`);
          const stats = await statsResponse.json();
          
          knownTotalEl.textContent = stats.knownWords || 0;
          learningTotalEl.textContent = stats.learningWords || 0;
          
          // Update extension storage
          chrome.storage.local.get(['userDictionary'], (result) => {
            const updatedDictionary = result.userDictionary || [];
            chrome.storage.local.set({ userDictionary: updatedDictionary });
          });
        } else {
          console.error('Failed to toggle word status');
        }
      } catch (error) {
        console.error('Error toggling word status:', error);
      }
    }
    
    // Handle remove word
    async function handleRemoveWord() {
      if (!confirm('Are you sure you want to remove this word?')) {
        return;
      }
      
      const wordId = this.getAttribute('data-word-id');
      
      try {
        const response = await fetch(`${BACKEND_URL}/words/${wordId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Reload words to reflect changes
          loadWords();
          
          // Refresh stats
          const statsResponse = await fetch(`${BACKEND_URL}/user/stats`);
          const stats = await statsResponse.json();
          
          knownTotalEl.textContent = stats.knownWords || 0;
          learningTotalEl.textContent = stats.learningWords || 0;
        } else {
          console.error('Failed to remove word');
        }
      } catch (error) {
        console.error('Error removing word:', error);
      }
    }
    
    // Display error message
    function displayErrorMessage(message) {
      const alertElement = document.createElement('div');
      alertElement.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4';
      alertElement.innerHTML = `<p>${message}</p>`;
      
      document.querySelector('.max-w-7xl').prepend(alertElement);
    }
    
    // Event listeners
    wordFilterEl.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      currentPage = 1;
      loadWords();
    });
    
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadWords();
      }
    });
    
    nextPageBtn.addEventListener('click', () => {
      if (currentPage * itemsPerPage < totalWords) {
        currentPage++;
        loadWords();
      }
    });
    
    // Initialize dashboard
    initDashboard();
  });