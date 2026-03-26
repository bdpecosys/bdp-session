// BDP Signal Intelligence - app.js
var BASE = 'https://session.bdpartners.co';
var CACHE_KEY = 'bdp_v4';
var CACHE_TTL = 30 * 60 * 1000;

var QUERIES = [{"id": "cloud_adopt_me", "label": "Cloud Adoption \u00b7 Middle East", "type": "cloud", "geo": "UAE", "q": "\"migrates to AWS\" OR \"moves to Google Cloud\" OR \"selects AWS\" OR \"cloud transformation\" OR \"signs agreement with AWS\" bank OR insurance OR fintech UAE OR Dubai OR \"Abu Dhabi\" -drone -attack -outage -strike -war"}, {"id": "cloud_adopt_il", "label": "Cloud Adoption \u00b7 Israel", "type": "cloud", "geo": "Israel", "q": "\"migrates to\" OR \"selects\" OR \"cloud transformation\" OR \"digital transformation\" AWS OR \"Google Cloud\" OR Azure bank OR insurance OR retail Israel -drone -attack -war -military -IDF"}, {"id": "cloud_adopt_sg", "label": "Cloud Adoption \u00b7 Singapore", "type": "cloud", "geo": "APAC", "q": "\"migrates to AWS\" OR \"moves to Google Cloud\" OR \"selects Azure\" OR \"cloud migration\" bank OR insurance OR fintech Singapore -outage"}, {"id": "cloud_adopt_in", "label": "Cloud Adoption \u00b7 India", "type": "cloud", "geo": "APAC", "q": "\"migrates to AWS\" OR \"moves to Google Cloud\" OR \"cloud transformation\" bank OR insurance OR fintech India 2025 OR 2026 -outage -breach"}, {"id": "cloud_adopt_uk", "label": "Cloud Adoption \u00b7 UK", "type": "cloud", "geo": "EU", "q": "\"migrates to AWS\" OR \"selects Google Cloud\" OR \"moves to Azure\" OR \"cloud transformation\" bank OR insurance OR retail \"United Kingdom\" OR \"UK\" -breach -outage 2025 OR 2026"}, {"id": "cloud_adopt_de", "label": "Cloud Adoption \u00b7 Germany", "type": "cloud", "geo": "EU", "q": "\"migrates to\" OR \"selects\" OR \"cloud transformation\" AWS OR \"Google Cloud\" OR Azure bank OR insurance OR retail Germany 2025 OR 2026 -breach -outage"}, {"id": "hire_cdo_me", "label": "CDO / CIO Hire \u00b7 Middle East", "type": "hiring", "geo": "UAE", "q": "appointed OR named \"Chief Digital Officer\" OR \"Chief Information Officer\" OR \"Head of Innovation\" OR \"VP Technology\" UAE OR Dubai OR \"Abu Dhabi\" bank OR insurance OR fintech 2025 OR 2026"}, {"id": "hire_partnerships_me", "label": "VP Partnerships Hire \u00b7 Middle East", "type": "hiring", "geo": "UAE", "q": "appointed OR named OR joins \"VP Partnerships\" OR \"Head of Business Development\" OR \"Chief Partnerships Officer\" UAE OR Israel OR Dubai bank OR fintech OR insurance 2025 OR 2026"}, {"id": "hire_cdo_apac", "label": "CDO / CIO Hire \u00b7 APAC", "type": "hiring", "geo": "APAC", "q": "appointed OR named \"Chief Digital Officer\" OR \"Chief Information Officer\" OR \"Head of Innovation\" Singapore OR India bank OR insurance OR fintech 2025 OR 2026"}, {"id": "hire_cdo_eu", "label": "CDO / CIO Hire \u00b7 UK & Germany", "type": "hiring", "geo": "EU", "q": "appointed OR named \"Chief Digital Officer\" OR \"Chief Information Officer\" OR \"Head of Innovation\" \"United Kingdom\" OR Germany bank OR insurance OR retail 2025 OR 2026"}, {"id": "platform_listing_il", "label": "Marketplace Listing \u00b7 Israel", "type": "platform", "geo": "Israel", "q": "\"listed on AWS Marketplace\" OR \"AWS ISV\" OR \"joins Google Cloud\" OR \"AppExchange\" Israeli OR Israel startup 2025 OR 2026"}, {"id": "cloud_partner_me", "label": "Cloud Partnership \u00b7 Middle East", "type": "cloud", "geo": "UAE", "q": "\"strategic partnership\" OR \"signs deal\" OR \"agreement\" AWS OR \"Google Cloud\" OR Microsoft UAE OR Dubai OR \"Saudi Arabia\" enterprise OR bank OR telecom 2025 OR 2026 -drone -attack"}];

var PROXIES = [
  function(u){ return 'https://corsproxy.io/?' + encodeURIComponent(u); },
  function(u){ return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
  function(u){ return 'https://api.allorigins.win/get?url=' + encodeURIComponent(u); }
];

var all = [];
var typeFilter = 'all';
var geoFilter = null;
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
      if (!r.ok) throw new Error('bad status');
      // allorigins /get returns JSON wrapper
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
    return s.title.length > 10 && (!s.d || isNaN(s.d) || s.d.getTime() > cutoff);
  });
}

function dedupe(arr) {
  var seen = {};
  return arr.filter(function(s) {
    var k = s.title.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,50);
    if (seen[k]) return false;
    seen[k] = true;
    return true;
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
  var dot = document.getElementById('dot');
  dot.className = 'dot ' + state;
  document.getElementById('status').textContent = text;
  document.getElementById('progress').textContent = prog || '';
}

function updateStats() {
  document.getElementById('s-total').textContent = all.length;
  document.getElementById('s-cloud').textContent = all.filter(function(s){ return s.type==='cloud'; }).length;
  document.getElementById('s-hiring').textContent = all.filter(function(s){ return s.type==='hiring'; }).length;
  document.getElementById('s-platform').textContent = all.filter(function(s){ return s.type==='platform'; }).length;
}

function filtered() {
  var q = document.getElementById('q').value.toLowerCase();
  return all.filter(function(s) {
    if (typeFilter !== 'all' && s.type !== typeFilter) return false;
    if (geoFilter && s.geo !== geoFilter) return false;
    if (q && s.title.toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}

function typeBadge(t) {
  var map = {cloud:'b-cloud',hiring:'b-hiring',platform:'b-platform'};
  var label = {cloud:'Cloud',hiring:'Hire',platform:'Partnership'};
  return '<span class="badge ' + (map[t]||'') + '">' + (label[t]||t) + '</span>';
}

function render() {
  var data = filtered();
  document.getElementById('s-showing').textContent = data.length;
  document.getElementById('fcount').textContent = data.length + ' signals shown';
  var grid = document.getElementById('grid');
  if (data.length === 0) {
    document.getElementById('results').style.display = 'none';
    document.getElementById('empty').style.display = 'block';
    return;
  }
  document.getElementById('empty').style.display = 'none';
  document.getElementById('results').style.display = 'block';

  // Store for modal
  window._data = data;

  grid.innerHTML = data.map(function(s, i) {
    return '<div class="card" style="animation-delay:' + Math.min(i*25,250) + 'ms">' +
      '<div class="card-top">' +
        '<div class="badges">' + typeBadge(s.type) + '<span class="badge b-geo">' + s.geo + '</span></div>' +
        '<div class="card-date">' + ago(s.d) + '</div>' +
      '</div>' +
      '<div class="card-title"><a href="' + s.link + '" target="_blank" rel="noopener">' +
        s.title.replace(/<[^>]+>/g,'') +
      '</a></div>' +
      '<div class="card-source">' + (s.source||'') + '</div>' +
      '<div class="card-actions">' +
        '<button class="btn-action" onclick="openModal(' + i + ')">Generate opt-in link</button>' +
        '<a class="btn-read" href="' + s.link + '" target="_blank" rel="noopener">Read</a>' +
      '</div>' +
    '</div>';
  }).join('');
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
        document.getElementById('last-updated').textContent = 'Cached: ' + new Date(c.ts).toLocaleTimeString();
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
    if (all.length === 0) {
      setStatus('loading', '0 signals - proxy may be blocked, try Refresh', '');
    } else {
      setStatus('done', 'Live: ' + all.length + ' signals loaded', '');
    }
  });
}

function filterType(t, btn) {
  typeFilter = t;
  document.querySelectorAll('[data-type]').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  render();
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
