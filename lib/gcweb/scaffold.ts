/**
 * Canonical empty Canada.ca page scaffold.
 *
 * Used by app/page.tsx when the user clicks "Blank scaffold" to seed a
 * fresh page with the standard structure: breadcrumb on top, <main>
 * with placeholder H1 and lead paragraph, page-details (date-modified)
 * at the bottom. The user fills in real content via chat or HTML edit.
 *
 * Same shape as what compose() expects for `content` — breadcrumb
 * directly followed by <main>. extractContent() handles it the same
 * way as any LLM-generated page.
 */

const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

export const BLANK_SCAFFOLD_EN = `<nav id="wb-bc" property="breadcrumb">
  <h2 class="wb-inv">You are here:</h2>
  <div class="container">
    <ol class="breadcrumb">
      <li><a href="https://www.canada.ca/en.html">Canada.ca</a></li>
      <li>Topic</li>
    </ol>
  </div>
</nav>
<main property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement" class="container">
  <h1 property="name" id="wb-cont">Page title</h1>
  <p>Lead paragraph introducing the page topic.</p>
  <h2 id="overview">Overview</h2>
  <p>Replace with your first section.</p>
  <div class="pagedetails">
    <div class="row">
      <div class="col-sm-5 col-md-4 col-lg-4"></div>
      <div class="datemod col-sm-4 col-md-3 col-md-offset-2 col-lg-3 col-lg-offset-2">
        <dl id="wb-dtmd">
          <dt>Date modified:</dt>
          <dd><time property="dateModified">${today}</time></dd>
        </dl>
      </div>
    </div>
  </div>
</main>`;

export const BLANK_SCAFFOLD_FR = `<nav id="wb-bc" property="breadcrumb">
  <h2 class="wb-inv">Vous êtes ici :</h2>
  <div class="container">
    <ol class="breadcrumb">
      <li><a href="https://www.canada.ca/fr.html">Canada.ca</a></li>
      <li>Sujet</li>
    </ol>
  </div>
</nav>
<main property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement" class="container">
  <h1 property="name" id="wb-cont">Titre de la page</h1>
  <p>Paragraphe de présentation du sujet de la page.</p>
  <h2 id="apercu">Aperçu</h2>
  <p>Remplacez par votre première section.</p>
  <div class="pagedetails">
    <div class="row">
      <div class="col-sm-5 col-md-4 col-lg-4"></div>
      <div class="datemod col-sm-4 col-md-3 col-md-offset-2 col-lg-3 col-lg-offset-2">
        <dl id="wb-dtmd">
          <dt>Date de modification :</dt>
          <dd><time property="dateModified">${today}</time></dd>
        </dl>
      </div>
    </div>
  </div>
</main>`;

export function blankScaffold(lang: "en" | "fr"): string {
  return lang === "fr" ? BLANK_SCAFFOLD_FR : BLANK_SCAFFOLD_EN;
}
