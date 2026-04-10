const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai'); 
const supabase = require('./config/supabase'); 
const documentRoutes = require('./routes/documentRoutes');

dotenv.config();

const app = express();

// Middleware
app.use(cors()); 
app.use(express.json()); 

// ---------------------------------------------------------
// INITIALIZE GEMINI
// ---------------------------------------------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------------------------------------------------
// DOCUMENT ROUTES
// ---------------------------------------------------------
app.use('/api/documents', documentRoutes);

// ---------------------------------------------------------
// AI GENERATION ROUTE (Powered by Gemini)
// ---------------------------------------------------------
app.post('/api/ai/generate-order', async (req, res) => {
  const { topic, documentType } = req.body;

  // PRE-CHECK: Did you forget to add the API key or restart the server?
  if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
          error: "CRITICAL: The GEMINI_API_KEY is missing from your backend .env file, or you forgot to restart your server!" 
      });
  }

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  try {
    const systemPrompt = `
      Act as an expert administrative drafter for a government agency. 
      Write the body section of a ${documentType || 'Administrative Document'} about: "${topic}". 
      
      RULES:
      - Write ONLY the body content. 
      - Do NOT write the header, subject line, TO/FROM, date, or signatory block.
      - Format the output strictly in HTML using <p>, <ul>, <li>, and <strong> tags.
      - Keep the tone formal, objective, and authoritative.
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash", 
      systemInstruction: "You are a helpful HTML formatting assistant for official government documents.",
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature: 0.3, 
      }
    });

    let generatedHtml = result.response.text();
    generatedHtml = generatedHtml.replace(/```html/gi, '').replace(/```/g, '').trim();

    res.status(200).json({ htmlContent: generatedHtml });

  } catch (error) {
    console.error("AI Generation Error:", error);
    
    // THIS IS THE MAGIC LINE! It sends the REAL error to your frontend.
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------
// SERVER STATUS ROUTE
// ---------------------------------------------------------
app.get('/api/status', async (req, res) => {
    try {
        const { data, error, count } = await supabase
            .from('official_documents')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        res.json({ 
            message: "Backend is running!", 
            databaseStatus: "Connected",
            documentsFound: count || 0
        });
    } catch (err) {
        res.status(500).json({ error: "Database connection failed", details: err.message });
    }
});

const PORT = process.env.PORT || 2000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});