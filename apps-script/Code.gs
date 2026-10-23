/**
 * OKB Equipment Tracker — fix endpoint for Google Sheets.
 *
 * Lets the tracker website apply fixes to the "REQ. FUND (EQUIPMENT)" tab,
 * logs every change to a "Fix History" tab, and can undo a whole batch.
 *
 * Setup (once):
 *   1. Open the spreadsheet → Extensions → Apps Script.
 *   2. Replace the contents of Code.gs with this file and set PASSCODE below.
 *   3. Deploy → New deployment → type "Web app"
 *        Execute as: Me      Who has access: Anyone
 *   4. Copy the Web app URL and paste it into the tracker's "Connect" dialog
 *      (or into assets/config.js so every visitor gets it).
 *
 * Updating an existing deployment: paste the new code, then Deploy → Manage
 * deployments → Edit (pencil) → Version: New version → Deploy, and allow the
 * new permissions when asked (cell links are read through the Sheets API).
 */

var PASSCODE = 'change-me';             // required to apply or undo fixes
var DATA_SHEET = 'REQ. FUND (EQUIPMENT)';
var HISTORY_SHEET = 'Fix History';
var MONEY_FORMAT = '[$₱]#,##0.00';
var HISTORY_HEADERS = ['Batch', 'Time', 'By', 'Action', 'Issue', 'Cell', 'Before', 'After', 'Status', 'Prev formula', 'Prev value', 'Prev format', 'Note', 'Prev link'];
var SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets/';

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';
  if (action === 'history') return json_({ ok: true, history: readHistory_(Number(e.parameter.limit) || 400) });
  return json_({ ok: true, sheet: DATA_SHEET });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Bad request' }); }
  if (!body || body.passcode !== PASSCODE || PASSCODE === 'change-me') {
    return json_({ ok: false, error: PASSCODE === 'change-me' ? 'Set PASSCODE in the Apps Script first.' : 'Wrong passcode.' });
  }
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) return json_({ ok: false, error: 'The sheet is busy, try again.' });
  try {
    if (body.action === 'apply') return json_(apply_(body));
    if (body.action === 'undo') return json_(undo_(body));
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------- Apply ----------
function apply_(body) {
  var sh = book_().getSheetByName(DATA_SHEET);
  var batch = 'B' + new Date().getTime();
  var by = String(body.by || 'Website').slice(0, 80);
  var log = [], results = [];
  var links = readLinks_(sh), relink = [];

  try {
    (body.changes || []).forEach(function (c) { applyOne_(sh, c, batch, by, links, relink, log, results); });
  } finally {
    restoreLinks_(sh, relink);
  }

  appendHistory_(log);
  return { ok: true, batch: batch, results: results, applied: log.filter(function (r) { return r[8] === 'applied'; }).length, logged: log.length };
}

function applyOne_(sh, c, batch, by, links, relink, log, results) {
  if (c.kind === 'normalizeCurrency') {
    normalizeCurrency_(sh, c.range, links, relink).forEach(function (r) {
      log.push(row_(batch, by, 'fix', c.issue, r.a1, r.before, r.after, 'applied', r.prev, c.label));
    });
    results.push({ id: c.id, status: 'applied' });
    return;
  }
  var range = sh.getRange(Number(c.row), Number(c.col));
  var a1 = range.getA1Notation();
  var current = range.getDisplayValue();
  if (current !== c.before) {
    var st = current === c.preview ? 'already fixed' : 'skipped: cell changed since the page loaded';
    log.push(row_(batch, by, 'fix', c.issue, a1, current, c.preview, st, null, c.label));
    results.push({ id: c.id, status: st });
    return;
  }
  var prev = snapshot_(range, links);
  write_(range, c);
  SpreadsheetApp.flush();
  var note = keepLink_(sh, c, prev.link, links, relink);
  log.push(row_(batch, by, 'fix', c.issue, a1, current, range.getDisplayValue(), 'applied', prev, [c.label, note].filter(Boolean).join(' — ')));
  results.push({ id: c.id, status: 'applied' });
}

function write_(range, c) {
  if (c.kind === 'formula') {
    range.setFormula(c.value);
    range.setNumberFormat(MONEY_FORMAT);
  } else if (c.kind === 'number') {
    range.setValue(Number(c.value));
    range.setNumberFormat(MONEY_FORMAT);
  } else if (c.kind === 'clear') {
    range.clearContent();
  } else {
    range.setValue(String(c.value));
  }
}

// Converts peso amounts typed as text (e.g. " ₱ 7,700,000.00 ") into real numbers.
function normalizeCurrency_(sh, a1, links, relink) {
  var range = sh.getRange(a1);
  var values = range.getValues(), formulas = range.getFormulas(), formats = range.getNumberFormats();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      var v = values[i][j];
      if (formulas[i][j] || typeof v !== 'string') continue;
      if (!/^\s*₱?\s*[\d,]+(\.\d+)?\s*$/.test(v) || !/\d/.test(v)) continue;
      var n = Number(v.replace(/[^\d.]/g, ''));
      var cell = range.getCell(i + 1, j + 1);
      var prev = { formula: '', value: v, format: formats[i][j], link: links[key_(cell.getRow(), cell.getColumn())] || '' };
      cell.setValue(n).setNumberFormat(MONEY_FORMAT);
      if (prev.link) setLink_(links, relink, cell.getRow(), cell.getColumn(), prev.link);
      out.push({ a1: cell.getA1Notation(), before: v, after: cell.getDisplayValue(), prev: prev });
    }
  }
  return out;
}

// ---------- Undo ----------
function undo_(body) {
  var sh = book_().getSheetByName(DATA_SHEET);
  var hs = historySheet_();
  var data = hs.getDataRange().getValues();
  var by = String(body.by || 'Website').slice(0, 80);
  var undoBatch = 'U' + new Date().getTime();
  var log = [], restored = 0;
  var links = readLinks_(sh), relink = [];
  try {
    for (var i = data.length - 1; i >= 1; i--) {
      var r = data[i];
      if (r[0] !== body.batch || r[3] !== 'fix' || r[8] !== 'applied') continue;
      var range = sh.getRange(r[5]);
      var current = range.getDisplayValue();
      if (current !== String(r[7])) {
        log.push(row_(undoBatch, by, 'undo', r[4], r[5], current, r[6], 'skipped: cell changed after the fix', null, 'Undo of ' + body.batch));
        continue;
      }
      if (r[9]) range.setFormula(r[9]);
      else {
        var v = r[10] === '' ? '' : JSON.parse(r[10]);
        if (v === '') range.clearContent(); else range.setValue(v);
      }
      if (r[11]) range.setNumberFormat(r[11]);
      SpreadsheetApp.flush();
      var uri = r[13] || links[key_(range.getRow(), range.getColumn())];
      if (uri) setLink_(links, relink, range.getRow(), range.getColumn(), uri);
      hs.getRange(i + 1, 9).setValue('undone');
      log.push(row_(undoBatch, by, 'undo', r[4], r[5], current, range.getDisplayValue(), 'applied', null, 'Undo of ' + body.batch));
      restored++;
    }
  } finally {
    restoreLinks_(sh, relink);
  }
  appendHistory_(log);
  return { ok: true, batch: undoBatch, restored: restored, logged: log.length };
}

// ---------- Cell links ----------
// setValue/setFormula drop a cell's link, so links are read through the Sheets
// API before a batch and written back once its values are in.

// openById (rather than getActive alone) makes Apps Script ask for the full
// spreadsheets scope, which the Sheets API calls need.
var book;
function book_() {
  return book || (book = SpreadsheetApp.openById(SpreadsheetApp.getActive().getId()));
}

function api_(method, path, payload) {
  var opt = { method: method, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
  if (payload) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(payload); }
  var res = UrlFetchApp.fetch(SHEETS_API + book_().getId() + path, opt);
  if (res.getResponseCode() !== 200) throw new Error('Sheets API ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText());
}

function key_(row, col) { return row + ':' + col; }

// Returns { 'row:col': url } for every linked cell of the sheet.
function readLinks_(sh) {
  var fields = 'sheets.data.rowData.values(hyperlink,userEnteredFormat.textFormat.link,textFormatRuns.format.link)';
  var res = api_('get', '?ranges=' + encodeURIComponent("'" + sh.getName().replace(/'/g, "''") + "'") + '&fields=' + encodeURIComponent(fields));
  var data = res.sheets && res.sheets[0] && res.sheets[0].data && res.sheets[0].data[0];
  var links = {};
  ((data && data.rowData) || []).forEach(function (r, i) {
    (r.values || []).forEach(function (v, j) {
      var uri = linkOf_(v);
      if (uri) links[key_(i + 1, j + 1)] = uri;
    });
  });
  return links;
}

// A text cell with several links keeps only its first one.
function linkOf_(v) {
  var f = v.userEnteredFormat && v.userEnteredFormat.textFormat;
  if (f && f.link && f.link.uri) return f.link.uri;
  var runs = (v.textFormatRuns || []).filter(function (r) { return r.format && r.format.link && r.format.link.uri; });
  return runs.length ? runs[0].format.link.uri : v.hyperlink || '';
}

function setLink_(links, relink, row, col, uri) {
  links[key_(row, col)] = uri;
  relink.push({ row: row, col: col, uri: uri });
}

// Puts a rewritten cell's link back. An emptied cell (an extra region total)
// hands its link to c.linkTo (the region's total), or to the office name on
// its row when that cell already has a different link.
function keepLink_(sh, c, uri, links, relink) {
  if (!uri) return '';
  if (c.kind !== 'clear') { setLink_(links, relink, Number(c.row), Number(c.col), uri); return ''; }
  var spots = [];
  if (c.linkTo) spots.push(sh.getRange(Number(c.linkTo.row), Number(c.linkTo.col)));
  var office = sh.getRange(Number(c.row), 2), merged = office.getMergedRanges();
  if (merged.length) office = merged[0].getCell(1, 1);
  if (office.getDisplayValue()) spots.push(office);
  for (var i = 0; i < spots.length; i++) {
    var k = key_(spots[i].getRow(), spots[i].getColumn());
    if (links[k] === uri) return 'link already on ' + spots[i].getA1Notation();
    if (!links[k]) {
      setLink_(links, relink, spots[i].getRow(), spots[i].getColumn(), uri);
      return 'link moved to ' + spots[i].getA1Notation();
    }
  }
  setLink_(links, relink, Number(c.row), Number(c.col), uri);
  return 'link kept on the emptied cell: ' + uri;
}

function restoreLinks_(sh, relink) {
  if (!relink.length) return;
  SpreadsheetApp.flush();
  var id = sh.getSheetId();
  api_('post', ':batchUpdate', { requests: relink.map(function (l) {
    return { repeatCell: {
      range: { sheetId: id, startRowIndex: l.row - 1, endRowIndex: l.row, startColumnIndex: l.col - 1, endColumnIndex: l.col },
      cell: { userEnteredFormat: { textFormat: { link: { uri: l.uri } } } },
      fields: 'userEnteredFormat.textFormat.link'
    } };
  }) });
}

// ---------- History ----------
function snapshot_(range, links) {
  return { formula: range.getFormula(), value: range.getValue(), format: range.getNumberFormat(),
    link: links[key_(range.getRow(), range.getColumn())] || '' };
}

function row_(batch, by, action, issue, a1, before, after, status, prev, note) {
  return [
    batch, new Date(), by, action, issue || '', a1, String(before), String(after), status,
    prev ? prev.formula : '', prev && !prev.formula ? JSON.stringify(prev.value) : '', prev ? prev.format : '', note || '',
    prev && prev.link || ''
  ];
}

function historySheet_() {
  var ss = SpreadsheetApp.getActive();
  var hs = ss.getSheetByName(HISTORY_SHEET);
  if (!hs) {
    hs = ss.insertSheet(HISTORY_SHEET);
    hs.getRange(1, 1, 1, HISTORY_HEADERS.length).setValues([HISTORY_HEADERS]).setFontWeight('bold');
    hs.setFrozenRows(1);
  } else if (hs.getRange(1, HISTORY_HEADERS.length).getValue() !== HISTORY_HEADERS[HISTORY_HEADERS.length - 1]) {
    hs.getRange(1, 1, 1, HISTORY_HEADERS.length).setValues([HISTORY_HEADERS]).setFontWeight('bold');
  }
  return hs;
}

function appendHistory_(rows) {
  if (!rows.length) return;
  var hs = historySheet_();
  var start = hs.getLastRow() + 1;
  // Keep logged values as plain text so "₱4,000,000.00" is not re-parsed as a number.
  hs.getRange(start, 5, rows.length, HISTORY_HEADERS.length - 4).setNumberFormat('@');
  hs.getRange(start, 1, rows.length, HISTORY_HEADERS.length).setValues(rows);
}

function readHistory_(limit) {
  var hs = historySheet_();
  var last = hs.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, last - limit + 1);
  return hs.getRange(start, 1, last - start + 1, 9).getValues().map(function (r) {
    return { batch: r[0], time: r[1] instanceof Date ? r[1].toISOString() : String(r[1]), by: r[2], action: r[3], issue: r[4], cell: r[5], before: r[6], after: r[7], status: r[8] };
  }).reverse();
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
