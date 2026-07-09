# Feedback data

Drop your IRCC page-feedback export here as **`ircc-feedback.csv`** (or point
`FEEDBACK_CSV_PATH` in `.env.local` at wherever you keep it).

The file shipped here is **sample data** so the Feedback tab works out of the
box — replace it with your real export whenever you like.

## What the parser needs

The auditor auto-detects three columns, so exact header names don't matter —
but it helps if they're recognizable:

- **A URL column** (`URL`, `Page`, `Link`, `Adresse`, …). Required — this is
  how comments are matched to each crawled page. Full URLs or site-relative
  paths (`/en/immigration-refugees-citizenship/...`) both work.
- **A comment column** (`Comment`, `Commentaire`, `Feedback`, `Details`, …).
  The free-text the user left.
- **A date column** (optional: `Date`, `Timestamp`, …).

Any other columns (tags, language, etc.) are kept and shown as-is.

## Matching

- **Exact match** compares the normalized URL path (trailing slashes, `?`, and
  `#` are ignored).
- **Include child pages** also pulls in any row whose path starts under the
  selected page's path — handy for judging a whole section at once.
