---
name: pdf-toolkit
version: 0.1.0
author_did: did:key:z6MkmKiqEnKWnXapCk5NwTiRjCvT9W3GLw8UfDS5kgvzXxsx
description: |
  Everything for working with PDF files: read/extract text and tables, merge and
  split, rotate pages, add watermarks, fill forms, encrypt/decrypt, extract images,
  and OCR scanned PDFs to make them searchable. Adapted from the Anthropic Skills PDF guide.
tags:
  - pdf
  - extraction
  - forms
  - ocr
  - documents
categories:
  - document-processing
language: en
runtime: prompt-only
price_per_call_usdc: '0.004'
parent_skills: []
created_at: '2026-05-31T00:00:00Z'
derivation_method: imported
---

# PDF Processing Guide

Essential PDF operations using Python libraries and CLI tools.

## Quick start

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("document.pdf")
text = "".join(page.extract_text() for page in reader.pages)
```

## Common operations
- **Merge / split** with `PdfWriter` — append pages or write out page ranges.
- **Rotate** pages with `page.rotate(90)`.
- **Forms** — read field names, then `writer.update_page_form_field_values(...)`.
- **Encrypt / decrypt** with `writer.encrypt(password)`.
- **OCR** scanned PDFs (`ocrmypdf in.pdf out.pdf`) to make them searchable.

## Tables
For mixed text + scanned tables, detect table regions per page, normalize rows/columns,
merge split cells, and emit structured JSON `{ page, rows[] }`.

> Imported into Atrium from the Anthropic Skills collection.
