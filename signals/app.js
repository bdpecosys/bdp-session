// BDP Signal Intelligence - app.js
var BASE = 'https://session.bdpartners.co';
var CACHE_KEY = 'bdp_v5';
var CACHE_TTL = 30 * 60 * 1000;

var QUERIES = [{"id": "cloud_il", "label": "Cloud \u00b7 Israel", "type": "cloud", "geo": "IL", "q": "cloud transformation Israel bank OR insurance OR retail 2025 OR 2026 -drone -attack -war"}, {"id": "cloud_uae", "label": "Cloud \u00b7 UAE", "type": "cloud", "geo": "UAE", "q": "cloud transformation UAE OR Dubai bank OR insurance OR fintech 2025 OR 2026 -drone -attack -strike"}, {"id": "cloud_sg", "label": "Cloud \u00b7 Singapore", "type": "cloud", "geo": "APAC", "q": "cloud migration Singapore bank OR insurance OR fintech 2025 OR 2026"}, {"id": "cloud_in", "label": "Cloud \u00b7 India", "type": "cloud", "geo": "APAC", "q": "cloud transformation India bank OR insurance OR fintech 2025 OR 2026"}, {"id": "cloud_uk", "label": "Cloud \u00b7 UK", "type": "cloud", "geo": "EU", "q": "cloud migration UK bank OR insurance OR retail 2025 OR 2026"}, {"id": "cloud_de", "label": "Cloud \u00b7 Germany", "type": "cloud", "geo": "EU", "q": "cloud transformation Germany bank OR insurance OR retail 2025 OR 2026"}, {"id": "hire_me", "label": "Hire \u00b7 Middle East", "type": "hiring", "geo": "UAE", "q": "appointed OR named \"Chief Digital Officer\" OR \"Chief Information Officer\" OR \"Head of Innovation\" OR \"VP Technology\" UAE OR Dubai OR \"Abu Dhabi\" bank OR insurance OR fintech after:2025-01-01"}, {"id": "hire_me2", "label": "Hire Partnerships \u00b7 ME", "type": "hiring", "geo": "UAE", "q": "appointed OR named OR joins \"VP Partnerships\" OR \"Head of Business Development\" OR \"Chief Partnerships\" UAE OR Israel OR Dubai bank OR fintech OR insurance after:2025-01-01"}, {"id": "hire_apac", "label": "Hire \u00b7 APAC", "type": "hiring", "geo": "APAC", "q": "appointed OR named \"Chief Digital Officer\" OR \"Chief Information Officer\" OR \"Head of Innovation\" Singapore OR India bank OR insurance OR fintech after:2025-01-01"}, {"id": "hire_eu", "label": "Hire \u00b7 EU", "type": "hiring", "geo": "EU", "q": "appointed OR named \"Chief Digital Officer\" OR \"Chief Information Officer\" OR \"Head of Innovation\" \"United Kingdom\" OR Germany bank OR insurance OR retail after:2025-01-01"}, {"id": "platform_il", "label": "Platform \u00b7 Israel", "type": "platform", "geo": "IL", "q": "\"listed on AWS Marketplace\" OR \"AWS ISV\" OR \"joins Google Cloud\" OR \"AppExchange\" Israeli OR Israel startup 2025 OR 2026"}];

var PROXIES = [
  function(u){ return 'https://corsproxy.io/?' + encodeURIComponent(u); },
  function(u){ return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
  function(u){ return 'https://api.allorigins.win/get?url=' + encodeURIComponent(u); }
];

var all = [];
var typeFilter = 'all';
var geoFilter = null;
var currentView = 'grid';
var modalIdx = -1;
var oppN = 1;

function rssUrl(q) {
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-US&gl=US&ceid=US:en';
}

function fetchProxy(url) {
  var i = 0;
  function next() {
    if (i >= PROXIES.length) return Promise.resolve('');
    var purl = PROXIES[i++](url);
    return fetch(purl).then(function(r) {
      if (!r.ok) throw new Error('bad');
      if (purl.indexOf('/get?url=') !== -1) {
        return r.json().then(function(d) { return d.contents || ''; });
      }
      return r.text();
    }).then(function(t) {
      if (!t || t.length < 100) throw new Error('empty');
      return t;
    }).catch(function() { return next(); });
  }
  return next();
}

function parseRss(xml, query) {
  var items = Array.from(xml.querySelectorAll('item'));
  var cutoff = Date.now() - 365 * 24 * 3600 * 1000;
  return items.slice(0, 12).map(function(item) {
    var title = (item.querySelector('title') || {}).textContent || '';
    var link  = (item.querySelector('link')  || {}).textContent || '';
    var pub   = (item.querySelector('pubDate') || {}).textContent || '';
    var src   = (item.querySelector('source') || {}).textContent || '';
    var d = pub ? new Date(pub) : new Date(0);
    return { title:title, link:link, source:src, type:query.type, geo:query.geo, d:d, signal:title.slice(0,120) };
  }).filter(function(s) {
    return s.title.length > 10 && s.d.getTime() > cutoff;
  });
}

function dedupe(arr) {
  var seen = {};
  return arr.filter(function(s) {
    var k = s.title.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,50);
    if (seen[k]) return false; seen[k] = true; return true;
  });
}

function ago(d) {
  if (!d || isNaN(d.getTime()) || d.getTime() === 0) return '';
  var m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return m + 'm ago';
  if (m < 1440) return Math.floor(m/60) + 'h ago';
  if (m < 10080) return Math.floor(m/1440) + 'd ago';
  return d.toLocaleDateString('en-GB', {day:'numeric', month:'short'});
}

function setStatus(state, text, prog) {
  document.getElementById('dot').className = 'dot ' + state;
  document.getElementById('status').textContent = text;
  document.getElementById('progress').textContent = prog || '';
}

function updateStats() {
  document.getElementById('s-total').textContent = all.length;
  document.getElementById('s-cloud').textContent = all.filter(function(s){ return s.type==='cloud'; }).length;
  document.getElementById('s-hiring').textContent = all.filter(function(s){ return s.type==='hiring'; }).length;
  document.getElementById('s-platform').textContent = all.filter(function(s){ return s.type==='platform'; }).length;
}

function getFiltered() {
  var q = document.getElementById('q').value.toLowerCase();
  return all.filter(function(s) {
    if (typeFilter !== 'all' && s.type !== typeFilter) return false;
    if (geoFilter && s.geo !== geoFilter) return false;
    if (q && s.title.toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}

function typeBadge(t) {
  var cls = {cloud:'b-cloud',hiring:'b-hiring',platform:'b-platform'};
  var lbl = {cloud:'Cloud',hiring:'Hire',platform:'Partnership'};
  return '<span class="badge ' + (cls[t]||'') + '">' + (lbl[t]||t) + '</span>';
}

function render() {
  var data = getFiltered();
  window._data = data;
  document.getElementById('s-showing').textContent = data.length;
  document.getElementById('fcount').textContent = data.length + ' signals shown';

  if (data.length === 0) {
    document.getElementById('results').style.display = 'none';
    document.getElementById('empty').style.display = 'block';
    return;
  }
  document.getElementById('empty').style.display = 'none';
  document.getElementById('results').style.display = 'block';

  if (currentView === 'grid') {
    renderGrid(data);
  } else {
    renderTable(data);
  }
}

function renderGrid(data) {
  document.getElementById('grid').style.display = 'grid';
  document.getElementById('tbl-wrap').style.display = 'none';
  document.getElementById('grid').innerHTML = data.map(function(s, i) {
    return '<div class="card" style="animation-delay:' + Math.min(i*25,250) + 'ms">' +
      '<div class="card-top"><div class="badges">' + typeBadge(s.type) +
      '<span class="badge b-geo">' + s.geo + '</span></div>' +
      '<div class="card-date">' + ago(s.d) + '</div></div>' +
      '<div class="card-title"><a href="' + s.link + '" target="_blank" rel="noopener">' +
        s.title.replace(/<[^>]+>/g,'') + '</a></div>' +
      '<div class="card-source">' + (s.source||'') + '</div>' +
      '<div class="card-actions">' +
        '<button class="btn-action" onclick="openModal(' + i + ')">Generate opt-in link</button>' +
        '<a class="btn-read" href="' + s.link + '" target="_blank" rel="noopener">Read</a>' +
      '</div></div>';
  }).join('');
}

// Enrichment cache: signal id -> {company, person_name, person_title}
var enrichCache = {};
var enrichBusy = false;

function signalId(s) {
  return (s.title || '').slice(0, 40).replace(/[^a-z0-9]/gi, '');
}

function enrichAndRender(data) {
  // Show table immediately with spinners for unenriched rows
  renderTableRaw(data);

  var toEnrich = data.filter(function(s) { return !enrichCache[signalId(s)]; });
  if (toEnrich.length === 0 || enrichBusy) return;

  enrichBusy = true;
  var bar = document.getElementById('enrich-bar');
  bar.style.display = 'flex';

  var batchSize = 8;
  var batches = [];
  for (var i = 0; i < toEnrich.length; i += batchSize) {
    batches.push(toEnrich.slice(i, i + batchSize));
  }

  var bIdx = 0;
  function nextBatch() {
    if (bIdx >= batches.length) {
      enrichBusy = false;
      bar.style.display = 'none';
      renderTableRaw(data);
      return;
    }
    var batch = batches[bIdx++];
    document.getElementById('enrich-text').textContent =
      'Extracting contacts... batch ' + bIdx + ' of ' + batches.length;

    var headlines = batch.map(function(s, i) {
      return (i + 1) + '. ' + s.title.replace(/<[^>]+>/g, '');
    }).join('\n');

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: 'Extract data from news headlines. For each numbered headline return a JSON array with one object per headline containing: company (the enterprise customer or partner being written about, NOT AWS/Google/Microsoft/Oracle themselves), person_name (full name of any executive mentioned), person_title (their job title). Use empty string if not found. Return ONLY the raw JSON array, no markdown, no explanation.',
        messages: [{ role: 'user', content: headlines }]
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var text = ((data.content || [])[0] || {}).text || '[]';
      text = text.replace(/```[a-z]*/g, '').replace(/```/g, '').trim();
      var results = JSON.parse(text);
      batch.forEach(function(s, i) {
        enrichCache[signalId(s)] = results[i] || { company: '', person_name: '', person_title: '' };
      });
      nextBatch();
    })
    .catch(function() {
      batch.forEach(function(s) {
        enrichCache[signalId(s)] = { company: '', person_name: '', person_title: '' };
      });
      nextBatch();
    });
  }
  nextBatch();
}

function spinner() {
  return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#c9a84c;animation:pulse 1s infinite"></span>';
}

function renderTableRaw(data) {
  document.getElementById('grid').style.display = 'none';
  document.getElementById('tbl-wrap').style.display = 'block';
  document.getElementById('tbody').innerHTML = data.map(function(s, i) {
    var e = enrichCache[signalId(s)];
    var company = e ? (e.company || '-') : spinner();
    var contact = e
      ? (e.person_name ? '<b>' + e.person_name + '</b><br><span style="font-size:11px;color:#6b7280">' + (e.person_title || '') + '</span>' : '-')
      : spinner();

    return '<tr>' +
      '<td style="max-width:280px"><div style="font-weight:500;line-height:1.35">' +
        '<a href="' + s.link + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">' +
        s.title.replace(/<[^>]+>/g, '').slice(0, 90) +
        (s.title.length > 90 ? '...' : '') + '</a></div>' +
        '<div style="font-size:11px;color:#6b7280;margin-top:2px">' + (s.source || '') + '</div>' +
      '</td>' +
      '<td style="font-weight:600;color:#0f1f38;min-width:120px">' + company + '</td>' +
      '<td style="min-width:150px">' + contact + '</td>' +
      '<td>' + typeBadge(s.type) + '<br><span class="badge b-geo" style="margin-top:4px;display:inline-block">' + s.geo + '</span></td>' +
      '<td style="font-size:12px;color:#6b7280;white-space:nowrap">' + ago(s.d) + '</td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn-action" style="font-size:11px;padding:4px 10px;display:block;margin-bottom:4px" onclick="openModal(' + i + ')">Opt-in link</button>' +
        '<a class="btn-read" style="font-size:11px;padding:4px 10px" href="' + s.link + '" target="_blank">Read</a>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function renderTable(data) {
  enrichAndRender(data);
}

function setView(v) {
  currentView = v;
  document.getElementById('v-grid').className = 'vbtn' + (v==='grid' ? ' active' : '');
  document.getElementById('v-table').className = 'vbtn' + (v==='table' ? ' active' : '');
  render();
}

function load(force) {
  if (!force) {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.ts && (Date.now() - c.ts) < CACHE_TTL && c.data && c.data.length > 0) {
        all = c.data.map(function(s) { s.d = new Date(s.d); return s; });
        document.getElementById('loading').style.display = 'none';
        updateStats(); render();
        setStatus('done', 'Cached: ' + new Date(c.ts).toLocaleTimeString(), '');
        document.getElementById('last-updated').textContent = 'Updated: ' + new Date(c.ts).toLocaleTimeString();
        return;
      }
    } catch(e) {}
  }
  all = [];
  document.getElementById('rbtn').disabled = true;
  document.getElementById('loading').style.display = 'grid';
  document.getElementById('results').style.display = 'none';
  document.getElementById('empty').style.display = 'none';
  setStatus('loading', 'Fetching signals...', '0 / ' + QUERIES.length);

  var done = 0;
  var parser = new DOMParser();
  Promise.all(QUERIES.map(function(q) {
    return fetchProxy(rssUrl(q.q)).then(function(text) {
      if (text) {
        var xml = parser.parseFromString(text, 'text/xml');
        all = all.concat(parseRss(xml, q));
      }
    }).catch(function(){}).finally(function() {
      done++;
      setStatus('loading', 'Loading...', done + ' / ' + QUERIES.length + ' done, ' + all.length + ' signals');
    });
  })).then(function() {
    all = dedupe(all).sort(function(a,b) { return b.d - a.d; });
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ts:Date.now(), data:all})); } catch(e) {}
    document.getElementById('loading').style.display = 'none';
    document.getElementById('rbtn').disabled = false;
    document.getElementById('last-updated').textContent = 'Updated: ' + new Date().toLocaleTimeString();
    updateStats(); render();
    setStatus('done', 'Live: ' + all.length + ' signals', '');
  });
}

function filterType(t, btn) {
  typeFilter = t;
  document.querySelectorAll('[data-type]').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active'); render();
}

function filterGeo(g, btn) {
  if (geoFilter === g) { geoFilter = null; btn.classList.remove('active'); }
  else {
    geoFilter = g;
    document.querySelectorAll('[data-geo]').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
  }
  render();
}

function openModal(i) {
  var s = (window._data || [])[i];
  if (!s) return;
  modalIdx = i;
  document.getElementById('msig').textContent = s.signal.slice(0,100);
  document.getElementById('m-startup').value = '';
  document.getElementById('m-company').value = '';
  document.getElementById('m-contact').value = {cloud:'CIO',hiring:'New Executive',platform:'VP Partnerships'}[s.type] || '';
  document.getElementById('m-opp').value = 'OPP-' + String(oppN).padStart(3,'0');
  oppN++;
  mkLink();
  document.getElementById('modal').classList.add('open');
  document.getElementById('copybtn').textContent = 'Copy link';
  document.getElementById('copybtn').className = 'btn-copy';
}

function mkLink() {
  var s = (window._data || [])[modalIdx];
  if (!s) return;
  var p = new URLSearchParams();
  var startup = document.getElementById('m-startup').value.trim();
  if (startup) p.set('startup', startup);
  p.set('signal', s.signal.slice(0,100));
  var company = document.getElementById('m-company').value.trim();
  if (company) p.set('company', company);
  var contact = document.getElementById('m-contact').value.trim();
  if (contact) p.set('contact', contact);
  var opp = document.getElementById('m-opp').value.trim();
  if (opp) p.set('opp', opp);
  document.getElementById('m-link').textContent = BASE + '?' + p.toString();
}

function copyLink() {
  var link = document.getElementById('m-link').textContent;
  navigator.clipboard.writeText(link).then(function() {
    var btn = document.getElementById('copybtn');
    btn.textContent = 'Copied!';
    btn.className = 'btn-copy copied';
    setTimeout(function(){ btn.textContent = 'Copy link'; btn.className = 'btn-copy'; }, 2000);
  });
}

function closeModal() { document.getElementById('modal').classList.remove('open'); }
function bgClick(e) { if (e.target === document.getElementById('modal')) closeModal(); }

window.addEventListener('DOMContentLoaded', function() { load(false); });
