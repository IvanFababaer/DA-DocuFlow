import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase Project URL and ANON Key
// You can find these in your Supabase Dashboard -> Settings -> API
const supabaseUrl = 'https://djjrfmzmjgabxrokkwrv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqanJmbXptamdhYnhyb2trd3J2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAyNzkzMCwiZXhwIjoyMDg4NjAzOTMwfQ.fZSjsR_mz5L0gm_kfsZCdSLa6odxHyH3w_rjF6Pavpo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);