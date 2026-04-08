import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function SentEmails({ userRole }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dbError, setDbError] = useState(null); // <-- NEW: Error state
  const navigate = useNavigate();

  console.log("Current User Role:", userRole); // Debugging Role

  useEffect(() => {
    if (userRole === 'Staff') {
      console.log("Redirecting Staff user away from Sent Emails.");
      navigate('/');
      return;
    }

    console.log("Fetching logs...");
    fetchLogs();

    const emailSubscription = supabase
      .channel('public:communication_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'communication_logs' },
        (payload) => {
          console.log("Realtime Insert Detected:", payload);
          fetchLogs(true); 
        }
      )
      .subscribe((status) => {
          console.log("Realtime Subscription Status:", status);
      });

    return () => {
      supabase.removeChannel(emailSubscription);
    };
  }, [userRole, navigate]);

  const fetchLogs = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setDbError(null);
    try {
      const { data, error } = await supabase
        .from('communication_logs')
        .select(`
          *,
          official_documents (
            reference_number,
            status
          )
        `)
        .order('sent_at', { ascending: false });

      if (error) {
        console.error("Supabase Fetch Error:", error);
        throw error;
      }
      
      console.log("Data fetched from Supabase:", data); // Debugging Data
      setLogs(data || []);
      
    } catch (error) {
      console.error('Error fetching email logs:', error);
      setDbError(error.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
      const search = searchTerm.toLowerCase();
      return (
        (log.recipient_email && log.recipient_email.toLowerCase().includes(search)) ||
        (log.subject && log.subject.toLowerCase().includes(search)) ||
        (log.document_type && log.document_type.toLowerCase().includes(search))
      );
  });

  const getDocTypeStyle = (type) => {
    switch (type) {
      case 'Administrative Order': return 'bg-green-100 text-green-800 border-green-200';
      case 'Special Order': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Memorandum': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Letter': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderSkeletonLoader = () => (
    Array(5).fill(0).map((_, idx) => (
      <tr key={idx} className="animate-pulse border-b border-gray-50 last:border-0">
        <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-24 mb-2"></div></td>
        <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-full max-w-[200px]"></div></td>
        <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-full max-w-[250px]"></div></td>
        <td className="px-6 py-5"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
      </tr>
    ))
  );

  return (
    <div className="space-y-8 animate-fadeIn relative text-gray-900">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border border-slate-200">
              Communications Hub
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">Sent Emails Log</h2>
          <p className="text-gray-500 font-medium text-sm mt-2">
            A comprehensive history of all official documents dispatched from the system.
          </p>
        </div>
        
        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input
            type="text"
            placeholder="Search emails or subjects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-500 outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Emails Sent</p>
          <p className="text-3xl font-black text-gray-900">{logs.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sent Today</p>
          <p className="text-3xl font-black text-gray-900">
            {logs.filter(log => new Date(log.sent_at).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
      </div>

      {dbError && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 font-medium text-sm">
            <strong>Database Error:</strong> {dbError}
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/80 border-b border-gray-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Document Type</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Recipient</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject Line</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? renderSkeletonLoader() : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100 mb-2">
                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </div>
                      <p className="text-gray-500 font-bold text-sm">No email logs found</p>
                      {searchTerm && <p className="text-gray-400 text-xs font-medium">Try adjusting your search query.</p>}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border tracking-wider inline-block ${getDocTypeStyle(log.document_type)}`}>
                        {log.document_type || 'Document'}
                      </span>
                      {log.official_documents?.reference_number && (
                         <p className="text-[10px] font-bold text-gray-400 mt-1.5 ml-1">No. {log.official_documents.reference_number}</p>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-medium text-gray-900">{log.recipient_email}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm text-gray-600 font-medium truncate max-w-[250px] sm:max-w-sm" title={log.subject}>
                        {log.subject || 'No Subject Provided'}
                      </p>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">{new Date(log.sent_at).toLocaleDateString()}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                        {new Date(log.sent_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}