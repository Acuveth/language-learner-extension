const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const axios = require('axios');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection
let db;

// Initialize database
async function initializeDB() {
  // Open database connection
  db = await open({
    filename: path.join(__dirname, 'langlearn.db'),
    driver: sqlite3.Database
  });

  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      translation TEXT,
      language TEXT NOT NULL,
      part_of_speech TEXT,
      category TEXT DEFAULT 'Learning',
      context TEXT,
      date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_language TEXT DEFAULT 'es',
      min_word_length INTEGER DEFAULT 3
    );

    CREATE TABLE IF NOT EXISTS pages_visited (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT,
      date_visited TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cheatsheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cheatsheet_words (
      cheatsheet_id INTEGER,
      word_id INTEGER,
      PRIMARY KEY (cheatsheet_id, word_id),
      FOREIGN KEY (cheatsheet_id) REFERENCES cheatsheets(id) ON DELETE CASCADE,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    );
  `);

  // Insert default user settings if none exist
  const settings = await db.get('SELECT * FROM user_settings LIMIT 1');
  if (!settings) {
    await db.run('INSERT INTO user_settings (target_language, min_word_length) VALUES (?, ?)', ['es', 3]);
  }
}

// Initialize database when server starts
initializeDB().then(() => {
  console.log('Database initialized');
}).catch(err => {
  console.error('Error initializing database:', err);
});

// Helper function for translation
async function translateWord(word, targetLang) {
  try {
    // Note: In a real application, you would use a translation API like Google Translate
    // For this demo, we'll use a simplified approach with common words

    // Sample translations for demonstration
    const translations = {
      es: {
        'hello': 'hola',
        'world': 'mundo',
        'book': 'libro',
        'house': 'casa',
        'car': 'coche',
        'tree': 'árbol',
        'dog': 'perro',
        'cat': 'gato',
        'water': 'agua',
        'food': 'comida'
      },
      fr: {
        'hello': 'bonjour',
        'world': 'monde',
        'book': 'livre',
        'house': 'maison',
        'car': 'voiture',
        'tree': 'arbre',
        'dog': 'chien',
        'cat': 'chat',
        'water': 'eau',
        'food': 'nourriture'
      },
      de: {
        'hello': 'hallo',
        'world': 'welt',
        'book': 'buch',
        'house': 'haus',
        'car': 'auto',
        'tree': 'baum',
        'dog': 'hund',
        'cat': 'katze',
        'water': 'wasser',
        'food': 'essen'
      }
    };

    // Get translation from our sample data
    const wordLower = word.toLowerCase();
    const translation = translations[targetLang]?.[wordLower] || null;

    if (translation) {
      return translation;
    }

    // For words not in our sample data, you would typically use a translation API
    // This is a placeholder for that functionality
    console.log(`Translation not found for word: ${word}`);
    return `[${word} in ${targetLang}]`;
  } catch (error) {
    console.error('Error translating word:', error);
    return null;
  }
}

// Helper function to determine part of speech (simplified for demonstration)
function determinePartOfSpeech(word) {
  const nouns = ['book', 'house', 'car', 'tree', 'dog', 'cat', 'water', 'food'];
  const verbs = ['run', 'jump', 'eat', 'sleep', 'write', 'read', 'drive', 'swim'];
  const adjectives = ['big', 'small', 'fast', 'slow', 'good', 'bad', 'hot', 'cold'];
  const adverbs = ['quickly', 'slowly', 'well', 'badly', 'very', 'really', 'always', 'never'];

  const wordLower = word.toLowerCase();

  if (nouns.includes(wordLower)) return 'Noun';
  if (verbs.includes(wordLower)) return 'Verb';
  if (adjectives.includes(wordLower)) return 'Adjective';
  if (adverbs.includes(wordLower)) return 'Adverb';

  // Default to null if we can't determine
  return null;
}

// API Routes

// Get user settings
app.get('/api/user/settings', async (req, res) => {
  try {
    const settings = await db.get('SELECT * FROM user_settings ORDER BY id LIMIT 1');
    res.json(settings);
  } catch (error) {
    console.error('Error getting user settings:', error);
    res.status(500).json({ error: 'Failed to get user settings' });
  }
});

// Update user language preference
app.post('/api/user/language', async (req, res) => {
  try {
    const { language } = req.body;
    if (!language) {
      return res.status(400).json({ error: 'Language is required' });
    }

    await db.run('UPDATE user_settings SET target_language = ? WHERE id = 1', [language]);
    res.json({ success: true, language });
  } catch (error) {
    console.error('Error updating language:', error);
    res.status(500).json({ error: 'Failed to update language' });
  }
});

// Get user statistics
app.get('/api/user/stats', async (req, res) => {
  try {
    // Count total words by category
    const knownCount = await db.get('SELECT COUNT(*) as count FROM words WHERE category = ?', ['Known']);
    const learningCount = await db.get('SELECT COUNT(*) as count FROM words WHERE category = ?', ['Learning']);
    
    // Count words added today
    const today = new Date().toISOString().split('T')[0];
    const todayCount = await db.get(
      'SELECT COUNT(*) as count FROM words WHERE date_added >= ?', 
      [`${today}T00:00:00.000Z`]
    );
    
    // Count pages visited
    const pagesCount = await db.get('SELECT COUNT(*) as count FROM pages_visited');
    
    res.json({
      knownWords: knownCount.count,
      learningWords: learningCount.count,
      todayWords: todayCount.count,
      pagesVisited: pagesCount.count
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

// Get words with filtering, pagination and sorting
app.get('/api/words', async (req, res) => {
  try {
    const { page = 1, limit = 10, filter = 'all', category = 'all', sort = 'date-desc' } = req.query;
    
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params = [];
    
    // Apply filters
    if (filter !== 'all') {
      whereClause += ' WHERE category = ?';
      params.push(filter === 'known' ? 'Known' : 'Learning');
    }
    
    if (category !== 'all' && category) {
      whereClause += whereClause ? ' AND part_of_speech = ?' : ' WHERE part_of_speech = ?';
      params.push(category);
    }
    
    // Determine sort order
    let orderClause = '';
    switch(sort) {
      case 'date-asc':
        orderClause = ' ORDER BY date_added ASC';
        break;
      case 'alpha-asc':
        orderClause = ' ORDER BY text ASC';
        break;
      case 'alpha-desc':
        orderClause = ' ORDER BY text DESC';
        break;
      case 'date-desc':
      default:
        orderClause = ' ORDER BY date_added DESC';
    }
    
    // Count total words matching filters
    const countQuery = `SELECT COUNT(*) as total FROM words${whereClause}`;
    const countResult = await db.get(countQuery, params);
    
    // Get words with pagination
    const wordsQuery = `
      SELECT * FROM words${whereClause}${orderClause} 
      LIMIT ? OFFSET ?
    `;
    
    const words = await db.all(wordsQuery, [...params, limit, offset]);
    
    res.json({ 
      words, 
      total: countResult.total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error getting words:', error);
    res.status(500).json({ error: 'Failed to get words' });
  }
});

// Get recent words
app.get('/api/words/recent', async (req, res) => {
  try {
    const words = await db.all('SELECT * FROM words ORDER BY date_added DESC LIMIT 10');
    res.json(words);
  } catch (error) {
    console.error('Error getting recent words:', error);
    res.status(500).json({ error: 'Failed to get recent words' });
  }
});

// Get word categories statistics
app.get('/api/words/categories', async (req, res) => {
  try {
    const categories = await db.all('SELECT part_of_speech, COUNT(*) as count FROM words WHERE part_of_speech IS NOT NULL GROUP BY part_of_speech');
    
    // Convert to object format
    const result = {};
    categories.forEach(cat => {
      result[cat.part_of_speech] = cat.count;
    });
    
    // Add count for words without part of speech
    const otherCount = await db.get('SELECT COUNT(*) as count FROM words WHERE part_of_speech IS NULL');
    result['Other'] = otherCount.count;
    
    res.json(result);
  } catch (error) {
    console.error('Error getting word categories:', error);
    res.status(500).json({ error: 'Failed to get word categories' });
  }
});

// Get user progress over time
app.get('/api/user/progress', async (req, res) => {
  try {
    // Get dates for the last 7 days
    const dates = [];
    const knownCounts = [];
    const learningCounts = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      dates.push(dateString);
      
      // Count known words as of this date
      const knownCount = await db.get(
        'SELECT COUNT(*) as count FROM words WHERE category = ? AND date_added <= ?',
        ['Known', `${dateString}T23:59:59.999Z`]
      );
      
      // Count learning words as of this date
      const learningCount = await db.get(
        'SELECT COUNT(*) as count FROM words WHERE category = ? AND date_added <= ?',
        ['Learning', `${dateString}T23:59:59.999Z`]
      );
      
      knownCounts.push(knownCount.count);
      learningCounts.push(learningCount.count);
    }
    
    res.json({
      labels: dates,
      known: knownCounts,
      learning: learningCounts
    });
  } catch (error) {
    console.error('Error getting progress data:', error);
    res.status(500).json({ error: 'Failed to get progress data' });
  }
});

// Process words from a page
app.post('/api/words/process', async (req, res) => {
  try {
    const { words, language, url, title } = req.body;
    
    if (!words || !Array.isArray(words)) {
      return res.status(400).json({ error: 'Words array is required' });
    }
    
    // Get user's target language
    const settings = await db.get('SELECT target_language FROM user_settings LIMIT 1');
    const targetLang = language || settings.target_language;
    
    // Store page visit
    if (url) {
      await db.run('INSERT INTO pages_visited (url, title) VALUES (?, ?)', [url, title]);
    }
    
    // Process each word
    const knownWords = [];
    const newWords = [];
    
    for (const word of words) {
      // Skip empty words
      if (!word.trim()) continue;
      
      // Check if word exists in database
      const existingWord = await db.get('SELECT * FROM words WHERE text = ? COLLATE NOCASE', [word]);
      
      if (existingWord) {
        knownWords.push(existingWord.text);
      } else {
        // Translate the word
        const translation = await translateWord(word, targetLang);
        
        // Determine part of speech
        const partOfSpeech = determinePartOfSpeech(word);
        
        // Insert new word
        const result = await db.run(
          'INSERT INTO words (text, translation, language, part_of_speech, category) VALUES (?, ?, ?, ?, ?)',
          [word, translation, targetLang, partOfSpeech, 'Learning']
        );
        
        newWords.push({
          id: result.lastID,
          text: word,
          translation,
          language: targetLang,
          part_of_speech: partOfSpeech,
          category: 'Learning'
        });
      }
    }
    
    res.json({
      success: true,
      knownWords,
      newWords,
      total: knownWords.length + newWords.length
    });
  } catch (error) {
    console.error('Error processing words:', error);
    res.status(500).json({ error: 'Failed to process words' });
  }
});

// Mark word as known
app.post('/api/words/known', async (req, res) => {
  try {
    const { word } = req.body;
    
    if (!word) {
      return res.status(400).json({ error: 'Word is required' });
    }
    
    // Check if word exists
    let wordRecord = await db.get('SELECT * FROM words WHERE text = ? COLLATE NOCASE', [word]);
    
    if (wordRecord) {
      // Update category to Known
      await db.run('UPDATE words SET category = ? WHERE id = ?', ['Known', wordRecord.id]);
    } else {
      // Get user's target language
      const settings = await db.get('SELECT target_language FROM user_settings LIMIT 1');
      
      // Translate the word
      const translation = await translateWord(word, settings.target_language);
      
      // Determine part of speech
      const partOfSpeech = determinePartOfSpeech(word);
      
      // Insert new word as Known
      const result = await db.run(
        'INSERT INTO words (text, translation, language, part_of_speech, category) VALUES (?, ?, ?, ?, ?)',
        [word, translation, settings.target_language, partOfSpeech, 'Known']
      );
      
      wordRecord = {
        id: result.lastID,
        text: word,
        translation,
        language: settings.target_language,
        part_of_speech: partOfSpeech,
        category: 'Known'
      };
    }
    
    res.json({
      success: true,
      word: wordRecord
    });
  } catch (error) {
    console.error('Error marking word as known:', error);
    res.status(500).json({ error: 'Failed to mark word as known' });
  }
});

// Add word to review list
app.post('/api/words/review', async (req, res) => {
  try {
    const { word, translation, context } = req.body;
    
    if (!word) {
      return res.status(400).json({ error: 'Word is required' });
    }
    
    // Check if word exists
    let wordRecord = await db.get('SELECT * FROM words WHERE text = ? COLLATE NOCASE', [word]);
    
    if (wordRecord) {
      // Update context if provided
      if (context !== undefined) {
        await db.run('UPDATE words SET context = ? WHERE id = ?', [context, wordRecord.id]);
        wordRecord.context = context;
      }
    } else {
      // Get user's target language
      const settings = await db.get('SELECT target_language FROM user_settings LIMIT 1');
      
      // Use provided translation or get one
      const wordTranslation = translation || await translateWord(word, settings.target_language);
      
      // Determine part of speech
      const partOfSpeech = determinePartOfSpeech(word);
      
      // Insert new word for review
      const result = await db.run(
        'INSERT INTO words (text, translation, language, part_of_speech, category, context) VALUES (?, ?, ?, ?, ?, ?)',
        [word, wordTranslation, settings.target_language, partOfSpeech, 'Learning', context || null]
      );
      
      wordRecord = {
        id: result.lastID,
        text: word,
        translation: wordTranslation,
        language: settings.target_language,
        part_of_speech: partOfSpeech,
        category: 'Learning',
        context: context || null
      };
    }
    
    res.json({
      success: true,
      word: wordRecord
    });
  } catch (error) {
    console.error('Error adding word to review:', error);
    res.status(500).json({ error: 'Failed to add word to review' });
  }
});

// Toggle word status (Known/Learning)
app.post('/api/words/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get current word status
    const word = await db.get('SELECT * FROM words WHERE id = ?', [id]);
    
    if (!word) {
      return res.status(404).json({ error: 'Word not found' });
    }
    
    // Toggle status
    const newCategory = word.category === 'Known' ? 'Learning' : 'Known';
    
    await db.run('UPDATE words SET category = ? WHERE id = ?', [newCategory, id]);
    
    res.json({
      success: true,
      id: parseInt(id),
      category: newCategory
    });
  } catch (error) {
    console.error('Error toggling word status:', error);
    res.status(500).json({ error: 'Failed to toggle word status' });
  }
});

// Delete word
app.delete('/api/words/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.run('DELETE FROM words WHERE id = ?', [id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Word not found' });
    }
    
    res.json({
      success: true,
      id: parseInt(id)
    });
  } catch (error) {
    console.error('Error deleting word:', error);
    res.status(500).json({ error: 'Failed to delete word' });
  }
});

// Translate a word
app.post('/api/translate', async (req, res) => {
  try {
    const { word, targetLang } = req.body;
    
    if (!word) {
      return res.status(400).json({ error: 'Word is required' });
    }
    
    // Get user's target language if not provided
    let language = targetLang;
    if (!language) {
      const settings = await db.get('SELECT target_language FROM user_settings LIMIT 1');
      language = settings.target_language;
    }
    
    const translation = await translateWord(word, language);
    
    res.json({
      success: true,
      word,
      translation,
      language
    });
  } catch (error) {
    console.error('Error translating word:', error);
    res.status(500).json({ error: 'Failed to translate word' });
  }
});

// Create a cheatsheet
app.post('/api/cheatsheets', async (req, res) => {
  try {
    const { title, wordIds } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    if (!wordIds || !Array.isArray(wordIds) || wordIds.length === 0) {
      return res.status(400).json({ error: 'Word IDs are required' });
    }
    
    // Begin transaction
    await db.run('BEGIN TRANSACTION');
    
    // Create cheatsheet
    const result = await db.run('INSERT INTO cheatsheets (title) VALUES (?)', [title]);
    const cheatsheetId = result.lastID;
    
    // Add words to cheatsheet
    for (const wordId of wordIds) {
      await db.run('INSERT INTO cheatsheet_words (cheatsheet_id, word_id) VALUES (?, ?)', [cheatsheetId, wordId]);
    }
    
    // Commit transaction
    await db.run('COMMIT');
    
    res.json({
      success: true,
      id: cheatsheetId,
      title,
      wordCount: wordIds.length
    });
  } catch (error) {
    // Rollback transaction on error
    await db.run('ROLLBACK');
    console.error('Error creating cheatsheet:', error);
    res.status(500).json({ error: 'Failed to create cheatsheet' });
  }
});

// Get all cheatsheets
app.get('/api/cheatsheets', async (req, res) => {
  try {
    const cheatsheets = await db.all(`
      SELECT c.*, COUNT(cw.word_id) as word_count 
      FROM cheatsheets c
      LEFT JOIN cheatsheet_words cw ON c.id = cw.cheatsheet_id
      GROUP BY c.id
      ORDER BY c.date_created DESC
    `);
    
    res.json(cheatsheets);
  } catch (error) {
    console.error('Error getting cheatsheets:', error);
    res.status(500).json({ error: 'Failed to get cheatsheets' });
  }
});

// Get a specific cheatsheet with its words
app.get('/api/cheatsheets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get cheatsheet details
    const cheatsheet = await db.get('SELECT * FROM cheatsheets WHERE id = ?', [id]);
    
    if (!cheatsheet) {
      return res.status(404).json({ error: 'Cheatsheet not found' });
    }
    
    // Get words in the cheatsheet
    const words = await db.all(`
      SELECT w.* 
      FROM words w
      JOIN cheatsheet_words cw ON w.id = cw.word_id
      WHERE cw.cheatsheet_id = ?
      ORDER BY w.part_of_speech, w.text
    `, [id]);
    
    cheatsheet.words = words;
    
    res.json(cheatsheet);
  } catch (error) {
    console.error('Error getting cheatsheet:', error);
    res.status(500).json({ error: 'Failed to get cheatsheet' });
  }
});

// Delete a cheatsheet
app.delete('/api/cheatsheets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.run('DELETE FROM cheatsheets WHERE id = ?', [id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Cheatsheet not found' });
    }
    
    res.json({
      success: true,
      id: parseInt(id)
    });
  } catch (error) {
    console.error('Error deleting cheatsheet:', error);
    res.status(500).json({ error: 'Failed to delete cheatsheet' });
  }
});

// Sync user dictionary
app.post('/api/user/sync', async (req, res) => {
  try {
    const { knownWords } = req.body;
    
    if (!knownWords || !Array.isArray(knownWords)) {
      return res.status(400).json({ error: 'Known words array is required' });
    }
    
    // Get user's target language
    const settings = await db.get('SELECT target_language FROM user_settings LIMIT 1');
    
    // Process each word
    for (const word of knownWords) {
      // Skip empty words
      if (!word.trim()) continue;
      
      // Check if word exists in database
      const existingWord = await db.get('SELECT * FROM words WHERE text = ? COLLATE NOCASE', [word]);
      
      if (!existingWord) {
        // Translate the word
        const translation = await translateWord(word, settings.target_language);
        
        // Determine part of speech
        const partOfSpeech = determinePartOfSpeech(word);
        
        // Insert new word as Known
        await db.run(
          'INSERT INTO words (text, translation, language, part_of_speech, category) VALUES (?, ?, ?, ?, ?)',
          [word, translation, settings.target_language, partOfSpeech, 'Known']
        );
      } else if (existingWord.category !== 'Known') {
        // Update category to Known
        await db.run('UPDATE words SET category = ? WHERE id = ?', ['Known', existingWord.id]);
      }
    }
    
    res.json({
      success: true,
      syncedWords: knownWords.length
    });
  } catch (error) {
    console.error('Error syncing user dictionary:', error);
    res.status(500).json({ error: 'Failed to sync user dictionary' });
  }
});

// Get user data
app.get('/api/user/data', async (req, res) => {
  try {
    // Get user settings
    const settings = await db.get('SELECT * FROM user_settings LIMIT 1');
    
    // Get known words
    const knownWords = await db.all('SELECT text FROM words WHERE category = ?', ['Known']);
    
    res.json({
      targetLanguage: settings.target_language,
      knownWords: knownWords.map(w => w.text)
    });
  } catch (error) {
    console.error('Error getting user data:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});