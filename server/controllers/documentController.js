const { chromium } = require('playwright'); 
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');
const nodemailer = require('nodemailer');
const axios = require('axios');

const generateDocument = async (req, res) => {
    let browser = null; 
    
    try {
        const { id } = req.params;
        
        // 1. EXTRACT ALL DATA FROM FRONTEND PAYLOAD
        const { 
            fileName: customFileName,
            signatory_name,
            signatory_title,
            reviewer_initials,
            reviewer_designation
        } = req.body; 

        // 2. Fetch fresh Branding Assets from database
        const { data: settings, error: settingsError } = await supabase.from('agency_settings').select('*');
        if (settingsError) throw new Error("Failed to load agency settings.");

        const getSettingUrl = (key) => settings.find(s => s.setting_key === key)?.setting_value;
        const headerUrl = getSettingUrl('header_url');
        const footerUrl = getSettingUrl('footer_url');

        // 3. Fetch document data from database
        const { data: docData, error: fetchError } = await supabase
            .from('official_documents')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !docData) {
            throw new Error("Document not found in the database.");
        }

        // 4. Select Template
        const docType = docData.document_type || 'Administrative Order';
        let templateFileName = 'administrative_order.html';
        
        if (docType === 'Special Order') templateFileName = 'special_order.html';
        else if (docType === 'Memorandum') templateFileName = 'memorandum.html'; 
        else if (docType === 'Letter') templateFileName = 'letter.html'; 

        const templatePath = path.join(__dirname, `../templates/${templateFileName}`);
        
        let htmlTemplate = '';
        if (fs.existsSync(templatePath)) {
            htmlTemplate = fs.readFileSync(templatePath, 'utf8');
        } else {
            htmlTemplate = `
            <html>
                <body>
                    {{{body_content}}}
                    <br><br><br>
                    <div style="font-family: serif; page-break-inside: avoid;">
                        <div style="font-weight: 900; text-transform: uppercase; font-size: 1.15em;">{{signatory_name}}</div>
                        <div style="font-style: italic; color: #374151; border-top: 1px solid #e5e7eb; padding-top: 4px; display: inline-block; min-width: 200px;">{{signatory_title}}</div>
                    </div>
                    <br><br>
                    <div style="font-size: 10px; color: #9ca3af; border-top: 1px solid #f9fafb; padding-top: 8px; page-break-inside: avoid;">
                        <div style="font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em;">{{reviewer_initials}}</div>
                        <div style="font-size: 8px;">{{reviewer_designation}}</div>
                    </div>
                </body>
            </html>`;
        }
        
        const template = handlebars.compile(htmlTemplate);
        const safeBodyContent = docData.body_content ? `<div class="justified-body-text">${docData.body_content}</div>` : '';
        
        // 5. Helper to convert dynamic URL to Base64 (Essential for Playwright PDF)
        const fetchRemoteBase64 = async (url) => {
            if (!url) return null; 
            try {
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data, 'binary');
                const mimeType = response.headers['content-type'] || 'image/png';
                return `data:${mimeType};base64,${buffer.toString('base64')}`;
            } catch (err) {
                console.error("Fetch remote asset failed:", url);
                return null; 
            }
        };

        const headerBase64 = await fetchRemoteBase64(headerUrl);
        const footerBase64 = await fetchRemoteBase64(footerUrl);

        // 6. INJECT ALL DATA INTO THE HANDLEBARS TEMPLATE
        const finalHtml = template({ 
            ...docData, 
            signatory_name: signatory_name || docData.signatory_name,
            signatory_title: signatory_title || docData.signatory_title,
            reviewer_initials: reviewer_initials || docData.reviewer_initials,
            reviewer_designation: reviewer_designation || docData.reviewer_designation,
            body_content: safeBodyContent
        });

        const safeRefNumber = docData.reference_number ? docData.reference_number.replace(/[^a-zA-Z0-9-]/g, '') : 'MANUAL';
        const fileName = customFileName || `Doc-${safeRefNumber}-${Date.now()}.pdf`;

        // 7. Generate PDF via Playwright
        browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const context = await browser.newContext();
        const page = await context.newPage();

        const injectedStyles = `
            <style>
                @page { margin: 0 !important; size: A4; }
                html, body { margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; }

                /* RESTORED CSS FIX FOR SHORT LINE */
                .manual-line {
                    display: inline-block !important;
                    width: 30px !important; 
                    border-bottom: 1.5px solid black !important;
                    height: 1px;
                    vertical-align: middle;
                }

                table.layout-table { width: 100%; border-collapse: collapse; border: none; margin: 0; padding: 0; }
                table.layout-table > thead { display: table-header-group; }
                table.layout-table > tfoot { display: table-footer-group; }
                table.layout-table > thead > tr > td { height: 150px; border: none; padding: 0; } 
                table.layout-table > tfoot > tr > td { height: 130px; border: none; padding: 0; } 
                table.layout-table > tbody > tr > td { padding-left: 1.25in !important; padding-right: 1in !important; border: none; vertical-align: top; }
                .justified-body-text p, .justified-body-text div { text-align: justify !important; text-justify: inter-word !important; line-height: 1.5; margin-bottom: 1em; }
                .signatory-section, .reviewer-initials { page-break-inside: avoid !important; }
            </style></head>
        `;

        const injectedBodyStart = `<body>
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 130px; z-index: -10; margin: 0; padding: 0;">
                ${headerBase64 ? `<img src="${headerBase64}" style="width: 100%; height: 100%; object-fit: fill; display: block;" />` : ''}
            </div>
            <div style="position: fixed; bottom: 0; left: 0; width: 100%; height: 110px; z-index: -10; margin: 0; padding: 0;">
                ${footerBase64 ? `<img src="${footerBase64}" style="width: 100%; height: 100%; object-fit: fill; display: block;" />` : ''}
            </div>
            <table class="layout-table"><thead><tr><td></td></tr></thead> <tbody><tr><td> `;

        const injectedBodyEnd = `</td></tr></tbody><tfoot><tr><td></td></tr></tfoot> </table></body>`;

        let modifiedHtml = finalHtml.replace('</head>', injectedStyles);
        modifiedHtml = modifiedHtml.replace('<body>', injectedBodyStart);
        modifiedHtml = modifiedHtml.replace('</body>', injectedBodyEnd);
        
        await page.setContent(modifiedHtml);
        await page.waitForLoadState('networkidle');

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: false, 
            margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' }
        });
        
        await browser.close();
        browser = null;

        // 8. Upload to Supabase Storage (Upsert: true allows overwriting)
        const { error: storageError } = await supabase.storage
            .from('official-pdfs')
            .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true });

        if (storageError) throw new Error("Failed to upload PDF: " + storageError.message);

        const { data: publicUrlData } = supabase.storage.from('official-pdfs').getPublicUrl(fileName);
        const pdfUrl = publicUrlData.publicUrl;

        // 9. Update Document Record
        await supabase.from('official_documents').update({ pdf_url: pdfUrl }).eq('id', id);              

        res.status(200).json({ message: "Document generated successfully!", pdfUrl: pdfUrl });

    } catch (error) {
        console.error("PDF Generation Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (browser) await browser.close();
    }
};

const getDocuments = async (req, res) => {
    try {
        const { data, error } = await supabase.from('official_documents').select('*').order('created_at', { ascending: false }); 
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch documents." });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params; 
        const { error } = await supabase.from('official_documents').delete().eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: "Document deleted successfully." });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete document." });
    }
};

const sendEmail = async (req, res) => {
    const { id } = req.params;
    const { email, cc, subject, documentType } = req.body;

    try {
        const { data: docData, error: dbError } = await supabase
            .from('official_documents')
            .select('pdf_url')
            .eq('id', id)
            .single();

        if (dbError || !docData || !docData.pdf_url) {
            return res.status(404).json({ error: 'PDF not found. Finalize document first.' });
        }

        const pdfResponse = await axios.get(docData.pdf_url, { responseType: 'arraybuffer' });
        const pdfBuffer = Buffer.from(pdfResponse.data, 'binary');

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS     
            }
        });

        const mailOptions = {
            from: `"DA-MIMAROPA DocuFlow" <${process.env.EMAIL_USER}>`,
            to: email,
            cc: cc || '', 
            subject: subject || `Official Document: ${documentType}`,
            text: `Good day,\n\nPlease find the attached ${documentType}.\n\nThis is an automated dispatch from DocuFlow.`,
            attachments: [{ filename: `${documentType}_${Date.now()}.pdf`, content: pdfBuffer }]
        };

        await transporter.sendMail(mailOptions);
        
        // RESTORED LOG ENTRY
        const logEntry = {
            document_id: id,
            recipient_email: email,
            subject: subject || `Official Document: ${documentType}`,
            document_type: documentType,
            sent_at: new Date().toISOString()
        };

        const { error: logError } = await supabase.from('communication_logs').insert([logEntry]);
        if (logError) console.error("Logged email internally, but DB insert failed:", logError);

        res.status(200).json({ success: true, message: 'Email sent and logged.' });

    } catch (error) {
        console.error('Email Dispatch Error:', error);
        res.status(500).json({ success: false, error: 'Failed to dispatch email' });
    }
};

module.exports = { generateDocument, getDocuments, deleteDocument, sendEmail };