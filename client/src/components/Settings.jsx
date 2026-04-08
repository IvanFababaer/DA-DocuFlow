import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Settings State
  const [settings, setSettings] = useState({
    routing_enabled: 'false'
  });

  // Image Upload States
  const [headerFile, setHeaderFile] = useState(null);
  const [footerFile, setFooterFile] = useState(null);
  const [headerPreview, setHeaderPreview] = useState('');
  const [footerPreview, setFooterPreview] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch current settings on load
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase.from('agency_settings').select('*');
        if (error) throw error;
        
        if (data) {
          const newSettings = { ...settings };
          data.forEach(item => {
            if (item.setting_key === 'routing_enabled') newSettings.routing_enabled = item.setting_value;
            if (item.setting_key === 'header_url') setHeaderPreview(item.setting_value);
            if (item.setting_key === 'footer_url') setFooterPreview(item.setting_value);
          });
          setSettings(newSettings);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        showToast("Failed to load settings.", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Handle File Selection & Preview
  const handleImageChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    // Create a temporary local URL for previewing before upload
    const previewUrl = URL.createObjectURL(file);

    if (type === 'header') {
      setHeaderFile(file);
      setHeaderPreview(previewUrl);
    } else {
      setFooterFile(file);
      setFooterPreview(previewUrl);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let finalHeaderUrl = headerPreview;
      let finalFooterUrl = footerPreview;

      // 1. Upload Header Image if a new one was selected
      if (headerFile) {
        showToast("Uploading Header...", "success");
        const headerExt = headerFile.name.split('.').pop();
        const headerFileName = `header_${Date.now()}.${headerExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('branding')
          .upload(headerFileName, headerFile, { upsert: true });
        
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('branding').getPublicUrl(headerFileName);
        finalHeaderUrl = data.publicUrl;
      }

      // 2. Upload Footer Image if a new one was selected
      if (footerFile) {
        showToast("Uploading Footer...", "success");
        const footerExt = footerFile.name.split('.').pop();
        const footerFileName = `footer_${Date.now()}.${footerExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('branding')
          .upload(footerFileName, footerFile, { upsert: true });
        
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('branding').getPublicUrl(footerFileName);
        finalFooterUrl = data.publicUrl;
      }

      // 3. Prepare data for database upsert
      const updates = [
        { setting_key: 'routing_enabled', setting_value: settings.routing_enabled.toString() },
        { setting_key: 'header_url', setting_value: finalHeaderUrl },
        { setting_key: 'footer_url', setting_value: finalFooterUrl }
      ];

      // 4. Update the agency_settings table
      for (const update of updates) {
        const { error } = await supabase
          .from('agency_settings')
          .update({ setting_value: update.setting_value })
          .eq('setting_key', update.setting_key);
          
        if (error) {
            await supabase.from('agency_settings').insert([update]);
        }
      }

      showToast("Global settings and branding updated!", "success");
      
      // Clear the file state so it doesn't re-upload if they click save again
      setHeaderFile(null);
      setFooterFile(null);

    } catch (error) {
      console.error("Error saving settings:", error);
      showToast("Failed to save settings. Ensure your 'branding' bucket exists and is Public.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500 font-bold animate-pulse">Loading System Settings...</div>;

  const isRoutingOn = settings.routing_enabled === 'true';

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 font-sans animate-fadeIn text-gray-900">
      
      <div className="mb-8 border-b border-gray-200 pb-5 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black tracking-tight">System Settings</h2>
          <p className="text-gray-500 font-medium text-sm mt-1">Manage global routing protocols and document branding.</p>
        </div>
        <button onClick={() => navigate('/')} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors">
          Back to Dashboard
        </button>
      </div>

      <div className="space-y-8">
        
        {/* ROUTING CONFIGURATION */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-50 pb-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            <h3 className="text-lg font-black uppercase tracking-tight">Routing Protocol</h3>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <div className="mb-4 sm:mb-0">
              <p className="font-bold text-gray-900">Chief & Director Approval Flow</p>
              <p className="text-xs text-gray-500 mt-1 max-w-md">
                When enabled, documents must pass through a review queue. When disabled, Staff can instantly finalize and generate documents (Express Mode).
              </p>
            </div>
            
            <button 
              onClick={() => handleChange('routing_enabled', isRoutingOn ? 'false' : 'true')}
              className={`w-16 h-8 rounded-full transition-all relative flex-shrink-0 ${isRoutingOn ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${isRoutingOn ? 'left-9' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {/* BRANDING CONFIGURATION (IMAGE UPLOADS) */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-50 pb-4">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <h3 className="text-lg font-black uppercase tracking-tight">Document Branding</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Header Upload Box */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-center relative overflow-hidden group hover:border-amber-400 transition-colors">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Official Header</p>
              
              {headerPreview ? (
                <div className="relative w-full h-32 flex items-center justify-center bg-white rounded-xl border border-gray-200 p-2 mb-3">
                  <img src={headerPreview} alt="Header Preview" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="w-full h-32 flex items-center justify-center bg-gray-100 rounded-xl border border-gray-200 mb-3 text-xs text-gray-400 font-bold">
                  No Header Uploaded
                </div>
              )}
              
              <label className="cursor-pointer bg-white border border-gray-200 text-gray-700 hover:text-amber-600 hover:border-amber-300 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm z-10">
                {headerPreview ? 'Change Header' : 'Upload Header'}
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/jpg" 
                  className="hidden" 
                  onChange={(e) => handleImageChange(e, 'header')} 
                />
              </label>
              <p className="text-[9px] text-gray-400 mt-2">Recommended: PNG format with transparent background</p>
            </div>

            {/* Footer Upload Box */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-center relative overflow-hidden group hover:border-amber-400 transition-colors">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Official Footer</p>
              
              {footerPreview ? (
                <div className="relative w-full h-20 flex items-center justify-center bg-white rounded-xl border border-gray-200 p-2 mb-3">
                  <img src={footerPreview} alt="Footer Preview" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="w-full h-20 flex items-center justify-center bg-gray-100 rounded-xl border border-gray-200 mb-3 text-xs text-gray-400 font-bold">
                  No Footer Uploaded
                </div>
              )}
              
              <label className="cursor-pointer bg-white border border-gray-200 text-gray-700 hover:text-amber-600 hover:border-amber-300 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm z-10">
                {footerPreview ? 'Change Footer' : 'Upload Footer'}
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/jpg" 
                  className="hidden" 
                  onChange={(e) => handleImageChange(e, 'footer')} 
                />
              </label>
              <p className="text-[9px] text-gray-400 mt-2">Recommended: Clean, wide dimension PNG</p>
            </div>

          </div>
        </div>

        {/* SAVE BUTTON */}
        <div className="flex justify-end pt-4">
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-green-600 text-white px-10 py-4 rounded-xl font-black uppercase tracking-widest text-[11px] hover:bg-green-700 transition-colors shadow-lg shadow-green-600/30 disabled:opacity-70 flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Saving System Updates...
              </>
            ) : 'Save Global Settings'}
          </button>
        </div>

      </div>

      {toast && (
        <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-[150] text-[10px] font-bold uppercase tracking-widest text-white transition-all border backdrop-blur-md animate-fadeIn ${toast.type === 'success' ? 'bg-green-600/90 border-green-400/50' : 'bg-red-600/90 border-red-400/50'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}