# Prime Acre Capital — seller lead site

Static website for **Prime Acre Capital LLC**: cash home buyers in Arizona, Florida,
Tennessee, North Carolina and nationwide. Built to turn visitors into seller leads:
an address search at the top of every page feeds a three-step cash-offer form.

```
site/                  the deployable website (point any static host at this folder)
  index.html           home page
  arizona.html         state landing pages (also florida, tennessee, north-carolina)
  privacy.html         privacy policy (needed for Google/Meta lead ads)
  config.js            YOUR SETTINGS: phone, email, lead endpoint, site URL
  assets/style.css     styles
  assets/app.js        address search, multi-step form, lead delivery
  sitemap.xml, robots.txt
tools/build.py         generates the HTML pages from the copy in this file
.github/workflows/pages.yml   deploys site/ to GitHub Pages
```

## 1. Put in your contact details and lead delivery (2 minutes)

Edit `site/config.js`:

| Setting | What to put |
| --- | --- |
| `phone` | The number sellers should call or text. Shows in the header, offer section and footer. |
| `email` | Business email. Shows in the offer section and footer. |
| `leadEndpoint` | Where form submissions go. See below. |
| `siteUrl` | The public address of the site, with a trailing slash. |

**Lead delivery options** (pick one, paste the URL into `leadEndpoint`):

- **FormSubmit (no account):** `https://formsubmit.co/ajax/you@yourdomain.com`.
  The first submission emails you an activation link. Click it once and every lead
  after that lands in your inbox.
- **Formspree:** create a form at formspree.io and use `https://formspree.io/f/XXXXXXXX`.
- Any CRM or Zapier/Make webhook that accepts a JSON POST also works.

Until an endpoint is set, the form shows the seller their details with a copy
button and asks them to text or email you.

## 2. Deploy to GitHub Pages

1. Merge this branch into `main`.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**
   (the workflow also tries to enable this itself on its first run).
3. Every push to `main` that touches `site/` redeploys. The site appears at
   `https://brsmith6758-collab.github.io/Claude-bot-/`.

**Custom domain** (recommended, e.g. `primeacrecapital.com`): add a file
`site/CNAME` containing the domain, point the domain's DNS at GitHub Pages
(an `A`/`ALIAS` record to GitHub's Pages IPs or a `CNAME` to
`brsmith6758-collab.github.io`), then update `siteUrl` in `config.js` and rebuild.

## 3. Editing copy

All wording, the city lists, FAQ answers and state-specific sections live in
`tools/build.py`. Change them there and run:

```
python3 tools/build.py
```

This rewrites every page in `site/`. Commit the result.

## What the form captures

Address, city, state, ZIP, property type, beds, baths, condition, occupancy,
timeline, reason for selling, asking price, name, phone, email, notes, SMS
consent, the page it came from and a timestamp. Spam is filtered with a hidden
honeypot field.
