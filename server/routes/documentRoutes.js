const express = require('express');
const router = express.Router();

// 1. Import all 4 functions from your updated controller
const { 
  getDocuments, 
  deleteDocument, 
  generateDocument
} = require('../controllers/documentController'); 

// GET all documents: http://localhost:2000/api/documents
router.get('/', getDocuments);

// DELETE a document: http://localhost:2000/api/documents/:id
router.delete('/:id', deleteDocument);

// GENERATE PDF: http://localhost:2000/api/documents/:id/generate-pdf
router.post('/:id/generate-pdf', generateDocument);



module.exports = router;