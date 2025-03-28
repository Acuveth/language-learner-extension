// Background script for LangLearn extension
const BACKEND_URL = 'http://localhost:3000/api';
let currentTab = null;
let isInitialized = false;

// Initialize when extension loads
chrome.runtime.onInstalled.addListener(async () => {
  console.log('LangLearn extension installed');
  
  // Set default user settings if not already set
  chrome.storage.local.get(['targetLanguage', 'userDictionary', 'minWordLength'], (result) => {
    if (!result.targetLanguage) {
      chrome.storage.local.set({ targetLanguage: 'es' }); // Default to Spanish
    }
    
    if (!result.userDictionary) {
      chrome.storage.local.set({ userDictionary: [] });
    }
    
    if (!result.minWordLength) {
      chrome.storage.local.set({ minWordLength: 3 });
    }
  });
  
  // Initial synchronization with backend
  initializeFromBackend();
});

// Initialize data from backend
async function initializeFromBackend() {
  try {
    const response = await fetch(`${BACKEND_URL}/user/data`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error('Backend server not responding properly');
      return;
    }
    
    const userData = await response.json();
    
    // Update local storage with user data
    if (userData.knownWords) {
      chrome.storage.local.set({ userDictionary: userData.knownWords });
    }
    
    if (userData.targetLanguage) {
      chrome.storage.local.set({ targetLanguage: userData.targetLanguage });
    }
    
    isInitialized = true;
    console.log('Initialized from backend');
  } catch (error) {
    console.error('Error fetching user data from backend:', error);
    // We'll continue with local defaults if backend is not available
  }
}

// Track active tab
chrome.tabs.onActivated.addListener((activeInfo) => {
  currentTab = activeInfo.tabId;
});

// Handle messages from content script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  // Make sure we're initialized first
  if (!isInitialized) {
    try {
      await initializeFromBackend();
    } catch (error) {
      console.error('Failed to initialize from backend:', error);
    }
  }
  
  // Process words found on a page
  if (message.action === 'processPageWords') {
    try {
      const response = await fetch(`${BACKEND_URL}/words/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          words: message.words,
          language: message.language,
          url: sender.tab.url,
          title: sender.tab.title
        }),
      });
      
      if (!response.ok) {
        console.error('Backend server error processing words');
        return true;
      }
      
      const data = await response.json();
      
      // If the backend returned new known words, update the content script
      if (data.knownWords && data.knownWords.length > 0) {
        chrome.storage.local.get(['userDictionary'], (result) => {
          const combinedDictionary = [...new Set([...result.userDictionary || [], ...data.knownWords])];
          chrome.storage.local.set({ userDictionary: combinedDictionary });
          
          // Notify content script about dictionary update
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'updateDictionary',
            dictionary: combinedDictionary
          });
        });
      }
    } catch (error) {
      console.error('Error processing page words:', error);
    }
  }
  
  // Always return true for async sendResponse
  return true;
});

// Handle browser action click (extension icon)
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: 'dashboard.html' });
});

// Sync user dictionary periodically
setInterval(async () => {
  try {
    chrome.storage.local.get(['userDictionary'], async (result) => {
      if (result.userDictionary && result.userDictionary.length > 0) {
        await fetch(`${BACKEND_URL}/user/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            knownWords: result.userDictionary
          }),
        });
      }
    });
  } catch (error) {
    console.error('Error syncing user dictionary:', error);
  }
}, 15 * 60 * 1000); // Sync every 15 minutes