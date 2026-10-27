# Prime Acre Capital — seller lead site

Website for **Prime Acre Capital LLC**, cash home buyers in Arizona, Florida, Tennessee,
North Carolina and nationwide. Built to work like the top cash-home-buyer sites: a short
address-and-phone form on the first screen of every page, a fuller form at the bottom
(address, then contact details, which sends the request, then optional property details),
a page for every common seller question, and city and state pages built on local facts.
Every form delivers to the inbox set in `site/config.js`.

```
site/                          the deployable website (point any static host at this folder)
  index.html                   home page
  how-it-works.html, about.html, faq.html, contact.html            company pages
  how-we-calculate-your-offer.html, compare.html,
  how-to-vet-a-cash-home-buyer.html                                 guides for sellers
  sell-inherited-house.html, sell-house-facing-foreclosure.html,
  sell-house-with-tenants.html, sell-house-as-is.html,
  sell-house-situations.html                                        situation pages
  arizona.html, florida.html, tennessee.html, north-carolina.html   state pages
  sell-my-house-fast-<city>-<st>.html                               16 city pages
  es.html, privacidad.html     Spanish landing page and privacy policy
  privacy.html                 privacy policy (required for Google / Meta lead ads)
  config.js                    YOUR SETTINGS: phone, email, lead endpoint, site URL
  assets/style.css, assets/app.js, assets/chat.css, assets/chat.js
  assets/fonts/                self-hosted brand fonts (SIL Open Font License)
  assets/img/                  logo images; add hero.jpg and the hero uses it
  sitemap.xml, robots.txt
tools/build.py                 generates every HTML page
tools/content/*.json           researched, sourced page content (state rules, city facts, guides)
tools/content_check.py         checks that content before it's built
tools/logo_assets.py           cuts the logo images from brand/prime-acre-capital-logo.webp
.github/workflows/pages.yml    checks the content and the build, then deploys site/ to GitHub Pages
```

## Lead delivery (already wired)

`site/config.js` points the forms at FormSubmit using brsmith6758@gmail.com.
**The very first submission sends an activation email to that inbox. Click the link
once.** Every lead after that arrives by email with the property, phone, email and
details the seller entered. No account needed.

Prefer something else? Put a Formspree URL (`https://formspree.io/f/XXXXXXXX`), a
Zapier/Make webhook or your CRM's JSON endpoint in `leadEndpoint`.

## Deployment (live)

The site is served by GitHub Pages from the `gh-pages` branch at
**https://primeacrehomebuyers.com/** (DNS on Cloudflare, registered at Porkbun).
The old address https://brsmith6758-collab.github.io/Claude-bot-/ redirects there.

Every push to `main` or to this branch that touches `site/` republishes it
automatically (`.github/workflows/pages.yml` copies `site/` to `gh-pages`).
Nothing in the repository settings needs to change.

## Settings in `site/config.js`

| Setting | What it does |
| --- | --- |
| `phone`, `email` | Shown everywhere on the site and in the search-engine data. Rebuild after changing. |
| `leadEndpoint` | Where form submissions go (FormSubmit by default). |
| `smsText` | Pre-filled message when a seller taps "Text us". |
| `googleReviewsUrl` | Paste your Google Business Profile review link and a "Read our Google reviews" link appears. |
| `ga4MeasurementId` | Google Analytics 4. Leads fire a `generate_lead` event; calls and texts fire `click_to_call` / `click_to_text`. |
| `googleAdsConversion` | Google Ads lead conversion label. Fires on every submitted lead. |
| `metaPixelId` | Meta pixel. Fires PageView and Lead. |

Photos: add `site/assets/img/hero.jpg` for a photo hero and `site/assets/img/team.jpg`
for a real photo in the "who you're dealing with" section, then rebuild.

Spanish: `es.html` is a full Spanish landing page, linked from the top bar.

## Connecting your own domain (10 minutes)

1. **Buy the domain.** Cheapest reliable registrars: Porkbun (porkbun.com) or
   Cloudflare Registrar (cloudflare.com). A `.com` runs about $10 to $12 a year.
   Register it under your own account so you own it, not a developer.
2. **Point it at the site.** In the registrar's DNS panel add:

   | Type | Host | Value |
   | --- | --- | --- |
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | brsmith6758-collab.github.io |

   Delete any parking A record or URL-forwarding rule the registrar added.
   On Cloudflare set the records to "DNS only" (grey cloud).
3. **Tell the site its name:**

   ```
   python3 tools/domain.py yourdomain.com
   git add -A && git commit -m "Connect yourdomain.com" && git push
   ```

   The script writes `site/CNAME`, updates `siteUrl`, and rebuilds every page so
   search engines see the real domain. GitHub issues the HTTPS certificate on its
   own once the DNS records resolve; then tick **Enforce HTTPS** under
   Settings → Pages. `www.yourdomain.com` redirects to the bare domain automatically.

## Chat assistant (on every page)

A chat bubble in the corner of every page answers seller questions, collects the property
details and books a call into an open time slot, in English or Spanish. It works right away in a
guided mode; deploy the small Cloudflare Worker in `worker/` and it becomes a full AI assistant
(Claude). Setup, costs and settings: **[worker/README.md](worker/README.md)**.

## Getting found on Google (what actually moves the needle)

A brand-new site does not rank #1 for "sell my house fast Phoenix" overnight. Those
results are held by national buyers with years of links and reviews. This is the
order that works:

1. **Buy a real domain** (e.g. `primeacrecapital.com`). Add `site/CNAME` containing
   the domain, point DNS at GitHub Pages, set `siteUrl` in `config.js`, rebuild.
   A github.io sub-path will not rank for competitive terms.
2. **Google Business Profile** at business.google.com. Use the exact name
   "Prime Acre Capital LLC", the phone number and the website. This is what puts
   you in the map pack, where most "we buy houses near me" clicks go.
3. **Google Search Console**: add the domain, submit `sitemap.xml`. Indexing then
   takes days instead of weeks.
4. **Google Ads** (search campaigns on "sell my house fast [city]", "cash home
   buyers [city]", "we buy houses [city]") are the only way to be at the top of
   the page in week one. The city pages in this repo are built as landing pages for
   exactly those campaigns.
5. **Reviews.** Ask every closed seller for a Google review: the same link for
   everyone, no incentives, no filtering. Paste real quotes (with written permission)
   into `TESTIMONIALS` in `tools/build.py`. The site renders the section only when
   real quotes exist.
6. **Facebook / Instagram lead ads** aimed at homeowners in your target counties
   convert well for this business; the privacy page is already in place for them.

## Editing

- **Short copy, page structure, cities and the home-page FAQ** live in `tools/build.py`.
- **Long-form content** (state rules with statute citations, city fact sheets, the guides and
  situation pages) lives in `tools/content/*.json`. Every legal or local fact has a source link
  and a checked date; re-check them at least once a year. The company pages (How it works, About,
  FAQ, Contact) live there too, as `page_<slug>.json`. A page shows up in the menus, footer and
  sitemap as soon as its file exists, and links to pages that don't exist yet render as plain text.
- After any change: `python3 tools/content_check.py && python3 tools/build.py`, then commit.
  The build stops if any page makes a claim the site must never make (guarantees, "#1",
  invented counts or reviews, partner-matching promises; see `BANNED_LIVE` in `tools/build.py`),
  and the publish workflow refuses to deploy if `site/` doesn't match the build.
- **Facts a seller can check about you** show up on the About page once you fill them in
  `tools/build.py`: `OWNER` (your name, title, photo), `ENTITY` (state of registration and filing
  number), `MAILING_ADDRESS` and `BBB_URL`. Leave a field empty until it's real.
- **Consent wording**: if you change the call/text consent text on the forms, bump
  `CONSENT_VERSION` in `tools/build.py`. Each lead records the exact wording and version the
  seller saw.
