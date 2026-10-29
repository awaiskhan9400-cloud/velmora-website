# Velmora shared catalogue integration checks

## Existing live-state audit (read-only)
- Product rows: 43 total; all 43 currently published; none missing a primary image.
- `catalog_migrated` is `true`, so the website uses the Supabase catalogue rather than merging its seed catalogue.
- RLS policies allow public reads only for published products and restrict product writes to users in `velmora_admins`.
- The `velmora-products` Storage bucket exists and is public for image delivery; upload/update/delete policies are restricted to approved admins.

## Manual acceptance test after installing dependencies / running the app
1. Sign in with the existing approved admin account in the app and in `admin.html`.
2. Create a test product with a unique name, a PKR price, a category, a variant and a test image. Publish it.
3. Confirm it appears in both the app catalogue and website after the realtime event or within 45 seconds.
4. Edit its title and price in the website admin; confirm the app updates.
5. Hide it in the app; confirm it disappears from the public website and shop view but remains visible in admin.
6. Delete only the test product; confirm it disappears from both admin lists.
7. Sign in with a non-admin account and confirm product write operations are denied by RLS.
8. Remove the test image from Storage only if it was uploaded solely for this test.

## Safety
- No existing product rows were changed by this integration branch.
- Realtime publication migration only adds `velmora_products` to `supabase_realtime`; it does not modify catalogue data.
- Never include a Supabase secret/service-role key in mobile or browser code.
