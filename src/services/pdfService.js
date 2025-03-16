const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const { savePdf } = require('../models/database');

// Parse PDF content
async function parsePdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return {
      text: data.text,
      info: data.info,
      metadata: data.metadata,
      numPages: data.numpages
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}

// Save uploaded PDF
async function saveUploadedPdf(file, userId) {
  try {
    // Generate unique filename
    const originalName = file.originalname;
    const uniqueFilename = `${Date.now()}-${uuidv4()}${path.extname(originalName)}`;
    const relativePath = path.join('uploads', uniqueFilename);
    const fullPath = path.join(__dirname, '../../', relativePath);
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Move file to uploads directory
    fs.copyFileSync(file.path, fullPath);
    fs.unlinkSync(file.path); // Remove temp file
    
    // Parse PDF content
    const pdfData = await parsePdf(fullPath);
    
    // Save PDF info to database
    const pdfId = await savePdf(
      userId,
      originalName,
      relativePath,
      pdfData.info?.Title || originalName,
      pdfData.text
    );
    
    return {
      id: pdfId,
      filename: originalName,
      filepath: relativePath,
      title: pdfData.info?.Title || originalName,
      numPages: pdfData.numPages
    };
  } catch (error) {
    console.error('Error saving uploaded PDF:', error);
    throw error;
  }
}

// Get PDF content chunks
function getPdfContentChunks(content, chunkSize = 1000) {
  const chunks = [];
  const words = content.split(' ');
  let currentChunk = '';
  
  for (const word of words) {
    if ((currentChunk + ' ' + word).length <= chunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      chunks.push(currentChunk);
      currentChunk = word;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

module.exports = {
  parsePdf,
  saveUploadedPdf,
  getPdfContentChunks
}; 