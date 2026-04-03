(async function(){
  const $ = (sel, el=document) => el.querySelector(sel);

  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
  function money(n){ return Number(n || 0).toFixed(2); }
  function sizePrice(p, size){
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    const so = sizes.find(s=>s && s.available && s.size===size) || null;
    const n = so ? Number(so.price) : NaN;
    return Number.isFinite(n) ? n : null;
  }

  function firstNonEmpty(){
    for(const v of arguments){
      if(v === 0) return v;
      if(v !== null && v !== undefined && String(v).trim() !== '') return v;
    }
    return '';
  }

  function titleCaseWords(s){
    return String(s || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
  }

  function sunlightLabel(p){
    const a = p && p.attributes ? p.attributes : {};
    const raw = firstNonEmpty(a.sunlight, a.sun, a.light, a.exposure);
    if(!raw) return '';
    const t = String(raw).toLowerCase();
    if(t.includes('full') && (t.includes('part') || t.includes('partial')) && t.includes('shade')) return 'Full Sun to Partial Shade';
    if(t.includes('full') && (t.includes('part') || t.includes('partial'))) return 'Full Sun to Partial Shade';
    if(t.includes('part') || t.includes('partial')) return t.includes('shade') ? 'Partial Shade' : 'Part Sun / Partial Shade';
    if(t.includes('full')) return 'Full Sun';
    if(t.includes('shade')) return 'Shade';
    return titleCaseWords(raw);
  }

  function growthRateLabel(p){
    const a = p && p.attributes ? p.attributes : {};
    const raw = firstNonEmpty(a.growth_rate, a.growth);
    if(!raw) return '';
    const t = String(raw).toLowerCase().trim();
    if(t === 'fast') return 'Fast';
    if(t === 'medium' || t === 'moderate') return 'Moderate';
    if(t === 'slow') return 'Slow';
    return titleCaseWords(raw);
  }

  function matureSizeLabel(p){
    const a = p && p.attributes ? p.attributes : {};

    function cleanNum(v){
      const n = Number(v);
      return (Number.isFinite(n) && n > 0) ? n : null;
    }

    const hmin = cleanNum(a.mature_height_ft_min);
    const hmax = cleanNum(a.mature_height_ft_max);
    const spread = cleanNum(a.spread_ft || a.mature_width_ft || a.mature_width);

    let parts = [];
    if(hmin !== null || hmax !== null){
      if(hmin !== null && hmax !== null){
        parts.push((hmin === hmax ? hmax : (hmin + '–' + hmax)) + ' ft tall');
      }else{
        parts.push(((hmax !== null ? hmax : hmin)) + ' ft tall');
      }
    }
    if(spread !== null) parts.push(spread + ' ft wide');
    return parts.join(', ');
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

  function renderPlantCharacteristics(p){
    const el = document.getElementById('plantCharacteristics');
    if(!el) return;
    const a = p && p.attributes ? p.attributes : {};
    const items = [];
    const sun = sunlightLabel(p);
    const growth = growthRateLabel(p);
    const size = matureSizeLabel(p);
    const bloomColor = bloomColorLabel(p);
    const zmin = Number(a.zone_min);
    const zmax = Number(a.zone_max);

    if(sun) items.push('<li><span class="pc-icon">☀️</span><b>Sun Preference:</b> ' + esc(sun) + '</li>');
    if(growth) items.push('<li><span class="pc-icon">🌱</span><b>Growth Rate:</b> ' + esc(growth) + '</li>');
    if(size) items.push('<li><span class="pc-icon">📏</span><b>Size at Maturity:</b> ' + esc(size) + '</li>');
    if(Number.isFinite(zmin) || Number.isFinite(zmax)){
      const zoneText = Number.isFinite(zmin) && Number.isFinite(zmax) ? (zmin + '–' + zmax) : String(Number.isFinite(zmin) ? zmin : zmax);
      items.push('<li><span class="pc-icon">🗺️</span><b>Grow Zones Preferred:</b> ' + esc(zoneText) + '</li>');
    }
    if(bloomColor) items.push('<li><span class="pc-icon">🌸</span><b>Bloom Color:</b> ' + esc(bloomColor) + '</li>');

    const uz = getUserZone();
    let zoneLine = '';
    if(uz != null){
      const compat = isZoneCompatible(p, uz);
      let extra = '';
      if(compat === false) extra = '<span class="zone-bad">NOT recommended</span>';
      else if(compat === true) extra = '<span class="zone-good">Recommended</span>';
      zoneLine = '<div class="your-zone-line"><b>Your Grow Zone:</b> ' + esc(String(uz)) + extra + '</div>';
    }

    el.innerHTML = '<h3 class="plant-characteristics-title">Plant Characteristics</h3>' +
      '<ul class="plant-characteristics-list">' + (items.length ? items.join('') : '<li><span class="pc-icon">🌿</span>Details coming soon.</li>') + '</ul>' +
      zoneLine;
  }

  function renderGallery(p){
    const main = document.getElementById('img');
    const thumbs = document.getElementById('galleryThumbs');
    if(!main || !thumbs) return;

    const imgs = (Array.isArray(p.gallery) && p.gallery.length ? p.gallery : [p.image]).filter(Boolean);
    if(!imgs.length) return;

    let active = 0;
    function setActive(i){
      active = i;
      main.src = imgs[i];
      thumbs.querySelectorAll('.product-gallery-thumb').forEach((el, idx)=>{
        if(idx === i) el.classList.add('active');
        else el.classList.remove('active');
      });
    }

    main.src = imgs[0];
    main.alt = p.name || 'Product';
    thumbs.innerHTML = imgs.map((src, i)=>(
      '<img src="' + esc(src) + '" alt="' + esc((p.name || 'Product') + ' image ' + (i+1)) + '" class="product-gallery-thumb' + (i===0 ? ' active' : '') + '" data-index="' + i + '">'
    )).join('');

    thumbs.querySelectorAll('.product-gallery-thumb').forEach(el=>{
      const go = ()=> setActive(Number(el.getAttribute('data-index')) || 0);
      el.addEventListener('click', go);
      el.addEventListener('mouseenter', go);
    });
  }
  const LOW_STOCK = 3;

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

  function getId(){
    const u = new URL(window.location.href);
    return u.searchParams.get('id') || '';
  }

  async function loadProducts(){
    // Prefer embedded data so product pages work when opened locally via file://
    if(window.PRODUCTS_DATA && Array.isArray(window.PRODUCTS_DATA.products)){
      return window.PRODUCTS_DATA.products || [];
    }
    const res = await fetch('data/products.json', {cache:'no-store'});
    if(!res.ok) throw new Error('Could not load data/products.json');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.products || []);
  }

  function getCookie(name){
    try{
      const safe = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = document.cookie.match(new RegExp('(?:^|; )' + safe + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : "";
    }catch(e){ return ""; }
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
  function updateNavCartCount(){ const el=document.getElementById('cartCount'); if(el) el.textContent=String(cartCount()); }
  function flashAdded(msg){
    let el = document.getElementById('cartFlash');
    if(!el){
      el = document.createElement('div');
      el.id = 'cartFlash';
      el.className = 'alert alert-success';
      el.style.marginTop = '10px';
      const holder = document.getElementById('invHint') && document.getElementById('invHint').parentNode;
      if(holder && holder.parentNode){ holder.parentNode.insertBefore(el, holder.nextSibling); }
    }
    if(el){ el.textContent = msg; setTimeout(()=>{ if(el) el.textContent=''; }, 2500); }
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
    return Math.max(0, inv - inCart);
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

  function renderSizeBadges(p){
    const sizes = (Array.isArray(p.sizes) ? p.sizes : []).filter(s=>s);
    if(!sizes.length) return '';
    const pref = ['Trade Gallon','Gallon','3 Gallon'];
    sizes.sort((a,b)=>pref.indexOf(a.size)-pref.indexOf(b.size));
    return sizes.map(s=>{
      const baseCls = s.available ? 'badge-size' : 'badge-size unavailable';
      if(!s.available) return `<span class="${baseCls}">${esc(s.size)}</span>`;
      const rem = remainingQty(p, s.size);
      if(rem === null) return `<span class="${baseCls} in-stock">${esc(s.size)} <span class="badge-note">In stock</span></span>`;
      if(rem <= 0) return `<span class="${baseCls} soldout">${esc(s.size)} <span class="badge-note">SOLD OUT</span></span>`;
      if(rem <= LOW_STOCK) return `<span class="${baseCls} low">${esc(s.size)} <span class="badge-note">Only ${rem}</span></span>`;
      return `<span class="${baseCls} in-stock">${esc(s.size)} <span class="badge-note">${rem} avail</span></span>`;
    }).join(' ');
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

  function setHint(hint, rem, size){
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
  }

  try{
    const id = getId();
    const products = await loadProducts();
    const p = products.find(x => String(x.slug||'')===String(id) || String(x.id||'')===String(id) || String(x.legacy_id||'')===String(id) || String(x.legacy_slug||'')===String(id));

    if(!p){
      $('#content').innerHTML = `<div class="alert alert-warning">Product not found.</div>`;
      return;
    }

    // inform zone widget of this plant's zone range (for red/green display)
    try{
      const zr = getZoneRange(p);
      if(window.ZoneWidget && typeof window.ZoneWidget.setPlantRange === 'function'){
        window.ZoneWidget.setPlantRange(zr.min, zr.max);
      }
    }catch(e){}

    // basic fields
    $('#name').textContent = p.name || '';
    $('#cat').textContent = p.category || '';
    $('#img').src = p.image || 'images/images/logo_supersmall.jpg';
    $('#img').alt = p.name || 'Plant';
    renderGallery(p);
    renderPlantCharacteristics(p);
    $('#desc').textContent = p.description || p.short_description || '';
    const tagsHeader = Array.from(document.querySelectorAll('h4')).find(el => (el.textContent || '').trim().toLowerCase() === 'tags');
    if(tagsHeader) tagsHeader.style.display = 'none';
    const tagsBox = document.getElementById('tags');
    if(tagsBox) tagsBox.style.display = 'none';

    // characteristics table if present
    if(p.characteristics && typeof p.characteristics === 'object'){
      const rows = Object.entries(p.characteristics).map(([k,v])=>{
        if(v===null || v===undefined || String(v).trim()==='') return '';
        return `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
      }).filter(Boolean).join('');
      if(rows) $('#chars').innerHTML = `<table class="table table-striped"><tbody>${rows}</tbody></table>`;
    }

    // sizes
    const sizesAvail = (Array.isArray(p.sizes)?p.sizes:[]).filter(s=>s && s.available);
    const pref = ['Trade Gallon','Gallon','3 Gallon'];
    sizesAvail.sort((a,b)=>pref.indexOf(a.size)-pref.indexOf(b.size));
    const sizeSel = $('#sizePick');
    sizeSel.innerHTML = sizesAvail.map(s=>`<option value="${esc(s.size)}">${esc(s.size)}</option>`).join('');

    const badges = $('#sizeBadges');
    const hint = $('#invHint');
    const addBtn = $('#addBtn');
    const qtyInp = $('#qtyPick');

    // Quantity dropdown (1–20)
    if(qtyInp && qtyInp.tagName === 'SELECT'){
      qtyInp.innerHTML = Array.from({length:20}, (_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
      qtyInp.value = '1';
    }

    function refresh(){
      // ensure current size is in stock if possible
      let size = sizeSel.value;
      let rem = remainingQty(p, size);

      if(rem !== null && rem <= 0){
        const better = bestDefaultSize(p);
        if(better && better !== size){
          sizeSel.value = better;
          size = better;
          rem = remainingQty(p, size);
        }
      }

      size = sizeSel.value;
      rem = remainingQty(p, size);

      const soldOut = (rem !== null && rem <= 0);
      const priceEl = document.getElementById('priceText');
      if(priceEl){
        const price = sizePrice(p, size);
        priceEl.textContent = (price == null) ? '' : ('$' + money(price));
      }
      addBtn.disabled = soldOut;
      addBtn.textContent = soldOut ? 'SOLD OUT' : 'Add to cart';

      badges.innerHTML = renderSizeBadges(p);
      setHint(hint, rem, size);
    }

    // set default size to first in-stock
    const def = bestDefaultSize(p);
    if(def) sizeSel.value = def;

    sizeSel.addEventListener('change', refresh);

    addBtn.addEventListener('click', ()=>{
      const size = sizeSel.value;
      const qty = qtyInp ? qtyInp.value : 1;

      const doAdd = () => {
        const res = addToCart(p, size, qty);
        if(!res.ok) alert(res.message);
        else flashAdded('Added to cart. Review your cart before checkout.');
        updateNavCartCount();
    refresh();
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
  }catch(err){
    $('#content').innerHTML = `<div class="alert alert-danger">${esc(err.message)}</div>`;
    console.error(err);
  }
})();