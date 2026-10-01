#!/usr/bin/env python3
"""Build the Prime Acre Capital site.

    python3 tools/build.py              # writes site/*.html, sitemap.xml, robots.txt
    python3 tools/build.py --artifact OUT.html
                                        # single-file build of the home page with CSS,
                                        # config and JS inlined (for a hosted preview)

All copy and page data live in this file; styles in site/assets/style.css and
behavior in site/assets/app.js. Contact details come from site/config.js.
Drop a photo at site/assets/img/hero.jpg and the hero switches to it.
"""
import argparse
import base64
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
        "tag": "We buy houses for cash",
        "nav": [("How it works", "#how"), ("Where we buy", "#markets"), ("FAQ", "#faq"), ("Contact", "#about")],
        "cta": "Get My Cash Offer", "cta_arrow": "Get My Cash Offer →",
        "skip": "Skip to the cash offer form",
        "card_title": "Get Your Fair Cash Offer",
        "card_sub": "Start below. It takes about 30 seconds and there's no obligation.",
        "f_address": "Property address", "f_phone": "Phone", "f_email": "Email", "optional": "(optional)",
        "fine": "No obligation. We never sell or share your information.",
        "done_h": "You're all set!",
        "done_p": "We're pulling up the property now. Expect a call or text%s within 24 hours with your cash offer. Save the number so you don't miss us.",
        "done_more": "Add details to speed up my offer", "done_alt": "Or call or text",
        "bullets": ["Fair, written cash offer within 24 hours", "No fees, no commissions, no closing costs", "Close in as little as 7 days, or on your date"],
        "talk": "Prefer to talk? Call or text",
        "trust": [("clock", "Offer in 24 hours", "In writing, with the math behind it"),
                  ("dollar", "$0 fees or commissions", "We pay the closing costs too"),
                  ("calendar", "Close in 7 days", "Or pick any date that suits you"),
                  ("house", "Any condition", "Repairs, tenants, liens: we handle it")],
        "foot_where": "Where we buy", "foot_cities": "Popular cities", "foot_company": "Company",
        "foot_blurb": "%s buys houses directly from owners in Arizona, Florida, Tennessee and North Carolina, and nationwide through local buying partners. Fair cash offers, no fees, closing on your schedule.",
        "foot_links": [("How it works", "index.html#how"), ("Contact us", "index.html#about"), ("Questions", "index.html#faq"), ("Get a cash offer", "#offer"), ("Privacy policy", "privacy.html")],
        "sell_in": "Sell a house in %s", "nationwide": "Nationwide", "reviews": "Read our Google reviews",
        "legal": "%s is a real estate investment company that purchases property directly from owners. It is not a listing service. All offers are no-obligation. Offer and closing timelines describe typical transactions and depend on title, occupancy and local requirements. We follow federal and state Fair Housing laws.",
        "rights": "All rights reserved.", "call": "Call", "text": "Text",
    },
    "es": {
        "serving": "Compramos casas en Arizona, Florida, Tennessee, Carolina del Norte y en todo el país",
        "call_or_text": "Llame o envíe un texto al", "text_us": "Envíenos un texto", "lang_switch": ("English", "index.html"),
        "tag": "Compramos casas por efectivo",
        "nav": [("Cómo funciona", "#how"), ("Dónde compramos", "#markets"), ("Preguntas", "#faq"), ("Contacto", "#about")],
        "cta": "Recibir mi oferta", "cta_arrow": "Recibir mi oferta →",
        "skip": "Ir al formulario de oferta",
        "card_title": "Reciba su oferta justa en efectivo",
        "card_sub": "Empiece abajo. Toma unos 30 segundos y no hay ningún compromiso.",
        "f_address": "Dirección de la propiedad", "f_phone": "Teléfono", "f_email": "Correo electrónico", "optional": "(opcional)",
        "fine": "Sin compromiso. Nunca vendemos ni compartimos su información.",
        "done_h": "¡Listo!",
        "done_p": "Ya estamos revisando la propiedad. Espere una llamada o un mensaje de texto%s en las próximas 24 horas con su oferta en efectivo. Guarde el número para no perder nuestra llamada.",
        "done_more": "", "done_alt": "O llame o envíe un texto al",
        "bullets": ["Oferta justa por escrito en 24 horas", "Sin comisiones ni gastos de cierre", "Cierre en tan solo 7 días, o en la fecha que usted elija"],
        "talk": "¿Prefiere hablar? Llame o envíe un texto al",
        "trust": [("clock", "Oferta en 24 horas", "Por escrito, con los números detrás"),
                  ("dollar", "$0 en comisiones", "También pagamos los gastos de cierre"),
                  ("calendar", "Cierre en 7 días", "O en la fecha que mejor le convenga"),
                  ("house", "Cualquier condición", "Reparaciones, inquilinos, gravámenes: nos encargamos")],
        "foot_where": "Dónde compramos", "foot_cities": "Ciudades populares", "foot_company": "Empresa",
        "foot_blurb": "%s compra casas directamente a sus dueños en Arizona, Florida, Tennessee y Carolina del Norte, y en todo el país a través de compradores locales asociados. Ofertas justas en efectivo, sin comisiones, con cierre en su fecha.",
        "foot_links": [("Cómo funciona", "#how"), ("Contacto", "#about"), ("Preguntas", "#faq"), ("Recibir una oferta", "#offer"), ("Política de privacidad", "privacy.html")],
        "sell_in": "Vender una casa en %s", "nationwide": "Todo el país", "reviews": "Lea nuestras reseñas en Google",
        "legal": "%s es una empresa de inversión inmobiliaria que compra propiedades directamente a sus dueños. No es un servicio de listados. Todas las ofertas son sin compromiso. Los plazos de oferta y cierre describen transacciones típicas y dependen del título, la ocupación y los requisitos locales. Cumplimos con las leyes federales y estatales de Vivienda Justa.",
        "rights": "Todos los derechos reservados.", "call": "Llamar", "text": "Texto",
    },
}
STATE_ES = {"AZ": "Arizona", "FL": "Florida", "TN": "Tennessee", "NC": "Carolina del Norte"}

FONTS = ("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800"
         "&family=Figtree:wght@400;500;600;700&display=swap")

FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E"
           "%3Crect width='40' height='40' rx='9' fill='%231E4FA3'/%3E"
           "%3Cpath d='M8 21l12-10 12 10v11H8z' fill='%23fff'/%3E"
           "%3Crect x='17' y='24' width='6' height='8' fill='%23F59E0B'/%3E%3C/svg%3E")

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
             "A new job in another city doesn't wait for a 90-day listing. We can close in as little as 7 days, and can often arrange extra time after closing if you need it."),
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


BRAND_MARK = ('<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true">'
              '<rect width="40" height="40" rx="9" fill="var(--brand)"/>'
              '<path d="M8 21l12-10 12 10v11H8z" fill="#fff"/>'
              '<rect x="17" y="24" width="6" height="8" fill="var(--cta)"/></svg>')

STREET_ART = """<svg viewBox="0 0 1600 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <circle cx="1400" cy="70" r="46" fill="#FBBF24" opacity=".85"/>
  <g fill="#FFFFFF" opacity=".9">
    <ellipse cx="300" cy="80" rx="70" ry="22"/><ellipse cx="330" cy="66" rx="40" ry="24"/><ellipse cx="270" cy="70" rx="34" ry="20"/>
    <ellipse cx="1000" cy="60" rx="60" ry="18"/><ellipse cx="1025" cy="48" rx="34" ry="20"/>
  </g>
  <rect x="0" y="262" width="1600" height="58" fill="#86C58A"/>
  <rect x="0" y="262" width="1600" height="8" fill="#A4D7A6"/>
  <rect x="0" y="298" width="1600" height="22" fill="#D9E2EC"/>
  <g>
    <rect x="110" y="170" width="210" height="92" fill="#E3EEF9"/>
    <polygon points="90,175 215,100 340,175" fill="#5B7B9C"/>
    <rect x="200" y="128" width="30" height="26" rx="2" fill="#BFDBF7" stroke="#9DBBDD" stroke-width="2"/>
    <rect x="100" y="206" width="230" height="8" fill="#5B7B9C"/>
    <rect x="112" y="214" width="6" height="48" fill="#F8FAFC"/><rect x="312" y="214" width="6" height="48" fill="#F8FAFC"/>
    <rect x="196" y="214" width="38" height="48" rx="2" fill="#F59E0B"/>
    <rect x="134" y="218" width="36" height="30" rx="2" fill="#BFDBF7" stroke="#9DBBDD" stroke-width="2"/>
    <rect x="260" y="218" width="36" height="30" rx="2" fill="#BFDBF7" stroke="#9DBBDD" stroke-width="2"/>
  </g>
  <g>
    <rect x="420" y="140" width="230" height="122" fill="#FFFFFF"/>
    <rect x="600" y="70" width="22" height="50" fill="#9AA8B8"/>
    <polygon points="400,145 535,55 670,145" fill="#2F4A6B"/>
    <rect x="513" y="198" width="44" height="64" rx="2" fill="#F59E0B"/>
    <circle cx="548" cy="232" r="2.5" fill="#1B1200"/>
    <rect x="445" y="160" width="40" height="36" rx="2" fill="#BFDBF7" stroke="#9DBBDD" stroke-width="2"/>
    <rect x="585" y="160" width="40" height="36" rx="2" fill="#BFDBF7" stroke="#9DBBDD" stroke-width="2"/>
    <rect x="445" y="212" width="40" height="36" rx="2" fill="#BFDBF7" stroke="#9DBBDD" stroke-width="2"/>
    <rect x="585" y="212" width="40" height="36" rx="2" fill="#BFDBF7" stroke="#9DBBDD" stroke-width="2"/>
    <rect x="505" y="262" width="60" height="6" fill="#C9D4E0"/>
    <rect x="520" y="268" width="30" height="30" fill="#D9E2EC"/>
  </g>
  <g>
    <rect x="712" y="226" width="5" height="40" fill="#8B5A2B"/>
    <rect x="684" y="202" width="62" height="30" rx="4" fill="#FFFFFF" stroke="#2F4A6B" stroke-width="2"/>
    <text x="715" y="223" text-anchor="middle" font-family="Plus Jakarta Sans, Arial, sans-serif" font-weight="800" font-size="15" fill="#2F4A6B">SOLD</text>
  </g>
  <g><rect x="790" y="222" width="14" height="42" fill="#8B5A2B"/><circle cx="797" cy="196" r="46" fill="#4E9A5A"/><circle cx="772" cy="212" r="26" fill="#5DAA69"/><circle cx="822" cy="214" r="24" fill="#5DAA69"/></g>
  <g fill="#5E9F6E"><rect x="880" y="186" width="20" height="78" rx="10"/><rect x="862" y="206" width="12" height="36" rx="6"/><rect x="862" y="230" width="20" height="10" rx="5"/><rect x="906" y="196" width="12" height="40" rx="6"/><rect x="896" y="224" width="20" height="10" rx="5"/></g>
  <g>
    <rect x="980" y="178" width="250" height="84" fill="#F6E7D3"/>
    <polygon points="960,182 1105,108 1250,182" fill="#C96A3B"/>
    <rect x="1230" y="206" width="110" height="56" fill="#F6E7D3"/>
    <polygon points="1222,208 1285,166 1348,208" fill="#C96A3B"/>
    <rect x="1246" y="222" width="78" height="40" rx="2" fill="#E3E8EE" stroke="#C9D4E0" stroke-width="2"/>
    <rect x="1088" y="206" width="36" height="56" rx="2" fill="#2F4A6B"/>
    <rect x="1010" y="200" width="40" height="34" rx="2" fill="#BFDBF7" stroke="#9DBBDD" stroke-width="2"/>
    <rect x="1160" y="200" width="40" height="34" rx="2" fill="#BFDBF7" stroke="#9DBBDD" stroke-width="2"/>
    <rect x="1250" y="262" width="70" height="36" fill="#D9E2EC"/>
  </g>
  <g fill="#6FB36F"><ellipse cx="380" cy="258" rx="26" ry="12"/><ellipse cx="950" cy="258" rx="22" ry="11"/><ellipse cx="1400" cy="256" rx="30" ry="13"/><ellipse cx="60" cy="258" rx="28" ry="12"/></g>
  <g><path d="M1480 264 C1478 230 1486 200 1500 172" stroke="#8B5A2B" stroke-width="9" fill="none" stroke-linecap="round"/>
    <g fill="#3F8F5A"><ellipse cx="1480" cy="168" rx="34" ry="11" transform="rotate(-30 1480 168)"/><ellipse cx="1520" cy="166" rx="34" ry="11" transform="rotate(25 1520 166)"/><ellipse cx="1500" cy="150" rx="12" ry="30"/><ellipse cx="1470" cy="186" rx="30" ry="10" transform="rotate(10 1470 186)"/><ellipse cx="1530" cy="186" rx="30" ry="10" transform="rotate(-15 1530 186)"/></g></g>
</svg>"""

ABOUT_ART = """<svg viewBox="0 0 360 300" aria-hidden="true" focusable="false">
  <circle cx="180" cy="150" r="128" fill="var(--surface)" opacity=".8"/>
  <rect x="110" y="140" width="140" height="100" rx="6" fill="var(--surface)" stroke="var(--brand)" stroke-width="4"/>
  <polygon points="94,146 180,82 266,146" fill="var(--brand)"/>
  <rect x="164" y="186" width="32" height="54" rx="3" fill="#F59E0B"/>
  <rect x="128" y="160" width="26" height="24" rx="2" fill="#BFDBF7" stroke="var(--brand)" stroke-width="3"/>
  <rect x="206" y="160" width="26" height="24" rx="2" fill="#BFDBF7" stroke="var(--brand)" stroke-width="3"/>
  <circle cx="264" cy="96" r="30" fill="#1E9E5A" stroke="#FFFFFF" stroke-width="5"/>
  <path d="M250 96l10 10 18-20" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <g transform="translate(62 224) rotate(-30)"><circle cx="0" cy="0" r="16" fill="none" stroke="#F59E0B" stroke-width="7"/><rect x="14" y="-4" width="60" height="8" rx="4" fill="#F59E0B"/><rect x="56" y="-4" width="8" height="18" rx="2" fill="#F59E0B"/><rect x="42" y="-4" width="8" height="14" rx="2" fill="#F59E0B"/></g>
  <g transform="translate(286 226) rotate(12)"><rect x="-40" y="-22" width="80" height="44" rx="6" fill="#86C58A" stroke="#1E9E5A" stroke-width="3"/><circle cx="0" cy="0" r="12" fill="none" stroke="#1E9E5A" stroke-width="3"/><text x="0" y="5" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="14" fill="#1E9E5A">$</text></g>
</svg>"""


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


def head(title, desc, path, jsonld, lang="en"):
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
%(alternates)s<meta property="og:type" content="website">
<meta property="og:site_name" content="%(brand)s">
<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(url)s">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#10233F">
<link rel="icon" href="%(favicon)s">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="%(fonts)s">
<link rel="stylesheet" href="assets/style.css">
<script type="application/ld+json">%(jsonld)s</script>
</head>
<body>
""" % dict(title=esc(title), desc=esc(desc), url=esc(url), brand=esc(BRAND), favicon=FAVICON,
           fonts=esc(FONTS), jsonld=json.dumps(jsonld, ensure_ascii=False), lang=lang, alternates=alternates)


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


def header(lang="en", same_page=False):
    t = T[lang]
    phone_btn = ('<a class="btn btn-outline" href="tel:%s">%s<span data-phone>%s</span></a>' % (PHONE_TEL, icon("phone"), esc(PHONE))) if PHONE else ""
    prefix = "" if same_page else "index.html"
    links = "".join('<a href="%s%s">%s</a>' % (prefix, href, esc(label)) for label, href in t["nav"])
    return """<a class="sr-only" href="#offer">%(skip)s</a>
%(topbar)s<header class="site-header" id="top">
  <div class="wrap">
    <a class="brand" href="%(home)s" aria-label="%(brand)s">
      %(mark)s
      <span>%(brand)s<small>%(tag)s</small></span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
    <nav class="nav" id="nav" aria-label="Main">
      %(links)s
      %(phone_btn)s
      <a class="btn btn-cta" href="#offer">%(cta)s</a>
    </nav>
  </div>
</header>
""" % dict(skip=esc(t["skip"]), topbar=topbar(lang), home="es.html" if lang == "es" else "index.html", brand=esc(BRAND),
           mark=BRAND_MARK, tag=esc(t["tag"]), links=links, phone_btn=phone_btn, cta=esc(t["cta"]))


def lead_card(state="", city="", lang="en", card_id="lead-card", details=True):
    t = T[lang]
    hidden = ""
    if state:
        hidden += '<input type="hidden" name="state" value="%s">' % esc(state)
    if city:
        hidden += '<input type="hidden" name="city" value="%s">' % esc(city)
    placeholder = "123 Main St, %s" % (city + ", " + state if city else (MARKET_BY_ABBR[state]["name"] if state else "Phoenix, AZ"))
    done_phone = ((' from <b data-phone>%s</b>' if lang == "en" else ' del <b data-phone>%s</b>') % esc(PHONE)) if PHONE else ""
    alt = ""
    if PHONE or EMAIL:
        alt = '<p class="alt">%s %s%s</p>' % (esc(t["done_alt"]), phone_link() if PHONE else "", (" · " + email_link()) if (PHONE and EMAIL) else (email_link() if EMAIL else ""))
    more = ('<a class="btn btn-outline" href="#offer" data-add-details>%s</a>' % esc(t["done_more"])) if (details and t["done_more"]) else ""
    uid = card_id.replace("lead-card", "h")
    return """<div class="lead-card" id="%(card_id)s">
      <h2>%(title)s</h2>
      <p class="sub">%(sub)s</p>
      <form class="hero-form" novalidate autocomplete="on">
        <div class="field">
          <label for="%(uid)s-address">%(f_address)s</label>
          <input id="%(uid)s-address" name="address" type="text" required autocomplete="street-address" placeholder="%(ph)s">
        </div>
        <div class="row-2">
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
        <p class="error-msg" data-form-error hidden></p>
        <button class="btn btn-cta btn-lg" type="submit">%(cta)s</button>
        <p class="fine">%(lock)s%(fine)s</p>
      </form>
      <div class="lead-done" hidden>
        %(okmark)s
        <h3>%(done_h)s</h3>
        <p>%(done_p)s</p>
        %(more)s
        %(alt)s
      </div>
    </div>""" % dict(card_id=card_id, uid=uid, title=esc(t["card_title"]), sub=esc(t["card_sub"]), f_address=esc(t["f_address"]),
                     f_phone=esc(t["f_phone"]), f_email=esc(t["f_email"]), optional=esc(t["optional"]), ph=esc(placeholder),
                     hidden=hidden, cta=esc(t["cta_arrow"]), lock=icon("lock"), fine=esc(t["fine"]), okmark=icon("check-circle", "mark"),
                     done_h=esc(t["done_h"]), done_p=esc(t["done_p"]) % done_phone, more=more, alt=alt)


def hero(eyebrow, h1, lede, state="", city="", lang="en"):
    t = T[lang]
    has_photo = os.path.exists(HERO_PHOTO)
    photo = '<div class="hero-photo" style="background-image:url(assets/img/hero.jpg)"></div>' if has_photo else ""
    street = "" if has_photo else '<div class="street">%s</div>' % STREET_ART
    talk = ('<p class="talk">%s %s</p>' % (esc(t["talk"]), phone_link())) if PHONE else ""
    bullets = "".join('<li>%s<span>%s</span></li>' % (icon("check"), esc(b)) for b in t["bullets"])
    return """<section class="hero%(cls)s">
  %(photo)s
  <div class="wrap">
    <div>
      <span class="eyebrow-pill">%(eyebrow)s</span>
      <h1>%(h1)s</h1>
      <p class="lede">%(lede)s</p>
      <ul class="bullets">%(bullets)s</ul>
      %(talk)s
    </div>
    %(card)s
  </div>
  %(street)s
</section>
""" % dict(cls=" has-photo" if has_photo else "", photo=photo, eyebrow=esc(eyebrow), h1=h1, lede=esc(lede),
           bullets=bullets, talk=talk, card=lead_card(state, city, lang), street=street)


def trust_strip(lang="en"):
    items = T[lang]["trust"]
    cards = "".join("""
    <div class="trust">%s<div><b>%s</b><span>%s</span></div></div>""" % (icon(k), esc(t), esc(d)) for k, t, d in items)
    return """<div class="trust-strip" aria-label="What you get">
  <div class="wrap">%s
  </div>
</div>
""" % cards


def how():
    steps = [
        ("phone", "Tell us about your house", "Fill out the short form or give us a call. It takes about a minute, and nobody will pressure you.", "Takes 60 seconds"),
        ("pen", "Get your cash offer", "We look at the property, nearby sales and the repairs it needs, then send you a written offer with the numbers behind it.", "Within 24 hours"),
        ("calendar", "Pick your closing day", "Accept when you're ready. Close in as little as 7 days through a licensed title company, or take the time you need.", "7 days or your date"),
    ]
    cards = "".join("""
    <div class="card step">
      <span class="num">%d</span>
      %s
      <h3>%s</h3>
      <p>%s</p>
      <span class="when">%s</span>
    </div>""" % (i + 1, icon(k, "ico"), esc(t), esc(d), esc(w)) for i, (k, t, d, w) in enumerate(steps))
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
    </div>
  </div>
</section>
""" % cards


def situations():
    items = [
        ("clock", "Facing foreclosure", "Behind on payments or already have a sale date? A cash sale before the auction can pay off the lender and help you avoid a foreclosure on your record."),
        ("doc", "Inherited a house", "Probate, out-of-state heirs, a house full of belongings. Take what you want and leave the rest to us."),
        ("key", "Tired of being a landlord", "Problem tenants, late rent, constant repairs. We buy with tenants in place and honor the lease."),
        ("users", "Divorce or separation", "A clean, fast sale with one number everyone can agree on, and a closing date that works for both of you."),
        ("arrow", "Relocating or job change", "Close before you leave town, with a date that matches your move instead of a listing calendar."),
        ("tool", "Major repairs or code violations", "Roof, foundation, mold, fire or water damage, open permits. We buy it exactly as it is."),
        ("dollar", "Behind on taxes or liens", "Back taxes, HOA liens and judgments are paid off from the sale at closing. You don't bring money to the table."),
        ("house", "Vacant or unwanted property", "A second home, a lot, or a house that's been sitting for years. Turn it into cash without a renovation first."),
    ]
    cards = "".join("""
    <div class="card sit">%s<div><h3>%s</h3><p>%s</p></div></div>""" % (icon(k), esc(t), esc(d)) for k, t, d in items)
    return """<section class="section section-soft" id="situations">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">Any situation</span>
      <h2>We buy houses in any situation</h2>
      <p>Whatever is going on, you're not the first person to bring it to us. Here are the situations we help with most.</p>
    </div>
    <div class="grid-4">%s
    </div>
  </div>
</section>
""" % cards


def about():
    lines = ""
    if PHONE:
        lines += '<a href="tel:%s">%s<span><span data-phone>%s</span><small>Call or text, 7 days a week</small></span></a>' % (PHONE_TEL, icon("phone"), esc(PHONE))
    if EMAIL:
        lines += '<a href="mailto:%s">%s<span><span data-email>%s</span><small>We reply within 24 hours</small></span></a>' % (esc(EMAIL), icon("mail"), esc(EMAIL))
    if REVIEWS_URL:
        lines += '<a href="%s" target="_blank" rel="noopener">%s<span>%s<small>Google</small></span></a>' % (esc(REVIEWS_URL), icon("star"), esc(T["en"]["reviews"]))
    art = ('<img src="assets/img/team.jpg" alt="The %s team" loading="lazy">' % esc(BRAND)) if os.path.exists(TEAM_PHOTO) else ABOUT_ART
    return """<section class="section about" id="about">
  <div class="wrap">
    <div class="about-art%(photo)s">%(art)s</div>
    <div>
      <span class="eyebrow">Who you're dealing with</span>
      <h2>A direct buyer. Not a middleman, not a call center.</h2>
      <p class="lede">%(legal)s buys houses directly from owners across Arizona, Florida, Tennessee and North Carolina, and nationwide through local buying partners. When you reach out, you talk to the people making the offer.</p>
      <p>We're not agents, and we're not going to list your house or shop your information around. We make you a real offer, show you how we got there, and close through a licensed title company so your money is protected from start to finish.</p>
      <div class="contact-card">%(lines)s</div>
    </div>
  </div>
</section>
""" % dict(art=art, photo=" has-photo" if os.path.exists(TEAM_PHOTO) else "", legal=esc(LEGAL_NAME), lines=lines)


def compare():
    rows = [
        ("Commissions and fees", "$0", "Typically 5–6% of the sale price"),
        ("Repairs", "None. We buy as-is.", "Usually required after inspection"),
        ("Closing costs", "We pay them", "Seller typically pays a share"),
        ("Showings and open houses", "None", "Weeks of showings and cleaning"),
        ("Time to close", "7–30 days, your choice", "60–90+ days if financing holds"),
        ("Certainty", "Cash, no financing contingency", "Deals fall through when a loan fails"),
    ]
    trs = "".join('<tr><td>%s</td><td class="us"><span class="yes" aria-hidden="true">✓</span>%s</td><td><span class="no" aria-hidden="true">✕</span>%s</td></tr>'
                  % (esc(a), esc(b), esc(c)) for a, b, c in rows)
    return """<section class="section" id="compare">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">Compare your options</span>
      <h2>Selling to us vs. listing with an agent</h2>
      <p>A listing can get a higher price on paper. After repairs, commissions, carrying costs and months of waiting, the gap is often smaller than it looks.</p>
    </div>
    <div class="compare">
      <table>
        <thead><tr><th scope="col">What it costs you</th><th scope="col" class="us">Selling to %s</th><th scope="col">Listing with an agent</th></tr></thead>
        <tbody>%s</tbody>
      </table>
    </div>
    <p class="compare-note">Listing figures are general market ranges, not a quote for your property. Every offer we make is itemized so you can compare for yourself.</p>
  </div>
</section>
""" % (esc(BRAND), trs)


def calculator():
    return """<section class="section section-soft" id="cost">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">What waiting costs</span>
      <h2>Every month on the market has a price. See yours.</h2>
      <p>Put in your own numbers and see what a typical listing costs before you see a dollar.</p>
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
        <p class="calc-note">Estimates based on the numbers you enter. Commission and closing-cost rates are typical national figures and vary by market. A cash offer is usually below a retail listing price; the gap is often smaller than the costs above, and you decide once you see our number.</p>
        <a class="btn btn-cta" href="#offer">Skip the wait. Get my cash offer</a>
      </div>
    </div>
  </div>
</section>
"""


def promise():
    items = [
        ("A written offer within 24 hours", "With the math behind it, so you can check our work."),
        ("Zero fees, commissions or closing costs", "The number on the offer is the number you walk away with, minus what you owe."),
        ("We buy as-is", "Leave the broken water heater, the old furniture, the boxes in the garage."),
        ("No pressure, no obligation", "Say no and we part on good terms. We'd rather earn a referral than push a deal."),
        ("You pick the closing date", "Seven days or several months. Need time to find your next place? Take it."),
        ("Closings run through a licensed title company", "Your money never passes through our hands."),
    ]
    lis = "".join("<li>%s<div><b>%s</b><span>%s</span></div></li>" % (icon("check"), esc(t), esc(d)) for t, d in items)
    return """<section class="section" id="promise">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">Our promise to you</span>
      <h2>Six things we put in writing before you decide anything</h2>
      <p>Selling a house to a company you found online should come with guarantees. These are ours, on every offer, in every state.</p>
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
      <h2>Four home states. Buyers everywhere else.</h2>
      <p>We focus on Arizona, Florida, Tennessee and North Carolina, and buy nationwide through our network of local buying partners.</p>
    </div>
    <div class="grid-4">%s
      <div class="market-wide">
        <div>
          <h3>Outside these states?</h3>
          <p>We still buy. Send us the address and we'll make an offer or match you with a vetted local buyer within 24 hours.</p>
        </div>
        <a class="btn btn-cta" href="#offer">Get an offer anywhere in the US</a>
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


def offer_form(default_state="", default_city=""):
    bullets = [
        "No fees, commissions or closing costs",
        "As-is purchase. Leave behind what you don't want.",
        "Close in 7 days, or pick a later date",
        "Mortgage, liens or back taxes? Paid off at closing.",
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
    success_phone = ('<p>Expect a call or text from <b data-phone>%s</b>. Save the number so you don\'t miss us.</p>' % esc(PHONE)) if PHONE else ""
    return """<section class="offer section" id="offer">
  <div class="wrap">
    <div>
      <span class="eyebrow">Get your cash offer</span>
      <h2>Tell us about the property. We'll do the rest.</h2>
      <p class="lede">About 60 seconds. We review every property personally and send a written, no-obligation cash offer within 24 hours.</p>
      <ul>%(lis)s</ul>
      %(talk)s
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
            <input id="f-city" name="city" type="text" required autocomplete="address-level2" value="%(city)s">
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
          <button type="button" class="btn btn-cta" data-next>Continue →</button>
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
            <select id="f-beds" name="beds"><option value="">–</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select>
          </div>
          <div class="field">
            <label for="f-baths">Bathrooms</label>
            <select id="f-baths" name="baths"><option value="">–</option><option>1</option><option>1.5</option><option>2</option><option>2.5</option><option>3</option><option>3.5+</option></select>
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
          <button type="button" class="btn btn-outline" data-back>Back</button>
          <button type="button" class="btn btn-cta" data-next>One more step →</button>
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
          <button type="button" class="btn btn-outline" data-back>Back</button>
          <div class="submit-wrap">
            <button type="submit" class="btn btn-cta btn-lg">Get My Cash Offer</button>
            <span class="form-note">Free · No obligation · Reply within 24 hours</span>
          </div>
        </div>
        <p class="form-note">By submitting, you agree that %(legal)s may contact you about your property by phone, text or email. Consent is not a condition of any purchase. We never sell your information.</p>
      </div>

      <div class="thanks" data-result="success" hidden>
        %(okmark)s
        <h3>Got it. Your offer is on its way.</h3>
        %(success_phone)s
        <div class="next-steps">
          <div><span class="day">Within 24 hrs</span><span>We call or text with your written cash offer and the math behind it.</span></div>
          <div><span class="day">Day 2 to 3</span><span>A quick walkthrough or a few photos from your phone. Nothing to clean or fix.</span></div>
          <div><span class="day">Your date</span><span>Sign at the title company and the funds are wired to you.</span></div>
        </div>
      </div>

      <div class="thanks" data-result="fallback" hidden>
        %(okmark)s
        <h3>Almost there. Send us these details.</h3>
        <p>We couldn't deliver this automatically from this page. Copy your request and text or email it to us, and we'll reply within 24 hours.</p>
        <div class="summary"></div>
        <button type="button" class="btn btn-outline" data-copy>Copy my request</button>
        <div class="lines">%(fallback_lines)s</div>
      </div>
    </form>
  </div>
</section>
""" % dict(lis=lis, talk=talk, city=esc(default_city), states=state_options(default_state), legal=esc(LEGAL_NAME),
           okmark=icon("check-circle", "mark"), spark=icon("shield"), success_phone=success_phone, fallback_lines=fallback_lines)


def footer(lang="en"):
    t = T[lang]
    name = (lambda m: STATE_ES[m["abbr"]] if lang == "es" else m["name"])
    states = "".join('<li><a href="%s.html">%s</a></li>' % (m["slug"], esc(t["sell_in"] % name(m))) for m in MARKETS)
    cities = "".join('<li><a href="%s">%s, %s</a></li>' % (c["file"], esc(c["city"]), c["st"]) for c in CITY_PAGES[:8])
    contact = ""
    if PHONE:
        contact += '<li><a href="tel:%s">%s<span data-phone>%s</span></a></li>' % (PHONE_TEL, icon("phone"), esc(PHONE))
        contact += '<li>%s</li>' % sms_link(icon("chat") + "<span>%s</span>" % esc(t["text_us"]))
    if EMAIL:
        contact += '<li><a href="mailto:%s">%s<span data-email>%s</span></a></li>' % (esc(EMAIL), icon("mail"), esc(EMAIL))
    if REVIEWS_URL:
        contact += '<li><a href="%s" target="_blank" rel="noopener">%s<span>%s</span></a></li>' % (esc(REVIEWS_URL), icon("star"), esc(t["reviews"]))
    links = "".join('<li><a href="%s">%s</a></li>' % (href, esc(label)) for label, href in t["foot_links"])
    sticky = ""
    if PHONE:
        sticky += '<a class="btn btn-outline" href="tel:%s" aria-label="%s %s">%s%s</a>' % (PHONE_TEL, esc(t["call"]), esc(PHONE), icon("phone"), esc(t["call"]))
        sticky += sms_link(icon("chat") + esc(t["text"]), "btn btn-outline")
    home = "es.html" if lang == "es" else "index.html"
    return """<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="%(home)s">%(mark)s<span>%(brand)s<small>%(tag)s</small></span></a>
        <p>%(blurb)s</p>
        <ul class="foot-contact" style="margin-top:1rem">%(contact)s</ul>
      </div>
      <div>
        <h4>%(h_where)s</h4>
        <ul>%(states)s<li><a href="%(home)s#markets">%(nationwide)s</a></li></ul>
      </div>
      <div>
        <h4>%(h_cities)s</h4>
        <ul>%(cities)s</ul>
      </div>
      <div>
        <h4>%(h_company)s</h4>
        <ul>%(links)s</ul>
      </div>
    </div>
    <div class="legal">
      <p>© <span data-year>2026</span> %(legal)s. %(rights)s</p>
      <p>%(legal_text)s</p>
    </div>
  </div>
</footer>
<div class="sticky-cta"><a class="btn btn-cta" href="#offer">%(cta)s</a>%(sticky)s</div>
""" % dict(home=home, mark=BRAND_MARK, brand=esc(BRAND), tag=esc(t["tag"]), blurb=esc(t["foot_blurb"] % LEGAL_NAME), contact=contact,
           h_where=esc(t["foot_where"]), states=states, nationwide=esc(t["nationwide"]), h_cities=esc(t["foot_cities"]), cities=cities,
           h_company=esc(t["foot_company"]), links=links, legal=esc(LEGAL_NAME), rights=esc(t["rights"]),
           legal_text=esc(t["legal"] % LEGAL_NAME), cta=esc(t["cta"]), sticky=sticky)


def scripts():
    return """<script src="config.js"></script>
<script src="assets/app.js"></script>
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


def page_index():
    title = "Sell Your House Fast for Cash | We Buy Houses in AZ, FL, TN, NC | Prime Acre Capital"
    desc = ("Prime Acre Capital LLC buys houses as-is for cash in Arizona, Florida, Tennessee, North Carolina and nationwide. "
            "No fees, no repairs, no agents. Get a fair cash offer within 24 hours and close in as little as 7 days. Call or text %s." % PHONE).strip()
    h1 = "Sell Your House Fast for Cash. Any Condition. Any Situation."
    lede = ("We buy houses as-is in Arizona, Florida, Tennessee, North Carolina and nationwide. No repairs, no showings, "
            "no agent fees, and no waiting on a buyer's bank.")
    body = (hero("Direct cash home buyer · No agents, no fees", h1, lede) + trust_strip() + how() + situations() + about()
            + compare() + calculator() + promise() + markets() + testimonials() + faq() + offer_form() + footer())
    return head(title, desc, "index.html", graph(org_jsonld(), faq_jsonld())) + header() + body + scripts()


def why_section(title, intro, points):
    cards = "".join("""
    <div class="card step" style="text-align:left;padding:1.6rem">
      <h3>%s</h3>
      <p>%s</p>
    </div>""" % (esc(t), esc(d)) for t, d in points)
    return """<section class="section" id="why">
  <div class="wrap">
    <div class="section-head center">
      <span class="eyebrow">Local knowledge</span>
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


def page_state(m):
    title = "Sell My House Fast in %s | We Buy Houses for Cash | %s" % (m["name"], BRAND)
    desc = ("Sell your %s house fast for cash. %s buys houses as-is in %s and across %s. "
            "No fees, no repairs, no obligation. Cash offer within 24 hours. Call or text %s." % (m["name"], LEGAL_NAME, ", ".join(m["cities"][:4]), m["name"], PHONE)).strip()
    extra = [("Do you buy everywhere in %s?" % m["name"],
              "Yes. We buy in %s and the surrounding counties, and in smaller towns across the state. "
              "If we can't buy a particular property ourselves, we match you with a vetted local buyer, at no cost to you." % ", ".join(m["cities"][:5]))]
    jsonld = graph(org_jsonld(), service_jsonld("Sell your house for cash in %s" % m["name"], {"@type": "State", "name": m["name"]},
                                                SITE_URL + m["slug"] + ".html"), faq_jsonld(extra))
    h1 = "Sell Your %s House Fast for Cash" % m["name"]
    body = (hero("We buy houses in %s" % m["name"], h1, m["lede"], state=m["abbr"]) + trust_strip()
            + why_section("Why %s homeowners sell to us" % m["name"],
                          "Every market has its own reasons a house gets hard to sell the traditional way. These are the ones we solve most often in %s." % m["name"],
                          m["points"])
            + how() + situations() + about() + calculator() + promise() + cities_section(m) + testimonials()
            + faq(extra) + offer_form(m["abbr"]) + footer())
    return head(title, desc, m["slug"] + ".html", jsonld) + header() + body + scripts()


def page_city(c):
    m = c["market"]
    name = "%s, %s" % (c["city"], c["st"])
    title = "Sell My House Fast in %s | We Buy Houses %s | %s" % (name, c["city"], BRAND)
    desc = ("We buy houses in %s for cash. %s buys as-is in %s and across %s County. No fees, no repairs, no agents. "
            "Get a fair cash offer within 24 hours. Call or text %s." % (name, LEGAL_NAME, ", ".join(c["areas"][:3]), c["county"], PHONE)).strip()
    extra = [("Do you buy houses everywhere in %s?" % c["city"],
              "Yes. We buy in %s, and throughout %s County. Condos, single-family homes, duplexes, mobile homes with land and vacant lots all qualify." % (", ".join(c["areas"]), c["county"]))]
    jsonld = graph(org_jsonld(), service_jsonld("Sell your house for cash in %s" % name, {"@type": "City", "name": c["city"], "containedInPlace": {"@type": "State", "name": m["name"]}},
                                                SITE_URL + c["file"]), faq_jsonld(extra))
    h1 = "Sell Your House Fast in %s" % name
    body = (hero("We buy houses in %s" % name, h1, c["intro"], state=c["st"], city=c["city"]) + trust_strip()
            + why_section("Why %s homeowners sell to us" % c["city"],
                          "We buy in %s and every neighborhood between. These are the situations we solve most often around %s." % (", ".join(c["areas"]), c["city"]),
                          m["points"])
            + how() + situations() + about() + calculator() + promise() + cities_section(m, c["city"]) + testimonials()
            + faq(extra) + offer_form(c["st"], c["city"]) + footer())
    return head(title, desc, c["file"], jsonld) + header() + body + scripts()


def page_es():
    """Spanish landing page: quick forms top and bottom, core sections translated."""
    t = T["es"]
    h1 = "Venda su casa rápido por efectivo. En cualquier condición. En cualquier situación."
    lede = ("Compramos casas tal como están en Arizona, Florida, Tennessee, Carolina del Norte y en todo Estados Unidos. "
            "Sin reparaciones, sin visitas, sin comisiones de agente y sin esperar al banco del comprador.")
    steps = [
        ("phone", "Cuéntenos sobre su casa", "Llene el formulario corto o llámenos. Toma un minuto y nadie lo va a presionar.", "Toma 60 segundos"),
        ("pen", "Reciba su oferta en efectivo", "Revisamos la propiedad, las ventas cercanas y las reparaciones necesarias, y le enviamos una oferta por escrito con los números detrás.", "En 24 horas"),
        ("calendar", "Elija su fecha de cierre", "Acepte cuando esté listo. Cierre en tan solo 7 días a través de una compañía de títulos con licencia, o tómese el tiempo que necesite.", "7 días o su fecha"),
    ]
    step_cards = "".join("""
    <div class="card step"><span class="num">%d</span>%s<h3>%s</h3><p>%s</p><span class="when">%s</span></div>""" % (
        i + 1, icon(k, "ico"), esc(a), esc(b), esc(c)) for i, (k, a, b, c) in enumerate(steps))
    sits = [
        ("clock", "Enfrentando una ejecución hipotecaria", "¿Atrasado en los pagos o ya tiene fecha de subasta? Una venta en efectivo antes de la subasta puede pagar al banco y ayudarle a evitar una ejecución hipotecaria en su historial."),
        ("doc", "Heredó una casa", "Sucesión, herederos fuera del estado, una casa llena de pertenencias. Llévese lo que quiera y déjenos el resto."),
        ("key", "Cansado de ser arrendador", "Inquilinos problemáticos, rentas atrasadas, reparaciones constantes. Compramos con inquilinos adentro y respetamos el contrato."),
        ("users", "Divorcio o separación", "Una venta rápida y limpia con un solo número con el que todos puedan estar de acuerdo, y una fecha de cierre que funcione para ambos."),
        ("arrow", "Mudanza o cambio de trabajo", "Cierre antes de irse de la ciudad, con una fecha que coincida con su mudanza y no con el calendario de un agente."),
        ("tool", "Reparaciones mayores o infracciones de código", "Techo, cimientos, moho, daños por fuego o agua, permisos abiertos. La compramos exactamente como está."),
        ("dollar", "Atrasado en impuestos o con gravámenes", "Impuestos atrasados, gravámenes de la HOA y sentencias se pagan de la venta al cierre. Usted no pone dinero."),
        ("house", "Propiedad vacía o no deseada", "Una segunda casa, un terreno o una casa que lleva años desocupada. Conviértala en efectivo sin renovarla primero."),
    ]
    sit_cards = "".join("""
    <div class="card sit">%s<div><h3>%s</h3><p>%s</p></div></div>""" % (icon(k), esc(a), esc(b)) for k, a, b in sits)
    rows = [
        ("Comisiones y cargos", "$0", "Normalmente 5–6% del precio de venta"),
        ("Reparaciones", "Ninguna. Compramos tal como está.", "Generalmente requeridas después de la inspección"),
        ("Gastos de cierre", "Los pagamos nosotros", "El vendedor normalmente paga una parte"),
        ("Visitas y casas abiertas", "Ninguna", "Semanas de visitas y limpieza"),
        ("Tiempo para cerrar", "7–30 días, usted elige", "60–90+ días si el financiamiento no falla"),
        ("Certeza", "Efectivo, sin contingencia de financiamiento", "Las ventas se caen cuando el préstamo falla"),
    ]
    trs = "".join('<tr><td>%s</td><td class="us"><span class="yes" aria-hidden="true">✓</span>%s</td><td><span class="no" aria-hidden="true">✕</span>%s</td></tr>'
                  % (esc(a), esc(b), esc(c)) for a, b, c in rows)
    promises = [
        ("Una oferta por escrito en 24 horas", "Con los números detrás, para que pueda revisar nuestro trabajo."),
        ("Cero comisiones, cargos o gastos de cierre", "El número de la oferta es el número con el que se va, menos lo que deba."),
        ("Compramos tal como está", "Deje el calentador roto, los muebles viejos, las cajas del garaje."),
        ("Sin presión, sin compromiso", "Diga que no y quedamos en buenos términos. Preferimos ganarnos una recomendación que forzar un trato."),
        ("Usted elige la fecha de cierre", "Siete días o varios meses. ¿Necesita tiempo para encontrar su próximo hogar? Tómeselo."),
        ("Los cierres se hacen con una compañía de títulos con licencia", "Su dinero nunca pasa por nuestras manos."),
    ]
    plis = "".join("<li>%s<div><b>%s</b><span>%s</span></div></li>" % (icon("check"), esc(a), esc(b)) for a, b in promises)
    faqs = [
        ("¿Cómo sé que esto es legítimo?", "Buena pregunta. Usted nunca nos paga nada y su dinero nunca pasa por nosotros: cada cierre se hace a través de una compañía de títulos o un abogado de cierre con licencia, que guarda los fondos y registra la venta. Puede pedirle a su propio abogado que revise el contrato, y puede retirarse en cualquier momento antes de firmar."),
        ("¿Me van a ofrecer muy poco?", "Nuestra oferta se basa en números reales que le mostramos: ventas recientes cercanas, las reparaciones que asumiremos y nuestros costos para revender. Si el número no le funciona, perdió un minuto y ganó una segunda opinión gratis sobre lo que vale su casa tal como está."),
        ("¿Hay algún cargo?", "No. Sin comisiones, sin cargos por servicio, y nosotros pagamos los gastos de cierre habituales. La oferta que acepte es la cantidad con la que se va, menos lo que deba sobre la propiedad, como una hipoteca o gravámenes."),
        ("¿En qué condición tiene que estar la casa?", "En cualquiera. Compramos casas con daños por fuego o agua, techos en mal estado, problemas de cimientos, moho, acumulación de objetos y remodelaciones sin terminar. Deje todo lo que no quiera llevarse."),
        ("¿Qué tan rápido pueden cerrar?", "En tan solo 7 días una vez que el título esté limpio. Si necesita más tiempo, elija la fecha que le convenga. Cerramos a través de una compañía de títulos o un abogado con licencia, y usted recibe su dinero al cierre."),
        ("Todavía tengo hipoteca. ¿Pueden comprar de todos modos?", "Sí. La hipoteca, junto con cualquier gravamen o impuesto atrasado, se paga con el dinero de la venta al cierre. Si debe casi lo que vale la casa, hablaremos de sus opciones con honestidad."),
        ("¿Tengo que aceptar la oferta?", "No. Cada oferta es gratis y sin compromiso. Si poner la casa en venta u otro comprador le daría más, se lo diremos."),
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
        contact_lines += '<a href="tel:%s">%s<span><span data-phone>%s</span><small>Llame o envíe un texto, los 7 días de la semana</small></span></a>' % (PHONE_TEL, icon("phone"), esc(PHONE))
    if EMAIL:
        contact_lines += '<a href="mailto:%s">%s<span><span data-email>%s</span><small>Respondemos en menos de 24 horas</small></span></a>' % (esc(EMAIL), icon("mail"), esc(EMAIL))
    body = hero("Compradores directos · Sin comisiones", h1, lede, lang="es") + trust_strip("es") + """
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
    <p>Sea lo que sea que esté pasando, no es la primera persona que nos lo cuenta. Estas son las situaciones en las que más ayudamos.</p></div>
    <div class="grid-4">%(sits)s
    </div>
  </div>
</section>
<section class="section about" id="about">
  <div class="wrap">
    <div class="about-art">%(art)s</div>
    <div>
      <span class="eyebrow">Con quién está tratando</span>
      <h2>Un comprador directo. Ni intermediarios, ni un centro de llamadas.</h2>
      <p class="lede">%(legal)s compra casas directamente a sus dueños en Arizona, Florida, Tennessee y Carolina del Norte, y en todo el país a través de compradores locales asociados. Cuando nos contacta, habla con las personas que hacen la oferta.</p>
      <p>No somos agentes y no vamos a poner su casa en venta ni a pasar su información a terceros. Le hacemos una oferta real, le mostramos cómo llegamos a ella y cerramos a través de una compañía de títulos con licencia para que su dinero esté protegido de principio a fin.</p>
      <div class="contact-card">%(contact)s</div>
    </div>
  </div>
</section>
<section class="section" id="compare">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Compare sus opciones</span><h2>Vender con nosotros vs. vender con un agente</h2>
    <p>Un agente puede conseguir un precio más alto en papel. Después de reparaciones, comisiones, gastos mensuales y meses de espera, la diferencia suele ser menor de lo que parece.</p></div>
    <div class="compare"><table>
      <thead><tr><th scope="col">Lo que le cuesta</th><th scope="col" class="us">Vender a %(brand)s</th><th scope="col">Vender con un agente</th></tr></thead>
      <tbody>%(rows)s</tbody></table></div>
    <p class="compare-note">Las cifras de venta con agente son rangos generales del mercado, no una cotización para su propiedad. Cada oferta que hacemos viene detallada para que usted compare.</p>
  </div>
</section>
<section class="section section-soft" id="promise">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Nuestra promesa</span><h2>Seis cosas que ponemos por escrito antes de que usted decida nada</h2>
    <p>Venderle su casa a una empresa que encontró en internet debería venir con garantías. Estas son las nuestras, en cada oferta y en cada estado.</p></div>
    <ul class="promise-list">%(promises)s</ul>
  </div>
</section>
<section class="section" id="markets">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Dónde compramos</span><h2>Cuatro estados principales. Compradores en todos los demás.</h2>
    <p>Nos enfocamos en Arizona, Florida, Tennessee y Carolina del Norte, y compramos en todo el país a través de nuestra red de compradores locales.</p></div>
    <div class="grid-4">%(markets)s
      <div class="market-wide"><div><h3>¿Fuera de estos estados?</h3><p>También compramos. Envíenos la dirección y le haremos una oferta o lo conectaremos con un comprador local verificado en 24 horas.</p></div>
      <a class="btn btn-cta" href="#offer">Recibir una oferta en cualquier parte de EE. UU.</a></div>
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
      <p class="lede">Toma unos 30 segundos. Revisamos cada propiedad personalmente y le enviamos una oferta en efectivo por escrito y sin compromiso en 24 horas.</p>
      <ul><li>%(check)s<span>Sin comisiones, cargos ni gastos de cierre</span></li><li>%(check)s<span>Compramos tal como está. Deje lo que no quiera.</span></li><li>%(check)s<span>Cierre en 7 días, o elija una fecha posterior</span></li><li>%(check)s<span>¿Hipoteca, gravámenes o impuestos atrasados? Se pagan al cierre.</span></li></ul>
      %(talk)s
    </div>
    %(card2)s
  </div>
</section>
""" % dict(steps=step_cards, sits=sit_cards, art=ABOUT_ART, legal=esc(LEGAL_NAME), contact=contact_lines, brand=esc(BRAND), rows=trs,
           promises=plis, markets=mcards, faqs=fds, check=icon("check"),
           talk=('<p class="talk"><span>¿Prefiere hablar? Llame o envíe un texto al %s</span></p>' % phone_link()) if PHONE else "",
           card2=lead_card(lang="es", card_id="lead-card-2", details=False))
    title = "Compramos Casas por Efectivo en Arizona, Florida, Tennessee y Carolina del Norte | Prime Acre Capital"
    desc = ("Venda su casa rápido por efectivo. Prime Acre Capital LLC compra casas tal como están en Arizona, Florida, Tennessee, "
            "Carolina del Norte y en todo el país. Sin comisiones, sin reparaciones, sin compromiso. Oferta en 24 horas. Llame o envíe un texto al %s." % PHONE).strip()
    jsonld = graph(org_jsonld(), {"@type": "FAQPage", "inLanguage": "es",
                                   "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]})
    return head(title, desc, "es.html", jsonld, lang="es") + header("es", same_page=True) + body + footer("es") + scripts()


def page_privacy():
    title = "Privacy Policy | %s" % BRAND
    desc = "How %s collects, uses and protects the information you share when requesting a cash offer." % LEGAL_NAME
    contact = " at %s" % EMAIL if EMAIL else " using the contact details on this site"
    body = """<section class="section" id="privacy">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow">Privacy policy</span>
      <h2>What we collect and how we use it</h2>
      <p>Last updated: October 2026</p>
    </div>
    <div class="faq" style="margin:0;max-width:46rem">
      <details open><summary>Information we collect</summary><p>When you request a cash offer we collect the property address and details you provide, your name, phone number and email address, and anything you add in the notes. We also collect standard web analytics such as pages visited and the device used.</p></details>
      <details open><summary>How we use it</summary><p>We use your information to evaluate the property, prepare and deliver a cash offer, and communicate with you about the sale by phone, text message or email. If you have agreed to text messages, you can opt out at any time by replying STOP.</p></details>
      <details open><summary>Sharing</summary><p>We do not sell your personal information. We may share it with the title company, closing attorney or local buying partner involved in purchasing your property, and with service providers who help us run this website and deliver messages. These parties may use it only to provide those services.</p></details>
      <details open><summary>Your choices</summary><p>You can ask us to correct or delete your information, or to stop contacting you, at any time. We keep lead information only as long as needed to evaluate and complete a potential purchase and to meet legal requirements.</p></details>
      <details open><summary>Contact</summary><p>Questions about this policy can be sent to %s%s.</p></details>
    </div>
  </div>
</section>
""" % (esc(LEGAL_NAME), esc(contact))
    return head(title, desc, "privacy.html", graph(org_jsonld())) + header() + body + offer_form() + footer() + scripts()


def sitemap(paths):
    urls = "".join("  <url><loc>%s</loc></url>\n" % esc(SITE_URL + ("" if p == "index.html" else p)) for p in paths)
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % urls


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
    body = body.replace('<a class="sr-only" href="#offer">Skip to the cash offer form</a>\n', "")
    if os.path.exists(HERO_PHOTO):
        with open(HERO_PHOTO, "rb") as f:
            data = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode("ascii")
        body = body.replace("url(assets/img/hero.jpg)", "url(%s)" % data)

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

    pages = {"index.html": page_index(), "privacy.html": page_privacy(), "es.html": page_es()}
    for m in MARKETS:
        pages[m["slug"] + ".html"] = page_state(m)
    for c in CITY_PAGES:
        pages[c["file"]] = page_city(c)
    for name, content in pages.items():
        with open(os.path.join(SITE, name), "w", encoding="utf-8") as f:
            f.write(content)
    public = [p for p in pages if p != "privacy.html"]
    with open(os.path.join(SITE, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap(public))
    with open(os.path.join(SITE, "robots.txt"), "w", encoding="utf-8") as f:
        f.write("User-agent: *\nAllow: /\nSitemap: %ssitemap.xml\n" % SITE_URL)
    open(os.path.join(SITE, ".nojekyll"), "w").close()
    print("built %d pages + sitemap.xml, robots.txt" % len(pages))


if __name__ == "__main__":
    sys.exit(main())
