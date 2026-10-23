(function () {
  "use strict";

  var SHEET_ID = "1KnQQnvU5NlFypK7k4zLJ9ni45eDvdHh2nPoUNkij5gc";
  var GID = "1674923681";
  var LIVE_URL = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/export?format=csv&gid=" + GID;
  var SNAPSHOT_URL = "data/equipment.csv";
  var UNSPECIFIED = "Region-wide (no office listed)";

  // Order matters: first match wins.
  var CATEGORIES = [
    ["Amphibious & Dredging", /amph|dredg|water lily|cutter suction/i],
    ["Sewer & Drainage Cleaning", /sewer|vacuum|jetting|jet cleaner|vector/i],
    ["Pumps & Flood Mitigation", /pump|flood mitigat|flood-control|watermast|dewater|flood\b/i],
    ["Excavators & Backhoes", /excavat|backho|bachhoe|auger/i],
    ["Loaders, Dozers & Graders", /loader|payloader|pay loader|bulldo|dozer|grader|roller|skid|tractor|bobcat/i],
    ["Barges & Marine", /barge|scow/i],
    ["Dump Trucks", /dump/i],
    ["Tankers", /water truck|water tank|fuel tank|tanker/i],
    ["Lifting & Hauling", /boom|crane|manlift|man lifter|self.?loading|prime mover|trailer|low.?bed|flatbed/i],
    ["Monitoring Stations", /gauging|radar|station/i],
    ["Support & Other", /./]
  ];

  var state = {
    all: [],
    regions: [],
    declared: {},
    declaredGrand: 0,
    source: "",
    loadedAt: null,
    q: "",
    region: "",
    office: "",
    cat: "",
    view: "grouped",
    sort: { key: "", dir: 1 },
    audit: { issues: [] },
    issuesOnly: false,
    sev: "",
    itype: "",
    issueScope: true,
    issueLimit: 25
  };

  var $ = function (id) { return document.getElementById(id); };
  function sheetLink(row, row2) {
    return "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/edit#gid=" + GID + (row ? "&range=A" + row + ":G" + (row2 || row) : "");
  }

  // ---------- Formatting ----------
  var peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
  var int = new Intl.NumberFormat("en-PH");
  function money(n) { return peso.format(n || 0); }
  function compact(n) {
    var a = Math.abs(n);
    if (a >= 1e9) return "₱" + (n / 1e9).toFixed(2) + "B";
    if (a >= 1e6) return "₱" + (n / 1e6).toFixed(a >= 1e8 ? 0 : 1) + "M";
    if (a >= 1e3) return "₱" + (n / 1e3).toFixed(0) + "K";
    return "₱" + n;
  }
  function pct(n, d) { return d ? (n / d * 100).toFixed(n / d < 0.1 ? 1 : 0) + "%" : "0%"; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- Parsing ----------
  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function clean(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
  function num(s) {
    var v = parseFloat(String(s || "").replace(/[^0-9.\-]/g, ""));
    return isFinite(v) ? v : 0;
  }
  function categorize(name) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i][1].test(name)) return CATEGORIES[i][0];
    return "Support & Other";
  }
  function splitName(eq) {
    var m = eq.match(/^(.*?)\s+[–—-]\s+(.*)$/);
    if (m) return [m[1], m[2]];
    m = eq.match(/^(.*?)\s*\((.*)\)?\s*$/);
    if (m && m[1]) return [m[1], m[2].replace(/\)$/, "")];
    return [eq, ""];
  }
  function typeKey(name) {
    return name.replace(/^\d+[- ]?(ft|wheeler)[- ]?(reach )?/i, "")
      .replace(/\s*[,/].*$/, "")
      .replace(/dumptrucks?|dump trucks/i, "Dump Truck")
      .replace(/\bamphbious\b/i, "Amphibious")
      .trim();
  }

  function normalize(rows) {
    var start = 0;
    for (var i = 0; i < Math.min(rows.length, 10); i++) {
      if (/implementing office/i.test(rows[i][1] || "")) { start = i + 1; break; }
    }
    var out = [], regions = [], declared = {}, declaredCells = {}, regionFirstRow = {};
    var grand = 0, grandRow = 0, emptyRows = [], rawCells = [];
    var region = "", office = "";
    for (var r = start; r < rows.length; r++) {
      var row = rows[r];
      var rg = clean(row[0]), of = clean(row[1]), eq = clean(row[2]);
      var decl = num(row[6]);
      var sheetRow = r + 1;
      if (rg) { region = rg; office = ""; if (regions.indexOf(rg) < 0) { regions.push(rg); regionFirstRow[rg] = sheetRow; } }
      if (of) office = of;
      if (rg || of || eq) rawCells.push({ row: sheetRow, region: region, office: office, cells: row });
      if (!eq) {
        if (decl && !rg && !of) { grand = decl; grandRow = sheetRow; }
        else if (!row.some(function (c) { return clean(c); })) emptyRows.push(sheetRow);
        continue;
      }
      if (!region) continue;
      if (decl) {
        declared[region] = (declared[region] || 0) + decl;
        (declaredCells[region] = declaredCells[region] || []).push({ row: sheetRow, value: decl, office: office });
      }
      var parts = splitName(eq);
      var qty = num(row[3]), unit = num(row[4]), total = num(row[5]);
      var rec = {
        id: out.length,
        sheetRow: sheetRow,
        region: region,
        office: office || UNSPECIFIED,
        noOffice: !office,
        equipment: eq,
        name: parts[0],
        spec: parts[1],
        type: typeKey(parts[0]),
        category: categorize(eq),
        qty: qty,
        unit: unit,
        total: total,
        rawQty: clean(row[3]),
        issues: []
      };
      rec.hay = (region + " " + rec.office + " " + eq + " " + rec.category).toLowerCase();
      out.push(rec);
    }
    // Blank rows after the last data row are just sheet padding.
    var lastRow = Math.max(grandRow, out.length ? out[out.length - 1].sheetRow : 0);
    emptyRows = emptyRows.filter(function (x) { return x < lastRow; });
    return {
      records: out, regions: regions, declared: declared, declaredCells: declaredCells,
      regionFirstRow: regionFirstRow, grand: grand, grandRow: grandRow, emptyRows: emptyRows, rawCells: rawCells
    };
  }

  // ---------- Source sheet audit ----------
  var ISSUE_TYPES = {
    "calc": ["critical", "Wrong calculation"],
    "missing-value": ["critical", "Missing price / quantity"],
    "grand-total": ["critical", "Grand total mismatch"],
    "region-total": ["critical", "Region total mismatch"],
    "duplicate": ["warning", "Possible duplicate row"],
    "price-conflict": ["warning", "Same item, different price"],
    "price-outlier": ["warning", "Unusual unit price"],
    "total-placement": ["warning", "Region total placement"],
    "missing-office": ["warning", "Missing implementing office"],
    "incomplete": ["warning", "Incomplete description"],
    "typo": ["minor", "Spelling error"],
    "format": ["minor", "Inconsistent formatting"],
    "whitespace": ["minor", "Extra spaces / line breaks"],
    "empty-row": ["minor", "Blank row inside data"],
    "nonexistent": ["critical", "Equipment doesn't exist as described"],
    "misnamed": ["warning", "Wrong equipment name"],
    "implausible": ["warning", "Unrealistic specification"]
  };
  var REALITY_TYPES = ["nonexistent", "misnamed", "implausible"];
  var SEVERITY = { critical: "Critical", warning: "Warning", minor: "Minor" };
  var SEV_ORDER = { critical: 0, warning: 1, minor: 2 };

  var TYPOS = [
    [/\bbachhoe\b/i, "Backhoe"], [/\bbacho\b/i, "Backhoe"], [/\bexcavato\b/i, "Excavator"],
    [/\bamphbious\b/i, "Amphibious"], [/\bpoontons?\b/i, "Pontoon"], [/\bvaccuum\b/i, "Vacuum"],
    [/\bbulldoxer\b/i, "Bulldozer"], [/\bwate\b/i, "Water"], [/\bcrawle\b/i, "Crawler"],
    [/\battachmet\b/i, "Attachment"], [/\bmultipurpise\b/i, "Multipurpose"], [/\baccesories\b/i, "Accessories"],
    [/\bwatermastr\b/i, "Watermaster"]
  ];
  var MONEY_FMT = /^₱\d{1,3}(,\d{3})*\.\d{2}$/;

  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function itemKey(eq) {
    return eq.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").replace(/\s*-\s*/g, " - ").trim();
  }


  // ---------- Equipment reality check ----------
  // Each rule looks at one equipment description and, when the machine or its
  // specification cannot exist as written, returns why and a suggested fix.
  var CUM = "(?:cu\\.?\\s*m(?:trs?|ts?)?\\.?|m³|cbm)";
  function cuM(e) {
    var m = e.match(new RegExp("(\\d*\\.?\\d+)\\s*" + CUM + "(?!\\s*\\.?\\s*\\/)", "i"));
    return m ? { value: parseFloat(m[1]), text: m[0] } : null;
  }
  function litres(e) {
    if (/cylinder|engine/i.test(e)) return null;
    var m = e.match(/(\d[\d,]*(?:\.\d+)?)\s*-?\s*(?:l|liters?|litres?)\b(?!\s*\/\s*min)/i);
    if (m) return { value: num(m[1]), text: m[0] };
    var c = cuM(e);
    return c ? { value: c.value * 1000, text: c.text, cum: true } : null;
  }
  function flowLpm(e) {
    var m = e.match(/(\d[\d,]*)\s*(?:l|liters?|litres?)\s*\/\s*min(?:ute)?/i);
    return m ? { value: num(m[1]), text: m[0] } : null;
  }
  function reachM(e) {
    var m = e.match(/(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?\s*m(?:tr)?\.?\s*reach/i);
    return m ? { value: parseFloat(m[2] || m[1]), text: m[0] } : null;
  }
  var isLongReach = /long[- ]?(arm|reach)|\bLR\b/i;

  var REALITY_RULES = [
    function (e) {
      if (!/dump/i.test(e) || /excavat|backho/i.test(e) || !reachM(e)) return null;
      return { kind: "nonexistent",
        why: "A dump truck has no boom, so it cannot have a “" + reachM(e).text + "”. The tonnage/reach text looks copied from an excavator row.",
        fix: e.slice(0, e.lastIndexOf(" - ") > 0 ? e.lastIndexOf(" - ") : e.length).trim() + " – 3–6 cu. m dump box", note: "Confirm the actual dump-box capacity with the office." };
    },
    function (e) {
      if (!/boom truck|crane/i.test(e) || /excavat/i.test(e) || !cuM(e)) return null;
      return { kind: "nonexistent",
        why: "Boom trucks and cranes are rated by lifting capacity in tons, not by volume. “" + cuM(e).text + "” is not a boom-truck specification.",
        fix: e.replace(cuM(e).text, "5–10 ton lifting capacity"), note: "Confirm the needed lifting capacity." };
    },
    function (e) {
      var m = e.match(/operating weight[:\s]*(\d+(?:\.\d+)?)\s*kg/i);
      if (!m || parseFloat(m[1]) >= 500 || !/backho|excavat|loader/i.test(e)) return null;
      return { kind: "nonexistent",
        why: "No backhoe or excavator weighs " + m[1] + " kg. The smallest mini excavators weigh about 1,000 kg.",
        fix: e.replace(/\s*\(as indicated in source\)/i, "").replace(m[1] + " kg", m[1] + " tons (" + int.format(parseFloat(m[1]) * 1000) + " kg)"),
        note: "Most likely a missing “t” (tons)." };
    },
    function (e) {
      if (!/vacuum|vaccuum|jetting|sewer jet|jet cleaner|sewer cleaner/i.test(e)) return null;
      var l = litres(e);
      if (!l) return null;
      if (l.value < 2000) {
        return { kind: "nonexistent",
          why: "Truck-mounted vacuum / sewer-jetting units carry about 2,000–10,000 L. A " + int.format(l.value) + " L tank is the size of a trailer pressure washer, not a vacuum truck.",
          fix: e.replace(l.text, l.cum ? "4 cu.m" : "4,000 L"), note: "Other offices in this sheet request 4 cu.m (4,000 L) units." };
      }
      if (l.cum && l.value > 20000 && /each/i.test(e)) {
        return { kind: "implausible",
          why: "Two " + l.text + " tanks (sludge + water) would weigh about " + Math.round(l.value * 2 / 1000) + " tons when full, far more than any road-legal truck can carry.",
          fix: e.replace(l.text, (l.value / 10000) + " cu.m"), note: "Very likely a typo for " + (l.value / 10000) + " cu.m, the figure other offices use." };
      }
      return null;
    },
    function (e) {
      if (!isLongReach.test(e) || /amph/i.test(e) || !/excavat|backho|crawler/i.test(e)) return null;
      var b = cuM(e);
      if (!b || b.value <= 1.2) return null;
      return { kind: "nonexistent",
        why: "Long-arm / long-reach excavators trade bucket size for reach. Their buckets are about 0.25–0.8 cu.m. A " + b.value + " cu.m bucket on a long arm is not offered by any manufacturer.",
        fix: e.replace(b.text, "0.5 cu.m"),
        note: "If a " + b.value + " cu.m bucket is really needed, request a standard (short-arm) excavator instead." };
    },
    function (e) {
      if (!/amph/i.test(e) || /dredg/i.test(e)) return null;
      var b = cuM(e);
      if (!b || b.value <= 1.0) return null;
      return { kind: "implausible",
        why: "Amphibious (pontoon) excavators carry buckets of about 0.2–1.0 cu.m. A bigger bucket would tip the pontoons, and " + b.value + " cu.m is not offered.",
        fix: e.replace(b.text, "0.8 cu.m"), note: "Confirm the bucket size with the office." };
    },
    function (e) {
      if (!/wheel/i.test(e) || !/excavat/i.test(e) || /loader/i.test(e)) return null;
      var b = cuM(e), r = reachM(e);
      if (r && r.value >= 13) {
        return { kind: "implausible",
          why: "Wheeled excavators reach about 8–10 m (long-arm versions about 12 m). A " + r.text + " is only possible on a crawler long-reach excavator.",
          fix: e.replace(r.text, isLongReach.test(e) ? "up to 12 m reach" : "9–10 m reach"), note: "Or change the machine to “Long-Reach Crawler Excavator” if the 15–18 m reach is required." };
      }
      if (b && b.value > 1.2) {
        return { kind: "implausible",
          why: "Wheeled excavators use buckets up to about 1.0 cu.m. A " + b.value + " cu.m bucket is a 30-ton-plus crawler excavator size.",
          fix: e.replace(b.text, "0.9 cu.m"), note: "" };
      }
      return null;
    },
    function (e) {
      if (!/excavat/i.test(e) || !/loader capacity/i.test(e)) return null;
      var b = e.match(/bucket capacity[:\s]*(\d*\.?\d+)/i), l = e.match(/loader capacity\s*(\d*\.?\d+)/i);
      return { kind: "nonexistent",
        why: "An excavator has no loader bucket. “Bucket + Loader capacity” is a backhoe-loader specification copied into an excavator row.",
        fix: "Backhoe Loader, Wheel Type – Backhoe bucket " + (b ? b[1] : "0.2") + " cu.m; Loader bucket " + (l ? l[1] : "1.0") + " cu.m",
        note: "Or keep the excavator and give its real bucket size (e.g. 0.59 cu.m, as in the row above)." };
    },
    function (e) {
      var b = e.match(/backho\w*\s*bucket\s*(\d*\.?\d+)\s*(m³|cu\.?\s*m)?/i), l = e.match(/loader\s*bucket\s*(\d*\.?\d+)\s*(m³|cu\.?\s*m)?/i);
      if (!b || !l || parseFloat(b[1]) <= parseFloat(l[1])) return null;
      return { kind: "implausible",
        why: "On a backhoe loader the rear backhoe bucket (about 0.1–0.3 cu.m) is smaller than the front loader bucket (about 0.8–1.2 cu.m). The two values look swapped.",
        fix: e.replace(/backho\w*\s*bucket\s*\d*\.?\d+\s*(m³|cu\.?\s*m)?/i, "Backhoe Bucket " + l[1] + " m³").replace(/loader\s*bucket\s*\d*\.?\d+\s*(m³|cu\.?\s*m)?/i, "Loader Bucket " + b[1] + " m³"),
        note: "" };
    },
    function (e) {
      if (!/vacuum truck/i.test(e) || !/flood/i.test(e)) return null;
      var d = e.match(/(\d+)\s*mm/i);
      return { kind: "nonexistent",
        why: "A vacuum truck sucks sludge into a tank. It has no flood-discharge outlet, and a “flood vacuum truck” is not a real machine. The 200 mm discharge describes a truck-mounted flood (dewatering) pump.",
        fix: "Truck-Mounted Flood Mitigating Pump – " + (d ? d[1] + " mm (" + Math.round(d[1] / 25) + "-inch) discharge" : "8-inch discharge"), note: "" };
    },
    function (e) {
      if (!/mitigating flood\b/i.test(e)) return null;
      return { kind: "misnamed",
        why: "“Flood Mitigating Flood” is not an equipment name. The flow-rate spec shows this is a flood-mitigating pump.",
        fix: e.replace(/trailer\s*\/\s*mobile flood mitigating flood/i, "Trailer-Mounted Mobile Flood Mitigating Pump").replace(/mitigating flood\b/i, "Mitigating Pump"), note: "" };
    },
    function (e) {
      if (!/rotary wheel excavator|bucket[- ]wheel excavator/i.test(e)) return null;
      var b = cuM(e);
      if (b && b.value >= 5) return null;
      return { kind: "misnamed",
        why: "A rotary / bucket-wheel excavator is a giant open-pit mining machine weighing thousands of tons. With a " + (b ? b.value + " cu.m" : "small") + " bucket, this is a wheel-type (rubber-tired) hydraulic excavator.",
        fix: "Hydraulic Excavator, Wheel Mounted" + (b ? " (" + b.text + ")" : ""), note: "" };
    },
    function (e) {
      if (!/\bvector\b/i.test(e)) return null;
      return { kind: "misnamed",
        why: "“Vector” is not an equipment type. The intended item is a combination sewer-cleaner truck, often called by the brand name Vactor®.",
        fix: e.replace(/vector sewer cleaner truck/i, "Combination Sewer Jet and Vacuum Truck").replace(/\bvector\b/i, "Combination"), note: "" };
    },
    function (e) {
      if (!/^loader excavator/i.test(e)) return null;
      return { kind: "misnamed",
        why: "“Loader excavator” is not a standard machine type. A wheel machine with both a loader and a digging bucket is a backhoe loader.",
        fix: e.replace(/^loader excavator,?\s*wheel mounted/i, "Backhoe Loader, Wheel Type").replace(/^loader excavator/i, "Backhoe Loader"), note: "" };
    },
    function (e) {
      if (!/^crawler\s*(type)?\s*(long arm|lr)\b/i.test(e) || /excavat|backho/i.test(e)) return null;
      return { kind: "misnamed",
        why: "The machine type is missing: “crawler long arm” is an excavator configuration, not a machine by itself.",
        fix: e.replace(/^crawler\s*(type)?\s*(long arm|lr)\b/i, "Long-Reach Crawler Excavator"), note: "" };
    },
    function (e) {
      if (!/boom crane/i.test(e) || !/person/i.test(e)) return null;
      return { kind: "misnamed",
        why: "A 2-person / 200 kg bucket with 24 m lifting height is an aerial manlift (bucket truck) for people, not a crane for lifting loads.",
        fix: "Truck-Mounted Aerial Manlift (Bucket Truck) – 2-person, 200 kg basket; 24 m working height; 360° slewing", note: "" };
    },
    function (e) {
      var m = e.match(/(\d+(?:\.\d+)?)\s*metric tons?\s*crane capacity/i);
      if (!m || !/self[- ]?loading/i.test(e) || parseFloat(m[1]) < 25) return null;
      return { kind: "implausible",
        why: "Truck-mounted (knuckle-boom) self-loading cranes lift about 3–15 t. " + m[1] + " t needs a separate all-terrain crane worth ₱50M+. The figure is most likely the crane's moment rating in tonne-metres.",
        fix: e.replace(m[0], m[1] + " t·m crane moment (≈10–15 t max lift)"), note: "Confirm with the office whether " + m[1] + " is t·m." };
    },
    function (e) {
      var m = e.match(/(\d+)\s*hp\s*single[- ]cylinder/i) || e.match(/(\d+)\s*-?\s*hp[^)]*single[- ]cylinder/i);
      if (!m || parseFloat(m[1]) <= 20) return null;
      return { kind: "implausible",
        why: "Single-cylinder diesel engines top out at about 10–15 hp. A " + m[1] + " hp pump needs a multi-cylinder engine.",
        fix: e.replace(/single[- ]cylinder/i, "Multi-Cylinder"), note: "Or cap the range at 15 hp if a single-cylinder pump is intended." };
    },
    function (e) {
      if (!/pump/i.test(e) || !/truck|high[- ]capacity|flood/i.test(e)) return null;
      var f = flowLpm(e);
      if (!f || f.value >= 3000) return null;
      return { kind: "implausible",
        why: "Flood-mitigation and “high-capacity” pumps in this sheet move 9–30 cu.m/min. " + f.text + " (" + (f.value / 1000) + " cu.m/min) is a small portable-pump rating and would barely dent a flooded road.",
        fix: e.replace(f.text, "9,000 L/min (9 cu.m/min)"), note: "Keep the original only if a small portable pump is really what is needed." };
    }
  ];

  var KIND_ORDER = { nonexistent: 0, misnamed: 1, implausible: 2 };
  // Rules run one after another on the progressively corrected text, so a row
  // that breaks several rules gets one combined suggestion.
  function realityCheck(e) {
    var cur = e, why = [], notes = [], kind = null;
    REALITY_RULES.forEach(function (rule) {
      var x = rule(cur);
      if (!x) return;
      why.push(x.why);
      if (x.note) notes.push(x.note);
      if (!kind || KIND_ORDER[x.kind] < KIND_ORDER[kind]) kind = x.kind;
      cur = x.fix;
    });
    if (!kind) return null;
    TYPOS.forEach(function (t) { cur = cur.replace(t[0], t[1]); });
    cur = cur.replace(/\s+/g, " ").trim();
    return { kind: kind, why: why.join(" "), fix: cur, note: notes.join(" ") };
  }

  function audit(d) {
    var issues = [];
    var recs = d.records;
    function add(type, o) {
      o.type = type;
      o.severity = ISSUE_TYPES[type][0];
      o.label = ISSUE_TYPES[type][1];
      o.rows = o.rows || [];
      o.recs = o.recs || [];
      o.id = issues.length;
      issues.push(o);
      o.recs.forEach(function (rec) { rec.issues.push(o); });
    }

    // 1. Row arithmetic and missing values
    recs.forEach(function (r) {
      if (!r.qty || !r.unit || !r.total) {
        var miss = [];
        if (!r.qty) miss.push("quantity");
        if (!r.unit) miss.push("unit price");
        if (!r.total) miss.push("total cost");
        add("missing-value", {
          region: r.region, office: r.office, rows: [r.sheetRow], recs: [r],
          title: r.equipment,
          detail: "Blank or zero " + miss.join(", ") + "." + (!r.total ? " This item adds ₱0 to every total." : ""),
          found: "Qty " + (r.rawQty || "—") + " × " + (r.unit ? money(r.unit) : "—") + " = " + (r.total ? money(r.total) : "—"),
          impact: null
        });
      }
      if (r.unit && r.qty && Math.abs(r.qty * r.unit - r.total) > 1) {
        var exp = r.qty * r.unit;
        add("calc", {
          region: r.region, office: r.office, rows: [r.sheetRow], recs: [r],
          title: r.equipment,
          detail: int.format(r.qty) + " × " + money(r.unit) + " should be " + money(exp) + ".",
          expected: money(exp), found: money(r.total),
          impact: r.total - exp
        });
      }
    });

    // 2. Grand total
    var rowsSum = recs.reduce(function (a, r) { return a + r.total; }, 0);
    var declSum = Object.keys(d.declared).reduce(function (a, k) { return a + d.declared[k]; }, 0);
    var qtyFixed = recs.reduce(function (a, r) { return a + (r.qty && r.unit ? r.qty * r.unit : r.total); }, 0);
    if (d.grand && Math.abs(d.grand - rowsSum) > 1) {
      add("grand-total", {
        region: "", office: "", rows: [d.grandRow],
        title: "TOTAL row does not equal the sum of all line items",
        detail: "Sum of every Total Cost cell is " + money(rowsSum) + ". Sum of the region “Total Amount Requested” cells is " + money(declSum) +
          ". If every row used Qty × Unit Price, the total would be " + money(qtyFixed) + ".",
        expected: money(rowsSum), found: money(d.grand),
        impact: d.grand - rowsSum
      });
    }

    // 3. Region totals and where they were typed
    d.regions.forEach(function (name) {
      var inRegion = recs.filter(function (r) { return r.region === name; });
      var calc = inRegion.reduce(function (a, r) { return a + r.total; }, 0);
      var cells = d.declaredCells[name] || [];
      var decl = d.declared[name] || 0;
      if (!cells.length) {
        add("total-placement", {
          region: name, office: "", rows: [d.regionFirstRow[name]],
          title: name + " has no “Total Amount Requested” value",
          detail: "Computed total from its rows is " + money(calc) + "."
        });
      } else if (Math.abs(calc - decl) > 1) {
        add("region-total", {
          region: name, office: "", rows: cells.map(function (c) { return c.row; }),
          title: name + ": “Total Amount Requested” does not match its line items",
          detail: "Its " + inRegion.length + " line items add up to " + money(calc) + (cells.length > 1 ? " (sheet value is the sum of " + cells.length + " separate cells)." : "."),
          expected: money(calc), found: money(decl),
          impact: decl - calc
        });
      }
      if (cells.length > 1) {
        add("total-placement", {
          region: name, office: "", rows: cells.map(function (c) { return c.row; }),
          title: name + ": total is split across " + cells.length + " cells",
          detail: cells.map(function (c) { return money(c.value) + " (row " + c.row + (c.office ? ", " + c.office : "") + ")"; }).join(" + ") +
            ". It is unclear whether these are subtotals or the regional total."
        });
      } else if (cells.length === 1 && cells[0].row !== d.regionFirstRow[name]) {
        add("total-placement", {
          region: name, office: "", rows: [cells[0].row],
          title: name + ": total is typed on a middle row",
          detail: "The value " + money(cells[0].value) + " sits on row " + cells[0].row + (cells[0].office ? " (" + cells[0].office + ")" : "") +
            " instead of the region's first row (" + d.regionFirstRow[name] + "), so it reads like that office's figure."
        });
      }
    });

    // 4. Duplicate rows (same office, item, qty and price)
    var seen = {};
    recs.forEach(function (r) {
      var k = [r.region, r.office, itemKey(r.equipment), r.qty, r.unit].join("|");
      (seen[k] = seen[k] || []).push(r);
    });
    Object.keys(seen).forEach(function (k) {
      var g = seen[k];
      if (g.length < 2) return;
      var extra = g.slice(1).reduce(function (a, r) { return a + r.total; }, 0);
      add("duplicate", {
        region: g[0].region, office: g[0].office, rows: g.map(function (r) { return r.sheetRow; }), recs: g,
        title: g[0].equipment,
        detail: "Appears " + g.length + " times in the same office with the same quantity and price. If unintended, " + money(extra) + " is double-counted.",
        impact: extra
      });
    });

    // 5. Identical item text priced differently
    var byItem = {};
    recs.forEach(function (r) { if (r.unit) (byItem[itemKey(r.equipment)] = byItem[itemKey(r.equipment)] || []).push(r); });
    Object.keys(byItem).forEach(function (k) {
      var g = byItem[k];
      var prices = {};
      g.forEach(function (r) { prices[r.unit] = 1; });
      var list = Object.keys(prices).map(Number).sort(function (a, b) { return a - b; });
      if (list.length < 2) return;
      var lo = list[0], hi = list[list.length - 1];
      if (hi / lo < 1.25) return;
      add("price-conflict", {
        region: g.every(function (r) { return r.region === g[0].region; }) ? g[0].region : "", office: g.every(function (r) { return r.office === g[0].office; }) ? g[0].office : "",
        rows: g.map(function (r) { return r.sheetRow; }), recs: g,
        title: g[0].equipment,
        detail: "Same description, " + list.length + " different unit prices: " + list.map(money).join(", ") + " (" + (hi / lo).toFixed(1) + "× spread)." +
          g.map(function (r) { return " Row " + r.sheetRow + ": " + r.region + " / " + r.office + " @ " + money(r.unit); }).join(";")
      });
    });

    // 6. Unit price far from others of the same equipment type
    var byType = {};
    recs.forEach(function (r) { if (r.unit) (byType[r.type.toLowerCase()] = byType[r.type.toLowerCase()] || []).push(r); });
    Object.keys(byType).forEach(function (k) {
      var g = byType[k];
      if (g.length < 5) return;
      var med = median(g.map(function (r) { return r.unit; }));
      g.forEach(function (r) {
        var ratio = r.unit / med;
        if (ratio > 0.2 && ratio < 5) return;
        add("price-outlier", {
          region: r.region, office: r.office, rows: [r.sheetRow], recs: [r],
          title: r.equipment,
          detail: "Unit price " + money(r.unit) + " is " + (ratio < 1 ? (1 / ratio).toFixed(1) + "× lower" : ratio.toFixed(1) + "× higher") +
            " than the typical " + r.type + " in this sheet (median " + money(med) + " across " + g.length + " rows)."
        });
      });
    });

    // 7. Missing office, incomplete descriptions, typos
    recs.forEach(function (r) {
      if (r.noOffice) {
        add("missing-office", {
          region: r.region, office: r.office, rows: [r.sheetRow], recs: [r],
          title: r.equipment, detail: "Implementing Office is blank, so this cost cannot be attributed to a DEO or regional office."
        });
      }
      var inc = [];
      if (/not indicated|as indicated in (the )?source|as listed/i.test(r.equipment)) inc.push("specification marked as not indicated / copied from source");
      if ((r.equipment.match(/\(/g) || []).length !== (r.equipment.match(/\)/g) || []).length) inc.push("unclosed parenthesis — text looks cut off");
      if (/operating weight: 7 kg/i.test(r.equipment)) inc.push("“7 kg” operating weight is implausible for a backhoe");
      if (/^[^–—-]*$/.test(r.equipment) && r.equipment.split(" ").length <= 2) inc.push("no capacity or specification given");
      if (inc.length) {
        add("incomplete", {
          region: r.region, office: r.office, rows: [r.sheetRow], recs: [r],
          title: r.equipment, detail: inc.join("; ") + "."
        });
      }
      var found = [];
      TYPOS.forEach(function (t) {
        var m = r.equipment.match(t[0]);
        if (m) found.push("“" + m[0] + "” → " + t[1]);
      });
      if (found.length) {
        add("typo", {
          region: r.region, office: r.office, rows: [r.sheetRow], recs: [r],
          title: r.equipment, detail: found.join(", ")
        });
      }
    });

    // 8. Raw-cell formatting: stray whitespace, inconsistent currency style
    var fmtByOffice = {};
    d.rawCells.forEach(function (c) {
      var bad = [];
      [["Region", 0], ["Implementing Office", 1], ["Equipment", 2]].forEach(function (f) {
        var v = c.cells[f[1]] || "";
        if (v && v !== v.replace(/\s+/g, " ").trim()) {
          bad.push(f[0] + " " + (/\n/.test(v) ? "contains a line break" : /^\s|\s$/.test(v) ? "has leading/trailing spaces" : "has double spaces or tabs"));
        }
      });
      if (bad.length) {
        add("whitespace", { region: c.region, office: c.office, rows: [c.row], title: clean(c.cells[2]) || clean(c.cells[1]) || clean(c.cells[0]), detail: bad.join("; ") + "." });
      }
      [4, 5, 6].forEach(function (col) {
        var v = c.cells[col] || "";
        if (v && !MONEY_FMT.test(v)) {
          var k = c.region + "|" + c.office;
          (fmtByOffice[k] = fmtByOffice[k] || { region: c.region, office: c.office, rows: [], sample: v }).rows.push(c.row);
        }
      });
    });
    Object.keys(fmtByOffice).forEach(function (k) {
      var g = fmtByOffice[k];
      var rows = g.rows.filter(function (x, i, a) { return a.indexOf(x) === i; });
      add("format", {
        region: g.region, office: g.office, rows: rows,
        title: (g.office || g.region) + ": peso amounts typed in a different format",
        detail: rows.length + " row(s) use a format like “" + g.sample + "” instead of “₱1,000,000.00” (extra spaces). They may be stored as text rather than numbers, which breaks SUM formulas."
      });
    });
    // 9. Equipment that cannot exist as described
    recs.forEach(function (r) {
      var x = realityCheck(r.equipment);
      if (!x) return;
      add(x.kind, {
        region: r.region, office: r.office, rows: [r.sheetRow], recs: [r],
        title: r.equipment, detail: x.why,
        suggestion: x.fix, suggestionNote: x.note
      });
      r.suggestion = x.fix;
    });

    d.emptyRows.forEach(function (row) {
      add("empty-row", { region: "", office: "", rows: [row], title: "Blank row " + row, detail: "An empty row inside the table can break filters, sorting and range-based formulas." });
    });

    issues.sort(function (a, b) {
      return SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || Math.abs(b.impact || 0) - Math.abs(a.impact || 0) || (a.rows[0] || 0) - (b.rows[0] || 0);
    });
    return { issues: issues, rowsSum: rowsSum, declSum: declSum, qtyFixed: qtyFixed };
  }

  // ---------- Loading ----------
  function fetchText(url, ms) {
    var ctl = "AbortController" in window ? new AbortController() : null;
    var t = ctl && setTimeout(function () { ctl.abort(); }, ms);
    return fetch(url, { cache: "no-store", signal: ctl ? ctl.signal : undefined }).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    });
  }

  function load() {
    var btn = $("refreshBtn");
    btn.classList.add("spin");
    btn.disabled = true;
    setStatus("", "Loading data…");
    return fetchText(LIVE_URL, 9000)
      .then(function (t) { return ingest(t, "live"); })
      .catch(function () {
        return fetchText(SNAPSHOT_URL, 9000).then(function (t) { return ingest(t, "snapshot"); });
      })
      .catch(function (err) {
        setStatus("", "Could not load data (" + err.message + ")");
      })
      .then(function () {
        btn.classList.remove("spin");
        btn.disabled = false;
      });
  }

  function ingest(text, source) {
    var data = normalize(parseCSV(text));
    if (!data.records.length) throw new Error("no rows");
    state.all = data.records;
    state.regions = data.regions;
    state.declared = data.declared;
    state.declaredGrand = data.grand;
    state.audit = audit(data);
    state.source = source;
    state.loadedAt = new Date();
    var when = state.loadedAt.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
    setStatus(source, source === "live" ? "Live from Google Sheets · " + when : "Offline snapshot · live sheet unreachable");
    buildSelects();
    render();
  }

  function setStatus(cls, text) {
    $("status").className = "status " + cls;
    $("statusText").textContent = text;
  }

  // ---------- Filters ----------
  function match(r, skip) {
    if (skip !== "region" && state.region && r.region !== state.region) return false;
    if (skip !== "office" && state.office && r.office !== state.office) return false;
    if (skip !== "cat" && state.cat && r.category !== state.cat) return false;
    if (state.issuesOnly && !r.issues.length) return false;
    if (state.q) {
      var terms = state.q.toLowerCase().split(/\s+/);
      for (var i = 0; i < terms.length; i++) if (terms[i] && r.hay.indexOf(terms[i]) < 0) return false;
    }
    return true;
  }
  function filtered(skip) { return state.all.filter(function (r) { return match(r, skip); }); }

  function setOptions(sel, items, allLabel, value) {
    sel.innerHTML = '<option value="">' + esc(allLabel) + "</option>" + items.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === value ? " selected" : "") + ">" + esc(v) + "</option>";
    }).join("");
  }

  function buildSelects() {
    setOptions($("fRegion"), state.regions, "All regions", state.region);
    var offices = [];
    state.all.forEach(function (r) {
      if ((!state.region || r.region === state.region) && offices.indexOf(r.office) < 0) offices.push(r.office);
    });
    if (state.office && offices.indexOf(state.office) < 0) state.office = "";
    setOptions($("fOffice"), offices, state.region ? "All offices in " + state.region : "All implementing offices", state.office);
    setOptions($("fCat"), CATEGORIES.map(function (c) { return c[0]; }), "All equipment categories", state.cat);
  }

  function setFilter(key, val) {
    if (key === "issuesOnly") { state.issuesOnly = false; $("issuesOnly").checked = false; render(); return; }
    state[key] = state[key] === val ? "" : val;
    if (key === "region") state.office = "";
    if (key === "q") $("q").value = state.q;
    buildSelects();
    render();
  }

  // ---------- Aggregation ----------
  function groupSum(rows, key) {
    var m = {}, order = [];
    rows.forEach(function (r) {
      var k = r[key];
      if (!m[k]) { m[k] = { key: k, total: 0, qty: 0, items: 0, offices: {} }; order.push(k); }
      m[k].total += r.total;
      m[k].qty += r.qty;
      m[k].items += 1;
      m[k].offices[r.office] = 1;
    });
    return order.map(function (k) { return m[k]; });
  }
  function sum(rows, f) { return rows.reduce(function (a, r) { return a + r[f]; }, 0); }

  // ---------- Render ----------
  function render() {
    var rows = filtered();
    renderKpis(rows);
    renderChips();
    renderBars(rows);
    renderRegionCards();
    renderTable(rows);
    renderChecks();
    renderAlert();
    syncUrl();
  }

  function renderKpis(rows) {
    var total = sum(rows, "total");
    var allTotal = sum(state.all, "total");
    var offices = {}, regions = {};
    rows.forEach(function (r) { offices[r.region + "|" + r.office] = 1; regions[r.region] = 1; });
    var isFiltered = rows.length !== state.all.length;
    var k = [
      ["main", "Total amount requested", money(total), isFiltered ? pct(total, allTotal) + " of " + compact(allTotal) + " overall" : (state.declaredGrand && Math.abs(state.declaredGrand - total) > 1 ? "sum of all rows · sheet's TOTAL row says " + compact(state.declaredGrand) + " ⚠" : "across all regions")],
      ["", "Equipment units", int.format(sum(rows, "qty")), "pieces requested"],
      ["", "Line items", int.format(rows.length), "distinct requests"],
      ["", "Implementing offices", int.format(Object.keys(offices).length), "DEOs & regional offices"],
      ["", "Regions", int.format(Object.keys(regions).length), "of " + state.regions.length + " in the sheet"]
    ];
    $("kpis").innerHTML = k.map(function (x) {
      return '<div class="kpi ' + x[0] + '"><div class="kpi-label">' + x[1] + '</div><div class="kpi-value">' + x[2] + '</div><div class="kpi-sub">' + x[3] + "</div></div>";
    }).join("");
  }

  function renderChips() {
    var c = [];
    if (state.q) c.push(["q", "Search", state.q]);
    if (state.region) c.push(["region", "Region", state.region]);
    if (state.office) c.push(["office", "Office", state.office]);
    if (state.cat) c.push(["cat", "Category", state.cat]);
    if (state.issuesOnly) c.push(["issuesOnly", "Rows", "with issues only"]);
    $("chips").innerHTML = c.map(function (x) {
      return '<span class="chip">' + x[1] + ': <b>' + esc(x[2]) + '</b><button type="button" data-clear="' + x[0] + '" aria-label="Remove ' + x[1] + ' filter"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span>';
    }).join("");
    $("clearBtn").hidden = !c.length;
  }

  function bars(el, items, opts) {
    var max = Math.max.apply(null, items.map(function (i) { return i.v; }).concat([1]));
    el.innerHTML = items.length ? items.map(function (i) {
      return '<button type="button" class="bar-row' + (i.on ? " is-on" : "") + '" data-k="' + opts.key + '" data-v="' + esc(i.k) + '" title="' + esc(i.k) + '">' +
        '<span class="bar-label">' + esc(i.label || i.k) + "</span>" +
        '<span class="bar-track"><span class="bar-fill" style="width:' + (i.v / max * 100).toFixed(1) + '%"></span></span>' +
        '<span class="bar-val">' + i.text + (i.sub ? "<small>" + i.sub + "</small>" : "") + "</span></button>";
    }).join("") : '<p class="muted">No data for these filters.</p>';
  }

  function renderBars(rows) {
    var byRegion = groupSum(filtered("region"), "region");
    var regTotal = sum(byRegion, "total");
    bars($("regionBars"), byRegion.sort(function (a, b) { return b.total - a.total; }).map(function (g) {
      return { k: g.key, v: g.total, text: compact(g.total), sub: pct(g.total, regTotal), on: g.key === state.region };
    }), { key: "region" });
    $("regionChartNote").textContent = byRegion.length + " regions";

    var byCat = groupSum(filtered("cat"), "category");
    var catTotal = sum(byCat, "total");
    bars($("catBars"), byCat.sort(function (a, b) { return b.total - a.total; }).map(function (g) {
      return { k: g.key, v: g.total, text: compact(g.total), sub: pct(g.total, catTotal) + " · " + int.format(g.qty) + " units", on: g.key === state.cat };
    }), { key: "cat" });

    var byOffice = groupSum(filtered("office"), "office");
    bars($("officeBars"), byOffice.sort(function (a, b) { return b.total - a.total; }).slice(0, 10).map(function (g) {
      return { k: g.key, v: g.total, text: compact(g.total), sub: int.format(g.qty) + " units", on: g.key === state.office };
    }), { key: "office" });

    var byType = groupSum(rows, "type");
    bars($("equipBars"), byType.sort(function (a, b) { return b.qty - a.qty || b.total - a.total; }).slice(0, 10).map(function (g) {
      return { k: g.key, v: g.qty, text: int.format(g.qty) + " units", sub: compact(g.total), on: state.q.toLowerCase() === g.key.toLowerCase() };
    }), { key: "q" });
  }

  function renderRegionCards() {
    var src = filtered("region");
    var groups = {};
    groupSum(src, "region").forEach(function (g) { groups[g.key] = g; });
    var total = sum(src, "total");
    $("regionGrid").innerHTML = state.regions.map(function (name) {
      var g = groups[name];
      if (!g) return "";
      var share = total ? g.total / total * 100 : 0;
      var nIss = state.audit.issues.filter(function (i) { return i.region === name && i.severity !== "minor"; }).length;
      return '<button type="button" class="region-card" data-region="' + esc(name) + '" style="--share:' + share.toFixed(1) + '%">' +
        '<span class="share">' + pct(g.total, total) + "</span>" +
        "<h3>" + esc(name) + "</h3>" +
        '<div class="amt">' + compact(g.total) + "</div>" +
        '<div class="meta"><span>' + Object.keys(g.offices).length + " offices</span><span>" + int.format(g.qty) + " units</span><span>" + g.items + " items</span>" + (nIss ? '<span class="iss-count">⚠ ' + nIss + " issue" + (nIss > 1 ? "s" : "") + "</span>" : "") + "</div></button>";
    }).join("") || '<p class="muted">No regions match these filters.</p>';
  }

  function sorted(rows) {
    var s = state.sort;
    if (!s.key) return rows.slice();
    return rows.slice().sort(function (a, b) {
      var x = a[s.key], y = b[s.key];
      if (typeof x === "number") return (x - y) * s.dir;
      return String(x).localeCompare(String(y)) * s.dir;
    });
  }

  function worstSev(list) {
    return list.reduce(function (w, i) { return SEV_ORDER[i.severity] < SEV_ORDER[w] ? i.severity : w; }, "minor");
  }
  function rowHtml(r) {
    var sev = r.issues.length ? worstSev(r.issues) : "";
    var flag = r.issues.length ? '<button type="button" class="flag sev-' + sev + '" data-issue-row="' + r.sheetRow + '" title="' + esc(r.issues.map(function (i) { return i.label + ": " + i.detail; }).join("\n")) + '">' +
      (r.issues.length > 1 ? r.issues.length + " issues" : esc(r.issues[0].label)) + "</button>" : "";
    return '<tr' + (sev ? ' class="has-issue sev-' + sev + '"' : "") + ">" +
      '<td class="c-region">' + esc(r.region) + "</td>" +
      '<td class="c-office">' + esc(r.office) + "</td>" +
      '<td class="eq"><strong>' + esc(r.name) + flag + "</strong>" + (r.spec ? "<span>" + esc(r.spec) + "</span>" : "") +
      (r.suggestion ? '<em class="sugg">Suggested: ' + esc(r.suggestion) + "</em>" : "") + "</td>" +
      '<td class="c-cat"><span class="tag">' + esc(r.category) + "</span></td>" +
      '<td class="num c-qty">' + int.format(r.qty) + "</td>" +
      '<td class="num c-unit">' + (r.unit ? money(r.unit) : "—") + "</td>" +
      '<td class="num c-total">' + money(r.total) + '<a class="row-link" href="' + sheetLink(r.sheetRow) + '" target="_blank" rel="noopener" title="Open row ' + r.sheetRow + ' in Google Sheets">row ' + r.sheetRow + "</a></td></tr>";
  }

  function renderTable(rows) {
    var table = $("table");
    table.classList.toggle("grouped", state.view === "grouped");
    var html = "";
    if (state.view === "grouped") {
      groupSum(rows, "region").forEach(function (rg) {
        var inRegion = rows.filter(function (r) { return r.region === rg.key; });
        html += '<tr class="region-row"><td colspan="6">' + esc(rg.key) + ' <span class="g-sub" style="color:#b9cde4">' + Object.keys(rg.offices).length + " offices · " + int.format(rg.qty) + ' units</span></td><td class="num">' + money(rg.total) + "</td></tr>";
        groupSum(inRegion, "office").forEach(function (of) {
          html += '<tr class="group"><td colspan="6">' + esc(of.key) + '<span class="g-sub">' + of.items + " items · " + int.format(of.qty) + ' units</span></td><td class="num">' + money(of.total) + "</td></tr>";
          html += sorted(inRegion.filter(function (r) { return r.office === of.key; })).map(rowHtml).join("");
        });
      });
    } else {
      html = sorted(rows).map(rowHtml).join("");
    }
    $("tbody").innerHTML = html;
    $("tfoot").innerHTML = rows.length ? '<tr><td colspan="4">Total · ' + rows.length + ' line items</td><td class="num">' + int.format(sum(rows, "qty")) + '</td><td></td><td class="num">' + money(sum(rows, "total")) + "</td></tr>" : "";
    $("empty").hidden = rows.length > 0;
    $("recordsNote").textContent = rows.length === state.all.length
      ? "All " + rows.length + " line items. Click a column header to sort."
      : "Showing " + rows.length + " of " + state.all.length + " line items.";
    var ths = table.querySelectorAll("th[data-sort]");
    for (var i = 0; i < ths.length; i++) {
      var on = ths[i].getAttribute("data-sort") === state.sort.key;
      ths[i].classList.toggle("sorted", on);
      ths[i].classList.toggle("desc", on && state.sort.dir < 0);
      ths[i].setAttribute("aria-sort", on ? (state.sort.dir > 0 ? "ascending" : "descending") : "none");
    }
  }

  function issueMatches(i, skip) {
    if (skip !== "sev" && state.sev && i.severity !== state.sev) return false;
    if (skip !== "itype" && state.itype && i.type !== state.itype) return false;
    if (state.issueScope) {
      if (state.region && i.region && i.region !== state.region) return false;
      if (state.office && i.office && i.office !== state.office) return false;
    }
    return true;
  }
  function signed(n) { return (n > 0 ? "+" : n < 0 ? "−" : "") + money(Math.abs(n)); }

  function issueHtml(i) {
    var loc = [i.region, i.office && i.office !== UNSPECIFIED ? i.office : ""].filter(Boolean).join(" · ");
    var rows = i.rows.length ? (i.rows.length === 1 ? "Row " + i.rows[0] : "Rows " + i.rows.join(", ")) : "";
    var cmp = "";
    if (i.expected || i.found || i.impact) {
      cmp = '<div class="cmp">' +
        (i.expected ? '<span><small>Should be</small><b>' + esc(i.expected) + "</b></span>" : "") +
        (i.found ? '<span><small>Sheet shows</small><b>' + esc(i.found) + "</b></span>" : "") +
        (i.impact ? '<span><small>' + (i.type === "duplicate" ? "Possible double count" : "Difference") + '</small><b class="diff">' + signed(i.impact) + "</b></span>" : "") +
        "</div>";
    }
    return '<article class="issue sev-' + i.severity + '">' +
      '<div class="issue-top"><span class="sev">' + SEVERITY[i.severity] + '</span><span class="itype">' + esc(i.label) + "</span>" +
      (loc ? '<span class="loc">' + esc(loc) + "</span>" : "") + "</div>" +
      "<h4>" + esc(i.title) + "</h4><p>" + esc(i.detail) + "</p>" + cmp +
      (i.suggestion ? '<div class="fix"><small>Suggested correction</small><b>' + esc(i.suggestion) + "</b>" + (i.suggestionNote ? "<span>" + esc(i.suggestionNote) + "</span>" : "") + "</div>" : "") +
      (i.rows.length ? '<a class="open-row" target="_blank" rel="noopener" href="' + sheetLink(Math.min.apply(null, i.rows), Math.max.apply(null, i.rows)) + '">' + rows + ' · open in Google Sheets ↗</a>' : "") +
      "</article>";
  }

  function renderChecks() {
    var all = state.audit.issues;
    var base = all.filter(function (i) { return issueMatches(i, "sev"); });
    var counts = { critical: 0, warning: 0, minor: 0 };
    base.forEach(function (i) { counts[i.severity]++; });
    var calcImpact = all.filter(function (i) { return i.type === "calc"; }).reduce(function (a, i) { return a + i.impact; }, 0);
    var g = all.filter(function (i) { return i.type === "grand-total"; })[0];
    var affected = {};
    all.forEach(function (i) { i.recs.forEach(function (r) { affected[r.id] = 1; }); });
    var sevCard = function (k, desc) {
      return '<button type="button" class="isum sev-' + k + (state.sev === k ? " is-on" : "") + '" data-sev="' + k + '"><span class="isum-n">' + counts[k] + '</span><span class="isum-l">' + SEVERITY[k] + "</span><span class=\"isum-d\">" + desc + "</span></button>";
    };
    $("issueSummary").innerHTML =
      sevCard("critical", "wrong math, missing values, totals that don't add up, equipment that can't exist") +
      sevCard("warning", "duplicates, conflicting prices, unclear entries") +
      sevCard("minor", "typos, spacing and formatting") +
      '<div class="isum impact"><span class="isum-n">' + (g ? signed(g.impact) : "₱0") + '</span><span class="isum-l">TOTAL row error</span><span class="isum-d">' +
      (g ? "Sheet says " + g.found + "; rows add up to " + g.expected : "TOTAL row matches the rows") + "</span></div>" +
      '<div class="isum impact"><span class="isum-n">' + signed(calcImpact) + '</span><span class="isum-l">Net row calculation error</span><span class="isum-d">' +
      Object.keys(affected).length + " of " + state.all.length + " line items have at least one issue</span></div>";

    var types = Object.keys(ISSUE_TYPES).filter(function (t) { return all.some(function (i) { return i.type === t; }); });
    $("fIssueType").innerHTML = '<option value="">All issue types (' + all.filter(function (i) { return issueMatches(i, "itype"); }).length + ")</option>" + types.map(function (t) {
      var n = all.filter(function (i) { return i.type === t && issueMatches(i, "itype"); }).length;
      return '<option value="' + t + '"' + (t === state.itype ? " selected" : "") + ">" + esc(ISSUE_TYPES[t][1]) + " (" + n + ")</option>";
    }).join("");
    $("issueScopeWrap").hidden = !(state.region || state.office);

    var real = all.filter(function (i) { return REALITY_TYPES.indexOf(i.type) >= 0 && issueMatches(i, "sev") && issueMatches(i, "itype"); });
    $("realityCount").textContent = real.length + (real.length === 1 ? " entry" : " entries");
    $("realityBody").innerHTML = real.length ? real.map(function (i) {
      return '<tr class="sev-' + i.severity + '"><td class="r-row"><a href="' + sheetLink(i.rows[0]) + '" target="_blank" rel="noopener">Row ' + i.rows[0] + "</a><span>" + esc(i.region) + "<em>" + esc(i.office) + "</em></span></td>" +
        '<td class="r-asis"><span class="r-kind">' + esc(i.label) + "</span><s>" + esc(i.title) + "</s></td>" +
        '<td class="r-why">' + esc(i.detail) + "</td>" +
        '<td class="r-fix"><b>' + esc(i.suggestion) + "</b>" + (i.suggestionNote ? "<span>" + esc(i.suggestionNote) + "</span>" : "") + "</td></tr>";
    }).join("") : '<tr><td colspan="4" class="empty">No unrealistic equipment found' + (state.region ? " in " + esc(state.region) : "") + ".</td></tr>";

    var list = all.filter(function (i) { return issueMatches(i); });
    $("issues").innerHTML = list.length
      ? list.slice(0, state.issueLimit).map(issueHtml).join("")
      : '<p class="empty">No issues of this kind' + (state.region ? " in " + esc(state.region) : "") + ".</p>";
    $("moreIssues").hidden = list.length <= state.issueLimit;
    $("moreIssues").textContent = "Show all " + list.length + " issues";
    $("issueNav").textContent = all.filter(function (i) { return i.severity === "critical"; }).length || "";

    var byRegion = {};
    groupSum(state.all, "region").forEach(function (x) { byRegion[x.key] = x.total; });
    var html = '<div class="recon-row head"><span>Region</span><span class="num">Rows add up to</span><span class="num">Sheet says</span><span class="num">Difference</span></div>';
    html += state.regions.map(function (name) {
      var calc = byRegion[name] || 0, decl = state.declared[name] || 0;
      var diff = decl - calc;
      var badge = !decl ? '<span class="muted small">not entered</span>'
        : Math.abs(diff) < 1 ? '<span class="ok">✓</span>'
        : '<span class="diff">' + signed(diff) + "</span>";
      return '<div class="recon-row' + (decl && Math.abs(diff) >= 1 ? " bad" : "") + '"><span>' + esc(name) + '</span><span class="num">' + money(calc) + '</span><span class="num">' + (decl ? money(decl) : "—") + '</span><span class="num">' + badge + "</span></div>";
    }).join("");
    var a = state.audit;
    if (state.declaredGrand) {
      var gd = state.declaredGrand - a.rowsSum;
      html += '<div class="recon-row total' + (Math.abs(gd) >= 1 ? " bad" : "") + '"><strong>TOTAL row</strong><span class="num"><strong>' + money(a.rowsSum) + '</strong></span><span class="num"><strong>' + money(state.declaredGrand) + '</strong></span><span class="num">' +
        (Math.abs(gd) < 1 ? '<span class="ok">✓</span>' : '<span class="diff">' + signed(gd) + "</span>") + "</span></div>";
    }
    $("recon").innerHTML = html;
    $("reconNote").innerHTML = "Sum of all region “Total Amount Requested” cells: <b>" + money(a.declSum) + "</b>. If every row used Qty × Unit Price, the grand total would be <b>" + money(a.qtyFixed) + "</b>.";
  }

  function renderAlert() {
    var iss = state.audit.issues;
    var crit = iss.filter(function (i) { return i.severity === "critical"; }).length;
    var g = iss.filter(function (i) { return i.type === "grand-total"; })[0];
    $("alert").hidden = !iss.length;
    $("alert").innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2zM12 10v5M12 18v.5"/></svg><span><b>' + iss.length + " issues found in the source sheet</b> — " + crit + " critical" +
      (g ? ", including a TOTAL row that is off by " + compact(Math.abs(g.impact)) : "") +
      (function () { var n = iss.filter(function (i) { return REALITY_TYPES.indexOf(i.type) >= 0; }).length; return n ? ", and " + n + " equipment entries that can't exist as written" : ""; })() + '.</span><span class="alert-cta">Review issues →</span>';
  }

  function exportIssues() {
    var head = ["Severity", "Issue", "Region", "Implementing Office", "Sheet rows", "Item", "Details", "Should be", "Sheet shows", "Difference", "Suggested correction"];
    var list = state.audit.issues.filter(function (i) { return issueMatches(i); });
    download("okb-source-issues.csv", [head].concat(list.map(function (i) {
      return [SEVERITY[i.severity], i.label, i.region, i.office, i.rows.join(" "), i.title, i.detail, i.expected || "", i.found || "", i.impact || "", i.suggestion ? i.suggestion + (i.suggestionNote ? " (" + i.suggestionNote + ")" : "") : ""];
    })));
  }

  // ---------- Region drawer ----------
  var lastFocus = null;
  function openRegion(name) {
    var rows = state.all.filter(function (r) { return r.region === name && match(r, "region"); });
    if (!rows.length) rows = state.all.filter(function (r) { return r.region === name; });
    var offices = groupSum(rows, "office").sort(function (a, b) { return b.total - a.total; });
    $("drawerEyebrow").textContent = "Region";
    $("drawerTitle").textContent = name;
    $("drawerBody").innerHTML =
      '<div class="mini-kpis"><div><span>Amount</span><strong>' + compact(sum(rows, "total")) + "</strong></div>" +
      "<div><span>Units</span><strong>" + int.format(sum(rows, "qty")) + "</strong></div>" +
      "<div><span>Offices</span><strong>" + offices.length + "</strong></div></div>" +
      '<div class="drawer-actions"><button class="btn" type="button" data-apply-region="' + esc(name) + '">Filter page to ' + esc(name) + "</button></div>" +
      (function () {
        var ri = state.audit.issues.filter(function (i) { return i.region === name && i.severity !== "minor"; });
        return ri.length ? '<details class="office drawer-issues"><summary><span class="s-left">⚠ Source issues<small>' + ri.length + " critical / warning</small></span></summary><div class=\"issue-mini\">" + ri.map(issueHtml).join("") + "</div></details>" : "";
      })() +
      offices.map(function (of, i) {
        var items = rows.filter(function (r) { return r.office === of.key; }).sort(function (a, b) { return b.total - a.total; });
        return '<details class="office"' + (i < 2 ? " open" : "") + '><summary><span class="s-left">' + esc(of.key) + "<small>" + of.items + " items</small></span><span>" + compact(of.total) + "</span></summary><ul>" +
          items.map(function (r) {
            return "<li><span>" + esc(r.equipment) + '<br><span class="q">' + int.format(r.qty) + " × " + (r.unit ? money(r.unit) : "—") + "</span></span><strong class=\"num\">" + money(r.total) + "</strong></li>";
          }).join("") + "</ul></details>";
      }).join("");
    lastFocus = document.activeElement;
    $("drawerBackdrop").hidden = false;
    $("drawer").classList.add("open");
    $("drawer").setAttribute("aria-hidden", "false");
    $("drawerClose").focus();
  }
  function closeDrawer() {
    $("drawer").classList.remove("open");
    $("drawer").setAttribute("aria-hidden", "true");
    $("drawerBackdrop").hidden = true;
    if (lastFocus) lastFocus.focus();
  }

  // ---------- Export ----------
  function download(name, rows) {
    var lines = rows.map(function (a) {
      return a.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
    });
    var blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 0);
  }

  function exportCsv() {
    var rows = sorted(filtered());
    var head = ["Region", "Implementing Office", "Equipment", "Category", "Qty", "Unit Price", "Total Cost", "Sheet Row", "Issues", "Suggested correction"];
    download("okb-equipment" + (state.region ? "-" + state.region.replace(/\W+/g, "-") : "") + ".csv", [head].concat(rows.map(function (r) {
      return [r.region, r.office, r.equipment, r.category, r.qty, r.unit, r.total, r.sheetRow, r.issues.map(function (i) { return i.label; }).join("; "), r.suggestion || ""];
    })));
  }

  // ---------- URL state ----------
  function syncUrl() {
    var p = new URLSearchParams();
    ["q", "region", "office", "cat"].forEach(function (k) { if (state[k]) p.set(k, state[k]); });
    if (state.view !== "grouped") p.set("view", state.view);
    if (state.issuesOnly) p.set("issues", "1");
    if (state.sev) p.set("sev", state.sev);
    if (state.itype) p.set("itype", state.itype);
    var qs = p.toString();
    try { history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash); } catch (e) { /* ignore */ }
  }
  function readUrl() {
    var p = new URLSearchParams(location.search);
    ["q", "region", "office", "cat"].forEach(function (k) { state[k] = p.get(k) || ""; });
    if (p.get("view") === "flat") state.view = "flat";
    state.issuesOnly = p.get("issues") === "1";
    $("issuesOnly").checked = state.issuesOnly;
    state.sev = p.get("sev") || "";
    state.itype = p.get("itype") || "";
    $("q").value = state.q;
    setView(state.view);
  }
  function setView(v) {
    state.view = v;
    var b = document.querySelectorAll(".seg-btn");
    for (var i = 0; i < b.length; i++) b[i].classList.toggle("is-on", b[i].getAttribute("data-view") === v);
  }

  // ---------- Theme ----------
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("okb-theme"); } catch (e) { /* ignore */ }
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    $("themeBtn").addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme") ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("okb-theme", next); } catch (e) { /* ignore */ }
    });
  }

  // ---------- Events ----------
  function bind() {
    var t;
    $("q").addEventListener("input", function (e) {
      clearTimeout(t);
      t = setTimeout(function () { state.q = e.target.value.trim(); render(); }, 150);
    });
    $("fRegion").addEventListener("change", function (e) { state.region = e.target.value; state.office = ""; buildSelects(); render(); });
    $("fOffice").addEventListener("change", function (e) { state.office = e.target.value; render(); });
    $("fCat").addEventListener("change", function (e) { state.cat = e.target.value; render(); });
    $("clearBtn").addEventListener("click", function () {
      state.q = state.region = state.office = state.cat = "";
      state.issuesOnly = false;
      $("issuesOnly").checked = false;
      $("q").value = "";
      buildSelects();
      render();
    });
    $("refreshBtn").addEventListener("click", load);
    $("exportBtn").addEventListener("click", exportCsv);
    $("exportIssuesBtn").addEventListener("click", exportIssues);
    $("issuesOnly").addEventListener("change", function (e) { state.issuesOnly = e.target.checked; render(); });
    $("fIssueType").addEventListener("change", function (e) { state.itype = e.target.value; state.issueLimit = 25; render(); });
    $("issueScope").addEventListener("change", function (e) { state.issueScope = e.target.checked; render(); });
    $("moreIssues").addEventListener("click", function () { state.issueLimit = 1e9; render(); });
    $("alert").addEventListener("click", function () { document.getElementById("checks").scrollIntoView(); });
    $("printBtn").addEventListener("click", function () { window.print(); });
    $("drawerClose").addEventListener("click", closeDrawer);
    $("drawerBackdrop").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("drawer").classList.contains("open")) closeDrawer(); });

    document.addEventListener("click", function (e) {
      var el = e.target.closest("[data-k],[data-clear],[data-region],[data-apply-region],[data-view],[data-sev],[data-issue-row],th[data-sort]");
      if (!el) return;
      if (el.hasAttribute("data-sev")) { state.sev = state.sev === el.getAttribute("data-sev") ? "" : el.getAttribute("data-sev"); state.issueLimit = 25; render(); }
      else if (el.hasAttribute("data-issue-row")) {
        var row = +el.getAttribute("data-issue-row");
        state.sev = ""; state.itype = ""; state.issueLimit = 1e9;
        render();
        var hit = state.audit.issues.filter(function (i) { return i.rows.indexOf(row) >= 0; })[0];
        var cards = document.querySelectorAll("#issues .issue");
        var idx = state.audit.issues.filter(function (i) { return issueMatches(i); }).indexOf(hit);
        if (cards[idx]) { cards[idx].scrollIntoView({ block: "center" }); cards[idx].classList.add("pulse"); setTimeout(function () { cards[idx].classList.remove("pulse"); }, 1600); }
      }
      else if (el.hasAttribute("data-k")) setFilter(el.getAttribute("data-k"), el.getAttribute("data-v"));
      else if (el.hasAttribute("data-clear")) setFilter(el.getAttribute("data-clear"), state[el.getAttribute("data-clear")]);
      else if (el.hasAttribute("data-region")) openRegion(el.getAttribute("data-region"));
      else if (el.hasAttribute("data-apply-region")) {
        closeDrawer();
        state.region = el.getAttribute("data-apply-region");
        state.office = "";
        buildSelects();
        render();
        document.getElementById("records").scrollIntoView();
      } else if (el.hasAttribute("data-view")) { setView(el.getAttribute("data-view")); render(); }
      else {
        var k = el.getAttribute("data-sort");
        if (state.sort.key === k) {
          if (state.sort.dir > 0) state.sort.dir = -1; else state.sort = { key: "", dir: 1 };
        } else state.sort = { key: k, dir: typeof (state.all[0] || {})[k] === "number" ? -1 : 1 };
        render();
      }
    });
  }

  initTheme();
  bind();
  readUrl();
  load();

  // Exposed for tests.
  window.OKB = { parseCSV: parseCSV, normalize: normalize, audit: audit, realityCheck: realityCheck, categorize: categorize, state: state };
})();
