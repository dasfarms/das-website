(async function(){
  const $ = (sel, el=document) => el.querySelector(sel);

  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }

  const CART_KEY  = 'cart';
  const ADJ_KEY   = 'inventoryAdjustments'; // {"id|size": soldQty}
  const PAYPAL_BUSINESS = 'dasfarmstn@yahoo.com';
  const TN_COMBINED_SALES_TAX_RATE = 0.0975; // 9.75% Giles County/Pulaski, TN
  const STANDARD_SHIPPING_FEE = 15.95;
  const FREE_SHIPPING_THRESHOLD = 100.00;

  async function loadProducts(){
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
      const v = localStorage.getItem(CART_KEY);
      if(v) return v;
    }catch(e){}
    try{
      const v = sessionStorage.getItem(CART_KEY);
      if(v) return v;
    }catch(e){}
    return getCookie(CART_KEY) || '[]';
  }
  function getCart(){
    try{ return JSON.parse(getCartRaw() || '[]'); }catch(_){ return []; }
  }
  function setCart(c){
    const raw = JSON.stringify(c || []);
    try{ localStorage.setItem(CART_KEY, raw); }catch(e){}
    try{ sessionStorage.setItem(CART_KEY, raw); }catch(e){}
    setCookie(CART_KEY, raw, 30);
  }
  function cartCount(){ return getCart().reduce((a,i)=>a+(Number(i.qty)||0),0); }

  function getAdjustments(){
    try{ return JSON.parse(localStorage.getItem(ADJ_KEY)||'{}'); }catch(_){ return {}; }
  }
  function keyFor(id,size){ return `${id}|${size}`; }
  function soldQty(id,size){
    const a = getAdjustments();
    const v = Number(a[keyFor(id,size)] || 0);
    return Number.isFinite(v) ? v : 0;
  }

  function getSizeObj(p, size){
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    return sizes.find(s=>s && s.available && s.size===size) || null;
  }

  function sizePrice(p, size){
    const so = getSizeObj(p, size);
    const n = so ? Number(so.price) : NaN;
    return Number.isFinite(n) ? n : null;
  }

  function money(n){
    const x = Number(n || 0);
    return x.toFixed(2);
  }

  function calcSalesTax(subtotal){
    const tax = Number(subtotal || 0) * TN_COMBINED_SALES_TAX_RATE;
    return Math.round(tax * 100) / 100;
  }

  function calcShipping(subtotal){
    const sub = Number(subtotal || 0);
    if(sub >= FREE_SHIPPING_THRESHOLD) return 0;
    return STANDARD_SHIPPING_FEE;
  }

  function remainingQty(p, size, cart){
    const so = getSizeObj(p, size);
    if(!so) return 0;
    const inv = (so.inventory === '' || so.inventory === undefined) ? null : (so.inventory === null ? null : Number(so.inventory));
    if(inv === null || Number.isNaN(inv)) return null;
    const inCart = (cart||[]).filter(i=>i && i.id===p.id && i.size===size).reduce((a,i)=>a+(Number(i.qty)||0),0);
    const sold = soldQty(p.id, size);
    return Math.max(0, inv - sold - inCart);
  }

  function validateCart(products, cart){
    const byId = new Map(products.map(p=>[p.id,p]));
    const errors = [];
    const fixed = [];

    for(const item of cart){
      const p = byId.get(item.id);
      if(!p){ continue; }
      const so = getSizeObj(p, item.size);
      if(!so){ continue; }
      let qty = Math.max(1, Math.floor(Number(item.qty)||1));

      const inv = (so.inventory === '' || so.inventory === undefined) ? null : (so.inventory === null ? null : Number(so.inventory));
      if(inv !== null && !Number.isNaN(inv)){
        const sold = soldQty(p.id, item.size);
        const max = Math.max(0, inv - sold);
        if(max === 0){
          errors.push(`${p.name} (${item.size}) is SOLD OUT.`);
          continue;
        }
        if(qty > max){
          errors.push(`${p.name} (${item.size}) quantity reduced to ${max} (stock limit).`);
          qty = max;
        }
      }

      fixed.push({id:p.id, size:item.size, qty, name:p.name, image:p.image});
    }

    return {fixed, errors};
  }

  function calcTotal(products, cart){
    const byId = new Map(products.map(p=>[p.id,p]));
    let total = 0;
    let missingPrice = false;
    for(const item of cart){
      const p = byId.get(item.id);
      if(!p) continue;
      const price = sizePrice(p, item.size);
      if(price == null){ missingPrice = true; continue; }
      total += price * (Number(item.qty)||0);
    }
    return {total, missingPrice};
  }

  function render(products){
    const cartRaw = getCart();
    const cartCountEl = document.getElementById('cartCount');
    if(cartCountEl) cartCountEl.textContent = String(cartCount());

    const v = validateCart(products, cartRaw);
    if(JSON.stringify(v.fixed) !== JSON.stringify(cartRaw)) setCart(v.fixed);

    const cart = v.fixed;
    const empty = cart.length === 0;
    $('#cartEmpty').style.display = empty ? '' : 'none';
    $('#cartWrap').style.display = empty ? 'none' : '';

    const body = $('#cartBody');
    body.innerHTML = '';

    const byId = new Map(products.map(p=>[p.id,p]));

    for(const item of cart){
      const p = byId.get(item.id);
      if(!p) continue;

      const row = document.createElement('div');
      row.className = 'cart-mock-item';

      const img = p.image ? `<img src="${esc(p.image)}" class="cart-mock-thumb" alt="${esc(p.name)}">` : '';
      row.innerHTML = `
        <div class="cart-mock-item-top">
          <div class="cart-mock-media">${img}</div>
          <div class="cart-mock-maincol">
            <div class="cart-product-name cart-product-name-mock">${esc(p.name)}</div>
            <div class="cart-mock-meta"><a href="product.html?id=${encodeURIComponent(p.slug || p.id)}">View details</a></div>
            <div class="cart-mock-controls">
              <div class="cart-mock-control">
                <label class="cart-field-label">Size</label>
                <select class="form-control input-sm sizeSel"></select>
              </div>
              <div class="cart-mock-control cart-mock-qty">
                <label class="cart-field-label">Qty</label>
                <input class="form-control input-sm qtyInp" type="number" min="1" step="1" value="${esc(item.qty)}">
              </div>
            </div>
          </div>
          <div class="cart-mock-side">
            <div class="subtotalCell cart-subtotal cart-mock-subtotal"></div>
            <div class="priceCell cart-price cart-mock-price"></div>
            <div class="statusCell cart-status cart-mock-status"></div>
            <button class="btn btn-default btn-sm rmBtn cart-remove-btn">Remove</button>
          </div>
        </div>
      `;

      const sizeSel = $('.sizeSel', row);
      const qtyInp  = $('.qtyInp', row);
      const priceEl = $('.priceCell', row);
      const subEl   = $('.subtotalCell', row);
      const status  = $('.statusCell', row);

      const sizes = (Array.isArray(p.sizes)?p.sizes:[]).filter(s=>s && s.available);
      for(const s of sizes){
        const opt = document.createElement('option');
        opt.value = s.size;
        opt.textContent = s.size;
        sizeSel.appendChild(opt);
      }
      sizeSel.value = item.size;

      function refreshStatus(){
        const size = sizeSel.value;
        const so2 = getSizeObj(p, size);
        const price = sizePrice(p, size);
        const qty = Math.max(1, Math.floor(Number(qtyInp.value)||1));

        priceEl.textContent = (price == null) ? '' : ('$' + money(price) + ' each');
        subEl.textContent = (price == null) ? '—' : ('$' + money(price * qty));

        if(!so2){
          status.textContent = 'Not available';
          return;
        }
        const inv = (so2.inventory === '' || so2.inventory === undefined) ? null : (so2.inventory === null ? null : Number(so2.inventory));
        if(inv === null || Number.isNaN(inv)){
          status.textContent = 'In stock';
          return;
        }
        const sold = soldQty(p.id, size);
        const left = Math.max(0, inv - sold);
        if(left === 0){
          status.innerHTML = '<b>SOLD OUT</b>';
          return;
        }
        status.textContent = `${left} available`;
      }

      function persist(){
        const cartNow = getCart();
        const idx = cartNow.findIndex(i=>i.id===p.id && i.size===item.size);
        const newSize = sizeSel.value;
        const qtyRaw = qtyInp.value;

        if(idx>=0) cartNow.splice(idx,1);

        let qty = Math.max(1, Math.floor(Number(qtyRaw)||1));
        const so2 = getSizeObj(p, newSize);
        if(!so2){ setCart(cartNow); render(products); return; }
        const inv = (so2.inventory === '' || so2.inventory === undefined) ? null : (so2.inventory === null ? null : Number(so2.inventory));
        if(inv !== null && !Number.isNaN(inv)){
          const sold = soldQty(p.id, newSize);
          const max = Math.max(0, inv - sold);
          if(max === 0){ setCart(cartNow); render(products); return; }
          if(qty > max) qty = max;
        }

        const idx2 = cartNow.findIndex(i=>i.id===p.id && i.size===newSize);
        if(idx2>=0){
          const merged = Math.min((Number(cartNow[idx2].qty)||0)+qty, (inv===null||Number.isNaN(inv))?Infinity:Math.max(0,(inv - soldQty(p.id,newSize))));
          cartNow[idx2].qty = Number.isFinite(merged) ? merged : (Number(cartNow[idx2].qty)||0)+qty;
        }else{
          cartNow.push({id:p.id, size:newSize, qty, name:p.name, image:p.image});
        }

        setCart(cartNow);
        const cartCountEl = document.getElementById('cartCount');
        if(cartCountEl) cartCountEl.textContent = String(cartCount());
        render(products);
      }

      sizeSel.addEventListener('change', persist);
      qtyInp.addEventListener('change', persist);
      $('.rmBtn', row).addEventListener('click', ()=>{
        const cartNow = getCart().filter(i=>!(i.id===p.id && i.size===item.size));
        setCart(cartNow);
        const cartCountEl = document.getElementById('cartCount');
        if(cartCountEl) cartCountEl.textContent = String(cartCount());
        render(products);
      });

      refreshStatus();
      body.appendChild(row);
    }

    const totals = calcTotal(products, cart);
    const subtotal = Number(totals.total || 0);
    const tax = calcSalesTax(subtotal);
    const shipping = calcShipping(subtotal);
    const grandTotal = subtotal + tax + shipping;

    const totalEl = document.getElementById('cartTotal');
    const subtotalEl = document.getElementById('cartSubtotal');
    const taxEl = document.getElementById('cartTax');
    const shippingEl = document.getElementById('cartShipping');
    const shippingTextEl = document.getElementById('cartShippingText');
    const itemCountEl = document.getElementById('summaryItemCount');
    const itemCount = cart.reduce((a,i)=>a+(Number(i.qty)||0),0);
    if(totalEl) totalEl.textContent = money(grandTotal);
    if(subtotalEl) subtotalEl.textContent = money(subtotal);
    if(taxEl) taxEl.textContent = money(tax);
    if(shippingEl) shippingEl.textContent = money(shipping);
    if(shippingTextEl) shippingTextEl.textContent = shipping === 0 ? 'Free' : ('$' + money(shipping));
    if(itemCountEl) itemCountEl.textContent = String(itemCount);

    let msg = v.errors.length ? v.errors.join(' ') : '';
    if(totals.missingPrice){
      msg = (msg ? msg + ' ' : '') + 'One or more cart items are missing a PayPal price.';
    }
    $('#checkoutMsg').textContent = msg;
  }

  function submitToPayPal(products){
    const cart = validateCart(products, getCart()).fixed;
    const msgEl = $('#checkoutMsg');
    if(!cart.length){
      if(msgEl) msgEl.textContent = 'Your cart is empty.';
      return;
    }

    const byId = new Map(products.map(p=>[p.id,p]));
    const totals = calcTotal(products, cart);
    if(totals.missingPrice){
      if(msgEl) msgEl.textContent = 'One or more cart items are missing a PayPal price.';
      return;
    }
    const subtotal = Number(totals.total || 0);
    const tax = calcSalesTax(subtotal);
    const shipping = calcShipping(subtotal);

    const form = document.createElement('form');
    form.method = 'post';
    form.action = 'https://www.paypal.com/cgi-bin/webscr';
    form.target = 'paypal_checkout_popup';
    form.style.display = 'none';

    const add = (name, value) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = String(value ?? '');
      form.appendChild(input);
    };

    // PayPal cart upload
    add('cmd', '_cart');
    add('upload', '1');
    add('business', PAYPAL_BUSINESS);
    add('currency_code', 'USD');
    add('shopping_url', window.location.href);
    add('return', window.location.origin ? (window.location.origin + window.location.pathname.replace(/cart\.html?$/i, 'cart.html')) : 'cart.html');
    add('cancel_return', window.location.href);
    add('charset', 'utf-8');
    add('tax_cart', money(tax));
    add('handling_cart', money(shipping));

    cart.forEach((item, idx) => {
      const p = byId.get(item.id);
      if(!p) return;
      const price = sizePrice(p, item.size);
      if(price == null) return;

      const n = idx + 1;
      add(`item_name_${n}`, `${p.name} — ${item.size}`);
      add(`amount_${n}`, money(price));
      add(`quantity_${n}`, Math.max(1, Math.floor(Number(item.qty) || 1)));
      add(`item_number_${n}`, p.slug || p.id);
    });

    document.body.appendChild(form);

    const width = Math.min(980, Math.max(360, Math.floor(window.innerWidth * 0.92)));
    const height = Math.min(820, Math.max(620, Math.floor(window.innerHeight * 0.92)));
    const left = Math.max(0, Math.floor((window.screen.width - width) / 2));
    const top = Math.max(0, Math.floor((window.screen.height - height) / 2));
    const features = `popup=yes,toolbar=no,location=yes,status=yes,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},left=${left},top=${top}`;

    let popup = null;
    try{
      popup = window.open('', 'paypal_checkout_popup', features);
    }catch(e){
      popup = null;
    }

    if(!popup){
      form.target = '_blank';
      if(msgEl) msgEl.textContent = 'PayPal opened in a new tab. If you do not see it, please allow pop-ups for this site.';
      form.submit();
      form.remove();
      return;
    }

    try{
      popup.focus();
    }catch(e){}

    if(msgEl) msgEl.textContent = 'Opening PayPal in a secure checkout window…';
    form.submit();
    form.remove();
  }


  try{
    const products = await loadProducts();
    render(products);

    $('#checkoutBtn').addEventListener('click', ()=>{
      const btn = $('#checkoutBtn');
      const msg = $('#checkoutMsg');
      if(btn) btn.disabled = true;
      if(msg) msg.textContent = '';
      try{
        submitToPayPal(products);
      }catch(e){
        if(msg) msg.textContent = e.message || 'Could not send cart to PayPal.';
      }finally{
        // Re-enable shortly in case the user returns from a blocked popup/new tab flow.
        setTimeout(()=>{
          const b = $('#checkoutBtn');
          if(b) b.disabled = false;
        }, 1200);
      }
    });
  }catch(e){
    $('#checkoutMsg').textContent = e.message || 'Failed to load cart.';
    $('#cartWrap').style.display = 'none';
    $('#cartEmpty').style.display = '';
  }

})();