# Velmora Mobile App

Expo / React Native Android-first app for the existing Velmora Supabase catalogue.

## Current MVP
- Reads published products from the same `public.velmora_products` table used by the website.
- Approved administrator sign-in through Supabase Auth and `public.velmora_admins`.
- Add, edit, publish/unpublish and delete products.
- Manage product title, PKR price, category, variants, description and multiple photos.
- Uploads photos to the existing public `velmora-products` Supabase Storage bucket.
- No separate product database is created.

## Run locally
Install Node.js 20 or newer, then from this folder run:

```bash
npm install
npx expo start
```

Open Expo Go on an Android phone and scan the QR code. For a store-ready Android build, configure an Expo EAS project and build an Android App Bundle.

## Security
The app uses only the Supabase publishable key. Admin writes are expected to be enforced by the database's existing row-level security policies and approved-admin records. Never put a Supabase service-role/secret key in this app.

## Current limitations / next steps
This is the product catalogue and product-management MVP. Customer cart, order submission, payment gateway, order tracking, app icon/splash polish, build configuration and device testing are still required before a production store release. Website updates are visible when the website reloads its shared catalogue; real-time push updates can be added later.
