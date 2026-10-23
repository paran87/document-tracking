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
    sort: { key: "", dir: 1 }
  };

  var $ = function (id) { return document.getElementById(id); };

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
    var out = [], regions = [], declared = {}, grand = 0;
    var region = "", office = "";
    for (var r = start; r < rows.length; r++) {
      var row = rows[r];
      var rg = clean(row[0]), of = clean(row[1]), eq = clean(row[2]);
      var decl = num(row[6]);
      if (rg) { region = rg; office = ""; if (regions.indexOf(rg) < 0) regions.push(rg); }
      if (of) office = of;
      if (!eq) {
        if (decl && !rg && !of) grand = decl;
        continue;
      }
      if (!region) continue;
      if (decl) declared[region] = (declared[region] || 0) + decl;
      var parts = splitName(eq);
      var qty = num(row[3]), unit = num(row[4]), total = num(row[5]);
      var rec = {
        id: out.length,
        sheetRow: r + 1,
        region: region,
        office: office || UNSPECIFIED,
        equipment: eq,
        name: parts[0],
        spec: parts[1],
        type: typeKey(parts[0]),
        category: categorize(eq),
        qty: qty,
        unit: unit,
        total: total,
        issues: []
      };
      if (!unit) rec.issues.push("Unit price is blank");
      if (!total) rec.issues.push("Total cost is zero");
      if (unit && qty && Math.abs(qty * unit - total) > 1) {
        rec.issues.push("Qty × unit price = " + money(qty * unit) + ", but total cost shows " + money(total));
      }
      rec.hay = (region + " " + rec.office + " " + eq + " " + rec.category).toLowerCase();
      out.push(rec);
    }
    return { records: out, regions: regions, declared: declared, grand: grand };
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
    renderChecks(rows);
    syncUrl();
  }

  function renderKpis(rows) {
    var total = sum(rows, "total");
    var allTotal = sum(state.all, "total");
    var offices = {}, regions = {};
    rows.forEach(function (r) { offices[r.region + "|" + r.office] = 1; regions[r.region] = 1; });
    var isFiltered = rows.length !== state.all.length;
    var k = [
      ["main", "Total amount requested", money(total), isFiltered ? pct(total, allTotal) + " of " + compact(allTotal) + " overall" : "across all regions"],
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
      return '<button type="button" class="region-card" data-region="' + esc(name) + '" style="--share:' + share.toFixed(1) + '%">' +
        '<span class="share">' + pct(g.total, total) + "</span>" +
        "<h3>" + esc(name) + "</h3>" +
        '<div class="amt">' + compact(g.total) + "</div>" +
        '<div class="meta"><span>' + Object.keys(g.offices).length + " offices</span><span>" + int.format(g.qty) + " units</span><span>" + g.items + " items</span></div></button>";
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

  function rowHtml(r) {
    var flag = r.issues.length ? '<span class="flag" title="' + esc(r.issues.join("; ")) + '">check</span>' : "";
    return "<tr>" +
      '<td class="c-region">' + esc(r.region) + "</td>" +
      '<td class="c-office">' + esc(r.office) + "</td>" +
      '<td class="eq"><strong>' + esc(r.name) + flag + "</strong>" + (r.spec ? "<span>" + esc(r.spec) + "</span>" : "") + "</td>" +
      '<td class="c-cat"><span class="tag">' + esc(r.category) + "</span></td>" +
      '<td class="num c-qty">' + int.format(r.qty) + "</td>" +
      '<td class="num c-unit">' + (r.unit ? money(r.unit) : "—") + "</td>" +
      '<td class="num c-total">' + money(r.total) + "</td></tr>";
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

  function renderChecks(rows) {
    var flagged = rows.filter(function (r) { return r.issues.length; });
    $("issueCount").textContent = flagged.length + (flagged.length === 1 ? " item" : " items");
    $("issues").innerHTML = flagged.length ? flagged.map(function (r) {
      return "<li><b>" + esc(r.equipment) + '</b><span class="where">' + esc(r.region) + " · " + esc(r.office) + " · sheet row " + r.sheetRow + "</span>" +
        r.issues.map(function (i) { return '<div class="what">' + esc(i) + "</div>"; }).join("") + "</li>";
    }).join("") : '<li style="border-left-color:var(--ok-ink)">No arithmetic issues in the current selection.</li>';

    var byRegion = {};
    groupSum(state.all, "region").forEach(function (g) { byRegion[g.key] = g.total; });
    var html = state.regions.map(function (name) {
      var calc = byRegion[name] || 0, decl = state.declared[name] || 0;
      var diff = calc - decl;
      var badge = !decl ? '<span class="muted small">no total entered</span>'
        : Math.abs(diff) < 1 ? '<span class="ok">✓ matches</span>'
        : '<span class="diff">' + (diff > 0 ? "+" : "−") + compact(Math.abs(diff)) + "</span>";
      return '<div class="recon-row"><span>' + esc(name) + '</span><span class="num">' + money(calc) + (decl ? "<small>sheet: " + money(decl) + "</small>" : "") + "</span>" + badge + "</div>";
    }).join("");
    var all = sum(state.all, "total");
    if (state.declaredGrand) {
      var gd = all - state.declaredGrand;
      html += '<div class="recon-row"><strong>Grand total</strong><span class="num"><strong>' + money(all) + "</strong><small>sheet: " + money(state.declaredGrand) + "</small></span>" +
        (Math.abs(gd) < 1 ? '<span class="ok">✓ matches</span>' : '<span class="diff">' + (gd > 0 ? "+" : "−") + compact(Math.abs(gd)) + "</span>") + "</div>";
    }
    $("recon").innerHTML = html;
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
  function exportCsv() {
    var rows = sorted(filtered());
    var head = ["Region", "Implementing Office", "Equipment", "Category", "Qty", "Unit Price", "Total Cost"];
    var lines = [head].concat(rows.map(function (r) {
      return [r.region, r.office, r.equipment, r.category, r.qty, r.unit, r.total];
    })).map(function (a) {
      return a.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "okb-equipment" + (state.region ? "-" + state.region.replace(/\W+/g, "-") : "") + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // ---------- URL state ----------
  function syncUrl() {
    var p = new URLSearchParams();
    ["q", "region", "office", "cat"].forEach(function (k) { if (state[k]) p.set(k, state[k]); });
    if (state.view !== "grouped") p.set("view", state.view);
    var qs = p.toString();
    try { history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash); } catch (e) { /* ignore */ }
  }
  function readUrl() {
    var p = new URLSearchParams(location.search);
    ["q", "region", "office", "cat"].forEach(function (k) { state[k] = p.get(k) || ""; });
    if (p.get("view") === "flat") state.view = "flat";
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
      $("q").value = "";
      buildSelects();
      render();
    });
    $("refreshBtn").addEventListener("click", load);
    $("exportBtn").addEventListener("click", exportCsv);
    $("printBtn").addEventListener("click", function () { window.print(); });
    $("drawerClose").addEventListener("click", closeDrawer);
    $("drawerBackdrop").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("drawer").classList.contains("open")) closeDrawer(); });

    document.addEventListener("click", function (e) {
      var el = e.target.closest("[data-k],[data-clear],[data-region],[data-apply-region],[data-view],th[data-sort]");
      if (!el) return;
      if (el.hasAttribute("data-k")) setFilter(el.getAttribute("data-k"), el.getAttribute("data-v"));
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
  window.OKB = { parseCSV: parseCSV, normalize: normalize, categorize: categorize };
})();
