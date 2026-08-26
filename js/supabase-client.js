// AMI Designs & Events — Supabase client initialization
// Anon key is safe to expose client-side; access control is enforced via RLS policies.

const SUPABASE_URL = 'https://yfckrixgbzgyprmdcfte.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY2tyaXhnYnpneXBybWRjZnRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NDI1MDYsImV4cCI6MjEwMzMxODUwNn0.yZwPNmygEbvVLCnc85-3a_npGyuVO5dxMwSI6oilu6E';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
