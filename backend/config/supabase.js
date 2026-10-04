const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const rawUrl = (process.env.SUPABASE_URL || 'https://your-project.supabase.co').trim();
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'dummy-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-key';

let supabase = null;
let supabaseAdmin = null;

if (process.env.MOCK_MODE !== 'true') {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log("Supabase Client initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize Supabase client. Defaulting to safe placeholders:", err.message);
  }
} else {
  console.log("Backend running in MOCK_MODE=true. Real Supabase client initialization skipped.");
}

module.exports = {
  supabase,
  supabaseAdmin
};
