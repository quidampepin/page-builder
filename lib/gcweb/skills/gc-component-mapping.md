# GCWeb / WET-BOEW Component Mapping (reference)

Canonical HTML patterns for GCWeb components. GCWeb version: 18.2.0.

## Breadcrumb Trail (mandatory, emit this)

```html
<nav id="wb-bc" property="breadcrumb">
  <h2 class="wb-inv">You are here:</h2>
  <div class="container">
    <ol class="breadcrumb" typeof="BreadcrumbList">
      <li property="itemListElement" typeof="ListItem">
        <a property="item" typeof="WebPage" href="https://www.canada.ca/en.html">
          <span property="name">Canada.ca</span>
        </a>
        <meta property="position" content="1">
      </li>
      <li property="itemListElement" typeof="ListItem">
        <a property="item" typeof="WebPage" href="[parent-url]">
          <span property="name">[Parent page]</span>
        </a>
        <meta property="position" content="2">
      </li>
      <!-- Current page is NEVER the last item -->
    </ol>
  </div>
</nav>
```

First item always "Canada.ca". Current page never shown.

## Main page wrapper

```html
<main property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement" class="container">
  <h1 property="name" id="wb-cont">[Page title]</h1>
  <!-- content -->
  <dl id="wb-dtmd">
    <dt>Date modified:</dt>
    <dd><time property="dateModified">YYYY-MM-DD</time></dd>
  </dl>
</main>
```

## Alerts (GCWeb uses `<section>`, not `<div>`)

```html
<section class="alert alert-warning">
  <h3>Warning title</h3>
  <p>Alert content with optional <a href="#" class="alert-link">link text</a>.</p>
</section>
```

Variants: `alert-success`, `alert-info`, `alert-warning`, `alert-danger`.

## Services and Information (doormat grid)

```html
<section class="gc-srvinfo">
  <h2 class="wb-inv">Services and information</h2>
  <div class="row wb-eqht-grd">
    <div class="col-sm-6">
      <h3><a href="#">[Service title]</a></h3>
      <p>[Short description]</p>
    </div>
  </div>
</section>
```

## Most Requested

```html
<section class="gc-most-requested provisional">
  <h2>Most requested</h2>
  <ul>
    <li><a href="#">Top task 1</a></li>
  </ul>
</section>
```

## Context-Specific Features (image cards)

```html
<section class="gc-features">
  <h2>[Features title]</h2>
  <div class="row wb-eqht-grd">
    <div class="col-lg-4 col-sm-6">
      <div class="well well-sm eqht-trgt">
        <img src="[img]" alt="[alt]">
        <h3><a class="stretched-link" href="#">[Feature title]</a></h3>
        <p>[Description]</p>
      </div>
    </div>
  </div>
</section>
```

## Buttons

| Variant | Class | Use |
|---|---|---|
| Default | `btn btn-default` | Secondary |
| Primary | `btn btn-primary` | Main action |
| Call to Action | `btn btn-call-to-action` | Top task / hero |
| Success | `btn btn-success` | Positive confirmation |
| Warning | `btn btn-warning` | Caution |
| Danger | `btn btn-danger` | Destructive |

Sizes: `btn-lg`, `btn-sm`, `btn-xs`. Never use `role="button"` on `<a>`.

## Tables

```html
<table class="wb-tables table table-bordered" data-wb-tables='{"paging": false}'>
  <caption>[Table caption]</caption>
  <thead><tr><th scope="col">Col 1</th></tr></thead>
  <tbody><tr><td>Data</td></tr></tbody>
</table>
```

## Expand / collapse

```html
<details>
  <summary>Collapsed heading</summary>
  <p>Expanded content</p>
</details>
```

## In-Page Table of Contents

```html
<nav class="gc-toc">
  <h2 class="wb-inv">On this page</h2>
  <ol>
    <li><a href="#section1">Section 1</a></li>
  </ol>
</nav>
```

## Date Modified (end of main)

```html
<dl id="wb-dtmd">
  <dt>Date modified:</dt>
  <dd><time property="dateModified">YYYY-MM-DD</time></dd>
</dl>
```

## Grid

Bootstrap 3. `<div class="row">` with `col-xs-*`, `col-sm-*`, `col-md-*`, `col-lg-*`. Breakpoints: xs <768, sm ≥768, md ≥992, lg ≥1200.

## Utility classes

- `.wb-inv` — visually hidden (screen-reader only)
- `.mrgn-tp-{sm|md|lg|xl}`, `.mrgn-bttm-{sm|md|lg|xl}` — margins
- `.text-right`, `.text-left` — alignment
- `.stretched-link` — make whole card clickable
- `.wb-eqht-grd` + `.eqht-trgt` — equal height columns
- `.list-unstyled`, `.lst-spcd-2` — lists
