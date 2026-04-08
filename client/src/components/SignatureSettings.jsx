import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function SignatureSettings() {
  const [uploading, setUploading] = useState(false);
  const [sigUrl, setSigUrl] = useState(null);

  useEffect(() => {
    fetchSignature();
  }, []);

  const fetchSignature = async () => {
    const { data } = await supabase.from('agency_settings').select('*').eq('setting_key', 'director_signature').maybeSingle();
    if (data) setSigUrl(data.setting_value);
  };

  const handleUpload = async (e) => {
    try {
      setUploading(true);
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `signature-${Math.random()}.${fileExt}`;

      // 1. Upload image to 'signatures' bucket
      const { error: uploadError } = await supabase.storage.from('signatures').upload(fileName, file);
      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage.from('signatures').getPublicUrl(fileName);

      // 3. Save URL to 'agency_settings' table
      const { error: upsertError } = await supabase.from('agency_settings').upsert({
        setting_key: 'director_signature',
        setting_value: publicUrl
      }, { onConflict: 'setting_key' });

      if (upsertError) throw upsertError;

      setSigUrl(publicUrl);
      alert("Signature updated successfully!");
    } catch (error) {
      alert("Error uploading signature");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-[2rem] shadow-xl border border-gray-100 text-black">
      <h2 className="text-2xl font-black mb-2">Director's Signature</h2>
      <p className="text-gray-500 text-sm mb-8">Upload a transparent PNG signature to be used for "Sign & Release".</p>

      <div className="flex flex-col items-center gap-6 p-10 border-4 border-dashed border-gray-100 rounded-[2rem] bg-gray-50">
        {sigUrl ? (
          <img src={sigUrl} alt="Signature" className="h-32 object-contain bg-white p-4 rounded-xl shadow-sm" />
        ) : (
          <div className="h-32 w-64 bg-white rounded-xl flex items-center justify-center text-gray-300 italic border border-gray-200">No signature uploaded</div>
        )}

        <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold cursor-pointer transition-all uppercase tracking-widest text-xs">
          {uploading ? "Uploading..." : "Upload Signature PNG"}
          <input type="file" accept="image/png" onChange={handleUpload} disabled={uploading} hidden />
        </label>
      </div>
    </div>
  );
}