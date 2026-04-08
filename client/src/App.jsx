import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient'; 

import Login from './components/Login'; 
import Dashboard from './components/Dashboard';
import AdminOrderForm from './components/AdminOrderForm';
import SpecialOrderForm from './components/SpecialOrderForm';
import MemorandumForm from './components/MemorandumForm';
import LetterForm from './components/LetterForm';
import SentEmails from './components/SentEmails';

// --- THE FIX IS RIGHT HERE: Pointing to the components folder! ---
import Settings from './components/Settings'; 

// --- LIGHT & AIRY COLLAPSIBLE SIDEBAR COMPONENT ---
function Sidebar({ session, isOpen, setIsOpen, userRole }) {
  const location = useLocation();
  
  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const getLinkClass = (path) => {
    const active = isActive(path);
    return `group flex items-center gap-3 px-5 py-3.5 rounded-l-xl text-sm tracking-wide transition-all duration-300 border-r-4 ${
      active 
        ? 'bg-green-50 text-green-700 font-bold border-green-600' 
        : 'text-gray-500 hover:bg-gray-50 hover:text-green-600 font-medium border-transparent hover:border-gray-200 hover:translate-x-1'
    }`;
  };

  const getIconClass = (path) => {
    return `w-5 h-5 transition-colors ${isActive(path) ? 'text-green-600' : 'text-gray-400 group-hover:text-green-500'}`;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const userIdentifier = session?.user?.email?.split('@')[0] || 'User';

  return (
    <>
      {/* FLOATING TOGGLE BUTTON */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-6 z-50 bg-white text-gray-600 p-2.5 rounded-xl shadow-[0_8px_20px_rgba(0,0,0,0.08)] hover:bg-gray-50 border border-gray-200 transition-all duration-300 flex items-center justify-center
          ${isOpen ? 'left-[265px]' : 'left-6'}
        `}
      >
        <svg 
          className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180 text-gray-400' : 'rotate-0 text-green-600'}`} 
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* MOBILE OVERLAY */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 lg:hidden transition-opacity" 
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* MAIN SIDEBAR CONTAINER */}
      <div className={`fixed top-0 left-0 h-screen bg-white flex flex-col shadow-[15px_0_40px_rgba(0,0,0,0.03)] z-40 border-r border-gray-100 transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-full'}`}>
        
        {/* --- SUBTLE AMBIENT GLOW --- */}
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-green-50 to-transparent blur-2xl pointer-events-none opacity-80"></div>
        <div className="absolute left-8 top-4 w-16 h-16 bg-yellow-100/50 blur-2xl rounded-full pointer-events-none"></div>

        {/* BRANDING / LOGO AREA */}
        <div className="h-24 flex items-center px-8 border-b border-gray-100 relative z-10 shrink-0 bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.3)] border border-yellow-300">
              <svg className="w-5 h-5 text-green-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <h1 className="font-black text-gray-900 tracking-tight leading-tight text-xl">DocuFlow</h1>
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">DA MIMAROPA</p>
            </div>
          </div>
        </div>
        
        {/* NAVIGATION LINKS */}
        <div className="flex flex-col flex-1 py-8 overflow-y-auto custom-scrollbar relative z-10 pl-4">
          
          {/* Main Navigation */}
          <div className="mb-6">
            <Link to="/" onClick={() => window.innerWidth < 1024 && setIsOpen(false)} className={getLinkClass('/')}>
              <svg className={getIconClass('/')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              {userRole === 'Staff' ? 'Control Tower' : userRole === 'Chief' ? 'Review Pipeline' : 'Executive Desk'}
            </Link>
          </div>

          {/* Generators (Visible ONLY to Staff) */}
          {userRole === 'Staff' && (
            <>
              <div className="px-5 pb-2 mt-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Draft Documents</p>
              </div>
              <div className="space-y-1">
                <Link to="/create-ao" onClick={() => window.innerWidth < 1024 && setIsOpen(false)} className={getLinkClass('/create-ao')}>
                  <svg className={getIconClass('/create-ao')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Administrative Order
                </Link>
                <Link to="/create-so" onClick={() => window.innerWidth < 1024 && setIsOpen(false)} className={getLinkClass('/create-so')}>
                  <svg className={getIconClass('/create-so')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  Special Order
                </Link>
                <Link to="/create-memo" onClick={() => window.innerWidth < 1024 && setIsOpen(false)} className={getLinkClass('/create-memo')}>
                  <svg className={getIconClass('/create-memo')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                  Memorandum
                </Link>
                <Link to="/create-letter" onClick={() => window.innerWidth < 1024 && setIsOpen(false)} className={getLinkClass('/create-letter')}>
                  <svg className={getIconClass('/create-letter')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Official Letter
                </Link>
              </div>
            </>
          )}

          {/* Director Communications */}
          {userRole === 'Director' && (
            <>
              <div className="px-5 pb-2 mt-6">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Communications</p>
              </div>
              <div className="space-y-1">
                <Link to="/sent-emails" onClick={() => window.innerWidth < 1024 && setIsOpen(false)} className={getLinkClass('/sent-emails')}>
                  <svg className={getIconClass('/sent-emails')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Sent Emails
                </Link>
              </div>
            </>
          )}

          {/* Administration (Visible to ALL users now) */}
          <div className="px-5 pb-2 mt-6">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">System</p>
          </div>
          <div className="space-y-1">
            <Link to="/settings" onClick={() => window.innerWidth < 1024 && setIsOpen(false)} className={getLinkClass('/settings')}>
              <svg className={getIconClass('/settings')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              System Settings
            </Link>
          </div>
        </div>
        
        {/* USER PROFILE & LOGOUT - Clean & Airy */}
        <div className="p-5 border-t border-gray-100 bg-slate-50/50 shrink-0">
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 border border-green-200 flex items-center justify-center text-green-700 font-black text-xs relative shrink-0">
                {userIdentifier.charAt(0).toUpperCase()}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border border-white rounded-full"></span>
              </div>
              <div className="overflow-hidden">
                <p className="text-sm text-gray-900 font-bold truncate capitalize">{userIdentifier}</p>
                <p className="text-[9px] text-green-600 uppercase tracking-widest mt-0.5 font-bold">Role: {userRole}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors uppercase tracking-widest font-bold border border-gray-100 hover:border-red-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Secure Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// --- MAIN APP COMPONENT ---
function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const fetchUserRole = async (userId) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setUserRole(data.role);
      } else {
        setUserRole('Staff'); 
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setLoading(true);
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4"></div>
      <p className="text-sm font-bold tracking-widest uppercase text-green-700">Authenticating User Profile...</p>
    </div>
  );

  return (
    <Router>
      <Routes>
        
        {/* --- EXPLICIT LOGIN ROUTE --- */}
        <Route 
          path="/login" 
          element={!session ? <Login /> : <Navigate to="/" replace />} 
        />

        {/* --- PROTECTED ROUTES --- */}
        <Route 
          path="/*" 
          element={
            session ? (
              <div className="flex bg-slate-50 min-h-screen font-sans selection:bg-green-200 selection:text-green-900 relative">
                <Sidebar session={session} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} userRole={userRole} />
                
                {/* Dynamic Margin based on Sidebar State */}
                <main className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ml-0 md:ml-72' : 'ml-0'} p-6 md:p-10 w-full`}>
                  <div className={`mx-auto w-full transition-all duration-300 ${isSidebarOpen ? 'max-w-6xl' : 'max-w-screen-2xl'}`}>
                    <Routes>
                      {/* Mapping the new routes to the Dashboard */}
                      <Route path="/" element={<Dashboard session={session} userRole={userRole} />} />
                      
                      {(userRole === 'Staff' || userRole === 'Chief' || userRole === 'Director') && (
                        <>
                          <Route path="/create-ao" element={<AdminOrderForm userRole={userRole} />} />
                          <Route path="/create-ao/:id" element={<AdminOrderForm userRole={userRole} />} />

                          <Route path="/create-so" element={<SpecialOrderForm userRole={userRole} />} />
                          <Route path="/create-so/:id" element={<SpecialOrderForm userRole={userRole} />} />

                          <Route path="/create-memo" element={<MemorandumForm userRole={userRole} />} />
                          <Route path="/create-memo/:id" element={<MemorandumForm userRole={userRole} />} />

                          <Route path="/create-letter" element={<LetterForm userRole={userRole} />} />
                          <Route path="/create-letter/:id" element={<LetterForm userRole={userRole} />} />
                          
                          {/* Visible to everyone including Staff now */}
                          <Route path="/settings" element={<Settings />} />
                        </>
                      )}

                      {/* --- DIRECTOR'S SENT EMAILS PLACEHOLDER ROUTE --- */}
                      {userRole === 'Director' && (
                        <Route path="/sent-emails" element={
                          <div className="animate-fadeIn relative text-gray-900">
                            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-200 pb-5">
                              <div>
                                <h2 className="text-3xl md:text-4xl font-black tracking-tight">Sent Emails</h2>
                                <p className="text-gray-500 font-medium text-sm mt-2">View the history of all securely dispatched documents.</p>
                              </div>
                            </div>
                            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 p-20 text-center flex flex-col items-center justify-center">
                              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 mb-4">
                                <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                              </div>
                              <h3 className="text-lg font-black text-gray-900 mb-1">Email Module</h3>
                              <p className="text-sm text-gray-500 font-medium max-w-md">Import your new SentEmails component here to view dispatch history.</p>
                            </div>
                          </div>
                        } />
                      )}

                    </Routes>
                  </div>
                </main>
              </div>
            ) : (
              // Redirect to login if there is no session
              <Navigate to="/login" replace />
            )
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;