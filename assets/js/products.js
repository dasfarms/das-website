(async function(){
  const $ = (sel, el=document) => el.querySelector(sel);

  function renderCurrentZoneBadge(){
    const badge = $('#currentZoneBadge');
    const btn = $('#zoneSetBtn');

    if(!badge || !btn) return;

    let z = null;
    try{
      z = (window.ZoneWidget && ZoneWidget.get) ? ZoneWidget.get() : null;
    }catch(e){
      z = null;
    }

    const hasZone = (z || z === 0);

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

  async function loadProducts(){
    if(window.PRODUCTS_DATA && Array.isArray(window.PRODUCTS_DATA.products)){
      return window.PRODUCTS_DATA.products || [];
    }
    const res = await fetch('data/products.json', {cache:'no-store'});
    if(!res.ok) throw new Error('Could not load data/products.json');
    const data = await res.json();
    return data.products || [];
  }

  function render(products){
    renderCurrentZoneBadge();
    $('#count').textContent = products.length.toString();

    const grid = $('#grid');
    grid.innerHTML = products.map(p=>`
      <div class="catalog-card">
        <img src="${p.image}">
        <h4>${p.name}</h4>
        <p>$${p.price || "0.00"}</p>
      </div>
    `).join('');
  }

  try{
    const products = await loadProducts();

    render(products);

    const zoneBtn = $('#zoneSetBtn');
    if(zoneBtn){
      zoneBtn.addEventListener('click', (e)=>{
        e.preventDefault();

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
          renderCurrentZoneBadge();
          render(products);

          if(checks >= maxChecks){
            clearInterval(timer);
          }
        }, 500);
      });
    }

    window.addEventListener('focus', ()=>{
      renderCurrentZoneBadge();
      render(products);
    });

  }catch(err){
    console.error(err);
    $('#grid').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
})();