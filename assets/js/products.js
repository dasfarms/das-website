(async function(){
  const $ = (sel, el=document) => el.querySelector(sel);

  function renderCurrentZoneBadge(){
    const badge = $('#currentZoneBadge');
    const btn = $('#zoneSetBtn');

    if(!badge || !btn) return;

    let z = getUserZone();

    if(z == null){
      try{
        z = (window.ZoneWidget && ZoneWidget.get) ? ZoneWidget.get() : null;
      }catch(e){
        z = null;
      }
    }

    const hasZone = (z !== null && z !== undefined && String(z).trim() !== '');

    if(hasZone){
      badge.style.display = "inline-block";
      badge.textContent = "Zone " + z;
      btn.textContent = "Change Zone";
      btn.classList.remove("zone-warning-button");
    } else {
      badge.style.display = "none";
      badge.textContent = "";
      btn.textContent = "Set Zone";
      btn.classList.add("zone-warning-button");
    }
  }

  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
  function money(n){ return Number(n || 0).toFixed(2); }
  function sizePrice(p, size){
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    const so = sizes.find(s=>s && s.available && s.size===size) || null;
    const n = so ? Number(so.price) : NaN;
    return Number.isFinite(n) ? n : null;
  }
  function bestPrice(p){
    const sizes = (Array.isArray(p.sizes) ? p.sizes : []).filter(s=>s && s.available);
    const pref = ['Trade Gallon','Gallon','3 Gallon'];
    sizes.sort((a,b)=>pref.indexOf(a.size)-pref.indexOf(b.size));
    for(const s of sizes){
      const n = Number(s.price);
      if(Number.isFinite(n)) return n;
    }
    return null;
  }

  function titleCaseWords(s){
    return String(s || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
  }

  function firstNonEmpty(){
    for(const v of arguments){
      if(v === 0) return v;
      if(v !== null && v !== undefined && String(v).trim() !== '') return v;
    }
    return '';
  }

  function bloomColorLabel(p){
    const a = p && p.attributes ? p.attributes : {};
    const raw = firstNonEmpty(a.bloom_color, a.bloom, a.flower_color);
    if(!raw) return '';
    const t = String(raw).toLowerCase();
    const colors = ['white','pink','red','purple','blue','yellow','orange','lavender','cream','burgundy'];
    for(const color of colors){
      if(t.includes(color)) return titleCaseWords(color);
    }
    return '';
  }

  function bloomOptions(products){
    const set = new Set();
    products.forEach(p=>{
      const c = bloomColorLabel(p);
      if(c) set.add(c);
    });
    return ['Any', ...Array.from(set).sort((a,b)=>a.localeCompare(b))];
  }

  function getCookie(name){
    try{
      const safe = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = document.cookie.match(new RegExp('(?:^|; )' + safe + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : "";
    }catch(e){ return ""; }
  }

  function getStoredValue(name){
    try{
      const v = (localStorage.getItem(name) || "").trim();
      if(v) return v;
    }catch(e){}
    try{
      const v = (sessionStorage.getItem(name) || "").trim();
      if(v) return v;
    }catch(e){}
    return (getCookie(name) || "").trim();
  }

  function getUserZone(){
    const z = getStoredValue("user_zone");
    const n = parseFloat(z);
    return Number.isFinite(n) ? n : null;
  }

  function getZoneRange(p){
    const attrs = p && p.attributes ? p.attributes : {};
    const min = attrs.zone_min != null ? Number(attrs.zone_min) : null;
    const max = attrs.zone_max != null ? Number(attrs.zone_max) : null;
    return {
      min: Number.isFinite(min) ? min : null,
      max: Number.isFinite(max) ? max : null
    };
  }

  function isZoneCompatible(p, userZoneNum){
    if(userZoneNum == null) return null;
    const r = getZoneRange(p);
    if(r.min == null || r.max == null) return null;
    return !(userZoneNum < r.min || userZoneNum > r.max);
  }

  function warnedKey(pid){
    return "warned_zone_" + String(pid || "");
  }

  function showZoneWarningOnce(p, size, onContinue){
    try{
      if(localStorage.getItem(warnedKey(p.id)) === "1"){
        onContinue();
        return;
      }
    }catch(e){}

    let banner = document.getElementById("zoneWarningBanner");
    if(!banner){
      banner = document.createElement("div");
      banner.id = "zoneWarningBanner";
      banner.style.position = "fixed";
      banner.style.left = "0";
      banner.style.right = "0";
      banner.style.bottom = "0";
      banner.style.zIndex = "9999";
      banner.style.padding = "12px 16px";
      banner.style.background = "#fff3cd";
      banner.style.borderTop = "1px solid #e0c97a";
      banner.style.boxShadow = "0 -2px 8px rgba(0,0,0,0.08)";
      banner.innerHTML = `
        <div class="container">
          <div style="display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
            <div>
              <strong>Zone warning:</strong> <span id="zoneWarningText"></span>
            </div>
            <div style="display:flex; gap:8px;">
              <button id="zoneWarnCancel" class="btn btn-default btn-sm">Cancel</button>
              <button id="zoneWarnContinue" class="btn btn-warning btn-sm">Add anyway</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(banner);
    }

    const txt = banner.querySelector("#zoneWarningText");
    txt.textContent = `${p.name} (${size}) is not recommended for your grow zone.`;

    const cleanup = () => { if(banner) banner.remove(); };

    banner.querySelector("#zoneWarnCancel").onclick = (e)=>{ e.preventDefault(); cleanup(); };
    banner.querySelector("#zoneWarnContinue").onclick = (e)=>{
      e.preventDefault();
      try{ localStorage.setItem(warnedKey(p.id), "1"); }catch(err){}
      cleanup();
      onContinue();
    };
  }

  const LOW_STOCK = 3;

  async function loadProducts(){
    if(window.PRODUCTS_DATA && Array.isArray(window.PRODUCTS_DATA.products)){
      return window.PRODUCTS_DATA.products || [];
    }
    const res = await fetch('data/products.json', {cache:'no-store'});
    if(!res.ok) throw new Error('Could not load data/products.json');
    const data = await res.json();
    return data.products || [];
  }

  function norm(s){ return String(s||'').toLowerCase(); }

  function parseSun(s){
    const t = norm(s);
    if(!t) return '';
    if(t.includes('full')) return 'Full Sun';
    if(t.includes('partial') || t.includes('part')) return 'Part Sun';
    if(t.includes('shade')) return 'Shade';
    return s;
  }

  function isTruthyFlag(s){
    const t = norm(s);
    if(!t) return false;
    if(t.includes('no')) return false;
    return t.includes('yes') || t.includes('true') || t.includes('y');
  }

  function setCookie(name, value, days){
    try{
      const maxAge = Math.max(1, Number(days || 365)) * 24 * 60 * 60;
      document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + "; path=/; max-age=" + maxAge + "; SameSite=Lax";
    }catch(e){}
  }

  function getCartRaw(){
    try{
      const v = localStorage.getItem('cart');
      if(v) return v;
    }catch(e){}
    try{
      const v = sessionStorage.getItem('cart');
      if(v) return v;
    }catch(e){}
    return getCookie('cart') || '[]';
  }

  function getCart(){
    try{ return JSON.parse(getCartRaw() || '[]'); }catch(_){ return []; }
  }

  function setCart(c){
    const raw = JSON.stringify(c || []);
    try{ localStorage.setItem('cart', raw); }catch(e){}
    try{ sessionStorage.setItem('cart', raw); }catch(e){}
    setCookie('cart', raw, 30);
  }

  function cartCount(){ return getCart().reduce((a,i)=>a+(Number(i.qty)||0),0); }

  function updateNavCartCount(){
    const el=document.getElementById('cartCount');
    if(el) el.textContent=String(cartCount());
  }

  const ADJ_KEY = 'inventoryAdjustments';

  function getAdjustments(){
    try{ return JSON.parse(localStorage.getItem(ADJ_KEY)||'{}'); }catch(_){ return {}; }
  }

  function soldQty(id,size){
    const a = getAdjustments();
    const v = Number(a[`${id}|${size}`] || 0);
    return Number.isFinite(v) ? v : 0;
  }

  function getSizeObj(p, size){
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    return sizes.find(s=>s && s.available && s.size===size) || null;
  }

  function remainingQty(p, size){
    const so = getSizeObj(p, size);
    if(!so) return 0;
    const inv = (so.inventory === '' || so.inventory === undefined) ? null : (so.inventory === null ? null : Number(so.inventory));
    if(inv === null || Number.isNaN(inv)) return null;
    const inCart = getCart()
      .filter(i=>i && i.id===p.id && i.size===size)
      .reduce((a,i)=>a+(Number(i.qty)||0),0);
    const sold = soldQty(p.id, size);
    return Math.max(0, inv - sold - inCart);
  }

  function addToCart(p, size, qtyRaw){
    const qty = Math.max(1, Math.floor(Number(qtyRaw)||1));
    const rem = remainingQty(p, size);
    if(rem !== null && qty > rem){
      return {ok:false, message:`Only ${rem} available for ${size}.`};
    }
    const cart = getCart();
    const idx = cart.findIndex(i=>i.id===p.id && i.size===size);
    const cur = idx>=0 ? (Number(cart[idx].qty)||0) : 0;
    const next = cur + qty;
    if(rem !== null && next > rem + cur){
      return {ok:false, message:`Only ${rem} available for ${size}.`};
    }
    if(idx>=0) cart[idx].qty = next;
    else cart.push({id:p.id, name:p.name, image:p.image, size, qty});
    setCart(cart);
    updateNavCartCount();
    return {ok:true};
  }

  function matchesText(p, q){
    if(!q) return true;
    q = q.toLowerCase();
    const hay = [
      p.name, p.category, p.short_description, p.description,
      p.tags ? (Array.isArray(p.tags)?p.tags.join(' '):String(p.tags)) : ''
    ].map(norm).join(' ');
    return hay.includes(q);
  }

  function matchesFilters(p, f){
    if(f.cat && f.cat!=='All' && p.category!==f.cat) return false;

    if(f.size && f.size!=='Any'){
      const rem = remainingQty(p, f.size);
      if(rem !== null && rem <= 0) return false;
      if(rem === 0) return false;
    }

    const sun = parseSun(p.sun || p.light || p.exposure || '');
    if(f.sun && f.sun!=='Any' && sun && sun!==f.sun) return false;

    const zone = String(p.zone || p.zones || '').trim();
    if(f.zone && f.zone!=='Any'){
      const want = String(f.zone);
      if(zone){
        if(!zone.includes(want)) return false;
      }else return false;
    }

    if(f.myZoneOnly){
      if(f.userZoneNum == null) return true;
      const compat = isZoneCompatible(p, f.userZoneNum);
      if(compat === false) return false;
    }

    const growth = String(p.growth || p.growth_rate || (p.attributes && p.attributes.growth_rate) || '').trim().toLowerCase();
    if(f.growth && f.growth!=='Any' && growth && growth!==String(f.growth).toLowerCase()) return false;

    const bloomColor = bloomColorLabel(p);
    if(f.bloomColor && f.bloomColor!=='Any' && bloomColor !== f.bloomColor) return false;

    if(f.deerOnly && !isTruthyFlag(p.deer_resistant || p.deer || '')) return false;
    if(f.nativeOnly && !isTruthyFlag(p.native || p.native_plant || '')) return false;

    return true;
  }

  function uniqCats(products){
    const s = new Set(products.map(p=>p.category).filter(Boolean));
    const preferred = ["Evergreen","Flowering Shrubs","Trees","Fruit and Nut Trees","Grasses and Perennials"];
    const rest = Array.from(s).filter(c=>!preferred.includes(c)).sort();
    return ['All', ...preferred.filter(c=>s.has(c)), ...rest];
  }

  function readPreset(){
    const u = new URL(window.location.href);
    return {
      q: u.searchParams.get('q') || '',
      category: u.searchParams.get('category') || '',
      size: u.searchParams.get('size') || ''
    };
  }

  function bestDefaultSize(p){
    const sizes = (Array.isArray(p.sizes) ? p.sizes : []).filter(s=>s && s.available);
    const pref = ['Trade Gallon','Gallon','3 Gallon'];
    for(const ps of pref){
      const hit = sizes.find(s=>s.size===ps);
      if(!hit) continue;
      const rem = remainingQty(p, ps);
      if(rem === null || rem > 0) return ps;
    }
    return sizes[0]?.size || '';
  }

  function availabilityRank(p){
    const sizes = (Array.isArray(p.sizes) ? p.sizes : []).filter(s=>s && s.available);
    if(!sizes.length) return 2;
    let hasAny = false;
    let hasPlenty = false;
    let hasLow = false;
    for(const s of sizes){
      const rem = remainingQty(p, s.size);
      if(rem === null){ hasAny=true; hasPlenty=true; continue; }
      if(rem > 0){ hasAny=true; if(rem <= LOW_STOCK) hasLow=true; else hasPlenty=true; }
    }
    if(hasPlenty) return 0;
    if(hasLow) return 1;
    if(!hasAny) return 2;
    return 2;
  }

  function renderSizes(p){
    const sizes = (Array.isArray(p.sizes) ? p.sizes : []).filter(s=>s);
    if(!sizes.length) return '<span class="small-muted">No sizes listed</span>';

    const pref = ['Trade Gallon','Gallon','3 Gallon'];
    sizes.sort((a,b)=>pref.indexOf(a.size)-pref.indexOf(b.size));

    return sizes.map(s=>{
      const baseCls = s.available ? 'badge-size' : 'badge-size unavailable';
      if(!s.available){
        return `<span class="${baseCls}">${esc(s.size)}</span>`;
      }
      const rem = remainingQty(p, s.size);
      if(rem === null){
        return `<span class="${baseCls} in-stock">${esc(s.size)} <span class="badge-note">In stock</span></span>`;
      }
      if(rem <= 0){
        return `<span class="${baseCls} soldout">${esc(s.size)} <span class="badge-note">SOLD OUT</span></span>`;
      }
      if(rem <= LOW_STOCK){
        return `<span class="${baseCls} low">${esc(s.size)} <span class="badge-note">Only ${rem}</span></span>`;
      }
      return `<span class="${baseCls} in-stock">${esc(s.size)} <span class="badge-note">${rem} avail</span></span>`;
    }).join(' ');
  }

  function render(products){
    updateNavCartCount();
    const f = {
      q: ($('#q').value || '').trim(),
      cat: $('#cat').value,
      size: $('#size').value,
      sun: $('#sun').value,
      zone: $('#zone').value,
      growth: $('#growth').value,
      bloomColor: $('#bloomColor') ? $('#bloomColor').value : 'Any',
      deerOnly: $('#deerOnly') ? $('#deerOnly').checked : false,
      nativeOnly: $('#nativeOnly') ? $('#nativeOnly').checked : false,
      myZoneOnly: $('#myZoneOnly') ? $('#myZoneOnly').checked : false,
      userZoneNum: getUserZone()
    };

    if($('#myZoneOnly')){
      const cb = $('#myZoneOnly');
      cb.disabled = (f.userZoneNum == null);
      if(f.userZoneNum == null) cb.checked = false;

      const ztxt = $('#myZoneText');
      const zlbl = $('#myZoneLabel');
      if(ztxt){
        ztxt.textContent = (f.userZoneNum == null) ? 'my zone' : ('Zone ' + f.userZoneNum);
      }
      if(zlbl){
        zlbl.title = (f.userZoneNum == null)
          ? 'Set your grow zone to enable this filter.'
          : ('Your stored grow zone is Zone ' + f.userZoneNum + '.');
      }

      if(typeof renderCurrentZoneBadge === 'function'){
        renderCurrentZoneBadge();
      }
    }

    let filtered = products
      .filter(p=>matchesText(p, f.q))
      .filter(p=>matchesFilters(p, f));

    filtered.sort((a,b)=>{
      const ra = availabilityRank(a);
      const rb = availabilityRank(b);
      if(ra !== rb) return ra - rb;
      return String(a.name||'').localeCompare(String(b.name||''));
    });

    $('#count').textContent = filtered.length.toString();
    const grid = $('#grid');

    grid.innerHTML = filtered.map(p=>{
      const pid = p.slug || p.id || '';
      const defaultSize = bestDefaultSize(p);
      const sizes = (Array.isArray(p.sizes)?p.sizes:[]).filter(s=>s && s.available);
      const pref = ['Trade Gallon','Gallon','3 Gallon'];
      sizes.sort((a,b)=>pref.indexOf(a.size)-pref.indexOf(b.size));
      const sizeOptions = sizes.map(s=>`<option value="${esc(s.size)}"${s.size===defaultSize?' selected':''}>${esc(s.size)}</option>`).join('');

      const rem = defaultSize ? remainingQty(p, defaultSize) : null;
      const soldOut = (rem !== null && rem <= 0);

      return `
      <div class="catalog-card" data-pid="${esc(pid)}">
        <a href="product.html?id=${encodeURIComponent(pid)}">
          <img src="${esc(p.image || 'images/images/logo_supersmall.jpg')}" alt="${esc(p.name || 'Plant')}">
        </a>
        <h4 style="margin:10px 0 6px 0;">${esc(p.name || '')}</h4>
        <div class="small-muted">${esc(p.category || '')}</div>
        <p style="margin-top:8px;">${esc(p.short_description || '')}</p>
        <div class="size-badges">${renderSizes(p)}</div>
        <div class="prod-price" style="margin-top:8px; font-weight:700; color:#245b2a;">${bestPrice(p)==null ? 'Call for price' : ('From $' + money(bestPrice(p)))}</div>

        <div style="margin-top:10px;">
          <div class="row" style="margin-left:-4px;margin-right:-4px;">
            <div class="col-xs-7" style="padding-left:4px;padding-right:4px;">
              <select class="form-control input-sm sizePick">${sizeOptions}</select>
            </div>
            <div class="col-xs-5" style="padding-left:4px;padding-right:4px;">
              <select class="form-control input-sm qtyPick">
                <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
                <option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option>
                <option value="11">11</option><option value="12">12</option><option value="13">13</option><option value="14">14</option><option value="15">15</option>
                <option value="16">16</option><option value="17">17</option><option value="18">18</option><option value="19">19</option><option value="20">20</option>
              </select>
            </div>
          </div>
          <div style="margin-top:6px;">
            <button class="btn btn-primary btn-sm addBtn"${soldOut ? ' disabled' : ''}>${soldOut ? 'SOLD OUT' : 'Add to cart'}</button>
            <a class="btn btn-default btn-sm" href="product.html?id=${encodeURIComponent(pid)}">View</a>
            <span class="small-muted pull-right cartBadge">Cart: ${cartCount()}</span>
          </div>
          <div class="small-muted invHint" style="margin-top:6px;"></div>
        </div>
      </div>
      `;
    }).join('') || '<p>No matching plants.</p>';

    const byId = new Map();
    products.forEach(p=>{
      if(p.id) byId.set(String(p.id), p);
      if(p.slug) byId.set(String(p.slug), p);
      if(p.legacy_id) byId.set(String(p.legacy_id), p);
      if(p.legacy_slug) byId.set(String(p.legacy_slug), p);
    });

    grid.querySelectorAll('.catalog-card').forEach(card=>{
      const pid = card.getAttribute('data-pid') || '';
      const p = byId.get(pid);
      if(!p) return;

      const sizeSel = card.querySelector('.sizePick');
      const qtyInp = card.querySelector('.qtyPick');
      const addBtn = card.querySelector('.addBtn');
      const hint = card.querySelector('.invHint');
      const badge = card.querySelector('.cartBadge');

      if(qtyInp && qtyInp.tagName === 'SELECT'){
        qtyInp.innerHTML = Array.from({length:20}, (_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
        qtyInp.value = '1';
      }

      function refresh(){
        const current = sizeSel.value;
        let rem = remainingQty(p, current);

        if(rem !== null && rem <= 0){
          const better = bestDefaultSize(p);
          if(better && better !== current){
            sizeSel.value = better;
            rem = remainingQty(p, better);
          }
        }

        const size = sizeSel.value;
        rem = remainingQty(p, size);

        const soldOut = (rem !== null && rem <= 0);
        addBtn.disabled = soldOut;
        addBtn.textContent = soldOut ? 'SOLD OUT' : 'Add to cart';

        if(rem === null){
          hint.textContent = '';
          hint.classList.remove('low-stock-text');
        }else if(rem <= 0){
          hint.textContent = `SOLD OUT for ${size}`;
          hint.classList.remove('low-stock-text');
        }else if(rem <= LOW_STOCK){
          hint.textContent = `Only ${rem} left for ${size}`;
          hint.classList.add('low-stock-text');
        }else{
          hint.textContent = `${rem} available for ${size}`;
          hint.classList.remove('low-stock-text');
        }

        badge.textContent = `Cart: ${cartCount()}`;
        updateNavCartCount();
      }

      sizeSel.addEventListener('change', refresh);

      addBtn.addEventListener('click', ()=>{
        const size = sizeSel.value;
        const qty = qtyInp ? qtyInp.value : 1;

        const doAdd = () => {
          const res = addToCart(p, size, qty);
          if(!res.ok){
            alert(res.message);
            return;
          }
          const badgeEl = card.querySelector('.cartBadge');
          if(badgeEl) badgeEl.textContent = `Cart: ${cartCount()}`;
          const sizeBadges = card.querySelector('.size-badges');
          if(sizeBadges) sizeBadges.innerHTML = renderSizes(p);
          refresh();
          updateNavCartCount();
        };

        const uz = getUserZone();
        const compat = isZoneCompatible(p, uz);
        if(compat === false){
          showZoneWarningOnce(p, size, doAdd);
        }else{
          doAdd();
        }
      });

      refresh();
    });
  }

  try{
    const products = await loadProducts();

    const cats = uniqCats(products);
    const sel = $('#cat');
    sel.innerHTML = cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');

    if($('#bloomColor')){
      const blooms = bloomOptions(products);
      $('#bloomColor').innerHTML = blooms.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    }

    const preset = readPreset();
    if(preset.q) $('#q').value = preset.q;
    if(preset.category) $('#cat').value = preset.category;
    if(preset.size) $('#size').value = preset.size;

    ['q','cat','size','sun','zone','growth','bloomColor','deerOnly','nativeOnly','myZoneOnly'].forEach(id=>{
      const el = $('#'+id);
      if(!el) return;
      el.addEventListener(el.type==='checkbox' ? 'change' : 'input', ()=>render(products));
      if(el.tagName==='SELECT') el.addEventListener('change', ()=>render(products));
    });

    if(typeof renderCurrentZoneBadge==='function') renderCurrentZoneBadge();

    const searchBtn = $('#searchBtn');
    if(searchBtn) searchBtn.addEventListener('click', ()=>render(products));

    const zoneBtn = $('#zoneSetBtn');
    if(zoneBtn){
      zoneBtn.addEventListener('click', (e)=>{
        e.preventDefault();

        const beforeZone = getUserZone();

        try{
          if(window.ZoneWidget && typeof window.ZoneWidget.openPopupWindow === 'function'){
            window.ZoneWidget.openPopupWindow();
          }else if(window.ZoneWidget && typeof window.ZoneWidget.open === 'function'){
            window.ZoneWidget.open();
          }
        }catch(_){}

        let checks = 0;
        const maxChecks = 20;
        const timer = setInterval(()=>{
          checks++;

          const afterZone = getUserZone();
          renderCurrentZoneBadge();
          render(products);

          if(afterZone !== beforeZone && afterZone != null){
            clearInterval(timer);
          }

          if(checks >= maxChecks){
            clearInterval(timer);
          }
        }, 500);
      });
    }

    $('#clear').addEventListener('click', ()=>{
      $('#q').value='';
      $('#cat').value='All';
      $('#size').value='Any';
      $('#sun').value='Any';
      $('#zone').value='Any';
      $('#growth').value='Any';
      if($('#bloomColor')) $('#bloomColor').value='Any';
      if($('#deerOnly')) $('#deerOnly').checked=false;
      if($('#nativeOnly')) $('#nativeOnly').checked=false;
      if($('#myZoneOnly')) $('#myZoneOnly').checked=false;
      render(products);
      if(typeof renderCurrentZoneBadge==='function') renderCurrentZoneBadge();
    });

    window.addEventListener('storage', (ev)=>{
      if(ev && (ev.key==='user_zone' || ev.key==='user_zip' || ev.key==='user_zone_text')){
        renderCurrentZoneBadge();
        render(products);
      }
    });

    window.addEventListener('zonechange', ()=>{
      renderCurrentZoneBadge();
      render(products);
    });

    window.addEventListener('focus', ()=>{
      try{
        renderCurrentZoneBadge();
        render(products);
      }catch(_){}
    });

    render(products);
  }catch(err){
    $('#grid').innerHTML = `<div class="alert alert-danger">${esc(err.message)}</div>`;
    console.error(err);
  }
})();