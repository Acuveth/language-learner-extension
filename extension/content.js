// Global settings
const BACKEND_URL = 'http://localhost:3000/api';
const TARGET_LANG = 'es'; // Change this to the language you're learning
let userDictionary = new Set(); // Words the user already knows
let pageWords = new Set(); // Words found on current page
let translationCache = {}; // Cache for translations

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  // Get user's known words from storage
  chrome.storage.local.get(['userDictionary'], (result) => {
    if (result.userDictionary) {
      userDictionary = new Set(result.userDictionary);
    }
    
    // Start scanning the page
    scanPage();
  });
});

// Scan the page for words
function scanPage() {
  // Get all text nodes from the page (excluding script and style tags)
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script, style tags and tiny text nodes
        if (node.parentNode.tagName === 'SCRIPT' || 
            node.parentNode.tagName === 'STYLE' ||
            node.textContent.trim().length < 2) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  // Collect all text nodes
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  // Process each text node
  textNodes.forEach(processTextNode);
  
  // Send collected words to the background script for processing
  if (pageWords.size > 0) {
    chrome.runtime.sendMessage({
      action: 'processPageWords',
      words: Array.from(pageWords),
      language: TARGET_LANG
    });
  }
}

// Process each text node and highlight unknown words
function processTextNode(textNode) {
  const text = textNode.textContent;
  
  // Simple word extraction (can be improved for different languages)
  const words = text.match(/\\b[\\w']+\\b/g) || [];
  
  // Add to page words collection
  words.forEach(word => {
    if (word.length > 2) { // Skip short words
      const lowerWord = word.toLowerCase();
      pageWords.add(lowerWord);
      
      // Check if word is not in user's dictionary
      if (!userDictionary.has(lowerWord)) {
        // Replace the text node with highlighted version
        highlightWord(textNode, word);
      }
    }
  });
}

// Replace words in text nodes with highlighted versions
function highlightWord(textNode, word) {
  const parent = textNode.parentNode;
  const text = textNode.textContent;
  
  // Create regex that matches whole word with word boundaries
  const regex = new RegExp(`\\b${word}\\b`, 'g');
  
  // Replace the matched word with a span
  const replacedHTML = text.replace(regex, match => {
    return `<span class="langlearn-highlight" data-word="${match.toLowerCase()}">${match}</span>`;
  });
  
  // Create a temporary element to hold the new content
  const tempElement = document.createElement('span');
  tempElement.innerHTML = replacedHTML;
  
  // Replace the original node with the new content
  parent.replaceChild(tempElement, textNode);
}

// Event listener for hovering over highlighted words
document.addEventListener('mouseover', async (event) => {
  const target = event.target;
  
  // Check if the target is a highlighted word
  if (target.classList && target.classList.contains('langlearn-highlight')) {
    const word = target.getAttribute('data-word');
    
    // Show translation popup
    showTranslationPopup(target, word);
  }
});

// Show translation popup near the word
async function showTranslationPopup(element, word) {
  // Create popup if it doesn't exist
  let popup = document.getElementById('langlearn-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'langlearn-popup';
    document.body.appendChild(popup);
  }
  
  // Position popup near the word
  const rect = element.getBoundingClientRect();
  popup.style.top = `${window.scrollY + rect.top - 40}px`;
  popup.style.left = `${window.scrollX + rect.left}px`;
  
  // Get translation
  let translation;
  if (translationCache[word]) {
    translation = translationCache[word];
  } else {
    popup.innerHTML = '<div class="langlearn-loading">Loading...</div>';
    popup.style.display = 'block';
    
    try {
      const response = await fetch(`${BACKEND_URL}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word,
          targetLang: TARGET_LANG
        }),
      });
      
      const data = await response.json();
      translation = data.translation;
      translationCache[word] = translation;
    } catch (error) {
      translation = 'Translation error';
    }
  }
  
  // Update popup content
  popup.innerHTML = `
    <div class="langlearn-word">${word}</div>
    <div class="langlearn-translation">${translation}</div>
    <div class="langlearn-buttons">
      <button class="langlearn-mark-known">I know this</button>
      <button class="langlearn-add-review">Add to review</button>
    </div>
  `;
  
  // Show popup
  popup.style.display = 'block';
  
  // Add event listeners for buttons
  const knownButton = popup.querySelector('.langlearn-mark-known');
  knownButton.addEventListener('click', () => {
    markWordAsKnown(word);
    popup.style.display = 'none';
  });
  
  const reviewButton = popup.querySelector('.langlearn-add-review');
  reviewButton.addEventListener('click', () => {
    addWordToReview(word, translation);
    popup.style.display = 'none';
  });
}

// Hide popup when clicking elsewhere
document.addEventListener('click', (event) => {
  const popup = document.getElementById('langlearn-popup');
  if (popup && !popup.contains(event.target) && 
     !event.target.classList.contains('langlearn-highlight')) {
    popup.style.display = 'none';
  }
});

// Mark word as known
function markWordAsKnown(word) {
  userDictionary.add(word.toLowerCase());
  
  // Update storage
  chrome.storage.local.get(['userDictionary'], (result) => {
    const dictionary = result.userDictionary || [];
    dictionary.push(word.toLowerCase());
    chrome.storage.local.set({ userDictionary: dictionary });
  });
  
  // Notify the backend
  fetch(`${BACKEND_URL}/words/known`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      word: word.toLowerCase()
    }),
  });
  
  // Remove highlighting for this word
  const highlights = document.querySelectorAll(`.langlearn-highlight[data-word="${word.toLowerCase()}"]`);
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    const textNode = document.createTextNode(highlight.textContent);
    parent.replaceChild(textNode, highlight);
  });
}

// Add word to review list
function addWordToReview(word, translation) {
  // Notify the backend
  fetch(`${BACKEND_URL}/words/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      word: word.toLowerCase(),
      translation,
      context: getWordContext(word)
    }),
  });
}

// Get some context around the word
function getWordContext(word) {
  const highlights = document.querySelectorAll(`.langlearn-highlight[data-word="${word.toLowerCase()}"]`);
  if (highlights.length > 0) {
    const highlight = highlights[0];
    const parent = highlight.parentNode;
    return parent.textContent.substring(0, 100) + '...';
  }
  return '';
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateDictionary') {
    userDictionary = new Set(message.dictionary);
    // Rescan page with updated dictionary
    scanPage();
  }
});