#!/usr/bin/env python3
"""Check the page content files in tools/content/ before they are built into the site.

    python3 tools/content_check.py                 # every file in tools/content/
    python3 tools/content_check.py path/to/x.json  # one file

Fails (exit 1) on: missing fields, banned claims, links to pages that don't exist, non-https sources,
and city overviews that are too short. Prints warnings for softer style problems.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "tools", "content")

# Pages a [label](slug) link may point to (slug = file name without .html).
PAGES = {
    "index", "how-it-works", "about", "faq", "contact", "how-we-calculate-your-offer", "compare",
    "how-to-vet-a-cash-home-buyer", "sell-house-situations", "sell-inherited-house", "sell-house-facing-foreclosure",
    "sell-house-with-tenants", "sell-house-as-is", "arizona", "florida", "tennessee", "north-carolina", "privacy", "es",
}
CITY_FILES = {
    "phoenix-az", "mesa-az", "tucson-az", "scottsdale-az", "jacksonville-fl", "tampa-fl", "orlando-fl", "miami-fl",
    "nashville-tn", "memphis-tn", "knoxville-tn", "chattanooga-tn", "charlotte-nc", "raleigh-nc", "greensboro-nc", "durham-nc",
}
PAGES |= {"sell-my-house-fast-" + c for c in CITY_FILES}

COMPONENTS = {"quick_form", "example_offer", "net_calculator", "contact_card", "verify_us", "faq_list", "city_list",
              "situation_cards", "steps"}
STATE_TOPICS = {"foreclosure", "probate", "closing", "transfer_tax", "tenants", "property_tax", "divorce", "disclosure"}

# Claims the site must never make (see the owner's rules and the research do-not-copy list).
BANNED = [
    (r"\bguarantee(d|s)?\b", "no guarantees"),
    (r"\btop dollar\b", "no 'top dollar'"),
    (r"\bfair market value\b|\bfull market value\b", "no market-value claims"),
    (r"\bstop (your |the )?foreclosure\b", "never promise to stop a foreclosure"),
    (r"#\s?1\b|\bnumber one\b", "no #1 claims"),
    (r"\bhomes? (we've |we have )?bought\b|\bhouses we've bought\b", "no purchase counts"),
    (r"\b\d[\d,]*\+? (homes|houses|families|sellers|homeowners)\b", "no counts of homes or sellers"),
    (r"\b(years|decades) of experience\b|\bin business since\b|\bsince (19|20)\d\d\b", "no years-in-business claims"),
    (r"\bas seen on\b|\bfeatured in\b", "no press claims"),
    (r"\bhablamos espa", "no Spanish phone-line claim"),
    (r"\bAggregateRating\b|\b\d(\.\d)? stars?\b|\b\d(\.\d)?-star\b", "no ratings"),
    (r"\bbest\b.{0,20}\b(buyer|company|offer|price)\b", "no 'best' superlatives"),
    (r"\b(our|the) team (of|has)\b|\bour agents\b|\bour realtors\b", "no invented staff"),
    (r"\bvetted (local )?(buyer|partner)", "no partner-matching claims until the owner confirms the model"),
    (r"\bstay (in the home |in your home )?after closing\b|\bleaseback\b|\brent back\b", "no post-closing stay offers"),
    (r"\bmoving (help|costs|assistance)\b|\bfree move\b|\bcash advance\b", "no moving help or advances"),
    (r"\bproof of funds with every\b|\bwe (always )?provide proof of funds\b", "proof-of-funds promise needs the owner"),
    (r"\boffer (is )?(good|valid) for \d", "offer validity needs the owner"),
    (r"\bwe never assign\b|\bwe don't assign\b|\bwe do not assign\b", "assignment policy needs the owner"),
    (r"\bno matter what\b|\bany price\b|\bpay cash for any\b", "no unlimited promises"),
    (r"\b(neighborhoods?|areas?) (full of|with lots of|known for) (renters|seniors|families|immigrants)\b", "Fair Housing: describe homes, not people"),
]
# Style tells that read as machine-written; warn only.
STYLE = [r"\bseamless(ly)?\b", r"\bnavigat(e|ing) the\b", r"\bunlock\b", r"\bin today's\b", r"\bdelve\b", r"\bhassle-free\b",
         r"\bpeace of mind\b", r"\bjourney\b", r"\btailored\b", r"\brest assured\b", r"\bwhether you're\b", r"\bit's important to note\b"]

LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")


def words(text):
    return len(re.findall(r"[A-Za-z0-9']+", text or ""))


class Checker:
    def __init__(self, path):
        self.path = path
        self.errors, self.warnings = [], []

    def err(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    def text(self, where, s, sources=()):
        if not isinstance(s, str) or not s.strip():
            self.err("%s: empty text" % where)
            return
        low = s.lower()
        for pat, why in BANNED:
            if re.search(pat, low, re.I):
                self.err("%s: banned wording (%s): %r" % (where, why, re.search(pat, low, re.I).group(0)))
        for pat in STYLE:
            if re.search(pat, low):
                self.warn("%s: stock phrase %r" % (where, re.search(pat, low).group(0)))
        if s.count("—") > 1:
            self.warn("%s: %d em dashes; prefer commas or periods" % (where, s.count("—")))
        for label, target in LINK.findall(s):
            if target.startswith("https://"):
                continue
            slug = target.split("#")[0].replace(".html", "")
            if slug and slug not in PAGES:
                self.err("%s: link to unknown page %r" % (where, target))

    def sources(self, where, items, required=True):
        if not items:
            if required:
                self.err("%s: no sources" % where)
            return
        for i, s in enumerate(items):
            if not isinstance(s, dict) or not s.get("name") or not str(s.get("url", "")).startswith("https://"):
                self.err("%s.sources[%d]: needs a name and an https url" % (where, i))

    def blocks(self, where, blocks):
        if not isinstance(blocks, list) or not blocks:
            self.err("%s: no blocks" % where)
            return
        for i, b in enumerate(blocks):
            w = "%s.blocks[%d]" % (where, i)
            t = b.get("type")
            if t in ("p", "callout"):
                self.text(w, b.get("text"))
                if t == "callout" and b.get("title"):
                    self.text(w + ".title", b["title"])
            elif t in ("ul", "ol"):
                if not b.get("items"):
                    self.err(w + ": empty list")
                for j, it in enumerate(b.get("items") or []):
                    self.text("%s.items[%d]" % (w, j), it)
            elif t == "table":
                if not b.get("head") or not b.get("rows"):
                    self.err(w + ": table needs head and rows")
                for r in b.get("rows") or []:
                    if len(r) != len(b.get("head") or []):
                        self.err(w + ": row length differs from head")
                    for c in r:
                        self.text(w + ".cell", c)
            elif t == "component":
                name = str(b.get("name", ""))
                if name not in COMPONENTS and not (name.startswith("state_law:") and name.split(":", 1)[1] in STATE_TOPICS):
                    self.err(w + ": unknown component %r" % name)
            elif t == "dl":
                for j, it in enumerate(b.get("items") or []):
                    self.text("%s.term[%d]" % (w, j), it.get("term"))
                    self.text("%s.def[%d]" % (w, j), it.get("text"))
            else:
                self.err(w + ": unknown block type %r" % t)

    def faqs(self, where, faqs, minimum):
        if len(faqs or []) < minimum:
            self.err("%s: needs at least %d FAQs" % (where, minimum))
        for i, f in enumerate(faqs or []):
            self.text("%s.faqs[%d].q" % (where, i), f.get("q"))
            self.text("%s.faqs[%d].a" % (where, i), f.get("a"))

    def page(self, d):
        for k in ("slug", "title", "meta_description", "h1", "lede", "sections"):
            if not d.get(k):
                self.err("page: missing %r" % k)
        if d.get("slug") and d["slug"] not in PAGES:
            self.err("page: slug %r is not in the page list" % d["slug"])
        if len(d.get("title", "")) > 70:
            self.warn("title is %d chars (aim for 60 or fewer)" % len(d["title"]))
        if not 70 <= len(d.get("meta_description", "")) <= 165:
            self.warn("meta_description is %d chars (aim for 120-160)" % len(d.get("meta_description", "")))
        for k in ("title", "meta_description", "h1", "lede", "eyebrow"):
            if d.get(k):
                self.text(k, d[k])
        total = words(d.get("lede"))
        for i, s in enumerate(d.get("sections") or []):
            w = "sections[%d]" % i
            if not s.get("id") or not re.fullmatch(r"[a-z0-9-]+", s.get("id", "")):
                self.err(w + ": id must be lowercase-with-dashes")
            self.text(w + ".heading", s.get("heading"))
            self.blocks(w, s.get("blocks"))
            for b in s.get("blocks") or []:
                total += words(b.get("text")) + sum(words(x) for x in (b.get("items") or []) if isinstance(x, str))
        if d.get("faqs") is not None:
            self.faqs("page", d.get("faqs"), 0)
            total += sum(words(f.get("q")) + words(f.get("a")) for f in d.get("faqs") or [])
        if d.get("article"):
            self.sources("page", d.get("sources"))
        elif d.get("sources") is not None:
            self.sources("page", d.get("sources"), required=False)
        for r in d.get("related") or []:
            if r not in PAGES:
                self.err("related: unknown page %r" % r)
        return total

    def state_law(self, d):
        for st, v in d.items():
            if st not in ("AZ", "FL", "TN", "NC"):
                self.err("state_law: unknown state %r" % st)
                continue
            if not v.get("name") or not v.get("last_verified"):
                self.err("%s: needs name and last_verified" % st)
            intro = v.get("intro") or []
            for i, para in enumerate(intro):
                self.text("%s.intro[%d]" % (st, i), para)
            if not 100 <= sum(words(x) for x in intro) <= 260:
                self.err("%s: intro needs 100-260 words" % st)
            self.faqs(st, v.get("faqs"), 4)
            topics = v.get("topics") or {}
            missing = STATE_TOPICS - set(topics)
            if missing:
                self.err("%s: missing topics %s" % (st, sorted(missing)))
            for t, body in topics.items():
                if t not in STATE_TOPICS:
                    self.err("%s: unknown topic %r" % (st, t))
                self.text("%s.%s.summary" % (st, t), body.get("summary"))
                if not body.get("facts"):
                    self.err("%s.%s: no facts" % (st, t))
                for i, f in enumerate(body.get("facts") or []):
                    w = "%s.%s.facts[%d]" % (st, t, i)
                    self.text(w, f.get("text"))
                    if not f.get("source_name") or not str(f.get("source_url", "")).startswith("https://"):
                        self.err(w + ": needs source_name and an https source_url")

    def cities(self, d):
        for c in d.get("cities") or []:
            w = c.get("city", "?")
            slug = "%s-%s" % (re.sub(r"[^a-z0-9]+", "-", str(c.get("city", "")).lower()).strip("-"), str(c.get("st", "")).lower())
            if slug not in CITY_FILES:
                self.err("%s: not one of the 16 city pages" % w)
            for k in ("county", "county_seat", "intro", "local_overview", "considerations", "offices", "faqs", "last_verified"):
                if not c.get(k):
                    self.err("%s: missing %r" % (w, k))
            self.text(w + ".intro", c.get("intro"))
            overview = c.get("local_overview") or []
            n = 0
            for i, p in enumerate(overview):
                self.text("%s.local_overview[%d]" % (w, i), p)
                n += words(p)
            if not 250 <= n <= 520:
                self.err("%s: local_overview has %d words (needs 250-520)" % (w, n))
            if len(c.get("considerations") or []) != 3:
                self.err("%s: needs exactly 3 considerations" % w)
            for i, k in enumerate(c.get("considerations") or []):
                self.text("%s.considerations[%d].heading" % (w, i), k.get("heading"))
                self.text("%s.considerations[%d].text" % (w, i), k.get("text"))
            for i, o in enumerate(c.get("offices") or []):
                if not o.get("role") or not o.get("name") or not str(o.get("url", "")).startswith("https://"):
                    self.err("%s.offices[%d]: needs role, name and an https url" % (w, i))
            self.faqs(w, c.get("faqs"), 4)
            self.sources(w, c.get("sources"))


def check(path):
    c = Checker(path)
    try:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
    except Exception as e:  # noqa: BLE001
        c.err("not valid JSON: %s" % e)
        return c, None
    name = os.path.basename(path)
    total = None
    if name.startswith("state_law"):
        c.state_law(d)
    elif name.startswith("cities"):
        c.cities(d)
    elif name.startswith("page_"):
        total = c.page(d)
    else:
        c.warn("unknown file kind; nothing checked")
    return c, total


def main(argv):
    if argv[1:]:
        paths = argv[1:]
    elif os.path.isdir(CONTENT):
        paths = sorted(os.path.join(CONTENT, f) for f in os.listdir(CONTENT) if f.endswith(".json"))
    else:
        paths = []
    bad = 0
    for p in paths:
        c, total = check(p)
        status = "FAIL" if c.errors else "ok"
        print("%-4s %s%s" % (status, os.path.relpath(p, ROOT), (" (%d words)" % total) if total else ""))
        for e in c.errors:
            print("     error: " + e)
        for w in c.warnings:
            print("     warn:  " + w)
        bad += bool(c.errors)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
