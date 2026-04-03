(function () {
  function $(id){ return document.getElementById(id); }

  function normalize(s){
    return (s || "")
      .toString()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function prettyUrl(u){
    // Show just the filename (e.g., BXseAM.html)
    try {
      return (u || "").split("/").pop();
    } catch(e){
      return u || "";
    }
  }

  function render(results){
    var list = $("results");
    list.innerHTML = "";
    if (!results.length){
      list.innerHTML = "<p>No matches.</p>";
      return;
    }

    var frag = document.createDocumentFragment();

    results.slice(0, 200).forEach(function (item){
      var a = document.createElement("a");
      a.className = "sr-item";
      a.href = item.url;

      var img = document.createElement("img");
      img.className = "sr-thumb";
      img.alt = item.title || "";
      img.loading = "lazy";
      img.src = item.image || "images/placeholder.jpg";

      // Fallback if the image is missing
      img.onerror = function(){
        this.onerror = null;
        this.src = "images/placeholder.jpg";
      };

      var meta = document.createElement("div");
      meta.className = "sr-meta";

      var title = document.createElement("div");
      title.className = "sr-title";
      title.textContent = item.title || "";
      meta.appendChild(title);

      a.appendChild(img);
      a.appendChild(meta);

      frag.appendChild(a);
    });

    list.appendChild(frag);
  }

  function search(index, q){
    q = normalize(q);
    if (!q) return index;

    var terms = q.split(" ").filter(Boolean);

    return index.filter(function (item){
      // include title, filename/code, and URL in the haystack
      var hay = normalize((item.title || "") + " " + prettyUrl(item.url || "") + " " + (item.url || ""));
      return terms.every(function (t){ return hay.indexOf(t) !== -1; });
    });
  }

  function wire(index){
    var input = $("q");

    function run(){
      var out = search(index, input.value);
      $("count").textContent = out.length;
      render(out);
    }

    input.addEventListener("input", run);
    run();
  }

  // Prefer embedded index (works even when opening files locally via file://)
  if (window.SITE_INDEX && Array.isArray(window.SITE_INDEX)) {
    wire(window.SITE_INDEX);
    return;
  }

  // Fallback to fetch (works when served over http/https)
  fetch("data/site_index.json", { cache: "no-store" })
    .then(function (r){ return r.json(); })
    .then(function (index){ wire(index); })
    .catch(function (){
      // One last fallback if the script loaded after this file
      if (window.SITE_INDEX && Array.isArray(window.SITE_INDEX)) {
        wire(window.SITE_INDEX);
      } else {
        $("results").innerHTML =
          "<p>Could not load search index.</p>";
      }
    });
})();