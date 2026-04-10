const { chromium } = require('playwright'); 
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');
const axios = require('axios');

const generateDocument = async (req, res) => {
    let browser = null; 
    
    try {
        console.log(`\n--- STARTING PDF GENERATION FOR ID: ${req.params.id} ---`);
        const { id } = req.params;
        
        // 1. Extract Payload
        const { 
            fileName: customFileName, signatory_name, signatory_title, 
            reviewer_initials, reviewer_designation 
        } = req.body; 

        // 2. Fetch Branding Assets
        console.log(`[1/6] Fetching Agency Settings...`);
        const { data: settings, error: settingsError } = await supabase.from('agency_settings').select('*');
        if (settingsError) throw new Error("Database Error: Failed to load agency settings.");

        const getSettingUrl = (key) => settings.find(s => s.setting_key === key)?.setting_value;
        const headerUrl = getSettingUrl('header_url');
        const footerUrl = getSettingUrl('footer_url');

        // 3. Fetch Document Data
        console.log(`[2/6] Fetching Document Data...`);
        const { data: docData, error: fetchError } = await supabase
            .from('official_documents')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !docData) throw new Error("Database Error: Document not found.");

        // 4. Handle Template
        console.log(`[3/6] Processing HTML Template...`);
        const docType = docData.document_type || 'Administrative Order';
        const templateFileName = `${docType.toLowerCase().replace(/\s+/g, '_')}.html`;
        const templatePath = path.join(__dirname, `../templates/${templateFileName}`);
        
        let htmlTemplate = fs.existsSync(templatePath) 
            ? fs.readFileSync(templatePath, 'utf8') 
            : `<html><head></head><body>{{{body_content}}}<br><br><div style="font-weight: 900;">{{signatory_name}}</div></body></html>`;
        
        const template = handlebars.compile(htmlTemplate);
        const safeBodyContent = docData.body_content ? `<div class="justified-body-text">${docData.body_content}</div>` : '';
        
        const fetchRemoteBase64 = async (url) => {
            if (!url) return null; 
            try {
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data, 'binary');
                const mimeType = response.headers['content-type'] || 'image/png';
                return `data:${mimeType};base64,${buffer.toString('base64')}`;
            } catch (err) {
                return null; 
            }
        };

        const headerBase64 = await fetchRemoteBase64(headerUrl);
        const footerBase64 = await fetchRemoteBase64(footerUrl);

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

        // 5. Generate PDF via Playwright
        console.log(`[4/6] Launching Playwright Browser...`);
        try {
            browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        } catch (pwError) {
            throw new Error(`PLAYWRIGHT CRASH: You are missing browser binaries. Please open your backend terminal and run: "npx playwright install". Exact error: ${pwError.message}`);
        }

        const context = await browser.newContext();
        const page = await context.newPage();

        const injectedStyles = `
            <style>
                @page { margin: 0 !important; size: A4; }
                html, body { margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; }
                .manual-line { display: inline-block !important; width: 30px !important; border-bottom: 1.5px solid black !important; height: 1px; vertical-align: middle; }
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

        let modifiedHtml = finalHtml;
        if (modifiedHtml.includes('</head>')) modifiedHtml = modifiedHtml.replace('</head>', injectedStyles);
        else modifiedHtml = `<head>${injectedStyles}` + modifiedHtml;
        
        if (modifiedHtml.includes('<body>')) modifiedHtml = modifiedHtml.replace('<body>', injectedBodyStart);
        else modifiedHtml = injectedBodyStart + modifiedHtml;
        
        if (modifiedHtml.includes('</body>')) modifiedHtml = modifiedHtml.replace('</body>', injectedBodyEnd);
        else modifiedHtml = modifiedHtml + injectedBodyEnd;
        
        await page.setContent(modifiedHtml);
        await page.waitForLoadState('networkidle');

        const pdfBuffer = await page.pdf({
            format: 'A4', printBackground: true, displayHeaderFooter: false, 
            margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' }
        });
        
        await browser.close();
        browser = null;

        // 6. Upload to Supabase Storage
        console.log(`[5/6] Uploading PDF to Supabase Storage...`);
        const { error: storageError } = await supabase.storage
            .from('official-pdfs')
            .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true });

        if (storageError) {
            if (storageError.message.includes('bucket') || storageError.statusCode === '404') {
                throw new Error(`SUPABASE STORAGE ERROR: The bucket 'official-pdfs' does not exist! Go to your Supabase dashboard -> Storage -> Create a new PUBLIC bucket named exactly 'official-pdfs'.`);
            }
            throw new Error("Failed to upload PDF: " + storageError.message);
        }

        const { data: publicUrlData } = supabase.storage.from('official-pdfs').getPublicUrl(fileName);
        const pdfUrl = publicUrlData.publicUrl;

        // 7. Update Document Record
        console.log(`[6/6] Updating Database Record...`);
        await supabase.from('official_documents').update({ pdf_url: pdfUrl }).eq('id', id);              

        console.log(`--- PDF GENERATION SUCCESSFUL ---`);
        res.status(200).json({ message: "Document generated successfully!", pdfUrl: pdfUrl });

    } catch (error) {
        console.error("\n❌ FATAL BACKEND ERROR ❌\n", error.message, "\n");
        // We pass the exact error message back so the frontend receives it
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

module.exports = { generateDocument, getDocuments, deleteDocument };