# Source document check — REQ. FUND (EQUIPMENT)

Date: 23 Oct 2026. Every Drive link in column G ("Total Amount Requested") was opened and each sheet row was compared with the request form it points to (quantity, unit price, total, implementing office, equipment description). Scanned pages that the text reader could not read reliably were rendered as images and read directly.

**Rule used:** a cell is "wrong" only when the sheet differs from its own source document (a transcription/encoding error). Where the source document itself is unrealistic or internally inconsistent, the sheet was left alone and the problem is listed under *Problems in the source documents*.

## 1. Links checked

| Region | Link (sheet row) | Source | Result |
|---|---|---|---|
| NCR | G6 | BOE-format list, 63 items, ₱981,565,000 | Lines match. G4 (₱299.2M gauging/velocity stations) has **no link/source**. |
| Region I | G69 | OUSC-746-26, RD Panaligan, 11 Sep 2026 | Lines match after fixes below; region total cell not updated |
| Region II | G121 | RO II consolidation (xlsx), 34 items, ₱734,442,500 | Lines match; rows 155–157 wrongly under Isabela 4th DEO |
| Region II (Additional) | G159 | Drive folder "Region II" | **Folder is empty** — rows 155–162 cannot be verified |
| Region III | G163 | OUSC-597-26, Zambales 2nd DEO | ✓ all 3 lines match |
| CAR – Apayao 2nd | G166 | Drive folder "CAR" | **Folder is empty**; the memo is inside the CAR RO folder (see below) |
| CAR – Regional Office | G173 | folder: equipment program (₱225M) + OUSC-807-26 Apayao memo | ✓ lines match |
| Region IV-B | G186 | OUSC-805-26, MIMAROPA | 4 transcription errors |
| Region IV-A | G210 | OUSC-827-26, certified total ₱1,023,500,000 | ✓ 33 lines match; **G210 is ₱34M short** |
| Region V | G231 | OUSC-778-26, ₱2,498,000,000 | ✓ all 17 lines match |
| Region VI | G248 | OUSC-748-26 | ✓ lines match (specs omitted, Amphbious typo) |
| Region VII | G257 | OKB form, ₱808,800,000 | ✓ all 24 lines match |
| NIR | G281 | OUSC-771-26 | 1 transcription error |
| Region VIII | G299 | OUSC-770-26 | **Source has no prices**; quantities differ |
| Region IX | G324 | Drive folder | **Folder is empty** |
| Region X | G329 | Drive folder | **Folder is empty** (sheet total ≠ lines by ₱50.945M) |
| Region XI | G349 | OUSC-769-26, 67 items | 14 transcription errors |
| Region XII | G416 | OUSC-751-26, ₱480,000,000 | ✓ all 3 lines match |
| Region XIII | G419 | OUSC-750-26, 14 items | ✓ lines match (spelling only) |

## 2. Corrections applied to Google Sheets (5 cells)

| Cell | Was | Now | Source |
|---|---|---|---|
| C90 | Mini Bachhoe - 0.05 cu.m, 1.5 - 2,0T | Mini Backhoe - 0.05 cu.m, 1.5 - 2.0T | Region I form: "Mini Backhoe 0.05 cu.m, 1.5-2.0T" |
| C110 | Trailer Mounted Wate Pump - 60 hp | Trailer Mounted Water Pump - 60 hp | "Trailer mounted water pump 60hp" |
| C111 | Crawle Mounted … Bucket Attachmet … | Crawler Mounted … Bucket Attachment … | "Crawler Mounted Hydraulic Excavator with Long Arm and Bucket attachment" |
| C112 | Trailer / Mobile Flood Mitigating **Flood** … | Trailer / Mobile Flood Mitigating **Pump** … | "Trailer / Mobile Flood Mitigating Pump, Flow Rate 150 cu.m/hr" |
| C116 | Watermastr / MAPD Units … | Watermaster / MPAD Units … | "Watermaster / MPAD Units" |

All other edits were blocked by the session's permission check before they ran (nothing else in the sheet was changed). A backup of the sheet as it was before any edit was kept.

## 3. Corrections ready to apply (verified against the source, not yet written)

### Wrong values / descriptions

| Cell | Sheet now | Should be | Evidence |
|---|---|---|---|
| C72 | Wheel Backhoe Loader - Backho Bucket 0.8m³ / Loader Bucket 0.20m³ | Wheel Backhoe Loader - Loader Bucket ≥0.8 m³ / Backhoe Bucket ≥0.20 m³ | Region I form: "Loader bucket ≥0.8 m³ … Backhoe bucket ≥0.20 m³" (sheet swapped them) |
| B155 / B158 | Rows 155–157 under Isabela 4th DEO; "Regional Office (Additional)" starts at 158 | B155 = Regional Office (Additional), B158 = (blank) | Region II form ends at item 34 (Water Tank Truck) with ₱734,442,500 = rows 121–154; rows 155–162 = ₱375,500,000 = the "Additional" total |
| C182 | Dump Truck – Capacity not indicated in source | Dump Truck – 10-wheeler; 10–12 cu. m dump body | IV-B form item 3: "10-Wheeler / 10-12 cu.m. dump body" |
| B183, C183 | (Mindoro Oriental) Payloader – 2–4 cu. m capacity | **Palawan 1st DEO** · Payloader – 2.4–3.0 cu. m capacity | IV-B form item 4: "Palawan 1st District Engineering Office, Payloader, 2.4-3.0 cubic meter" |
| C186 | … with Crane – 45.45 metric tons crane capacity | … with Crane – 10–15 metric tons GVW; 3–5 ton crane capacity | IV-B form item 6 (both copies) |
| C196 | Dump Truck – 240 hp; 7,790 mm wheelbase-related… | Dump Truck – 4×2; 240 PS (177 kW); 7,790 cc engine; 18,000 kg GVW | Marinduque spec: 7,790 ml is engine displacement; wheelbase is 4,500 mm |
| C249, C250, C252 | Hydraulic Excavator/ Crawler Type, Long Reach | … Long Reach - 13.8 MT, 12m Reach | Region VI form items 2, 3, 5 |
| C285 | Amphibious Excavator – **22–25-ton** class; … minimum 0.50 cu. m | Amphibious Excavator, Long Reach – **14-ton** class; twin pontoons; minimum 0.50 cu. m | NIR form item 5 (₱24M unit) |
| C311 | Dump Truck, Hino 3-Way - **14-1 MT**, 15-18m Reach | … - **14-16 MT**, 15-18m Reach | Region VIII form item 35 |
| C352, C356, C372, C382, C396, C414 | Vacuum Sewer Jet Cleaner (**40** cu.m each …) | (**4.0** cu.m each …) | Region XI form items 4, 8, 24, 34, 48, 66: "4.0 cu.m each" |
| C359 | Hydraulic Excavator, Wheel Mounted (0.35 cu.m bucket) | Hydraulic Excavator, Wheel Mounted, Long-arm (0.4 cu.m bucket) | Region XI item 11 |
| C365 | Vector Sewer Cleaner Truck (10 cu.m) | Vactor Sewer Cleaner Truck (10 cu.m) | Region XI item 17 |
| C370 | … Long-arm Wheel Mounted (0.35 cu.m, 15-18m reach) | … Long-arm Wheel Mounted (0.35 cu.m) | Region XI item 22 — no reach in source |
| **E381** | ₱15,500,000 | **₱15,000,000** (F381 is a formula and follows) | Region XI item 33, Davao del Norte 2nd Prime Mover |
| C383 | Flood Mitigating Equipment, **Trailer** mounted (10 cu.m/min) | …, **Truck** mounted (10 cu.m/min pump capacity) | Region XI item 35 |
| C384 | … Long-arm Wheel Mounted (**0.4** cu.m, 15-18m reach) | … Long-arm Wheel Mounted (**0.35** cu.m) | Region XI item 36 |
| C392 | Crawler Type **Long Arm** (2 cu.m) | Crawler Type **Excavator** (2 cu.m) | Region XI item 44 |
| C401 | … Long-arm Wheel Mounted (0.35 cu.m, 15-18m reach) | … Long-arm Wheel Mounted (0.35 cu.m) | Region XI item 53 |
| C402 | Flood Mitigating Equipment **with Booster Pump** (10 cu.m) | Flood Mitigating Equipment, **Truck Mounted** (10 cu.m/min pump capacity) | Region XI item 54 |

### Totals (column G)

| Cell | Sheet now | Should be | Why |
|---|---|---|---|
| **G6** | "₱981,565,000.00" stored as **text** | 981565000 as a number (same amount) | The TOTAL row is `=sum(G4:G432)`; text is skipped, so TOTAL is ₱981.6M short |
| **G210** | ₱989,500,000 | **₱1,023,500,000** | Region IV-A certified total; equals its 33 lines |
| G69 | ₱1,366,810,000 | ₱1,406,810,000 | Sum of the 52 verified Region I lines (Pangasinan 2nd vacuum truck is 2 × ₱40M = ₱80M in the source) |
| G349 | ₱1,729,475,500 | ₱1,728,975,500 | Sum of the 67 Region XI lines after the E381 fix |

With these applied, TOTAL (G433) becomes **₱14,033,296,680** (now ₱12,978,231,680). The remaining ₱146,945,000 gap to the line items is entirely CAR, Region VIII and Region X — see below.

### Spelling (source spells correctly)

C84 Bulldoxer→Bulldozer · C83 "2,5 -3.0"→"2.5-3.0" · C93 Excavato→Excavator · C100 Multipurpise→Multipurpose · C163 Accesories→Accessories · C170 LIght→Light · C248/C251/C253/C254/C255/C256 Amphbious→Amphibious · C420/C421 Poontons→Pontoons · C422 Vaccuum→Vacuum.

## 4. Needs a person (cannot be fixed from the sources)

- **Region VIII — no prices in the source.** The Regional Office VIII form leaves *Amount per Unit* and *Total Cost* blank for all 53 items. Every peso amount for Region VIII in the sheet (₱1.44B) was added later; ₱26,699,000 and ₱8,102,000 are Region VI's unit prices. Quantities also differ from the form:
  - Multi-Purpose Amphibious Dredge: form **6** (items 1, 3, 4, 6 = 2+1+2+1), sheet **3** (row 299)
  - Bulldozer: form **2** (items 12, 22), sheet **1** (row 306)
  - Item 5, Amphibious Excavator Long Reach 25-30 MT (no spud), qty 1 — **missing** from the sheet
  - Items 16–17 (Mini-Amphibious, Mirang & Lirang Creek) have a blank quantity on the form
  - Quantities were not changed because doing so would multiply prices that have no source.
- **CAR – Apayao 2nd DEO.** The memo's summary says Amphibious Excavator ₱45M / total ₱167M; its own technical spec says 3 × ₱40M = ₱120M. The sheet follows the spec (lines = ₱242M) but G166 shows ₱167M (₱75M apart). The DEO must confirm which is right.
- **Region X (₱50.945M), Region IX, Region II Additional, CAR Apayao folder** — the linked Drive folders are empty, so these rows could not be checked. Region X's lines total ₱465,390,000 vs G329 ₱414,445,000.
- **NCR rows 4–5** (₱299.2M gauging and velocity stations) have no implementing office and no source document link.
- **NCR Asphalt Rotomilling (row 40)** — the source says unit ₱25,000,000 but total ₱15,000,000 for 1 unit; the sheet uses ₱15M. Confirm with Quezon City 1st DEO.

## 5. Problems in the source documents (sheet copied them correctly)

- Region VI form: TOTAL printed ₱140,789,000 but its 9 lines add to ₱165,104,000 (sheet uses the correct ₱165,104,000).
- NIR form: TOTAL printed ₱220,000,000 but its 17 lines add to ₱345,000,000 (sheet uses ₱345M).
- Region VII form: unit count printed 42; its lines add to 43.
- Unrealistic specs that are really in the forms (so not sheet errors): Pangasinan 2nd "Tank Capacity 400L" vacuum truck; Ilocos Sur 2nd 600L jetting truck; Ilocos Norte 1st / Ilocos Sur 1st "Vacuum Truck – Flood, 200 mm discharge"; Ilocos Sur 1st wheel excavator with "Loader Capacity 1.00"; La Union 2nd long-arm with 2.0 cu.m bucket; Cavite 3rd backhoe "7 kg"; Region VII/Cebu long-arm 4.5 cu.m buckets and ₱2M 20 cu.m dump trucks; Davao de Oro 2nd "1 cu.m" vacuum cleaner; Davao del Norte 2nd wheel excavator with 15-18 m reach; Northern Samar dump truck with "15-18 m Reach" and "1 cu.mtrs" boom truck.
- Region VI and NIR "duplicate" rows are real: each unit is for a different river.

## 6. Region VIII unit costs (applied 23 Oct 2026)

The Region VIII form has no prices, so each item was priced from the same equipment type and size class in other regions' verified forms (median where several match). Quantities follow the Region VIII form. **Note:** a row was inserted at 303, so every row reference below old row 302 in sections 3–4 is now one higher.

| Equipment | Unit cost | Comparables |
|---|---|---|
| Multi-Purpose Amphibious Dredge | ₱90,000,000 | IV-A ₱75M · I ₱81M · II ₱90M · VII ₱90M · V ₱112M |
| Amphibious Excavator LR 25–30 MT, 15–18 m | ₱33,500,000 | XII ₱12M · NIR ₱26M · XIII ₱32M · XI ₱35M / ₱38.5M · I ₱55M |
| Amphibious Excavator LR 14–16 MT | ₱24,000,000 | NIR ₱24M (14-ton) · XIII ₱24M (16–18 t) |
| Hydraulic Excavator Crawler LR | ₱13,500,000 | I ₱12M / ₱24M · XIII ₱12M · XI ₱12M · NIR ₱15M ×2 |
| Mini-Amphibious Excavator | ₱15,000,000 | I ₱9M · VII ₱15M ×2 |
| Bulldozer | ₱11,500,000 | IV-B ₱11.48M ×2 / ₱11.5M · I ₱16M / ₱20M |
| Dump Truck 3 cu.m | ₱4,550,000 | 8 trucks in NCR and Region I, ₱4.43M–₱5.6M |
| Wheel Excavator DX190WA | ₱6,000,000 | NCR ₱6M ×2 · I ₱9M |
| Boom Truck | ₱9,000,000 | median of 11 boom trucks |
| Dump Truck Hino 3-way | ₱8,300,000 | XI 3-way dump trucks ₱8.3M ×2 |
| Pay Loader 20 MT | ₱12,000,000 | I payloaders 16–20 t ₱12M |
| Amphibious Excavator 1.5 cu.m, 10 m | ₱55,000,000 | IV-A ₱55M (same spec) |

Written to the sheet: rows 299–324 (quantity and unit cost; dredges 3→6, bulldozers 1→2), new row 303 for form item 5 (Amphibious Excavator LR 25–30 MT, 1 × ₱33.5M), F322 converted from text to a number, and G299 = ₱1,821,100,000 (was ₱1,438,705,000; Drive link kept). TOTAL row is now ₱13,360,626,680. Region VIII's two Mini-Amphibious lines with blank quantity (Mirang and Lirang Creek) still need confirmation; each extra unit adds ₱15,000,000.

## 7. Remaining corrections applied (23 Oct 2026)

All verified corrections from section 3 are now in the sheet (row numbers below old row 302 are +1 because of the row inserted in section 6). Every target cell was checked against its expected old value immediately before writing; a before/after comparison shows exactly these cells changed and nothing else.

- **Descriptions / offices (41 cells):** C72, C83, C84, C93, C100, B155 + B158 (Region II "Additional" block now starts at row 155), C163, C170, C182, B183 + C183 (Payloader moved to **Palawan 1st DEO**; the merged Mindoro Oriental office cell now spans rows 181–182 only), C186, C196, C248–C256, C285, C312, C353, C357, C360, C366, C371, C373, C383–C385, C393, C397, C402, C403, C415, C421–C423.
- **Price:** E382 ₱15,500,000 → ₱15,000,000 (Davao del Norte 2nd prime mover; F382 follows by formula).
- **Totals:** G6 NCR ₱981,565,000 converted from text to a number; G69 Region I → ₱1,406,810,000; G210 Region IV-A → ₱1,023,500,000; G350 Region XI → ₱1,728,975,500. Drive links on all four cells were re-attached after writing.

**TOTAL row (G434): ₱14,415,691,680** (₱12,978,231,680 before this check). The line items add up to ₱14,541,636,680; the remaining ₱125,945,000 difference is exactly the two unresolved cases in section 4: CAR Apayao 2nd (₱75,000,000 — memo summary vs. its own spec) and Region X (₱50,945,000 — source folder empty).
