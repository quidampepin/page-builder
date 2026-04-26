/**
 * GCWeb shell — the FIXED infrastructure that wraps every generated page.
 *
 * The LLM never regenerates this. It only produces the breadcrumb + <main>
 * content. Compose.ts plugs that content into these constants.
 *
 * Markup is copied verbatim from the GCWeb static-header-footer example:
 *   https://github.com/wet-boew/GCWeb/blob/master/docs/static-header-footer/bootstrap-3.html
 * with CDN asset URLs pointing at wet-boew.github.io (the version the user
 * specified in the project brief).
 */

export type Lang = "en" | "fr";

const CDN_BASE = "https://wet-boew.github.io/themes-dist/GCWeb";

const ASSETS = {
  css: `${CDN_BASE}/GCWeb/css/theme.min.css`,
  wetJs: `${CDN_BASE}/wet-boew/js/wet-boew.min.js`,
  themeJs: `${CDN_BASE}/GCWeb/js/theme.min.js`,
  sigEn: `${CDN_BASE}/GCWeb/assets/sig-blk-en.svg`,
  sigFr: `${CDN_BASE}/GCWeb/assets/sig-blk-fr.svg`,
  wordmark: `${CDN_BASE}/GCWeb/assets/wmms-blk.svg`,
} as const;

const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Noto+Sans:wght@400;700&display=swap";

const STRINGS = {
  en: {
    langLabel: "Language selection",
    langToggle: "Français",
    langToggleHref: "#",
    search: "Search",
    searchPlaceholder: "Search Canada.ca",
    searchLabel: "Search Canada.ca",
    menu: "Menu",
    menuLabel: "Menu",
    canadaHome: "https://www.canada.ca/en.html",
    gcName: "Government of Canada",
    gcNameBilingual: "Gouvernement du Canada",
    skipMain: "Skip to main content",
    skipAbout: "Skip to \"About government\"",
    youAreHere: "You are here:",
    canadaCa: "Canada.ca",
    dateModified: "Date modified:",
    aboutSite: "About this site",
    mainFooterHeading: "Government of Canada",
    subFooterHeading: "Government of Canada Corporate",
    links: {
      allContacts: ["All contacts", "https://www.canada.ca/en/contact.html"],
      departments: [
        "Departments and agencies",
        "https://www.canada.ca/en/government/dept.html",
      ],
      aboutGov: [
        "About government",
        "https://www.canada.ca/en/government/system.html",
      ],
      social: ["Social media", "https://www.canada.ca/en/social.html"],
      mobile: ["Mobile applications", "https://www.canada.ca/en/mobile.html"],
      aboutCanadaCa: [
        "About Canada.ca",
        "https://www.canada.ca/en/government/about.html",
      ],
      terms: [
        "Terms and conditions",
        "https://www.canada.ca/en/transparency/terms.html",
      ],
      privacy: ["Privacy", "https://www.canada.ca/en/transparency/privacy.html"],
    },
    wordmarkAlt: "Symbol of the Government of Canada",
  },
  fr: {
    langLabel: "Sélection de la langue",
    langToggle: "English",
    langToggleHref: "#",
    search: "Rechercher",
    searchPlaceholder: "Rechercher dans Canada.ca",
    searchLabel: "Rechercher dans Canada.ca",
    menu: "Menu",
    menuLabel: "Menu",
    canadaHome: "https://www.canada.ca/fr.html",
    gcName: "Gouvernement du Canada",
    gcNameBilingual: "Government of Canada",
    skipMain: "Passer au contenu principal",
    skipAbout: "Passer à « Au sujet du gouvernement »",
    youAreHere: "Vous êtes ici :",
    canadaCa: "Canada.ca",
    dateModified: "Date de modification :",
    aboutSite: "À propos de ce site",
    mainFooterHeading: "Gouvernement du Canada",
    subFooterHeading: "Gouvernement du Canada",
    links: {
      allContacts: [
        "Toutes les coordonnées",
        "https://www.canada.ca/fr/contact.html",
      ],
      departments: [
        "Ministères et organismes",
        "https://www.canada.ca/fr/gouvernement/min.html",
      ],
      aboutGov: [
        "À propos du gouvernement",
        "https://www.canada.ca/fr/gouvernement/systeme.html",
      ],
      social: ["Médias sociaux", "https://www.canada.ca/fr/sociaux.html"],
      mobile: ["Applications mobiles", "https://www.canada.ca/fr/mobile.html"],
      aboutCanadaCa: [
        "À propos de Canada.ca",
        "https://www.canada.ca/fr/gouvernement/a-propos.html",
      ],
      terms: [
        "Avis",
        "https://www.canada.ca/fr/transparence/avis.html",
      ],
      privacy: [
        "Confidentialité",
        "https://www.canada.ca/fr/transparence/confidentialite.html",
      ],
    },
    wordmarkAlt: "Symbole du gouvernement du Canada",
  },
} as const;

export function head(title: string, lang: Lang): string {
  return `<meta charset="utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapeHtml(title)} - Canada.ca</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="${GOOGLE_FONTS}">
<link rel="stylesheet" href="${ASSETS.css}">`;
}

export function header(lang: Lang): string {
  const s = STRINGS[lang];
  const sig = lang === "fr" ? ASSETS.sigFr : ASSETS.sigEn;
  return `<ul id="wb-tphp">
  <li class="wb-slc"><a class="wb-sl" href="#wb-cont">${s.skipMain}</a></li>
  <li class="wb-slc"><a class="wb-sl" href="#wb-info">${s.skipAbout}</a></li>
</ul>
<header>
  <div id="wb-bnr" class="container">
    <div class="row">
      <section id="wb-lng" class="col-xs-3 col-sm-12 pull-right text-right">
        <h2 class="wb-inv">${s.langLabel}</h2>
        <ul class="list-inline mrgn-bttm-0">
          <li><a lang="${lang === "en" ? "fr" : "en"}" href="${s.langToggleHref}">${s.langToggle}</a></li>
        </ul>
      </section>
      <div class="brand col-xs-9 col-sm-5 col-md-4" property="publisher" typeof="GovernmentOrganization">
        <a href="${s.canadaHome}" property="url">
          <img src="${sig}" alt="" property="logo">
          <span class="wb-inv" property="name"> ${s.gcName} / <span lang="${lang === "en" ? "fr" : "en"}">${s.gcNameBilingual}</span></span>
        </a>
        <meta property="areaServed" typeof="Country" content="Canada">
      </div>
      <section id="wb-srch" class="col-lg-offset-4 col-md-offset-4 col-sm-offset-2 col-lg-4 col-md-4 col-sm-5">
        <h2>${s.search}</h2>
        <form action="#" method="post" name="cse-search-box" role="search">
          <div class="form-group wb-srch-qry">
            <label for="wb-srch-q" class="wb-inv">${s.searchLabel}</label>
            <input name="q" type="search" value="" id="wb-srch-q" class="wb-srch-q form-control" size="34" maxlength="170" placeholder="${s.searchPlaceholder}">
            <datalist id="wb-srch-q-ac"></datalist>
            <button type="submit" id="wb-srch-sub" class="btn btn-primary" name="wb-srch-sub">
              <span class="glyphicon-search glyphicon"></span>
              <span class="wb-inv">${s.search}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
  <hr>
  <div class="container">
    <div class="row">
      <div class="col-md-8">
        <nav class="gcweb-menu" typeof="SiteNavigationElement">
          <h2 class="wb-inv">${s.menuLabel}</h2>
          <button type="button" aria-haspopup="true" aria-expanded="false">
            ${s.menu} <span class="expicon glyphicon glyphicon-chevron-down"></span>
          </button>
          <ul role="menu" aria-orientation="vertical" data-ajax-replace="https://cdn.canada.ca/gcweb-cdn-live/sitemenu/sitemenu-v5-${lang}.html"></ul>
        </nav>
      </div>
    </div>
  </div>
  <!-- Breadcrumb is injected by the LLM, before <main> -->`;
}

export function footer(lang: Lang): string {
  const s = STRINGS[lang];
  const L = s.links;
  return `<footer id="wb-info">
  <h2 class="wb-inv">${s.aboutSite}</h2>
  <div class="gc-main-footer">
    <div class="container">
      <nav>
        <h3>${s.mainFooterHeading}</h3>
        <ul class="list-col-xs-1 list-col-sm-2 list-col-md-3">
          <li><a href="${L.allContacts[1]}">${L.allContacts[0]}</a></li>
          <li><a href="${L.departments[1]}">${L.departments[0]}</a></li>
          <li><a href="${L.aboutGov[1]}">${L.aboutGov[0]}</a></li>
        </ul>
      </nav>
    </div>
  </div>
  <div class="gc-sub-footer">
    <div class="container d-flex align-items-center">
      <nav>
        <h3 class="wb-inv">${s.subFooterHeading}</h3>
        <ul>
          <li><a href="${L.social[1]}">${L.social[0]}</a></li>
          <li><a href="${L.mobile[1]}">${L.mobile[0]}</a></li>
          <li><a href="${L.aboutCanadaCa[1]}">${L.aboutCanadaCa[0]}</a></li>
          <li><a href="${L.terms[1]}">${L.terms[0]}</a></li>
          <li><a href="${L.privacy[1]}">${L.privacy[0]}</a></li>
        </ul>
      </nav>
      <div class="wtrmrk align-self-end ms-auto">
        <img src="${ASSETS.wordmark}" alt="${s.wordmarkAlt}">
      </div>
    </div>
  </div>
</footer>`;
}

export function scripts(): string {
  return `<script src="${ASSETS.wetJs}"></script>
<script src="${ASSETS.themeJs}"></script>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
