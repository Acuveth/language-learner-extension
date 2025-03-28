document.addEventListener('DOMContentLoaded', async () => {
  const BACKEND_URL = 'http://localhost:3000/api';
  
  // DOM elements
  const knownWordsCountEl = document.getElementById('known-words-count');
  const learningWordsCountEl = document.getElementById('learning-words-count');
  const todayWordsCountEl = document.getElementById('today-words-count');
  const recentWordsListEl = document.getElementById('recent-words-list');
  const openDashboardBtn = document.getElementById('open-dashboard');
  const reviewWordsBtn = document.getElementById('review-words');
  const languageSelector = document.getElementById('language-selector');
  
  // Load user stats
  try {
    const response = await fetch(`${BACKEND_URL}/user/stats`);
    const stats = await response.json();
    
    // Update the UI with stats
    knownWordsCountEl.textContent = stats.knownWords || 0;
    learningWordsCountEl.textContent = stats.learningWords || 0;
    todayWordsCountEl.textContent = stats.todayWords || 0;
    
    // Get recent words
    const recentResponse = await fetch(`${BACKEND_URL}/words/recent`);
    const recentWords = await recentResponse.json();
    
    // Update recent words list
    if (recentWords.length === 0) {
      recentWordsListEl.innerHTML = `
        <p class="text-sm text-gray-500 text-center">No recent words yet.</p>
      `;
    } else {
      recentWordsListEl.innerHTML = '';
      recentWords.forEach(word => {
        const wordElement = document.createElement('div');
        wordElement.className = 'recent-word flex justify-between items-center py-2 px-3 border-b border-gray-100';
        wordElement.innerHTML = `
          <div>
            <p class="font-medium">${word.text}</p>
            <p class="text-xs text-gray-500">${word.translation}</p>
          </div>
          <div class="text-xs ${word.category === 'Known' ? 'text-green-500' : 'text-orange-500'}">
            ${word.category}
          </div>
        `;
        recentWordsListEl.appendChild(wordElement);
      });
    }
    
    // Set current target language
    chrome.storage.local.get(['targetLanguage'], (result) => {
      if (result.targetLanguage) {
        languageSelector.value = result.targetLanguage;
      }
    });
    
  } catch (error) {
    console.error('Error loading user stats:', error);
    knownWordsCountEl.textContent = '?';
    learningWordsCountEl.textContent = '?';
    todayWordsCountEl.textContent = '?';
    recentWordsListEl.innerHTML = `
      <p class="text-sm text-red-500 text-center">Could not load data. Make sure the backend server is running.</p>
    `;
  }
  
  // Handle opening dashboard
  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'dashboard.html' });
  });
  
  // Handle opening review page
  reviewWordsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'review.html' });
  });
  
  // Handle language change
  languageSelector.addEventListener('change', (e) => {
    const newLanguage = e.target.value;
    chrome.storage.local.set({ targetLanguage: newLanguage });
    
    // Notify backend about language change
    fetch(`${BACKEND_URL}/user/language`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: newLanguage
      }),
    });
  });
});