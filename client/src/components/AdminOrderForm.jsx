import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import JoditEditor from 'jodit-react';
import { supabase } from '../supabaseClient'; 

export default function AdminOrderForm({ userRole = 'Staff' }) {
  const navigate = useNavigate(); 
  const { id } = useParams(); 
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [remarks, setRemarks] = useState('');

  // GLOBAL ROUTING TOGGLE (Fetched from Supabase)
  const [isRoutingEnabled, setIsRoutingEnabled] = useState(false);

  // Email States
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // AI Generation States
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [showAiBox, setShowAiBox] = useState(false);

  const [formData, setFormData] = useState({
    document_type: 'Administrative Order', 
    reference_number: '', // Kept in state to prevent backend errors, but removed from UI
    series_year: new Date().getFullYear().toString(),
    subject: '',
    body_content: '',
    execution_date: '',
    signatory_name: '',
    signatory_title: 'Regional Executive Director',
    reviewer_initials: '',
    reviewer_designation: '',
    status: 'Draft'
  });

  const [headerUrl, setHeaderUrl] = useState('/header.png');
  const [footerUrl, setFooterUrl] = useState('/footer.png');

  // --- FETCH BRANDING AND GLOBAL ROUTING SETTING ---
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const { data } = await supabase.from('agency_settings').select('*');
        if (data) {
          const liveHeader = data.find(s => s.setting_key === 'header_url')?.setting_value;
          const liveFooter = data.find(s => s.setting_key === 'footer_url')?.setting_value;
          const liveRouting = data.find(s => s.setting_key === 'routing_enabled')?.setting_value;

          if (liveHeader) setHeaderUrl(liveHeader);
          if (liveFooter) setFooterUrl(liveFooter);
          if (liveRouting) setIsRoutingEnabled(liveRouting === 'true');
        }
      } catch (error) {
        console.error("Failed to load settings", error);
      }
    };
    fetchBranding();
  }, []);

  useEffect(() => {
    if (id) {
      const fetchDoc = async () => {
        const { data, error } = await supabase.from('official_documents').select('*').eq('id', id).single();
        if (data) {
            setFormData(data);
        }
        if (error) console.error("Error fetching document:", error);
      };
      fetchDoc();
    }
  }, [id]);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleEditorChange = (newContent) => setFormData(prev => ({ ...prev, body_content: newContent }));

  const config = useMemo(() => ({
    readonly: false,
    height: 400,
    toolbarAdaptive: false,
    placeholder: 'Start typing the body content...',
    buttons: ['bold', 'italic', 'underline', '|', 'ul', 'ol', '|', 'table', '|', 'align', 'undo', 'redo']
  }), []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); 
  };

  // --- AI GENERATION LOGIC ---
  const handleAIGeneration = async () => {
    if (!aiPrompt) {
      showToast("Please enter a topic for the AI to write about.", "error");
      return;
    }
    setIsAiGenerating(true);
    showToast("AI is drafting your document...", "success");
    try {
        const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/ai/generate-order`,
        {
          topic: aiPrompt,
          documentType: formData.document_type
        }
  );
      const newContent = formData.body_content 
        ? `${formData.body_content}<br><br>${response.data.htmlContent}`
        : response.data.htmlContent;
      setFormData(prev => ({ ...prev, body_content: newContent }));
      showToast("Draft generated successfully!", "success");
      setShowAiBox(false);
      setAiPrompt('');
    } catch (error) {
      console.error("AI Generation failed:", error);
      showToast("Failed to generate content. Please try again.", "error");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!formData.pdf_url) {
      showToast("PDF is not ready yet.", "error");
      return;
    }
    window.open(formData.pdf_url, '_blank');
  };

  const handlePrint = async () => {
    if (!formData.pdf_url) return;
    try {
      const response = await fetch(formData.pdf_url);
      const blob = await response.blob();
      const localBlobUrl = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = localBlobUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          URL.revokeObjectURL(localBlobUrl);
        }, 500); 
      };
    } catch (error) {
      window.open(formData.pdf_url, '_blank');
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress) {
      showToast("Please enter an email address.", "error");
      return;
    }
    setIsSendingEmail(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/documents/${id}/send-email`, {
        email: emailAddress,
        subject: `Official ${formData.document_type}: ${formData.subject}`,
        documentType: formData.document_type
      });
      showToast("Email sent successfully!", "success");
      setShowEmailInput(false);
      setEmailAddress('');
    } catch (error) {
      showToast("Failed to send email. Check backend.", "error");
    } finally {
      setIsSendingEmail(false);
    }
  };

  // --- AUTO FILE NAMING LOGIC ---
  const generateFileName = () => {
    const type = formData.document_type.replace(/\s+/g, '_');
    const docNum = formData.reference_number || 'DRAFT';
    const safeSubject = (formData.subject || 'Untitled')
      .replace(/[^a-zA-Z0-9 ]/g, '') 
      .trim()
      .split(' ')
      .slice(0, 4)                   
      .join('_');
    return `${type}_No-${docNum}_s${formData.series_year}_${safeSubject}.pdf`;
  };

  const handleSave = async (status) => {
    setIsSaving(true);
    try {
      let actionText = `Moved to ${status}`;
      if (status === 'Draft') {
        actionText = userRole === 'Staff' ? 'Saved Draft' : 'Returned for Revision';
      }

      const routingPayload = {
        user: userRole,
        action: actionText,
        remarks: remarks || (status === 'Draft' ? 'No remarks provided.' : 'Approved/Processed.'),
        date: new Date().toISOString()
      };

      const { id: docId, created_at, pdf_url, ...safeData } = formData;

      const updatePayload = {
        ...safeData,
        status: status,
        remarks: remarks,
        routing_history: [...(formData.routing_history || []), routingPayload]
      };

      let currentDocId = id; 

      if (id) {
        const { error } = await supabase.from('official_documents').update(updatePayload).eq('id', id);
        if (error) throw error;
      } else {
        const { data: newDoc, error } = await supabase
          .from('official_documents')
          .insert([updatePayload])
          .select()
          .single(); 
          
        if (error) throw error;
        currentDocId = newDoc.id; 
      }

      if (status === 'Released') {
         showToast("Finalizing Document...", "success");
         const autoFileName = generateFileName();
         
         await axios.post(`${import.meta.env.VITE_API_URL}/api/documents/${currentDocId}/generate-pdf`, {
             fileName: autoFileName
         });
      }

      showToast(status === 'Draft' ? "Saved / Returned!" : "Document Processed!", "success");
      setTimeout(() => navigate('/'), 1500);
      
    } catch (error) { 
        console.error("Error saving document:", error);
        showToast("Failed to process document.", "error");
    } finally { setIsSaving(false); }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 font-sans relative">
      
      {/* HEADER SECTION */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-200 pb-5 text-black">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border border-green-200">
              Administrative Issuance
            </span>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full animate-pulse ${formData.status === 'Released' ? 'bg-blue-500' : 'bg-green-500'}`}></span>
              {formData.status === 'Released' ? 'Archived' : userRole === 'Staff' ? (id ? 'Editing Phase' : 'Drafting Phase') : 'Review Phase'}
            </p>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Administrative Order</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT SIDE PANEL */}
        <div className="lg:col-span-5 bg-white p-6 md:p-8 shadow-xl shadow-gray-200/50 rounded-2xl border border-gray-100 relative overflow-hidden text-black">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

          {formData.status === 'Released' ? (
            <div className="space-y-6 relative z-10">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                 <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                 <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">Archived Document</h3>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Status</p>
                 <p className="font-black text-sm mb-3 text-green-600">{formData.status?.toUpperCase()}</p>
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Subject</p>
                 <p className="font-bold text-sm text-gray-900 uppercase">{formData.subject || 'No Subject'}</p>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-gray-500 italic">This document has been officially approved and generated.</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handlePrint} className="flex-1 bg-gray-900 text-white font-black py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 uppercase tracking-widest text-[9px] hover:bg-black transition-colors">Print File</button>
                  <button onClick={handleDownload} className="flex-1 bg-green-600 text-white font-black py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 uppercase tracking-widest text-[9px] hover:bg-green-700 transition-colors">Download PDF</button>
                  <button onClick={() => setShowEmailInput(!showEmailInput)} className="flex-1 bg-amber-500 text-white font-black py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 uppercase tracking-widest text-[9px] hover:bg-amber-600 transition-colors">Email File</button>
                </div>

                {showEmailInput && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex flex-col gap-3 animate-fadeIn mt-2">
                    <input type="email" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} placeholder="email@example.com" className="flex-1 bg-white border border-amber-200 rounded-lg p-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500 transition-all" />
                    <button onClick={handleSendEmail} disabled={isSendingEmail} className="bg-amber-600 text-white px-4 py-2 rounded-lg font-black uppercase text-[9px] tracking-widest hover:bg-amber-700">Send</button>
                  </div>
                )}
                <button onClick={() => navigate('/')} className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors">Back to Dashboard</button>
              </div>
            </div>
          ) : userRole === 'Staff' ? (
            <div className="space-y-8 relative z-10">

              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">1. Document Details</h3>
                </div>
                
                <div className="mb-4">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Series Year</label>
                  <input type="text" name="series_year" value={formData.series_year} onChange={handleChange} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Subject</label>
                  <input type="text" name="subject" value={formData.subject} onChange={handleChange} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm uppercase focus:ring-2 focus:ring-green-500 outline-none transition-all shadow-sm" placeholder="ENTER SUBJECT HERE..." />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Document Body</label>
                  <button 
                    onClick={() => setShowAiBox(!showAiBox)}
                    className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors border border-indigo-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Draft with AI
                  </button>
                </div>

                {showAiBox && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 mb-4 animate-fadeIn">
                    <p className="text-[10px] font-black text-indigo-800 uppercase tracking-widest mb-2">AI Drafting Assistant</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={aiPrompt} 
                        onChange={(e) => setAiPrompt(e.target.value)} 
                        placeholder="e.g., Draft an order regarding personnel reassignment..." 
                        className="flex-1 border border-indigo-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                        onKeyDown={(e) => e.key === 'Enter' && handleAIGeneration()} 
                      />
                      <button 
                        onClick={handleAIGeneration} 
                        disabled={isAiGenerating} 
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                      >
                        {isAiGenerating ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Generating
                          </span>
                        ) : 'Generate'}
                      </button>
                    </div>
                    <p className="text-[10px] text-indigo-600/70 italic mt-2">The AI will generate the body content in HTML format and insert it into the editor below.</p>
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-green-500 transition-all">
                  <JoditEditor value={formData.body_content} config={config} onBlur={handleEditorChange} onChange={handleEditorChange} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Execution Date</label>
                  <input type="text" name="execution_date" value={formData.execution_date} onChange={handleChange} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm shadow-sm focus:ring-2 focus:ring-green-500 outline-none transition-all" placeholder="e.g., 10th day of March, 2026" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="mb-4 border-b border-gray-100 pb-2">
                  <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">3. Signatories & Routing</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Signatory Name</label>
                    <input type="text" name="signatory_name" value={formData.signatory_name} onChange={handleChange} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm uppercase focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Title</label>
                    <input type="text" name="signatory_title" value={formData.signatory_title} onChange={handleChange} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Reviewer Initials</label>
                    <input type="text" name="reviewer_initials" value={formData.reviewer_initials} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm uppercase focus:ring-2 focus:ring-green-500 outline-none transition-all" placeholder="e.g. ABC" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Reviewer Designation</label>
                    <input type="text" name="reviewer_designation" value={formData.reviewer_designation} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm capitalize focus:ring-2 focus:ring-green-500 outline-none transition-all" placeholder="e.g. Division Chief" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100 mt-6">
                  <button 
                    onClick={() => handleSave('Draft')} 
                    disabled={isSaving} 
                    className="flex-1 bg-white text-gray-700 font-bold py-4 rounded-xl border-2 uppercase text-[10px] tracking-widest hover:bg-gray-50 transition-colors"
                  >
                    Save as Draft
                  </button>
                  <button 
                    onClick={() => handleSave(isRoutingEnabled ? 'For Review' : 'Released')} 
                    disabled={isSaving} 
                    className={`flex-[2] text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-lg transition-all flex justify-center items-center gap-2 ${
                      isRoutingEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isSaving ? 'Processing...' : isRoutingEnabled ? 'Submit for Review' : 'Finalize & Generate PDF'}
                  </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 relative z-10">
              <div className="border-b border-gray-100 pb-2">
                 <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">Document Review</h3>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Status</p>
                 <p className={`font-black text-sm mb-3 ${formData.status === 'Released' ? 'text-green-600' : 'text-purple-600'}`}>{formData.status?.toUpperCase()}</p>
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Subject</p>
                 <p className="font-bold text-sm text-gray-900">{formData.subject || 'No Subject'}</p>
              </div>

              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm outline-none h-40 focus:ring-2 focus:ring-green-500 transition-all" placeholder="Type feedback..." />
              
              <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
                 <button onClick={() => handleSave('Draft')} disabled={isSaving} className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-xl border border-red-100 uppercase text-[10px] hover:bg-red-100 transition-colors tracking-widest">Return for Revision</button>
                 {userRole === 'Chief' && <button onClick={() => handleSave('For Approval')} disabled={isSaving} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase text-[10px] hover:bg-blue-700 transition-colors tracking-widest">Approve & Forward</button>}
                 {userRole === 'Director' && (
                    <button onClick={() => handleSave('Released')} disabled={isSaving} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-black py-4 rounded-xl shadow-lg uppercase text-[10px] transition-colors tracking-widest">Approve & Release</button>
                 )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDE: LIVE PREVIEW */}
        <div className="lg:col-span-7 sticky top-8 flex justify-center w-full">
          <div className="bg-white shadow-2xl ring-1 ring-gray-900/5 aspect-[1/1.414] w-full max-w-[800px] flex flex-col relative overflow-hidden text-gray-900 font-serif">
            <div className="absolute top-0 left-0 w-full h-[16%] pointer-events-none">
              <img src={headerUrl} alt="Header" className="w-full h-full object-fill" />
            </div>
            <div className="absolute bottom-0 left-0 w-full h-[10%] pointer-events-none">
              <img src={footerUrl} alt="Footer" className="w-full h-full object-fill" />
            </div>
            
            <div className="absolute top-[16%] bottom-[10%] left-[12%] right-[12%] flex flex-col pt-2 overflow-y-auto custom-scrollbar-preview text-[11.5px] leading-[1.6]">
                <div className="font-bold text-[1.15em] mb-1 uppercase tracking-tight">ADMINISTRATIVE ORDER</div>
                
                <div className="mb-6 space-y-0.5">
                  <div className="flex items-end gap-1">
                    <span>No.</span>
                    <span className="border-b-[1.5px] border-black w-[30px] inline-block mb-1"></span>
                  </div>
                  <div>Series of {formData.series_year}</div>
                </div>

                <div className="grid grid-cols-[80px_10px_1fr] gap-y-2 mb-6 items-start uppercase font-bold">
                  <div>SUBJECT</div>
                  <div>:</div>
                  <div className="break-words underline underline-offset-4 decoration-1">{formData.subject || '[ SUBJECT LINE ]'}</div>
                </div>

                <div className="w-full h-[1.5px] bg-black mb-6"></div>
                
                <div className="preview-body-container flex-1">
                    <div className="document-body-content" dangerouslySetInnerHTML={{ __html: formData.body_content || '<p style="color:#aaa">Body content...</p>' }} />
                </div>

                <div className="mt-8 mb-10">Done this {formData.execution_date || '[ DATE ]'}.</div>
                
                <div className="mb-12">
                  <div className="font-black uppercase text-[1.15em] mb-0.5">{formData.signatory_name || '[ SIGNATORY NAME ]'}</div>
                  <div className="italic text-gray-700 border-t border-gray-100 pt-1 inline-block">{formData.signatory_title || '[ Position ]'}</div>
                </div>
                
                <div className="text-[10px] text-gray-400 mt-auto border-t border-gray-50 pt-2 pb-4">
                  <div className="font-bold uppercase tracking-widest">{formData.reviewer_initials || '...'}</div>
                  <div className="text-[8px]">{formData.reviewer_designation || '...'}</div>
                </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] flex items-center gap-3 z-[150] text-[10px] font-bold uppercase tracking-widest text-white border backdrop-blur-md animate-fadeIn ${toast.type === 'success' ? 'bg-green-600/90 border-green-400/50' : 'bg-red-600/90 border-red-400/50'}`}>
          {toast.message}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .document-body-content { text-align: justify; word-wrap: break-word; overflow-wrap: break-word; hyphens: auto; }
        .document-body-content p { margin-bottom: 1.2em; line-height: 1.6; }
        .document-body-content ul, .document-body-content ol { margin-left: 2em; margin-bottom: 1.2em; }
        .custom-scrollbar-preview::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar-preview::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-preview::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
}