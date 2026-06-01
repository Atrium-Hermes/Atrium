---
name: pdf-table-extractor
version: 0.1.0
author_did: did:key:z6MkREPLACE_WITH_YOUR_DID_AFTER_INIT
description: |
  Extracts tabular data from PDF documents with mixed text and scanned content.
  Handles multi-page tables, irregular cell layouts, and merged cells.
  Returns structured JSON with row/column normalization.
tags:
  - pdf
  - extraction
  - tables
  - ocr
  - document-processing
categories:
  - document-processing
language: en
runtime: prompt-only
inputs:
  - name: pdf_url
    type: string
    description: HTTPS URL or IPFS URI to the PDF
    required: true
  - name: page_range
    type: string
    description: 'Pages to process, e.g. "1-5" or "all"'
    default: all
outputs:
  - name: tables
    type: array
    schema:
      type: object
      properties:
        page: { type: number }
        rows: { type: array }
price_per_call_usdc: '0.005'
parent_skills: []
created_at: '2026-05-31T12:00:00Z'
derivation_method: manual
---

# PDF Table Extractor

A skill for reliably extracting tabular data from PDFs.

## When to use this skill

Load this skill when you need to:

- Pull structured tables out of financial reports, scientific papers, or government filings
- Handle PDFs where tables span multiple pages
- Process scanned PDFs (combines with OCR parent skill if available)
- Normalize tabular output to JSON with consistent column types

## Decision tree

1. **Determine PDF type**
   - Embedded text → use direct extraction (pdfplumber or equivalent)
   - Scanned image → route to OCR pipeline first, then extraction
   - Mixed → process pages independently, merge results

2. **Detect table boundaries**
   - Look for grid lines (rectangular geometry)
   - Fall back to text alignment heuristics if no lines
   - Use vertical whitespace as row separator

3. **Extract cells**
   - Read top-to-bottom, left-to-right within each detected table
   - Preserve merged-cell semantics (repeat parent value in spanned children)
   - Strip excess whitespace, normalize unicode

4. **Validate structure**
   - All rows in a table should have same column count (within tolerance)
   - If mismatch > 10%, flag for human review rather than silently corrupt
   - Type-infer columns: numeric, date, currency, text

5. **Output normalization**
   - Convert numeric strings to numbers (handle thousand separators, decimal commas)
   - Detect and parse dates (ISO 8601 output)
   - Preserve original cell text in `raw` field for debugging

## Example invocation

Input:
```json
{
  "pdf_url": "https://example.com/q3-earnings.pdf",
  "page_range": "12-18"
}
```

Expected output shape:
```json
{
  "tables": [
    {
      "page": 12,
      "title": "Revenue by Segment",
      "headers": ["Segment", "Q3 2025", "Q3 2024", "YoY %"],
      "rows": [
        ["Cloud", 18420000, 14210000, 29.6],
        ["Devices", 9120000, 8950000, 1.9]
      ]
    }
  ]
}
```

## Edge cases handled

- Multi-line cells (newline inside a cell)
- Rotated text (90° tables, common in landscape spreads)
- Footnotes embedded in table cells
- Multi-row headers (treats lower row as actual header)
- Empty cells distinguished from zero values

## Edge cases NOT handled

- Hand-drawn tables in scanned PDFs (accuracy drops below 60%)
- Tables where structure is encoded in color only (no geometric cues)
- PDFs with active forms/JavaScript

## Failure modes

If extraction confidence falls below 0.7 for a page, the skill returns:
```json
{ "error": "low_confidence", "page": N, "raw_text": "..." }
```
Rather than silently outputting garbage.
