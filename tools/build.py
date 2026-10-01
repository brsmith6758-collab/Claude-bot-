#!/usr/bin/env python3
"""Build the Prime Acre Capital site.

    python3 tools/build.py              # writes site/*.html, sitemap.xml, robots.txt
    python3 tools/build.py --artifact OUT.html
                                        # single-file build of the home page with CSS,
                                        # config and JS inlined (for a hosted preview)

All copy and page data live in this file; styles in site/assets/style.css and
behavior in site/assets/app.js. Edit, re-run, commit.
"""
import argparse
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")

BRAND = "Prime Acre Capital"
LEGAL_NAME = "Prime Acre Capital LLC"


def site_url():
    with open(os.path.join(SITE, "config.js"), encoding="utf-8") as f:
        m = re.search(r'siteUrl:\s*"([^"]+)"', f.read())
    url = m.group(1) if m else "https://example.com/"
    return url if url.endswith("/") else url + "/"


SITE_URL = site_url()

FONTS = ("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800"
         "&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap")

FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 34'%3E"
           "%3Crect width='34' height='34' rx='6' fill='%2316302A'/%3E"
           "%3Cpath d='M8 17h18M17 8v18' stroke='%23EEF3EF' stroke-width='1.5' opacity='.6'/%3E"
           "%3Crect x='17' y='8' width='9' height='9' fill='%23B9841F'/%3E%3C/svg%3E")

US_STATES = [
    ("AL", "Alabama"), ("AK", "Alaska"), ("AZ", "Arizona"), ("AR", "Arkansas"), ("CA", "California"),
    ("CO", "Colorado"), ("CT", "Connecticut"), ("DE", "Delaware"), ("DC", "District of Columbia"),
    ("FL", "Florida"), ("GA", "Georgia"), ("HI", "Hawaii"), ("ID", "Idaho"), ("IL", "Illinois"),
    ("IN", "Indiana"), ("IA", "Iowa"), ("KS", "Kansas"), ("KY", "Kentucky"), ("LA", "Louisiana"),
    ("ME", "Maine"), ("MD", "Maryland"), ("MA", "Massachusetts"), ("MI", "Michigan"), ("MN", "Minnesota"),
    ("MS", "Mississippi"), ("MO", "Missouri"), ("MT", "Montana"), ("NE", "Nebraska"), ("NV", "Nevada"),
    ("NH", "New Hampshire"), ("NJ", "New Jersey"), ("NM", "New Mexico"), ("NY", "New York"),
    ("NC", "North Carolina"), ("ND", "North Dakota"), ("OH", "Ohio"), ("OK", "Oklahoma"), ("OR", "Oregon"),
    ("PA", "Pennsylvania"), ("RI", "Rhode Island"), ("SC", "South Carolina"), ("SD", "South Dakota"),
    ("TN", "Tennessee"), ("TX", "Texas"), ("UT", "Utah"), ("VT", "Vermont"), ("VA", "Virginia"),
    ("WA", "Washington"), ("WV", "West Virginia"), ("WI", "Wisconsin"), ("WY", "Wyoming"),
]

MARKETS = [
    {
        "abbr": "AZ", "name": "Arizona", "slug": "arizona",
        "short": "Phoenix, Tucson and the towns between.",
        "lede": "From Phoenix and Tucson to the smaller towns between them, we buy Arizona houses as-is for cash. Skip the repairs, the showings and the commission.",
        "cities": ["Phoenix", "Mesa", "Chandler", "Scottsdale", "Glendale", "Gilbert", "Tempe", "Peoria", "Surprise",
                   "Tucson", "Yuma", "Flagstaff", "Prescott", "Casa Grande", "Goodyear", "Buckeye", "Queen Creek", "Maricopa"],
        "counties": ["Maricopa", "Pima", "Pinal", "Yavapai", "Yuma", "Coconino", "Mohave"],
        "points": [
            ("Sun-worn roofs and tired HVAC",
             "Arizona heat is hard on roofs, air conditioners and pool equipment. We buy with all of it as-is, so you never pay for a replacement just to sell."),
            ("Out-of-state owners and inherited homes",
             "Managing a Phoenix or Tucson property from another state is a job. We handle the sale with you remotely, and the title company can close you wherever you live."),
            ("HOA liens, back taxes or a lender deadline",
             "We can close around HOA liens, delinquent taxes and foreclosure dates. A cash close is often the fastest way to beat the clock."),
        ],
    },
    {
        "abbr": "FL", "name": "Florida", "slug": "florida",
        "short": "Jacksonville to Miami, Gulf to Atlantic.",
        "lede": "Hurricane damage, a roof the insurer won't cover, a condo assessment, or a house you inherited from out of state. We buy Florida houses as-is for cash, on your timeline.",
        "cities": ["Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg", "Hialeah", "Port St. Lucie", "Cape Coral",
                   "Tallahassee", "Fort Lauderdale", "Pembroke Pines", "Hollywood", "Gainesville", "Lakeland", "Palm Bay",
                   "Fort Myers", "Daytona Beach", "Ocala", "Pensacola", "Sarasota"],
        "counties": ["Miami-Dade", "Broward", "Palm Beach", "Hillsborough", "Orange", "Duval", "Pinellas", "Lee", "Polk", "Brevard", "Volusia", "Pasco"],
        "points": [
            ("Storm damage and insurance headaches",
             "Older roofs and open claims make a traditional sale hard. We buy the property as it stands and sort out the repairs ourselves."),
            ("Condos and special assessments",
             "A large assessment or rising association fees can make an otherwise fine unit tough to sell. A cash buyer removes the financing hurdle."),
            ("Out-of-state heirs and probate",
             "Many Florida homes are inherited by family living elsewhere. We work with your probate attorney and close by mail or e-signature."),
        ],
    },
    {
        "abbr": "TN", "name": "Tennessee", "slug": "tennessee",
        "short": "Nashville, Memphis, Knoxville, Chattanooga.",
        "lede": "Nashville, Memphis, Knoxville, Chattanooga and the counties between. We buy Tennessee houses for cash in any condition, including older homes, rentals and family property.",
        "cities": ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville", "Murfreesboro", "Franklin", "Jackson",
                   "Johnson City", "Bartlett", "Hendersonville", "Kingsport", "Collierville", "Smyrna", "Cleveland",
                   "Brentwood", "Germantown", "Columbia"],
        "counties": ["Davidson", "Shelby", "Knox", "Hamilton", "Rutherford", "Williamson", "Montgomery", "Sumner", "Wilson", "Madison"],
        "points": [
            ("Older homes that need real work",
             "Foundations, wiring, plumbing, a roof past its life. Retail buyers walk away from inspection reports. We buy with the work still to do."),
            ("Rentals with tenants in place",
             "Done with being a landlord? We buy occupied properties and work with the lease, so you don't have to wait for a vacancy."),
            ("Family land and inherited property",
             "Multiple heirs, a house that has sat empty, or acreage nobody has time to manage. We make one clean offer for the whole property."),
        ],
    },
    {
        "abbr": "NC", "name": "North Carolina", "slug": "north-carolina",
        "short": "Charlotte, the Triangle, the Triad and the coast.",
        "lede": "Charlotte, the Triangle, the Triad, the coast and the mountains. We buy North Carolina houses as-is for cash, so you can move on your schedule.",
        "cities": ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Fayetteville", "Cary", "Wilmington",
                   "High Point", "Concord", "Greenville", "Asheville", "Gastonia", "Jacksonville", "Apex", "Huntersville",
                   "Chapel Hill", "Rocky Mount", "Burlington", "Wilson"],
        "counties": ["Mecklenburg", "Wake", "Guilford", "Forsyth", "Cumberland", "Durham", "Buncombe", "New Hanover", "Union", "Gaston", "Cabarrus", "Johnston"],
        "points": [
            ("Relocating on a deadline",
             "A new job in another city doesn't wait for a 90-day listing. We can close in as little as 7 days, and can often arrange extra time after closing if you need it."),
            ("Inherited homes and family land",
             "A parent's house in another county, or acreage split among siblings. We buy the whole property and handle the paperwork with your attorney."),
            ("Storm damage, mold and deferred repairs",
             "From coastal flooding to a roof that leaked all winter, we buy houses that other buyers can't get financed."),
        ],
    },
]

ICON = {
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "doc": '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    "key": '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l2 2M14 9l2 2"/>',
    "users": '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6M15 20c0-2.5 1-4.5 3-5.5 2 .5 3 2.5 3 5.5"/>',
    "arrow": '<path d="M4 12h14M13 6l6 6-6 6"/>',
    "tool": '<path d="M14 4l6 6-9 9-6-6z"/><path d="M4 20l3-3M15 5l4 4"/>',
    "dollar": '<path d="M12 3v18M16 7h-6a3 3 0 000 6h4a3 3 0 010 6H7"/>',
    "house": '<path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z"/>',
    "check": '<path d="M5 12l5 5 9-10"/>',
    "check-circle": '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
    "calendar": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    "shield": '<path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
}

# Real seller quotes only. Leave empty and the section is not rendered.
# Example: {"quote": "They closed in nine days and I didn't fix a thing.", "name": "D. Alvarez", "where": "Mesa, AZ"}
TESTIMONIALS = []


def icon(name, cls=""):
    c = ' class="%s"' % cls if cls else ""
    return ('<svg%s viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % (c, ICON[name]))


def esc(s):
    return html.escape(s, quote=True)


BRAND_MARK = ('<svg class="brand-mark" viewBox="0 0 34 34" fill="none" aria-hidden="true">'
              '<rect x="2" y="2" width="30" height="30" rx="5" stroke="currentColor" stroke-width="2"/>'
              '<path d="M2 17h30M17 2v30" stroke="currentColor" stroke-width="1.5" opacity=".55"/>'
              '<rect x="17" y="2" width="15" height="15" fill="var(--accent)"/></svg>')

# ---------------------------------------------------------------- partials


def head(title, desc, path, jsonld):
    url = SITE_URL + ("" if path == "index.html" else path)
    return """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>%(title)s</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(url)s">
<meta property="og:type" content="website">
<meta property="og:site_name" content="%(brand)s">
<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(url)s">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#16302A">
<link rel="icon" href="%(favicon)s">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="%(fonts)s">
<link rel="stylesheet" href="assets/style.css">
<script type="application/ld+json">%(jsonld)s</script>
</head>
<body>
""" % dict(title=esc(title), desc=esc(desc), url=esc(url), brand=esc(BRAND), favicon=FAVICON,
           fonts=esc(FONTS), jsonld=json.dumps(jsonld, ensure_ascii=False))


def header():
    return """<a class="sr-only" href="#offer">Skip to the cash offer form</a>
<header class="site-header" id="top">
  <div class="wrap">
    <a class="brand" href="index.html" aria-label="%(brand)s home">
      %(mark)s
      <span>%(brand)s<small>Cash home buyers</small></span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
    <nav class="nav" id="nav" aria-label="Main">
      <a href="index.html#how">How it works</a>
      <a href="index.html#markets">Where we buy</a>
      <a href="index.html#faq">FAQ</a>
      <a class="phone" data-phone hidden href="#offer"></a>
      <a class="btn btn-accent" href="#offer">Get my cash offer</a>
    </nav>
  </div>
</header>
""" % dict(brand=esc(BRAND), mark=BRAND_MARK)


def search_form(input_id, label="Property address", placeholder="Enter your property address"):
    return """<div class="search-wrap">
        <span class="search-step">Step 1 of 3 · Your address</span>
        <form class="search" role="search" aria-label="Start your cash offer">
          <label class="sr-only" for="%s">%s</label>
          <input id="%s" type="text" name="address" placeholder="%s" autocomplete="street-address" required>
          <button class="btn btn-accent" type="submit">Get my cash offer</button>
        </form>
      </div>""" % (input_id, esc(label), input_id, esc(placeholder))


def sheet(property_label="Your address"):
    return """<aside class="sheet" aria-label="What a cash offer from us includes">
      <span class="stamp">As-is · Cash</span>
      <div class="sheet-head"><span>Offer worksheet</span><span>%(brand)s</span></div>
      <div class="sheet-row"><span>Property</span><span>%(prop)s</span></div>
      <div class="sheet-row"><span>Condition</span><span>Any, as-is</span></div>
      <div class="sheet-row"><span>Repairs you pay for</span><span>$0</span></div>
      <div class="sheet-row"><span>Agent commission</span><span>$0</span></div>
      <div class="sheet-row"><span>Closing costs</span><span>We pay</span></div>
      <div class="sheet-row"><span>Closing date</span><span>You choose</span></div>
      <div class="sheet-total"><span>Cash offer</span><span>Within 24 hrs</span></div>
    </aside>""" % dict(brand=esc(BRAND), prop=esc(property_label))


def hero_index():
    return """<section class="hero">
  <div class="wrap">
    <div>
      <p class="eyebrow">Cash home buyers · Arizona · Florida · Tennessee · North Carolina · Nationwide</p>
      <h1>Sell your house as-is. Get a <span class="hl">fair cash offer</span> in 24 hours.</h1>
      <p class="lede">No repairs, no showings, no agent fees, and no waiting on a buyer's bank. Close in as little as 7 days, or on the date you choose.</p>
      %(search)s
      <p class="hero-sub"><b>Free and no obligation.</b> Takes about 60 seconds. Your information is never sold.</p>
    </div>
    %(sheet)s
  </div>
</section>
""" % dict(search=search_form("hero-address"), sheet=sheet())


def hero_state(m):
    return """<section class="hero">
  <div class="wrap">
    <div>
      <p class="eyebrow">Cash home buyers in %(name)s</p>
      <h1>Sell your %(name)s house as-is for a <span class="hl">fair cash offer</span>.</h1>
      <p class="lede">%(lede)s</p>
      %(search)s
      <p class="hero-sub"><b>Free and no obligation.</b> Written offer within 24 hours. Close in as little as 7 days.</p>
    </div>
    %(sheet)s
  </div>
</section>
""" % dict(name=esc(m["name"]), lede=esc(m["lede"]),
           search=search_form("hero-address", placeholder="Enter your %s property address" % m["name"]),
           sheet=sheet("Anywhere in %s" % m["name"]))


def trustbar():
    items = [
        ("clock", "Offer in 24 hours", "In writing, with the math behind it"),
        ("dollar", "$0 fees or commissions", "We pay the closing costs too"),
        ("calendar", "Close in 7 days", "Or pick any date that suits you"),
        ("house", "Any condition", "Repairs, tenants, liens: we handle it"),
    ]
    cards = "".join("""
    <div class="trust">%s<div><b>%s</b><span>%s</span></div></div>""" % (icon(k), esc(t), esc(d)) for k, t, d in items)
    return """<div class="trustbar" aria-label="What you get">
  <div class="wrap">%s
  </div>
</div>
""" % cards


def strip_state(m):
    chips = "".join('<span class="chip">%s County</span>' % esc(c) for c in m["counties"])
    return """<div class="strip">
  <div class="wrap">
    <span>Buying across %s</span>
    <div class="states">%s</div>
  </div>
</div>
""" % (esc(m["name"]), chips)


def how():
    steps = [
        ("Today", "Tell us about the house", "Sixty seconds online, or one phone call. No cleaning up first, no paperwork to dig out.", False),
        ("Within 24 hours", "Get your written cash offer", "A real number with the math behind it: nearby sales, the repairs we'd take on, and what you walk away with.", False),
        ("Day 2 to 3", "A quick walkthrough", "One short visit, or photos from your phone. Nothing to stage, nothing to fix.", False),
        ("Day 7, or your date", "Sign and get paid", "Close at a licensed title company or attorney's office. Funds are wired to you at closing.", True),
    ]
    cards = "".join("""
    <div class="tl%s">
      <span class="day">%s</span>
      <h3>%s</h3>
      <p>%s</p>
    </div>""" % (" final" if final else "", esc(d), esc(t), esc(b)) for d, t, b, final in steps)
    return """<section class="section" id="how">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">How it works</p>
      <h2>Your next seven days, if you want them to be.</h2>
      <p>No listing, no lender, no waiting on someone else's approval. You deal directly with the buyer, and you set the pace.</p>
    </div>
    <div class="timeline">%s
    </div>
  </div>
</section>
""" % cards


def situations():
    items = [
        ("clock", "Facing foreclosure",
         "Behind on payments or already have a sale date? A cash sale before the auction can pay off the lender and help you avoid a foreclosure on your record."),
        ("doc", "Inherited a house",
         "Probate, out-of-state heirs, a house full of belongings. Take what you want and leave the rest to us."),
        ("key", "Tired of being a landlord",
         "Problem tenants, late rent, constant repairs. We buy with tenants in place and honor the lease."),
        ("users", "Divorce or separation",
         "A clean, fast sale with one number everyone can agree on, and a closing date that works for both of you."),
        ("arrow", "Relocating or job change",
         "Close before you leave town, with a date that matches your move instead of a listing calendar."),
        ("tool", "Major repairs or code violations",
         "Roof, foundation, mold, fire or water damage, open permits. We buy it exactly as it is."),
        ("dollar", "Behind on taxes or liens",
         "Back taxes, HOA liens and judgments are paid off from the sale at closing. You don't bring money to the table."),
        ("house", "Vacant or unwanted property",
         "A second home, a lot, or a house that's been sitting for years. Turn it into cash without a renovation first."),
    ]
    cards = "".join("""
    <div class="sit">%s<div><h3>%s</h3><p>%s</p></div></div>""" % (icon(k), esc(t), esc(d)) for k, t, d in items)
    return """<section class="section section-alt" id="situations">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Any situation</p>
      <h2>Whatever the reason, we can work with it.</h2>
      <p>We buy houses from people in every kind of circumstance. Here are the ones we see most.</p>
    </div>
    <div class="grid-4">%s
    </div>
  </div>
</section>
""" % cards


def calculator():
    return """<section class="section calc-section" id="cost">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">What waiting costs</p>
      <h2>Every month on the market has a price. See yours.</h2>
      <p>Most sellers compare the sale price and stop there. Put in your own numbers and see what a typical listing costs before you see a dollar.</p>
    </div>
    <div class="calc" id="calc">
      <div class="calc-inputs">
        <div class="field">
          <label for="c-mortgage">Monthly mortgage payment</label>
          <span class="money-in"><input id="c-mortgage" type="text" inputmode="numeric" value="1,500" data-calc></span>
        </div>
        <div class="row-2">
          <div class="field">
            <label for="c-taxes">Taxes, insurance and HOA per month</label>
            <span class="money-in"><input id="c-taxes" type="text" inputmode="numeric" value="350" data-calc></span>
          </div>
          <div class="field">
            <label for="c-upkeep">Utilities and upkeep per month</label>
            <span class="money-in"><input id="c-upkeep" type="text" inputmode="numeric" value="250" data-calc></span>
          </div>
        </div>
        <div class="row-2">
          <div class="field">
            <label for="c-price">Likely listing price</label>
            <span class="money-in"><input id="c-price" type="text" inputmode="numeric" value="300,000" data-calc></span>
          </div>
          <div class="field">
            <label for="c-repairs">Repairs and prep before listing</label>
            <span class="money-in"><input id="c-repairs" type="text" inputmode="numeric" value="7,500" data-calc></span>
          </div>
        </div>
        <div class="field range">
          <label for="c-months">Months to list, sell and close the traditional way: <output id="c-months-out" for="c-months">4 months</output></label>
          <input id="c-months" type="range" min="1" max="12" step="1" value="4" data-calc>
          <span class="hint">Listing to closing commonly runs 3 to 5 months once showings, offers, inspections and the buyer's loan are done.</span>
        </div>
      </div>
      <div class="calc-out" aria-live="polite">
        <span class="label">Cost of listing before you see a dollar</span>
        <div class="calc-big"><span data-out="total">$0</span><small>in carrying costs, commissions, closing costs and repairs</small></div>
        <div class="calc-rows">
          <div><span>Carrying costs while listed</span><span data-out="carry">$0</span></div>
          <div><span>Agent commissions (5.5%)</span><span data-out="commission">$0</span></div>
          <div><span>Seller closing costs (1.5%)</span><span data-out="closing">$0</span></div>
          <div><span>Repairs and prep</span><span data-out="repairs">$0</span></div>
        </div>
        <div class="calc-vs">
          <div><span class="label">Listing</span><strong data-out="total2">$0</strong></div>
          <div class="us"><span class="label">Selling to us</span><strong data-out="us">$0</strong></div>
        </div>
        <p class="calc-note">Estimates based on the numbers you enter. Commission and closing-cost rates are typical national figures and vary by market. A cash offer is usually below a retail listing price. The gap is often smaller than the costs above, and you decide once you see our number.</p>
        <a class="btn btn-accent" href="#offer">Skip the wait. Get my cash offer</a>
      </div>
    </div>
  </div>
</section>
"""


def compare():
    rows = [
        ("Commissions and fees", "$0", "Typically 5–6% of the sale price"),
        ("Repairs", "None. We buy as-is.", "Usually required after inspection"),
        ("Closing costs", "We pay them", "Seller typically pays a share"),
        ("Showings and open houses", "None", "Weeks of showings and cleaning"),
        ("Time to close", "7–30 days, your choice", "60–90+ days if financing holds"),
        ("Certainty", "Cash, no financing contingency", "Deals fall through when a loan fails"),
    ]
    trs = "".join("<tr><td>%s</td><td class=\"us\"><span class=\"yes\" aria-hidden=\"true\">✓</span>%s</td><td><span class=\"no\" aria-hidden=\"true\">✕</span>%s</td></tr>" % (esc(a), esc(b), esc(c)) for a, b, c in rows)
    return """<section class="section" id="compare">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Compare</p>
      <h2>Selling to us versus listing with an agent.</h2>
      <p>A listing can get a higher price on paper. After repairs, commissions, carrying costs and months of waiting, the gap is often smaller than it looks.</p>
    </div>
    <div class="compare">
      <table>
        <thead><tr><th scope="col">What it costs you</th><th scope="col" class="us">%s</th><th scope="col">Listing with an agent</th></tr></thead>
        <tbody>%s</tbody>
      </table>
    </div>
    <p class="compare-note">Listing figures are general market ranges, not a quote for your property. Every offer we make is itemized so you can compare for yourself.</p>
  </div>
</section>
""" % (esc(BRAND), trs)


def markets():
    cards = "".join("""
    <div class="market" id="%(slug)s">
      <span class="abbr">%(abbr)s</span>
      <h3>%(name)s</h3>
      <p>%(short)s</p>
      <p class="cities">%(cities)s and more.</p>
      <a class="more" href="%(slug)s.html" data-prefill-state="%(abbr)s">Sell a house in %(name)s →</a>
    </div>""" % dict(slug=m["slug"], abbr=m["abbr"], name=esc(m["name"]), short=esc(m["short"]),
                     cities=esc(", ".join(m["cities"][:8]))) for m in MARKETS)
    return """<section class="section section-alt" id="markets">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Where we buy</p>
      <h2>Four home states. Buyers everywhere else.</h2>
      <p>We focus on Arizona, Florida, Tennessee and North Carolina, and buy nationwide through our network of local buying partners.</p>
    </div>
    <div class="grid-4">%s
      <div class="market wide">
        <div>
          <h3>Outside these states?</h3>
          <p>We still buy. Send us the address and we'll make an offer or match you with a vetted local buyer within 24 hours.</p>
        </div>
        <a class="btn btn-accent" href="#offer">Get an offer anywhere in the US</a>
      </div>
    </div>
  </div>
</section>
""" % cards


def promise():
    items = [
        ("A written offer within 24 hours", "With the math behind it, so you can check our work."),
        ("Zero fees, commissions or closing costs", "The number on the offer is the number you walk away with, minus what you owe."),
        ("We buy as-is", "Leave the broken water heater, the old furniture, the boxes in the garage."),
        ("No pressure, no obligation", "Say no and we part on good terms. We'd rather earn a referral than push a deal."),
        ("You pick the closing date", "Seven days or several months. Need time to find your next place? Take it."),
        ("Every closing runs through a licensed title company or attorney", "Your money never passes through our hands."),
    ]
    lis = "".join("<li><div><b>%s</b><span>%s</span></div></li>" % (esc(t), esc(d)) for t, d in items)
    return """<section class="section promise" id="promise">
  <div class="wrap">
    <div>
      <p class="eyebrow">Our promise to you</p>
      <h2>Six things we put in writing before you decide anything.</h2>
      <p class="lede">Selling a house to a company you found online should come with guarantees. These are ours, on every offer, in every state.</p>
      <a class="btn btn-accent btn-lg" href="#offer">Get my written offer</a>
    </div>
    <ol>%s</ol>
  </div>
</section>
""" % lis


def testimonials():
    if not TESTIMONIALS:
        return ""
    cards = "".join("""
    <figure class="quote"><p>%s</p><figcaption><cite>%s · %s</cite></figcaption></figure>""" % (
        esc(t["quote"]), esc(t["name"]), esc(t.get("where", ""))) for t in TESTIMONIALS)
    return """<section class="section" id="sellers">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">From sellers</p>
      <h2>In their words.</h2>
    </div>
    <div class="grid-3">%s
    </div>
  </div>
</section>
""" % cards


def faq(extra=None):
    items = [
        ("How do I know this is legitimate?",
         "Fair question. You never pay us anything, and your money never passes through us: every closing runs through a licensed title company or closing attorney who holds the funds and records the sale. You can have your own attorney review the contract, and you can walk away at any point before signing."),
        ("Will you lowball me?",
         "Our offer is built from real numbers that we show you: recent nearby sales, the repairs we will take on, and our costs to resell. If the number doesn't work for you, you've lost a minute and gained a free second opinion on what your house is worth as-is."),
        ("How do you decide what to offer?",
         "We look at what similar homes nearby have sold for, subtract what it will cost to repair and resell the property, and leave room for a fair margin. We walk you through the numbers, so you know exactly how we got there."),
        ("Are there any fees?",
         "No. No commissions, no service fees, and we pay standard closing costs. The offer you accept is the amount you walk away with, minus anything owed on the property such as a mortgage or liens."),
        ("What condition does the house need to be in?",
         "Any. We buy houses with fire or water damage, bad roofs, foundation issues, mold, hoarding situations and unfinished renovations. Leave behind anything you don't want to move."),
        ("How fast can you close?",
         "As little as 7 days once title is clear. If you need longer, choose the date that works for you. We close through a licensed title company or closing attorney, and you get paid at closing."),
        ("Do I have to accept the offer?",
         "No. Every offer is free and no-obligation. If a listing or another buyer would get you more, we'll tell you so."),
        ("I still have a mortgage. Can you still buy?",
         "Yes. The mortgage, along with any liens or back taxes, is paid off from the sale proceeds at closing. If you owe close to what the house is worth, we'll talk through your options honestly."),
        ("What kinds of property do you buy?",
         "Single-family homes, condos, townhouses, duplexes and small multifamily, mobile homes with land, and vacant lots. In Arizona, Florida, Tennessee, North Carolina, and nationwide through our buying partners."),
    ]
    if extra:
        items = extra + items
    ds = "".join("""
      <details><summary>%s</summary><p>%s</p></details>""" % (esc(q), esc(a)) for q, a in items)
    return """<section class="section" id="faq">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Questions</p>
      <h2>Straight answers before you decide.</h2>
    </div>
    <div class="faq">%s
    </div>
  </div>
</section>
""" % ds


def state_options(default):
    opts = ['<option value="">State</option>']
    for abbr, name in US_STATES:
        sel = ' selected' if abbr == default else ''
        opts.append('<option value="%s"%s>%s</option>' % (abbr, sel, esc(name)))
    return "".join(opts)


def offer_form(default_state=""):
    bullets = [
        "No fees, commissions or closing costs",
        "As-is purchase. Leave behind what you don't want.",
        "Close in 7 days, or pick a later date",
        "Mortgage, liens or back taxes? Paid off at closing.",
    ]
    lis = "".join("<li>%s<span>%s</span></li>" % (icon("check"), esc(b)) for b in bullets)
    return """<section class="offer section" id="offer">
  <div class="wrap">
    <div>
      <p class="eyebrow">Get your cash offer</p>
      <h2>Tell us about the property. We'll do the rest.</h2>
      <p class="lede">About 60 seconds. We review every property personally and send a written, no-obligation cash offer within 24 hours.</p>
      <ul>%(lis)s</ul>
      <div class="contact-lines" data-contact-wrap hidden>
        <span data-phone-wrap hidden>Prefer to talk? Call or text <a data-phone hidden href="#offer"></a></span>
        <span data-email-wrap hidden>Email <a data-email hidden href="#offer"></a></span>
      </div>
    </div>
    <form class="form" id="lead-form" novalidate autocomplete="on">
      <ol class="progress" aria-hidden="true"><li class="current">Property</li><li>Details</li><li>Your offer</li></ol>

      <div class="form-step" data-step="1">
        <h3>Step 1 of 3 · Where's the property?</h3>
        <div class="field">
          <label for="f-address">Street address</label>
          <input id="f-address" name="address" type="text" required autocomplete="street-address" placeholder="123 Main St">
        </div>
        <div class="row-addr">
          <div class="field">
            <label for="f-city">City</label>
            <input id="f-city" name="city" type="text" required autocomplete="address-level2">
          </div>
          <div class="field">
            <label for="f-state">State</label>
            <select id="f-state" name="state" required autocomplete="address-level1">%(states)s</select>
          </div>
          <div class="field">
            <label for="f-zip">ZIP</label>
            <input id="f-zip" name="zip" type="text" inputmode="numeric" autocomplete="postal-code" placeholder="85001">
          </div>
        </div>
        <div class="form-actions">
          <span class="form-note">Free. No obligation. About 60 seconds.</span>
          <button type="button" class="btn btn-accent" data-next>Continue →</button>
        </div>
      </div>

      <div class="form-step" data-step="2" hidden>
        <h3>Step 2 of 3 · Nice. A few quick details.</h3>
        <p class="personal" data-personal hidden>%(spark)s<span></span></p>
        <div class="row-2">
          <div class="field">
            <label for="f-type">Property type</label>
            <select id="f-type" name="propertyType" required>
              <option value="">Select</option>
              <option>Single-family house</option>
              <option>Condo or townhouse</option>
              <option>Duplex or multifamily</option>
              <option>Mobile or manufactured home</option>
              <option>Land or lot</option>
              <option>Other</option>
            </select>
          </div>
          <div class="field">
            <label for="f-condition">Condition</label>
            <select id="f-condition" name="condition" required>
              <option value="">Select</option>
              <option>Move-in ready</option>
              <option>Needs some updates</option>
              <option>Needs major repairs</option>
              <option>Not livable right now</option>
            </select>
          </div>
        </div>
        <div class="row-3">
          <div class="field">
            <label for="f-beds">Bedrooms</label>
            <select id="f-beds" name="beds">
              <option value="">–</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option>
            </select>
          </div>
          <div class="field">
            <label for="f-baths">Bathrooms</label>
            <select id="f-baths" name="baths">
              <option value="">–</option><option>1</option><option>1.5</option><option>2</option><option>2.5</option><option>3</option><option>3.5+</option>
            </select>
          </div>
          <div class="field">
            <label for="f-occupancy">Occupied by</label>
            <select id="f-occupancy" name="occupancy" required>
              <option value="">Select</option>
              <option>Me (owner)</option>
              <option>Tenants</option>
              <option>Vacant</option>
            </select>
          </div>
        </div>
        <div class="row-2">
          <div class="field">
            <label for="f-timeline">When do you want to sell?</label>
            <select id="f-timeline" name="timeline" required>
              <option value="">Select</option>
              <option>As soon as possible</option>
              <option>Within 30 days</option>
              <option>In 1 to 3 months</option>
              <option>Just exploring my options</option>
            </select>
          </div>
          <div class="field">
            <label for="f-reason">Reason for selling <span class="opt">(optional)</span></label>
            <select id="f-reason" name="reason">
              <option value="">Select</option>
              <option>Behind on payments / foreclosure</option>
              <option>Inherited the property</option>
              <option>Tired of being a landlord</option>
              <option>Divorce or separation</option>
              <option>Relocating</option>
              <option>Too many repairs</option>
              <option>Downsizing or upgrading</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="f-price">Do you have a price in mind? <span class="opt">(optional)</span></label>
          <input id="f-price" name="askingPrice" type="text" inputmode="numeric" placeholder="$">
          <span class="hint">Helps us get you a number faster. No wrong answer.</span>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-back>Back</button>
          <button type="button" class="btn btn-accent" data-next>One more step →</button>
        </div>
      </div>

      <div class="form-step" data-step="3" hidden>
        <h3>Step 3 of 3 · Last step. Where should we send your offer?</h3>
        <div class="field">
          <label for="f-name">Your name</label>
          <input id="f-name" name="name" type="text" required autocomplete="name">
        </div>
        <div class="row-2">
          <div class="field">
            <label for="f-phone">Phone</label>
            <input id="f-phone" name="phone" type="tel" required autocomplete="tel" inputmode="tel" placeholder="(555) 555-5555">
            <span class="hint">Only used to send your offer. Never sold or shared.</span>
          </div>
          <div class="field">
            <label for="f-email">Email <span class="opt">(optional)</span></label>
            <input id="f-email" name="email" type="email" autocomplete="email">
          </div>
        </div>
        <div class="field">
          <label for="f-notes">Anything else we should know? <span class="opt">(optional)</span></label>
          <textarea id="f-notes" name="notes" rows="3" placeholder="Liens, tenants, repairs, timing, anything that matters to you."></textarea>
        </div>
        <div class="hp" aria-hidden="true"><label for="f-company">Company</label><input id="f-company" name="company" type="text" tabindex="-1" autocomplete="off"></div>
        <label class="check">
          <input id="f-sms" name="smsConsent" type="checkbox" checked>
          <span>It's okay to text me about my offer. Message and data rates may apply. Reply STOP to opt out at any time.</span>
        </label>
        <p class="error-msg" data-form-error hidden></p>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-back>Back</button>
          <div class="submit-wrap">
            <button type="submit" class="btn btn-accent btn-lg">Get my cash offer</button>
            <span class="form-note">Free · No obligation · Reply within 24 hours</span>
          </div>
        </div>
        <p class="form-note">By submitting, you agree that %(legal)s may contact you about your property by phone, text or email. Consent is not a condition of any purchase. We never sell your information.</p>
      </div>

      <div class="thanks" data-result="success" hidden>
        %(okmark)s
        <h3>Got it. Your offer is on its way.</h3>
        <p>We're reviewing the property now. Here's what happens next:</p>
        <div class="next-steps">
          <div><span class="day">Within 24 hrs</span><span>We call or text with your written cash offer and the math behind it.</span></div>
          <div><span class="day">Day 2 to 3</span><span>A quick walkthrough or a few photos from your phone. Nothing to clean or fix.</span></div>
          <div><span class="day">Your date</span><span>Sign at the title company and the funds are wired to you.</span></div>
        </div>
        <div class="lines" data-contact-wrap hidden>
          <span data-phone-wrap hidden>Want it faster? Call or text <a data-phone hidden href="#offer"></a></span>
        </div>
      </div>

      <div class="thanks" data-result="fallback" hidden>
        %(okmark)s
        <h3>Almost there. Send us these details.</h3>
        <p>We couldn't deliver this automatically from this page. Copy your request and text or email it to us, and we'll reply within 24 hours.</p>
        <div class="summary"></div>
        <button type="button" class="btn btn-ghost" data-copy>Copy my request</button>
        <div class="lines">
          <span data-phone-wrap hidden>Text or call <a data-phone hidden href="#offer"></a></span>
          <span data-email-wrap hidden>Email <a data-email hidden href="#offer"></a> or <a data-mail hidden href="#offer">open a pre-filled email</a></span>
        </div>
      </div>
    </form>
  </div>
</section>
""" % dict(lis=lis, states=state_options(default_state), legal=esc(LEGAL_NAME), okmark=icon("check-circle", "mark"), spark=icon("shield"))


def footer():
    links = "".join('<li><a href="%s.html">Sell a house in %s</a></li>' % (m["slug"], esc(m["name"])) for m in MARKETS)
    return """<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="index.html">%(mark)s<span>%(brand)s<small>Cash home buyers</small></span></a>
        <p>%(legal)s buys houses directly from owners in Arizona, Florida, Tennessee and North Carolina, and nationwide through local buying partners. Fair cash offers, no fees, closing on your schedule.</p>
      </div>
      <div>
        <h4>Where we buy</h4>
        <ul>%(links)s<li><a href="index.html#markets">Nationwide</a></li></ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li data-phone-wrap hidden><a data-phone hidden href="#offer"></a></li>
          <li data-email-wrap hidden><a data-email hidden href="#offer"></a></li>
          <li><a href="#offer">Get a cash offer</a></li>
          <li><a href="index.html#faq">Questions</a></li>
          <li><a href="privacy.html">Privacy</a></li>
        </ul>
      </div>
    </div>
    <div class="legal">
      <p>© <span data-year>2026</span> %(legal)s. All rights reserved.</p>
      <p>%(legal)s is a real estate investment company that purchases property directly from owners. It is not a listing service. All offers are no-obligation. Offer and closing timelines describe typical transactions and depend on title, occupancy and local requirements. We follow federal and state Fair Housing laws.</p>
    </div>
  </div>
</footer>
<div class="sticky-cta"><a class="btn btn-accent" href="#offer">Get my cash offer</a><a class="btn btn-ghost" data-phone hidden href="#offer"></a></div>
""" % dict(mark=BRAND_MARK, brand=esc(BRAND), legal=esc(LEGAL_NAME), links=links)


def scripts():
    return """<script src="config.js"></script>
<script src="assets/app.js"></script>
</body>
</html>
"""


# ---------------------------------------------------------------- pages


def org_jsonld():
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": LEGAL_NAME,
        "url": SITE_URL,
        "description": "Cash home buyers. We buy houses as-is in Arizona, Florida, Tennessee, North Carolina and nationwide.",
        "areaServed": [{"@type": "State", "name": m["name"]} for m in MARKETS] + [{"@type": "Country", "name": "United States"}],
    }


def page_index():
    title = "Prime Acre Capital | Sell Your House Fast for Cash in AZ, FL, TN, NC and Nationwide"
    desc = ("Prime Acre Capital LLC buys houses as-is for cash in Arizona, Florida, Tennessee, North Carolina and nationwide. "
            "No fees, no repairs, no agents. Get a no-obligation cash offer within 24 hours and close in as little as 7 days.")
    body = (hero_index() + trustbar() + how() + calculator() + compare() + situations() + promise() + markets()
            + testimonials() + faq() + offer_form() + footer())
    return head(title, desc, "index.html", org_jsonld()) + header() + body + scripts()


def page_state(m):
    title = "Sell My House Fast in %s | Cash Offer in 24 Hours | %s" % (m["name"], BRAND)
    desc = ("Sell your %s house fast for cash. %s buys houses as-is in %s and across %s. "
            "No fees, no repairs, no obligation. Get a cash offer within 24 hours." % (m["name"], LEGAL_NAME, ", ".join(m["cities"][:4]), m["name"]))
    jsonld = {
        "@context": "https://schema.org",
        "@type": "Service",
        "serviceType": "Cash home buying",
        "name": "Sell your house for cash in %s" % m["name"],
        "provider": {"@type": "Organization", "name": LEGAL_NAME, "url": SITE_URL},
        "areaServed": {"@type": "State", "name": m["name"]},
        "url": SITE_URL + m["slug"] + ".html",
    }
    points = "".join("""
    <div class="step">
      <h3>%s</h3>
      <p>%s</p>
    </div>""" % (esc(t), esc(d)) for t, d in m["points"])
    why = """<section class="section" id="why">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">%(name)s</p>
      <h2>Why %(name)s homeowners sell to us.</h2>
      <p>Every market has its own reasons a house gets hard to sell the traditional way. These are the ones we solve most often in %(name)s.</p>
    </div>
    <div class="grid-3">%(points)s
    </div>
  </div>
</section>
""" % dict(name=esc(m["name"]), points=points)
    chips = "".join('<span class="chip">%s</span>' % esc(c) for c in m["cities"])
    cities = """<section class="section section-alt" id="cities">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Where we buy in %(name)s</p>
      <h2>%(cities_h)s and everywhere between.</h2>
      <p>City, suburb or county road. If it's in %(name)s, send us the address.</p>
    </div>
    <div class="states" style="display:flex;flex-wrap:wrap;gap:.5rem">%(chips)s<span class="chip">Anywhere else in %(name)s</span></div>
  </div>
</section>
""" % dict(name=esc(m["name"]), cities_h=esc(", ".join(m["cities"][:3])), chips=chips)
    extra_faq = [("Do you buy everywhere in %s?" % m["name"],
                  "Yes. We buy in %s and the surrounding counties, and in smaller towns across the state. "
                  "If we can't buy a particular property ourselves, we match you with a vetted local buyer, at no cost to you." % ", ".join(m["cities"][:5]))]
    body = (hero_state(m) + trustbar() + strip_state(m) + why + how() + calculator() + situations() + promise() + cities
            + testimonials() + faq(extra_faq) + offer_form(m["abbr"]) + footer())
    return head(title, desc, m["slug"] + ".html", jsonld) + header() + body + scripts()


def page_privacy():
    title = "Privacy Policy | %s" % BRAND
    desc = "How %s collects, uses and protects the information you share when requesting a cash offer." % LEGAL_NAME
    body = """<section class="section" id="privacy">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Privacy policy</p>
      <h2>What we collect and how we use it.</h2>
      <p>Last updated: October 2026</p>
    </div>
    <div class="faq" style="max-width:44rem">
      <details open><summary>Information we collect</summary><p>When you request a cash offer we collect the property address and details you provide, your name, phone number and email address, and anything you add in the notes. We also collect standard web analytics such as pages visited and the device used.</p></details>
      <details open><summary>How we use it</summary><p>We use your information to evaluate the property, prepare and deliver a cash offer, and communicate with you about the sale by phone, text message or email. If you have agreed to text messages, you can opt out at any time by replying STOP.</p></details>
      <details open><summary>Sharing</summary><p>We do not sell your personal information. We may share it with the title company, closing attorney or local buying partner involved in purchasing your property, and with service providers who help us run this website and deliver messages. These parties may use it only to provide those services.</p></details>
      <details open><summary>Your choices</summary><p>You can ask us to correct or delete your information, or to stop contacting you, at any time using the contact details on this site. We keep lead information only as long as needed to evaluate and complete a potential purchase and to meet legal requirements.</p></details>
      <details open><summary>Contact</summary><p>Questions about this policy can be sent to %s using the contact details in the footer of this site.</p></details>
    </div>
  </div>
</section>
""" % esc(LEGAL_NAME)
    return head(title, desc, "privacy.html", org_jsonld()) + header() + body + offer_form() + footer() + scripts()


def sitemap(paths):
    urls = "".join("  <url><loc>%s</loc></url>\n" % esc(SITE_URL + ("" if p == "index.html" else p)) for p in paths)
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % urls


# ---------------------------------------------------------------- artifact build


def artifact_build(out_path):
    """Single-file home page: no document skeleton, CSS/config/JS inlined, state links as in-page anchors."""
    doc = page_index()
    with open(os.path.join(SITE, "assets", "style.css"), encoding="utf-8") as f:
        css = f.read()
    with open(os.path.join(SITE, "config.js"), encoding="utf-8") as f:
        config = f.read()
    with open(os.path.join(SITE, "assets", "app.js"), encoding="utf-8") as f:
        app = f.read()

    body = doc.split("<body>\n", 1)[1].rsplit("<script src=\"config.js\"></script>", 1)[0]
    title = re.search(r"<title>(.*?)</title>", doc).group(1)
    jsonld = re.search(r'<script type="application/ld\+json">.*?</script>', doc, re.S).group(0)

    # In-page targets replace the separate state pages.
    for m in MARKETS:
        body = body.replace('href="%s.html"' % m["slug"], 'href="#%s"' % m["slug"])
    body = body.replace('href="index.html#', 'href="#').replace('href="index.html"', 'href="#top"')
    body = body.replace('<li><a href="privacy.html">Privacy</a></li>', '')
    body = body.replace('<a class="sr-only" href="#offer">Skip to the cash offer form</a>\n', "")

    out = ('<title>%s</title>\n<link rel="stylesheet" href="%s">\n<style>\n%s\n</style>\n%s\n%s\n<script>\n%s\n</script>\n<script>\n%s\n</script>\n'
           % (title, esc(FONTS), css, jsonld, body, config, app))
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(out)
    print("wrote %s (%d KB)" % (out_path, len(out.encode("utf-8")) // 1024))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifact", metavar="OUT", help="write a single-file build of the home page to OUT")
    args = ap.parse_args()
    if args.artifact:
        artifact_build(args.artifact)
        return

    pages = {"index.html": page_index(), "privacy.html": page_privacy()}
    for m in MARKETS:
        pages[m["slug"] + ".html"] = page_state(m)
    for name, content in pages.items():
        with open(os.path.join(SITE, name), "w", encoding="utf-8") as f:
            f.write(content)
    public = [p for p in pages if p != "privacy.html"]
    with open(os.path.join(SITE, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap(public))
    with open(os.path.join(SITE, "robots.txt"), "w", encoding="utf-8") as f:
        f.write("User-agent: *\nAllow: /\nSitemap: %ssitemap.xml\n" % SITE_URL)
    open(os.path.join(SITE, ".nojekyll"), "w").close()
    print("built: " + ", ".join(sorted(pages)) + ", sitemap.xml, robots.txt")


if __name__ == "__main__":
    sys.exit(main())
