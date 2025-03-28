document.addEventListener('DOMContentLoaded', async () => {
    const BACKEND_URL = 'http://localhost:3000/api';
    
    // DOM elements
    const userTargetLangEl = document.getElementById('user-target-lang');
    const reviewListEl = document.getElementById('review-list');
    const wordCountInfoEl = document.getElementById('word-count-info');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const filterStatusEl = document.getElementById('filter-status');
    const filterCategoryEl = document.getElementById('filter-category');
    const sortByEl = document.getElementById('sort-by');
    const selectAllCheckboxEl = document.getElementById('select-all-checkbox');
    const createCheatsheetBtn = document.getElementById('create-cheatsheet-btn');
    const startQuizBtn = document.getElementById('start-quiz-btn');
    
    // Modal elements
    const createCheatsheetModal = document.getElementById('create-cheatsheet-modal');
    const cheatsheetTitleEl = document.getElementById('cheatsheet-title');
    const selectedWordsCountEl = document.getElementById('selected-words-count');
    const saveCheatsheetBtn = document.getElementById('save-cheatsheet-btn');
    const cancelCheatsheetBtn = document.getElementById('cancel-cheatsheet-btn');
    
    // Quiz elements
    const quizModal = document.getElementById('quiz-modal');
    const quizProgressEl = document.getElementById('quiz-progress');
    const quizWordEl = document.getElementById('quiz-word');
    const quizOptionsEl = document.getElementById('quiz-options');
    const quizFeedbackEl = document.getElementById('quiz-feedback');
    const nextQuizBtn = document.getElementById('next-quiz-btn');
    const closeQuizBtn = document.getElementById('close-quiz-btn');
    
    // State variables
    let currentPage = 1;
    const itemsPerPage = 10;
    let totalWords = 0;
    let words = [];
    let selectedWordIds = new Set();
    let quizWords = [];
    let currentQuizIndex = 0;
    
    // Initialize the review page
    async function initReviewPage() {
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
        // Load words
        await loadWords();
        
        // Set up event listeners
        setupEventListeners();
      } catch (error) {
        console.error('Error initializing review page:', error);
        displayErrorMessage('Could not load review data. Make sure the backend server is running.');
      }
    }
    
    // Load words with pagination, filtering, and sorting
    async function loadWords() {
      try {
        const status = filterStatusEl.value;
        const category = filterCategoryEl.value;
        const sort = sortByEl.value;
        
        const response = await fetch(
          `${BACKEND_URL}/words?page=${currentPage}&limit=${itemsPerPage}&filter=${status}${category !== 'all' ? `&category=${category}` : ''}&sort=${sort}`
        );
        const result = await response.json();
        
        if (result.words && result.words.length > 0) {
          words = result.words;
          displayWords(words);
          totalWords = result.total;
        } else {
          reviewListEl.innerHTML = `
            <p class="text-center text-gray-500 py-4">No words found matching your criteria.</p>
          `;
          words = [];
        }
        
        // Update pagination info
        updatePaginationInfo();
        
        // Update selection count
        updateSelectedCount();
        
      } catch (error) {
        console.error('Error loading words:', error);
        reviewListEl.innerHTML = `
          <p class="text-center text-red-500 py-4">Error loading words. Please try again.</p>
        `;
      }
    }
    
    // Display words in the review list
    function displayWords(words) {
      reviewListEl.innerHTML = '';
      
      if (words.length === 0) {
        reviewListEl.innerHTML = `
          <p class="text-center text-gray-500 py-4">No words found matching your criteria.</p>
        `;
        return;
      }
      
      words.forEach(word => {
        const wordEl = document.createElement('div');
        wordEl.className = 'p-4 border border-gray-200 rounded-md hover:bg-gray-50';
        
        const isSelected = selectedWordIds.has(word.id);
        
        wordEl.innerHTML = `
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <input type="checkbox" class="word-checkbox h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" 
                data-word-id="${word.id}" ${isSelected ? 'checked' : ''}>
            </div>
            <div class="ml-3 flex-1">
              <div class="flex justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-900">${word.text}</p>
                  <p class="text-sm text-gray-500">${word.translation || '[No translation]'}</p>
                </div>
                <div class="flex flex-col items-end">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    word.category === 'Known' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }">${word.category}</span>
                  ${word.partOfSpeech ? `<span class="mt-1 text-xs text-gray-500">${word.partOfSpeech}</span>` : ''}
                </div>
              </div>
              ${word.context ? `
                <p class="mt-2 text-xs text-gray-500 italic">"${word.context}"</p>
              ` : ''}
              <div class="mt-2 flex justify-end space-x-2">
                <button data-word-id="${word.id}" class="toggle-status text-xs text-blue-600 hover:text-blue-800">
                  ${word.category === 'Known' ? 'Mark as Learning' : 'Mark as Known'}
                </button>
                <button data-word-id="${word.id}" class="edit-context text-xs text-gray-600 hover:text-gray-800">
                  ${word.context ? 'Edit Context' : 'Add Context'}
                </button>
              </div>
            </div>
          </div>
        `;
        
        reviewListEl.appendChild(wordEl);
      });
      
      // Add event listeners for checkboxes and action buttons
      document.querySelectorAll('.word-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleWordSelection);
      });
      
      document.querySelectorAll('.toggle-status').forEach(btn => {
        btn.addEventListener('click', handleToggleStatus);
      });
      
      document.querySelectorAll('.edit-context').forEach(btn => {
        btn.addEventListener('click', handleEditContext);
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
    
    // Update selected count
    function updateSelectedCount() {
      if (selectedWordIds.size === 0) {
        selectedWordsCountEl.textContent = 'No words selected';
      } else {
        selectedWordsCountEl.textContent = `${selectedWordIds.size} word${selectedWordIds.size !== 1 ? 's' : ''} selected`;
      }
      
      // Update select all checkbox state
      const checkboxes = document.querySelectorAll('.word-checkbox');
      if (checkboxes.length > 0 && selectedWordIds.size === checkboxes.length) {
        selectAllCheckboxEl.checked = true;
        selectAllCheckboxEl.indeterminate = false;
      } else if (selectedWordIds.size > 0) {
        selectAllCheckboxEl.indeterminate = true;
      } else {
        selectAllCheckboxEl.checked = false;
        selectAllCheckboxEl.indeterminate = false;
      }
    }
    
    // Handle word selection
    function handleWordSelection() {
      const wordId = parseInt(this.getAttribute('data-word-id'));
      
      if (this.checked) {
        selectedWordIds.add(wordId);
      } else {
        selectedWordIds.delete(wordId);
      }
      
      updateSelectedCount();
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
          await loadWords();
        } else {
          console.error('Failed to toggle word status');
        }
      } catch (error) {
        console.error('Error toggling word status:', error);
      }
    }
    
    // Handle edit context
    async function handleEditContext() {
      const wordId = this.getAttribute('data-word-id');
      const word = words.find(w => w.id === parseInt(wordId));
      
      if (!word) return;
      
      const context = prompt('Enter context for this word:', word.context || '');
      
      if (context !== null) { // User didn't cancel
        try {
          const response = await fetch(`${BACKEND_URL}/words/review`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              word: word.text,
              translation: word.translation,
              context
            }),
          });
          
          if (response.ok) {
            // Reload words to reflect changes
            await loadWords();
          } else {
            console.error('Failed to update context');
          }
        } catch (error) {
          console.error('Error updating context:', error);
        }
      }
    }
    
    // Set up event listeners
    function setupEventListeners() {
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
      
      filterStatusEl.addEventListener('change', () => {
        currentPage = 1;
        loadWords();
      });
      
      filterCategoryEl.addEventListener('change', () => {
        currentPage = 1;
        loadWords();
      });
      
      sortByEl.addEventListener('change', () => {
        currentPage = 1;
        loadWords();
      });
      
      selectAllCheckboxEl.addEventListener('change', () => {
        const checkboxes = document.querySelectorAll('.word-checkbox');
        
        if (selectAllCheckboxEl.checked) {
          // Select all words
          checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            selectedWordIds.add(parseInt(checkbox.getAttribute('data-word-id')));
          });
        } else {
          // Deselect all words
          checkboxes.forEach(checkbox => {
            checkbox.checked = false;
          });
          selectedWordIds.clear();
        }
        
        updateSelectedCount();
      });
      
      // Cheatsheet functionality
      createCheatsheetBtn.addEventListener('click', () => {
        if (selectedWordIds.size === 0) {
          alert('Please select at least one word to create a cheatsheet.');
          return;
        }
        
        createCheatsheetModal.classList.remove('hidden');
      });
      
      cancelCheatsheetBtn.addEventListener('click', () => {
        createCheatsheetModal.classList.add('hidden');
        cheatsheetTitleEl.value = '';
      });
      
      saveCheatsheetBtn.addEventListener('click', async () => {
        const title = cheatsheetTitleEl.value.trim();
        
        if (!title) {
          alert('Please enter a title for your cheatsheet.');
          return;
        }
        
        if (selectedWordIds.size === 0) {
          alert('Please select at least one word to create a cheatsheet.');
          return;
        }
        
        try {
          const response = await fetch(`${BACKEND_URL}/cheatsheets`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title,
              wordIds: Array.from(selectedWordIds)
            }),
          });
          
          if (response.ok) {
            createCheatsheetModal.classList.add('hidden');
            cheatsheetTitleEl.value = '';
            
            alert('Cheatsheet created successfully!');
            
            // Optionally navigate to cheatsheets page
            if (confirm('Would you like to view your cheatsheets now?')) {
              window.location.href = 'cheatsheets.html';
            }
          } else {
            console.error('Failed to create cheatsheet');
            alert('Failed to create cheatsheet. Please try again.');
          }
        } catch (error) {
          console.error('Error creating cheatsheet:', error);
          alert('Error creating cheatsheet. Please try again.');
        }
      });
      
      // Quiz functionality
      startQuizBtn.addEventListener('click', () => {
        if (words.length === 0) {
          alert('No words available for quiz. Try changing your filters.');
          return;
        }
        
        // Prepare quiz words (either selected or all visible)
        if (selectedWordIds.size > 0) {
          quizWords = words.filter(word => selectedWordIds.has(word.id));
        } else {
          quizWords = [...words];
        }
        
        // Shuffle quiz words
        quizWords = shuffleArray(quizWords);
        
        // Limit to 10 words if more
        if (quizWords.length > 10) {
          quizWords = quizWords.slice(0, 10);
        }
        
        currentQuizIndex = 0;
        
        // Start quiz
        startQuiz();
      });
      
      nextQuizBtn.addEventListener('click', () => {
        currentQuizIndex++;
        
        if (currentQuizIndex < quizWords.length) {
          showQuizQuestion();
        } else {
          // Quiz finished
          showQuizResults();
        }
      });
      
      closeQuizBtn.addEventListener('click', () => {
        quizModal.classList.add('hidden');
      });
    }
    
    // Start quiz
    function startQuiz() {
      quizModal.classList.remove('hidden');
      showQuizQuestion();
    }
    
    // Show quiz question
    function showQuizQuestion() {
      const word = quizWords[currentQuizIndex];
      
      // Update progress
      quizProgressEl.textContent = `${currentQuizIndex + 1}/${quizWords.length}`;
      
      // Show word
      quizWordEl.textContent = word.text;
      
      // Generate options (correct + 3 random)
      const options = [word.translation];
      
      // Get other random translations
      const otherTranslations = words
        .filter(w => w.id !== word.id && w.translation)
        .map(w => w.translation);
      
      // Shuffle and take first 3
      const randomTranslations = shuffleArray(otherTranslations).slice(0, 3);
      
      // Add to options and shuffle
      options.push(...randomTranslations);
      const shuffledOptions = shuffleArray(options);
      
      // Display options
      quizOptionsEl.innerHTML = '';
      shuffledOptions.forEach(option => {
        const optionEl = document.createElement('button');
        optionEl.className = 'w-full py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500';
        optionEl.textContent = option;
        
        optionEl.addEventListener('click', () => handleQuizAnswer(option, word.translation));
        
        quizOptionsEl.appendChild(optionEl);
      });
      
      // Hide feedback
      quizFeedbackEl.classList.add('hidden');
      quizFeedbackEl.innerHTML = '';
      
      // Update button states
      nextQuizBtn.disabled = true;
    }
    
    // Handle quiz answer
    function handleQuizAnswer(selected, correct) {
      // Disable all options
      const options = quizOptionsEl.querySelectorAll('button');
      options.forEach(option => {
        option.disabled = true;
        
        if (option.textContent === correct) {
          option.classList.add('bg-green-100', 'border-green-500');
        } else if (option.textContent === selected && selected !== correct) {
          option.classList.add('bg-red-100', 'border-red-500');
        }
      });
      
      // Show feedback
      quizFeedbackEl.classList.remove('hidden');
      
      if (selected === correct) {
        quizFeedbackEl.innerHTML = `
          <div class="bg-green-100 p-3 rounded-md">
            <p class="text-green-800">Correct! Well done.</p>
          </div>
        `;
      } else {
        quizFeedbackEl.innerHTML = `
          <div class="bg-red-100 p-3 rounded-md">
            <p class="text-red-800">Incorrect. The correct answer is: ${correct}</p>
          </div>
        `;
      }
      
      // Enable next button
      nextQuizBtn.disabled = false;
    }
    
    // Show quiz results
    function showQuizResults() {
      quizWordEl.textContent = 'Quiz Complete!';
      
      quizOptionsEl.innerHTML = '';
      quizFeedbackEl.classList.remove('hidden');
      quizFeedbackEl.innerHTML = `
        <div class="bg-blue-100 p-3 rounded-md">
          <p class="text-blue-800">You've completed the quiz with ${quizWords.length} words.</p>
          <p class="text-blue-800 mt-2">Continue reviewing to improve your vocabulary!</p>
        </div>
      `;
      
      closeQuizBtn.textContent = 'Close';
      nextQuizBtn.classList.add('hidden');
    }
    
    // Utility to shuffle array
    function shuffleArray(array) {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }
    
    // Display error message
    function displayErrorMessage(message) {
      const alertElement = document.createElement('div');
      alertElement.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4';
      alertElement.innerHTML = `<p>${message}</p>`;
      
      document.querySelector('.max-w-7xl').prepend(alertElement);
    }
    
    // Initialize page
    initReviewPage();
  });