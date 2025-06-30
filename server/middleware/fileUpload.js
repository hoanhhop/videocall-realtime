// server/middleware/fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const { promisify } = require('util');

// Configure multer storage
const storage = multer.memoryStorage();

// Create file filter for context files
const contextFileFilter = (req, file, cb) => {
  // Allow .txt, .docx, .doc, and .json files
  const allowedExtensions = ['.txt', '.docx', '.doc', '.json'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Please upload .txt, .docx, .doc, or .json files.'), false);
  }
};

// Create upload middleware
const upload = multer({ 
  storage, 
  fileFilter: contextFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * Middleware to process context files
 * Extracts text from .txt, .docx, .doc, or parses JSON
 */
const processContextFile = async (req, res, next) => {
  try {
    if (!req.file) {
      // If no file is uploaded, continue
      return next();
    }
    
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    let contextData = {};
    
    switch (fileExt) {
      case '.txt':
        // Process .txt file
        const textContent = req.file.buffer.toString('utf-8');
        contextData = {
          text: textContent,
          source: 'file',
          filename: req.file.originalname
        };
        break;
        
      case '.docx':
      case '.doc':
        // Process .docx/.doc file with mammoth
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        contextData = {
          text: result.value,
          source: 'file',
          filename: req.file.originalname
        };
        break;
        
      case '.json':
        // Process .json file
        try {
          const jsonContent = JSON.parse(req.file.buffer.toString('utf-8'));
          contextData = {
            ...jsonContent,
            source: 'file',
            filename: req.file.originalname
          };
        } catch (err) {
          return res.status(400).json({ 
            error: 'Invalid JSON file',
            details: err.message
          });
        }
        break;
        
      default:
        return res.status(400).json({ 
          error: 'Unsupported file type' 
        });
    }
    
    // Add processed context to request
    req.contextData = contextData;
    next();
  } catch (error) {
    console.error('Error processing context file:', error);
    res.status(500).json({ 
      error: 'Failed to process context file',
      details: error.message
    });
  }
};

module.exports = {
  upload,
  processContextFile
};