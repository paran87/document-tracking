# Oplan Kontra Baha — Equipment Requirement Tracker

A static website that presents the **REQ. FUND (EQUIPMENT)** sheet of
[FLOOD PRONE AREAS & REQ. FUND FOR EQUIPMENT](https://docs.google.com/spreadsheets/d/1KnQQnvU5NlFypK7k4zLJ9ni45eDvdHh2nPoUNkij5gc/edit?gid=1674923681#gid=1674923681).

## What it shows

- **Headline KPIs** — total amount requested, equipment units, line items, implementing offices, regions.
- **Overview charts** — amount by region, by equipment category, top implementing offices, most-requested equipment. Click any bar to filter the page.
- **Region cards** — open a region to see each office's equipment, quantities and costs.
- **Records table** — grouped by region/office or as a flat list; sortable, searchable, exportable to CSV, printable.
- **Data checks** — rows where Qty × Unit Price ≠ Total Cost or prices are blank, and a reconciliation of computed region totals vs. the sheet's “Total Amount Requested” column.

Filters are kept in the URL, so a filtered view can be shared as a link.

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
