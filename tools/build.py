#!/usr/bin/env python3
"""Build the Prime Acre Capital site.

    python3 tools/build.py              # writes site/*.html, sitemap.xml, robots.txt
    python3 tools/build.py --artifact OUT.html
                                        # single-file build of the home page with CSS,
                                        # config and JS inlined (for a hosted preview)

Page structure and short copy live in this file. The researched long-form content (state rules, city
facts, guides and situation pages) lives in tools/content/*.json; check it with tools/content_check.py.
Styles are in site/assets/style.css and behavior in site/assets/app.js. Contact details come from
site/config.js. Drop a photo at site/assets/img/hero.jpg and the hero switches to it.
"""
import argparse
import base64
import datetime
import hashlib
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")

BRAND = "Prime Acre Capital"
LEGAL_NAME = "Prime Acre Capital LLC"


def read_config():
    with open(os.path.join(SITE, "config.js"), encoding="utf-8") as f:
        src = f.read()
    def get(key, default=""):
        m = re.search(r'\b%s:\s*"([^"]*)"' % key, src)
        return m.group(1) if m else default
    url = get("siteUrl", "https://example.com/")
    return {
        "siteUrl": url if url.endswith("/") else url + "/",
        "phone": get("phone"),
        "email": get("email"),
        "reviews": get("googleReviewsUrl"),
        "ga4": get("ga4MeasurementId"),
        "ads": get("googleAdsConversion"),
        "meta": get("metaPixelId"),
    }


CFG = read_config()
SITE_URL = CFG["siteUrl"]
PHONE = CFG["phone"]
PHONE_TEL = "+1" + re.sub(r"\D", "", PHONE)[-10:] if PHONE else ""
EMAIL = CFG["email"]
REVIEWS_URL = CFG["reviews"]
HERO_PHOTO = os.path.join(SITE, "assets", "img", "hero.jpg")
TEAM_PHOTO = os.path.join(SITE, "assets", "img", "team.jpg")

# UI strings for the two languages the site ships in.
T = {
    "en": {
        "serving": "We buy houses in Arizona, Florida, Tennessee, North Carolina and nationwide",
        "call_or_text": "Call or text", "text_us": "Text us", "lang_switch": ("Español", "es.html"),
        "nav": [("How it works", "#how"), ("Where we buy", "#markets"), ("FAQ", "#faq"), ("Contact", "#about")],
        "cta": "Get My Cash Offer", "cta_arrow": "Get My Cash Offer →",
        "skip": "Skip to the cash offer form",
        "card_title": "Get Your Cash Offer",
        "card_sub": "Start below. It takes about 30 seconds and there's no obligation.",
        "f_address": "Property address", "f_phone": "Phone", "f_email": "Email", "optional": "(optional)",
        "fine": "No obligation. We never sell your information.",
        "consent": "By sending, you agree that %s may call or email you about this property. We text only if you check the box. Consent isn't a condition of any purchase.",
        "sms_label": "Text me about my offer (optional). Message and data rates may apply. Reply STOP to opt out or HELP for help.",
        "privacy": "Privacy policy", "privacy_href": "privacy.html",
        "done_h": "You're all set!",
        "done_p": "We're looking at the property now. Expect a call%s, usually within 24 hours, to talk through your cash offer. Save the number so you don't miss us.",
        "done_more": "Add details to speed up my offer", "done_alt": "Or call or text",
        "bullets": ["A no-obligation cash offer, usually within 24 hours", "No fees or commissions; we pay standard closing costs", "Close in as little as 7 days, or on your date"],
        "talk": "Prefer to talk? Call or text",
        "trust": [("clock", "Offer in about 24 hours", "With the math behind it, explained"),
                  ("dollar", "$0 fees or commissions", "We pay standard closing costs"),
                  ("calendar", "Close in as little as 7 days", "Or pick any date that suits you"),
                  ("house", "Any condition", "Even with repairs, tenants or liens")],
        "foot_where": "Where we buy", "foot_cities": "Cities we buy in", "foot_company": "Company",
        "foot_blurb": "%s buys houses directly from owners in Arizona, Florida, Tennessee and North Carolina, and looks at properties anywhere in the US. Cash offers, no fees, closing on your schedule.",
        "foot_links": [("How it works", "index.html#how"), ("Contact us", "index.html#about"), ("Questions", "index.html#faq"), ("Get a cash offer", "#offer"), ("Privacy policy", "privacy.html")],
        "sell_in": "Sell a house in %s", "nationwide": "Nationwide", "reviews": "Read our Google reviews",
        "legal": "%s is a real estate investment company that purchases property directly from owners. It is not a listing service. All offers are no-obligation. Offer and closing timelines describe typical transactions and depend on title, occupancy and local requirements. We follow federal and state Fair Housing laws.",
        "rights": "All rights reserved.", "call": "Call", "text": "Text",
    },
    "es": {
        "serving": "Compramos casas en Arizona, Florida, Tennessee, Carolina del Norte y en todo el país",
        "call_or_text": "Llame o envíe un texto al", "text_us": "Envíenos un texto", "lang_switch": ("English", "index.html"),
        "nav": [("Cómo funciona", "#how"), ("Dónde compramos", "#markets"), ("Preguntas", "#faq"), ("Contacto", "#about")],
        "cta": "Recibir mi oferta", "cta_arrow": "Recibir mi oferta →",
        "skip": "Ir al formulario de oferta",
        "card_title": "Reciba su oferta en efectivo",
        "card_sub": "Empiece abajo. Toma unos 30 segundos y no hay ningún compromiso.",
        "f_address": "Dirección de la propiedad", "f_phone": "Teléfono", "f_email": "Correo electrónico", "optional": "(opcional)",
        "fine": "Sin compromiso. Nunca vendemos su información.",
        "consent": "Al enviar, acepta que %s lo llame o le escriba por correo electrónico sobre esta propiedad. Solo le enviamos mensajes de texto si marca la casilla. El consentimiento no es condición de ninguna compra.",
        "sms_label": "Envíenme mensajes de texto sobre mi oferta (opcional). Pueden aplicarse tarifas de mensajes y datos. Responda ALTO para cancelar o AYUDA para recibir ayuda.",
        "privacy": "Política de privacidad", "privacy_href": "privacidad.html",
        "done_h": "¡Listo!",
        "done_p": "Ya estamos revisando la propiedad. Espere una llamada%s, normalmente en menos de 24 horas, para hablar de su oferta en efectivo. Guarde el número para no perder nuestra llamada.",
        "done_more": "", "done_alt": "O llame o envíe un texto al",
        "bullets": ["Una oferta en efectivo sin compromiso, normalmente en 24 horas", "Sin comisiones ni cargos; pagamos los gastos de cierre habituales", "Cierre en tan solo 7 días, o en la fecha que usted elija"],
        "talk": "¿Prefiere hablar? Llame o envíe un texto al",
        "trust": [("clock", "Oferta en unas 24 horas", "Con los números detrás, explicados"),
                  ("dollar", "$0 en comisiones", "Pagamos los gastos de cierre habituales"),
                  ("calendar", "Cierre en 7 días", "O en la fecha que mejor le convenga"),
                  ("house", "Cualquier condición", "Aunque necesite reparaciones o tenga inquilinos o gravámenes")],
        "foot_where": "Dónde compramos", "foot_cities": "Ciudades donde compramos", "foot_company": "Empresa",
        "foot_blurb": "%s compra casas directamente a sus dueños en Arizona, Florida, Tennessee y Carolina del Norte, y revisa propiedades en cualquier parte del país. Ofertas en efectivo, sin comisiones, con cierre en su fecha.",
        "foot_links": [("Cómo funciona", "es.html#how"), ("Contacto", "es.html#about"), ("Preguntas", "es.html#faq"), ("Recibir una oferta", "#offer"), ("Política de privacidad", "privacidad.html")],
        "sell_in": "Vender una casa en %s", "nationwide": "Todo el país", "reviews": "Lea nuestras reseñas en Google",
        "legal": "%s es una empresa de inversión inmobiliaria que compra propiedades directamente a sus dueños. No es un servicio de listados. Todas las ofertas son sin compromiso. Los plazos de oferta y cierre describen transacciones típicas y dependen del título, la ocupación y los requisitos locales. Cumplimos con las leyes federales y estatales de Vivienda Justa.",
        "rights": "Todos los derechos reservados.", "call": "Llamar", "text": "Texto",
    },
}
STATE_ES = {"AZ": "Arizona", "FL": "Florida", "TN": "Tennessee", "NC": "Carolina del Norte"}

# Brand type: Cinzel for the logo wordmark and small caps labels, Cormorant Garamond for headlines, Figtree for reading.
# Brand type, self-hosted from site/assets/fonts (SIL Open Font License): Cinzel for the logo wordmark and small
# caps labels, Cormorant Garamond for headlines, Figtree for reading. Each file is a variable font (every weight).
FONT_PRELOAD = ["assets/fonts/figtree-latin.woff2", "assets/fonts/cormorant-garamond-latin.woff2"]


TAGLINE = "Land. Legacy. Wealth."
# Logo files in site/assets/img, cut from brand/prime-acre-capital-logo.webp by tools/logo_assets.py.
IMG = {
    "monogram": "assets/img/pac-monogram.png",      # gold PAC monogram, transparent, 147x168
    "logo": "assets/img/prime-acre-capital-logo.jpg",  # full square logo, 720x720
    "logo_hd": "assets/img/prime-acre-capital-logo-1254.webp",  # same, full size, for high-density screens
    "og": "assets/img/og-image.jpg",                # 1200x630 share card
    "favicon": "assets/img/favicon-48.png",
    "touch": "assets/img/apple-touch-icon.png",
}

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
            ("Sun-worn roofs and tired AC units",
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
             "A new job in another city doesn't wait for a 90-day listing. We can close in as little as 7 days, or on the date that lines up with your move."),
            ("Inherited homes and family land",
             "A parent's house in another county, or acreage split among siblings. We buy the whole property and handle the paperwork with your attorney."),
            ("Storm damage, mold and deferred repairs",
             "From coastal flooding to a roof that leaked all winter, we buy houses that other buyers can't get financed."),
        ],
    },
]
MARKET_BY_ABBR = {m["abbr"]: m for m in MARKETS}

# City landing pages: (city, state abbr, county, nearby areas, intro)
CITIES = [
    ("Phoenix", "AZ", "Maricopa", ["Maryvale", "Laveen", "Sunnyslope", "Arcadia", "Ahwatukee", "South Mountain"],
     "Across the Valley, from older block homes in Maryvale and Sunnyslope to rentals near the light rail and inherited houses in Arcadia, we buy Phoenix properties as-is for cash."),
    ("Mesa", "AZ", "Maricopa", ["Dobson Ranch", "West Mesa", "Eastmark", "Red Mountain Ranch", "Falcon Field", "Superstition Springs"],
     "From west Mesa near the US-60 to the newer subdivisions out east, we buy Mesa houses in any condition, including rentals, inherited homes and properties behind on HOA dues."),
    ("Tucson", "AZ", "Pima", ["Midtown", "South Tucson", "Catalina Foothills", "Marana", "Oro Valley", "Rita Ranch"],
     "Older ranch homes in Midtown, rentals near the University, and family houses on the south and east sides. We buy Tucson properties as-is and close through local title companies."),
    ("Scottsdale", "AZ", "Maricopa", ["Old Town", "McCormick Ranch", "North Scottsdale", "South Scottsdale", "Gainey Ranch", "DC Ranch"],
     "Condos in Old Town, dated homes in McCormick Ranch, and inherited properties in North Scottsdale. We buy as-is, including HOA properties and homes that need updates."),
    ("Jacksonville", "FL", "Duval", ["Arlington", "Westside", "Northside", "Mandarin", "Orange Park", "the Beaches"],
     "From Arlington and the Westside to Mandarin and the Beaches, we buy Jacksonville houses with old roofs, open insurance claims, inherited titles and tenants in place."),
    ("Tampa", "FL", "Hillsborough", ["Seminole Heights", "Town 'n' Country", "Brandon", "Riverview", "Carrollwood", "Temple Terrace"],
     "Bungalows in Seminole Heights, block homes in Town 'n' Country, and rentals in Brandon and Riverview. Storm damage and flood-zone issues included: we buy Tampa houses as-is."),
    ("Orlando", "FL", "Orange", ["Pine Hills", "Azalea Park", "Kissimmee", "Sanford", "Apopka", "Conway"],
     "Older homes in Pine Hills and Azalea Park, former short-term rentals near Kissimmee, and inherited houses across Orange County. We buy Orlando properties for cash, HOA fees and all."),
    ("Miami", "FL", "Miami-Dade", ["Hialeah", "Kendall", "Homestead", "North Miami", "Little Havana", "Cutler Bay"],
     "Single-family homes in Hialeah and Kendall, condos facing recertification or special assessments, and inherited properties in Homestead. We buy Miami real estate as-is for cash."),
    ("Nashville", "TN", "Davidson", ["Antioch", "Madison", "East Nashville", "Donelson", "Bellevue", "Hermitage"],
     "From Antioch and Madison to Donelson and Hermitage, we buy Nashville houses that need work, rentals you're done managing, and family homes you've inherited."),
    ("Memphis", "TN", "Shelby", ["Whitehaven", "Frayser", "Raleigh", "Cordova", "Berclair", "Hickory Hill"],
     "Tired rentals in Whitehaven and Frayser, inherited homes in Raleigh and Berclair, and houses in Cordova that need more than a weekend of repairs. We buy Memphis properties as-is."),
    ("Knoxville", "TN", "Knox", ["Fountain City", "South Knoxville", "Powell", "Halls", "Bearden", "Karns"],
     "Older homes in Fountain City and South Knoxville, rentals near campus, and family property out toward Powell and Halls. We buy Knoxville houses for cash in any condition."),
    ("Chattanooga", "TN", "Hamilton", ["East Ridge", "Hixson", "Brainerd", "Red Bank", "East Lake", "Soddy-Daisy"],
     "From East Ridge and Brainerd to Hixson and Red Bank, we buy Chattanooga houses with foundation issues, deferred repairs, tenants in place or probate in progress."),
    ("Charlotte", "NC", "Mecklenburg", ["West Charlotte", "University City", "Steele Creek", "Matthews", "Hidden Valley", "Mint Hill"],
     "Across Mecklenburg County, from West Charlotte and Hidden Valley to University City and Steele Creek, we buy Charlotte houses as-is so you can move on your timeline."),
    ("Raleigh", "NC", "Wake", ["Southeast Raleigh", "Garner", "Knightdale", "Wake Forest", "North Raleigh", "Cary"],
     "Older homes in Southeast Raleigh, rentals in Garner and Knightdale, and inherited houses across Wake County. We buy Raleigh properties for cash with no repairs and no fees."),
    ("Greensboro", "NC", "Guilford", ["High Point", "Jamestown", "Glenwood", "Lindley Park", "Summerfield", "East Greensboro"],
     "Mill-era homes in Glenwood and East Greensboro, rentals in High Point, and family property out toward Summerfield. We buy Greensboro houses in any condition."),
    ("Durham", "NC", "Durham", ["East Durham", "North Durham", "Southpoint", "Hillsborough", "Chapel Hill", "Braggtown"],
     "From East Durham and Braggtown to Southpoint and Chapel Hill, we buy Durham houses that need updates, rentals with tenants, and homes tied up in probate."),
]


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def city_slug(city, st):
    return "sell-my-house-fast-%s-%s.html" % (slugify(city), st.lower())


CITY_PAGES = [dict(city=c, st=st, county=county, areas=areas, intro=intro, file=city_slug(c, st),
                   market=MARKET_BY_ABBR[st]) for c, st, county, areas, intro in CITIES]

# Real seller quotes only. Leave empty and the section is not rendered.
# Example: {"quote": "They closed in nine days and I didn't fix a thing.", "name": "D. Alvarez", "where": "Mesa, AZ"}
TESTIMONIALS = []

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
    "phone": '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    "pen": '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13 7l4 4"/>',
    "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    "chat": '<path d="M4 5h16v11H9l-5 4z"/>',
    "star": '<path d="M12 3l2.8 5.9 6.2.8-4.6 4.4 1.2 6.2L12 17.3 6.4 20.3l1.2-6.2L3 9.7l6.2-.8z"/>',
}


def icon(name, cls=""):
    c = ' class="%s"' % cls if cls else ""
    return ('<svg%s viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % (c, ICON[name]))


def esc(s):
    return html.escape(str(s), quote=True)


# ---------------------------------------------------------------- researched content (tools/content)
CONTENT = os.environ.get("PAC_CONTENT_DIR") or os.path.join(ROOT, "tools", "content")  # override for tests


def load_content():
    """State rules, city facts and pages written to tools/content/*.json (checked by tools/content_check.py)."""
    law, cities, pages = {}, {}, {}
    if os.path.isdir(CONTENT):
        for name in sorted(os.listdir(CONTENT)):
            if not name.endswith(".json"):
                continue
            with open(os.path.join(CONTENT, name), encoding="utf-8") as f:
                data = json.load(f)
            if name.startswith("state_law"):
                law.update(data)
            elif name.startswith("cities"):
                for c in data.get("cities", []):
                    cities[(c["city"], c["st"])] = c
            elif name.startswith("page_"):
                pages[data["slug"]] = data
    return law, cities, pages


STATE_LAW, CITY_DATA, PAGE_DATA = load_content()

# (slug, menu label, icon, one-line card text)
SITUATION_PAGES = [
    ("sell-inherited-house", "Inherited a house", "doc", "Probate, heirs, and a house full of belongings."),
    ("sell-house-facing-foreclosure", "Facing foreclosure", "clock", "Your options, your state's timeline, and how a sale works."),
    ("sell-house-with-tenants", "Rental with tenants", "key", "Selling with a lease in place, deposits and notices."),
    ("sell-house-as-is", "Needs major repairs", "tool", "Fire, water, mold, foundation or code violations."),
]
HUB = "sell-house-situations"
GUIDE_PAGES = [("how-we-calculate-your-offer", "How we calculate offers"), ("compare", "Compare your options"),
               ("how-to-vet-a-cash-home-buyer", "How to vet a cash buyer")]
COMPANY_PAGES = [("how-it-works", "How it works"), ("about", "About us"), ("faq", "FAQ"), ("contact", "Contact")]
LABELS = dict([(p[0], p[1]) for p in SITUATION_PAGES] + GUIDE_PAGES + COMPANY_PAGES + [(HUB, "All situations")])
# Inner pages that open with the full hero and quick offer form (landing pages for search and ads).
LANDING = {p[0] for p in SITUATION_PAGES} | {HUB, "how-it-works", "how-we-calculate-your-offer", "compare"}


def has_page(slug):
    return slug in PAGE_DATA


def human_date(iso):
    """2026-10-27 -> October 27, 2026 (leaves anything else alone)."""
    try:
        d = datetime.date.fromisoformat(str(iso)[:10])
    except ValueError:
        return str(iso)
    return "%s %d, %d" % (d.strftime("%B"), d.day, d.year)


def href(slug):
    return "index.html" if slug in ("", "index") else slug + ".html"


def built_slugs():
    return ({"index", "privacy", "es", "privacidad"} | {m["slug"] for m in MARKETS}
            | {c["file"][:-5] for c in CITY_PAGES} | set(PAGE_DATA))


LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
BOLD_RE = re.compile(r"\*\*(.+?)\*\*")


def _bold(escaped):
    return BOLD_RE.sub(r"<strong>\1</strong>", escaped)


def rich(text):
    """Escape text, then allow **bold** and [label](page-slug or https URL) links, as used in tools/content."""
    s, out, last = str(text), [], 0
    for m in LINK_RE.finditer(s):
        out.append(_bold(esc(s[last:m.start()])))
        label, target = m.group(1), m.group(2)
        if target.startswith("https://"):
            out.append('<a href="%s" target="_blank" rel="noopener">%s</a>' % (esc(target), _bold(esc(label))))
        else:
            slug, _, frag = target.partition("#")
            slug = slug[:-5] if slug.endswith(".html") else slug
            if slug and slug not in built_slugs():
                out.append(_bold(esc(label)))  # page not built yet: plain text, never a broken link
            else:
                url = (href(slug) if slug else "") + ("#" + frag if frag else "")
                out.append('<a href="%s">%s</a>' % (esc(url), _bold(esc(label))))
        last = m.end()
    out.append(_bold(esc(s[last:])))
    return "".join(out)


def plain(text):
    """Content text with markup removed, for meta tags and JSON-LD."""
    return BOLD_RE.sub(r"\1", LINK_RE.sub(r"\1", str(text)))


def crumbs(items):
    """Visible breadcrumb trail. items: [(label, href or None for the current page)], Home first."""
    lis = "".join(('<li><a href="%s">%s</a></li>' % (esc(h), esc(l))) if h else ('<li aria-current="page">%s</li>' % esc(l))
                  for l, h in items)
    return '<nav class="crumbs" aria-label="Breadcrumb"><ol>%s</ol></nav>' % lis


def crumbs_jsonld(items, url):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": l,
         "item": (SITE_URL + ("" if h == "index.html" else h)) if h else url} for i, (l, h) in enumerate(items)]}


BRAND_MARK = '<img class="brand-mark" src="%s" width="46" height="52" alt="">' % IMG["monogram"]
BRAND_WORD = '<span class="brand-word"><span>Prime Acre</span><small>Capital</small></span>'

ABOUT_ALT = {
    "en": "Prime Acre Capital logo: a gold PAC monogram over rolling fields, with the words Land. Legacy. Wealth.",
    "es": "Logotipo de Prime Acre Capital: monograma PAC dorado sobre colinas, con el lema Land. Legacy. Wealth.",
}


def about_art(lang="en"):
    """The full logo for the about section; the 1254px file keeps it sharp on high-density screens."""
    return ('<img src="%s" srcset="%s 720w, %s 1254w" sizes="(max-width: 860px) 420px, 504px" width="720" height="720" '
            'loading="lazy" alt="%s">' % (IMG["logo"], IMG["logo"], IMG["logo_hd"], esc(ABOUT_ALT[lang])))


def phone_link(cls=""):
    if not PHONE:
        return ""
    c = ' class="%s"' % cls if cls else ""
    return '<a%s href="tel:%s" data-phone>%s</a>' % (c, PHONE_TEL, esc(PHONE))


def sms_link(label, cls=""):
    if not PHONE:
        return ""
    c = ' class="%s"' % cls if cls else ""
    return '<a%s href="sms:%s" data-sms>%s</a>' % (c, PHONE_TEL, label)


def email_link(cls=""):
    if not EMAIL:
        return ""
    c = ' class="%s"' % cls if cls else ""
    return '<a%s href="mailto:%s" data-email>%s</a>' % (c, esc(EMAIL), esc(EMAIL))


# ---------------------------------------------------------------- partials


def head(title, desc, path, jsonld, lang="en", robots=""):
    url = SITE_URL + ("" if path == "index.html" else path)
    alternates = ""
    if path in ("index.html", "es.html"):
        alternates = ('<link rel="alternate" hreflang="en" href="%s">\n<link rel="alternate" hreflang="es" href="%ses.html">\n'
                      '<link rel="alternate" hreflang="x-default" href="%s">\n' % (SITE_URL, SITE_URL, SITE_URL))
    return """<!doctype html>
<html lang="%(lang)s">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>%(title)s</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(url)s">
%(robots)s%(alternates)s<meta property="og:type" content="website">
<meta property="og:site_name" content="%(brand)s">
<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(url)s">
<meta property="og:image" content="%(og)s">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="%(brand)s: %(tagline)s">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="%(og)s">
<meta name="theme-color" content="#0E0C09">
<link rel="icon" type="image/png" sizes="48x48" href="%(favicon)s">
<link rel="apple-touch-icon" href="%(touch)s">
%(preload)s<link rel="stylesheet" href="assets/style.css">
<link rel="stylesheet" href="assets/chat.css">
<script type="application/ld+json">%(jsonld)s</script>
</head>
<body>
""" % dict(title=esc(title), desc=esc(desc), url=esc(url), brand=esc(BRAND), favicon=IMG["favicon"], touch=IMG["touch"],
           preload="".join('<link rel="preload" href="%s" as="font" type="font/woff2" crossorigin>\n' % f for f in FONT_PRELOAD),
           og=esc(SITE_URL + IMG["og"]), tagline=esc(TAGLINE), jsonld=json.dumps(jsonld, ensure_ascii=False), lang=lang, alternates=alternates,
           robots=('<meta name="robots" content="%s">\n' % esc(robots)) if robots else "")


def topbar(lang="en"):
    t = T[lang]
    contact = ""
    if PHONE:
        contact += '<span>%s%s %s</span>' % (icon("phone"), esc(t["call_or_text"]), phone_link())
        contact += '<span>%s%s</span>' % (icon("chat"), sms_link(esc(t["text_us"])))
    if EMAIL:
        contact += '<span>%s%s</span>' % (icon("mail"), email_link())
    contact += '<span class="lang"><a href="%s" lang="%s">%s</a></span>' % (t["lang_switch"][1], "es" if lang == "en" else "en", esc(t["lang_switch"][0]))
    return """<div class="topbar">
  <div class="wrap">
    <span class="serving">%s</span>
    <div class="contact">%s</div>
  </div>
</div>
""" % (esc(t["serving"]), contact)


CHEVRON = ('<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" '
           'stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>')


def _nav_a(url, label, current, cls=""):
    attrs = (' class="%s"' % cls if cls else "") + (' aria-current="page"' if url == current else "")
    return '<a href="%s"%s>%s</a>' % (esc(url), attrs, esc(label))


def nav_english(current):
    """Main menu with two disclosure dropdowns, like the top cash-buyer sites: Sell your house, Where we buy."""
    sit = "".join(_nav_a(href(s), l, current) for s, l, _, _ in SITUATION_PAGES if has_page(s))
    if has_page(HUB):
        sit += _nav_a(href(HUB), "All situations →", current, "nav-more")
    guides = "".join(_nav_a(href(s), l, current) for s, l in GUIDE_PAGES if has_page(s))
    groups = ""
    if sit or guides:
        cols = ""
        if sit:
            cols += '<div class="nav-col"><span class="nav-col-h">Your situation</span>%s</div>' % sit
        if guides:
            cols += '<div class="nav-col"><span class="nav-col-h">Before you decide</span>%s</div>' % guides
        groups += ('<div class="nav-group"><button class="nav-drop" type="button" aria-expanded="false" aria-controls="menu-sell">'
                   'Sell your house%s</button><div class="nav-menu" id="menu-sell">%s</div></div>' % (CHEVRON, cols))
    cols = ""
    for m in MARKETS:
        cities = "".join(_nav_a(c["file"], c["city"], current) for c in CITY_PAGES if c["st"] == m["abbr"])
        cols += '<div class="nav-col">%s%s</div>' % (_nav_a(m["slug"] + ".html", m["name"], current, "nav-col-h"), cities)
    cols += '<a class="nav-more nav-all" href="index.html#markets">Outside these states? We still look at every address →</a>'
    groups += ('<div class="nav-group nav-group-wide"><button class="nav-drop" type="button" aria-expanded="false" aria-controls="menu-where">'
               'Where we buy%s</button><div class="nav-menu nav-menu-wide" id="menu-where">%s</div></div>' % (CHEVRON, cols))
    links = ""
    for slug, label, fallback in (("how-it-works", "How it works", "index.html#how"), ("about", "About", "index.html#about"),
                                  ("faq", "FAQ", "index.html#faq")):
        links += _nav_a(href(slug) if has_page(slug) else fallback, label, current)
    return groups + links + '<a class="nav-lang" href="es.html" lang="es">Español</a>'


def header(lang="en", same_page=False, current=""):
    t = T[lang]
    if lang == "es":
        prefix = "" if same_page else "es.html"
        menu = "".join('<a href="%s%s">%s</a>' % (prefix, h, esc(label)) for label, h in t["nav"])
        menu += '<a class="nav-lang" href="index.html" lang="en">English</a>'
    else:
        menu = nav_english(current)
    return """<a class="sr-only" href="#offer">%(skip)s</a>
%(topbar)s<header class="site-header" id="top">
  <div class="wrap">
    <a class="brand" href="%(home)s" aria-label="%(brand)s">
      %(mark)s
      %(word)s
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">%(menu_label)s</button>
    <nav class="nav" id="nav" aria-label="%(nav_label)s">
      %(menu)s
      <a class="btn btn-cta" href="#offer">%(cta)s</a>
    </nav>
  </div>
</header>
""" % dict(skip=esc(t["skip"]), topbar=topbar(lang), home="es.html" if lang == "es" else "index.html", brand=esc(BRAND),
           mark=BRAND_MARK, word=BRAND_WORD, menu=menu, cta=esc(t["cta"]),
           menu_label="Menú" if lang == "es" else "Menu", nav_label="Principal" if lang == "es" else "Main")


CONSENT_VERSION = "2026-10-27"  # change when the consent wording changes; sent with every lead


def lead_card(state="", city="", lang="en", card_id="lead-card", details=True, reason="", variant="card"):
    """Quick lead form: address + phone (+ optional email), sent immediately. variant="inline" is the mid-page band."""
    t = T[lang]
    hidden = ""
    if state:
        hidden += '<input type="hidden" name="state" value="%s">' % esc(state)
    if city:
        hidden += '<input type="hidden" name="city" value="%s">' % esc(city)
    if reason:
        hidden += '<input type="hidden" name="reason" value="%s">' % esc(reason)
    placeholder = "123 Main St, %s" % (city + ", " + state if city else (MARKET_BY_ABBR[state]["name"] if state else "Phoenix, AZ"))
    done_phone = ((' from <b data-phone>%s</b>' if lang == "en" else ' del <b data-phone>%s</b>') % esc(PHONE)) if PHONE else ""
    alt = ""
    if PHONE or EMAIL:
        alt = '<p class="alt">%s %s%s</p>' % (esc(t["done_alt"]), phone_link() if PHONE else "", (" · " + email_link()) if (PHONE and EMAIL) else (email_link() if EMAIL else ""))
    more = ('<a class="btn btn-outline" href="#offer" data-add-details>%s</a>' % esc(t["done_more"])) if (details and t["done_more"]) else ""
    uid = card_id.replace("lead-card", "h")
    heading = '<h3 class="lead-title">%s</h3>' % esc(t["card_title"]) if variant == "inline" else '<h2 class="lead-title">%s</h2>' % esc(t["card_title"])
    return """<div class="lead-card%(cls)s" id="%(card_id)s">
      %(heading)s
      <p class="sub">%(sub)s</p>
      <form class="hero-form" novalidate autocomplete="on" data-consent-version="%(cv)s">
        <div class="field f-address">
          <label for="%(uid)s-address">%(f_address)s</label>
          <input id="%(uid)s-address" name="address" type="text" required autocomplete="street-address" placeholder="%(ph)s">
        </div>
        <div class="row-2 f-contact">
          <div class="field">
            <label for="%(uid)s-phone">%(f_phone)s</label>
            <input id="%(uid)s-phone" name="phone" type="tel" required autocomplete="tel" inputmode="tel" placeholder="(555) 555-5555">
          </div>
          <div class="field">
            <label for="%(uid)s-email">%(f_email)s <span class="opt">%(optional)s</span></label>
            <input id="%(uid)s-email" name="email" type="email" autocomplete="email" placeholder="you@email.com">
          </div>
        </div>
        %(hidden)s
        <div class="hp" aria-hidden="true"><label for="%(uid)s-company">Company</label><input id="%(uid)s-company" name="company" type="text" tabindex="-1" autocomplete="off"></div>
        <label class="check"><input id="%(uid)s-sms" name="smsConsent" type="checkbox"><span>%(sms)s</span></label>
        <p class="error-msg" data-form-error role="alert" hidden></p>
        <button class="btn btn-cta btn-lg" type="submit">%(cta)s</button>
        <p class="fine consent">%(lock)s%(consent)s <a href="%(privacy_href)s">%(privacy)s</a></p>
      </form>
      <div class="lead-done" hidden tabindex="-1" role="status">
        %(okmark)s
        <h3>%(done_h)s</h3>
        <p>%(done_p)s</p>
        %(more)s
        %(alt)s
      </div>
    </div>""" % dict(cls=" lead-inline" if variant == "inline" else "", card_id=card_id, uid=uid, heading=heading, sub=esc(t["card_sub"]),
                     f_address=esc(t["f_address"]), f_phone=esc(t["f_phone"]), f_email=esc(t["f_email"]), optional=esc(t["optional"]),
                     ph=esc(placeholder), hidden=hidden, cta=esc(t["cta_arrow"]), lock=icon("lock"), cv=CONSENT_VERSION,
                     consent=esc(t["consent"] % LEGAL_NAME), sms=esc(t["sms_label"]), privacy=esc(t["privacy"]), privacy_href=t["privacy_href"],
                     okmark=icon("check-circle", "mark"), done_h=esc(t["done_h"]), done_p=esc(t["done_p"]) % done_phone, more=more, alt=alt)


def hero(eyebrow, h1, lede_html, state="", city="", lang="en", trail=None, reason="", bullets=True):
    """Dark hero with the quick offer form. DOM order is headline, form, then the rest, so on a phone the address
    field is on the first screen and keyboard order matches what you see."""
    t = T[lang]
    has_photo = os.path.exists(HERO_PHOTO)
    photo = '<div class="hero-photo" style="background-image:url(assets/img/hero.jpg)"></div>' if has_photo else ""
    land = "" if has_photo else '<div class="land" aria-hidden="true"></div>'
    talk = ('<p class="talk">%s %s</p>' % (esc(t["talk"]), phone_link())) if PHONE else ""
    items = "".join('<li>%s<span>%s</span></li>' % (icon("check"), esc(b)) for b in t["bullets"]) if bullets else ""
    return """<section class="hero%(cls)s">
  %(photo)s
  <div class="wrap hero-grid">
    <div class="hero-head">
      %(trail)s<span class="eyebrow-pill">%(eyebrow)s</span>
      <h1>%(h1)s</h1>
    </div>
    <div class="hero-card">%(card)s</div>
    <div class="hero-rest">
      <p class="lede">%(lede)s</p>
      %(bullets)s
      %(talk)s
    </div>
  </div>
  %(land)s
</section>
""" % dict(cls=" has-photo" if has_photo else "", photo=photo, eyebrow=esc(eyebrow), h1=h1, lede=lede_html,
           bullets=('<ul class="bullets">%s</ul>' % items) if items else "", talk=talk, trail=crumbs(trail) if trail else "",
           card=lead_card(state, city, lang, reason=reason), land=land)


def page_hero(eyebrow, h1, lede_html, trail):
    """Short dark band for inner pages that don't open with the offer form."""
    return """<section class="page-hero">
  <div class="wrap">
    %(trail)s<span class="eyebrow-pill">%(eyebrow)s</span>
    <h1>%(h1)s</h1>
    <p class="lede">%(lede)s</p>
  </div>
  <div class="land land-short" aria-hidden="true"></div>
</section>
""" % dict(trail=crumbs(trail), eyebrow=esc(eyebrow), h1=h1, lede=lede_html)


def trust_strip(lang="en"):
    items = T[lang]["trust"]
    cards = "".join("""
    <div class="trust">%s<div><b>%s</b><span>%s</span></div></div>""" % (icon(k), esc(t), esc(d)) for k, t, d in items)
    return """<div class="trust-strip" aria-label="What you get">
  <div class="wrap">%s
  </div>
</div>
""" % cards


STEPS = [
    ("phone", "Tell us about your house", "Fill out the short form, call, text or chat. It takes about a minute, and nobody will pressure you.", "About a minute"),
    ("pen", "Get your cash offer", "We look at nearby sales, the repairs it needs and our costs, then call with a cash offer and the numbers behind it.", "Usually within 24 hours"),
    ("calendar", "Pick your closing day", "Accept when you're ready. Close in as little as 7 days with a licensed title company or closing attorney, or take the time you need.", "7 days or your date"),
]


def steps_cards():
    return "".join("""
    <div class="card step">
      <span class="num">%d</span>
      %s
      <h3>%s</h3>
      <p>%s</p>
      <span class="when">%s</span>
    </div>""" % (i + 1, icon(k, "ico"), esc(t), esc(d), esc(w)) for i, (k, t, d, w) in enumerate(STEPS))


def how():
    more = ('<a class="text-link" href="how-it-works.html">See every step, the documents you\'ll need and the timeline →</a>'
            if has_page("how-it-works") else "")
    return """<section class="section" id="how">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">How it works</span>
      <h2>Selling your house for cash is as easy as 1, 2, 3</h2>
      <p>No listing, no lender, no waiting on someone else's approval. You deal directly with the buyer.</p>
    </div>
    <div class="grid-3">%s
    </div>
    <div class="steps-cta">
      <a class="btn btn-cta btn-lg" href="#offer">Get My Cash Offer</a>
      <small>Free, no obligation, and you can say no at any point.</small>
      %s
    </div>
  </div>
</section>
""" % (steps_cards(), more)


# The eight situation cards. Each links to its page, or to its section on the situations hub.
SITUATIONS = [
    ("clock", "Facing foreclosure", "Behind on payments or already have a sale date? When the price covers what you owe, a sale before the auction pays off the lender at closing.", "sell-house-facing-foreclosure", ""),
    ("doc", "Inherited a house", "Probate, out-of-state heirs, a house full of belongings. Take what you want and leave the rest.", "sell-inherited-house", ""),
    ("key", "Tired of being a landlord", "Problem tenants, late rent, constant repairs. We can buy with tenants in place.", "sell-house-with-tenants", ""),
    ("users", "Divorce or separation", "One clear number to divide, and a closing date that works for both of you.", HUB, "divorce"),
    ("arrow", "Relocating or job change", "Close before you leave town, with a date that matches your move instead of a listing calendar.", HUB, "reloc"),
    ("tool", "Major repairs or code violations", "Roof, foundation, mold, fire or water damage, open permits. We buy it as it is.", "sell-house-as-is", ""),
    ("dollar", "Behind on taxes or liens", "Back taxes, HOA liens and judgments are paid from the sale at closing when the price covers them.", HUB, "tax"),
    ("house", "Vacant or unwanted property", "A second home, a lot, or a house that's been sitting for years, sold without a renovation first.", HUB, "vacant"),
]


def situation_href(slug, key):
    if not has_page(slug):
        return ""
    if slug == HUB and key:
        for sec in PAGE_DATA[slug].get("sections", []):
            if key in sec.get("id", "") or key in sec.get("heading", "").lower():
                return "%s#%s" % (href(slug), sec["id"])
    return href(slug)


def situation_grid():
    cards = ""
    for k, t, d, slug, key in SITUATIONS:
        url = situation_href(slug, key)
        if url:
            cards += '\n    <a class="card sit sit-link" href="%s">%s<div><h3>%s</h3><p>%s</p><span class="more">Read more →</span></div></a>' % (url, icon(k), esc(t), esc(d))
        else:
            cards += '\n    <div class="card sit">%s<div><h3>%s</h3><p>%s</p></div></div>' % (icon(k), esc(t), esc(d))
    return '<div class="grid-4">%s\n    </div>' % cards


def situations():
    return """<section class="section section-soft" id="situations">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">Any situation</span>
      <h2>We buy houses in any situation</h2>
      <p>Whatever is going on, there is usually a clean way to sell. Pick yours to see your options, the rules in your state, and how a cash sale works.</p>
    </div>
    %s
  </div>
</section>
""" % situation_grid()


def contact_lines(lang="en"):
    lines = ""
    if PHONE:
        lines += '<a href="tel:%s">%s<span><span data-phone>%s</span><small>%s</small></span></a>' % (
            PHONE_TEL, icon("phone"), esc(PHONE), "Llame o envíe un texto" if lang == "es" else "Call or text")
    if EMAIL:
        lines += '<a href="mailto:%s">%s<span><span data-email>%s</span><small>%s</small></span></a>' % (
            esc(EMAIL), icon("mail"), esc(EMAIL), "Normalmente respondemos en menos de 24 horas" if lang == "es" else "We usually reply within 24 hours")
    if REVIEWS_URL:
        lines += '<a href="%s" target="_blank" rel="noopener">%s<span>%s<small>Google</small></span></a>' % (esc(REVIEWS_URL), icon("star"), esc(T[lang]["reviews"]))
    return lines


def about():
    art = ('<img src="assets/img/team.jpg" alt="The %s team" loading="lazy">' % esc(BRAND)) if os.path.exists(TEAM_PHOTO) else about_art()
    more = '<p><a class="text-link" href="about.html">More about who we are and how to check us out →</a></p>' if has_page("about") else ""
    return """<section class="section about" id="about">
  <div class="wrap">
    <div class="about-art%(photo)s">%(art)s</div>
    <div>
      <span class="eyebrow">Who you're dealing with</span>
      <h2>A direct buyer, not a listing service.</h2>
      <p class="lede">%(legal)s buys houses directly from owners across Arizona, Florida, Tennessee and North Carolina, and looks at properties anywhere in the US. When you reach out, you talk to the people making the offer.</p>
      <p>We're not agents, and we don't list houses. We make you an offer, show you how we got there, and close with a licensed title company or closing attorney, so your money is handled by a neutral closing agent from start to finish.</p>
      %(more)s
      <div class="contact-card">%(lines)s</div>
    </div>
  </div>
</section>
""" % dict(art=art, photo=" has-photo" if os.path.exists(TEAM_PHOTO) else " logo-art", legal=esc(LEGAL_NAME), lines=contact_lines(), more=more)


def compare():
    rows = [
        ("Price", "Below a retail listing price", "Usually higher, after repairs and prep"),
        ("Commissions and fees", "$0", "Commonly 5–6% combined, and negotiable"),
        ("Repairs", "None. We buy as-is.", "Often requested after inspection"),
        ("Closing costs", "We pay standard closing costs", "Seller typically pays a share"),
        ("Showings and open houses", "None", "Weeks of showings and cleaning"),
        ("Time to close", "As little as 7 days, or your date", "Often 2–4 months from listing to closing"),
        ("Certainty", "Cash, no financing contingency", "A sale can fall through if the buyer's loan fails"),
    ]
    trs = "".join('<tr><td>%s</td><td class="us"><span class="yes" aria-hidden="true">✓</span>%s</td><td><span class="no" aria-hidden="true">✕</span>%s</td></tr>'
                  % (esc(a), esc(b), esc(c)) for a, b, c in rows)
    more = ('<p class="compare-note"><a class="text-link" href="compare.html">Compare all three ways to sell, including instant-offer companies, and estimate your own net →</a></p>'
            if has_page("compare") else "")
    return """<section class="section" id="compare">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">Compare your options</span>
      <h2>Selling to us vs. listing with an agent</h2>
      <p>A listing will usually get a higher price. A cash sale trades some of that price for speed, certainty and no repairs. If listing is the better fit for you, we'll say so.</p>
    </div>
    <div class="compare">
      <table>
        <thead><tr><th scope="col">What it costs you</th><th scope="col" class="us">Selling to %s</th><th scope="col">Listing with an agent</th></tr></thead>
        <tbody>%s</tbody>
      </table>
    </div>
    <p class="compare-note">Listing figures are general market ranges, not a quote for your property. We'll walk you through how we got to our number.</p>
    %s
  </div>
</section>
""" % (esc(BRAND), trs, more)


def promise():
    items = [
        ("A cash offer with the math behind it", "We show you what we looked at: nearby sales, repairs and our costs."),
        ("No commissions or fees", "You don't pay us anything to get an offer or to sell."),
        ("We buy as-is", "Leave the broken water heater, the old furniture, the boxes in the garage."),
        ("No pressure, no obligation", "Say no and we part on good terms. We'd rather earn a referral than push a deal."),
        ("You pick the closing date", "As little as 7 days or several months. Need time to find your next place? Take it."),
        ("A licensed title company or closing attorney handles the money", "Your sale proceeds are paid by the closing agent, never through us."),
    ]
    lis = "".join("<li>%s<div><b>%s</b><span>%s</span></div></li>" % (icon("check"), esc(t), esc(d)) for t, d in items)
    return """<section class="section" id="promise">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">Our commitments</span>
      <h2>Six commitments on every offer we make</h2>
      <p>Selling to a company you found online should come with clear commitments. These are ours.</p>
    </div>
    <ul class="promise-list">%s</ul>
  </div>
</section>
""" % lis


def markets():
    cards = ""
    for m in MARKETS:
        links = "".join('<a href="%s">%s</a>' % (c["file"], esc(c["city"])) for c in CITY_PAGES if c["st"] == m["abbr"])
        cards += """
    <div class="card market" id="%(slug)s">
      <span class="abbr">%(abbr)s</span>
      <h3>%(name)s</h3>
      <p>%(short)s</p>
      <div class="cities">%(links)s</div>
      <a class="more" href="%(slug)s.html" data-prefill-state="%(abbr)s">Sell a house in %(name)s →</a>
    </div>""" % dict(slug=m["slug"], abbr=m["abbr"], name=esc(m["name"]), short=esc(m["short"]), links=links)
    return """<section class="section section-soft" id="markets">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">Where we buy</span>
      <h2>Four home states. We'll look at any address.</h2>
      <p>We focus on Arizona, Florida, Tennessee and North Carolina. Anywhere else in the US, send the address and we'll tell you honestly whether we can buy it.</p>
    </div>
    <div class="grid-4">%s
      <div class="market-wide">
        <div>
          <h3>Outside these states?</h3>
          <p>Send us the address anyway. We'll look at it and tell you plainly, usually within 24 hours, whether we can make an offer.</p>
        </div>
        <a class="btn btn-cta" href="#offer">Send us the address</a>
      </div>
    </div>
  </div>
</section>
""" % cards


def testimonials():
    if not TESTIMONIALS:
        return ""
    cards = "".join("""
    <figure class="card quote"><p>%s</p><figcaption><cite>%s · %s</cite></figcaption></figure>""" % (
        esc(t["quote"]), esc(t["name"]), esc(t.get("where", ""))) for t in TESTIMONIALS)
    return """<section class="section" id="sellers">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">From sellers</span><h2>In their words</h2></div>
    <div class="grid-3">%s
    </div>
  </div>
</section>
""" % cards


FAQ_ITEMS = [
    ("How do I know this is legitimate?",
     "Fair question. You never pay us anything, and your money never passes through us: every closing runs through a licensed title company or closing attorney who holds the funds and records the sale. You can have your own attorney review the contract, and you can walk away at any point before signing."),
    ("Will you lowball me?",
     "A cash offer will be lower than what a fully repaired house could sell for on the open market, because we take on the repairs, the holding costs and the risk of reselling. What you can expect is a number built from figures we show you: recent nearby sales, the repairs we'd take on, and our costs. If it doesn't work for you, you've spent a few minutes and have a cash number to compare with your other options."),
    ("How do you decide what to offer?",
     "We look at what similar homes nearby have sold for after repairs, subtract what it will cost to repair, hold and resell the property, and leave room for our margin. We walk you through the numbers, so you know how we got there."),
    ("Are there any fees?",
     "No. No commissions and no service fees, and we pay standard closing costs. What you receive at closing is the agreed price minus anything owed on the property, such as a mortgage payoff, liens, and your share of property taxes and HOA dues up to the closing date."),
    ("What condition does the house need to be in?",
     "Any. We buy houses with fire or water damage, bad roofs, foundation issues, mold, unfinished renovations and houses packed with belongings. Leave behind anything you don't want to move."),
    ("How fast can you close?",
     "As little as 7 days once title is clear. If you need longer, choose the date that works for you. We close through a licensed title company or closing attorney, and you get paid at closing."),
    ("Do I have to accept the offer?",
     "No. Every offer is free and no-obligation. If listing with an agent would likely get you more, we'll tell you so. And if our walkthrough turns up something we didn't know about, we explain any change in writing before anything is signed, and you can still say no."),
    ("I still have a mortgage. Can you still buy?",
     "Yes. When the sale price covers it, the mortgage, along with any liens or back taxes, is paid off from the sale proceeds at closing. If you owe close to or more than the house is worth, we'll go over the numbers with you honestly: the lender may need to approve the sale, and a free HUD-approved housing counselor (800-569-4287) can help too."),
    ("What kinds of property do you buy?",
     "Single-family homes, condos, townhouses, duplexes and small multifamily, mobile homes with land, and vacant lots, in Arizona, Florida, Tennessee and North Carolina. Anywhere else in the US, send the address and we'll tell you whether we can make an offer."),
]


def faq(extra=None):
    items = (extra or []) + FAQ_ITEMS
    ds = "".join("""
      <details><summary>%s</summary><p>%s</p></details>""" % (esc(q), esc(a)) for q, a in items)
    return """<section class="section section-soft" id="faq">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">Questions</span>
      <h2>Straight answers before you decide</h2>
    </div>
    <div class="faq">%s
    </div>
  </div>
</section>
""" % ds


def faq_jsonld(extra=None):
    items = (extra or []) + FAQ_ITEMS
    return {
        "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in items],
    }


def state_options(default):
    opts = ['<option value="">State</option>']
    for abbr, name in US_STATES:
        sel = ' selected' if abbr == default else ''
        opts.append('<option value="%s"%s>%s</option>' % (abbr, sel, esc(name)))
    return "".join(opts)


REASONS = ["Behind on payments / foreclosure", "Inherited the property", "Tired of being a landlord", "Divorce or separation",
           "Relocating", "Too many repairs", "Behind on taxes or liens", "Vacant or unwanted property", "Downsizing or upgrading", "Other"]


def _options(values, selected=""):
    return "".join('<option%s>%s</option>' % (' selected' if v == selected else "", esc(v)) for v in values)


def offer_form(default_state="", default_city="", reason=""):
    """The full offer form, like the top sites: (1) the address, (2) contact details, which sends the request,
    (3) optional property details that are added to the same request."""
    bullets = [
        "No fees or commissions; we pay standard closing costs",
        "As-is purchase. Leave behind what you don't want.",
        "Close in as little as 7 days, or pick a later date",
        "Mortgage, liens or back taxes? Paid from the sale at closing.",
    ]
    lis = "".join("<li>%s<span>%s</span></li>" % (icon("check"), esc(b)) for b in bullets)
    talk = ""
    if PHONE or EMAIL:
        talk = '<p class="talk">%s%s</p>' % (
            ('<span>Prefer to talk? Call or text %s</span>' % phone_link()) if PHONE else "",
            ('<span>Email %s</span>' % email_link()) if EMAIL else "")
    fallback_lines = ""
    if PHONE:
        fallback_lines += '<span>Text or call %s</span>' % phone_link()
    if EMAIL:
        fallback_lines += '<span>Email %s or <a data-mail href="mailto:%s">open a pre-filled email</a></span>' % (email_link(), esc(EMAIL))
    success_phone = ('<p>Expect a call from <b data-phone>%s</b>, usually within 24 hours. Save the number so you don\'t miss us.</p>' % esc(PHONE)) if PHONE else ""
    placeholder = "123 Main St, %s" % ("%s, %s" % (default_city, default_state) if default_city else (
        "%s, %s" % (MARKET_BY_ABBR[default_state]["cities"][0], default_state) if default_state in MARKET_BY_ABBR else "Phoenix, AZ 85001"))
    return """<section class="offer section" id="offer">
  <div class="wrap">
    <div class="offer-copy">
      <span class="eyebrow">Get your cash offer</span>
      <h2>Tell us about the property. We'll do the rest.</h2>
      <p class="lede">About a minute. We look at every property ourselves and call with a no-obligation cash offer, usually within 24 hours.</p>
      <ul>%(lis)s</ul>
      %(talk)s
    </div>
    <form class="form" id="lead-form" novalidate autocomplete="on" data-consent-version="%(cv)s">
      <ol class="progress" aria-hidden="true"><li class="current">Property</li><li>Contact</li><li>Details (optional)</li></ol>
      <p class="sr-only" aria-live="polite" data-step-status></p>

      <div class="form-step" data-step="1">
        <h3>Step 1 of 3 · Where's the property?</h3>
        <div class="field">
          <label for="f-full">Property address</label>
          <input id="f-full" name="fullAddress" type="text" required autocomplete="street-address" placeholder="%(ph)s" aria-describedby="f-full-hint">
          <span class="hint" id="f-full-hint">Street, city and state. The ZIP code helps.</span>
        </div>
        <div class="row-addr" data-addr-parts hidden>
          <div class="field">
            <label for="f-city">City</label>
            <input id="f-city" name="city" type="text" autocomplete="address-level2" value="%(city)s">
          </div>
          <div class="field">
            <label for="f-state">State</label>
            <select id="f-state" name="state" autocomplete="address-level1">%(states)s</select>
          </div>
          <div class="field">
            <label for="f-zip">ZIP <span class="opt">(optional)</span></label>
            <input id="f-zip" name="zip" type="text" inputmode="numeric" autocomplete="postal-code">
          </div>
        </div>
        <input type="hidden" name="address">
        <p class="error-msg" data-form-error role="alert" hidden></p>
        <div class="form-actions">
          <span class="form-note">Free. No obligation. About a minute.</span>
          <button type="button" class="btn btn-cta" data-next>Continue →</button>
        </div>
      </div>

      <div class="form-step" data-step="2" hidden>
        <h3>Step 2 of 3 · Where should we send your offer?</h3>
        <p class="personal" data-personal hidden>%(spark)s<span></span> <button type="button" class="link-btn" data-edit-address>Edit address</button></p>
        <div class="field">
          <label for="f-name">Your name</label>
          <input id="f-name" name="name" type="text" required autocomplete="name">
        </div>
        <div class="row-2">
          <div class="field">
            <label for="f-phone">Phone</label>
            <input id="f-phone" name="phone" type="tel" required autocomplete="tel" inputmode="tel" placeholder="(555) 555-5555" aria-describedby="f-phone-hint">
            <span class="hint" id="f-phone-hint">Only used about your property. Never sold.</span>
          </div>
          <div class="field">
            <label for="f-email">Email <span class="opt">(optional)</span></label>
            <input id="f-email" name="email" type="email" autocomplete="email">
          </div>
        </div>
        <div class="hp" aria-hidden="true"><label for="f-company">Company</label><input id="f-company" name="company" type="text" tabindex="-1" autocomplete="off"></div>
        <label class="check">
          <input id="f-sms" name="smsConsent" type="checkbox">
          <span>Text me about my offer (optional). Message and data rates may apply. Reply STOP to opt out or HELP for help. Agreeing is not required to get an offer.</span>
        </label>
        <p class="error-msg" data-form-error role="alert" hidden></p>
        <p class="form-note consent">By tapping Send, you agree that %(legal)s may contact you about your property by phone or email, and by text only if you checked the box above. Consent is not a condition of any purchase. We never sell your information. <a href="privacy.html">Privacy policy</a></p>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" data-back>Back</button>
          <button type="submit" class="btn btn-cta btn-lg">Send my request →</button>
        </div>
      </div>

      <div class="form-step" data-step="3" hidden>
        <h3>Got it. Your request is in.</h3>
        <p class="step-sub">We'll call you, usually within 24 hours. Want a quicker, more accurate number? Add a few details. Everything here is optional.</p>
        <div class="row-2">
          <div class="field">
            <label for="f-type">Property type</label>
            <select id="f-type" name="propertyType"><option value="">Select</option>%(types)s</select>
          </div>
          <div class="field">
            <label for="f-condition">Condition</label>
            <select id="f-condition" name="condition"><option value="">Select</option>%(conditions)s</select>
          </div>
        </div>
        <div class="row-3">
          <div class="field">
            <label for="f-beds">Bedrooms</label>
            <select id="f-beds" name="beds"><option value="">–</option>%(beds)s</select>
          </div>
          <div class="field">
            <label for="f-baths">Bathrooms</label>
            <select id="f-baths" name="baths"><option value="">–</option>%(baths)s</select>
          </div>
          <div class="field">
            <label for="f-occupancy">Occupied by</label>
            <select id="f-occupancy" name="occupancy"><option value="">Select</option>%(occupancy)s</select>
          </div>
        </div>
        <div class="row-2">
          <div class="field">
            <label for="f-timeline">When do you want to sell?</label>
            <select id="f-timeline" name="timeline"><option value="">Select</option>%(timelines)s</select>
          </div>
          <div class="field">
            <label for="f-reason">Reason for selling</label>
            <select id="f-reason" name="reason"><option value="">Select</option>%(reasons)s</select>
          </div>
        </div>
        <div class="field">
          <label for="f-price">Do you have a price in mind?</label>
          <input id="f-price" name="askingPrice" type="text" inputmode="numeric" placeholder="$">
          <span class="hint">No wrong answer. It helps us get you a number faster.</span>
        </div>
        <div class="field">
          <label for="f-notes">Anything else we should know?</label>
          <textarea id="f-notes" name="notes" rows="3" placeholder="Liens, tenants, repairs, timing, anything that matters to you."></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" data-skip>Skip for now</button>
          <button type="button" class="btn btn-cta" data-details>Send details →</button>
        </div>
      </div>

      <div class="thanks" data-result="success" hidden tabindex="-1" role="status">
        %(okmark)s
        <h3>You're all set. Your offer is on its way.</h3>
        %(success_phone)s
        <p class="step-sub" data-details-note hidden>We couldn't attach the extra details just now. We'll go over them on the call.</p>
        <div class="next-steps">
          <div><span class="day">Usually within 24 hrs</span><span>We call with your cash offer and the math behind it.</span></div>
          <div><span class="day">Next</span><span>A quick walkthrough or a few photos from your phone, then a written agreement. Nothing to clean or fix.</span></div>
          <div><span class="day">Your date</span><span>Sign with the title company or closing attorney, and they pay you.</span></div>
        </div>
      </div>

      <div class="thanks" data-result="fallback" hidden tabindex="-1" role="status">
        %(okmark)s
        <h3>Almost there. Send us these details.</h3>
        <p>We couldn't deliver this automatically from this page. Copy your request and text or email it to us. We usually reply within 24 hours.</p>
        <div class="summary"></div>
        <button type="button" class="btn btn-outline" data-copy>Copy my request</button>
        <div class="lines">%(fallback_lines)s</div>
      </div>
    </form>
  </div>
</section>
""" % dict(lis=lis, talk=talk, city=esc(default_city), states=state_options(default_state), legal=esc(LEGAL_NAME), ph=esc(placeholder),
           cv=CONSENT_VERSION, okmark=icon("check-circle", "mark"), spark=icon("shield"), success_phone=success_phone,
           fallback_lines=fallback_lines,
           types=_options(["Single-family house", "Condo or townhouse", "Duplex or multifamily", "Mobile or manufactured home", "Land or lot", "Other"]),
           conditions=_options(["Move-in ready", "Needs some updates", "Needs major repairs", "Not livable right now"]),
           beds=_options(["1", "2", "3", "4", "5+"]), baths=_options(["1", "1.5", "2", "2.5", "3", "3.5+"]),
           occupancy=_options(["Me (owner)", "Tenants", "Family member", "Vacant"]),
           timelines=_options(["As soon as possible", "Within 30 days", "In 1 to 3 months", "Just exploring my options"]),
           reasons=_options(REASONS, reason))


def footer(lang="en"):
    t = T[lang]
    es = lang == "es"
    name = (lambda m: STATE_ES[m["abbr"]] if es else m["name"])
    contact = ""
    if PHONE:
        contact += '<li><a href="tel:%s">%s<span data-phone>%s</span></a></li>' % (PHONE_TEL, icon("phone"), esc(PHONE))
        contact += '<li>%s</li>' % sms_link(icon("chat") + "<span>%s</span>" % esc(t["text_us"]))
    if EMAIL:
        contact += '<li><a href="mailto:%s">%s<span data-email>%s</span></a></li>' % (esc(EMAIL), icon("mail"), esc(EMAIL))
    if REVIEWS_URL:
        contact += '<li><a href="%s" target="_blank" rel="noopener">%s<span>%s</span></a></li>' % (esc(REVIEWS_URL), icon("star"), esc(t["reviews"]))
    sell = "".join('<li><a href="%s">%s</a></li>' % (href(s), esc(l)) for s, l, _, _ in SITUATION_PAGES if has_page(s))
    if has_page(HUB):
        sell += '<li><a href="%s">Other situations</a></li>' % href(HUB)
    sell += "".join('<li><a href="%s">%s</a></li>' % (href(s), esc(l)) for s, l in GUIDE_PAGES if has_page(s))
    company = "".join('<li><a href="%s">%s</a></li>' % (href(s), esc(l)) for s, l in COMPANY_PAGES if has_page(s))
    company += '<li><a href="%s">%s</a></li>' % ("privacidad.html" if es else "privacy.html", "Política de privacidad" if es else "Privacy policy")
    company += '<li><a href="%s" lang="%s">%s</a></li>' % (t["lang_switch"][1], "en" if es else "es", esc(t["lang_switch"][0]))
    states = "".join('<li><a href="%s.html">%s</a></li>' % (m["slug"], esc(t["sell_in"] % name(m))) for m in MARKETS)
    states += '<li><a href="%s#markets">%s</a></li>' % ("es.html" if es else "index.html", esc(t["nationwide"]))
    cities = "".join('<div><h5><a href="%s.html">%s</a></h5><ul>%s</ul></div>' % (
        m["slug"], esc(name(m)), "".join('<li><a href="%s">%s</a></li>' % (c["file"], esc(c["city"])) for c in CITY_PAGES if c["st"] == m["abbr"]))
        for m in MARKETS)
    sticky = ""
    if PHONE:
        sticky += '<a class="btn btn-outline" href="tel:%s" aria-label="%s %s">%s%s</a>' % (PHONE_TEL, esc(t["call"]), esc(PHONE), icon("phone"), esc(t["call"]))
        sticky += sms_link(icon("chat") + esc(t["text"]), "btn btn-outline")
    home = "es.html" if es else "index.html"
    cols = ""
    if sell and not es:
        cols += '<div><h4>Sell your house</h4><ul>%s</ul></div>' % sell
    cols += '<div><h4>%s</h4><ul>%s</ul></div>' % (esc(t["foot_where"]), states)
    cols += '<div><h4>%s</h4><ul>%s</ul></div>' % (esc(t["foot_company"]), company if not es else (
        "".join('<li><a href="%s">%s</a></li>' % (h, esc(l)) for l, h in t["foot_links"]) +
        '<li><a href="index.html" lang="en">English</a></li>'))
    return """<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="brand" href="%(home)s" aria-label="%(brand)s">%(mark)s%(word)s</a>
        <p class="foot-tagline" lang="en">%(tagline)s</p>
        <p>%(blurb)s</p>
        <ul class="foot-contact">%(contact)s</ul>
      </div>
      %(cols)s
    </div>
    <div class="foot-cities">
      <h4>%(h_cities)s</h4>
      <div class="foot-cities-grid">%(cities)s</div>
    </div>
    <div class="legal">
      <p>© <span data-year>2026</span> %(legal)s. %(rights)s</p>
      <p>%(legal_text)s</p>
    </div>
  </div>
</footer>
<div class="sticky-cta"><a class="btn btn-cta" href="#offer">%(cta)s</a>%(sticky)s</div>
""" % dict(home=home, mark=BRAND_MARK, word=BRAND_WORD, tagline=esc(TAGLINE), brand=esc(BRAND), blurb=esc(t["foot_blurb"] % LEGAL_NAME),
           contact=contact, cols=cols, h_cities=esc(t["foot_cities"]), cities=cities, legal=esc(LEGAL_NAME), rights=esc(t["rights"]),
           legal_text=esc(t["legal"] % LEGAL_NAME), cta=esc(t["cta"]), sticky=sticky)


def scripts():
    return """<script src="config.js"></script>
<script src="assets/app.js"></script>
<script src="assets/chat.js"></script>
</body>
</html>
"""


# ---------------------------------------------------------------- pages


def org_jsonld():
    org = {
        "@type": "Organization",
        "@id": SITE_URL + "#org",
        "name": LEGAL_NAME,
        "alternateName": BRAND,
        "url": SITE_URL,
        "logo": SITE_URL + IMG["logo"],
        "image": SITE_URL + IMG["og"],
        "slogan": TAGLINE,
        "description": "Cash home buyers. We buy houses as-is in Arizona, Florida, Tennessee, North Carolina and nationwide.",
        "areaServed": [{"@type": "State", "name": m["name"]} for m in MARKETS] + [{"@type": "Country", "name": "United States"}],
    }
    if PHONE:
        org["telephone"] = PHONE_TEL
    if EMAIL:
        org["email"] = EMAIL
    if PHONE or EMAIL:
        cp = {"@type": "ContactPoint", "contactType": "sales", "availableLanguage": "English"}
        if PHONE:
            cp["telephone"] = PHONE_TEL
        if EMAIL:
            cp["email"] = EMAIL
        org["contactPoint"] = [cp]
    return org


def graph(*nodes):
    return {"@context": "https://schema.org", "@graph": list(nodes)}


def service_jsonld(name, area, url):
    return {
        "@type": "Service",
        "serviceType": "Cash home buying",
        "name": name,
        "provider": {"@id": SITE_URL + "#org"},
        "areaServed": area,
        "url": url,
    }


# ---------------------------------------------------------------- content pages (tools/content)

# Facts a seller can check about us. Fill these in only with real, confirmed details; empty ones are not shown.
OWNER = {}            # e.g. {"name": "...", "title": "Owner", "photo": "assets/img/owner.jpg", "bio": "..."}
ENTITY = {}           # e.g. {"state": "Arizona", "filing_id": "...", "registry_url": "https://..."}
MAILING_ADDRESS = ""  # a real mailing address; never show a virtual office as an office
BBB_URL = ""          # only if accredited

TOPIC_LABELS = {
    "foreclosure": "Foreclosure", "probate": "Probate and inherited homes", "closing": "How closings work",
    "transfer_tax": "Transfer taxes", "tenants": "Selling with tenants", "property_tax": "Unpaid property taxes",
    "divorce": "Divorce and co-owners", "disclosure": "What sellers must disclose",
}
LEGAL_NOTE = ("General information, not legal, tax or financial advice. Laws change and every situation is different, "
              "so talk to a licensed attorney or tax professional about yours.")


def example_offer():
    rows = [("What similar homes nearby sell for after repairs", "$300,000", ""),
            ("Repairs we would take on", "− $35,000", ""),
            ("Holding, closing and resale costs", "− $30,000", ""),
            ("Our margin for risk and profit", "− $30,000", ""),
            ("Cash offer", "$205,000", "total"),
            ("Your mortgage payoff (example)", "− $120,000", ""),
            ("Your share of property taxes and HOA dues to closing", "− $2,000", ""),
            ("Estimated cash to you at closing", "$83,000", "total")]
    items = "".join('<div%s><dt>%s</dt><dd>%s</dd></div>' % (' class="total"' if cls else "", esc(a), esc(b)) for a, b, cls in rows)
    return ('<figure class="offer-example"><figcaption><span class="tag">Example only</span> Not a real property or a real offer. '
            'Round numbers that show how an offer is built.</figcaption><dl>%s</dl></figure>' % items)


def net_calculator():
    def money(id_, label, value, hint=""):
        return ('<div class="field"><label for="%s">%s</label><span class="money-in"><input id="%s" type="text" inputmode="numeric" '
                'value="%s" data-net></span>%s</div>' % (id_, esc(label), id_, esc(value), ('<span class="hint">%s</span>' % esc(hint)) if hint else ""))

    def pct(id_, label, value, hint):
        return ('<div class="field"><label for="%s">%s</label><span class="pct-in"><input id="%s" type="text" inputmode="decimal" '
                'value="%s" data-net></span><span class="hint">%s</span></div>' % (id_, esc(label), id_, esc(value), esc(hint)))
    return """<div class="netcalc" id="netcalc">
  <div class="netcalc-in">
    <fieldset><legend>If you list it with an agent</legend>
      %(price)s
      <div class="row-2">%(comm)s%(close)s</div>
      %(repairs)s
      <div class="field range">
        <label for="n-months">Months from listing to closing: <output id="n-months-out" for="n-months">4 months</output></label>
        <input id="n-months" type="range" min="1" max="12" step="1" value="4" data-net>
      </div>
    </fieldset>
    <fieldset><legend>If you take a cash offer</legend>
      %(offer)s
      <div class="row-2">%(cashclose)s%(days)s</div>
    </fieldset>
    <fieldset><legend>Either way</legend>
      %(carry)s
      %(payoff)s
    </fieldset>
  </div>
  <div class="netcalc-out" aria-live="polite">
    <span class="label">Estimated cash to you at closing</span>
    <div class="calc-vs">
      <div><span class="label">Listing</span><strong data-net-out="list">$0</strong><small data-net-out="listTime"></small></div>
      <div class="us"><span class="label">Cash offer</span><strong data-net-out="cash">Enter an offer</strong><small data-net-out="cashTime"></small></div>
    </div>
    <p class="netcalc-diff" data-net-out="diff">Enter a cash offer you received to compare.</p>
    <div class="calc-rows">
      <div><span>Commission</span><span data-net-out="commission">$0</span></div>
      <div><span>Seller closing costs when listing</span><span data-net-out="closing">$0</span></div>
      <div><span>Repairs and prep</span><span data-net-out="repairs">$0</span></div>
      <div><span>Holding costs while listed</span><span data-net-out="carryList">$0</span></div>
      <div><span>Holding costs until a cash closing</span><span data-net-out="carryCash">$0</span></div>
    </div>
    <p class="calc-note">Estimates from the numbers you enter, not a quote. A cash offer is usually lower than a retail listing price; this shows whether the time, repairs and costs you skip make up the difference for you. If listing nets you more and you can wait, listing may be the better choice.</p>
  </div>
</div>""" % dict(
        price=money("n-price", "Likely sale price after repairs and prep", "300,000"),
        comm=pct("n-comm", "Agent commissions", "5.5", "Often 5–6% combined; negotiable."),
        close=pct("n-close", "Your other closing costs", "1.5", "Title, escrow, transfer taxes and fees vary by state."),
        repairs=money("n-repairs", "Repairs and prep before listing", "10,000"),
        offer=money("n-offer", "A cash offer you received", "", "Enter any cash offer, ours or someone else's."),
        cashclose=money("n-cashclose", "Your closing costs on the cash sale", "0", "Ask the buyer which costs they cover."),
        days=('<div class="field"><label for="n-days">Days to a cash closing</label><input id="n-days" type="text" inputmode="numeric" '
              'value="14" data-net></div>'),
        carry=money("n-carry", "Monthly holding costs", "1,200", "Interest (not principal), taxes, insurance, HOA dues, utilities and upkeep."),
        payoff=money("n-payoff", "Mortgage payoff and liens", "0", "Comes out of either sale at closing."))


def verify_us():
    items = ['<li><b>Legal name:</b> %s%s</li>' % (esc(LEGAL_NAME), (
        ', registered in %s (filing %s). <a href="%s" target="_blank" rel="noopener">Look us up</a>' % (
            esc(ENTITY["state"]), esc(ENTITY["filing_id"]), esc(ENTITY["registry_url"]))) if ENTITY.get("registry_url") else "")]
    if OWNER.get("name"):
        items.append('<li><b>Who you talk to:</b> %s, %s</li>' % (esc(OWNER["name"]), esc(OWNER.get("title", "Owner"))))
    if MAILING_ADDRESS:
        items.append('<li><b>Mailing address:</b> %s</li>' % esc(MAILING_ADDRESS))
    items.append('<li><b>Where your money goes:</b> to a licensed title company or closing attorney that you can look up yourself, never to us.</li>')
    items.append('<li><b>What you pay us:</b> nothing. No fees to get an offer, and no commissions.</li>')
    if REVIEWS_URL:
        items.append('<li><b>Reviews:</b> <a href="%s" target="_blank" rel="noopener">Read our Google reviews</a></li>' % esc(REVIEWS_URL))
    if BBB_URL:
        items.append('<li><b>BBB:</b> <a href="%s" target="_blank" rel="noopener">See our BBB profile</a></li>' % esc(BBB_URL))
    guide = ('<p class="verify-more">Use the same checklist on us that you would use on anyone: <a href="%s">how to vet a cash home buyer →</a></p>'
             % href("how-to-vet-a-cash-home-buyer")) if has_page("how-to-vet-a-cash-home-buyer") else ""
    return '<div class="verify"><h3>Things you can check about us</h3><ul class="list">%s</ul>%s</div>' % ("".join(items), guide)


def faq_details(faqs, grouped=False):
    if not grouped or not any(f.get("group") for f in faqs):
        return '<div class="faq">%s</div>' % "".join(
            '<details><summary>%s</summary><p>%s</p></details>' % (esc(plain(f["q"])), rich(f["a"])) for f in faqs)
    groups, order = {}, []
    for f in faqs:
        g = f.get("group") or "More questions"
        if g not in groups:
            groups[g] = []
            order.append(g)
        groups[g].append(f)
    out = ""
    for g in order:
        out += '<h3 class="faq-group" id="%s">%s</h3>' % (slugify(g), esc(g))
        out += faq_details(groups[g])
    return out


def faq_jsonld_items(faqs, lang=None):
    d = {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": plain(f["q"]),
                                             "acceptedAnswer": {"@type": "Answer", "text": plain(f["a"])}} for f in faqs]}
    if lang:
        d["inLanguage"] = lang
    return d


def city_directory():
    cols = ""
    for m in MARKETS:
        links = "".join('<li><a href="%s">%s</a></li>' % (c["file"], esc(c["city"])) for c in CITY_PAGES if c["st"] == m["abbr"])
        cols += '<div><h3><a href="%s.html">%s</a></h3><ul>%s</ul></div>' % (m["slug"], esc(m["name"]), links)
    return '<div class="city-dir">%s</div>' % cols


def state_law_panel(topic, states=None):
    cards = ""
    for abbr in (states or [m["abbr"] for m in MARKETS]):
        law = STATE_LAW.get(abbr)
        if not law or topic not in law.get("topics", {}):
            continue
        t = law["topics"][topic]
        facts = "".join('<li>%s <a class="src" href="%s" target="_blank" rel="noopener">%s</a></li>' % (
            rich(f["text"]), esc(f["source_url"]), esc(f["source_name"])) for f in t.get("facts", []))
        cards += ('<div class="law-state"><h3><a href="%s.html">%s</a></h3><p class="law-sum">%s</p><ul class="law-facts">%s</ul></div>'
                  % (MARKET_BY_ABBR[abbr]["slug"], esc(law["name"]), rich(t["summary"]), facts))
    if not cards:
        return ""
    dates = sorted({STATE_LAW[a].get("last_verified", "") for a in STATE_LAW})
    return '<div class="law-panel">%s</div><p class="law-note">Sources checked %s. %s</p>' % (cards, esc(human_date(dates[-1]) if dates else ""), esc(LEGAL_NOTE))


class Ctx:
    def __init__(self, slug, reason="", state="", city=""):
        self.slug, self.reason, self.state, self.city = slug, reason, state, city
        self.n = 0
        self.faq_done = False


def component(name, d, ctx):
    if name == "quick_form":
        ctx.n += 1
        return lead_card(ctx.state, ctx.city, card_id="lead-card-%d" % ctx.n, reason=ctx.reason, variant="inline")
    if name == "steps":
        return '<div class="grid-3 steps-inline">%s</div>' % steps_cards()
    if name == "example_offer":
        return example_offer()
    if name == "net_calculator":
        return net_calculator()
    if name == "contact_card":
        return '<div class="contact-card">%s</div>' % contact_lines()
    if name == "verify_us":
        return verify_us()
    if name == "faq_list":
        ctx.faq_done = True
        return faq_details(d.get("faqs") or [], grouped=True)
    if name == "city_list":
        return city_directory()
    if name == "situation_cards":
        return situation_grid()
    if name.startswith("state_law:"):
        return state_law_panel(name.split(":", 1)[1])
    return ""


def render_blocks(blocks, d, ctx):
    out = []
    for b in blocks:
        t = b.get("type")
        if t == "p":
            out.append("<p>%s</p>" % rich(b["text"]))
        elif t in ("ul", "ol"):
            out.append('<%s class="list">%s</%s>' % (t, "".join("<li>%s</li>" % rich(x) for x in b["items"]), t))
        elif t == "dl":
            out.append('<dl class="facts">%s</dl>' % "".join('<div><dt>%s</dt><dd>%s</dd></div>' % (rich(i["term"]), rich(i["text"])) for i in b["items"]))
        elif t == "table":
            head = "".join('<th scope="col">%s</th>' % rich(h) for h in b["head"])
            rows = "".join("<tr>%s</tr>" % "".join(('<th scope="row">%s</th>' if i == 0 else "<td>%s</td>") % rich(cell) for i, cell in enumerate(r))
                           for r in b["rows"])
            cap = '<caption>%s</caption>' % rich(b["caption"]) if b.get("caption") else ""
            out.append('<div class="table-wrap" tabindex="0" role="region" aria-label="%s"><table class="data">%s<thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>'
                       % (esc(plain(b.get("caption") or "Table")), cap, head, rows))
        elif t == "callout":
            title = "<b>%s</b>" % rich(b["title"]) if b.get("title") else ""
            out.append('<aside class="callout">%s<p>%s</p></aside>' % (title, rich(b["text"])))
        elif t == "component":
            out.append(component(b.get("name", ""), d, ctx))
    return "\n".join(x for x in out if x)


def related_cards(slugs):
    cards = ""
    for s in slugs or []:
        if s in PAGE_DATA:
            p = PAGE_DATA[s]
            cards += '<a class="card rel" href="%s"><span class="eyebrow">%s</span><b>%s</b><span>%s</span></a>' % (
                href(s), esc(LABELS.get(s, p.get("eyebrow", ""))), esc(plain(p["h1"])), esc(plain(p.get("meta_description", ""))))
        elif s in {m["slug"] for m in MARKETS}:
            m = [x for x in MARKETS if x["slug"] == s][0]
            cards += '<a class="card rel" href="%s.html"><span class="eyebrow">Where we buy</span><b>Sell a house in %s</b><span>%s</span></a>' % (
                s, esc(m["name"]), esc(m["short"]))
    return ('<section class="related" aria-labelledby="related-h"><h2 id="related-h">Keep reading</h2><div class="grid-3">%s</div></section>' % cards) if cards else ""


def sources_block(sources, reviewed, legal):
    if not sources and not reviewed:
        return ('<p class="page-note">%s</p>' % esc(LEGAL_NOTE)) if legal else ""
    lis = "".join('<li><a href="%s" target="_blank" rel="noopener">%s</a></li>' % (esc(s["url"]), esc(s["name"])) for s in sources or [])
    out = '<section class="sources" aria-labelledby="sources-h"><h2 id="sources-h">Sources</h2>'
    if lis:
        out += '<ol>%s</ol>' % lis
    if reviewed:
        out += '<p class="reviewed">Last reviewed %s.</p>' % esc(human_date(reviewed))
    if legal:
        out += '<p class="reviewed">%s</p>' % esc(LEGAL_NOTE)
    return out + "</section>"


def article_layout(sections_html, toc):
    toc_html = "".join('<li><a href="#%s">%s</a></li>' % (esc(i), esc(t)) for i, t in toc)
    phone = ('<p>Or call or text %s</p>' % phone_link()) if PHONE else ""
    return """<div class="article-wrap wrap">
  <article class="article">
%s
  </article>
  <aside class="article-aside">
    <nav class="toc" aria-label="On this page"><h2>On this page</h2><ol>%s</ol></nav>
    <div class="aside-cta"><b>Get a no-obligation cash offer</b><p>About a minute. We call with your offer, usually within 24 hours.</p>
      <a class="btn btn-cta" href="#offer">Get My Cash Offer</a>%s</div>
  </aside>
</div>""" % (sections_html, toc_html, phone)


def content_page(slug):
    d = PAGE_DATA[slug]
    url = SITE_URL + href(slug)
    in_sell = slug in {p[0] for p in SITUATION_PAGES}
    parent = [("Situations", href(HUB))] if (in_sell and has_page(HUB)) else []
    trail = [("Home", "index.html")] + parent + [(LABELS.get(slug, plain(d["h1"])), None)]
    ctx = Ctx(slug, reason=d.get("form_reason", ""))
    eyebrow = d.get("eyebrow") or LABELS.get(slug, "")
    if slug in LANDING:
        top = hero(eyebrow, esc(plain(d["h1"])), rich(d["lede"]), trail=trail, reason=ctx.reason)
    else:
        top = page_hero(eyebrow, esc(plain(d["h1"])), rich(d["lede"]), trail)
    parts, toc = [], []
    for sec in d.get("sections", []):
        parts.append('<section class="prose" id="%s" aria-labelledby="%s-h"><h2 id="%s-h">%s</h2>\n%s\n</section>' % (
            sec["id"], sec["id"], sec["id"], rich(sec["heading"]), render_blocks(sec.get("blocks", []), d, ctx)))
        toc.append((sec["id"], plain(sec["heading"])))
        if any(b.get("type") == "component" and b.get("name") == "faq_list" for b in sec.get("blocks", [])):
            # A grouped FAQ list gets one "On this page" entry per group, pointing at the group headings.
            toc += [(slugify(g), g) for g in dict.fromkeys(f.get("group") for f in d.get("faqs") or []) if g]
    faqs = d.get("faqs") or []
    if faqs and not ctx.faq_done:
        parts.append('<section class="prose" id="questions" aria-labelledby="questions-h"><h2 id="questions-h">Questions</h2>\n%s\n</section>'
                     % faq_details(faqs, grouped=True))
        toc.append(("questions", "Questions"))
    parts.append(related_cards(d.get("related")))
    parts.append(sources_block(d.get("sources"), d.get("last_reviewed") if d.get("article") else "", d.get("article") or d.get("legal_note")))
    nodes = [org_jsonld(), crumbs_jsonld(trail, url)]
    if faqs:
        nodes.append(faq_jsonld_items(faqs))
    if d.get("article"):
        nodes.append({"@type": "Article", "headline": plain(d["h1"]), "description": plain(d.get("meta_description", "")),
                      "dateModified": d.get("last_reviewed", ""), "author": {"@id": SITE_URL + "#org"},
                      "publisher": {"@id": SITE_URL + "#org"}, "mainEntityOfPage": url, "image": SITE_URL + IMG["og"]})
    body = top + trust_strip() + article_layout("\n".join(p for p in parts if p), toc) + offer_form(reason=ctx.reason) + footer()
    return head(plain(d["title"]), plain(d["meta_description"]), href(slug), graph(*nodes)) + header(current=href(slug)) + body + scripts()


def page_index():
    title = "Sell Your House Fast for Cash | We Buy Houses in AZ, FL, TN, NC | Prime Acre Capital"
    desc = ("Prime Acre Capital LLC buys houses as-is for cash in Arizona, Florida, Tennessee, North Carolina and nationwide. "
            "No fees, no repairs, no agents. A cash offer usually within 24 hours, and close in as little as 7 days. Call or text %s." % PHONE).strip()
    h1 = 'Sell Your House Fast for Cash. <span class="hl">Any Condition. Any Situation.</span>'
    lede = ("We buy houses as-is in Arizona, Florida, Tennessee, North Carolina and nationwide. No repairs, no showings, "
            "no agent fees, and no waiting on a buyer's bank.")
    faq_html = faq_section([{"q": q, "a": a} for q, a in FAQ_ITEMS[:6]], "Straight answers before you decide") if has_page("faq") else faq()
    body = (hero("Direct cash home buyer · No agents, no fees", h1, esc(lede)) + trust_strip() + how() + situations() + about()
            + compare() + promise() + markets() + testimonials() + faq_html + offer_form() + footer())
    nodes = [org_jsonld()] + ([] if has_page("faq") else [faq_jsonld()])
    return head(title, desc, "index.html", graph(*nodes)) + header(current="index.html") + body + scripts()


def why_section(title, intro, points):
    cards = "".join("""
    <div class="card step" style="text-align:left;padding:1.6rem">
      <h3>%s</h3>
      <p>%s</p>
    </div>""" % (esc(t), esc(d)) for t, d in points)
    return """<section class="section" id="why">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">Common situations</span>
      <h2>%s</h2>
      <p>%s</p>
    </div>
    <div class="grid-3">%s
    </div>
  </div>
</section>
""" % (esc(title), esc(intro), cards)


def cities_section(m, current=None):
    chips = ""
    for c in CITY_PAGES:
        if c["st"] != m["abbr"]:
            continue
        if current and c["city"] == current:
            chips += '<span class="chip on">%s</span>' % esc(c["city"])
        else:
            chips += '<a class="chip" href="%s">%s</a>' % (c["file"], esc(c["city"]))
    others = [c for c in m["cities"] if c not in [x["city"] for x in CITY_PAGES if x["st"] == m["abbr"]]]
    chips += "".join('<span class="chip">%s</span>' % esc(c) for c in others[:12])
    return """<section class="section section-soft" id="cities">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">Where we buy in %(name)s</span>
      <h2>%(top)s and everywhere between</h2>
      <p>City, suburb or county road. If it's in %(name)s, send us the address. <a href="%(slug)s.html">See all of %(name)s →</a></p>
    </div>
    <div class="chips" style="justify-content:center">%(chips)s<span class="chip">Anywhere else in %(name)s</span></div>
  </div>
</section>
""" % dict(name=esc(m["name"]), top=esc(", ".join(m["cities"][:3])), slug=m["slug"], chips=chips)


def page_state_basic(m):
    title = "Sell My House Fast in %s | We Buy Houses for Cash | %s" % (m["name"], BRAND)
    desc = ("Sell your %s house fast for cash. %s buys houses as-is in %s and across %s. "
            "No fees, no repairs, no obligation. Cash offer usually within 24 hours. Call or text %s." % (m["name"], LEGAL_NAME, ", ".join(m["cities"][:4]), m["name"], PHONE)).strip()
    extra = [("Do you buy everywhere in %s?" % m["name"],
              "Yes. We buy in %s and the surrounding counties, and in smaller towns across the state. "
              "Send any address and we'll tell you plainly whether we can make an offer." % ", ".join(m["cities"][:5]))]
    jsonld = graph(org_jsonld(), service_jsonld("Sell your house for cash in %s" % m["name"], {"@type": "State", "name": m["name"]},
                                                SITE_URL + m["slug"] + ".html"), faq_jsonld(extra))
    h1 = 'Sell Your %s House <span class="hl">Fast for Cash</span>' % esc(m["name"])
    body = (hero("We buy houses in %s" % m["name"], h1, esc(m["lede"]), state=m["abbr"]) + trust_strip()
            + why_section("Common reasons to sell as-is in %s" % m["name"],
                          "Every market has its own reasons a house gets hard to sell the traditional way. These come up often in %s." % m["name"],
                          m["points"])
            + how() + situations() + about() + promise() + cities_section(m) + testimonials()
            + faq(extra) + offer_form(m["abbr"]) + footer())
    return head(title, desc, m["slug"] + ".html", jsonld) + header() + body + scripts()


def page_city_basic(c):
    m = c["market"]
    name = "%s, %s" % (c["city"], c["st"])
    title = "Sell My House Fast in %s | We Buy Houses %s | %s" % (name, c["city"], BRAND)
    desc = ("We buy houses in %s for cash. %s buys as-is in %s and across %s County. No fees, no repairs, no agents. "
            "A cash offer usually within 24 hours. Call or text %s." % (name, LEGAL_NAME, ", ".join(c["areas"][:3]), c["county"], PHONE)).strip()
    extra = [("Do you buy houses everywhere in %s?" % c["city"],
              "Yes. We buy in %s, and throughout %s County. Condos, single-family homes, duplexes, mobile homes with land and vacant lots all qualify." % (", ".join(c["areas"]), c["county"]))]
    jsonld = graph(org_jsonld(), service_jsonld("Sell your house for cash in %s" % name, {"@type": "City", "name": c["city"], "containedInPlace": {"@type": "State", "name": m["name"]}},
                                                SITE_URL + c["file"]), faq_jsonld(extra))
    h1 = 'Sell Your House Fast in <span class="hl">%s</span>' % esc(name)
    body = (hero("We buy houses in %s" % name, h1, esc(c["intro"]), state=c["st"], city=c["city"]) + trust_strip()
            + why_section("Common reasons to sell as-is in %s" % c["city"],
                          "We buy in %s and across %s County. These are common reasons owners choose a cash sale." % (", ".join(c["areas"]), c["county"]),
                          m["points"])
            + how() + situations() + about() + promise() + cities_section(m, c["city"]) + testimonials()
            + faq(extra) + offer_form(c["st"], c["city"]) + footer())
    # Near-duplicate of the other city pages until its researched content exists, so keep it out of search
    # results (Google treats swapped-city-name pages as doorways). Visitors and links still work.
    return head(title, desc, c["file"], jsonld, robots="noindex, follow") + header() + body + scripts()


def state_overview(m, law):
    paras = "".join("<p>%s</p>" % rich(p) for p in law.get("intro", []))
    cards = "".join('<div class="card point"><h3>%s</h3><p>%s</p></div>' % (esc(t), esc(d)) for t, d in m["points"])
    return """<section class="section" id="selling-in">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow">Selling in %(name)s</span>
      <h2>What's different about selling a house in %(name)s</h2>
    </div>
    <div class="prose prose-wide">%(paras)s</div>
    <div class="grid-3 points">%(cards)s</div>
  </div>
</section>
""" % dict(name=esc(m["name"]), paras=paras, cards=cards)


def state_rules(m, law):
    blocks = ""
    for topic in TOPIC_LABELS:
        t = law.get("topics", {}).get(topic)
        if not t:
            continue
        facts = "".join('<li>%s <a class="src" href="%s" target="_blank" rel="noopener">%s</a></li>' % (
            rich(f["text"]), esc(f["source_url"]), esc(f["source_name"])) for f in t.get("facts", []))
        blocks += '<details class="rule"%s><summary><b>%s</b><span>%s</span></summary><ul class="law-facts">%s</ul></details>' % (
            " open" if topic in ("closing", "foreclosure") else "", esc(TOPIC_LABELS[topic]), rich(t["summary"]), facts)
    return """<section class="section section-soft" id="rules">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow">%(name)s rules</span>
      <h2>The %(name)s rules that matter when you sell</h2>
      <p>Plain-English summaries with the statute or official source for each one. Checked %(date)s.</p>
    </div>
    <div class="rules">%(blocks)s</div>
    <p class="law-note">%(note)s</p>
  </div>
</section>
""" % dict(name=esc(m["name"]), date=esc(human_date(law.get("last_verified", ""))), blocks=blocks, note=esc(LEGAL_NOTE))


def state_cities(m):
    cards = ""
    for c in CITY_PAGES:
        if c["st"] != m["abbr"]:
            continue
        data = CITY_DATA.get((c["city"], c["st"]))
        intro = data["intro"] if data else c["intro"]
        cards += '<a class="card city-card" href="%s"><b>%s</b><span>%s County</span><p>%s</p><span class="more">Selling in %s →</span></a>' % (
            c["file"], esc(c["city"]), esc(c["county"]), esc(plain(intro)), esc(c["city"]))
    others = [x for x in m["cities"] if x not in [c["city"] for c in CITY_PAGES if c["st"] == m["abbr"]]]
    chips = "".join('<span class="chip">%s</span>' % esc(x) for x in others[:14])
    return """<section class="section" id="cities">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow">Where we buy in %(name)s</span>
      <h2>Cities and counties we buy in</h2>
      <p>Pick your city for local offices, rules and questions, or send any %(name)s address.</p>
    </div>
    <div class="grid-4">%(cards)s</div>
    <div class="chips chips-more">%(chips)s<span class="chip">Anywhere else in %(name)s</span></div>
  </div>
</section>
""" % dict(name=esc(m["name"]), cards=cards, chips=chips)


def compact_steps():
    items = "".join('<li><b>%s</b><span>%s</span></li>' % (esc(t), esc(w)) for _, t, _, w in STEPS)
    more = ' <a class="text-link" href="how-it-works.html">How it works →</a>' if has_page("how-it-works") else ""
    return '<ol class="mini-steps">%s</ol><p class="mini-more">Free, no obligation, and you can say no at any point.%s</p>' % (items, more)


def situation_links():
    links = ""
    for k, t, d, slug, key in SITUATIONS:
        url = situation_href(slug, key)
        if url:
            links += '<a class="chip" href="%s">%s</a>' % (url, esc(t))
    return '<div class="chips">%s</div>' % links if links else ""


def faq_section(faqs, title="Questions", intro=""):
    more = '<p class="faq-more"><a class="text-link" href="faq.html">See all our questions and answers →</a></p>' if has_page("faq") else ""
    return """<section class="section section-soft" id="faq">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">Questions</span>
      <h2>%s</h2>%s
    </div>
    %s
    %s
  </div>
</section>
""" % (esc(title), ("<p>%s</p>" % esc(intro)) if intro else "", faq_details(faqs), more)


def page_state(m):
    law = STATE_LAW.get(m["abbr"])
    if not law:
        return page_state_basic(m)
    url = SITE_URL + m["slug"] + ".html"
    title = "Sell My House Fast in %s | We Buy Houses for Cash | %s" % (m["name"], BRAND)
    desc = ("Sell your %s house fast for cash. %s buys houses as-is in %s and across %s. "
            "No fees, no repairs, no obligation. Cash offer usually within 24 hours. Call or text %s." % (
                m["name"], LEGAL_NAME, ", ".join(m["cities"][:4]), m["name"], PHONE)).strip()
    trail = [("Home", "index.html"), (m["name"], None)]
    faqs = law.get("faqs", [])
    jsonld = graph(org_jsonld(), crumbs_jsonld(trail, url),
                   service_jsonld("Sell your house for cash in %s" % m["name"], {"@type": "State", "name": m["name"]}, url),
                   faq_jsonld_items(faqs))
    h1 = 'Sell Your %s House <span class="hl">Fast for Cash</span>' % esc(m["name"])
    body = (hero("We buy houses in %s" % m["name"], h1, esc(m["lede"]), state=m["abbr"], trail=trail) + trust_strip()
            + state_overview(m, law) + state_rules(m, law) + state_cities(m) + situations() + how()
            + testimonials() + faq_section(faqs, "%s questions, answered" % m["name"]) + offer_form(m["abbr"]) + footer())
    return head(title, desc, m["slug"] + ".html", jsonld) + header(current=m["slug"] + ".html") + body + scripts()


def city_local(c, data):
    paras = "".join("<p>%s</p>" % rich(p) for p in data.get("local_overview", []))
    cards = "".join('<div class="card point"><h3>%s</h3><p>%s</p></div>' % (rich(k["heading"]), rich(k["text"])) for k in data.get("considerations", []))
    return """<section class="section" id="selling-in">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow">Selling in %(city)s</span>
      <h2>Selling a house in %(city)s: what's different</h2>
    </div>
    <div class="prose prose-wide">%(paras)s</div>
    <div class="grid-3 points">%(cards)s</div>
  </div>
</section>
""" % dict(city=esc(c["city"]), paras=paras, cards=cards)


def city_offices(c, data, law):
    rows = "".join('<tr><th scope="row">%s</th><td><a href="%s" target="_blank" rel="noopener">%s</a></td></tr>' % (
        esc(o["role"]), esc(o["url"]), esc(o["name"])) for o in data.get("offices", []))
    brief = ""
    if law:
        for topic in ("closing", "foreclosure", "probate", "transfer_tax"):
            t = law.get("topics", {}).get(topic)
            if t:
                brief += '<div><h3>%s</h3><p>%s</p></div>' % (esc(TOPIC_LABELS[topic]), rich(t["summary"]))
    m = c["market"]
    return """<section class="section section-soft" id="local-offices">
  <div class="wrap two-col">
    <div>
      <span class="eyebrow">%(county)s County</span>
      <h2>Local offices you may deal with</h2>
      <p>The county seat is %(seat)s. These are the official offices for records, probate and property taxes.</p>
      <div class="table-wrap"><table class="data offices"><tbody>%(rows)s</tbody></table></div>
    </div>
    <div>
      <span class="eyebrow">%(state)s rules in brief</span>
      <h2>What %(state)s law means for your sale</h2>
      <div class="brief">%(brief)s</div>
      <p><a class="text-link" href="%(slug)s.html">All the %(state)s rules, with sources →</a></p>
    </div>
  </div>
</section>
""" % dict(county=esc(data.get("county", c["county"])), seat=esc(data.get("county_seat", "")), rows=rows,
           state=esc(m["name"]), brief=brief, slug=m["slug"])


def city_areas(c, data):
    areas = "".join('<span class="chip">%s</span>' % esc(a) for a in data.get("areas") or c["areas"])
    files = {x["city"]: x["file"] for x in CITY_PAGES}
    nearby = "".join(('<a class="chip" href="%s">%s</a>' % (files[n], esc(n))) if n in files else ('<span class="chip">%s</span>' % esc(n))
                     for n in data.get("nearby", []))
    return """<section class="section" id="areas">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow">Where we buy around %(city)s</span>
      <h2>Neighborhoods and nearby towns</h2>
    </div>
    <div class="chips">%(areas)s%(nearby)s</div>
    <div class="side-by-side">
      <div><h3>How it works</h3>%(steps)s</div>
      <div><h3>Your situation</h3>%(sits)s</div>
    </div>
  </div>
</section>
""" % dict(city=esc(c["city"]), areas=areas, nearby=nearby, steps=compact_steps(), sits=situation_links())


def city_sources(data):
    lis = "".join('<li><a href="%s" target="_blank" rel="noopener">%s</a></li>' % (esc(s["url"]), esc(s["name"])) for s in data.get("sources", []))
    if not lis:
        return ""
    return ('<section class="section sources-band"><div class="wrap"><details class="sources"><summary>Sources for this page (checked %s)</summary>'
            '<ol>%s</ol><p class="reviewed">%s</p></details></div></section>' % (esc(human_date(data.get("last_verified", ""))), lis, esc(LEGAL_NOTE)))


def page_city(c):
    data = CITY_DATA.get((c["city"], c["st"]))
    if not data:
        return page_city_basic(c)
    m = c["market"]
    law = STATE_LAW.get(c["st"])
    name = "%s, %s" % (c["city"], c["st"])
    url = SITE_URL + c["file"]
    title = "Sell My House Fast in %s | We Buy Houses %s | %s" % (name, c["city"], BRAND)
    desc = ("We buy houses in %s for cash, as-is, across %s County. No fees, no repairs, no agents. "
            "A cash offer usually within 24 hours. Call or text %s." % (name, data.get("county", c["county"]), PHONE)).strip()
    trail = [("Home", "index.html"), (m["name"], m["slug"] + ".html"), (c["city"], None)]
    faqs = data.get("faqs", [])
    jsonld = graph(org_jsonld(), crumbs_jsonld(trail, url),
                   service_jsonld("Sell your house for cash in %s" % name,
                                  {"@type": "City", "name": c["city"], "containedInPlace": {"@type": "State", "name": m["name"]}}, url),
                   faq_jsonld_items(faqs))
    h1 = 'Sell Your House Fast in <span class="hl">%s</span>' % esc(name)
    body = (hero("We buy houses in %s" % name, h1, rich(data["intro"]), state=c["st"], city=c["city"], trail=trail) + trust_strip()
            + city_local(c, data) + city_offices(c, data, law) + city_areas(c, data) + testimonials()
            + faq_section(faqs, "%s questions, answered" % c["city"]) + city_sources(data) + offer_form(c["st"], c["city"]) + footer())
    return head(title, desc, c["file"], jsonld) + header(current=c["file"]) + body + scripts()


def page_es():
    """Spanish landing page: quick forms top and bottom, core sections translated."""
    t = T["es"]
    h1 = 'Venda su casa rápido por efectivo. En <span class="hl">cualquier condición.</span> En <span class="hl">cualquier situación.</span>'
    lede = ("Compramos casas tal como están en Arizona, Florida, Tennessee, Carolina del Norte y en todo Estados Unidos. "
            "Sin reparaciones, sin visitas, sin comisiones de agente y sin esperar al banco del comprador.")
    steps = [
        ("phone", "Cuéntenos sobre su casa", "Llene el formulario corto o llámenos. Toma un minuto y nadie lo va a presionar.", "Toma 60 segundos"),
        ("pen", "Reciba su oferta en efectivo", "Revisamos las ventas cercanas, las reparaciones necesarias y nuestros costos, y le llamamos con una oferta en efectivo y los números detrás.", "Normalmente en 24 horas"),
        ("calendar", "Elija su fecha de cierre", "Acepte cuando esté listo. Cierre en tan solo 7 días con una compañía de títulos o un abogado de cierre con licencia, o tómese el tiempo que necesite.", "7 días o su fecha"),
    ]
    step_cards = "".join("""
    <div class="card step"><span class="num">%d</span>%s<h3>%s</h3><p>%s</p><span class="when">%s</span></div>""" % (
        i + 1, icon(k, "ico"), esc(a), esc(b), esc(c)) for i, (k, a, b, c) in enumerate(steps))
    sits = [
        ("clock", "Enfrentando una ejecución hipotecaria", "¿Atrasado en los pagos o ya tiene fecha de subasta? Cuando el precio cubre lo que debe, una venta en efectivo antes de la subasta puede pagar al banco y ayudarle a evitar una ejecución hipotecaria en su historial."),
        ("doc", "Heredó una casa", "Sucesión, herederos fuera del estado, una casa llena de pertenencias. Llévese lo que quiera y déjenos el resto."),
        ("key", "Cansado de ser arrendador", "Inquilinos problemáticos, rentas atrasadas, reparaciones constantes. Podemos comprar con los inquilinos adentro."),
        ("users", "Divorcio o separación", "Una venta rápida y limpia con un solo número con el que todos puedan estar de acuerdo, y una fecha de cierre que funcione para ambos."),
        ("arrow", "Mudanza o cambio de trabajo", "Cierre antes de irse de la ciudad, con una fecha que coincida con su mudanza y no con el calendario de un agente."),
        ("tool", "Reparaciones mayores o infracciones de código", "Techo, cimientos, moho, daños por fuego o agua, permisos abiertos. La compramos exactamente como está."),
        ("dollar", "Atrasado en impuestos o con gravámenes", "Impuestos atrasados, gravámenes de la HOA y sentencias se pagan de la venta al cierre, así que cuando el precio los cubre usted no pone dinero."),
        ("house", "Propiedad vacía o no deseada", "Una segunda casa, un terreno o una casa que lleva años desocupada. Conviértala en efectivo sin renovarla primero."),
    ]
    sit_cards = "".join("""
    <div class="card sit">%s<div><h3>%s</h3><p>%s</p></div></div>""" % (icon(k), esc(a), esc(b)) for k, a, b in sits)
    rows = [
        ("Precio", "Menor que el de una venta tradicional", "Normalmente más alto, después de reparaciones"),
        ("Comisiones y cargos", "$0", "Comúnmente 5–6% en total, y negociable"),
        ("Reparaciones", "Ninguna. Compramos tal como está.", "Generalmente requeridas después de la inspección"),
        ("Gastos de cierre", "Pagamos los gastos de cierre habituales", "El vendedor normalmente paga una parte"),
        ("Visitas y casas abiertas", "Ninguna", "Semanas de visitas y limpieza"),
        ("Tiempo para cerrar", "En tan solo 7 días, o en su fecha", "A menudo 2 a 4 meses desde que se pone en venta"),
        ("Certeza", "Efectivo, sin contingencia de financiamiento", "Las ventas se caen cuando el préstamo falla"),
    ]
    trs = "".join('<tr><td>%s</td><td class="us"><span class="yes" aria-hidden="true">✓</span>%s</td><td><span class="no" aria-hidden="true">✕</span>%s</td></tr>'
                  % (esc(a), esc(b), esc(c)) for a, b, c in rows)
    promises = [
        ("Una oferta en efectivo con los números detrás", "Le mostramos lo que revisamos: ventas cercanas, reparaciones y nuestros costos."),
        ("Sin comisiones ni cargos", "No nos paga nada por recibir una oferta ni por vender."),
        ("Compramos tal como está", "Deje el calentador roto, los muebles viejos, las cajas del garaje."),
        ("Sin presión, sin compromiso", "Diga que no y quedamos en buenos términos. Preferimos ganarnos una recomendación que forzar un trato."),
        ("Usted elige la fecha de cierre", "Siete días o varios meses. ¿Necesita tiempo para encontrar su próximo hogar? Tómeselo."),
        ("Una compañía de títulos o un abogado de cierre con licencia maneja el dinero", "El agente de cierre le paga directamente; el dinero nunca pasa por nosotros."),
    ]
    plis = "".join("<li>%s<div><b>%s</b><span>%s</span></div></li>" % (icon("check"), esc(a), esc(b)) for a, b in promises)
    faqs = [
        ("¿Cómo sé que esto es legítimo?", "Buena pregunta. Usted nunca nos paga nada y su dinero nunca pasa por nosotros: cada cierre se hace a través de una compañía de títulos o un abogado de cierre con licencia, que guarda los fondos y registra la venta. Puede pedirle a su propio abogado que revise el contrato, y puede retirarse en cualquier momento antes de firmar."),
        ("¿Me van a ofrecer muy poco?", "Una oferta en efectivo es menor que lo que podría venderse una casa ya reparada, porque nosotros asumimos las reparaciones, los costos de mantenerla y el riesgo de revenderla. Lo que puede esperar es un número basado en cifras que le mostramos: ventas recientes cercanas, las reparaciones que asumiríamos y nuestros costos. Si no le funciona, habrá invertido unos minutos y tendrá una cifra en efectivo para comparar con sus otras opciones."),
        ("¿Hay algún cargo?", "No. Sin comisiones ni cargos por servicio, y nosotros pagamos los gastos de cierre habituales. Lo que recibe al cierre es el precio acordado menos lo que deba sobre la propiedad, como la hipoteca, gravámenes y su parte de los impuestos y cuotas de la HOA hasta la fecha de cierre."),
        ("¿En qué condición tiene que estar la casa?", "En cualquiera. Compramos casas con daños por fuego o agua, techos en mal estado, problemas de cimientos, moho, remodelaciones sin terminar y casas llenas de pertenencias. Deje todo lo que no quiera llevarse."),
        ("¿Qué tan rápido pueden cerrar?", "En tan solo 7 días una vez que el título esté limpio. Si necesita más tiempo, elija la fecha que le convenga. Cerramos a través de una compañía de títulos o un abogado con licencia, y usted recibe su dinero al cierre."),
        ("Todavía tengo hipoteca. ¿Pueden comprar de todos modos?", "Sí. Cuando el precio de venta la cubre, la hipoteca, junto con cualquier gravamen o impuesto atrasado, se paga con el dinero de la venta al cierre. Si debe casi lo mismo o más de lo que vale la casa, revisaremos los números con usted honestamente: el prestamista puede tener que aprobar la venta, y un consejero de vivienda aprobado por HUD (800-569-4287) puede ayudarle gratis."),
        ("¿Tengo que aceptar la oferta?", "No. Cada oferta es gratis y sin compromiso. Si poner la casa en venta con un agente probablemente le daría más, se lo diremos. Y si la visita a la casa muestra algo que no sabíamos, le explicamos cualquier cambio por escrito antes de firmar nada, y aún puede decir que no."),
    ]
    fds = "".join("""
      <details><summary>%s</summary><p>%s</p></details>""" % (esc(q), esc(a)) for q, a in faqs)
    mcards = ""
    shorts = {"AZ": "Phoenix, Tucson y los pueblos entre ellos.", "FL": "De Jacksonville a Miami, del Golfo al Atlántico.",
              "TN": "Nashville, Memphis, Knoxville, Chattanooga.", "NC": "Charlotte, el Triángulo, el Triad y la costa."}
    for m in MARKETS:
        links = "".join('<a href="%s">%s</a>' % (c["file"], esc(c["city"])) for c in CITY_PAGES if c["st"] == m["abbr"])
        mcards += """
    <div class="card market"><span class="abbr">%s</span><h3>%s</h3><p>%s</p><div class="cities">%s</div></div>""" % (
            m["abbr"], esc(STATE_ES[m["abbr"]]), esc(shorts[m["abbr"]]), links)
    contact_lines = ""
    if PHONE:
        contact_lines += '<a href="tel:%s">%s<span><span data-phone>%s</span><small>Llame o envíe un texto. Las llamadas pueden ser en inglés; nuestro chat responde en español.</small></span></a>' % (PHONE_TEL, icon("phone"), esc(PHONE))
    if EMAIL:
        contact_lines += '<a href="mailto:%s">%s<span><span data-email>%s</span><small>Normalmente respondemos en menos de 24 horas</small></span></a>' % (esc(EMAIL), icon("mail"), esc(EMAIL))
    body = hero("Compradores directos · Sin comisiones", h1, esc(lede), lang="es") + trust_strip("es") + """
<section class="section" id="how">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Cómo funciona</span><h2>Vender su casa por efectivo es tan fácil como 1, 2, 3</h2>
    <p>Sin agentes, sin banco, sin esperar la aprobación de nadie. Usted trata directamente con el comprador.</p></div>
    <div class="grid-3">%(steps)s
    </div>
    <div class="steps-cta"><a class="btn btn-cta btn-lg" href="#offer">Recibir mi oferta en efectivo</a><small>Gratis, sin compromiso, y puede decir que no en cualquier momento.</small></div>
  </div>
</section>
<section class="section section-soft" id="situations">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Cualquier situación</span><h2>Compramos casas en cualquier situación</h2>
    <p>Sea lo que sea que esté pasando, casi siempre hay una manera limpia de vender. Estas son situaciones comunes en las que una venta en efectivo puede ayudar.</p></div>
    <div class="grid-4">%(sits)s
    </div>
  </div>
</section>
<section class="section about" id="about">
  <div class="wrap">
    <div class="about-art logo-art">%(art)s</div>
    <div>
      <span class="eyebrow">Con quién está tratando</span>
      <h2>Un comprador directo, no un servicio de listados.</h2>
      <p class="lede">%(legal)s compra casas directamente a sus dueños en Arizona, Florida, Tennessee y Carolina del Norte, y revisa propiedades en cualquier parte del país. Cuando nos contacta, habla con las personas que hacen la oferta.</p>
      <p>No somos agentes y no ponemos casas en venta. Le hacemos una oferta, le mostramos cómo llegamos a ella y cerramos con una compañía de títulos o un abogado de cierre con licencia, para que su dinero lo maneje un agente de cierre neutral de principio a fin.</p>
      <div class="contact-card">%(contact)s</div>
    </div>
  </div>
</section>
<section class="section" id="compare">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Compare sus opciones</span><h2>Vender con nosotros vs. vender con un agente</h2>
    <p>Un agente normalmente consigue un precio más alto. Una venta en efectivo cambia parte de ese precio por rapidez, certeza y cero reparaciones. Si poner la casa en venta le conviene más, se lo diremos.</p></div>
    <div class="compare"><table>
      <thead><tr><th scope="col">Lo que le cuesta</th><th scope="col" class="us">Vender a %(brand)s</th><th scope="col">Vender con un agente</th></tr></thead>
      <tbody>%(rows)s</tbody></table></div>
    <p class="compare-note">Las cifras de venta con agente son rangos generales del mercado, no una cotización para su propiedad. Le explicamos cómo llegamos a nuestro número.</p>
  </div>
</section>
<section class="section section-soft" id="promise">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Nuestros compromisos</span><h2>Seis compromisos en cada oferta que hacemos</h2>
    <p>Venderle su casa a una empresa que encontró en internet debería venir con compromisos claros. Estos son los nuestros.</p></div>
    <ul class="promise-list">%(promises)s</ul>
  </div>
</section>
<section class="section" id="markets">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Dónde compramos</span><h2>Cuatro estados principales. Revisamos cualquier dirección.</h2>
    <p>Nos enfocamos en Arizona, Florida, Tennessee y Carolina del Norte. En cualquier otra parte del país, envíenos la dirección y le diremos con honestidad si podemos comprarla.</p></div>
    <div class="grid-4">%(markets)s
      <div class="market-wide"><div><h3>¿Fuera de estos estados?</h3><p>Envíenos la dirección de todos modos. La revisaremos y le diremos claramente, normalmente en 24 horas, si podemos hacer una oferta.</p></div>
      <a class="btn btn-cta" href="#offer">Envíenos la dirección</a></div>
    </div>
  </div>
</section>
<section class="section section-soft" id="faq">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Preguntas</span><h2>Respuestas claras antes de decidir</h2></div>
    <div class="faq">%(faqs)s
    </div>
  </div>
</section>
<section class="offer section" id="offer">
  <div class="wrap">
    <div>
      <span class="eyebrow">Reciba su oferta en efectivo</span>
      <h2>Cuéntenos sobre la propiedad. Nosotros hacemos el resto.</h2>
      <p class="lede">Toma un minuto. Revisamos cada propiedad nosotros mismos y le llamamos con una oferta en efectivo sin compromiso, normalmente en 24 horas.</p>
      <ul><li>%(check)s<span>Sin comisiones ni cargos; pagamos los gastos de cierre habituales</span></li><li>%(check)s<span>Compramos tal como está. Deje lo que no quiera.</span></li><li>%(check)s<span>Cierre en tan solo 7 días, o elija una fecha posterior</span></li><li>%(check)s<span>¿Hipoteca, gravámenes o impuestos atrasados? Se pagan al cierre.</span></li></ul>
      %(talk)s
    </div>
    %(card2)s
  </div>
</section>
""" % dict(steps=step_cards, sits=sit_cards, art=about_art("es"), legal=esc(LEGAL_NAME), contact=contact_lines, brand=esc(BRAND), rows=trs,
           promises=plis, markets=mcards, faqs=fds, check=icon("check"),
           talk=('<p class="talk"><span>¿Prefiere hablar? Llame o envíe un texto al %s</span></p>' % phone_link()) if PHONE else "",
           card2=lead_card(lang="es", card_id="lead-card-2", details=False))
    title = "Compramos Casas por Efectivo en Arizona, Florida, Tennessee y Carolina del Norte | Prime Acre Capital"
    desc = ("Venda su casa rápido por efectivo. Prime Acre Capital LLC compra casas tal como están en Arizona, Florida, Tennessee, "
            "Carolina del Norte y en todo el país. Sin comisiones, sin reparaciones, sin compromiso. Oferta normalmente en 24 horas. Llame o envíe un texto al %s." % PHONE).strip()
    jsonld = graph(org_jsonld(), {"@type": "FAQPage", "inLanguage": "es",
                                   "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]})
    return head(title, desc, "es.html", jsonld, lang="es") + header("es", same_page=True, current="es.html") + body + footer("es") + scripts()


def privacy_sections(lang="en"):
    es = lang == "es"
    tracking = [n for n, on in (("Google Analytics", CFG["ga4"]), ("Google Ads", CFG["ads"]), ("Meta Pixel", CFG["meta"])) if on]
    contact = (" a %s" % EMAIL if es else " at %s" % EMAIL) if EMAIL else ""
    if not es:
        cookies = ("This website doesn't currently use advertising cookies or tracking pixels. If we turn any on, we'll list them "
                   "here, with how to opt out.") if not tracking else (
            "We use %s to measure visits and the results of our ads. These tools set cookies or similar identifiers and collect "
            "pages visited, device and browser details and approximate location. You can opt out of Google Analytics with Google's "
            "browser add-on, adjust ad personalization in your Google and Meta account settings, and block cookies in your browser." % ", ".join(tracking))
        return [
            ("Information we collect", "When you request a cash offer we collect the property address and details you provide, your name, phone "
             "number and email address, your choice about text messages, and anything you add in the notes. With each request we keep a "
             "record of the consent wording you saw and when you sent it. The website and its hosting providers also see standard "
             "technical information such as your IP address, browser and the pages you visit."),
            ("How we use it", "We use your information to look at the property, prepare and explain a cash offer, and talk with you "
             "about a possible sale by phone or email, and by text only if you agreed to texts. We don't use it to make automated "
             "decisions about you."),
            ("Text messages", "If you check the box to receive texts, we text you about your property and your offer. Message "
             "frequency varies. Message and data rates may apply. Reply STOP (or ALTO) to any text to stop, and HELP (or AYUDA) for help. "
             "We don't share mobile numbers or texting consent with third parties or affiliates for their marketing."),
            ("Stopping calls, texts or emails", "You can ask us to stop at any time: reply STOP to a text, tell us in the website "
             "chat, or call or email us. We stop as soon as we can and within the time the law allows."),
            ("Sharing", "We do not sell your personal information. We share it only as needed to complete a sale you agree to, for "
             "example with the title company or closing attorney, and with the service providers below that run this website and "
             "deliver our messages. If anyone other than %s would be the buyer of your property, we will tell you who before "
             "sharing your details with them." % LEGAL_NAME),
            ("Service providers", "Our website is hosted on GitHub Pages. Form requests are delivered to our inbox by FormSubmit. "
             "Our website chat runs on Cloudflare, which also handles our domain's DNS and email routing, and uses Anthropic's AI "
             "to write its replies. These providers process information only to provide their services to us."),
            ("Cookies and advertising", cookies),
            ("Website chat", "Our website chat is an AI assistant. What you type in the chat is processed by our AI provider (Anthropic) "
             "and our hosting provider (Cloudflare) so the assistant can reply, check open call times, and send the details you share "
             "to our team. Please don't share sensitive information such as Social Security, bank, or loan account numbers in the "
             "chat. Chat messages are not used to make decisions about you; a person from our team reviews every request you send "
             "through the chat. If you ask in the chat for us to stop calling, texting or emailing you, that request is passed to our "
             "team and honored. After you send your details, anything else you type in the chat is passed to our team as well."),
            ("Your choices", "You can ask us to correct or delete your information, or to stop contacting you, at any time. We keep "
             "lead information only as long as needed to evaluate and complete a potential purchase and to meet legal requirements, "
             "including records of consent."),
            ("Contact", "Questions about this policy can be sent to %s%s." % (LEGAL_NAME, contact or " using the contact details on this site")),
        ]
    cookies = ("Este sitio no usa actualmente cookies de publicidad ni píxeles de seguimiento. Si activamos alguno, lo indicaremos aquí "
               "junto con la forma de desactivarlo.") if not tracking else (
        "Usamos %s para medir las visitas y los resultados de nuestros anuncios. Estas herramientas usan cookies o identificadores "
        "similares y recopilan las páginas visitadas, datos del dispositivo y del navegador y la ubicación aproximada. Puede desactivar "
        "Google Analytics con el complemento de Google, ajustar la publicidad personalizada en sus cuentas de Google y Meta, y bloquear "
        "cookies en su navegador." % ", ".join(tracking))
    return [
        ("Información que recopilamos", "Cuando solicita una oferta en efectivo recopilamos la dirección y los datos de la propiedad, su "
         "nombre, teléfono y correo electrónico, su decisión sobre los mensajes de texto y lo que agregue en las notas. Con cada solicitud "
         "guardamos un registro del texto de consentimiento que vio y de cuándo la envió. El sitio y sus proveedores de alojamiento también "
         "ven información técnica estándar, como su dirección IP, su navegador y las páginas que visita."),
        ("Cómo la usamos", "Usamos su información para revisar la propiedad, preparar y explicarle una oferta en efectivo y hablar con usted "
         "sobre una posible venta por teléfono o correo electrónico, y por mensaje de texto solo si usted lo aceptó. No la usamos para tomar "
         "decisiones automatizadas sobre usted."),
        ("Mensajes de texto", "Si marca la casilla para recibir mensajes de texto, le escribiremos sobre su propiedad y su oferta. La "
         "frecuencia de los mensajes varía. Pueden aplicarse tarifas de mensajes y datos. Responda ALTO (o STOP) a cualquier mensaje para "
         "cancelarlos y AYUDA (o HELP) para recibir ayuda. No compartimos números de celular ni consentimientos para mensajes de texto con "
         "terceros o afiliados para su publicidad."),
        ("Cómo dejar de recibir llamadas, mensajes o correos", "Puede pedirnos que paremos en cualquier momento: responda ALTO a un mensaje, "
         "díganoslo en el chat del sitio, o llámenos o escríbanos. Paramos lo antes posible y dentro del plazo que exige la ley."),
        ("Con quién la compartimos", "No vendemos su información personal. La compartimos solo cuando es necesario para completar una venta "
         "que usted acepte, por ejemplo con la compañía de títulos o el abogado de cierre, y con los proveedores de servicios que se indican "
         "abajo. Si alguien que no sea %s fuera a comprar su propiedad, le diremos quién es antes de compartir sus datos." % LEGAL_NAME),
        ("Proveedores de servicios", "Nuestro sitio está alojado en GitHub Pages. FormSubmit entrega las solicitudes del formulario a "
         "nuestro correo. El chat del sitio funciona en Cloudflare, que también maneja el DNS y el reenvío de correo de nuestro dominio, y usa "
         "la inteligencia artificial de Anthropic para escribir sus respuestas. Estos proveedores procesan la información solo para "
         "prestarnos sus servicios."),
        ("Cookies y publicidad", cookies),
        ("Chat del sitio", "El chat de nuestro sitio es un asistente de inteligencia artificial. Lo que escribe en el chat lo procesan "
         "nuestro proveedor de IA (Anthropic) y nuestro proveedor de alojamiento (Cloudflare) para que el asistente pueda responder, ver "
         "horarios disponibles para llamadas y enviar a nuestro equipo los datos que usted comparta. No comparta información delicada como "
         "su número de Seguro Social o números de cuentas bancarias o de préstamos. Una persona de nuestro equipo revisa cada solicitud que "
         "envíe por el chat."),
        ("Sus opciones", "Puede pedirnos en cualquier momento que corrijamos o borremos su información, o que dejemos de contactarlo. "
         "Guardamos la información solo el tiempo necesario para evaluar y completar una posible compra y para cumplir con la ley, "
         "incluidos los registros de consentimiento."),
        ("Contacto", "Puede enviar sus preguntas sobre esta política a %s%s." % (LEGAL_NAME, contact or " con los datos de contacto de este sitio")),
    ]


def page_privacy(lang="en"):
    es = lang == "es"
    path = "privacidad.html" if es else "privacy.html"
    title = ("Política de privacidad | %s" if es else "Privacy Policy | %s") % BRAND
    desc = (("Cómo %s recopila, usa y protege la información que comparte al pedir una oferta en efectivo." if es else
             "How %s collects, uses and protects the information you share when requesting a cash offer.") % LEGAL_NAME)
    trail = [("Inicio" if es else "Home", "es.html" if es else "index.html"), ("Privacidad" if es else "Privacy policy", None)]
    items = "".join("<details open><summary>%s</summary><p>%s</p></details>" % (esc(h), esc(t)) for h, t in privacy_sections(lang))
    body = page_hero("Política de privacidad" if es else "Privacy policy",
                     esc("Qué recopilamos y cómo lo usamos" if es else "What we collect and how we use it"),
                     esc("Última actualización: octubre de 2026" if es else "Last updated: October 2026"), trail)
    body += """<section class="section" id="privacy">
  <div class="wrap">
    <div class="faq privacy">%s</div>
  </div>
</section>
""" % items
    form = lead_section_es() if es else offer_form()
    return (head(title, desc, path, graph(org_jsonld(), crumbs_jsonld(trail, SITE_URL + path)), lang=lang)
            + header(lang, same_page=False, current=path) + body + form + footer(lang) + scripts())


def lead_section_es():
    return """<section class="offer section" id="offer">
  <div class="wrap">
    <div>
      <span class="eyebrow">Reciba su oferta en efectivo</span>
      <h2>Cuéntenos sobre la propiedad. Nosotros hacemos el resto.</h2>
      <p class="lede">Toma un minuto. Le llamamos con una oferta en efectivo sin compromiso, normalmente en 24 horas.</p>
    </div>
    %s
  </div>
</section>
""" % lead_card(lang="es", card_id="lead-card-2", details=False)


LASTMOD = os.path.join(ROOT, "tools", "lastmod.json")


def lastmod_dates(pages):
    """A page's date changes only when its HTML changes (kept in tools/lastmod.json)."""
    try:
        with open(LASTMOD, encoding="utf-8") as f:
            old = json.load(f)
    except (OSError, ValueError):
        old = {}
    today = datetime.date.today().isoformat()
    new = {}
    for name, doc in sorted(pages.items()):
        h = hashlib.sha256(doc.encode("utf-8")).hexdigest()[:16]
        prev = old.get(name) or {}
        new[name] = {"hash": h, "lastmod": prev.get("lastmod") if prev.get("hash") == h else today}
    with open(LASTMOD, "w", encoding="utf-8") as f:
        json.dump(new, f, indent=1, sort_keys=True)
        f.write("\n")
    return {k: v["lastmod"] for k, v in new.items()}


def sitemap(paths, dates=None):
    dates = dates or {}
    urls = "".join("  <url><loc>%s</loc>%s</url>\n" % (esc(SITE_URL + ("" if p == "index.html" else p)),
                                                       ("<lastmod>%s</lastmod>" % dates[p]) if dates.get(p) else "") for p in paths)
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % urls


# Claims the live site must never make (the owner's rules and the research do-not-copy list). The build stops on any.
BANNED_LIVE = [r"\bguarantee", r"\btop dollar\b", r"#1\b", r"\bas seen on\b", r"hablamos espa", r"\bvetted (local )?(buyer|partner)",
               r"7 days a week", r"7 días de la semana", r"AggregateRating", r"\bbuying partners\b", r"compradores locales asociados",
               r"stop (your |the )?foreclosure", r"extra time after closing"]


def check_claims(pages):
    bad = []
    for name, doc in sorted(pages.items()):
        text = re.sub(r"(?is)<script(?![^>]*ld\+json)[^>]*>.*?</script>|<style.*?</style>", " ", doc)
        text = html.unescape(re.sub(r"<[^>]+>", " ", text))
        for pat in BANNED_LIVE:
            m = re.search(pat, text, re.I)
            if m:
                bad.append("%s: ...%s..." % (name, " ".join(text[max(0, m.start() - 50):m.end() + 50].split())))
    if bad:
        print("\n".join(bad))
        raise SystemExit("build stopped: the pages above make claims the site must not make (BANNED_LIVE in tools/build.py)")


# ---------------------------------------------------------------- artifact build


def artifact_build(out_path):
    """Single-file home page: no document skeleton, CSS/config/JS inlined, other pages become in-page anchors."""
    doc = page_index()
    with open(os.path.join(SITE, "assets", "style.css"), encoding="utf-8") as f:
        css = f.read()
    with open(os.path.join(SITE, "config.js"), encoding="utf-8") as f:
        config = f.read()
    with open(os.path.join(SITE, "assets", "app.js"), encoding="utf-8") as f:
        app = f.read()
    with open(os.path.join(SITE, "assets", "chat.css"), encoding="utf-8") as f:
        css += "\n" + f.read()
    with open(os.path.join(SITE, "assets", "chat.js"), encoding="utf-8") as f:
        app += "\n" + f.read()

    body = doc.split("<body>\n", 1)[1].rsplit('<script src="config.js"></script>', 1)[0]
    title = re.search(r"<title>(.*?)</title>", doc).group(1)
    jsonld = re.search(r'<script type="application/ld\+json">.*?</script>', doc, re.S).group(0)

    for m in MARKETS:
        body = body.replace('href="%s.html"' % m["slug"], 'href="#%s"' % m["slug"])
    for c in CITY_PAGES:
        body = body.replace('href="%s"' % c["file"], 'href="#markets"')
    body = body.replace('href="index.html#', 'href="#').replace('href="index.html"', 'href="#top"')
    body = body.replace('<li><a href="privacy.html">Privacy policy</a></li>', '')
    body = re.sub(r'<span class="lang">.*?</span>', '', body)
    body = re.sub(r' (?:srcset|sizes)="[^"]*"', '', body)
    body = body.replace('<a class="sr-only" href="#offer">Skip to the cash offer form</a>\n', "")
    if os.path.exists(HERO_PHOTO):
        with open(HERO_PHOTO, "rb") as f:
            data = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode("ascii")
        body = body.replace("url(assets/img/hero.jpg)", "url(%s)" % data)
    def data_uri(rel):
        mime = {".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2"}[os.path.splitext(rel)[1]]
        with open(os.path.join(SITE, rel), "rb") as f:
            return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode("ascii"))
    for rel in sorted(set(re.findall(r'assets/img/[\w.-]+\.(?:png|jpg|webp)', body))):
        body = body.replace(rel, data_uri(rel))
    for rel in sorted(set(re.findall(r'url\("((?:img|fonts)/[\w.-]+\.(?:png|jpg|webp|woff2))"\)', css))):
        css = css.replace('url("%s")' % rel, 'url("%s")' % data_uri("assets/" + rel))

    out = ('<title>%s</title>\n<style>\n%s\n</style>\n%s\n%s\n<script>\n%s\n</script>\n<script>\n%s\n</script>\n'
           % (title, css, jsonld, body, config, app))
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

    pages = {"index.html": page_index(), "privacy.html": page_privacy(), "privacidad.html": page_privacy("es"), "es.html": page_es()}
    for slug in PAGE_DATA:
        pages[href(slug)] = content_page(slug)
    for m in MARKETS:
        pages[m["slug"] + ".html"] = page_state(m)
    for c in CITY_PAGES:
        pages[c["file"]] = page_city(c)
    check_claims(pages)
    for name, content in pages.items():
        with open(os.path.join(SITE, name), "w", encoding="utf-8") as f:
            f.write(content)
    for name in sorted(os.listdir(SITE)):  # pages this build no longer makes
        if name.endswith(".html") and name not in pages:
            os.remove(os.path.join(SITE, name))
            print("removed stale page %s" % name)
    public = [p for p, html_ in pages.items() if p not in ("privacy.html", "privacidad.html") and 'name="robots" content="noindex' not in html_]
    with open(os.path.join(SITE, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap(public, lastmod_dates(pages)))
    with open(os.path.join(SITE, "robots.txt"), "w", encoding="utf-8") as f:
        f.write("User-agent: *\nAllow: /\nSitemap: %ssitemap.xml\n" % SITE_URL)
    open(os.path.join(SITE, ".nojekyll"), "w").close()
    print("built %d pages + sitemap.xml, robots.txt" % len(pages))


if __name__ == "__main__":
    sys.exit(main())
