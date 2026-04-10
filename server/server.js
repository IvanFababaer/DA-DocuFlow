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

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  try {
    // 1. Construct the strict prompt for the AI
    const systemPrompt = `
      Act as an expert administrative drafter for a government agency. 
      Write the body section of a ${documentType || 'Administrative Document'} about: "${topic}". 
      
      RULES:
      - Write ONLY the body content. 
      - Do NOT write the header, subject line, TO/FROM, date, or signatory block.
      - Format the output strictly in HTML using <p>, <ul>, <li>, and <strong> tags.
      - Keep the tone formal, objective, and authoritative.
    `;

    // 2. Configure the Gemini Model
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: "You are a helpful HTML formatting assistant for official government documents.",
    });

    // 3. Call the Gemini API
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature: 0.3, // Keep it low for formal, predictable text
      }
    });

    // 4. Clean up the response (AI sometimes wraps HTML in markdown blocks like ```html)
    let generatedHtml = result.response.text();
    generatedHtml = generatedHtml.replace(/```html/gi, '').replace(/```/g, '').trim();

    // 5. Send the HTML back to the React frontend
    res.status(200).json({ htmlContent: generatedHtml });

  } catch (error) {
    console.error("AI Generation Error:", error);
    res.status(500).json({ error: "Failed to generate AI content. Check server logs." });
  }
});

// ---------------------------------------------------------
// SERVER STATUS ROUTE
// ---------------------------------------------------------
app.get('/api/status', async (req, res) => {
    try {
        // Test connection by fetching the row count of your table
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
    console.log(`Test your connection at http://localhost:${PORT}/api/status`);
});