# Canada.ca SEO: Metadata & Structured Data (reference)

Base all metadata on actual page content. Never invent.

## Metadata block pattern

```html
<title>Page title here - Canada.ca</title>
<meta name="dcterms.title" content="Page title here - Canada.ca">
<meta name="description" content="Plain-language description under 130 chars.">
<meta name="dcterms.description" content="Plain-language description under 130 chars.">
<meta name="keywords" content="keyword1, keyword 2, abbreviation, synonym">
```

## Title tag
- Max 60 characters, front-loaded with keywords
- For generic titles, prepend department or service name (`Study permit: How to apply`, not `How to apply`)
- AEM auto-appends `- Canada.ca`

## Meta description
- 1–2 plain-language sentences
- Max 130 characters (hard limit 160)
- Don't repeat the title; don't use keyword lists; no marketing fluff

## Keywords (Canada.ca site search only)
- Don't repeat words already prominent on the page
- Include: everyday synonyms, abbreviations, older program names, common misspellings
- 5–10 items, max ~400 chars total

## Structured data (JSON-LD)

| Page type | Schema |
|-----------|--------|
| Q&A sections / accordions | `FAQPage` |
| Step-by-step process | `HowTo` |
| Event | `Event` |
| Emergency announcement | `SpecialAnnouncement` |
| Voice-search target | `WebPage` with `Speakable` |

Publisher block (required):
```json
"publisher": {
  "@type": "GovernmentOrganization",
  "@id": "#wb-publisher",
  "name": "Government of Canada",
  "url": "https://www.canada.ca/en.html"
}
```

Script block:
```html
<script id="wb-script" type="application/ld+json">
{ "@context": "http://schema.org", "@id": "#wb-main", "@type": "...", ... }
</script>
```

Only include questions/answers explicitly on the page. For FAQPage links, add `utm_source=google&utm_medium=organic&utm_campaign=faq-data`.
