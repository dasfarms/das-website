(function () {
  const STORAGE_ZIP = "user_zip";
  const STORAGE_ZONE = "user_zone";
  const ZONE_DATA_URL = "data/zip_to_zone_2023.json"; // fallback only
  const ZIP_ZONE_GLOBAL = "ZIP_TO_ZONE_2023";
  let zipMap = null;
  let plantRange = {min:null, max:null};

  function getCookie(name) {
    try {
      const safe = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = document.cookie.match(new RegExp('(?:^|; )' + safe + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : "";
    } catch (e) { return ""; }
  }

  function setCookie(name, value, days) {
    try {
      const maxAge = Math.max(1, Number(days || 365)) * 24 * 60 * 60;
      document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + "; path=/; max-age=" + maxAge + "; SameSite=Lax";
    } catch (e) {}
  }

  function clearCookie(name) {
    try {
      document.cookie = encodeURIComponent(name) + "=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    } catch (e) {}
  }

  function syncStoredZone() {
    let zip = "";
    let zone = "";
    try { zip = (localStorage.getItem(STORAGE_ZIP) || "").trim(); } catch(e) {}
    if (!zip) { try { zip = (sessionStorage.getItem(STORAGE_ZIP) || "").trim(); } catch(e) {} }
    if (!zip) { zip = (getCookie(STORAGE_ZIP) || "").trim(); }

    try { zone = (localStorage.getItem(STORAGE_ZONE) || "").trim(); } catch(e) {}
    if (!zone) { try { zone = (sessionStorage.getItem(STORAGE_ZONE) || "").trim(); } catch(e) {} }
    if (!zone) { zone = (getCookie(STORAGE_ZONE) || "").trim(); }

    if (zip) {
      try { localStorage.setItem(STORAGE_ZIP, zip); } catch(e) {}
      try { sessionStorage.setItem(STORAGE_ZIP, zip); } catch(e) {}
      setCookie(STORAGE_ZIP, zip, 365);
    }
    if (zone) {
      try { localStorage.setItem(STORAGE_ZONE, zone); } catch(e) {}
      try { sessionStorage.setItem(STORAGE_ZONE, zone); } catch(e) {}
      setCookie(STORAGE_ZONE, zone, 365);
    }
  }

  function injectStyles() {
    if (document.getElementById("zone-widget-styles")) return;
    const style = document.createElement("style");
    style.id = "zone-widget-styles";
    style.textContent = `
      .zone-widget {
        position: fixed;
        right: 12px;
        bottom: 12px;
        z-index: 9999;
        font-family: Arial, sans-serif;
        font-size: 13px;
        background: rgba(255,255,255,0.95);
        border: 1px solid rgba(0,0,0,0.15);
        border-radius: 999px;
        padding: 8px 12px;
        box-shadow: 0 6px 16px rgba(0,0,0,0.12);
        display: flex;
        gap: 10px;
        align-items: center;
        max-width: calc(100vw - 24px);
      }
      .zone-widget a, .zone-widget button {
        background: transparent;
        border: none;
        padding: 0;
        margin: 0;
        color: #0b57d0;
        cursor: pointer;
        text-decoration: underline;
        font-size: 13px;
      }
      .zone-widget .zone-pill {
        font-weight: 700;
        white-space: nowrap;
      }
      .zone-inline {
        margin: 6px 0 10px;
        font-size: 14px;
        padding: 6px 10px;
        border-left: 3px solid rgba(0,0,0,0.2);
        background: rgba(0,0,0,0.03);
      }
      .zone-inline .zone-pill { font-weight: 700; }
    
      .zone-pill-good { color: #2e7d32; }
      .zone-pill-bad { color: #c62828; }


/* Zone ZIP modal */
#zoneModal{position:fixed;inset:0;display:none;z-index:9999;}
#zoneModal.open{display:block;}
.zone-modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45);}
.zone-modal{position:relative;max-width:420px;margin:10vh auto 0;background:#fff;border-radius:14px;padding:18px 18px 14px;box-shadow:0 10px 30px rgba(0,0,0,.25);overflow:hidden;}
.zone-modal h3{margin:0;font-size:20px;}
.zone-modal.welcome-zone-modal{max-width:560px;margin:8vh auto 0;padding:0;border-radius:20px;}
.welcome-zone-hero{position:relative;padding:30px 26px 22px;background:linear-gradient(135deg, rgba(255,255,255,.96), rgba(245,250,243,.97));}
.welcome-zone-hero::before{content:"";position:absolute;inset:0;background:url('images/images/Logo.v4.cropped.png') center/contain no-repeat;opacity:.12;pointer-events:none;}
.welcome-zone-hero > *{position:relative;z-index:1;}
.welcome-zone-badge{display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(34,139,34,.10);color:#2f6b2f;font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:12px;margin-bottom:12px;}
.welcome-zone-hero p{margin:8px 0 0;color:#35523a;line-height:1.5;}
.welcome-zone-form{padding:20px 26px 24px;}
.welcome-zone-form .rowline{display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap;}
.welcome-zone-form input{flex:1;min-width:180px;padding:12px 14px;border:1px solid #c8d3c5;border-radius:12px;}
.welcome-zone-form button,.welcome-zone-form .secondary-btn{padding:11px 14px;border-radius:12px;border:1px solid #88a884;background:#2f6b2f;color:#fff;cursor:pointer;text-decoration:none;display:inline-block;}
.welcome-zone-form .secondary-btn{background:#fff;color:#2f6b2f;}
.zone-home-hide-widget .zone-widget{display:none !important;}
`;
    document.head.appendChild(style);
  }

  function getZip() {
    try {
      const v = (localStorage.getItem(STORAGE_ZIP) || "").trim();
      if (v) return v;
    } catch (e) {}
    try {
      const v = (sessionStorage.getItem(STORAGE_ZIP) || "").trim();
      if (v) return v;
    } catch (e) {}
    return (getCookie(STORAGE_ZIP) || "").trim();
  }
  function getZone() {
    try {
      const v = (localStorage.getItem(STORAGE_ZONE) || "").trim();
      if (v) return v;
    } catch (e) {}
    try {
      const v = (sessionStorage.getItem(STORAGE_ZONE) || "").trim();
      if (v) return v;
    } catch (e) {}
    return (getCookie(STORAGE_ZONE) || "").trim();
  }
  function setZipZone(zip, zone) {
    try { localStorage.setItem(STORAGE_ZIP, zip); } catch (e) {}
    try { localStorage.setItem(STORAGE_ZONE, zone); } catch (e) {}
    try { sessionStorage.setItem(STORAGE_ZIP, zip); } catch (e) {}
    try { sessionStorage.setItem(STORAGE_ZONE, zone); } catch (e) {}
    setCookie(STORAGE_ZIP, zip, 365);
    setCookie(STORAGE_ZONE, zone, 365);
  }

  function notifyZoneChanged() {
    try {
      window.dispatchEvent(new CustomEvent('zonechange', { detail: { zip: getZip(), zone: getZone() } }));
    } catch (e) {
      const evt = document.createEvent('Event');
      evt.initEvent('zonechange', true, true);
      window.dispatchEvent(evt);
    }
  }

  function clearZip() {
    try { localStorage.removeItem(STORAGE_ZIP); } catch(e) {}
    try { sessionStorage.removeItem(STORAGE_ZIP); } catch(e) {}
    clearCookie(STORAGE_ZIP);
    try { localStorage.removeItem(STORAGE_ZONE); } catch(e) {}
    try { sessionStorage.removeItem(STORAGE_ZONE); } catch(e) {}
    clearCookie(STORAGE_ZONE);
    renderWidget();
    renderInline();
    notifyZoneChanged();
    closeZoneModal();
  }

  async function loadZipMap() {
    if (zipMap) return zipMap;

    // Prefer the locally-hosted JS dataset (works on file:// and static hosting)
    if (window[ZIP_ZONE_GLOBAL] && typeof window[ZIP_ZONE_GLOBAL] === "object") {
      zipMap = window[ZIP_ZONE_GLOBAL];
      return zipMap;
    }

    // Fallback to JSON fetch (may fail on file://)
    const resp = await fetch(ZONE_DATA_URL, { cache: "force-cache" });
    if (!resp.ok) throw new Error("Could not load ZIP zone data");
    zipMap = await resp.json();
    return zipMap;
  }

  async function lookupZone(zip) {
    const map = await loadZipMap();
    return map[zip] || "";
  }

  function validZip(zip) { return /^\d{5}$/.test(zip); }

  function isHomeWelcomeMode() {
    return !!(document.body && document.body.hasAttribute("data-zone-home"));
  }

  function renderInline() {
    const targets = document.querySelectorAll("[data-zone-inline], #userZoneInline");
    if (!targets.length) return;

    const zip = getZip();
    const zone = getZone();
    const zoneNum = zone ? parseFloat(zone) : null;

    targets.forEach(el => {
      const isProductInline = (el.id === "userZoneInline");

      if (zone) {
        let statusText = "";
        let pillClass = "zone-pill";

        if (isProductInline && plantRange && plantRange.min != null && plantRange.max != null && zoneNum != null && !Number.isNaN(zoneNum)) {
          const ok = !(zoneNum < plantRange.min || zoneNum > plantRange.max);
          if (!ok) {
            pillClass += " zone-pill-bad";
            statusText = " — Not recommended for this plant";
          } else {
            pillClass += " zone-pill-good";
            statusText = " — Suitable for this plant";
          }
        }

        el.innerHTML = `Your grow zone: <span class="${pillClass}">${zone}</span> (ZIP ${zip})${statusText} — <a href="#" data-zone-set>change</a> · <a href="#" data-zone-clear>clear</a>`;
      } else {
        el.innerHTML = `Set your ZIP to see your grow zone. <a href="#" data-zone-set>Set ZIP</a>`;
      }
      el.classList.add("zone-inline");
    });

    // bind clear handlers
    document.querySelectorAll("[data-zone-clear]").forEach(a => {
      a.onclick = (e) => {
        e.preventDefault();
        clearZipZone();
        renderInline();
      };
    });
  }

  function renderWidget() {
    let w = document.getElementById("zoneWidget");
    if (!w) {
      w = document.createElement("div");
      w.id = "zoneWidget";
      w.className = "zone-widget";
      document.body.appendChild(w);
    }

    const zip = getZip();
    const zone = getZone();

    if (isHomeWelcomeMode()) {
      document.body.classList.add("zone-home-hide-widget");
    } else {
      document.body.classList.remove("zone-home-hide-widget");
    }

    if (zone) {
      w.innerHTML = `<span>Grow zone:</span> <span class="zone-pill">${zone}</span> <span style="opacity:.7">(ZIP ${zip})</span> <button type="button" data-zone-set>Change ZIP</button>`;
    } else {
      w.innerHTML = `<span>Know your grow zone?</span> <button type="button" data-zone-set>Set ZIP</button>`;
    }
  }

  async function openZoneModal() {
    let m = document.getElementById("zoneModal");
    const isHome = isHomeWelcomeMode();
    if (!m) {
      m = document.createElement("div");
      m.id = "zoneModal";
      document.body.appendChild(m);

      m.addEventListener("click", (e) => {
        const t = e.target;
        if (t && (t.hasAttribute("data-zone-close") || t.closest("[data-zone-close]"))) closeZoneModal();
      });
    }

    if (isHome) {
      m.innerHTML = `
        <div class="zone-modal-backdrop" data-zone-close></div>
        <div class="zone-modal welcome-zone-modal">
          <div class="welcome-zone-hero">
            <div class="welcome-zone-badge">Welcome</div>
            <h3>Welcome to DASFarms</h3>
            <p>Find your USDA grow zone before you shop so you can quickly see which plants are a good fit for your area.</p>
          </div>
          <div class="welcome-zone-form">
            <p style="margin:0; color:#35523a;">Enter your 5-digit ZIP code to save your grow zone across the site.</p>
            <div class="rowline">
              <input id="zoneZipInput" type="text" inputmode="numeric" maxlength="5" placeholder="ZIP code">
              <button type="button" id="zoneZipSaveBtn">Save my zone</button>
            </div>
            <div id="zoneZipMsg" style="margin-top:10px; min-height:18px; font-size:13px; color:#2f4f2f;"></div>
            <div class="rowline" style="justify-content:space-between;">
              <a href="#" id="zoneZipClearLink" class="secondary-btn">Clear ZIP</a>
              <button type="button" data-zone-close class="secondary-btn">Continue browsing</button>
            </div>
          </div>
        </div>
      `;
    } else {
      m.innerHTML = `
        <div class="zone-modal-backdrop" data-zone-close></div>
        <div class="zone-modal welcome-zone-modal">
          <div class="welcome-zone-hero">
            <div class="welcome-zone-badge">Grow Zone</div>
            <h3>Welcome to DASFarms</h3>
            <p>Enter your 5-digit ZIP code to save or change your USDA grow zone so the catalog can show plants recommended for your area.</p>
          </div>
          <div class="welcome-zone-form">
            <p style="margin:0; color:#35523a;">Your grow zone is saved in this browser and used throughout the site.</p>
            <div class="rowline">
              <input id="zoneZipInput" type="text" inputmode="numeric" maxlength="5" placeholder="ZIP code">
              <button type="button" id="zoneZipSaveBtn">Save my zone</button>
            </div>
            <div id="zoneZipMsg" style="margin-top:10px; min-height:18px; font-size:13px; color:#2f4f2f;"></div>
            <div class="rowline" style="justify-content:space-between;">
              <a href="#" id="zoneZipClearLink" class="secondary-btn">Clear ZIP</a>
              <button type="button" data-zone-close class="secondary-btn">Continue browsing</button>
            </div>
          </div>
        </div>
      `;
    }

    const inp = document.getElementById("zoneZipInput");
    if (inp) inp.value = getZip() || "";

    const msg = document.getElementById("zoneZipMsg");
    if (msg) msg.textContent = "";

    const saveBtn = document.getElementById("zoneZipSaveBtn");
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const zip = (document.getElementById("zoneZipInput").value || "").trim();
        const msgEl = document.getElementById("zoneZipMsg");

        if (!validZip(zip)) {
          if (msgEl) msgEl.textContent = "Please enter a valid 5-digit ZIP code.";
          return;
        }

        if (msgEl) msgEl.textContent = "Looking up your zone...";
        try {
          const zone = await lookupZone(zip);
          if (!zone) {
            if (msgEl) msgEl.textContent = "Sorry — ZIP not found.";
            return;
          }
          setZipZone(zip, zone);
          renderWidget();
          renderInline();
          notifyZoneChanged();
          if (msgEl) msgEl.textContent = `Saved! Your grow zone is ${zone}.`;
          setTimeout(() => closeZoneModal(), 500);
        } catch (err) {
          console.error(err);
          if (msgEl) msgEl.textContent = "Sorry — couldn't load the grow zone database.";
        }
      };
    }

    const clear = document.getElementById("zoneZipClearLink");
    if (clear) {
      clear.onclick = (e) => {
        e.preventDefault();
        try { localStorage.removeItem(STORAGE_ZIP); } catch(e) {}
        try { sessionStorage.removeItem(STORAGE_ZIP); } catch(e) {}
        clearCookie(STORAGE_ZIP);
        try { localStorage.removeItem(STORAGE_ZONE); } catch(e) {}
        try { sessionStorage.removeItem(STORAGE_ZONE); } catch(e) {}
        clearCookie(STORAGE_ZONE);
        renderWidget();
        renderInline();
        notifyZoneChanged();
        closeZoneModal();
      };
    }

    m.classList.add("open");
  }

  function openZonePopup() {
    openZoneModal();
    return false;
  }

  function closeZoneModal() {
    const m = document.getElementById("zoneModal");
    if (m) m.classList.remove("open");
  }

function handleSetZip(e) {
    e.preventDefault();
    e.stopPropagation();
    openZoneModal();
  }

  function wireEvents() {
    document.addEventListener("click", (e) => {
      const t = e.target;
      const clickedSet =
        t && (
          t.matches("[data-zone-set]") ||
          t.closest("[data-zone-set]") ||
          t.matches(".zone-trigger") ||
          t.closest(".zone-trigger")
        );

      const clickedClear =
        t && (
          t.matches("[data-zone-clear]") ||
          t.closest("[data-zone-clear]")
        );

      const clickedClose =
        t && (
          t.hasAttribute("data-zone-close") ||
          t.closest("[data-zone-close]")
        );

      if (clickedClose) {
        e.preventDefault();
        closeZoneModal();
        return;
      }

      if (clickedClear) {
        e.preventDefault();
        clearZip();
        return;
      }

      if (clickedSet) {
        e.preventDefault();
        openZonePopup();
        return;
      }
    });

    // If the ZIP/zone is changed in another window (the popup), update UI.
    window.addEventListener('storage', (ev) => {
      if (!ev) return;
      if (ev.key === STORAGE_ZIP || ev.key === STORAGE_ZONE) {
        renderWidget();
        renderInline();
      }
    });
  }

  const SESSION_HOME_PROMPT_KEY = "das_zone_home_prompt_seen";

  function shouldAutoOpenHomeWelcome() {
    if (!isHomeWelcomeMode()) return false;
    try {
      if (sessionStorage.getItem(SESSION_HOME_PROMPT_KEY) === "1") return false;
      sessionStorage.setItem(SESSION_HOME_PROMPT_KEY, "1");
    } catch (e) {
      // If sessionStorage is unavailable, fall back to showing once on load.
    }
    return true;
  }

  function init() {
    syncStoredZone();
    injectStyles();
    wireEvents();
    renderWidget();
    renderInline();
    if (shouldAutoOpenHomeWelcome()) {
      setTimeout(() => openZoneModal(), 250);
    }
  }


  // public API for product pages
  window.ZoneWidget = window.ZoneWidget || {};
  window.ZoneWidget.open = function(){ openZonePopup(); };
  window.ZoneWidget.openPopupWindow = function(){ openZonePopup(); };
  window.ZoneWidget.close = function(){ closeZoneModal(); };
  window.ZoneWidget.clear = function(){ clearZip(); };
  window.ZoneWidget.setPlantRange = function(min, max){
    plantRange = {min: (min==null?null:Number(min)), max: (max==null?null:Number(max))};
    renderInline();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
