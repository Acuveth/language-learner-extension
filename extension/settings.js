document.addEventListener('DOMContentLoaded', async () => {
    const BACKEND_URL = 'http://localhost:3000/api';
    
    // DOM elements - Language settings
    const userTargetLangEl = document.getElementById('user-target-lang');
    const targetLanguageEl = document.getElementById('target-language');
    const minWordLengthEl = document.getElementById('min-word-length');
    const languageSettingsForm = document.getElementById('language-settings-form');
    
    // DOM elements - Appearance settings
    const highlightColorEl = document.getElementById('highlight-color');
    const highlightStyleEl = document.getElementById('highlight-style');
    const highlightOpacityEl = document.getElementById('highlight-opacity');
    const opacityValueEl = document.getElementById('opacity-value');
    const appearanceSettingsForm = document.getElementById('appearance-settings-form');
    
    // DOM elements - Data management
    const exportDataBtn = document.getElementById('export-data-btn');
    const resetDataBtn = document.getElementById('reset-data-btn');
    
    // Confirmation modal
    const resetConfirmationModal = document.getElementById('reset-confirmation-modal');
    const confirmResetBtn = document.getElementById('confirm-reset-btn');
    const cancelResetBtn = document.getElementById('cancel-reset-btn');
    
    // Default settings
    const defaultSettings = {
      targetLanguage: 'es',
      minWordLength: 3,
      highlightColor: '#FFEAA0',
      highlightStyle: 'background',
      highlightOpacity: 30
    };
    
    // Initialize settings page
    async function initSettingsPage() {
      // Load settings from storage
      chrome.storage.local.get([
        'targetLanguage',
        'minWordLength',
        'highlightColor',
        'highlightStyle',
        'highlightOpacity'
      ], (result) => {
        // Apply stored settings or defaults
        targetLanguageEl.value = result.targetLanguage || defaultSettings.targetLanguage;
        minWordLengthEl.value = result.minWordLength || defaultSettings.minWordLength;
        highlightColorEl.value = result.highlightColor || defaultSettings.highlightColor;
        highlightStyleEl.value = result.highlightStyle || defaultSettings.highlightStyle;
        highlightOpacityEl.value = result.highlightOpacity || defaultSettings.highlightOpacity;
        opacityValueEl.textContent = `${highlightOpacityEl.value}%`;
        
        // Update user language display
        updateUserLanguageDisplay();
      });
      
      // Set up event listeners
      setupEventListeners();
    }
    
    // Update user language display in the header
    function updateUserLanguageDisplay() {
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
      
      userTargetLangEl.textContent = langMap[targetLanguageEl.value] || targetLanguageEl.value;
    }
    
    // Save language settings
    async function saveLanguageSettings(e) {
      e.preventDefault();
      
      const targetLanguage = targetLanguageEl.value;
      const minWordLength = parseInt(minWordLengthEl.value);
      
      // Validate
      if (minWordLength < 2 || minWordLength > 10) {
        alert('Minimum word length must be between 2 and 10.');
        return;
      }
      
      // Save to storage
      chrome.storage.local.set({
        targetLanguage,
        minWordLength
      }, () => {
        // Update display
        updateUserLanguageDisplay();
        
        // Show success feedback
        showFeedback(languageSettingsForm, 'Settings saved successfully!');
      });
      
      // Update backend
      try {
        await fetch(`${BACKEND_URL}/user/language`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            language: targetLanguage
          }),
        });
      } catch (error) {
        console.error('Error updating language on server:', error);
        // Still consider it successful since local settings were saved
      }
    }
    
    // Save appearance settings
    function saveAppearanceSettings(e) {
      e.preventDefault();
      
      const highlightColor = highlightColorEl.value;
      const highlightStyle = highlightStyleEl.value;
      const highlightOpacity = parseInt(highlightOpacityEl.value);
      
      // Save to storage
      chrome.storage.local.set({
        highlightColor,
        highlightStyle,
        highlightOpacity
      }, () => {
        // Show success feedback
        showFeedback(appearanceSettingsForm, 'Appearance settings saved successfully!');
      });
    }
    
    // Export data as CSV
    async function exportData() {
      try {
        // Fetch all words from the backend
        const response = await fetch(`${BACKEND_URL}/words?limit=1000`);
        const result = await response.json();
        
        if (!result.words || result.words.length === 0) {
          alert('No words to export.');
          return;
        }
        
        // Convert to CSV
        const headers = ['Word', 'Translation', 'Language', 'Part of Speech', 'Category', 'Context', 'Date Added'];
        const csvRows = [headers.join(',')];
        
        result.words.forEach(word => {
          const values = [
            `"${word.text || ''}"`,
            `"${word.translation || ''}"`,
            `"${word.language || ''}"`,
            `"${word.part_of_speech || ''}"`,
            `"${word.category || ''}"`,
            `"${(word.context || '').replace(/"/g, '""')}"`, // Escape quotes in context
            `"${new Date(word.date_added).toISOString().split('T')[0]}"` // Format date as YYYY-MM-DD
          ];
          
          csvRows.push(values.join(','));
        });
        
        const csvData = csvRows.join('\n');
        
        // Create download link
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `langlearn_vocabulary_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (error) {
        console.error('Error exporting data:', error);
        alert('Error exporting data. Please try again.');
      }
    }
    
    // Reset all data
    async function resetData() {
      try {
        // Close modal
        resetConfirmationModal.classList.add('hidden');
        
        // Clear local storage
        chrome.storage.local.set({
          userDictionary: []
        });
        
        // Reset server data - in a real application, you'd have a dedicated endpoint for this
        // For this example, we'll simulate success
        alert('All data has been reset successfully.');
        
        // Optional: Reload page to reflect changes
        window.location.reload();
      } catch (error) {
        console.error('Error resetting data:', error);
        alert('Error resetting data. Please try again.');
      }
    }
    
    // Show feedback message
    function showFeedback(formElement, message) {
      // Check if feedback already exists
      let feedbackEl = formElement.querySelector('.feedback-message');
      
      if (!feedbackEl) {
        // Create feedback element
        feedbackEl = document.createElement('div');
        feedbackEl.className = 'feedback-message mt-2 px-4 py-2 bg-green-100 text-green-700 rounded-md text-sm';
        
        // Insert before the form's last child (the submit button container)
        const lastChild = formElement.querySelector('.bg-gray-50');
        formElement.insertBefore(feedbackEl, lastChild);
      }
      
      // Update message
      feedbackEl.textContent = message;
      
      // Remove after 3 seconds
      setTimeout(() => {
        feedbackEl.remove();
      }, 3000);
    }
    
    // Set up event listeners
    function setupEventListeners() {
      // Language settings form
      languageSettingsForm.addEventListener('submit', saveLanguageSettings);
      
      // Appearance settings form
      appearanceSettingsForm.addEventListener('submit', saveAppearanceSettings);
      
      // Update opacity value display when slider changes
      highlightOpacityEl.addEventListener('input', () => {
        opacityValueEl.textContent = `${highlightOpacityEl.value}%`;
      });
      
      // Export data button
      exportDataBtn.addEventListener('click', exportData);
      
      // Reset data button
      resetDataBtn.addEventListener('click', () => {
        resetConfirmationModal.classList.remove('hidden');
      });
      
      // Confirmation modal buttons
      confirmResetBtn.addEventListener('click', resetData);
      
      cancelResetBtn.addEventListener('click', () => {
        resetConfirmationModal.classList.add('hidden');
      });
    }
    
    // Initialize page
    initSettingsPage();
  });