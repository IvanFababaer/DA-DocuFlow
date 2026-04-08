import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function BrandingSettings() {
  const [headerUrl, setHeaderUrl] = useState(null);
  const [footerUrl, setFooterUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const { data } = await supabase.from('agency_settings').select('*');
    if (data) {
      data.forEach(s => {
        if (s.setting_key === 'header_url') setHeaderUrl(s.setting_value);
        if (s.setting_key === 'footer_url') setFooterUrl(s.setting_value);
      });
    }
  }

  async function handleUpload(event, key) {
    try {
      setUploading(true);
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${key}-${Math.random()}.${fileExt}`;
      const filePath = `branding/${fileName}`;

      // 1. Upload to Supabase Bucket
      let { error: uploadError } = await supabase.storage
        .from('assets') // Ensure you have a bucket named 'assets'
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data } = supabase.storage.from('assets').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      // 3. Update Database
      await supabase.from('agency_settings')
        .update({ setting_value: publicUrl })
        .eq('setting_key', key);

      // 4. Update Local State
      if (key === 'header_url') setHeaderUrl(publicUrl);
      if (key === 'footer_url') setFooterUrl(publicUrl);

      alert("Branding updated successfully!");
    } catch (error) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8 font-sans">
      <h2 className="text-3xl font-black text-green-900 mb-8 uppercase tracking-widest">Agency Branding</h2>
      
      <div className="grid gap-10">
        {/* HEADER UPLOADER */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Current Document Header</label>
          <img src={headerUrl} alt="Header" className="w-full h-24 object-contain bg-gray-50 rounded mb-4 border border-dashed border-gray-300" />
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => handleUpload(e, 'header_url')} 
            disabled={uploading}
            className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-green-100 file:text-green-700 hover:file:bg-green-200 cursor-pointer"
          />
        </div>

        {/* FOOTER UPLOADER */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Current Document Footer</label>
          <img src={footerUrl} alt="Footer" className="w-full h-20 object-contain bg-gray-50 rounded mb-4 border border-dashed border-gray-300" />
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => handleUpload(e, 'footer_url')} 
            disabled={uploading}
            className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-green-100 file:text-green-700 hover:file:bg-green-200 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}