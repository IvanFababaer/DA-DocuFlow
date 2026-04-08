const express = require('express');
const router = express.Router();

// 1. Import all 4 functions from your updated controller
const { 
  getDocuments, 
  deleteDocument, 
  generateDocument,
  sendEmail // <--- We must import the new email function here!
} = require('../controllers/documentController'); 

// GET all documents: http://localhost:2000/api/documents
router.get('/', getDocuments);

// DELETE a document: http://localhost:2000/api/documents/:id
router.delete('/:id', deleteDocument);

// GENERATE PDF: http://localhost:2000/api/documents/:id/generate-pdf
router.post('/:id/generate-pdf', generateDocument);

// --- NEW: SEND EMAIL ---
// SEND EMAIL: http://localhost:2000/api/documents/:id/send-email
router.post('/:id/send-email', sendEmail); // <--- This is the missing link!

module.exports = router;