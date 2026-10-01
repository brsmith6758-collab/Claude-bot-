# Prime Acre Capital — seller lead site

Website for **Prime Acre Capital LLC**, cash home buyers in Arizona, Florida, Tennessee,
North Carolina and nationwide. Built to turn visitors into seller leads: a short
address-phone-email form sits in the hero of every page and a fuller three-step form
sits at the bottom. Both deliver to the inbox set in `site/config.js`.

```
site/                          the deployable website (point any static host at this folder)
  index.html                   home page
  arizona.html, florida.html, tennessee.html, north-carolina.html   state pages
  sell-my-house-fast-<city>-<st>.html                               16 city pages
  privacy.html                 privacy policy (required for Google / Meta lead ads)
  config.js                    YOUR SETTINGS: phone, email, lead endpoint, site URL
  assets/style.css, assets/app.js
  assets/img/hero.jpg          (optional) add a real photo and the hero uses it
  sitemap.xml, robots.txt
tools/build.py                 generates every HTML page from the copy in this file
.github/workflows/pages.yml    deploys site/ to GitHub Pages
```

## Lead delivery (already wired)

`site/config.js` points the forms at FormSubmit using brsmith6758@gmail.com.
**The very first submission sends an activation email to that inbox. Click the link
once.** Every lead after that arrives by email with the property, phone, email and
details the seller entered. No account needed.

Prefer something else? Put a Formspree URL (`https://formspree.io/f/XXXXXXXX`), a
Zapier/Make webhook or your CRM's JSON endpoint in `leadEndpoint`.

## Deploy to GitHub Pages (one click, then a merge)

1. **Settings → Pages → Build and deployment → Source: "GitHub Actions"**
   (https://github.com/brsmith6758-collab/Claude-bot-/settings/pages).
   The workflow cannot flip this switch itself; GitHub only lets a repo admin do it.
2. Merge this branch into `main`. Every later push to `main` that touches `site/`
   redeploys automatically.
3. The site appears at `https://brsmith6758-collab.github.io/Claude-bot-/`.

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
5. **Reviews.** Ask every closed seller for a Google review, then paste real quotes
   into `TESTIMONIALS` in `tools/build.py`. The site renders the section only when
   real quotes exist.
6. **Facebook / Instagram lead ads** aimed at homeowners in your target counties
   convert well for this business; the privacy page is already in place for them.

## Editing

All wording, cities, neighborhoods and FAQ answers live in `tools/build.py`. Edit,
run `python3 tools/build.py`, commit. Adding a city is one line in `CITIES`.
