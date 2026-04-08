import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../supabaseClient'; 
import ReviewModal from './ReviewModal'; 

export default function Dashboard({ userRole = 'Staff' }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  // --- SYSTEM SETTING: The Master Routing Toggle ---
  const [isRoutingEnabled, setIsRoutingEnabled] = useState(false); 

  // Modal States
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Dynamic Tabs based on Role AND Routing State
  const getTabs = () => {
    if (!isRoutingEnabled) {
      return ['All', 'Draft', 'Released'];
    }
    
    if (userRole === 'Director') return ['For Approval', 'Released', 'All'];
    if (userRole === 'Chief') return ['For Review', 'For Approval', 'Released', 'All'];
    return ['All', 'Draft', 'For Review', 'Released']; 
  };

  const tabs = getTabs();
  
  // Dynamic Default Tab
  const defaultTab = !isRoutingEnabled ? 'All' 
    : userRole === 'Director' ? 'For Approval' 
    : userRole === 'Chief' ? 'For Review' 
    : 'All';
    
  const [activeTab, setActiveTab] = useState(defaultTab);
  const navigate = useNavigate();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000); 
  };

  // --- Fetch Documents ---
  const fetchDocuments = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('official_documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments(data || []);

      if (selectedDoc) {
        const updated = data.find(d => d.id === selectedDoc.id);
        if (updated) setSelectedDoc(updated);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      if (!isBackground) showToast("Failed to fetch documents.", "error");
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // --- Live Realtime Subscription ---
  useEffect(() => {
    fetchDocuments();

    const documentSubscription = supabase
      .channel('public:official_documents')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'official_documents' },
        () => { fetchDocuments(true); }
      )
      .subscribe();

    return () => supabase.removeChannel(documentSubscription);
  }, []);

  // --- Handle Status Updates from Modal (If Routing is ON) ---
  const handleUpdateStatus = async (newStatus, remarks) => {
    setIsUpdating(true);
    try {
      const historyEntry = { 
        user: userRole, 
        action: `Moved to ${newStatus}`, 
        remarks: remarks || 'No remarks provided.', 
        date: new Date().toISOString() 
      };

      const { error } = await supabase.from('official_documents').update({ 
          status: newStatus, 
          remarks: remarks, 
          routing_history: [...(selectedDoc.routing_history || []), historyEntry]
        }).eq('id', selectedDoc.id);

      if (error) throw error;
      
      if (newStatus === 'Released') {
        try {
          const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/documents/${selectedDoc.id}/generate-pdf`
        );
          if (!response.data.pdfUrl) showToast("Document released, but PDF generation failed.", "error");
          else showToast("Document officially released and PDF generated!", "success");
        } catch (pdfError) {
          showToast("Could not reach PDF server.", "error");
        }
      } else {
        showToast(`Document successfully routed to: ${newStatus}`, "success");
      }
      
      await fetchDocuments(true);
      setIsModalOpen(false); 
    } catch (error) {
      showToast("Failed to update routing status.", "error");
    } finally { setIsUpdating(false); }
  };

  const deleteDoc = async (id, status) => {
    if (status !== 'Draft' && status !== 'Released') return showToast("You can only delete Drafts or Archived documents.", "error");
    if (!window.confirm("Are you sure you want to delete this document permanently?")) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/documents/${id}`);
      showToast("Document deleted successfully.", "success");
      fetchDocuments(true);
    } catch (error) {
      showToast("Failed to delete document.", "error");
    }
  };

  const handleNavigateToDoc = (e, doc) => {
    if (e) e.stopPropagation();
    const routes = { 
      'Administrative Order': `/create-ao/${doc.id}`, 
      'Special Order': `/create-so/${doc.id}`, 
      'Memorandum': `/create-memo/${doc.id}`, 
      'Letter': `/create-letter/${doc.id}` 
    };
    if (routes[doc.document_type]) navigate(routes[doc.document_type]);
  };

  const handleRowClick = (doc) => {
    if (!isRoutingEnabled || doc.status === 'Released' || doc.status === 'Draft') {
      handleNavigateToDoc(null, doc);
    } 
    else if (
      userRole === 'Director' || 
      (userRole === 'Chief' && doc.status === 'For Review')
    ) {
      handleNavigateToDoc(null, doc);
    } else {
      setSelectedDoc(doc); 
      setIsModalOpen(true); 
    }
  };

  const filteredDocs = useMemo(() => {
    return activeTab === 'All' ? documents : documents.filter(doc => doc.status === activeTab);
  }, [documents, activeTab]);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'For Review': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'For Approval': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Released': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-500 border-gray-200';
    }
  };

  const getPageTitle = () => {
    if (!isRoutingEnabled) return 'Document Control Tower';
    return userRole === 'Staff' ? 'Document Control Tower' : userRole === 'Chief' ? 'Review Pipeline' : 'Executive Dashboard';
  };

  const renderStats = () => {
    if (!isRoutingEnabled) {
      return (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Docs</p>
            <p className="text-3xl font-black text-gray-900">{documents.length}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-3xl border border-gray-200 shadow-sm">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Drafts</p>
            <p className="text-3xl font-black text-gray-700">{documents.filter(d => d.status === 'Draft').length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-3xl border border-green-200 shadow-sm">
            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Finalized & Released</p>
            <p className="text-3xl font-black text-green-700">{documents.filter(d => d.status === 'Released').length}</p>
          </div>
        </div>
      );
    }

    if (userRole === 'Staff') return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Docs</p><p className="text-3xl font-black text-gray-900">{documents.length}</p></div>
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-3xl border border-gray-200 shadow-sm"><p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">My Drafts</p><p className="text-3xl font-black text-gray-700">{documents.filter(d => d.status === 'Draft').length}</p></div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-3xl border border-blue-200 shadow-sm"><p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Pending Review</p><p className="text-3xl font-black text-blue-700">{documents.filter(d => d.status === 'For Review' || d.status === 'For Approval').length}</p></div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-3xl border border-green-200 shadow-sm"><p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Released</p><p className="text-3xl font-black text-green-700">{documents.filter(d => d.status === 'Released').length}</p></div>
      </div>
    );

    if (userRole === 'Chief') {
      const pendingDocs = documents.filter(d => d.status === 'For Review');
      const forwardedDocs = documents.filter(d => d.status === 'For Approval');
      const returnedDocs = documents.filter(d => d.status === 'Draft' && d.routing_history && d.routing_history.some(h => h.action === 'Returned for Revision'));
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-3xl border border-blue-200 shadow-sm">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Inbox (Pending Review)</p>
            <p className="text-3xl font-black text-blue-700">{pendingDocs.length}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-3xl border border-gray-200 shadow-sm">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Quality Control</p>
            <p className="text-3xl font-black text-gray-700">{returnedDocs.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-3xl border border-green-200 shadow-sm">
            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Outbox (Forwarded)</p>
            <p className="text-3xl font-black text-green-700">{forwardedDocs.length}</p>
          </div>
        </div>
      );
    }

    if (userRole === 'Director') {
      const pendingDocs = documents.filter(d => d.status === 'For Approval');
      const releasedDocs = documents.filter(d => d.status === 'Released');
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-3xl border border-yellow-200 shadow-sm">
            <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-1">Pending Approval</p>
            <p className="text-3xl font-black text-yellow-700">{pendingDocs.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-3xl border border-green-200 shadow-sm">
            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Released Documents</p>
            <p className="text-3xl font-black text-green-700">{releasedDocs.length}</p>
          </div>
        </div>
      );
    }
  };

  const renderSkeletonLoader = () => (
    Array(4).fill(0).map((_, idx) => (
      <tr key={idx} className="animate-pulse border-b border-gray-50 last:border-0">
        <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-24 mb-2"></div><div className="h-3 bg-gray-100 rounded w-16"></div></td>
        <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-full max-w-[250px]"></div></td>
        <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-20 mb-2"></div><div className="h-3 bg-gray-100 rounded w-16"></div></td>
        <td className="px-6 py-5 text-center"><div className="h-6 bg-gray-200 rounded-full w-24 mx-auto"></div></td>
        <td className="px-6 py-5 text-right"><div className="h-4 bg-gray-200 rounded w-20 ml-auto"></div></td>
      </tr>
    ))
  );

  return (
    <div className="space-y-8 animate-fadeIn relative text-gray-900 max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
      
      {/* HEADER & TOGGLE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">{getPageTitle()}</h2>
          <p className="text-gray-500 font-medium text-sm mt-2 flex items-center gap-2">
            DA MIMAROPA Region 
            <span className="font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest border border-green-100">
              {isRoutingEnabled ? userRole : 'Staff Portal'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm">
            <span className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Routing</span>
            <button 
              onClick={() => setIsRoutingEnabled(!isRoutingEnabled)}
              className={`w-10 h-5 rounded-full transition-all relative ${isRoutingEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isRoutingEnabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          <button onClick={() => fetchDocuments(false)} disabled={loading} className="flex items-center justify-center gap-2 bg-white border border-gray-200 px-5 py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
            <svg className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin text-green-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {loading ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {renderStats()}

      {/* DYNAMIC TABS */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-px overflow-x-auto custom-scrollbar">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3.5 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap outline-none ${activeTab === tab ? 'border-green-600 text-green-700 bg-green-50/50' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/80 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Document</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date Created</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? renderSkeletonLoader() : filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100 mb-2"><svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                        <p className="text-gray-500 font-bold text-sm">No documents found</p>
                        <p className="text-gray-400 text-xs font-medium">There are currently no records in this queue.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id} className="transition-colors group hover:bg-green-50/40 cursor-pointer" onClick={() => handleRowClick(doc)}>
                      <td className="px-6 py-5">
                        <p className="text-sm font-black text-gray-900 group-hover:text-green-800 transition-colors">{doc.document_type}</p>
                        {/* FIXED: Handles empty reference_number gracefully */}
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-tighter mt-0.5">
                          {doc.reference_number ? `No. ${doc.reference_number}` : 'No. (Manual Entry)'}
                        </p>
                      </td>
                      <td className="px-6 py-5"><p className="text-sm text-gray-600 font-medium truncate max-w-[200px] sm:max-w-xs md:max-w-sm">{doc.subject || 'Untitled Document'}</p></td>
                      <td className="px-6 py-5 whitespace-nowrap"><p className="text-sm font-medium text-gray-900">{new Date(doc.created_at).toLocaleDateString()}</p><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{new Date(doc.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p></td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase border tracking-wider inline-block ${getStatusStyle(doc.status)}`}>
                          {doc.status || 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                          
                          {/* DYNAMIC ACTION BUTTONS */}
                          {(!isRoutingEnabled || userRole === 'Staff') && doc.status === 'Draft' && (
                            <button onClick={(e) => handleNavigateToDoc(e, doc)} className="text-green-700 font-bold text-[10px] uppercase tracking-widest hover:text-green-500 transition-colors bg-white border border-gray-200 hover:border-green-300 px-3 py-1.5 rounded-lg shadow-sm">
                              Edit Draft
                            </button>
                          )}
                          
                          {doc.status === 'Released' && (
                            <button onClick={(e) => handleNavigateToDoc(e, doc)} className="text-green-700 font-bold text-[10px] uppercase tracking-widest hover:text-green-500 transition-colors bg-white border border-gray-200 hover:border-green-300 px-3 py-1.5 rounded-lg shadow-sm">
                              View / Share
                            </button>
                          )}

                          {isRoutingEnabled && userRole === 'Staff' && doc.status !== 'Draft' && doc.status !== 'Released' && (
                             <button onClick={(e) => { e.stopPropagation(); setSelectedDoc(doc); setIsModalOpen(true); }} className="text-gray-500 font-bold text-[10px] uppercase tracking-widest hover:text-gray-900 transition-colors">
                               View Status
                             </button>
                          )}

                          {isRoutingEnabled && userRole === 'Chief' && doc.status === 'For Review' && (
                             <button onClick={(e) => handleNavigateToDoc(e, doc)} className="text-blue-700 font-bold text-[10px] uppercase tracking-widest hover:text-blue-500 transition-colors bg-white border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg shadow-sm">
                               Review Now
                             </button>
                          )}

                          {isRoutingEnabled && userRole === 'Director' && doc.status === 'For Approval' && (
                             <button onClick={(e) => handleNavigateToDoc(e, doc)} className="text-yellow-700 font-bold text-[10px] uppercase tracking-widest hover:text-yellow-600 transition-colors bg-white border border-gray-200 hover:border-yellow-400 px-3 py-1.5 rounded-lg shadow-sm">
                               Review & Approve
                             </button>
                          )}

                          {((userRole === 'Staff' && doc.status === 'Draft') || doc.status === 'Released') && (
                            <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id, doc.status); }} className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Delete">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
          </table>
        </div>
      </div>

      {isRoutingEnabled && (
        <ReviewModal selectedDoc={selectedDoc} isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedDoc(null); }} onUpdateStatus={handleUpdateStatus} isUpdating={isUpdating} userRole={userRole} />
      )}

      {toast && (
        <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] flex items-center gap-3 z-[150] text-[10px] font-bold uppercase tracking-widest text-white transition-all border backdrop-blur-md animate-fadeIn ${toast.type === 'success' ? 'bg-green-600/90 border-green-400/50' : 'bg-red-600/90 border-red-400/50'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}