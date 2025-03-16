const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
const dbPath = path.join(dataDir, 'chatminds.db');
const db = new sqlite3.Database(dbPath);

// Initialize database with required tables
function initDatabase() {
  db.serialize(() => {
    // Create users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create chat history table
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        conversation_id TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create PDFs table
    db.run(`
      CREATE TABLE IF NOT EXISTS pdfs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        title TEXT,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        content TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create PDF chat history table
    db.run(`
      CREATE TABLE IF NOT EXISTS pdf_chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        pdf_id INTEGER,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (pdf_id) REFERENCES pdfs(id)
      )
    `);

    console.log('Database initialized successfully');
  });
}

// Get or create user by session ID
function getOrCreateUser(sessionId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE session_id = ?', [sessionId], (err, user) => {
      if (err) return reject(err);
      
      if (user) {
        resolve(user);
      } else {
        db.run('INSERT INTO users (session_id) VALUES (?)', [sessionId], function(err) {
          if (err) return reject(err);
          
          resolve({ id: this.lastID, session_id: sessionId });
        });
      }
    });
  });
}

// Save chat message
function saveChatMessage(userId, role, content, conversationId) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO chat_history (user_id, role, content, conversation_id) VALUES (?, ?, ?, ?)',
      [userId, role, content, conversationId],
      function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

// Get chat history for a user
function getChatHistory(userId, conversationId = null) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM chat_history WHERE user_id = ?';
    let params = [userId];
    
    if (conversationId) {
      query += ' AND conversation_id = ?';
      params.push(conversationId);
    }
    
    query += ' ORDER BY timestamp ASC';
    
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Save PDF information
function savePdf(userId, filename, filepath, title, content) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO pdfs (user_id, filename, filepath, title, content) VALUES (?, ?, ?, ?, ?)',
      [userId, filename, filepath, title, content],
      function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

// Get PDF by ID
function getPdfById(pdfId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM pdfs WHERE id = ?', [pdfId], (err, pdf) => {
      if (err) return reject(err);
      resolve(pdf);
    });
  });
}

// Get all PDFs for a user
function getUserPdfs(userId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM pdfs WHERE user_id = ? ORDER BY upload_date DESC', [userId], (err, pdfs) => {
      if (err) return reject(err);
      resolve(pdfs);
    });
  });
}

// Save PDF chat message
function savePdfChatMessage(userId, pdfId, role, content) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO pdf_chat_history (user_id, pdf_id, role, content) VALUES (?, ?, ?, ?)',
      [userId, pdfId, role, content],
      function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

// Get PDF chat history
function getPdfChatHistory(userId, pdfId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM pdf_chat_history WHERE user_id = ? AND pdf_id = ? ORDER BY timestamp ASC',
      [userId, pdfId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

// Delete a conversation
function deleteChatConversation(userId, conversationId) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM chat_history WHERE user_id = ? AND conversation_id = ?',
      [userId, conversationId],
      function(err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

// Delete a PDF
function deletePdf(userId, pdfId) {
  return new Promise((resolve, reject) => {
    // First delete associated chat messages
    db.run(
      'DELETE FROM pdf_chat_history WHERE user_id = ? AND pdf_id = ?',
      [userId, pdfId],
      (err) => {
        if (err) return reject(err);
        
        // Then delete the PDF
        db.run(
          'DELETE FROM pdfs WHERE id = ? AND user_id = ?',
          [pdfId, userId],
          function(err) {
            if (err) return reject(err);
            resolve();
          }
        );
      }
    );
  });
}

module.exports = {
  db,
  initDatabase,
  getOrCreateUser,
  saveChatMessage,
  getChatHistory,
  savePdf,
  getPdfById,
  getUserPdfs,
  savePdfChatMessage,
  getPdfChatHistory,
  deleteChatConversation,
  deletePdf
}; 