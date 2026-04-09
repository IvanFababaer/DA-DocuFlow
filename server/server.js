const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Added Gemini Import
const supabase = require('./config/supabase'); // Imports your DB connection
const documentRoutes = require('./routes/documentRoutes');

dotenv.config();

const app = express();

// Middleware
app.use(cors()); // Allows your React frontend to communicate with this backend
app.use(express.json()); // Allows the server to understand JSON data

// ---------------------------------------------------------
// INITIALIZE GEMINI
// Make sure to add GEMINI_API_KEY to your .env file
// ---------------------------------------------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------------------------------------------------
// DOCUMENT ROUTES
// This tells Express to send ALL /api/documents traffic 
// (including /send-email and /generate-pdf) to your router!
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
    // We use gemini-2.5-flash as it is fast, cost-effective, and great for text formatting
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

// A simple test route to verify everything is working
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

// Inside your Node.js/Express backend
app.post('/api/documents/:id/send-email', async (req, res) => {
  const { id } = req.params;
  const { email, subject, documentType } = req.body;

  try {
    // 1. YOUR EXISTING EMAIL LOGIC HERE (Nodemailer, Resend, etc.)
    // await transporter.sendMail({ to: email, subject: subject, ... });

    // 2. NEW: Log the success to Supabase
    const { error } = await supabase.from('communication_logs').insert([{
      document_id: id,
      recipient_email: email,
      subject: subject,
      document_type: documentType
    }]);

    if (error) {
      console.error("Failed to log email to Supabase:", error);
      // We don't throw here because the email actually sent successfully
    }

    res.status(200).json({ message: 'Email dispatched and logged successfully.' });
  } catch (error) {
    console.error("Email dispatch failed:", error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

const PORT = process.env.PORT || 2000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Test your connection at http://localhost:${PORT}/api/status`);
});