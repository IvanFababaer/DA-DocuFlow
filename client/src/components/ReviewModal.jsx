import { useState } from 'react';

export default function ReviewModal({ selectedDoc, isOpen, onClose, onUpdateStatus, isUpdating, userRole }) {
  const [remarks, setRemarks] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen || !selectedDoc) return null;

  const handleAction = (newStatus) => {
    onUpdateStatus(newStatus, remarks);
    setRemarks('');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'For Review': return 'text-blue-600';
      case 'For Signature': return 'text-purple-600';
      case 'Signed': return 'text-emerald-600';
      default: return 'text-gray-500';
    }
  };

  const handlePrint = () => {
    if (selectedDoc?.pdf_url) {
      window.open(selectedDoc.pdf_url, '_blank');
    } else {
      alert("The PDF is currently being generated or is not available yet.");
    }
  };

  // UPDATED DOWNLOAD LOGIC: Bypasses cross-origin restrictions using a Blob
  const handleDownload = async () => {
    if (selectedDoc?.pdf_url) {
      setIsDownloading(true);
      try {
        const response = await fetch(selectedDoc.pdf_url);
        const blob = await response.blob();
        
        // Create a local object URL for the blob
        const blobUrl = window.URL.createObjectURL(blob);
        
        // Force the download
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${selectedDoc.document_type.replace(/\s+/g, '_')}_${selectedDoc.reference_number || 'Signed'}.pdf`;
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error("Download failed:", error);
        // Fallback: If fetch is blocked, just open it in a new tab
        window.open(selectedDoc.pdf_url, '_blank');
      } finally {
        setIsDownloading(false);
      }
    } else {
      alert("The PDF is currently being generated or is not available yet.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] text-black">
        
        {/* Modal Header */}
        <div className="p-6 md:p-8 bg-gray-50 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-black text-gray-900">Document Review</h3>
            <p className={`text-xs font-bold uppercase tracking-widest ${getStatusColor(selectedDoc.status)}`}>
              Current Status: {selectedDoc.status}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Modal Content - Scrollable Area */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
          
          {/* Staff sees Rejection Remarks here */}
          {userRole === 'Staff' && selectedDoc.status === 'Draft' && selectedDoc.remarks && (
            <div className="bg-red-50 border-l-4 border-red-600 p-5 rounded-r-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <h4 className="text-red-800 font-black text-[10px] uppercase tracking-widest">Reviewer Feedback</h4>
              </div>
              <p className="text-red-900 text-sm font-medium ml-7">{selectedDoc.remarks}</p>
            </div>
          )}

          {/* Document Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 md:gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Type</p>
              <p className="font-bold text-gray-900">{selectedDoc.document_type}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reference No.</p>
              <p className="font-bold text-gray-900">{selectedDoc.reference_number || 'TBD'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Subject</p>
              <p className="font-bold text-gray-900 uppercase leading-tight">{selectedDoc.subject}</p>
            </div>
          </div>

          {/* FULL DOCUMENT READER */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Document Content</p>
            <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-inner font-serif text-sm leading-relaxed text-justify text-gray-800 max-h-96 overflow-y-auto custom-scrollbar">
              
              {/* Conditional Headers */}
              {selectedDoc.recipient_name && (
                <div className="mb-4">
                  <span className="font-bold uppercase tracking-wider mr-2">TO:</span> 
                  <span className="uppercase">{selectedDoc.recipient_name}</span>
                </div>
              )}
              {selectedDoc.memo_date && (
                <div className="mb-4">
                  <span className="font-bold uppercase tracking-wider mr-2">DATE:</span> 
                  <span className="uppercase">{selectedDoc.memo_date}</span>
                </div>
              )}
              
              <hr className="my-6 border-gray-300" />
              
              <div 
                className="[&>p]:mb-4 [&>p]:mt-0 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-gray-400 [&_th]:p-2 [&_td]:border [&_td]:border-gray-400 [&_td]:p-2"
                dangerouslySetInnerHTML={{ __html: selectedDoc.body_content || '<p class="text-gray-400 italic text-center">No body content provided.</p>' }}
              />

              {/* Conditional Footers */}
              {selectedDoc.execution_date && (
                <div className="mt-8">
                  Done this <strong>{selectedDoc.execution_date}</strong>.
                </div>
              )}
            </div>
          </div>

          {/* Remarks Input (Chief/Director only) */}
          {(userRole === 'Chief' || userRole === 'Director') && selectedDoc.status !== 'Signed' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Add Comments / Revision Notes</label>
              <textarea 
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Type your feedback here before returning or approving..."
                className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm focus:border-emerald-500 outline-none transition-all h-20 resize-none bg-white"
              />
            </div>
          )}
        </div>

        {/* --- MODAL ACTIONS --- */}
        <div className="p-6 md:p-8 bg-white border-t border-gray-100 flex flex-col gap-3 shrink-0">
          
          {/* Action Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            
            {(userRole === 'Staff' && selectedDoc.status === 'Draft') && (
              <button onClick={() => handleAction('For Review')} disabled={isUpdating} className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-emerald-700 transition-all uppercase tracking-widest text-xs">
                Submit for Review
              </button>
            )}

            {(userRole === 'Chief' && selectedDoc.status === 'For Review') && (
              <>
                <button onClick={() => handleAction('Draft')} disabled={isUpdating} className="flex-1 bg-red-50 text-red-600 font-black py-4 rounded-2xl border border-red-100 hover:bg-red-100 transition-all uppercase tracking-widest text-xs">
                  Return to Encoder
                </button>
                <button onClick={() => handleAction('For Signature')} disabled={isUpdating} className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs">
                  Approve for Signature
                </button>
              </>
            )}

            {(userRole === 'Director' && selectedDoc.status === 'For Signature') && (
              <>
                <button onClick={() => handleAction('Draft')} disabled={isUpdating} className="flex-1 bg-red-50 text-red-600 font-black py-4 rounded-2xl border border-red-100 hover:bg-red-100 transition-all uppercase tracking-widest text-xs">
                  Reject / Return
                </button>
                <button onClick={() => handleAction('Signed')} disabled={isUpdating} className="flex-[2] bg-purple-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all uppercase tracking-widest text-xs">
                  {isUpdating ? "Processing..." : "Sign & Generate PDF"}
                </button>
              </>
            )}

            {/* DOWNLOAD AND PRINT BUTTONS */}
            {selectedDoc.status === 'Signed' && (
              <>
                <button onClick={handlePrint} className="flex-1 bg-gray-100 text-gray-700 font-black py-4 rounded-2xl border border-gray-200 hover:bg-gray-200 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Print
                </button>
                <button 
                  onClick={handleDownload} 
                  disabled={isDownloading}
                  className="flex-[2] bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <svg className={`w-5 h-5 ${isDownloading ? 'animate-bounce' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  {isDownloading ? "Fetching PDF..." : "Download PDF"}
                </button>
              </>
            )}
          </div>

          <button onClick={onClose} className="w-full bg-gray-100 text-gray-500 font-black py-3 rounded-2xl uppercase tracking-widest text-xs hover:bg-gray-200 hover:text-gray-900 transition-all">
            Close Window
          </button>

        </div>
      </div>
    </div>
  );
}