if (window.top !== window.self) window.top.location = window.self.location; // no framing
(function () {
  // Order data lives in the #fragment (private); ?query kept for older QR codes.
  var params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
  var lang = params.get("l") === "es" ? "es" : "en";
  var ids = (params.get("i") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  var products = ids.map(function (id) { return PRODUCTS.find(function (p) { return p.id === id; }); }).filter(Boolean);

  var T = {
    en: {
      tagline: "24/7 Medical Supplies", title: "Your order: drug facts & safety",
      sub: "Read this before you use anything you bought. Keep it for reference.",
      call911: "Call 911", callPoison: "Poison Help", poisonSub: "1-800-222-1222 · free, 24/7", sosSub: "Emergency",
      combo: "Do not take together", uses: "Uses", dir: "Directions", warn: "Warnings", allergy: "Allergy alert", ing: "Active ingredient",
      risk: "Caution — dangerous if misused", age: "Age-restricted (ID required)",
      tips: "Using medicine safely",
      tipList: [
        "Read the full label on the package before every use.",
        "Never take more than the label says, and don't combine products that contain the same active ingredient.",
        "Tell a pharmacist or doctor about other medicines you take, if you're pregnant or nursing, or before giving anything to a child.",
        "Keep all medicines out of reach of children, in a cool, dry place.",
        "Stop and get medical help if you have a serious reaction, trouble breathing, or swelling of the face, lips or throat."
      ],
      enNote: "", disclaimer: "Advil, Tylenol, Bayer, Benadryl, Vicks, DayQuil, Afrin, Pamprin, Icy Hot, ThermaCare, Halls, Tums, Pedialyte, Dramamine, Imodium, Neosporin, Nexcare, ACE, Band-Aid, Always, Tampax, First Response, Purell and Coppertone are trademarks of their respective owners. MediVend is a student project and is not affiliated with, sponsored by, or endorsed by any of them. Brand names and logos are shown only to identify the products. General information only — not medical advice. Drug facts mirror each product's OTC Drug Facts label. Dispensed by a student-built demo kiosk (MediVend); not a certified medical device.",
      print: "Print / save this page", none: "No items were found for this link.", noneSub: "Scan the QR code on the kiosk screen after your purchase to open your order's facts."
    },
    es: {
      tagline: "Suministros Médicos 24/7", title: "Su pedido: información y seguridad",
      sub: "Lea esto antes de usar lo que compró. Guárdelo como referencia.",
      call911: "Llamar al 911", callPoison: "Control de Envenenamientos", poisonSub: "1-800-222-1222 · gratis, 24/7", sosSub: "Emergencia",
      combo: "No tomar juntos", uses: "Usos", dir: "Instrucciones", warn: "Advertencias", allergy: "Alerta de alergia", ing: "Ingrediente activo",
      risk: "Precaución — peligroso si se usa mal", age: "Restricción de edad (se requiere ID)",
      tips: "Use los medicamentos con seguridad",
      tipList: [
        "Lea la etiqueta completa del paquete antes de cada uso.",
        "Nunca tome más de lo que dice la etiqueta, ni combine productos con el mismo ingrediente activo.",
        "Avise a un farmacéutico o médico de otros medicamentos que tome, si está embarazada o amamantando, o antes de dar algo a un niño.",
        "Mantenga los medicamentos fuera del alcance de los niños, en un lugar fresco y seco.",
        "Deténgase y busque ayuda médica si tiene una reacción grave, dificultad para respirar o hinchazón de cara, labios o garganta."
      ],
      enNote: "",
      disclaimer: "Advil, Tylenol, Bayer, Benadryl, Vicks, DayQuil, Afrin, Pamprin, Icy Hot, ThermaCare, Halls, Tums, Pedialyte, Dramamine, Imodium, Neosporin, Nexcare, ACE, Band-Aid, Always, Tampax, First Response, Purell y Coppertone son marcas registradas de sus respectivos dueños. MediVend es un proyecto estudiantil y no está afiliado, patrocinado ni respaldado por ninguno de ellos. Los nombres y logotipos de marca se muestran solo para identificar los productos. Solo información general — no es consejo médico. Los datos reflejan la etiqueta de información de medicamentos de cada producto. Dispensado por un quiosco de demostración creado por estudiantes (MediVend); no es un dispositivo médico certificado.",
      print: "Imprimir / guardar esta página", none: "No se encontraron artículos para este enlace.", noneSub: "Escanee el código QR en la pantalla del quiosco después de su compra para abrir la información de su pedido."
    }
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function render() {
    var t = T[lang];
    localizeProducts(lang);
    document.documentElement.lang = lang;
    document.getElementById("tagline").textContent = t.tagline;
    document.getElementById("title").textContent = t.title;
    document.getElementById("sub").textContent = t.sub;
    document.getElementById("langBtn").textContent = lang === "es" ? "EN" : "ES";
    var h = '<div class="sos"><a class="a911" href="tel:911">' + esc(t.call911) + "<small>" + esc(t.sosSub) + '</small></a>' +
            '<a class="apoison" href="tel:18002221222">' + esc(t.callPoison) + "<small>" + esc(t.poisonSub) + "</small></a></div>";
    if (!products.length) {
      h += '<div class="empty"><b>' + esc(t.none) + "</b><br>" + esc(t.noneSub) + "</div>";
    } else {
      findInteractions(products, lang).forEach(function (w) {
        h += '<div class="banner"><h2>⚠ ' + esc(t.combo) + ": " + esc(w.title) + '</h2><div class="items">' + esc(w.names.join(" + ")) + "</div><p>" + esc(w.detail) + "</p></div>";
      });
      products.forEach(function (p) {
        h += '<section class="card"><h2>' + esc(p.name) + '</h2><div class="dose">' + esc(p.dosage) + "</div>";
        if (p.highRisk) h += '<span class="tag risk">⚠ ' + esc(t.risk) + "</span>";
        if (p.ageRestricted) h += '<span class="tag age">' + esc(t.age) + "</span>";
        if (p.activeIngredient) h += '<span class="tag">' + esc(t.ing) + ": " + esc(p.activeIngredient) + "</span>";
        h += '<div class="fact"><h3>' + esc(t.uses) + "</h3><p>" + esc(p.uses) + "</p></div>";
        h += '<div class="fact"><h3>' + esc(t.dir) + "</h3><p>" + esc(p.instructions) + "</p></div>";
        h += '<div class="fact warn"><h3>' + esc(t.warn) + "</h3><p>" + esc(p.warnings) + "</p></div>";
        if (p.allergyAlert && !/^(none known|ninguna conocida)\.?$/i.test(p.allergyAlert.trim())) {
          h += '<div class="fact allergy"><h3>' + esc(t.allergy) + "</h3><p>" + esc(p.allergyAlert) + "</p></div>";
        }
        h += "</section>";
      });
      h += '<section class="card tips"><h2>' + esc(t.tips) + "</h2><ul>" + t.tipList.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></section>";
      if (t.enNote) h += '<div class="note">' + esc(t.enNote) + "</div>";
      h += '<button class="btn" id="printBtn">' + esc(t.print) + "</button>";
    }
    h += "<footer>" + esc(t.disclaimer) + "</footer>";
    document.getElementById("main").innerHTML = h;
    var pb = document.getElementById("printBtn");
    if (pb) pb.addEventListener("click", function () { window.print(); });
  }

  document.getElementById("langBtn").addEventListener("click", function () {
    lang = lang === "es" ? "en" : "es";
    params.set("l", lang); history.replaceState(null, "", location.pathname + "#" + params.toString());
    render();
  });
  render();
})();
