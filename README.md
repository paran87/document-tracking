# Oplan Kontra Baha — Equipment Requirement Tracker

A static website that presents the **REQ. FUND (EQUIPMENT)** sheet of
[FLOOD PRONE AREAS & REQ. FUND FOR EQUIPMENT](https://docs.google.com/spreadsheets/d/1KnQQnvU5NlFypK7k4zLJ9ni45eDvdHh2nPoUNkij5gc/edit?gid=1674923681#gid=1674923681).

## What it shows

- **Headline KPIs** — total amount requested, equipment units, line items, implementing offices, regions.
- **Overview charts** — amount by region, by equipment category, top implementing offices, most-requested equipment. Click any bar to filter the page.
- **Region cards** — open a region to see each office's equipment, quantities and costs.
- **Records table** — grouped by region/office or as a flat list; sortable, searchable, exportable to CSV, printable.
- **Source data issues** — an automatic audit of the Google Sheet, re-run on every load: wrong Qty × Unit Price calculations, missing prices, a TOTAL row and region totals that do not match their line items, totals typed on the wrong row or split across cells, possible duplicate rows, the same item priced differently, missing offices, incomplete descriptions, spelling errors, stray spaces and inconsistent peso formatting. Each issue shows its severity, sheet row (with a link to it), expected vs. actual value and peso impact, and can be exported to CSV. Affected rows are highlighted in the records table, which can be limited to rows with issues.

- **Equipment reality check** — flags entries whose name or specification cannot exist in real equipment (e.g. a 400 L vacuum truck, a long-arm excavator with a 4.5 cu.m bucket, a dump truck with a “15–18 m reach”, a 7 kg backhoe, a “flood vacuum truck”) and shows why, plus a suggested corrected entry. The rules live in `REALITY_RULES` in `assets/app.js` and are based on typical manufacturer specifications; suggestions should be confirmed with the requesting office.

Filters are kept in the URL, so a filtered view can be shared as a link.

- **Resolve issues** — one button applies fixes directly in Google Sheets: wrong Total Cost cells become `=E*D` formulas, each region's total becomes a single `=SUM(F…)` on its first row, the TOTAL row becomes `=SUM(F…)`, peso amounts typed as text become real numbers, extra spaces and known misspellings are cleaned. Suggested equipment corrections are offered unticked for review; issues that need a person (missing prices, duplicates, conflicting prices) are listed but never changed. Each cell is only changed if it still holds the value the page showed.
- **Fix history** — every change is logged in a *Fix History* tab (who, when, cell, before → after) and listed on the page, with **Undo** per batch.

## Enabling "Resolve issues" (one-time)

1. Open the spreadsheet → **Extensions → Apps Script**.
2. Paste the contents of [`apps-script/Code.gs`](apps-script/Code.gs) into `Code.gs` and change `PASSCODE` to a team secret.
3. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access: Anyone* → Deploy → allow access.
4. Copy the Web app URL (ends in `/exec`) and either paste it in the page's Resolve issues dialog (saved per browser) or set it in `assets/config.js` so every visitor has it.

Writes require the passcode; the history list is readable without it.

## Data

The page loads the sheet live (CSV export) every time it opens or when **Refresh** is pressed.
If the sheet can't be reached, it falls back to the snapshot in `data/equipment.csv`.
The sheet must stay shared as "Anyone with the link can view" for live loading to work.

To update the snapshot:

```sh
curl -L "https://docs.google.com/spreadsheets/d/1KnQQnvU5NlFypK7k4zLJ9ni45eDvdHh2nPoUNkij5gc/export?format=csv&gid=1674923681" -o data/equipment.csv
```

## Hosting

Plain HTML/CSS/JS — no build step. Enable **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root),
or open it locally with any static server, e.g. `python3 -m http.server`.
