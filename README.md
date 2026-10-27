# Portfolio

Astro portfolio site for Abdullah Farhat.

## Run locally

```bash
cd C:/Users/farhat/Desktop/Projects/portfolio
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Structure

- `src/pages/index.astro`: recruiter-first homepage
- `src/pages/about.astro`: background page and portrait
- `src/components/SiteHeader.astro`: shared sticky navigation
- `public/portrait.jpg`: public portrait asset
- `src/styles/global.css`: visual system and responsive styling

## Resume links

The site is hosted on Vercel. Most pages are static; the resume routes run
on demand through `@astrojs/vercel`.

| Route | What it does |
|---|---|
| `/admin` | Password-protected list of uploaded resumes: upload, copy link, replace, make main, delete |
| `/r/<id>` | Serves one uploaded resume. The id is random, so links cannot be guessed |
| `/resume`, `/resume.pdf` | Serves the resume marked Main. Falls back to `public/resume-default.pdf` |

The PDFs are not in this repo (it is public). They live in a **private**
Vercel Blob store and are only reachable through the routes above.

- `resumes/<id>/<version>-<label>.pdf`: one file per resume. Replacing a
  resume writes a new version and deletes the old one, so the link stays the
  same and never serves a stale copy.
- `main/<id>.txt`: marks which resume `/resume` serves.

Code: `src/lib/storage.ts` (Blob in production, `.resumes/` folder locally),
`src/lib/resumes.ts`, `src/lib/auth.ts`, `src/pages/admin/index.astro`.

### Setup on Vercel (once)

1. Project → Storage → Create → Blob, access **Private**, and connect it to
   this project. That adds `BLOB_READ_WRITE_TOKEN`.
2. Project → Settings → Environment Variables → add `ADMIN_PASSWORD`
   (12+ characters) for Production and Preview.
3. Redeploy.

### Local

```bash
ADMIN_PASSWORD=some-long-password npm run dev
```

Without `BLOB_READ_WRITE_TOKEN`, uploads go to `.resumes/` (gitignored).
