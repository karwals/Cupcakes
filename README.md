# Cupcakes

This is a Next.js cupcake ordering site with a weekly cupcake section that can be updated from an admin page.

## Features

- Public cupcake site
- Admin page
- Netlify-hosted Next.js server routes for admin login and publishing
- Admin changes publish to `public/data/weekly-cupcakes.json` through the GitHub Contents API
- Public cupcake data loads from `/data/weekly-cupcakes.json`

## Required Netlify environment variables

- `GITHUB_CUPCAKES_TOKEN`
- `CUPCAKES_ADMIN_PASSWORD`
- `CUPCAKES_ADMIN_SESSION_SECRET`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
