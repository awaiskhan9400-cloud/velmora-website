-- Enable scoped product catalogue change notifications for the existing website and mobile app.
-- This does not modify product rows, prices, images, or publication status.
alter publication supabase_realtime add table public.velmora_products;
