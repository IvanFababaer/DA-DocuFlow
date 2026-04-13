import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// 1. IMPORT THE LOGO HERE 
// Note: Ensure DA.png is inside your src/assets/ folder, or adjust the path.
import DALogo from '../assets/DA.png'; 

export default function Sidebar({ userRole = 'Staff', onLogout }) {
  const location = useLocation();

  const isActive = (path) => {
    // Exact match for dashboard, partial match for sub-routes
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <aside className="w-72 bg-white border-r border-gray-200 h-screen flex flex-col shadow-[15px_0_40px_rgba(0,0,0,0.02)] hidden md:flex sticky top-0 z-50 relative overflow-hidden">
      
      {/* --- AMBIENT GLOW (Carried over from Login) --- */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-green-50 to-transparent blur-2xl pointer-events-none opacity-60"></div>

      {/* BRANDING / LOGO AREA */}
      <div className="h-24 flex items-center px-8 border-b border-gray-100 relative z-10">
        <div className="flex items-center gap-4">
          
          {/* 2. USE THE IMPORTED VARIABLE HERE */}
          <img 
            src={DALogo} 
            alt="DocuFlow DA MIMAROPA Logo" 
            className="w-11 h-11 rounded-xl object-contain shadow-[0_0_15px_rgba(250,204,21,0.4)] border border-yellow-300 bg-white" 
          />
          
          <div>
            <h1 className="font-black text-gray-900 tracking-tight leading-tight text-xl">DocuFlow</h1>
            <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest">DA MIMAROPA</p>
          </div>
        </div>
      </div>

      {/* NAVIGATION LINKS */}
      <div className="flex-1 overflow-y-auto py-8 px-5 space-y-8 custom-scrollbar relative z-10">
        
        {/* MAIN DASHBOARD (Visible to Everyone) */}
        <div>
          <p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Main Navigation</p>
          <Link 
            to="/" 
            className={`group flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm ${
              isActive('/') 
                // Matches the Green Gradient button from the Login Screen
                ? 'bg-gradient-to-r from-green-700 to-green-800 text-white shadow-[0_8px_20px_rgba(21,128,61,0.25)] border border-green-600/50 translate-x-1' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-green-700'
            }`}
          >
            <svg className={`w-5 h-5 transition-colors ${isActive('/') ? 'text-green-100' : 'text-gray-400 group-hover:text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            <span className="group-hover:translate-x-1 transition-transform duration-200">
              {userRole === 'Staff' ? 'Control Tower' : userRole === 'Chief' ? 'Review Pipeline' : 'Executive Desk'}
            </span>
          </Link>
        </div>

        {/* DOCUMENT ORIGINATION (Visible ONLY to Staff) */}
        {userRole === 'Staff' && (
          <div>
            <p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Draft New Document</p>
            <div className="space-y-1.5">
              
              <Link to="/create-ao" className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm border-l-4 ${isActive('/create-ao') ? 'bg-emerald-50 text-emerald-800 border-emerald-500' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-emerald-600'}`}>
                <div className={`p-1.5 rounded-lg ${isActive('/create-ao') ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <span className="group-hover:translate-x-1 transition-transform duration-200">Administrative Order</span>
              </Link>
              
              <Link to="/create-so" className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm border-l-4 ${isActive('/create-so') ? 'bg-purple-50 text-purple-800 border-purple-500' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-purple-600'}`}>
                <div className={`p-1.5 rounded-lg ${isActive('/create-so') ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400 group-hover:bg-purple-100 group-hover:text-purple-600'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <span className="group-hover:translate-x-1 transition-transform duration-200">Special Order</span>
              </Link>
              
              <Link to="/create-memo" className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm border-l-4 ${isActive('/create-memo') ? 'bg-blue-50 text-blue-800 border-blue-500' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-blue-600'}`}>
                <div className={`p-1.5 rounded-lg ${isActive('/create-memo') ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                </div>
                <span className="group-hover:translate-x-1 transition-transform duration-200">Memorandum</span>
              </Link>
              
              <Link to="/create-letter" className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm border-l-4 ${isActive('/create-letter') ? 'bg-amber-50 text-amber-800 border-amber-500' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-amber-600'}`}>
                <div className={`p-1.5 rounded-lg ${isActive('/create-letter') ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400 group-hover:bg-amber-100 group-hover:text-amber-600'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <span className="group-hover:translate-x-1 transition-transform duration-200">Official Letter</span>
              </Link>
              
            </div>
          </div>
        )}

        {/* ADMINISTRATION (Visible to Chief & Director) */}
        {(userRole === 'Chief' || userRole === 'Director') && (
          <div>
            <p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Administration</p>
            <Link 
              to="/settings" 
              className={`group flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm ${
                isActive('/settings') 
                  ? 'bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-200 translate-x-1 border border-gray-700' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className={`w-5 h-5 transition-colors ${isActive('/settings') ? 'text-green-400' : 'text-gray-400 group-hover:text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className="group-hover:translate-x-1 transition-transform duration-200">Agency Settings</span>
            </Link>
          </div>
        )}
      </div>

      {/* USER PROFILE & LOGOUT */}
      <div className="p-5 border-t border-gray-100 bg-slate-50/50 relative z-10">
        <div className="bg-white rounded-[1.25rem] p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-4">
            
            {/* Matches the Green gradient of the Login button */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-100 to-green-200 border border-green-300 shadow-inner flex items-center justify-center font-black text-green-800 relative">
              {userRole.charAt(0)}
              {/* Online Pulse Indicator */}
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-ping opacity-75"></span>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-black text-gray-900 truncate">{userRole}</p>
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest flex items-center gap-1">
                Active Session
              </p>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-95 transition-all duration-200 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}