# Cupcakes 🧁

A weekly cupcake shop for a home baker in Wellington. Each week a new batch goes up on the front
page; customers pick a flavour, a quantity and a pickup time, and get an emailed receipt. The
baker changes next week's cupcake from a password-protected admin page — no code, no redeploy.

![Cupcakes](public/Cupcake.jpg)

## ➡️ [Try it live: cupcakes-wellington.netlify.app](https://cupcakes-wellington.netlify.app/)

No sign-up, nothing to install — open it and order a cupcake.

## What it does

- **This week's special, front and centre.** The cupcake name, blurb, price and flavour options
  all come from a single JSON file, so the featured bake changes without touching the code.
- **Ordering in two steps.** Choose a flavour and quantity, add your details and pick a time on a
  scrolling time wheel, then check a full receipt before you confirm.
- **A receipt in your inbox.** Confirming sends a confirmation email with the order reference,
  flavour, quantity, total and pickup time.
- **An admin page at `/admin`.** Log in with a password, then add, edit or delete the week's
  cupcakes as a draft and publish when it's ready.
- **Publishing without a database.** The admin page commits the new cupcake list straight back to
  the repo through the GitHub Contents API, which triggers a redeploy.
- **Storefronts keep themselves current.** Open pages re-fetch the list every 60 seconds, so a
  published change appears without anyone hitting reload.

## How it works

**The cupcake list is a JSON file, not a database.** `public/data/weekly-cupcakes.json` holds an
array of cupcakes (`id`, `name`, `blurb`, `price`, `flavorOptions`). The storefront fetches it
from `/data/weekly-cupcakes.json` with a cache-busting query string, falls back to a hardcoded
default if that fails, and re-polls every 60 seconds
([src/hooks/use-weekly-cupcakes.ts](src/hooks/use-weekly-cupcakes.ts)). For one row of data a
week, a file in the repo beats a database: nothing to host, easy to eyeball, versioned in git.

**Publishing edits the repo.** The admin page sends its draft to a server route that commits the
file through the GitHub Contents API ([src/lib/admin-github.ts](src/lib/admin-github.ts)). It
re-reads the file's SHA before every write and retries once on a `409`, so two people publishing
at the same time can't silently overwrite each other. The tradeoff is a redeploy delay — the
change is live once Netlify rebuilds, not the instant you click publish.

**Auth is one password and a signed cookie.** There's one baker, so there are no user accounts. A
correct password mints an HMAC-SHA256 signed cookie carrying an issue and expiry time, good for
8 hours; both the password and the cookie signature are compared with `timingSafeEqual` over
hashes ([src/lib/admin-session.ts](src/lib/admin-session.ts)). No user table, no session store.

**Order emails go straight from the browser.** Confirming an order calls EmailJS from the client,
so the ordering flow needs no backend of its own and the storefront could be served as pure
static files. Order references (`VC-12345-AB1C`) are generated client-side for the receipt.

**Everything is validated by one validator.** [src/lib/cupcakes.ts](src/lib/cupcakes.ts) checks
names, IDs, prices and flavour lists in the admin form, again before publishing, and again after
loading — so a bad edit can't reach the storefront from any direction.

## Deployment

The site runs on [Netlify](https://cupcakes-wellington.netlify.app/), which rebuilds on every
push to `master` using the default Next.js settings. Three secrets live in **Site configuration →
Environment variables**: `CUPCAKES_ADMIN_PASSWORD` and `CUPCAKES_ADMIN_SESSION_SECRET` for the
admin login, and `GITHUB_CUPCAKES_TOKEN` for committing the cupcake list. Publishing from
`/admin` is a two-hop deploy: the admin page commits the JSON to GitHub, GitHub notifies
Netlify, Netlify rebuilds.

## Current status

The storefront and ordering flow are live and working. The `/api/admin/*` route handlers were
removed in the most recent commit, while order confirmations were being moved over to EmailJS —
so **publishing from `/admin` is currently broken**: the login page renders, but its calls to
`/api/admin/session` and `/api/admin/login` return 404 in production. The server-side pieces they
relied on (`src/lib/admin-session.ts`, `src/lib/admin-github.ts`) are still in the repo, so
restoring it means re-adding four small route handlers under `src/app/api/admin/`. Until then,
the week's cupcakes change by editing `public/data/weekly-cupcakes.json` and pushing.

## Built with

[Next.js 16](https://nextjs.org) (App Router) · [React 19](https://react.dev) ·
[Tailwind CSS v4](https://tailwindcss.com) · [Base UI](https://base-ui.com) with
[shadcn/ui](https://ui.shadcn.com)-style components · [lucide](https://lucide.dev) icons ·
[GSAP](https://gsap.com) and [Motion](https://motion.dev) for animation ·
[EmailJS](https://www.emailjs.com) for order confirmations · hosted on
[Netlify](https://netlify.com).
