const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getOrCreateUser, getUserPdfs, getPdfById, savePdfChatMessage, getPdfChatHistory, deletePdf } = require('../models/database');
const { saveUploadedPdf } = require('../services/pdfService');
const { chatWithPdf } = require('../services/geminiService');

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '../../temp'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Upload PDF
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No PDF file uploaded' });
    }
    
    const sessionId = req.session.id;
    const user = await getOrCreateUser(sessionId);
    
    const pdfInfo = await saveUploadedPdf(req.file, user.id);
    
    res.json({
      success: true,
      pdf: pdfInfo
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({ success: false, error: 'Failed to upload PDF' });
  }
});

// Get user's PDFs
router.get('/list', async (req, res) => {
  try {
    const sessionId = req.session.id;
    const user = await getOrCreateUser(sessionId);
    
    const pdfs = await getUserPdfs(user.id);
    
    res.json({
      success: true,
      pdfs: pdfs.map(pdf => ({
        id: pdf.id,
        filename: pdf.filename,
        title: pdf.title,
        filepath: pdf.filepath,
        uploadDate: pdf.upload_date
      }))
    });
  } catch (error) {
    console.error('Error getting PDFs:', error);
    res.status(500).json({ success: false, error: 'Failed to get PDFs' });
  }
});

// Get PDF by ID
router.get('/:id', async (req, res) => {
  try {
    const pdfId = req.params.id;
    const pdf = await getPdfById(pdfId);
    
    if (!pdf) {
      return res.status(404).json({ success: false, error: 'PDF not found' });
    }
    
    res.json({
      success: true,
      pdf: {
        id: pdf.id,
        filename: pdf.filename,
        title: pdf.title,
        filepath: pdf.filepath,
        uploadDate: pdf.upload_date
      }
    });
  } catch (error) {
    console.error('Error getting PDF:', error);
    res.status(500).json({ success: false, error: 'Failed to get PDF' });
  }
});

// Get PDF chat history
router.get('/:id/chat', async (req, res) => {
  try {
    const pdfId = req.params.id;
    const sessionId = req.session.id;
    
    const user = await getOrCreateUser(sessionId);
    const history = await getPdfChatHistory(user.id, pdfId);
    
    res.json({ success: true, history });
  } catch (error) {
    console.error('Error getting PDF chat history:', error);
    res.status(500).json({ success: false, error: 'Failed to get PDF chat history' });
  }
});

// Chat with PDF
router.post('/:id/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const pdfId = req.params.id;
    const sessionId = req.session.id;
    
    // Get user and PDF
    const user = await getOrCreateUser(sessionId);
    const pdf = await getPdfById(pdfId);
    
    if (!pdf) {
      return res.status(404).json({ success: false, error: 'PDF not found' });
    }
    
    // Save user message
    await savePdfChatMessage(user.id, pdfId, 'user', message);
    
    // Get chat history
    const history = await getPdfChatHistory(user.id, pdfId);
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Generate response
    const response = await chatWithPdf(pdf.content, message, formattedHistory);
    
    // Save assistant response
    await savePdfChatMessage(user.id, pdfId, 'assistant', response.content);
    
    res.json({
      success: true,
      message: response.content
    });
  } catch (error) {
    console.error('Error chatting with PDF:', error);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
});

// Delete PDF
router.delete('/:id', async (req, res) => {
  try {
    const pdfId = req.params.id;
    const sessionId = req.session.id;
    
    // Get user and PDF
    const user = await getOrCreateUser(sessionId);
    const pdf = await getPdfById(pdfId);
    
    if (!pdf) {
      return res.status(404).json({ success: false, error: 'PDF not found' });
    }
    
    // Delete the file from the filesystem
    const filePath = path.join(__dirname, '../../', pdf.filepath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete from database
    await deletePdf(user.id, pdfId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting PDF:', error);
    res.status(500).json({ success: false, error: 'Failed to delete PDF' });
  }
});

module.exports = router; 