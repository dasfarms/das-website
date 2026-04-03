(async function(){
  const $ = (sel, el=document) => el.querySelector(sel);

  let lastRenderKey = '';

  function debounce(fn, wait){
    let t;
    return function(...args){
      clearTimeout(t);
      t = setTimeout(()=>fn.apply(this,args), wait);
    };
  }

  function renderCurrentZoneBadge(){
    const badge = $('#currentZoneBadge');
    const btn = $('#zoneSetBtn');
    if(!badge || !btn) return;

    let z = getUserZone();
    if(z == null){
      try{
        z = (window.ZoneWidget && ZoneWidget.get) ? ZoneWidget.get() : null;
      }catch(e){}
    }

    if(z != null){
      badge.style.display = "inline-block";
      badge.textContent = "Zone " + z;
      btn.textContent = "Change Zone";
      btn.classList.remove("zone-warning-button");
    } else {
      badge.style.display = "none";
      btn.textContent = "Set Zone";
      btn.classList.add("zone-warning-button");
    }
  }

  function getUserZone(){
    try{
      const z = localStorage.getItem("user_zone");
      return z ? Number(z) : null;
    }catch{ return null; }
  }

  async function loadProducts(){
    const res = await fetch('data/products.json');
    const data = await res.json();
    return data.products || [];
  }

  function render(products){
    const f = {
      q: ($('#q').value || '').toLowerCase(),
      cat: $('#cat').value,
      size: $('#size').value,
      sun: $('#sun').value,
      zone: $('#zone').value,
      growth: $('#growth').value,
      userZoneNum: getUserZone()
    };

    const renderKey = JSON.stringify(f);
    if(renderKey === lastRenderKey){
      renderCurrentZoneBadge();
      return;
    }
    lastRenderKey = renderKey;

    renderCurrentZoneBadge();

    let filtered = products.filter(p=>{
      if(f.q && !p.name.toLowerCase().includes(f.q)) return false;
      if(f.cat !== 'All' && p.category !== f.cat) return false;
      return true;
    });

    $('#count').textContent = filtered.length;

    $('#grid').innerHTML = filtered.map(p=>`
      <div class="catalog-card">
        <img src="${p.image}">
        <h4>${p.name}</h4>
        <p>$${p.price || '0.00'}</p>
      </div>
    `).join('');
  }

  try{
    const products = await loadProducts();

    ['q','cat','size','sun','zone','growth'].forEach(id=>{
      const el = $('#'+id);
      if(!el) return;

      if(id === 'q'){
        el.addEventListener('input', debounce(()=>render(products), 200));
      } else {
        el.addEventListener('change', ()=>render(products));
      }
    });

    $('#searchBtn').addEventListener('click', ()=>render(products));

    $('#clear').addEventListener('click', ()=>{
      $('#q').value='';
      $('#cat').value='All';
      render(products);
    });

    const zoneBtn = $('#zoneSetBtn');
    if(zoneBtn){
      zoneBtn.addEventListener('click', ()=>{
        const before = getUserZone();

        if(window.ZoneWidget?.openPopupWindow){
          ZoneWidget.openPopupWindow();
        } else if(window.ZoneWidget?.open){
          ZoneWidget.open();
        }

        let checks = 0;
        const timer = setInterval(()=>{
          const after = getUserZone();
          renderCurrentZoneBadge();

          if(after !== before && after != null){
            render(products);
            clearInterval(timer);
          }

          if(++checks > 20) clearInterval(timer);
        }, 500);
      });
    }

    window.addEventListener('storage', ()=>renderCurrentZoneBadge());
    window.addEventListener('focus', ()=>renderCurrentZoneBadge());

    render(products);

  }catch(err){
    console.error(err);
  }
})();