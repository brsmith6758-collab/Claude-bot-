#!/usr/bin/env python3
"""Connect a custom domain to the site.

    python3 tools/domain.py primeacrehomebuyers.com

Writes site/CNAME, points siteUrl in site/config.js at the domain, rebuilds every
page so canonical links, the sitemap and robots.txt use it, and prints the DNS
records to create at the registrar. Commit and push afterwards; the publish
workflow copies CNAME to the gh-pages branch and GitHub Pages picks it up.

    python3 tools/domain.py --remove      # go back to the github.io address
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
CNAME = os.path.join(SITE, "CNAME")
CONFIG = os.path.join(SITE, "config.js")
GITHUB_PAGES_HOST = "brsmith6758-collab.github.io"
GITHUB_A = ["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"]
GITHUB_AAAA = ["2606:50c0:8000::153", "2606:50c0:8001::153", "2606:50c0:8002::153", "2606:50c0:8003::153"]


def set_site_url(url):
    with open(CONFIG, encoding="utf-8") as f:
        src = f.read()
    src, n = re.subn(r'(siteUrl:\s*)"[^"]*"', r'\1"%s"' % url, src)
    if n != 1:
        sys.exit("could not find siteUrl in site/config.js")
    with open(CONFIG, "w", encoding="utf-8") as f:
        f.write(src)


def main(argv):
    if len(argv) != 2 or argv[1] in ("-h", "--help"):
        print(__doc__)
        return 2
    if argv[1] == "--remove":
        if os.path.exists(CNAME):
            os.remove(CNAME)
        set_site_url("https://%s/Claude-bot-/" % GITHUB_PAGES_HOST)
        subprocess.check_call([sys.executable, os.path.join(ROOT, "tools", "build.py")])
        print("Custom domain removed. Commit and push.")
        return 0

    domain = argv[1].strip().lower().rstrip("/")
    domain = re.sub(r"^https?://", "", domain)
    if domain.startswith("www."):
        domain = domain[4:]
    if not re.match(r"^[a-z0-9-]+(\.[a-z0-9-]+)+$", domain):
        sys.exit("that does not look like a domain name: %s" % domain)

    with open(CNAME, "w", encoding="utf-8") as f:
        f.write(domain + "\n")
    set_site_url("https://%s/" % domain)
    subprocess.check_call([sys.executable, os.path.join(ROOT, "tools", "build.py")])

    print("\nsite/CNAME written and every page rebuilt for https://%s/\n" % domain)
    print("Create these DNS records at your registrar (leave TTL at the default):\n")
    print("  Type   Host   Value")
    for ip in GITHUB_A:
        print("  A      @      %s" % ip)
    for ip in GITHUB_AAAA:
        print("  AAAA   @      %s" % ip)
    print("  CNAME  www    %s" % GITHUB_PAGES_HOST)
    print("\nThen: git add -A && git commit -m 'Connect %s' && git push" % domain)
    print("GitHub issues the HTTPS certificate automatically once the records resolve (usually under an hour).")
    print("Finally tick 'Enforce HTTPS' at https://github.com/brsmith6758-collab/Claude-bot-/settings/pages.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
