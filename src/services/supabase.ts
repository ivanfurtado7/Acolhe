import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mvpdullikuajjkqnlarx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12cGR1bGxpa3VhamprcW5sYXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODI4MjQsImV4cCI6MjEwMTk1ODgyNH0.JRgLY_M7OAZCOylnwsy3W0vL__3JammV_3TRPdbfZgg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)