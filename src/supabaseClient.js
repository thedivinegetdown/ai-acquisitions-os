import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uemryxbyswxhixyvccgd.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlbXJ5eGJ5c3d4aGl4eXZjY2dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDI5MDMsImV4cCI6MjA4ODkxODkwM30.7HwbrWhadg2hPKgEV69Y-FsvBQTt2K-Z9_GkdaxkNYk";

export const supabase = createClient(supabaseUrl, supabaseKey);