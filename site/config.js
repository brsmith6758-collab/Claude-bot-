// Prime Acre Capital LLC — site settings.
// Edit these values, commit, and the site picks them up. No build step needed for the
// JavaScript-driven ones; run `python3 tools/build.py` after changing phone/email/siteUrl
// so the static HTML and search-engine data match.
window.PAC_CONFIG = {
  // Phone number shown in the header, hero, offer section and footer.
  phone: "(773) 937-5416",

  // Business email shown on the site and used for the pre-filled email fallback.
  email: "brsmith6758@gmail.com",

  // Where lead submissions are POSTed as JSON.
  // FormSubmit needs no account: the FIRST submission emails brsmith6758@gmail.com an
  // activation link. Click it once and every lead after that lands in the inbox.
  // Swap for a Formspree URL ("https://formspree.io/f/XXXXXXXX") or a CRM webhook any time.
  leadEndpoint: "https://formsubmit.co/ajax/brsmith6758@gmail.com",

  // Public URL of the site (used for canonical links, sitemap and sharing).
  // Change this to your custom domain (e.g. "https://primeacrecapital.com/") when you connect one.
  siteUrl: "https://brsmith6758-collab.github.io/Claude-bot-/",

  // Pre-filled message when a visitor taps "Text us".
  smsText: "Hi, I'd like a cash offer on my house.",

  // Link to your Google Business Profile reviews. Shows "Read our Google reviews" once set.
  googleReviewsUrl: "",

  // Ad and analytics tracking. Leave "" until you have the IDs.
  ga4MeasurementId: "",        // Google Analytics 4, e.g. "G-XXXXXXXXXX"
  googleAdsConversion: "",     // Google Ads lead conversion, e.g. "AW-123456789/AbCdEfGhIjKlMnOp"
  metaPixelId: ""              // Meta (Facebook/Instagram) pixel, e.g. "123456789012345"
};
