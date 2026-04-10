import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import JoditEditor from 'jodit-react';
import { supabase } from '../supabaseClient'; 

export default function MemorandumForm({ userRole = 'Staff' }) {
  const navigate = useNavigate(); 
  const { id } = useParams(); 
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [remarks, setRemarks] = useState('');

  const [isRoutingEnabled, setIsRoutingEnabled] = useState(false);

  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [showAiBox, setShowAiBox] = useState(false);

  const [formData, setFormData] = useState({
    document_type: 'Memorandum', 
    reference_number: '', // Kept in state for DB structure, but not used in UI
    series_year: new Date().getFullYear().toString(),
    recipient_name: '', 
    subject: '',
    memo_date: '',
    body_content: '',
    signatory_name: '',     
    signatory_title: 'Regional Executive Director',   
    reviewer_initials: '',
    reviewer_designation: '',
    status: 'Draft'
  });

  const [headerUrl, setHeaderUrl] = useState('/header.png');
  const [footerUrl, setFooterUrl] = useState('/footer.png');

  useEffect(() => {
    const fetchSettings = async () => {
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
    fetchSettings();
  }, []);

  useEffect(() => {
    if (id) {
      const fetchDoc = async () => {
        const { data, error } = await supabase
          .from('official_documents')
          .select('*')
          .eq('id', id)
          .single();
          
        if (data) setFormData(data);
        if (error) console.error("Error fetching document:", error);
      };
      fetchDoc();
    }
  }, [id]);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleEditorChange = (newContent) => setFormData(prev => ({ ...prev, body_content: newContent }));

  const config = useMemo(() => ({
    readonly: false,
    height: 350,
    toolbarAdaptive: false,
    placeholder: 'Start typing the body content...',
    buttons: ['bold', 'italic', 'underline', '|', 'ul', 'ol', '|', 'table', '|', 'align', 'undo', 'redo']
  }), []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); 
  };

  const handleAIGeneration = async () => {
    if (!aiPrompt) {
      showToast("Please enter a topic for the AI to write about.", "error");
      return;
    }
    setIsAiGenerating(true);
    showToast("AI is drafting your memorandum...", "success");
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/ai/generate-order`, 
        {
          topic: aiPrompt,
          documentType: formData.document_type
        },
        {
          timeout: 100000 // Instructs Axios to wait up to 100 seconds
        }
      );
      
      if (response.data && response.data.htmlContent) {
        const newContent = formData.body_content 
          ? `${formData.body_content}<br><br>${response.data.htmlContent}`
          : response.data.htmlContent;
        setFormData(prev => ({ ...prev, body_content: newContent }));
        showToast("Draft generated successfully!", "success");
        setShowAiBox(false);
        setAiPrompt('');
      } else {
        throw new Error("Invalid response");
      }
    } catch (error) {
      console.error("AI Error:", error);
      showToast("Failed to generate AI content.", "error");
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

  const generateFileName = () => {
    const type = formData.document_type.replace(/\s+/g, '_');
    const docNum = 'MANUAL'; // Using 'MANUAL' since the number will be written in by hand
    const safeSubject = (formData.subject || 'Untitled')
      .replace(/[^a-zA-Z0-9 ]/g, '') 
      .trim()
      .split(' ')
      .slice(0, 4)                                  
      .join('_');
    return `${type}_No-${docNum}_s${formData.series_year}_${safeSubject}.pdf`;
  };

  const handleSave = async (status) => {
    // Basic Validation: reference_number is removed, so we only check subject and recipient
    if (!formData.subject || !formData.recipient_name) {
        showToast("Recipient and Subject are required.", "error");
        return;
    }

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
          showToast("Finalizing Document & Generating PDF...", "success");
          const autoFileName = generateFileName();
          
          await axios.post(`${import.meta.env.VITE_API_URL}/api/documents/${currentDocId}/generate-pdf`, {
              fileName: autoFileName,
              signatory_name: formData.signatory_name,
              signatory_title: formData.signatory_title,
              reviewer_initials: formData.reviewer_initials,
              reviewer_designation: formData.reviewer_designation
          });
      }

      showToast(status === 'Draft' ? "Draft Saved!" : "Document Processed!", "success");
      setTimeout(() => navigate('/'), 1500);
      
    } catch (error) { 
        console.error("Error saving document:", error);
        showToast("Failed to process document.", "error");
    } finally { setIsSaving(false); }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 font-sans relative text-black">
      
      {/* HEADER SECTION */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border border-blue-200">
              Official Correspondence
            </span>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full animate-pulse ${formData.status === 'Released' ? 'bg-blue-500' : 'bg-green-500'}`}></span>
              {formData.status === 'Released' ? 'Archived' : userRole === 'Staff' ? (id ? 'Editing Phase' : 'Drafting Phase') : 'Review Phase'}
            </p>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Memorandum</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT SIDE PANEL */}
        <div className="lg:col-span-5 bg-white p-6 md:p-8 shadow-xl shadow-gray-200/50 rounded-2xl border border-gray-100 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

          {formData.status === 'Released' ? (
            <div className="space-y-6 relative z-10">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                 <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                 <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">Archived Memorandum</h3>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Status</p>
                 <p className="font-black text-sm mb-3 text-blue-600">{formData.status?.toUpperCase()}</p>
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">To:</p>
                 <p className="font-bold text-sm text-gray-900">{formData.recipient_name || 'No Recipient'}</p>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-gray-500 italic">This memorandum has been officially released and generated.</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handlePrint} className="flex-1 bg-gray-900 text-white font-black py-3 rounded-xl shadow-lg flex justify-center items-center gap-2 uppercase tracking-widest text-[9px] hover:bg-black transition-colors">Print</button>
                  <button onClick={handleDownload} className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl shadow-lg flex justify-center items-center gap-2 uppercase tracking-widest text-[9px] hover:bg-blue-700 transition-colors">Download</button>
                </div>
                <button onClick={() => navigate('/')} className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors">Back to Dashboard</button>
              </div>
            </div>
          ) : userRole === 'Staff' ? (
            <div className="space-y-8 relative z-10">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                  <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">1. Document Details</h3>
                </div>
                
                {/* REFERENCE NUMBER REMOVED: Series Year takes full width */}
                <div className="mb-4">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Series Year</label>
                  <input type="text" name="series_year" value={formData.series_year} onChange={handleChange} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Series Year" />
                </div>
              </div>

              <div className="space-y-4">
                <input type="text" name="recipient_name" value={formData.recipient_name} onChange={handleChange} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="TO: RECIPIENT NAME" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input type="text" name="subject" value={formData.subject} onChange={handleChange} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="SUBJECT" />
                  <input type="text" name="memo_date" value={formData.memo_date} onChange={handleChange} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="DATE" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Document Body</label>
                  <button onClick={() => setShowAiBox(!showAiBox)} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors border border-indigo-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Draft with AI
                  </button>
                </div>

                {/* --- STREAMLINED AI BOX --- */}
                {showAiBox && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-3 animate-fadeIn mb-4">
                    <p className="text-[10px] font-black text-indigo-800 uppercase tracking-widest mb-2">AI Assistant</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={aiPrompt} 
                        onChange={(e) => setAiPrompt(e.target.value)} 
                        placeholder="What is this memo about?" 
                        className="flex-1 bg-white border border-indigo-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
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

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                  <JoditEditor value={formData.body_content} config={config} onBlur={handleEditorChange} onChange={handleEditorChange} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="mb-4 border-b border-gray-100 pb-2">
                  <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">3. Signatories & Routing</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Signatory Name</label>
                    <input type="text" name="signatory_name" value={formData.signatory_name} onChange={handleChange} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="JUAN O. DELA CRUZ" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Title</label>
                    <input type="text" name="signatory_title" value={formData.signatory_title} onChange={handleChange} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Regional Executive Director" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Reviewer Initials</label>
                    <input type="text" name="reviewer_initials" value={formData.reviewer_initials} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="e.g. ABC" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Reviewer Designation</label>
                    <input type="text" name="reviewer_designation" value={formData.reviewer_designation} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm capitalize focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="e.g. Division Chief" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100 mt-6">
                  <button onClick={() => handleSave('Draft')} disabled={isSaving} className="flex-1 bg-white text-gray-700 font-bold py-4 rounded-xl border-2 uppercase text-[10px] hover:bg-gray-50 tracking-widest transition-colors">Save as Draft</button>
                  <button onClick={() => handleSave(isRoutingEnabled ? 'For Review' : 'Released')} disabled={isSaving} className={`flex-[2] text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-lg transition-all flex justify-center items-center gap-2 ${isRoutingEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}>{isSaving ? 'Processing...' : isRoutingEnabled ? 'Submit for Review' : 'Finalize & Generate PDF'}</button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 relative z-10">
              <div className="border-b border-gray-100 pb-2">
                 <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">Memorandum Review</h3>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Status</p>
                 <p className="font-black text-sm mb-3 text-blue-600">{formData.status?.toUpperCase()}</p>
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Subject</p>
                 <p className="font-bold text-sm text-gray-900">{formData.subject || 'No Subject'}</p>
              </div>

              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-40 resize-none transition-all" placeholder="Type feedback here..." />
              <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
                 <button onClick={() => handleSave('Draft')} disabled={isSaving} className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-xl border border-red-100 uppercase text-[10px] hover:bg-red-100 transition-colors tracking-widest">Return for Revision</button>
                 {userRole === 'Chief' && <button onClick={() => handleSave('For Approval')} disabled={isSaving} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase text-[10px] hover:bg-blue-700 transition-colors tracking-widest">Approve & Forward</button>}
                 {userRole === 'Director' && <button onClick={() => handleSave('Released')} disabled={isSaving} className="w-full bg-purple-600 text-white font-black py-4 rounded-xl shadow-lg uppercase text-[10px] hover:bg-purple-700 transition-colors tracking-widest">Approve & Release</button>}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDE: LIVE PREVIEW */}
        <div className="lg:col-span-7 sticky top-8 flex justify-center w-full">
          <div className="bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] ring-1 ring-gray-900/5 aspect-[1/1.414] w-full max-w-[800px] flex flex-col relative overflow-hidden text-gray-900 font-serif">
            
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]"></div>

            <div className="absolute top-0 left-0 w-full h-[16%] pointer-events-none">
              <img src={headerUrl} alt="Header" className="w-full h-full object-fill" />
            </div>
            <div className="absolute bottom-0 left-0 w-full h-[10%] pointer-events-none">
              <img src={footerUrl} alt="Footer" className="w-full h-full object-fill" />
            </div>

            <div className="absolute top-[16%] bottom-[10%] left-[12%] right-[12%] flex flex-col pt-2 overflow-y-auto custom-scrollbar-preview text-[11.5px] leading-[1.6]">
              <div className="font-bold text-[1.15em] mb-1 uppercase tracking-tight">MEMORANDUM</div>
              
              <div className="mb-6 space-y-0.5">
                <div className="flex items-end gap-1">
                  <span>No.</span>
                  {/* UPDATED: Width to 30px to match standard */}
                  <span className="border-b-[1.5px] border-black w-[30px] inline-block mb-1"></span>
                </div>
                <div>Series of {formData.series_year}</div>
              </div>

              <table className="w-full text-left mb-6 border-collapse">
                <tbody>
                  <tr><td className="w-[80px] font-black py-1 align-top uppercase">TO</td><td className="w-[10px] align-top py-1 text-center font-bold">:</td><td className="font-black uppercase py-1 underline underline-offset-4 decoration-1">{formData.recipient_name || '[ RECIPIENT ]'}</td></tr>
                  <tr><td className="w-[80px] font-black py-1 align-top uppercase">SUBJECT</td><td className="w-[10px] align-top py-1 text-center font-bold">:</td><td className="font-black uppercase py-1 underline underline-offset-4 decoration-1">{formData.subject || '[ SUBJECT ]'}</td></tr>
                  <tr><td className="w-[80px] font-black py-1 align-top uppercase">DATE</td><td className="w-[10px] align-top py-1 text-center font-bold">:</td><td className="font-black uppercase py-1 underline underline-offset-4 decoration-1">{formData.memo_date || '[ DATE ]'}</td></tr>
                </tbody>
              </table>
              
              <div className="w-full h-[1.5px] bg-black mb-6"></div>
              
              <div className="preview-body-container flex-1">
                <div className="document-body-content" dangerouslySetInnerHTML={{ __html: formData.body_content || '<p style="color:#aaa">Body content will appear here...</p>' }} />
              </div>

              {/* LIVE PREVIEW SIGNATORY BLOCK */}
              <div className="mb-12 mt-12 pl-4">
                <div className="font-bold uppercase text-[1.15em]">{formData.signatory_name || '[ SIGNATORY NAME ]'}</div>
                <div className="text-gray-900 pt-0.5">{formData.signatory_title || '[ Position ]'}</div>
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
        <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] flex items-center gap-3 z-[150] text-[10px] font-bold uppercase tracking-widest text-white border backdrop-blur-md animate-fadeIn ${toast.type === 'success' ? 'bg-blue-600/90 border-blue-400/50' : 'bg-red-600/90 border-red-400/50'}`}>
          {toast.message}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .document-body-content { text-align: justify; text-justify: inter-word; word-wrap: break-word; overflow-wrap: break-word; hyphens: auto; }
        .document-body-content p { margin-bottom: 1.2em; line-height: 1.6; }
        .document-body-content ul, .document-body-content ol { margin-left: 2em; margin-bottom: 1.2em; }
        .document-body-content li { margin-bottom: 0.5em; }
        .custom-scrollbar-preview::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar-preview::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-preview::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
}