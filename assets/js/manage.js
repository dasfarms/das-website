(function(){
  const $ = (sel, el=document) => el.querySelector(sel);
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }

  const SIZE_OPTIONS = ["Trade Gallon","Gallon","3 Gallon"];
  const CATEGORY_OPTIONS = ["Evergreen","Flowering Shrubs","Trees","Fruit and Nut Trees","Grasses and Perennials"];

  let data = { updated: new Date().toISOString().slice(0,10), products: [] };

  async function load(){
    try{
      if(window.PRODUCTS_DATA && Array.isArray(window.PRODUCTS_DATA.products)){
        data = window.PRODUCTS_DATA;
      }else{
        const res = await fetch('data/products.json', {cache:'no-store'});
        if(res.ok) data = await res.json();
      }
    }catch(e){}
    if(!Array.isArray(data.products)) data.products = [];
    $('#updated').textContent = data.updated || '';
    // fill category datalist (if present)
    const dl = $('#catOptions');
    if(dl){
      dl.innerHTML = CATEGORY_OPTIONS.map(c=>`<option value="${esc(c)}"></option>`).join('');
    }
    renderList();
  }

  function slugify(str){
    return String(str||'')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/(^-|-$)/g,'')
      .slice(0,80) || 'item';
  }

  function readAttrsFromForm(){
    const n = (v)=> {
      const x = parseFloat(v);
      return Number.isFinite(x) ? x : null;
    };
    const i = (v)=>{
      const x = parseInt(v,10);
      return Number.isFinite(x) ? x : null;
    };
    return {
      zone_min: i($('#f_zone_min').value),
      zone_max: i($('#f_zone_max').value),
      sun: ($('#f_sun').value||'').trim() || null,
      mature_height_ft_min: n($('#f_hmin').value),
      mature_height_ft_max: n($('#f_hmax').value),
      spread_ft: n($('#f_spread').value),
      growth_rate: ($('#f_growth').value||'').trim() || null,
      bloom: ($('#f_bloom').value||'').trim() || null,
      deer_resistant: $('#f_deer').checked ? 'Yes' : null,
      native: $('#f_native').checked ? 'Yes' : null,
      form: ($('#f_form').value||'').trim() || null
    };
  }

  function writeAttrsToForm(a){
    a = a || {};
    $('#f_zone_min').value = (a.zone_min ?? '');
    $('#f_zone_max').value = (a.zone_max ?? '');
    $('#f_sun').value = (a.sun ?? '');
    $('#f_hmin').value = (a.mature_height_ft_min ?? '');
    $('#f_hmax').value = (a.mature_height_ft_max ?? '');
    $('#f_spread').value = (a.spread_ft ?? '');
    $('#f_growth').value = (a.growth_rate ?? '');
    $('#f_bloom').value = (a.bloom ?? '');
    $('#f_deer').checked = String(a.deer_resistant||'').toLowerCase().includes('yes') || String(a.deer_resistant||'').toLowerCase().includes('resistant');
    $('#f_native').checked = String(a.native||'').toLowerCase().includes('yes') || String(a.native||'').toLowerCase().includes('native');
    $('#f_form').value = (a.form ?? '');
  }

  function renderList(){
    const q = ($('#q').value||'').trim().toLowerCase();
    const items = data.products
      .filter(p=>{
        if(!q) return true;
        const hay = [
          p.name,p.category,p.short_description,p.description,
          (p.tags||[]).join(' '),
          JSON.stringify(p.attributes||{})
        ].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));

    $('#count').textContent = String(items.length);
    $('#list').innerHTML = items.map(p=>`
      <tr>
        <td><strong>${esc(p.name||'')}</strong><div class="small-muted">${esc(p.id||'')}</div></td>
        <td>${esc(p.category||'')}</td>
        <td>${(p.sizes||[]).filter(s=>s.available).map(s=>`<span class="badge-size">${esc(s.size)}</span>`).join(' ') || '<span class="small-muted">—</span>'}</td>
        <td>
          <button class="btn btn-default btn-xs" data-act="edit" data-id="${esc(p.id)}">Edit</button>
          <button class="btn btn-danger btn-xs" data-act="del" data-id="${esc(p.id)}">Delete</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="4" class="small-muted">No products yet.</td></tr>`;
    renderInvTable();

  }

  function fillForm(p){
    $('#f_id').value = p.id || '';
    $('#f_name').value = p.name || '';
    $('#f_category').value = p.category || '';
    $('#f_short').value = p.short_description || '';
    $('#f_desc').value = p.description || '';
    $('#f_image').value = p.image || '';
    $('#f_tags').value = Array.isArray(p.tags)? p.tags.join(', ') : '';

    const sizes = Array.isArray(p.sizes)? p.sizes : [];
    SIZE_OPTIONS.forEach(sz=>{
      const rec = sizes.find(x=>x.size===sz);
      $(`#sz_${sz.replace(/\s+/g,'_')}`).checked = !!(rec && rec.available);
      const invEl = document.getElementById(`inv_${sz.replace(/\s+/g,'_')}`);
      if(invEl){
        const inv = rec ? rec.inventory : null;
        invEl.value = (inv === null || inv === undefined || inv === '') ? '' : String(inv);
      }
    });

    writeAttrsToForm(p.attributes || {});
    $('#formTitle').textContent = p.id ? 'Edit plant' : 'Add plant';
  }

  function clearForm(){
    fillForm({ sizes: SIZE_OPTIONS.map(sz=>({size:sz, available:false, inventory:null})), attributes:{} });
    $('#f_id').value = '';
  }

  function upsertFromForm(){
    const existingId = $('#f_id').value.trim();
    const name = $('#f_name').value.trim();
    if(!name){
      alert('Name is required.');
      return;
    }

    const category = $('#f_category').value.trim();
    const short_description = $('#f_short').value.trim();
    const description = $('#f_desc').value.trim();
    const image = $('#f_image').value.trim();
    const tags = $('#f_tags').value.split(',').map(t=>t.trim()).filter(Boolean);
    const attributes = readAttrsFromForm();

    const sizes = SIZE_OPTIONS.map(sz => {
      const invEl = document.getElementById(`inv_${sz.replace(/\s+/g,'_')}`);
      const raw = invEl ? String(invEl.value||'').trim() : '';
      let inventory = null;
      if(raw !== ''){
        const n = parseInt(raw, 10);
        inventory = (Number.isFinite(n) && n >= 0) ? n : null;
      }
      return {
        size: sz,
        available: $(`#sz_${sz.replace(/\s+/g,'_')}`).checked,
        inventory
      };
    });

    if(existingId){
      const idx = data.products.findIndex(p=>p.id===existingId);
      if(idx>=0){
        const slug = slugify(name);
        data.products[idx] = { ...data.products[idx], name, slug, category, short_description, description, image, tags, sizes, attributes };
      }
    }else{
      const slug = slugify(name);
      const id = slug + '-' + Math.random().toString(16).slice(2,8);
      data.products.push({ id, name, slug, category, short_description, description, image, gallery:[], sizes, tags, attributes });
    }

    data.updated = new Date().toISOString().slice(0,10);
    $('#updated').textContent = data.updated;
    renderList();
    clearForm();
  }

  function deleteById(id){
    if(!confirm('Delete this plant?')) return;
    data.products = data.products.filter(p=>p.id!==id);
    data.updated = new Date().toISOString().slice(0,10);
    $('#updated').textContent = data.updated;
    renderList();
    clearForm();
  }

  function downloadJSON(){
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'products.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }

  function importJSON(file){
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const obj = JSON.parse(reader.result);
        if(!obj || !Array.isArray(obj.products)) throw new Error('Invalid file format.');
        data = obj;
        if(!data.updated) data.updated = new Date().toISOString().slice(0,10);
        $('#updated').textContent = data.updated;
        renderList();
        clearForm();
      }catch(e){
        alert('Could not import: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  

  function getInv(p, size){
    const s = (p.sizes||[]).find(x=>x && x.size===size);
    if(!s || !s.available) return '';
    if(s.inventory === null || s.inventory === undefined || s.inventory === '') return '';
    return String(s.inventory);
  }

  function setInv(p, size, val){
    let s = (p.sizes||[]).find(x=>x && x.size===size);
    if(!s){
      if(!Array.isArray(p.sizes)) p.sizes = [];
      s = { size, available:true, inventory:null };
      p.sizes.push(s);
    }
    if(val === '' || val === null || val === undefined){
      s.inventory = null;
      return;
    }
    const n = Math.max(0, Math.floor(Number(val)));
    s.inventory = Number.isFinite(n) ? n : null;
  }

  function renderInvTable(){
    const table = $('#invTable');
    if(!table) return;
    const tbody = table.querySelector('tbody');
    if(!tbody) return;

    const q = ($('#invSearch')?.value || '').trim().toLowerCase();
    const items = (data.products||[])
      .filter(p=>{
        if(!q) return true;
        const hay = [p.name,p.category,p.id].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));

    tbody.innerHTML = items.map(p=>`
      <tr data-id="${esc(p.id||'')}">
        <td><strong>${esc(p.name||'')}</strong><div class="small-muted">${esc(p.id||'')}</div></td>
        <td>${esc(p.category||'')}</td>
        <td><input class="form-control input-sm invCell" data-size="Trade Gallon" type="number" min="0" step="1" placeholder="∞" value="${esc(getInv(p,'Trade Gallon'))}"></td>
        <td><input class="form-control input-sm invCell" data-size="Gallon" type="number" min="0" step="1" placeholder="∞" value="${esc(getInv(p,'Gallon'))}"></td>
        <td><input class="form-control input-sm invCell" data-size="3 Gallon" type="number" min="0" step="1" placeholder="∞" value="${esc(getInv(p,'3 Gallon'))}"></td>
      </tr>
    `).join('') || `<tr><td colspan="5" class="small-muted">No products yet.</td></tr>`;
  }

  function applyInvTable(){
    const table = $('#invTable');
    if(!table) return;
    table.querySelectorAll('tbody tr[data-id]').forEach(tr=>{
      const id = tr.getAttribute('data-id');
      const p = (data.products||[]).find(x=>x.id===id);
      if(!p) return;
      tr.querySelectorAll('input.invCell').forEach(inp=>{
        const size = inp.getAttribute('data-size');
        const val = inp.value.trim();
        setInv(p, size, val);
      });
    });
    data.updated = new Date().toISOString().slice(0,10);
    $('#updated').textContent = data.updated;
    renderList(); // also refreshes inv table
  }

// Wire up
  $('#save').addEventListener('click', upsertFromForm);
  $('#new').addEventListener('click', clearForm);
  $('#export').addEventListener('click', downloadJSON);
  $('#q').addEventListener('input', renderList);
  const invS = $('#invSearch');
  if(invS) invS.addEventListener('input', renderInvTable);
  const applyInvBtn = $('#applyInv');
  if(applyInvBtn) applyInvBtn.addEventListener('click', applyInvTable);


  $('#importFile').addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if(f) importJSON(f);
    e.target.value = '';
  });

  $('#list').addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-act]');
    if(!btn) return;
    const id = btn.getAttribute('data-id');
    const act = btn.getAttribute('data-act');
    if(act==='del') return deleteById(id);
    if(act==='edit'){
      const p = data.products.find(x=>x.id===id);
      if(p) fillForm(p);
    }
  });

  // init
  load();
  clearForm();


  function normalizeInv(v){
    if(v === '' || v === undefined) return null;
    if(v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
  }

  function applyOrderToProducts(order, products){
    if(!order || !Array.isArray(order.items)) throw new Error('Invalid order JSON.');
    const byId = new Map(products.map(p=>[p.id,p]));
    for(const it of order.items){
      const p = byId.get(it.id);
      if(!p) continue;
      const size = it.size;
      const qty = Math.max(0, Math.floor(Number(it.qty)||0));
      if(qty<=0) continue;
      if(!Array.isArray(p.sizes)) continue;
      const s = p.sizes.find(x=>x && x.size===size);
      if(!s) continue;
      const inv = normalizeInv(s.inventory);
      if(inv === null){
        // unlimited inventory: do nothing
        continue;
      }
      s.inventory = Math.max(0, inv - qty);
    }
    return products;
  }


  const applyBtn = document.getElementById('applyOrderBtn');
  if(applyBtn){
    applyBtn.addEventListener('click', ()=>{
      const msgEl = document.getElementById('orderImportMsg');
      try{
        const txt = (document.getElementById('orderImport')||{}).value || '';
        const order = JSON.parse(txt);
        data.products = applyOrderToProducts(order, data.products);
        renderList();
        msgEl.textContent = 'Applied. Now click Export to save products.json.';
        setTimeout(()=>{ msgEl.textContent=''; }, 4000);
      }catch(e){
        msgEl.textContent = e.message || 'Could not apply order.';
        setTimeout(()=>{ msgEl.textContent=''; }, 5000);
      }
    });
  }

})();