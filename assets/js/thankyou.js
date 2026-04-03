(function(){
  const $ = (sel, el=document) => el.querySelector(sel);
  const ORDER_KEY = 'orders';

  function getOrders(){
    try{ return JSON.parse(localStorage.getItem(ORDER_KEY)||'[]'); }catch(_){ return []; }
  }

  const params = new URLSearchParams(location.search);
  const id = params.get('order');
  if(!id) return;

  const order = getOrders().find(o=>o && o.id===id);
  if(!order) return;

  $('#orderBox').style.display = '';
  const json = JSON.stringify(order, null, 2);
  $('#orderJson').textContent = json;

  $('#copyBtn').addEventListener('click', async ()=>{
    try{
      await navigator.clipboard.writeText(json);
      $('#copyMsg').textContent = 'Copied.';
      setTimeout(()=>$('#copyMsg').textContent='', 1200);
    }catch(_){
      $('#copyMsg').textContent = 'Could not copy. Select and copy manually.';
    }
  });
})();