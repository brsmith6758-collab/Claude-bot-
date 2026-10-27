#!/usr/bin/env python3
"""Measure how much text the state and city pages share (Google treats near-duplicate location pages as doorways).

    python3 tools/overlap_check.py            # report; exits 1 if any pair shares more than the limit
    python3 tools/overlap_check.py --limit 60

Only the main content counts: the top bar, header, trust strip, offer form, footer and scripts are removed first,
because every page shares them by design. Overlap is the share of a page's 5-word phrases that also appear in
the other page.
"""
import argparse
import html
import itertools
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
SHARED_BLOCKS = [
    r'<div class="topbar">.*?</div>\s*</div>\s*</div>', r"<header.*?</header>", r'<div class="trust-strip".*?</div>\s*</div>\s*</div>',
    r'<section class="offer section".*?</section>', r"<footer.*?</footer>", r'<div class="sticky-cta">.*?</div>',
    r"<script.*?</script>", r"<style.*?</style>", r'<a class="sr-only".*?</a>', r'<div class="hero-card">.*?</form>',
]


def main_text(path):
    with open(path, encoding="utf-8") as f:
        doc = f.read()
    body = doc.split("<body>", 1)[-1]
    for pat in SHARED_BLOCKS:
        body = re.sub(pat, " ", body, flags=re.S | re.I)
    text = html.unescape(re.sub(r"<[^>]+>", " ", body))
    return re.findall(r"[a-z0-9']+", text.lower())


def shingles(words, n=5):
    return {" ".join(words[i:i + n]) for i in range(max(0, len(words) - n + 1))}


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=float, default=60.0, help="highest allowed overlap, in percent")
    args = ap.parse_args(argv[1:])
    pages = sorted(f for f in os.listdir(SITE) if f.startswith("sell-my-house-fast-") or f in (
        "arizona.html", "florida.html", "tennessee.html", "north-carolina.html"))
    words = {p: main_text(os.path.join(SITE, p)) for p in pages}
    sh = {p: shingles(w) for p, w in words.items()}
    worst = {p: (0.0, "") for p in pages}
    for a, b in itertools.combinations(pages, 2):
        common = len(sh[a] & sh[b])
        for x, y in ((a, b), (b, a)):
            pct = 100.0 * common / max(1, len(sh[x]))
            if pct > worst[x][0]:
                worst[x] = (pct, y)
    bad = 0
    print("%-46s %7s  %s" % ("page", "words", "most overlap"))
    for p in pages:
        pct, other = worst[p]
        flag = "  <-- over %.0f%%" % args.limit if pct > args.limit else ""
        bad += pct > args.limit
        print("%-46s %7d  %5.1f%% with %s%s" % (p, len(words[p]), pct, other, flag))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
