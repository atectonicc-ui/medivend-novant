// The kiosk's AI Assistant engine.
//
// Fully offline and rule-based on purpose: a vending machine can't count on
// network access or an API key, and medical answers should be deterministic
// and auditable. Instead of one keyword lookup, this is a pipeline of
// intent handlers (emergency → small talk → cart actions → product Q&A →
// comparisons/interactions → catalog browsing → first-aid guidance →
// fuzzy "did you mean") that share:
//   • Spanish↔English understanding (queries are normalized to English
//     phrases first, and replies come back in the customer's language),
//   • typo tolerance (edit-distance against the catalog vocabulary),
//   • conversation memory (last product / list, pending "want me to add it?"),
//   • strict grounding: product facts come only from each product's own
//     label record; first-aid text comes from knowledge.js (checked against
//     Red Cross / Mayo Clinic / MedlinePlus / CDC guidance).
//
// Assistant.respond(text, ctx) is pure — it returns a description of what to
// say and do (replies, product cards, quick-reply chips, cart actions) and
// kiosk.js performs it. That keeps every safety gate (e.g. the mandatory
// dangerous-medicine acknowledgment) in one place: the kiosk.

const Assistant = (function () {
  // ------------------------------------------------------------------
  // Text normalization
  // ------------------------------------------------------------------
  const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Keeps apostrophes so the legacy keyword lists ("can't breathe") still match.
  function normKeep(s) {
    return stripAccents(String(s).toLowerCase())
      .replace(/[’‘`´]/g, "'")
      .replace(/[^a-z0-9\s'$%.+*\/()-]/g, " ")
      .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  // Apostrophes/hyphens removed: "what's" → "whats", "band-aid" → "band aid".
  function toPlain(keep) {
    return keep.replace(/'/g, "").replace(/(?<=[a-z])-(?=[a-z])/g, " ").replace(/\s+/g, " ").trim();
  }

  // Spanish → English phrase map (accent-stripped). Longest phrases first.
  const ES_PAIRS = [
    ["mareo en el carro", "motion sickness"], ["mareo en el coche", "motion sickness"], ["mareo en el auto", "motion sickness"], ["mareo en el barco", "motion sickness"], ["mareo en el avion", "motion sickness"], ["voy a la playa", "sunscreen"], ["manos sucias", "hand sanitizer"], ["ampollas", "blister"], ["ampolla", "blister"], ["agruras", "heartburn"], ["ardor de estomago", "heartburn"],
    ["hablas espanol", "do you speak spanish"], ["habla espanol", "do you speak spanish"], ["cambiar a espanol", "do you speak spanish"],
    ["agregalos", "add them"], ["agregalo", "add it"], ["agregala", "add it"], ["lo quiero", "add it"], ["la quiero", "add it"], ["ponlo", "add it"], ["damelo", "add it"],
    ["quitalo", "remove it"], ["quitala", "remove it"], ["hazlo", "make it"], ["cambialo a", "make it"],
    ["el primero", "the first one"], ["la primera", "the first one"], ["el segundo", "the second one"], ["la segunda", "the second one"], ["el tercero", "the third one"], ["la tercera", "the third one"], ["el ultimo", "the last one"], ["la ultima", "the last one"],
    ["cuanto cuesta", "how much is"], ["cuanto vale", "how much is"], ["cuanto es", "how much is"],
    ["me duele la cabeza", "headache"], ["me duele mucho la cabeza", "headache"], ["duele la cabeza", "headache"],
    ["me duele la garganta", "sore throat"], ["me duele el estomago", "stomach ache"], ["me duele la barriga", "stomach ache"],
    ["me duele la espalda", "back pain"], ["me duele una muela", "toothache"], ["me duele el pecho", "chest pain"],
    ["dolor de cabeza", "headache"], ["dolor de garganta", "sore throat"], ["dolor de estomago", "stomach ache"],
    ["dolor de barriga", "stomach ache"], ["dolor de espalda", "back pain"], ["dolor de muelas", "toothache"],
    ["dolor de dientes", "toothache"], ["dolor de pecho", "chest pain"], ["dolor muscular", "muscle pain"],
    ["dolores musculares", "muscle pain"], ["dolor de cuello", "neck pain"], ["dolor menstrual", "menstrual pain"],
    ["colicos menstruales", "menstrual cramps"], ["calambres menstruales", "menstrual cramps"], ["dolor", "pain"],
    ["me duele", "hurts"], ["duele", "hurts"], ["fiebre", "fever"], ["escalofrios", "chills"], ["tos", "cough"],
    ["resfriado", "cold"], ["catarro", "cold"], ["gripe", "flu"], ["congestion nasal", "stuffy nose"],
    ["nariz tapada", "stuffy nose"], ["moqueo", "runny nose"], ["estornudos", "sneezing"], ["alergias", "allergies"],
    ["alergia", "allergy"], ["alergico", "allergic"], ["picazon", "itching"], ["ronchas", "hives"],
    ["malestar estomacal", "upset stomach"], ["estomago", "stomach"], ["nauseas", "nausea"], ["vomitando", "vomiting"],
    ["vomito", "vomiting"], ["acidez", "heartburn"], ["indigestion", "indigestion"], ["diarrea", "diarrhea"],
    ["quemadura de sol", "sunburn"], ["quemaduras", "burn"], ["quemadura", "burn"], ["me queme", "i burned myself"],
    ["cortadura", "cut"], ["cortada", "cut"], ["corte", "cut"], ["herida", "wound"], ["raspadura", "scrape"],
    ["raspon", "scrape"], ["esguince", "sprain"], ["torcedura", "sprain"], ["moreton", "bruise"],
    ["hinchazon", "swelling"], ["hinchado", "swollen"], ["sangrado nasal", "nosebleed"],
    ["sangre por la nariz", "nosebleed"], ["me sangra la nariz", "nosebleed"], ["picadura", "sting"],
    ["piquete", "sting"], ["mordedura", "bite"], ["mareo por movimiento", "motion sickness"], ["mareo", "nausea"],
    ["deshidratado", "dehydrated"], ["deshidratacion", "dehydration"], ["golpe de calor", "heat stroke"],
    ["agotamiento por calor", "heat exhaustion"], ["insolacion", "heat stroke"], ["calor", "heat"],
    ["prueba de embarazo", "pregnancy test"], ["embarazada", "pregnant"], ["embarazo", "pregnancy"],
    ["menstruacion", "period"], ["regla", "period"], ["periodo", "period"], ["germenes", "germs"],
    ["lavarme las manos", "wash hands"],
    // products
    ["ibuprofeno", "ibuprofen"], ["aspirina", "aspirin"], 
    ["acetaminofen", "acetaminophen"], ["antihistaminico", "antihistamine"], ["descongestionante", "decongestant"],
    ["antiacido", "antacid"], ["antidiarreico", "antidiarrheal"], ["pastillas para la tos", "cough drops"],
    ["pastillas para la garganta", "cough drops"], ["gotas para la tos", "cough drops"],
    ["pomada antibiotica", "antibiotic ointment"], ["pomada", "ointment"], ["gasa", "gauze"], ["curitas", "bandaids"],
    ["curita", "bandaid"], ["tiritas", "bandaids"], ["vendas", "bandages"], ["venda", "bandage"],
    ["vendaje", "bandage"], ["bolsa de hielo", "cold pack"], ["compresa fria", "cold pack"],
    ["parche de calor", "heat patch"], ["parche de mentol", "menthol patch"], ["parche", "patch"],
    ["desinfectante de manos", "hand sanitizer"], ["gel antibacterial", "hand sanitizer"],
    ["protector solar", "sunscreen"], ["bloqueador solar", "sunscreen"], ["filtro solar", "sunscreen"],
    ["toallas sanitarias", "sanitary pads"], ["toallas femeninas", "sanitary pads"], ["tampones", "tampons"],
    ["suero oral", "electrolyte"], ["electrolitos", "electrolyte"], ["medicamento", "medicine"],
    ["medicina", "medicine"], ["pastillas", "pills"], ["analgesico", "painkiller"], ["calmante", "painkiller"],
    // cart / kiosk
    ["carrito", "cart"], ["mi pedido", "my order"], ["pedido", "order"], ["pagar", "pay"], ["comprar", "buy"],
    ["agregar", "add"], ["agrega", "add"], ["anadir", "add"], ["anade", "add"], ["poner", "put"],
    ["quitar", "remove"], ["quita", "remove"], ["eliminar", "remove"], ["vaciar", "clear"], ["borrar", "clear"],
    ["precio", "price"], ["cuanto cuesta", "how much does it cost"], ["cuanto cuestan", "how much do they cost"],
    ["cuesta", "cost"], ["cuanto", "how much"], ["cuantas", "how many"], ["cuantos", "how many"],
    ["mas barato", "cheapest"], ["mas caro", "most expensive"], ["barato", "cheap"], ["disponible", "available"],
    ["en existencia", "in stock"], ["agotado", "out of stock"], ["tienen", "do you have"], ["tienes", "do you have"],
    ["venden", "do you sell"], ["que hay en", "whats in"], ["hay en", "in"],
    // question words / grammar
    ["como te llamas", "whats your name"], ["quien eres", "who are you"], ["quien te hizo", "who made you"],
    ["que hora es", "what time is it"], ["cuentame un chiste", "tell me a joke"], ["chiste", "joke"],
    ["que es", "what is"], ["cual es", "what is"], ["cual", "which"], ["que", "what"], ["como", "how"],
    ["donde", "where"], ["cuando", "when"], ["por que", "why"], ["quien", "who"], ["puedo", "can i"],
    ["puede", "can"], ["debo", "should i"], ["deberia", "should"], ["es seguro", "is it safe"], ["seguro", "safe"],
    ["peligroso", "dangerous"], ["advertencias", "warnings"], ["efectos secundarios", "side effects"],
    ["instrucciones", "instructions"], ["dosis", "dose"], ["tomarlo", "take"], ["tomar", "take"], ["tomo", "take"],
    ["toma", "take"], ["usar", "use"], ["uso", "use"], ["sirve para", "good for"], ["es bueno para", "good for"],
    ["para", "for"], ["con", "with"], ["sin", "without"], ["juntos", "together"], ["juntas", "together"],
    ["mezclar", "mix"], ["combinar", "combine"], ["ninos", "children"], ["nino", "child"], ["bebe", "baby"],
    ["adultos", "adults"], ["diferencia entre", "difference between"], ["diferencia", "difference"],
    ["comparar", "compare"], ["contra", "versus"], ["y", "and"], ["o", "or"], ["el", "the"], ["la", "the"],
    ["los", "the"], ["las", "the"], ["un", "a"], ["una", "a"], ["en", "in"], ["mi", "my"], ["mis", "my"],
    ["del", "of the"], ["de", "of"], ["es", "is"], ["esto", "this"], ["eso", "that"],
    ["hola", "hello"], ["buenos dias", "good morning"], ["buenas tardes", "good afternoon"],
    ["buenas noches", "good evening"], ["muchas gracias", "thank you"], ["gracias", "thank you"],
    ["hasta luego", "goodbye"], ["adios", "goodbye"], ["ayudame", "help me"], ["necesito ayuda", "i need help"],
    ["ayuda", "help"], ["necesito", "i need"], ["tengo", "i have"], ["quiero", "i want"], ["me siento", "i feel"],
    ["no gracias", "no thanks"], ["por favor", "please"], ["claro", "sure"], ["si", "yes"],
    ["farmacia", "pharmacy"], ["sala de emergencias", "emergency room"], ["urgencias", "emergency room"],
    ["emergencia", "emergency"], ["ambulancia", "ambulance"], ["mas cercano", "nearest"], ["mas cercana", "nearest"],
    ["cerca", "nearby"], ["horario", "hours"], ["abierto", "open"], ["aceptan", "accept"], ["tarjeta", "card"],
    ["efectivo", "cash"], ["reembolso", "refund"], ["devolver", "return"], ["receta", "prescription"],
    ["identificacion", "id"], ["edad", "age"], ["idioma", "language"], ["en espanol", "in spanish"],
    ["en ingles", "in english"], ["espanol", "spanish"], ["ingles", "english"], ["hablar", "speak"],
    ["habla", "speak"], ["no puedo respirar", "cant breathe"], ["atragantado", "choking"],
    ["sobredosis", "overdose"], ["envenenamiento", "poisoning"], ["envenenado", "poisoned"],
    ["convulsion", "seizure"], ["mareado", "nauseous"], ["mareada", "nauseous"], ["auto", "car"], ["carro", "car"],
    ["coche", "car"], ["estoy", "i am"], ["muy", "very"],
  ].sort((a, b) => b[0].length - a[0].length).map(([es, en]) => [new RegExp(`(?<![a-z0-9])${es}(?![a-z0-9])`, "g"), en]);

  function toEnglish(plain) {
    let out = plain, hits = 0;
    for (const [re, en] of ES_PAIRS) {
      out = out.replace(re, (m) => { if (m.trim() !== en) hits++; return " " + en + " "; }); // "indigestion" isn't evidence of Spanish
    }
    return { text: out.replace(/\s+/g, " ").trim(), es: hits > 0 };
  }

  const has = (p, phrase) => (" " + p + " ").includes(" " + phrase + " ");
  const anyOf = (p, list) => list.some((x) => has(p, x));
  const rx = (p, re) => re.test(p);

  // ------------------------------------------------------------------
  // Vocabulary + typo correction
  // ------------------------------------------------------------------
  const COMMON = new Set(("snort killing throbbing shaving nicked burns burning blood pressure pills bones urine swollen interact interacts interacting interaction interactions combine mixing clear empty reset remove delete cancel checkout start begin again clean hands hurts break broke works working the and that have with this from they would there their what about which when make like time just know take people into year your good some could them other than then look only come over think also back after work first well even want because these give most need help please should thanks thank today tonight yesterday morning night hello where while being right going doing feel feeling really very much many more less something anything nothing everything someone anyone always never again still since before under around between through medicine medicines doctor doctors hospital kiosk order orders price prices items item products product stock cheap cheaper cheapest expensive safe safely dangerous allergic better worse worst best hurts hurting having started getting taking trying using needs wants tells shows until maybe sometimes cannot without though another different difference together compare which whats whos hows wheres wont dont cant isnt arent didnt doesnt shouldnt couldnt wouldnt youre theyre ive youve ill thats there heres these those would could might must shall while whole every each both either neither little lots plenty enough quite pretty almost already often usually actually probably definitely sure okay yeah nope thing things stuff person kids child adult adults baby babies years months weeks days hours minutes night daily weekly").split(" "));
  const VOCAB = new Set();
  function addVocab(str) {
    normKeep(str).replace(/'/g, "").split(/[\s-]+/).forEach((w) => { if (w.length >= 5 && !/\d/.test(w)) VOCAB.add(w); });
  }

  // Edit distance. With `swaps`, two swapped neighbours count as one slip. Stops early once it's past `max`.
  function lev(a, b, max = Infinity, swaps = false) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (swaps && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        rowMin = Math.min(rowMin, d[i][j]);
      }
      if (rowMin > max) return max + 1;
    }
    return d[a.length][b.length];
  }

  function nearest(token) {
    const max = token.length <= 7 ? 1 : 2;
    let best = null, bestD = max + 1;
    for (const v of VOCAB) {
      if (v[0] !== token[0]) continue;
      const d = lev(token, v, max);
      if (d < bestD) { bestD = d; best = v; if (d === 1) break; }
    }
    return bestD <= max ? best : null;
  }

  function correct(p) {
    return p.split(" ").map((tok) => {
      if (tok.length < 5 || /\d/.test(tok) || VOCAB.has(tok) || COMMON.has(tok)) return tok;
      return nearest(tok) || tok;
    }).join(" ");
  }

  // ------------------------------------------------------------------
  // Catalog lookups
  // ------------------------------------------------------------------
  const EXTRA_ALIASES = {
    bandaid: ["bandaid", "bandaids", "band aids", "bandages", "plasters", "adhesive bandages"],
    ointment: ["neosporin", "ointment", "antibiotic cream", "triple antibiotic"],
    gauze: ["nexcare", "gauze", "gauze pad", "gauze pads", "sterile gauze"],
    coldpack: ["ace compress", "cold compress", "cold pack", "cold packs", "ice pack", "ice packs", "instant cold pack"],
    ibuprofen: ["ibuprofin", "ibuprofen", "advil", "motrin"],
    acetaminophen: ["paracetamol", "acetaminophen", "tylenol"],
    aspirin: ["asprin", "aspirin", "bayer"],
    antihistamine: ["antihistamine", "diphenhydramine", "allergy relief", "allergy pill", "allergy pills", "allergy medicine", "benadryl"],
    coughdrops: ["halls", "cough drops", "cough drop", "lozenges", "throat lozenges"],
    coldflu: ["dayquil cold and flu", "daytime cold and flu caplets", "cold and flu pills", "cold and flu", "cold flu caplets", "daytime cold and flu", "dayquil"],
    decongestant: ["decongestant", "nasal spray", "nasal decongestant", "afrin"],
    antacid: ["antacid", "antacids", "tums", "antacid chewables", "heartburn tablets"],
    electrolyte: ["pedialyte packets", "electrolyte packets", "electrolyte", "electrolytes", "electrolyte packet", "rehydration packet", "pedialyte", "oral rehydration"],
    motionsickness: ["dimenhydrinate", "motion sickness tablets", "motion sickness pills", "dramamine", "travel sickness tablets"],
    antidiarrheal: ["loperamide", "diarrhea pills", "anti diarrheal", "antidiarrheal", "imodium", "diarrhea caplets", "diarrhea medicine"],
    periodrelief: ["pamprin", "period pills", "period pain relief", "period relief", "midol", "pamprin", "period pain caplets"],
    heatpatch: ["thermacare", "heat wrap", "heat wraps", "heat patch", "menstrual heat patch", "heating patch"],
    patch: ["icy hot", "pain patch", "menthol patch", "pain relief patch", "menthol pain relief patch"],
    pads: ["always pads", "sanitary pads", "feminine pads", "hygiene pads", "pads", "menstrual pads"],
    tampons: ["tampax", "tampons", "tampon"],
    pregnancytest: ["first response", "pregnancy test", "pregnancy tests"],
    sanitizer: ["purell", "hand sanitizer", "sanitizer", "hand gel"],
    tissues: ["kleenex", "tissues", "tissue", "facial tissues"],
    earplugs: ["earplugs", "ear plugs", "earplug", "macks earplugs"],
    masks: ["face masks", "face mask", "masks", "mask"],
    wipes: ["wet ones", "hand wipes", "wet wipes", "wipes"],
    cable: ["charging cable", "phone charger", "charger", "usb c cable", "cable"],
    sunscreen: ["coppertone", "sunscreen", "sun screen", "sunblock", "spf 30"],
  };
  const ALIASES = [];
  function buildAliases() {
    PRODUCTS.forEach((p) => {
      const names = new Set([toPlain(normKeep(p.name)), ...(EXTRA_ALIASES[p.id] || [])]);
      if (typeof PRODUCTS_ES !== "undefined" && PRODUCTS_ES[p.id]) names.add(toPlain(normKeep(PRODUCTS_ES[p.id].name)).replace(/\b\d+\s?(mg|ml|oz)\b/g, "").trim());
      (MED_ALIASES[p.id] || []).forEach((a) => names.add(toPlain(normKeep(a))));
      // "Ibuprofen 200mg" → also "ibuprofen"
      names.add(toPlain(normKeep(p.name)).replace(/\b\d+\s?(mg|ml|oz)\b/g, "").replace(/\b(otc|spf \d+)\b/g, "").replace(/\s+/g, " ").trim());
      names.forEach((a) => { if (a && a.length >= 4) { ALIASES.push({ alias: a, product: p }); addVocab(a); } });
      addVocab(p.name);
    });
    ALIASES.sort((a, b) => b.alias.length - a.alias.length);
  }

  // Products mentioned in the text, in order of appearance, longest alias first.
  function findProducts(p) {
    const padded = " " + p + " ";
    const claimed = [];
    const found = [];
    for (const { alias, product } of ALIASES) {
      const re = new RegExp(`(?<= )${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?(?= )`);
      const m = re.exec(padded);
      if (!m) continue;
      const s = m.index, e = s + m[0].length;
      if (claimed.some(([a, b]) => s < b && e > a)) continue;
      claimed.push([s, e]);
      if (!found.some((f) => f.product.id === product.id)) found.push({ product, index: s });
    }
    return found.sort((a, b) => a.index - b.index).map((f) => f.product);
  }

  const CATEGORY_ALIASES = {
    emergency: ["first aid", "emergency supplies", "first aid supplies", "first aid items", "wound care"],
    pain: ["pain relief", "painkiller", "painkillers", "pain killer", "pain killers", "pain meds", "pain medicine", "pain medication", "pain reliever", "pain relievers", "analgesic", "analgesics"],
    coldallergy: ["cold and allergy", "cold allergy", "cold medicine", "cold meds", "cold remedies", "allergy medicine", "allergy meds", "cold and flu items"],
    stomach: ["stomach medicine", "stomach items", "digestion", "digestive", "stomach and digestion", "stomach relief"],
    wellness: ["wellness", "hygiene", "personal care", "feminine", "feminine hygiene", "wellness and hygiene"],
  };
  function findCategory(p) {
    for (const [id, list] of Object.entries(CATEGORY_ALIASES)) if (anyOf(p, list)) return id;
    return null;
  }

  // ------------------------------------------------------------------
  // Health topics
  // ------------------------------------------------------------------
  function findTopics(p) {
    const hits = [];
    HEALTH_TOPICS.forEach((tp) => {
      tp.triggers.forEach((tr) => { if (has(p, tr)) hits.push({ tp, tr, score: tr.split(" ").length * 20 + tr.length }); });
    });
    // "hay fever" is allergies, not fever; "burned in the sun" is sunburn, not a burn.
    const kept = hits.filter((h) => !hits.some((o) => o.tp !== h.tp && o.tr !== h.tr && (" " + o.tr + " ").includes(" " + h.tr + " ")));
    const best = new Map();
    kept.forEach((h) => { if (!best.has(h.tp) || best.get(h.tp) < h.score) best.set(h.tp, h.score); });
    return [...best.entries()].sort((a, b) => b[1] - a[1]).map(([tp]) => tp);
  }

  // ------------------------------------------------------------------
  // Response builder
  // ------------------------------------------------------------------
  const usd = (n) => "$" + n.toFixed(2);

  function newResp(lang, ctx) {
    const R = {
      lang, replies: [], products: [], chips: [], actions: [],
      emergency: false, care: false, last: undefined, lastList: undefined, pending: null, topic: null,
    };
    R.L = (en, es) => (lang === "es" ? es : en);
    R.say = (text, kind) => { R.replies.push({ text, kind: kind || "ai" }); return R; };
    R.chip = (en, es) => { R.chips.push(lang === "es" ? es : en); return R; };
    R.avail = (pr) => (ctx.isAvailable ? ctx.isAvailable(pr) : pr.inStock);
    R.reason = (pr) => (ctx.unavailableReason ? ctx.unavailableReason(pr) : (pr.inStock ? null : "stock"));
    return R;
  }

  const DISCLAIMER = {
    en: "General information, not medical advice for your situation — a pharmacist or doctor can help with that.",
    es: "Información general, no un consejo médico para su situación — un farmacéutico o médico puede ayudarle con eso.",
  };
  const SOURCE_NOTE = {
    en: "That's straight from this item's FDA-style Drug Facts label.",
    es: "Eso viene directo de la etiqueta de información de medicamento de este producto.",
  };
  const FIRSTAID_SOURCE = {
    en: "General first-aid guidance (consistent with Red Cross, Mayo Clinic & MedlinePlus). Not a diagnosis.",
    es: "Guía general de primeros auxilios (consistente con Cruz Roja, Mayo Clinic y MedlinePlus). No es un diagnóstico.",
  };

  function productLine(R, pr) {
    const r = R.reason(pr);
    const tag = r === "temp" ? R.L(" (temperature-locked right now)", " (bloqueado por temperatura ahora)")
      : r === "stock" ? R.L(" (out of stock)", " (agotado)") : "";
    return `• ${pr.name} — ${usd(pr.price)}${tag}`;
  }

  function categoryLabel(R, id) {
    return (typeof CATEGORY_LABELS !== "undefined" && CATEGORY_LABELS[R.lang][id]) || id;
  }

  function defaultChips(R) {
    suggestedPrompts(R.lang).slice(0, 4).forEach((c) => R.chips.push(c));
  }

  function suggestedPrompts(lang) {
    return lang === "es"
      ? ["Me corté un dedo", "Hay mucho ruido aquí", "¿Cómo trato una quemadura?", "Mi teléfono no tiene batería", "Necesito una mascarilla", "¿Qué hay en mi carrito?", "¿Dónde estoy?"]
      : ["I cut my finger", "It's too loud in here", "How do I treat a burn?", "My phone is dead", "I need a face mask", "What's in my cart?", "Where am I?"];
  }

  // Offer an available alternative if the top match can't be sold right now.
  function withAlternative(R, list) {
    if (!list.length) return list;
    const top = list[0];
    if (R.avail(top)) return list;
    const alt = list.find((x) => R.avail(x));
    const why = R.reason(top) === "temp"
      ? R.L("is temporarily temperature-locked", "está bloqueado temporalmente por temperatura")
      : R.L("is out of stock", "está agotado");
    if (alt) {
      const ing = alt.activeIngredient ? R.L(` (active ingredient: ${alt.activeIngredient})`, ` (ingrediente activo: ${alt.activeIngredient})`) : "";
      R.say(R.L(`${top.name} ${why} right now. A safe alternative: ${alt.name}${ing}.`, `${top.name} ${why} ahora mismo. Una alternativa segura: ${alt.name}${ing}.`), "warn");
      return [alt, ...list.filter((x) => x !== alt)];
    }
    R.say(R.L(`${top.name} ${why} right now, and I don't have an available alternative for it.`, `${top.name} ${why} ahora mismo y no tengo una alternativa disponible.`), "warn");
    return list;
  }

  function followUpChips(R, pr) {
    R.chip("What are the warnings?", "¿Cuáles son las advertencias?");
    R.chip("How do I take it?", "¿Cómo se toma?");
    if (R.avail(pr)) R.chip(`Add ${pr.name}`, `Agregar ${pr.name}`);
    const sibling = PRODUCTS.find((x) => x.category === pr.category && x.id !== pr.id && x.activeIngredient && x.category === "pain");
    if (sibling && pr.category === "pain") R.chip(`Compare ${pr.name.split(" ")[0]} and ${sibling.name.split(" ")[0]}`, `Compara ${pr.name.split(" ")[0]} y ${sibling.name.split(" ")[0]}`);
  }

  // ------------------------------------------------------------------
  // Handlers — each returns true when it fully handled the message
  // ------------------------------------------------------------------

  // Red flags come from safety.js so search and chat always agree.
  function handleEmergency(raw, R) {
    const flag = redFlag(raw);
    if (!flag) return false;
    if (flag.kind === "urgent" && flag.text) {
      R.say(flag.text[R.lang], "warn");
      R.care = true;
      return true;
    }
    if (flag.kind === "urgent") {
      const msg = {
        infant: ["A baby under 3 months with any fever needs a doctor right away — call your pediatrician or go to the nearest ER now. Please don't give adult medicine from this kiosk.",
          "Un bebé menor de 3 meses con cualquier fiebre necesita un médico de inmediato — llame a su pediatra o vaya a la sala de emergencias más cercana ahora. No le dé medicamentos para adultos de este quiosco."],
        stool: ["Bloody or black stool needs a doctor today — don't use the anti-diarrheal here (its label says not to). Go to urgent care, or the ER if you feel faint or have heavy bleeding.",
          "Las heces con sangre o negras necesitan un médico hoy — no use el antidiarreico de aquí (su etiqueta lo prohíbe). Vaya a atención urgente, o a emergencias si se siente débil o sangra mucho."],
        fever: ["A fever of 103°F or higher, or one lasting more than 3 days, needs a doctor — please go to urgent care today instead of treating it with kiosk medicine.",
          "Una fiebre de 103°F o más, o que dura más de 3 días, necesita un médico — vaya hoy a atención urgente en lugar de tratarla con medicamentos del quiosco."],
        violence: ["I'm so sorry. You deserve to be safe, and it isn't your fault. If you're in danger now, call 911. For confidential help, 24/7: National Domestic Violence Hotline 1-800-799-7233, or RAINN sexual assault hotline 1-800-656-4673. An ER can treat injuries and collect evidence if you want that.",
          "Lo siento mucho. Usted merece estar a salvo y no es su culpa. Si está en peligro ahora, llame al 911. Ayuda confidencial, 24/7: Línea Nacional de Violencia Doméstica 1-800-799-7233 (en español), o RAINN para agresión sexual 1-800-656-4673. Una sala de emergencias puede tratar lesiones y recoger evidencia si lo desea."],
        reaction: ["A rash, hives or blisters after a medicine can be an allergic reaction. Stop taking it and see a doctor today. Call 911 right away for swelling of the face, lips or throat, or any trouble breathing.",
          "Un sarpullido, ronchas o ampollas después de un medicamento pueden ser una reacción alérgica. Deje de tomarlo y vea a un médico hoy. Llame al 911 de inmediato si hay hinchazón de la cara, labios o garganta, o dificultad para respirar."],
        bite: ["Animal bites need a doctor — they often get infected, and rabies must be ruled out. Wash the bite with soap and running water for several minutes, press with clean gauze if it bleeds, then go to urgent care today (call 911 for a deep or heavily bleeding bite).",
          "Las mordeduras de animales necesitan un médico — suelen infectarse y hay que descartar la rabia. Lave la mordida con agua y jabón varios minutos, presione con gasa limpia si sangra, y vaya hoy a atención urgente (llame al 911 si es profunda o sangra mucho)."],
        abdomen: ["Severe belly pain — especially low on the right side — can be appendicitis. Please go to the ER or urgent care now; pain relievers here can hide the symptoms.",
          "El dolor fuerte de estómago — sobre todo abajo a la derecha — puede ser apendicitis. Vaya a emergencias o atención urgente ahora; los analgésicos pueden ocultar los síntomas."],
      }[flag.reason || "infant"];
      R.say(R.L(msg[0], msg[1]), "warn");
      R.care = true;
      return true;
    }
    R.emergency = true;
    R.emergencyKind = flag.kind;
    if (flag.kind === "crisis") {
      R.say(R.L(
        "I'm really sorry you're feeling this way, and I'm glad you said something — you deserve support right now. In the U.S. you can call or text 988 (the Suicide & Crisis Lifeline) any time, free and confidential. If you're in immediate danger, call 911.",
        "Lamento mucho que se sienta así, y me alegra que lo haya dicho — merece apoyo ahora mismo. En EE. UU. puede llamar o enviar un mensaje de texto al 988 (Línea de Prevención del Suicidio y Crisis) a cualquier hora, gratis y confidencial. Si está en peligro inmediato, llame al 911."), "warn");
    } else if (flag.kind === "poison" && detectConditions(raw).pet) {
      R.say(R.L("If a pet swallowed medicine, call your veterinarian or the ASPCA Animal Poison Control Center at (888) 426-4435 right away.",
        "Si una mascota se tragó un medicamento, llame de inmediato a su veterinario o al Centro de Control de Envenenamiento Animal de la ASPCA al (888) 426-4435."), "warn");
    } else if (flag.kind === "poison") {
      R.say(R.L("Call Poison Control at 1-800-222-1222 right now (free, 24/7) — or 911 if the person is very sleepy, hard to wake, having trouble breathing, or having a seizure. This machine can't help with this.",
        "Llame a Control de Envenenamientos al 1-800-222-1222 ahora mismo (gratis, 24/7) — o al 911 si la persona está muy somnolienta, cuesta despertarla, le cuesta respirar o tiene una convulsión. Esta máquina no puede ayudar con esto."), "warn");
    } else {
      R.say(R.L("This could be a medical emergency. Tell the staff at the front desk right now, or call 911 — this machine can't help with this.",
        "Esto podría ser una emergencia médica. Avise ahora mismo al personal de la recepción o llame al 911 — esta máquina no puede ayudar con esto."), "warn");
    }
    return true;
  }

  function describeConditions(c, lang) {
    const es = lang === "es", out = [];
    if (c.pet) out.push(es ? "una mascota" : "a pet");
    if (c.ageUnknown) out.push(es ? "un niño" : "a child");
    else if (c.age !== undefined) out.push(c.age <= 1 ? (es ? "un bebé" : "a baby") : (es ? `un niño de ${c.age} años` : `a ${c.age}-year-old`));
    if (c.pregnant) out.push(es ? "embarazo" : "pregnancy");
    if (c.breastfeeding) out.push(es ? "lactancia" : "breastfeeding");
    if (c.bloodThinner) out.push(es ? "un anticoagulante" : "a blood thinner");
    if (c.antidepressant) out.push(es ? "un antidepresivo" : "an antidepressant");
    if (c.highBP) out.push(es ? "presión alta" : "high blood pressure");
    if (c.heart) out.push(es ? "una condición del corazón" : "a heart condition");
    if (c.kidney) out.push(es ? "problemas de riñón" : "kidney problems");
    if (c.liver) out.push(es ? "problemas de hígado" : "liver problems");
    if (c.ulcer) out.push(es ? "úlceras o sangrado estomacal" : "ulcers or stomach bleeding");
    if (c.alcohol) out.push(es ? "alcohol" : "alcohol");
    if (c.allergy) out.push(es ? "una alergia" : "an allergy");
    (c.labelConds || []).forEach((k) => out.push(LABEL_CONDS[k][es ? "es" : "en"]));
    if (c.senior) out.push(es ? "tener 60 años o más" : "being 60 or older");
    if (c.chickenpox) out.push(es ? "varicela" : "chickenpox");
    if (c.sedative || c.acetOther || c.antacidBlock || c.imodiumBlock || c.onAspirin) out.push(es ? "su otro medicamento" : "your other medicine");
    if (c.ibd) out.push(es ? "enfermedad intestinal" : "a bowel condition");
    if (c.lithium || c.methotrexate || c.steroid) out.push(es ? "su medicamento" : "your medicine");
    if (c.bleeding) out.push(es ? "sangrado frecuente" : "frequent bleeding");
    if (c.gout) out.push(es ? "gota" : "gout");
    return out.join(es ? ", " : ", ");
  }

  // Runs after every handler: anything unsafe for the person described is
  // removed (cards, chips, add actions, and any reply that names it), and a
  // clear "here's why, ask a pharmacist" warning takes its place.
  function applyConditions(R, cond) {
    if (!hasConditions(cond)) return;
    if (cond.pet) {
      R.replies = [];
      R.products = []; R.actions = R.actions.filter((a) => a.type !== "add"); R.pending = null; R.chips = [];
      R.say(R.L("Please don't give human medicine to a pet — ibuprofen, acetaminophen, aspirin and others can be toxic to dogs and cats. Call your veterinarian, or the ASPCA Animal Poison Control Center at (888) 426-4435.",
        "Por favor no le dé medicamentos para personas a una mascota — el ibuprofeno, el acetaminofén, la aspirina y otros pueden ser tóxicos para perros y gatos. Llame a su veterinario o al Centro de Control de Envenenamiento Animal de la ASPCA al (888) 426-4435."), "warn");
      return;
    }
    if (cond.age != null && cond.age < 12) childSafeGuidance(R);
    const unsafe = PRODUCTS.filter((p) => productConflicts(p, cond).length);
    if (!unsafe.length) return;
    const ids = new Set(unsafe.map((p) => p.id));
    const mentioned = unsafe.filter((p) => (R.askedIds || []).includes(p.id) || R.products.some((x) => x.id === p.id) || R.replies.some((r) => r.text.includes(p.name)) || R.actions.some((a) => a.id === p.id));
    R.products = R.products.filter((p) => !ids.has(p.id) && !(cond.pregnant && !cond.maybePregnant && p.id === "pregnancytest"));
    if (cond.pregnant && !cond.maybePregnant) R.replies = R.replies.filter((r) => !/should help: First Response|labeled for that: First Response/.test(r.text));
    R.actions = R.actions.filter((a) => !(a.type === "add" && ids.has(a.id)));
    if (R.pending && R.pending.ids) { R.pending.ids = R.pending.ids.filter((id) => !ids.has(id)); if (!R.pending.ids.length) R.pending = null; }
    R.chips = R.chips.filter((c) => !unsafe.some((p) => c.includes(p.name)));
    const before = R.replies.length;
    R.replies = R.replies.filter((r) => r.kind === "system" || !unsafe.some((p) => r.text.includes(p.name)));
    if (!mentioned.length) return;
    const who = describeConditions(cond, R.lang);
    const shown = (mentioned.length ? mentioned : unsafe).slice(0, 4);
    const reasons = shown.map((p) => `• ${p.name}: ${productConflicts(p, cond).map((r) => r[R.lang]).join("; ")}`).join("\n");
    if (Object.keys(cond).every((k) => k === "avoid")) {
      R.replies.unshift({ kind: "ai", text: R.L(`Okay, leaving out ${shown.map((p) => p.name).join(", ")}.${cond.avoid.length > 1 ? " Ibuprofen and aspirin are both NSAIDs, so I left out both." : ""}${R.products.length ? ` These could still help: ${R.products.map((p) => p.name).join(", ")}.` : " Tell me what you need it for and I'll look for something else."}`,
        `De acuerdo, dejo fuera ${shown.map((p) => p.name).join(", ")}.${cond.avoid.length > 1 ? " El ibuprofeno y la aspirina son AINE, así que dejé fuera ambos." : ""}${R.products.length ? ` Estos aún podrían ayudar: ${R.products.map((p) => p.name).join(", ")}.` : " Dígame para qué lo necesita y buscaré otra opción."}`) });
      return;
    }
    const warn = { kind: "warn", text: R.L(
      `Because you mentioned ${who}, I won't suggest these:\n${reasons}\nPlease ask a pharmacist or doctor for the right product and dose.`,
      `Como mencionó ${who}, no voy a sugerir estos:\n${reasons}\nPregunte a un farmacéutico o médico por el producto y la dosis correctos.`) };
    R.replies.unshift(warn);
    if (R.products.length && R.replies.length < before + 1) {
      R.replies.splice(1, 0, { kind: "ai", text: R.L(`These don't conflict with what you told me: ${R.products.map((p) => p.name).join(", ")}.`, `Estos no tienen conflicto con lo que me dijo: ${R.products.map((p) => p.name).join(", ")}.`) });
    }
    R.care = true;
  }

  // Self-care tips are written for adults; for a child drop the adult-medicine
  // bullets and swap the adult fever limits for pediatric ones (Mayo Clinic).
  const ADULT_MED_LINE = /acetaminoph|ibuprof|aspirin|naproxen/i;
  function childSafeGuidance(R) {
    R.replies.forEach((r) => {
      if (r.kind === "ai" && r.text.includes("\n•")) r.text = r.text.split("\n").filter((l) => !(l.startsWith("•") && ADULT_MED_LINE.test(l))).join("\n");
      if (r.kind === "warn" && /an adult's temperature|la temperatura de un adulto/.test(r.text)) {
        r.text = R.L("Call your child's doctor if: the fever is 104°F (40°C) or higher; it lasts more than 24 hours in a child under 2, or more than 3 days in an older child; or your child seems very sleepy, unusually fussy, isn't drinking, or has a rash or trouble breathing. Call 911 for a seizure, blue lips, or if they're hard to wake. Any fever in a baby under 3 months needs a doctor right away.",
          "Llame al médico de su hijo si: la fiebre es de 104°F (40°C) o más; dura más de 24 horas en un niño menor de 2 años o más de 3 días en un niño mayor; o si su hijo está muy somnoliento, inusualmente irritable, no quiere beber, o tiene sarpullido o dificultad para respirar. Llame al 911 si tiene una convulsión, labios morados o si cuesta despertarlo. Cualquier fiebre en un bebé menor de 3 meses requiere un médico de inmediato.");
      }
    });
  }

  const JOKES = {
    en: [
      "Why did the cold pack get promoted? It stayed cool under pressure.",
      "I'd tell you a joke about a bandage, but it might not stick.",
      "What do you call a doctor who fixes websites? A URL-ologist... okay, that one needs a second opinion.",
      "Why don't germs ever win at hide-and-seek? Because hand sanitizer always finds them.",
    ],
    es: [
      "¿Por qué ascendieron a la compresa fría? Porque mantuvo la calma bajo presión.",
      "Te contaría un chiste sobre una venda, pero podría no pegar.",
      "¿Por qué los gérmenes nunca ganan a las escondidas? Porque el desinfectante siempre los encuentra.",
    ],
  };
  let jokeIdx = 0;

  function safeMath(p) {
    const pct = p.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*\$?(\d+(?:\.\d+)?)/);
    if (pct) return (parseFloat(pct[1]) / 100) * parseFloat(pct[2]);
    let expr = p.replace(/^(what is|whats|calculate|compute|how much is|solve)\s+/, "").replace(/\$/g, "").replace(/\bx\b/g, "*").replace(/\s+/g, "");
    if (!/^[\d+\-*\/().]+$/.test(expr) || !/[+\-*\/]/.test(expr.replace(/^-/, ""))) return null;
    // Tiny recursive-descent parser (+ - * / and parentheses) — no eval/Function.
    let i = 0;
    const num = () => {
      if (expr[i] === "(") { i++; const v = sum(); if (expr[i++] !== ")") throw 0; return v; }
      if (expr[i] === "-") { i++; return -num(); }
      const m = /^\d*\.?\d+/.exec(expr.slice(i));
      if (!m) throw 0;
      i += m[0].length;
      return parseFloat(m[0]);
    };
    const prod = () => { let v = num(); while (expr[i] === "*" || expr[i] === "/") v = expr[i++] === "*" ? v * num() : v / num(); return v; };
    const sum = () => { let v = prod(); while (expr[i] === "+" || expr[i] === "-") v = expr[i++] === "+" ? v + prod() : v - prod(); return v; };
    try {
      const v = sum();
      return i === expr.length && Number.isFinite(v) ? v : null;
    } catch (e) { return null; }
  }

  function handleSmallTalk(p, R, ctx) {
    const words = p.split(" ").length;
    const L = R.L;
    const pendingAdd = ctx.pending && ctx.pending.type === "add" ? ctx.pending.ids.map((id) => PRODUCTS.find((x) => x.id === id)).filter(Boolean) : null;

    // yes / no follow-ups to something I offered
    if (words <= 4 && /^(yes|yeah|yep|yup|sure|ok|okay|please|please do|do it|go ahead|sounds good|yes please|sure thing)$/.test(p)) {
      if (pendingAdd && pendingAdd.length) {
        R.say(L(`Great — adding ${pendingAdd.map((x) => x.name).join(" and ")} to your order.`, `Perfecto — agregando ${pendingAdd.map((x) => x.name).join(" y ")} a su pedido.`));
        pendingAdd.forEach((x) => R.actions.push({ type: "add", id: x.id, qty: 1 }));
        return true;
      }
      if ((ctx.lastList || []).length > 1) {
        R.say(L("Which one would you like?", "¿Cuál le gustaría?"));
        ctx.lastList.slice(0, 3).filter((x) => R.avail(x)).forEach((x) => R.chip(`Add ${x.name}`, `Agregar ${x.name}`));
        return true;
      }
      R.say(L("Sure! What can I help you with — a symptom, a product question, or your cart?", "¡Claro! ¿En qué puedo ayudarle — un síntoma, una pregunta sobre un producto o su carrito?"));
      defaultChips(R);
      return true;
    }
    if (words <= 4 && /^(no|nope|nah|no thanks|not now|no thank you|never mind|nevermind|cancel|forget it)$/.test(p)) {
      R.say(L("No problem! I'm here if you need anything else.", "¡No hay problema! Aquí estoy si necesita algo más."));
      defaultChips(R);
      return true;
    }

    if (words <= 5 && /^(hello|hi|hey|yo|sup|howdy|greetings|good morning|good afternoon|good evening|hi there|hello there|hey there)( there| assistant| kiosk)?$/.test(p)) {
      const h = (ctx.now || new Date()).getHours();
      const tod = h < 12 ? L("Good morning", "Buenos días") : h < 18 ? L("Good afternoon", "Buenas tardes") : L("Good evening", "Buenas noches");
      R.say(L(`${tod}! I'm the MediVend assistant. Tell me what's going on — like "I have a headache" — or ask me about any item, your cart, or first aid.`, `¡${tod}! Soy el asistente de MediVend. Cuénteme qué le pasa — como "tengo dolor de cabeza" — o pregúnteme sobre cualquier artículo, su carrito o primeros auxilios.`));
      defaultChips(R);
      return true;
    }
    if (rx(p, /^(how are you|how are you doing|hows it going|how is it going|whats up|how do you do)\b/)) {
      R.say(L("I'm doing great, thanks for asking! I'm here 24/7 and ready to help. What's going on with you today?", "¡Muy bien, gracias por preguntar! Estoy aquí las 24 horas y listo para ayudar. ¿Qué le pasa hoy?"));
      defaultChips(R);
      return true;
    }
    if (rx(p, /^(ok |okay |great |cool |perfect |awesome |ok so )?(thanks|thank you|thx|ty|thanks a lot|thank you so much|thank you very much|much appreciated|appreciate it)( so much| a lot| very much)?( assistant| bot)?$/)) {
      R.say(L("You're welcome! Feel better soon. 💙", "¡De nada! Que se mejore pronto. 💙"));
      if (ctx.cart && ctx.cart.length) { R.chip("Checkout", "Pagar"); R.chip("What's in my cart?", "¿Qué hay en mi carrito?"); }
      else defaultChips(R);
      return true;
    }
    if (words <= 6 && rx(p, /^(bye|goodbye|see you|see ya|later|good night|cya|take care|have a good one)\b/)) {
      R.say(L("Take care, and feel better! If you're done, tap Review & Pay to check out.", "¡Cuídese y que se mejore! Si ya terminó, toque Revisar y Pagar para pagar."));
      return true;
    }
    if (rx(p, /\b(who are you|what are you|your name|introduce yourself|what should i call you|tell me about yourself)\b/)) {
      R.say(L("I'm the MediVend assistant — a rule-based helper that lives inside this kiosk. I can suggest items for symptoms, answer questions from each product's own label, compare products, check combinations, share basic first-aid guidance, and manage your cart. I'm not a doctor.",
        "Soy el asistente de MediVend — un ayudante basado en reglas que vive dentro de este quiosco. Puedo sugerir artículos según sus síntomas, responder preguntas con la etiqueta de cada producto, comparar productos, revisar combinaciones, compartir primeros auxilios básicos y manejar su carrito. No soy médico."));
      defaultChips(R);
      return true;
    }
    if (rx(p, /\bare you (a )?(real )?(doctor|nurse|pharmacist|human|person|robot|bot|ai|alive)\b/)) {
      R.say(L("I'm not a doctor, nurse, or pharmacist — I'm a software assistant running on this kiosk. I share general information from product labels and first-aid guidance; for personal medical advice, please ask a pharmacist or doctor.",
        "No soy médico, enfermero ni farmacéutico — soy un asistente de software que funciona en este quiosco. Comparto información general de las etiquetas y primeros auxilios; para consejo médico personal, consulte a un farmacéutico o médico."));
      return true;
    }
    if (rx(p, /^(help|help me|i need help|what can you do|how can you help( me)?|what can i ask( you)?|what do you know|what questions can i ask|capabilities|menu|options|commands)( please)?$/)) {
      R.say(L("Here's what I can do:\n• Suggest items for symptoms (\"I have a sore throat\")\n• Answer label questions (\"warnings for Neosporin?\")\n• Compare products (\"Band-Aid vs gauze\")\n• Share first-aid steps (\"how do I treat a burn?\")\n• Manage your cart (\"add 2 bandages\", \"checkout\")\n• Find nearby ERs, urgent care & pharmacies\nI also understand Spanish!",
        "Esto es lo que puedo hacer:\n• Sugerir artículos para síntomas (\"tengo dolor de garganta\")\n• Responder preguntas de etiquetas (\"¿advertencias de Neosporin?\")\n• Comparar productos (\"Band-Aid vs gasa\")\n• Compartir primeros auxilios (\"¿cómo trato una quemadura?\")\n• Manejar su carrito (\"agrega 2 vendas\", \"pagar\")\n• Encontrar salas de emergencia, atención urgente y farmacias cercanas\n¡También entiendo inglés!"));
      defaultChips(R);
      return true;
    }
    if (rx(p, /\b(speak|talk|switch|change|reply|answer|respond|use)( to| in| into)? (spanish|english)\b|^(in )?(spanish|english)( please)?$|^in (spanish|english)/)) {
      const to = /spanish/.test(p) ? "es" : "en";
      R.actions.push({ type: "setLang", lang: to });
      R.lang = to;
      R.say(to === "es" ? "¡Claro! Cambio todo el quiosco a español." : "Sure! Switching the whole kiosk to English.");
      return true;
    }
    if (rx(p, /\b(what time is it|current time|whats the time|what day is it|whats the date|todays date|what is today|whats today)\b/)) {
      const d = ctx.now || new Date();
      const time = d.toLocaleTimeString(R.lang === "es" ? "es-US" : "en-US", { hour: "numeric", minute: "2-digit" });
      const date = d.toLocaleDateString(R.lang === "es" ? "es-US" : "en-US", { weekday: "long", month: "long", day: "numeric" });
      R.say(L(`It's ${time} on ${date}, according to this kiosk's clock.`, `Son las ${time} del ${date}, según el reloj de este quiosco.`));
      return true;
    }
    if (rx(p, /\b(tell me a joke|joke|make me laugh|something funny|cheer me up)\b/)) {
      const list = JOKES[R.lang];
      R.say(list[jokeIdx++ % list.length]);
      return true;
    }
    const math = /^[\d\s$+\-*\/().x%]+$|^(what is|whats|calculate|compute|how much is|solve)\s+[\d\s$+\-*\/().x%]+|\d+\s*%\s*of\s*\$?\d/.test(p) ? safeMath(p) : null;
    if (math !== null) {
      R.say(`${p.replace(/^(what is|whats|calculate|compute|how much is|solve)\s+/, "")} = ${Math.round(math * 100) / 100}`);
      return true;
    }
    if (rx(p, /\b(you are|youre|ur) (so |very |really )?(smart|great|awesome|amazing|helpful|good|the best|cool|nice)\b|\b(good job|nice work|well done|great job)\b/)) {
      R.say(L("Thank you, that means a lot! I'm happy to help with anything else.", "¡Gracias, significa mucho! Con gusto le ayudo con algo más."));
      return true;
    }
    if (rx(p, /\b(stupid|dumb|useless|idiot|hate you|you suck|worthless|terrible bot)\b/)) {
      R.say(L("Sorry I missed the mark. Try rephrasing, or tell me the symptom or item, or ask the staff at the front desk.", "Perdón por no acertar. Intente con otras palabras, o dígame el síntoma o artículo — también puedo mostrarle atención cercana si el quiosco no puede ayudar."), "ai");
      R.care = true;
      return true;
    }
    if (rx(p, /\b(scared|afraid|anxious|anxiety|worried|nervous|panicking|panic attack|stressed|overwhelmed)\b/) && !findTopics(p).length) {
      R.say(L("That sounds stressful, and it's okay to feel that way. If you can, take a slow breath in for 4 counts and out for 6. Tell me what physical symptoms you're having and I'll see how I can help. If you ever feel unsafe or have thoughts of harming yourself, call or text 988, or 911 in an emergency.",
        "Suena estresante, y está bien sentirse así. Si puede, inhale lento contando hasta 4 y exhale contando hasta 6. Dígame qué síntomas físicos tiene y veré cómo ayudar. Si alguna vez se siente inseguro o piensa en hacerse daño, llame o envíe un texto al 988, o al 911 en una emergencia."));
      defaultChips(R);
      return true;
    }
    if (rx(p, /\b(sad|depressed|lonely|hopeless)\b/) && !findTopics(p).length) {
      R.say(L("I'm sorry you're feeling low. I can only help with this kiosk's supplies and basic first aid, but you don't have to go through it alone — talking to someone helps. In the U.S. you can call or text 988 any time, free and confidential.",
        "Lamento que se sienta decaído. Solo puedo ayudar con los suministros del quiosco y primeros auxilios básicos, pero no tiene que pasar por esto solo — hablar con alguien ayuda. En EE. UU. puede llamar o enviar un texto al 988 a cualquier hora, gratis y confidencial."));
      return true;
    }
    return false;
  }

  // ---- cart ----
  function cartTotals(ctx) {
    const items = ctx.cart || [];
    const sub = items.reduce((s, c) => s + c.product.price * c.qty, 0);
    const tax = sub * (ctx.taxRate || 0);
    return { items, sub, tax, total: sub + tax };
  }

  // Quantity written right before this product's name: "2 bandaids", "two of the ibuprofen".
  function qtyFor(p, product) {
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    const padded = " " + p + " ";
    for (const { alias, product: pr } of ALIASES) {
      if (pr.id !== product.id) continue;
      const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = new RegExp(`(?<= )(\\d+|one|two|three|four|five|six)\\s+(?:(?:boxes|packs|bottles|packets|packages|tubes|of|the)\\s+)*${esc}(?:s|es)?(?= )`).exec(padded);
      if (m) {
        const q = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : words[m[1]];
        return Math.max(1, Math.min(q || 1, 10));
      }
    }
    return 1;
  }

  function handleCart(p, R, ctx, prods) {
    const L = R.L;
    const { items, sub, tax, total } = cartTotals(ctx);

    const asking = /^(how|what|why|where|when|is|does|do|can|could|should|will|are|which|who)\b/.test(p);
    if (!asking && rx(p, /^(please )?(check ?out|pay|pay now|buy now|place (my |the )?order|proceed( to checkout)?|im ready to pay|ready to pay|lets pay|lets check ?out|finish( up)?|im done|im ready)( please| now)?$|\b(go to|take me to|open) (the )?(checkout|cart)\b|\bcheck me out\b/)) {
      if (!items.length) {
        R.say(L("Your cart is empty right now — tell me what you need and I'll help you add it.", "Su carrito está vacío ahora — dígame qué necesita y le ayudo a agregarlo."));
        defaultChips(R);
        return true;
      }
      R.say(L(`Taking you to checkout — ${items.reduce((n, c) => n + c.qty, 0)} item(s), about ${usd(total)} with tax.`, `Le llevo a pagar — ${items.reduce((n, c) => n + c.qty, 0)} artículo(s), unos ${usd(total)} con impuesto.`));
      R.actions.push({ type: "openCheckout" });
      return true;
    }

    if (rx(p, /\b(empty|clear|reset|wipe|start over|delete)\b.*\b(cart|order|basket|everything|all)\b|\bstart over\b|\bremove (everything|all)\b|\bcancel (my |the )?order\b/)) {
      if (!items.length) { R.say(L("Your cart is already empty.", "Su carrito ya está vacío.")); return true; }
      R.say(L("Done — I've emptied your cart.", "Listo — vacié su carrito."));
      R.actions.push({ type: "clearCart" });
      return true;
    }

    if (rx(p, /^(please )?(remove|delete|take out|take off|drop|get rid of|cancel)\b/) && (prods.length || /\b(it|that|this|them)\b/.test(p))) {
      let targets = prods;
      if (!targets.length && ctx.lastProduct) targets = [ctx.lastProduct];
      const inCart = targets.filter((x) => items.some((c) => c.product.id === x.id));
      if (!inCart.length) {
        R.say(L("That isn't in your cart right now.", "Eso no está en su carrito ahora."));
        return true;
      }
      R.say(L(`Removing ${inCart.map((x) => x.name).join(" and ")} from your cart.`, `Quitando ${inCart.map((x) => x.name).join(" y ")} de su carrito.`));
      inCart.forEach((x) => R.actions.push({ type: "remove", id: x.id }));
      return true;
    }

    const cartCombo = prods.length && /\b(can i|could i|safe|ok|okay|should i|mix|together|interact|with)\b/.test(p);
    if (!cartCombo && rx(p, /\b(whats|what is|show|see|view|list|check|read)( me| back)?( what( is)?| whats)?( in)?( my| the)? (cart|order|basket)\b|^(my )?(cart|order|basket)( total)?$|\b(cart|order) (total|summary|contents)\b|\bhow (much|many)\b.*\b(my )?(cart|order|basket|total)\b|\bwhat have i (added|picked|selected|chosen)\b|\bwhat am i buying\b/)) {
      if (!items.length) {
        R.say(L("Your cart is empty. Tell me what's going on or what you need, and I'll help you find it.", "Su carrito está vacío. Dígame qué le pasa o qué necesita y le ayudo a encontrarlo."));
        defaultChips(R);
        return true;
      }
      const lines = items.map((c) => `• ${c.product.name} × ${c.qty} — ${usd(c.product.price * c.qty)}`).join("\n");
      R.say(L(`Here's your cart:\n${lines}\nSubtotal ${usd(sub)} + about ${usd(tax)} tax = ${usd(total)}.`, `Este es su carrito:\n${lines}\nSubtotal ${usd(sub)} + unos ${usd(tax)} de impuesto = ${usd(total)}.`));
      const combos = findInteractions(items.map((c) => c.product), R.lang);
      combos.forEach((w) => R.say(`⚠ ${w.title}: ${w.names.join(" + ")}. ${w.detail}`, "warn"));
      R.chip("Checkout", "Pagar");
      R.chip("Clear my cart", "Vaciar mi carrito");
      R.chip("What else might help?", "¿Qué más podría ayudar?");
      return true;
    }

    // add
    const stripped = p.replace(/^(hey |ok |okay |so |and )/, "").replace(/^(can|could|would|will) you( please)?\s+/, "").replace(/^(please\s+)/, "").replace(/\s+please$/, "").replace(/^(can|could) i (get|have|buy|order|grab)\s+/, "add ").replace(/^i (want|need|would like|d like|ll take|will take|wanna|gotta get|d like to (buy|get|have)|would like to (buy|get|have))\s+/, "add ");
    const addVerb = /^(add|put|get|give|buy|order|purchase|grab|include|throw in|toss in)\b/.test(stripped);
    const isQuestion = /^(how|what|why|is|does|do|can|could|should|will|are|which|when|where|who)\b/.test(stripped);
    const wantsIt = /^(add|put|get|give|buy|grab|take|include)\b.*\b(it|that|this|them|one)\b/.test(stripped) && !prods.length;
    // "add it" right after a list of options: don't silently pick the first one.
    const list = ctx.lastList || [];
    if (addVerb && wantsIt && !/\b(them|all)\b/.test(stripped) && list.length > 1 && ctx.lastProduct && ctx.lastProduct.id === list[0].id) {
      R.say(L("Which one should I add?", "¿Cuál agrego?"));
      list.slice(0, 3).filter((x) => R.avail(x)).forEach((x) => R.chip(`Add ${x.name}`, `Agregar ${x.name}`));
      return true;
    }
    if (addVerb && !isQuestion && (prods.length || wantsIt)) {
      let targets = prods.length ? prods : (ctx.lastList && ctx.lastList.length > 1 && /\b(them|all)\b/.test(stripped) ? ctx.lastList.slice(0, 3) : ctx.lastProduct ? [ctx.lastProduct] : []);
      if (!targets.length) return false;
      const qtyOf = (x) => {
        const want = qtyFor(stripped, x), max = x.highRisk ? 2 : 10;
        if (want > max) R.say(L(`The limit for ${x.name} is ${max} per order, so I'll add ${max}.`, `El límite de ${x.name} es ${max} por pedido, así que agrego ${max}.`), "warn");
        return Math.min(want, max);
      };
      const addable = [], blocked = [];
      targets.forEach((x) => (R.avail(x) ? addable : blocked).push(x));
      blocked.forEach((x) => {
        const why = R.reason(x) === "temp" ? L("temperature-locked right now", "bloqueado por temperatura ahora") : L("out of stock right now", "agotado ahora");
        R.say(L(`${x.name} is ${why}, so I can't add it.`, `${x.name} está ${why}, así que no puedo agregarlo.`), "warn");
      });
      if (blocked.length) {
        const alt = PRODUCTS.find((x) => x.category === blocked[0].category && R.avail(x) && x.id !== blocked[0].id);
        if (alt) { R.say(L(`Want ${alt.name} instead?`, `¿Le gustaría ${alt.name} en su lugar?`)); R.pending = { type: "add", ids: [alt.id] }; R.chip(`Add ${alt.name}`, `Agregar ${alt.name}`); }
      }
      if (addable.length) {
        const risky = addable.filter((x) => x.highRisk && !(ctx.ackedIds && ctx.ackedIds.includes(x.id)));
        const nameQ = (x) => (qtyOf(x) > 1 ? `${qtyOf(x)} × ${x.name}` : x.name);
        R.say(L(`Sure — adding ${addable.map(nameQ).join(" and ")} to your order.`, `Claro — agregando ${addable.map(nameQ).join(" y ")} a su pedido.`));
        if (risky.length) R.say(L(`Heads-up: ${risky.map((x) => x.name).join(" and ")} can be dangerous if misused, so you'll be asked to confirm you've read the warnings first.`, `Aviso: ${risky.map((x) => x.name).join(" y ")} puede ser peligroso si se usa mal, por eso se le pedirá confirmar que leyó las advertencias.`), "warn");
        addable.forEach((x) => R.actions.push({ type: "add", id: x.id, qty: qtyOf(x) }));
        R.chip("Checkout", "Pagar");
        R.chip("What's in my cart?", "¿Qué hay en mi carrito?");
      }
      R.last = targets[0];
      return true;
    }
    return false;
  }

  // ---- kiosk FAQ ----
  function handleFaq(p, R, ctx) {
    let best = null, bestScore = 0;
    KIOSK_FAQ.forEach((f) => {
      f.triggers.forEach((tr) => {
        if (has(p, tr)) {
          if (tr.split(" ").length === 1 && p.split(" ").length > 4) return; // too weak inside a longer sentence
          const score = tr.split(" ").length * 20 + tr.length;
          if (score > bestScore) { best = f; bestScore = score; }
        }
      });
    });
    if (!best) return false;
    // one-word triggers are too weak on their own inside a long sentence
    if (bestScore < 32 && p.split(" ").length > 6) return false;
    const pct = Math.round((ctx.taxRate || 0.07) * 100);
    R.say(best.answer[R.lang].replace("{tax}", String(pct)));
    if (best.showCare) R.care = true;
    R.topic = best.id;
    if (best.id === "hours" || best.id === "howto") defaultChips(R);
    return true;
  }

  // ---- product-centric ----
  const ALCOHOL_RE = /\b(alcohol|wine|beers?|drinks|drinking|drunk|liquor|vodka|whiskey|cocktail)\b/;

  function handleCompare(p, R, ctx, prods) {
    if (prods.length < 2) return false;
    const cue = /\b(difference|different|compare|comparison|versus|vs|better|stronger|safer|cheaper|which is|which one|or)\b/.test(p);
    const togetherWord = /\b(together|mix|mixing|combine|combining|same time|at once|interact|interaction|interactions)\b/.test(p);
    const withWord = /\b(with|along with|both|after|before|plus)\b|\btake\b.*\band\b/.test(p);
    const questionCue = /\b(can i|could i|is it safe|is it ok|okay to|safe to|should i|do they|will they)\b/.test(p);
    const together = togetherWord || (withWord && questionCue) || /\b(took|had|tome|tomo)\b/.test(p);
    if (together && !/\b(difference|compare|comparison|versus|vs)\b/.test(p)) return handleCombo(p, R, ctx, prods);
    if (!cue) return false;
    const [a, b] = prods;
    const L = R.L;
    const brief = (x) => L(`${x.name} (${x.dosage}) — ${usd(x.price)}\n   For: ${x.uses}\n   Active ingredient: ${x.activeIngredient || "—"}\n   Watch out: ${x.warnings}`,
      `${x.name} (${x.dosage}) — ${usd(x.price)}\n   Para: ${x.uses}\n   Ingrediente activo: ${x.activeIngredient || "—"}\n   Precaución: ${x.warnings}`);
    R.say(L(`Here's how they compare, straight from their labels:\n\n${brief(a)}\n\n${brief(b)}`, `Así se comparan, directo de sus etiquetas:\n\n${brief(a)}\n\n${brief(b)}`));
    const diff = Math.abs(a.price - b.price);
    if (diff > 0.005) {
      const cheaper = a.price < b.price ? a : b;
      R.say(L(`${cheaper.name} is ${usd(diff)} cheaper.`, `${cheaper.name} cuesta ${usd(diff)} menos.`));
    }
    const combos = findInteractions([a, b], R.lang);
    if (combos.length) R.say(L(`Note: don't take these two together — ${combos[0].detail}`, `Nota: no tome estos dos juntos — ${combos[0].detail}`), "warn");
    R.say(DISCLAIMER[R.lang], "system");
    R.products = [a, b];
    R.last = a; R.lastList = [a, b];
    if (R.avail(a)) R.chip(`Add ${a.name}`, `Agregar ${a.name}`);
    if (R.avail(b)) R.chip(`Add ${b.name}`, `Agregar ${b.name}`);
    return true;
  }

  function handleCombo(p, R, ctx, prods) {
    const L = R.L;
    const names = prods.map((x) => x.name);
    const joined = R.lang === "es" ? names.join(" y ") : names.join(" and ");
    const combos = findInteractions(prods, R.lang);
    if (combos.length) {
      R.say(L(`Careful — ${joined} shouldn't ${prods.length > 2 ? "all " : ""}be taken together. ${combos.map((c) => `${c.title}: ${c.detail}`).join(" ")}`, `Cuidado — ${joined} no deben tomarse juntos. ${combos.map((c) => `${c.title}: ${c.detail}`).join(" ")}`), "warn");
    } else {
      R.say(L(`This kiosk's safety checks don't flag ${joined} together. That's not a guarantee it's right for you though:\n${prods.map((x) => `• ${x.name}: ${x.warnings}`).join("\n")}\nAsk a pharmacist if you take other medicines or have health conditions.`,
        `Las revisiones de seguridad de este quiosco no señalan ${joined} juntos. Aun así no es una garantía para usted:\n${prods.map((x) => `• ${x.name}: ${x.warnings}`).join("\n")}\nConsulte a un farmacéutico si toma otros medicamentos o tiene condiciones de salud.`));
    }
    R.say(DISCLAIMER[R.lang], "system");
    // never offer Add on a pair we just warned against — pick one instead
    R.products = combos.length ? [] : prods.slice(0, 3);
    if (combos.length) prods.filter((x) => R.avail(x)).slice(0, 2).forEach((x) => R.chip(`Add ${x.name} only`, `Agregar solo ${x.name}`));
    R.last = prods[0]; R.lastList = prods;
    return true;
  }

  // Remove product names so a product's own name ("pregnancy test") can't be
  // mistaken for the topic of the question ("is it safe in pregnancy?").
  function stripProductNames(p, prods) {
    let out = " " + p + " ";
    prods.forEach((pr) => {
      ALIASES.filter((a) => a.product.id === pr.id).forEach(({ alias }) => {
        out = out.replace(new RegExp(`(?<= )${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?(?= )`, "g"), " ");
      });
    });
    return out.replace(/\s+/g, " ").trim();
  }

  function handleProductMentions(p, keep, R, ctx, prods) {
    if (!prods.length) return false;
    const L = R.L;
    const pr = prods[0];
    const askAlcohol = ALCOHOL_RE.test(p);

    // Two medicines that clash: say so, whatever else was asked.
    if (prods.length >= 2 && !/\b(difference|compare|comparison|versus|vs|better|stronger|cheaper)\b/.test(p) && (findInteractions(prods, R.lang).length || /\b(safe|ok|okay|fine|react|mix|avoid|plus|with|together|and)\b/.test(p))) return handleCombo(p, R, ctx, prods);
    if (prods.length >= 2 && handleCompare(p, R, ctx, prods)) return true;

    // "compare it" / "alternatives to X" with just one product: use same-category siblings.
    if (prods.length === 1 && /\b(compare|comparison|difference|versus|vs|alternative|alternatives|instead of|similar|other options|something else|another (one|option))\b/.test(p)) {
      const sibs = PRODUCTS.filter((x) => x.category === pr.category && x.id !== pr.id && R.avail(x));
      if (sibs.length) {
        const wantsCompare = /\b(compare|comparison|difference|versus|vs)\b/.test(p);
        if (wantsCompare) return handleCompare(p + " vs", R, ctx, [pr, sibs[0]]);
        R.say(L(`Other options in ${categoryLabel(R, pr.category)} besides ${pr.name}:\n${sibs.slice(0, 4).map((x) => productLine(R, x)).join("\n")}`, `Otras opciones en ${categoryLabel(R, pr.category)} además de ${pr.name}:\n${sibs.slice(0, 4).map((x) => productLine(R, x)).join("\n")}`));
        R.products = sibs.slice(0, 3); R.last = sibs[0]; R.lastList = sibs;
        return true;
      }
    }

    // alcohol
    if (askAlcohol) {
      const mentions = /alcohol/i.test(pr.warnings || "");
      if (mentions) R.say(L(`On alcohol, ${pr.name}'s label warns: ${pr.warnings}`, `Sobre el alcohol, la etiqueta de ${pr.name} advierte: ${pr.warnings}`));
      else R.say(L(`${pr.name}'s label doesn't specifically mention alcohol, but alcohol can add to side effects of many medicines. Ask a pharmacist before combining them — its warning is: ${pr.warnings}`, `La etiqueta de ${pr.name} no menciona específicamente el alcohol, pero el alcohol puede sumarse a los efectos secundarios de muchos medicamentos. Consulte a un farmacéutico antes de combinarlos — su advertencia es: ${pr.warnings}`));
      R.say(DISCLAIMER[R.lang], "system");
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }

    // "is X good for Y" / "can I use X for Y"
    const forMatch = p.match(/\b(?:good|ok|okay|safe|effective|work|works|help|helps|use|used|take|best)\b.*?\bfor\b\s+(?:my\s+|a\s+|an\s+|the\s+)?(.+)$/);
    if (forMatch && !/\b(how (do|to|often|much|many|long)|dose|dosage|directions)\b/.test(p) && !/\b(kids|children|child|adults|baby|babies|pregnan\w*|elderly|seniors)\b/.test(forMatch[1]) && forMatch[1].split(" ").length <= 5) {
      const target = forMatch[1];
      const res = classify(target);
      const topic = findTopics(target)[0];
      const fits = (res.type === "products" && res.products.some((x) => x.id === pr.id)) || (topic && topic.products.includes(pr.id));
      if (fits) {
        R.say(L(`Yes — ${pr.name} is meant for that. Its label says: ${pr.uses}`, `Sí — ${pr.name} sirve para eso. Su etiqueta dice: ${pr.uses}`));
      } else {
        R.say(L(`${pr.name}'s label doesn't list that use. It's for: ${pr.uses}`, `La etiqueta de ${pr.name} no incluye ese uso. Sirve para: ${pr.uses}`));
        const better = res.type === "products" ? res.products.filter((x) => x.id !== pr.id).slice(0, 3) : [];
        if (better.length) { R.say(L(`For "${target}", this kiosk has: ${better.map((x) => x.name).join(", ")}.`, `Para "${target}", este quiosco tiene: ${better.map((x) => x.name).join(", ")}.`)); R.products = better; }
      }
      R.say(SOURCE_NOTE[R.lang] + " " + DISCLAIMER[R.lang], "system");
      if (!R.products.length) R.products = [pr];
      R.last = pr; R.lastList = R.products.slice();
      followUpChips(R, pr);
      return true;
    }

    // in stock / do you have
    if (/\b(in stock|available|do you have|do you carry|do you sell|is there|got any|have any|any left|still have)\b/.test(p) && !/\b(warnings?|dose|dosage|how|side effects?)\b/.test(p)) {
      const r = R.reason(pr);
      if (!r) {
        R.say(L(`Yes — ${pr.name} is in stock for ${usd(pr.price)}${pr.ageRestricted ? " (ID required at checkout)" : ""}.`, `Sí — ${pr.name} está disponible por ${usd(pr.price)}${pr.ageRestricted ? " (se requiere ID al pagar)" : ""}.`));
        R.pending = { type: "add", ids: [pr.id] };
        R.chip(`Add ${pr.name}`, `Agregar ${pr.name}`);
      } else {
        const list = withAlternative(R, [pr, ...PRODUCTS.filter((x) => x.category === pr.category && x.id !== pr.id)]);
        R.products = [list[0]];
      }
      R.products = R.products.length ? R.products : [pr];
      R.last = pr; R.lastList = R.products.slice();
      return true;
    }

    // where
    if (/\bwhere\b.*\b(is|find|can i find|do i find|are|would i find|located|get)\b/.test(p) || /\bwhere (can|do) i (find|get|buy)\b/.test(p)) {
      R.say(L(`${pr.name} is under ${categoryLabel(R, pr.category)}. Tap Add and it's dispensed from slot ${pr.slot} after you pay.`, `${pr.name} está en ${categoryLabel(R, pr.category)}. Toque Agregar y se dispensa desde la ranura ${pr.slot} después de pagar.`));
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }

    // pack size
    if (/\bhow many\b.*\b(are|come|comes|in|does|do you get|pieces|pills|tablets|caplets|patches)\b(?!.*\b(take|per day|a day|daily)\b)|\b(pack size|what size|how big|package size)\b/.test(p) && !/\b(take|dose|per day|a day|daily|can i)\b/.test(p)) {
      R.say(L(`${pr.name} comes as: ${pr.dosage}.`, `${pr.name} viene en presentación de: ${pr.dosage}.`));
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }

    // age restriction
    if (/\b(id|age|old enough|minor|underage|under 18)\b/.test(p) && !ALCOHOL_RE.test(p) && /\b(need|require|required|restricted|allowed|buy|old|who can)\b/.test(p)) {
      R.say(pr.ageRestricted
        ? L(`Yes — ${pr.name} is age-restricted, so you'll scan a valid photo ID at checkout. (Its label: ${pr.warnings})`, `Sí — ${pr.name} tiene restricción de edad, así que escaneará una identificación válida al pagar. (Su etiqueta: ${pr.warnings})`)
        : L(`No — ${pr.name} isn't age-restricted here, so no ID is needed.`, `No — ${pr.name} no tiene restricción de edad aquí, así que no se necesita ID.`));
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      return true;
    }

    // "is 2 ibuprofen ok?" / "can I take 3?" — answer from the label's own limits
    if (/\b(is|are|can i|could i|should i|ok|okay|safe)\b/.test(p) && /\b(\d+|two|three|four|five|six|several|a few|some|double|extra)\b/.test(p.replace(/\bspf \d+\b|\b\d+ ?(mg|ml|oz)\b|\bextra (strength|fuerte)\b/g, "")) && !/\$|\b(dollar|dollars|cost|price|cents)\b/.test(p)) {
      R.say(L(`Here's what ${pr.name}'s label says about how much to take: ${pr.instructions} Don't take more than the label allows, and ask a pharmacist if you're unsure.`, `Esto dice la etiqueta de ${pr.name} sobre cuánto tomar: ${pr.instructions} No tome más de lo que permite la etiqueta y consulte a un farmacéutico si tiene dudas.`));
      R.say(SOURCE_NOTE[R.lang] + " " + DISCLAIMER[R.lang], "system");
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }

    // label-grounded Q&A (uses/warnings/dosage/allergy/ingredient/price/...)
    const pq = stripProductNames(p, prods);
    const cat = detectQuestionCategory(pq);
    if (cat && cat.key === "special") {
      const childSpecific = /child|teen|under \d/i.test(pr.warnings || "");
      R.say(childSpecific
        ? L(`Good question — ${pr.name}'s label specifically warns: ${pr.warnings} For pregnancy, nursing, or anything for a child, please check with a pharmacist or doctor first.`,
          `Buena pregunta — la etiqueta de ${pr.name} advierte específicamente: ${pr.warnings} Para embarazo, lactancia o cualquier uso en un niño, consulte primero a un farmacéutico o médico.`)
        : L(`${pr.name}'s directions are written for adults. If you're pregnant, nursing, or it's for a child, please check with a pharmacist or doctor first — they can confirm the right choice and dose.`,
          `Las instrucciones de ${pr.name} son para adultos. Si está embarazada, amamantando o es para un niño, consulte primero a un farmacéutico o médico — pueden confirmar la opción y dosis correctas.`));
      R.say(DISCLAIMER[R.lang], "system");
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }
    const qa = answerMedQuestion(pq, pr, R.lang);
    if (qa) {
      R.say(qa.reply);
      R.say(qa.sourced ? SOURCE_NOTE[R.lang] + " " + DISCLAIMER[R.lang] : DISCLAIMER[R.lang], "system");
      const risk = pr.highRisk ? L(`Because ${pr.name} can be dangerous if misused, you'll confirm you've read its warnings before adding it.`, `Como ${pr.name} puede ser peligroso si se usa mal, confirmará que leyó sus advertencias antes de agregarlo.`) : null;
      if (risk && /warning|danger|safe|side effect|overdose|too much/.test(p)) R.say(risk, "warn");
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }

    if (prods.length >= 2) {
      const [a, b] = prods;
      R.say(L(`${a.name} — ${usd(a.price)}: ${a.uses}\n\n${b.name} — ${usd(b.price)}: ${b.uses}`, `${a.name} — ${usd(a.price)}: ${a.uses}\n\n${b.name} — ${usd(b.price)}: ${b.uses}`));
      R.products = [a, b]; R.last = a; R.lastList = [a, b];
      R.chip(`Compare ${a.name} and ${b.name}`, `Compara ${a.name} y ${b.name}`);
      R.chip(`Can I take ${a.name} with ${b.name}?`, `¿Puedo tomar ${a.name} con ${b.name}?`);
      return true;
    }

    // just a product name (or "tell me about X")
    const short = p.split(" ").length <= 7;
    if (short || /\b(tell me about|about|info|information|details|what is|whats)\b/.test(p)) {
      const r = R.reason(pr);
      R.say(L(`${pr.name} — ${pr.dosage}, ${usd(pr.price)}${r ? (r === "temp" ? " (temperature-locked right now)" : " (out of stock right now)") : ""}.\nUsed for: ${pr.uses}`, `${pr.name} — ${pr.dosage}, ${usd(pr.price)}${r ? (r === "temp" ? " (bloqueado por temperatura ahora)" : " (agotado ahora)") : ""}.\nSe usa para: ${pr.uses}`));
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }
    return false;
  }

  // ---- catalog browsing ----
  function handleCatalog(p, keep, R, ctx) {
    const L = R.L;
    const cat = findCategory(p);
    const underN = p.match(/\b(?:under|below|less than|max|at most|no more than|cheaper than)\s*\$?(\d+(?:\.\d+)?)/);
    const priceCue = /\b(cheapest|cheap|least expensive|lowest price|most affordable|budget|most expensive|priciest|highest price)\b/.test(p) || !!underN;
    const listCue = /\b(show|list|what|which|any|got|have|options|types|kinds|browse|see|carry|sell|selection|items|products|do you have|whats)\b/.test(p);
    const overview = /\b(what (do|can) you (have|sell|carry|offer)|what products|what items|whats available|what is available|show (me )?(everything|all)|list (all|everything)|catalog|inventory|everything you (have|sell)|all (items|products)|what do you stock)\b/.test(p);
    const stockList = /\b(out of stock|sold out|unavailable|not available|whats missing|what is missing)\b/.test(p);

    if (stockList) {
      const out = PRODUCTS.filter((x) => !R.avail(x));
      R.say(out.length
        ? L(`Right now these aren't available:\n${out.map((x) => productLine(R, x)).join("\n")}`, `Ahora mismo estos no están disponibles:\n${out.map((x) => productLine(R, x)).join("\n")}`)
        : L("Everything is in stock and available right now.", "Todo está disponible ahora mismo."));
      return true;
    }

    if (priceCue) {
      // price-ranked lists, optionally within a category or for a symptom
      let pool = cat ? PRODUCTS.filter((x) => x.category === cat) : PRODUCTS.slice();
      const sym = classify(keep);
      if (!cat && sym.type === "products") pool = PRODUCTS.filter((x) => sym.products.some((y) => y.id === x.id) || x.keywords.some((k) => phraseMatches(keep, k)));
      pool = pool.filter((x) => R.avail(x));
      const under = underN;
      if (under) pool = pool.filter((x) => x.price <= parseFloat(under[1]));
      if (!pool.length) return false;
      const desc = /\b(most expensive|priciest|highest price)\b/.test(p);
      pool.sort((a, b) => (desc ? b.price - a.price : a.price - b.price));
      const top = pool.slice(0, under ? 6 : 3);
      const label = under ? L(`Items ${usd(parseFloat(under[1]))} or less${cat ? " in " + categoryLabel(R, cat) : ""}`, `Artículos de ${usd(parseFloat(under[1]))} o menos${cat ? " en " + categoryLabel(R, cat) : ""}`)
        : desc ? L("The priciest options", "Las opciones más caras") : L("The most affordable options", "Las opciones más económicas");
      R.say(`${label}:\n${top.map((x) => productLine(R, x)).join("\n")}`);
      R.products = top.slice(0, 3); R.last = top[0]; R.lastList = top;
      return true;
    }

    if (cat && (listCue || p.split(" ").length <= 4)) {
      const list = PRODUCTS.filter((x) => x.category === cat);
      R.say(L(`${categoryLabel(R, cat)} — ${list.length} items:\n${list.map((x) => productLine(R, x)).join("\n")}`, `${categoryLabel(R, cat)} — ${list.length} artículos:\n${list.map((x) => productLine(R, x)).join("\n")}`));
      R.products = list.filter((x) => R.avail(x)).slice(0, 3);
      R.last = list[0]; R.lastList = list;
      R.actions.push({ type: "browse", category: cat });
      R.chip("What's the cheapest?", "¿Cuál es el más barato?");
      return true;
    }

    if (overview && !findTopics(p).length && classify(keep).type !== "products") {
      const groups = CATEGORIES.map((c) => `• ${categoryLabel(R, c.id)}: ${PRODUCTS.filter((x) => x.category === c.id).length}`);
      R.say(L(`I have ${PRODUCTS.length} over-the-counter items in ${CATEGORIES.length} groups:\n${groups.join("\n")}\nTell me a symptom or pick a group and I'll narrow it down.`, `Tengo ${PRODUCTS.length} artículos de venta libre en ${CATEGORIES.length} grupos:\n${groups.join("\n")}\nDígame un síntoma o elija un grupo y lo reduzco.`));
      CATEGORIES.forEach((c) => R.chip(CATEGORY_LABELS.en[c.id], CATEGORY_LABELS.es[c.id]));
      return true;
    }
    return false;
  }

  // ---- first aid + symptoms ----
  const HOWTO_RE = /\b(what is|what are|tell me about|explain|info(rmation)? (on|about)|how (do|can|should|to|would)|what (should|do|can|to) (i|we|you) do|what to do|first aid|treat|treatment|remedy|remedies|home remedy|get rid of|cure|tips|advice|self care|steps|cope|deal with|handle|soothe|relieve|stop|reduce|prevent|signs of|symptoms of|when (should|do|to)|is it serious|should i (worry|be worried|see|go|call))\b/;

  function stepsBlock(R, tp, max) {
    const steps = tp.steps[R.lang].slice(0, max || 99);
    return `${tp.title[R.lang]}:\n${steps.map((s) => "• " + s).join("\n")}`;
  }

  const STAFF_NOTE = { en: "This kiosk doesn't sell any medicine you swallow. If you think you need some, please ask the staff at the front desk or your care team.", es: "Este quiosco no vende medicamentos que se tragan. Si cree que necesita alguno, pregunte al personal de la recepción o a su equipo de atención." };

  function handleHealth(p, keep, R, ctx) {
    const L = R.L;
    const topics = findTopics(p).slice(0, 2);
    const res = classify(keep);

    if (res.type === "not_equipped" && !topics.length) {
      R.say(L("This machine isn't equipped for that, or it's a prescription-only medicine. Please see a doctor or pharmacy — here are the closest ones.", "Esta máquina no está equipada para eso, o es un medicamento con receta. Consulte a un médico o farmacia — estas son las más cercanas."), "warn");
      R.care = true;
      return true;
    }

    if (topics.length) {
      const asksHow = HOWTO_RE.test(p);
      const asksWhen = /\b(when (should|do|to)|is it serious|should i (worry|be worried|see|go|call)|see a doctor|go to the (er|hospital))\b/.test(p);
      R.topic = topics[0].id;
      // product list: symptom-scored products first, then topic suggestions
      let list = [];
      if (res.type === "products") list.push(...res.products);
      topics.forEach((tp) => tp.products.forEach((id) => { const x = PRODUCTS.find((y) => y.id === id); if (x && !list.includes(x)) list.push(x); }));

      const atDesk = topics.some((tp) => tp.medsAtDesk);
      if (topics[0].id === "whentogo" || topics[0].id === "safety" || topics[0].id === "poison") {
        R.say(stepsBlock(R, topics[0]));
        R.say(FIRSTAID_SOURCE[R.lang], "system");
        if (topics[0].showCare) R.care = true;
        R.chip("Where am I?", "¿Dónde estoy?");
        return true;
      }

      if (asksHow || asksWhen) {
        topics.forEach((tp, i) => {
          if (asksWhen && !asksHow) {
            R.say(L(`${tp.title.en} — get medical help if ${tp.seek.en || "symptoms are severe, get worse, or worry you"}`, `${tp.title.es} — busque atención médica si ${tp.seek.es || "los síntomas son graves, empeoran o le preocupan"}`), "warn");
          } else {
            R.say(stepsBlock(R, tp));
            if (tp.seek[R.lang]) R.say(L(`Get medical help if: ${tp.seek.en}`, `Busque atención médica si: ${tp.seek.es}`), "warn");
          }
        });
        if (list.length) {
          const avail = list.filter((x) => R.avail(x));
          const show = withAlternative(R, list).slice(0, 3);
          R.say(L(`Supplies from this kiosk that can help: ${show.map((x) => x.name).join(", ")}.`, `Suministros de este quiosco que pueden ayudar: ${show.map((x) => x.name).join(", ")}.`));
          R.products = show;
          if (avail[0]) { R.pending = { type: "add", ids: [avail[0].id] }; R.chip(`Add ${avail[0].name}`, `Agregar ${avail[0].name}`); }
          R.last = show[0]; R.lastList = show;
        }
        if (atDesk) R.say(R.L(STAFF_NOTE.en, STAFF_NOTE.es));
        R.say(FIRSTAID_SOURCE[R.lang], "system");
        R.chip("When should I see a doctor?", "¿Cuándo debo ir al médico?");
        R.chip("Where am I?", "¿Dónde estoy?");
        return true;
      }

      // statement of a symptom: recommend + brief tips + red flags
      list = list.slice(0, 3);
      const shown = withAlternative(R, list);
      R.say(topics.length > 1
        ? L(`Sorry you're dealing with ${topics.map((x) => x.title.en.split(/[,&]/)[0].trim().toLowerCase()).join(" and ")}. `, `Lamento que tenga ${topics.map((x) => x.title.es.split(/[,]| y /)[0].trim().toLowerCase()).join(" y ")}. `) + (shown.length ? L(`From this kiosk, these could help: ${shown.slice(0, 3).map((x) => x.name).join(", ")}.`, `De este quiosco, esto podría ayudar: ${shown.slice(0, 3).map((x) => x.name).join(", ")}.`) : L("Here's what can help:", "Esto puede ayudar:"))
        : L("Sorry you're dealing with that. ", "Lamento que esté pasando por eso. ") + (shown.length ? (shown.length === 1 ? L(`Here's what's labeled for that: ${shown[0].name}.`, `Esto está etiquetado para eso: ${shown[0].name}.`) : L(`Options labeled for that: ${shown.map((x) => x.name).join(", ")}.`, `Un par de opciones que deberían ayudar: ${shown.map((x) => x.name).join(", ")}.`)) : ""));
      R.products = shown;
      if (atDesk) R.say(R.L(STAFF_NOTE.en, STAFF_NOTE.es));
      topics.forEach((tp) => {
        R.say(L(`Self-care tips (${tp.title.en}):\n${tp.steps.en.slice(0, 2).map((s) => "• " + s).join("\n")}`, `Cuidados en casa (${tp.title.es}):\n${tp.steps.es.slice(0, 2).map((s) => "• " + s).join("\n")}`));
        if (tp.seek[R.lang]) R.say(L(`Get medical help if: ${tp.seek.en}`, `Busque atención médica si: ${tp.seek.es}`), "warn");
      });
      R.say(FIRSTAID_SOURCE[R.lang], "system");
      const first = shown.find((x) => R.avail(x));
      if (first) { R.pending = { type: "add", ids: [first.id] }; R.chip(`Add ${first.name}`, `Agregar ${first.name}`); }
      R.chip("What are the warnings?", "¿Cuáles son las advertencias?");
      R.chip("How do I take it?", "¿Cómo se toma?");
      R.chip("When should I see a doctor?", "¿Cuándo debo ir al médico?");
      R.last = shown[0] || undefined; R.lastList = shown;
      return true;
    }

    if (res.type === "products") {
      const shown = withAlternative(R, res.products);
      R.say(shown.length === 1
        ? L(`Here's something that should help: ${shown[0].name}.`, `Esto debería ayudar: ${shown[0].name}.`)
        : L(`A couple of options that should help: ${shown.map((x) => x.name).join(", ")}.`, `Un par de opciones que deberían ayudar: ${shown.map((x) => x.name).join(", ")}.`));
      R.products = shown;
      R.say(DISCLAIMER[R.lang], "system");
      const first = shown.find((x) => R.avail(x));
      if (first) { R.pending = { type: "add", ids: [first.id] }; R.chip(`Add ${first.name}`, `Agregar ${first.name}`); }
      R.chip("What are the warnings?", "¿Cuáles son las advertencias?");
      R.last = shown[0]; R.lastList = shown;
      return true;
    }
    return false;
  }

  function handleNearby(p, R) {
    if (rx(p, /^(the )?(nearest |closest )?(urgent care|er|emergency room|hospital|pharmacy|clinic|doctor|drugstore)( near me| nearby)?$/) || rx(p, /\b(nearest|closest|near me|nearby|close by|around here|near here)\b.*\b(er|emergency room|hospital|urgent care|pharmacy|drugstore|doctor|clinic|walk in|care)\b|\bwhere\b.*\b(hospital|er|emergency room|urgent care|pharmacy|clinic|doctor)\b|\b(nearby care|nearest er|nearest hospital|find a doctor|find a pharmacy|call an ambulance)\b/)) {
      R.say(R.L(`You're at ${KIOSK_SITE.name}, ${KIOSK_SITE.address}, ${KIOSK_SITE.phone}. The emergency department is right here in this hospital. For anything urgent, tell the staff at the front desk right away, or call 911. They can also help with pharmacy questions.`,
        `Está en ${KIOSK_SITE.name}, ${KIOSK_SITE.address}, ${KIOSK_SITE.phone}. La sala de emergencias está aquí mismo, en este hospital. Si es urgente, avise de inmediato al personal de la recepción o llame al 911. También pueden ayudarle con preguntas de farmacia.`));
      return true;
    }
    return false;
  }

  function outOfScope(p) {
    return rx(p, /\b(weather|forecast|news|stock market|sports?|score|movie|recipe|homework|capital of|who won|president|bitcoin|crypto|translate this|write me|poem|essay|code|lottery|horoscope|song|lyrics)\b/);
  }

  // ------------------------------------------------------------------
  // Main entry
  // ------------------------------------------------------------------
  let built = false;
  function ensureBuilt() {
    if (built) return;
    built = true;
    buildAliases();
    HEALTH_TOPICS.forEach((tp) => { tp.triggers.forEach(addVocab); });
    KIOSK_FAQ.forEach((f) => f.triggers.forEach(addVocab));
    Object.values(CATEGORY_ALIASES).flat().forEach(addVocab);
    ["prescription", "acetaminophen", "ibuprofen", "aspirin", "antihistamine", "decongestant", "antacid", "sunscreen", "sanitizer", "tampons", "pregnancy", "diarrhea", "headache", "stomach", "nausea", "cough", "allergy", "bandage", "ointment", "gauze", "electrolyte", "checkout", "cheapest", "compare", "difference", "together", "warnings", "dosage", "symptoms", "emergency", "pharmacy"].forEach((w) => VOCAB.add(w));
  }

  function respond(raw, ctx) {
    ensureBuilt();
    ctx = ctx || {};
    raw = medFix(String(raw).slice(0, 2000).replace(/\bband-?(iad|ad|aidd|aaid|ai)s?\b/gi, "band aid")); // shortcut: long input is cut off, nobody types more than this at a kiosk
    const keep0 = normKeep(raw);
    const plain0 = toPlain(keep0);
    const tr = toEnglish(plain0);
    const lang = tr.es || ctx.lang === "es" ? "es" : "en";
    const R = newResp(lang, ctx);
    if (!plain0) {
      if (raw.trim()) { R.say(R.L("Tell me a symptom or an item and I'll help.", "Dígame un síntoma o un artículo y le ayudo.")); defaultChips(R); }
      return R;
    }
    // Answer to "how old is your child?": rerun the original question with the age in it.
    if (ctx.pending && ctx.pending.type === "askAge" && plain0.split(" ").length <= 5 && !redFlag(raw)) {
      const m = plain0.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)\b/);
      if (m) {
        const unit = /\b(month|mes)/.test(plain0) ? "month" : /\b(week|semana)/.test(plain0) ? "week" : "year";
        return respond(`${ctx.pending.text} for my ${m[1]} ${unit} old`, Object.assign({}, ctx, { pending: null }));
      }
    }

    // Spoken filler ("actually remove that") and catch-all phrasings go to the handler that already answers them.
    let p0 = tr.text;
    SYMPTOM_WORDS.forEach(([re, to]) => { p0 = p0.replace(re, to); }); // before spell-correction can garble them
    let p = correct(p0).replace(/^(actually|wait|hmm+|um+|uh+|oh|well|ok|okay|sorry|bro|yo|ugh)[, ]+(?=\S)/, "").replace(/[, ]+(please|thanks|thank you|pls)$/, "");
    SYMPTOM_WORDS.forEach(([re, to]) => { p = p.replace(re, to); });
    if (/^what (else )?(do you have|do you sell|do you carry|have you got)$/.test(p)) p = "show me everything";
    if (/\b(thanks|thank you)\b/.test(p) && p.split(" ").length <= 5) p = "thanks";
    const keep = (keep0 + " " + p).trim(); // legacy lists match on original + corrected wording
    const said = detectConditions(raw);
    if (said.allergy) p = p.replace(/\b(allerg(ic|y|ies))\b/g, "sensitive"); // "allergic to aspirin" isn't a hay-fever topic
    const prods = NOT_CARRIED.some((n) => n.re.test(p + " " + plain0) && !/only has over-the-counter/.test(n.en)) ? [] : findProducts(p);
    // "the second one" points at the list we just showed.
    const ordinal = ordinalPick(p, ctx.lastList || []);
    if (ordinal && !prods.length) prods.push(ordinal);
    // Products the person can't safely take ("I'm allergic to aspirin") stop being the
    // subject of the question; applyConditions still names them in its warning.
    const cond = mergeProfile(ctx.profile, said);
    const askedIds = prods.map((x) => x.id);
    if (hasConditions(cond)) for (let i = prods.length - 1; i >= 0; i--) if (productConflicts(prods[i], cond).length) prods.splice(i, 1);
    // pronoun resolution for follow-ups
    const usesPronoun = /\b(it|this|that|these|those|the medicine|this medicine|this one|that one|them)\b/.test(p);
    const topicsHere = findTopics(p).length;
    const forCue = /\b(good|ok|okay|safe|work|works|help|helps|effective)\b.*\bfor\b/.test(p);
    const followUp = (detectQuestionCategory(p) || (typeof isQuestionLike === "function" && isQuestionLike(p))) && (!topicsHere || (usesPronoun && forCue));
    const shortFollowUp = detectQuestionCategory(p) && p.split(" ").length <= 8; // e.g. "what about for kids?"
    // "can I take aspirin with it / with what's in my cart?" — pair with the last product or the cart.
    const withCue = /\b(with|together|along with|mix|combine)\b/.test(p) && /\b(can i|could i|is it safe|is it ok|okay|safe|should i|do they|will they|interact)\b/.test(p);
    if (withCue && prods.length === 1 && usesPronoun && ctx.lastProduct && ctx.lastProduct.id !== prods[0].id) prods.unshift(ctx.lastProduct);
    if (withCue && prods.length >= 1 && /\b(my cart|my order|the cart|what i have|what i picked|what i added)\b/.test(p) && ctx.cart && ctx.cart.length) {
      ctx.cart.forEach((c) => { if (!prods.some((x) => x.id === c.product.id)) prods.push(c.product); });
    }
    const prodsOrLast = prods.length ? prods : ((usesPronoun || shortFollowUp) && followUp && ctx.lastProduct ? [ctx.lastProduct] : []);

    if (handleLookalike(raw, R)) return R;
    if (handleEmergency(raw, R)) return R;
    R.cond = cond;
    R.askedIds = askedIds;
    R.rawText = raw;
    if (cond.pregnant && !cond.maybePregnant && askedIds.includes("acetaminophen") && askedIds.length === 1) {
      R.say(R.L("Acetaminophen is generally what doctors reach for first in pregnancy, at the lowest dose for the shortest time. Please confirm with your OB, because it depends on you.", "El acetaminofén suele ser lo primero que usan los médicos en el embarazo, en la dosis más baja por el menor tiempo. Confírmelo con su obstetra, porque depende de usted."), "warn");
      R.askedIds = [];
      return finish(R, ctx);
    }
    if (handleMisuse(p, R)) return finish(R, ctx);
    if (handleForget(p, R)) return finish(R, ctx);
    if (handleIngredient(safetyNormalize(raw), p, R, ctx, prods)) {
      // A question about what's in something isn't a statement about the person ("contain ethyl alcohol").
      R.cond = ctx.profile || {}; R.askedIds = [];
      return finish(R, ctx);
    }
    if (handleInactiveQuestion(said, askedIds, R)) return finish(R, ctx);
    if (handleAllergyStatement(said, cond, askedIds, p, R)) return finish(R, ctx);
    if (handleShelfQuestion(p, R)) return finish(R, ctx);
    if (handleNotCarried(p + " " + plain0, R)) return finish(R, ctx);
    if (handleSmallTalk(p, R, ctx)) return finish(R, ctx);
    if (cond.maybePregnant && !prods.length) {
      R.say(R.L("This kiosk has a pregnancy test. Until you know, check with a pharmacist or doctor before taking any medicine.", "Este quiosco tiene una prueba de embarazo. Hasta saberlo, consulte a un farmacéutico o médico antes de tomar cualquier medicamento."));
      const test = PRODUCTS.find((x) => x.id === "pregnancytest");
      if (R.avail(test)) { R.products = [test]; R.chip(`Add ${test.name}`, `Agregar ${test.name}`); }
      return finish(R, ctx);
    }
    if (handleVague(p + " " + plain0, R)) return finish(R, ctx);
    if (handleQuantity(p, R, ctx, prods)) return finish(R, ctx);
    if (handleCart(p, R, ctx, prods)) return finish(R, ctx);
    const labelTarget = prods.length === 1 ? prods[0] : !prods.length && (usesPronoun || /^how much is$/.test(p)) ? ctx.lastProduct : null;
    if (labelTarget && handleLabelQuestion(p, R, labelTarget)) return finish(R, ctx);
    if (!prods.length && handleListQuestion(p, R, ctx)) return finish(R, ctx);
    // "what's the difference" after looking at two items
    if (!prods.length && /\b(difference|compare|which is better)\b/.test(p)) {
      const pair = (ctx.lastList || []).length > 1 ? ctx.lastList.slice(0, 2) : ctx.lastProduct && ctx.prevProduct ? [ctx.prevProduct, ctx.lastProduct] : null;
      if (pair && handleCompare(p + " vs", R, ctx, pair)) return finish(R, ctx);
    }
    if (handleNearby(p, R)) return finish(R, ctx);
    // "it's for my 5 year old" / "estoy embarazada" after a list: re-check that list for this person.
    if (hasConditions(cond) && !prods.length && !topicsHere && (ctx.lastList || []).length && p.split(" ").length <= 10) {
      R.products = ctx.lastList.filter((x) => R.avail(x)).slice(0, 3);
      if (R.products.some((x) => !productConflicts(x, cond).length)) R.say(R.L("Thanks — that changes what's safe. Here's what still fits:", "Gracias — eso cambia lo que es seguro. Esto es lo que sigue siendo adecuado:"));
      R.chip("Where is the nearest pharmacy?", "¿Dónde está la farmacia más cercana?");
      R.lastList = ctx.lastList;
      return finish(R, ctx);
    }
    if (prods.length && handleProductMentions(p, keep, R, ctx, prods)) return finish(R, ctx);
    if (handleFaq(p, R, ctx)) return finish(R, ctx);
    if (!prods.length && prodsOrLast.length && handleProductMentions(p, keep, R, ctx, prodsOrLast)) return finish(R, ctx);
    if (handleCatalog(p, keep, R, ctx)) return finish(R, ctx);
    if (handleHealth(p, keep, R, ctx)) return finish(R, ctx);

    // Everything they asked about was ruled out: the warning from applyConditions is the answer.
    if (askedIds.length && !prods.length && askedIds.some((id) => productConflicts(PRODUCTS.find((x) => x.id === id), cond).length)) return finish(R, ctx);
    if (usesPronoun && !ctx.lastProduct && isQuestionLike(p)) {
      R.say(R.L("Which item do you mean? Tell me its name and I'll check the label.", "¿A qué artículo se refiere? Dígame el nombre y reviso la etiqueta."));
      R.say(R.L("If this is about something serious or sudden, tell the staff at the front desk right away, or call 911.", "Si se trata de algo grave o repentino, avise de inmediato al personal de la recepción o llame al 911."), "warn");
      defaultChips(R);
      return finish(R, ctx);
    }
    // Fallback: typo hints, out-of-scope, or a gentle nudge.
    if (outOfScope(p)) {
      R.say(R.L("That's outside what I can help with — I have no internet here, and I only know this kiosk's products, label facts, and basic first aid. Try asking me about a symptom or an item!",
        "Eso está fuera de lo que puedo hacer — aquí no tengo internet y solo conozco los productos del quiosco, los datos de las etiquetas y primeros auxilios básicos. ¡Pregúnteme sobre un síntoma o un artículo!"));
      defaultChips(R);
      return finish(R, ctx);
    }
    const hint = didYouMean(p);
    if (hint.length) {
      R.say(R.L(`I'm not sure I understood. Did you mean one of these?`, `No estoy seguro de haber entendido. ¿Quiso decir alguna de estas?`));
      hint.forEach((h) => R.chips.push(h));
    } else {
      const isQ = typeof isQuestionLike === "function" && isQuestionLike(raw);
      R.say(isQ
        ? R.L("I can really only speak to this kiosk's items, first aid, and how the kiosk works — try naming an item, like \"what are the warnings for Neosporin?\", or describe a symptom like \"sore throat\".", "Solo puedo hablar de los artículos del quiosco, primeros auxilios y cómo funciona el quiosco — intente nombrar un artículo, como \"¿cuáles son las advertencias de Neosporin?\", o describa un síntoma como \"dolor de garganta\".")
        : R.L("I didn't catch that one. Try telling me what hurts or what happened, like \"my knee hurts\" or \"I cut my finger,\" and I'll see what this kiosk has.", "No entendí bien. Dígame qué le duele o qué pasó, como \"me duele la rodilla\" o \"me corté un dedo\", y veré qué tiene este quiosco."));
      // Rules can't list every emergency: anything unrecognized gets the way out, not just a shrug.
      R.say(R.L("If this feels serious or sudden, tell the staff at the front desk right away, or call 911.", "Si esto parece grave o repentino, avise de inmediato al personal de la recepción o llame al 911."), "warn");
      defaultChips(R);
    }
    R.care = true;
    return finish(R, ctx);
  }

  function didYouMean(p) {
    const cands = new Map();
    p.split(" ").forEach((tok) => {
      if (tok.length < 4 || COMMON.has(tok) || VOCAB.has(tok)) return;
      const near = nearestLoose(tok);
      if (near) near.forEach((n) => cands.set(n, true));
    });
    return [...cands.keys()].slice(0, 3);
  }
  function nearestLoose(tok) {
    const out = [];
    for (const { alias, product } of ALIASES) {
      if (alias.length < 4 || alias.includes(" ")) continue;
      if (lev(tok, alias, 2) <= 2 && !out.includes(product.name)) out.push(product.name);
      if (out.length >= 2) break;
    }
    return out;
  }

  // Everyday phrasing → the words the health topics are written in. Red flags already ran on the raw text.
  const BODY_ACHE = /\b(?:my |the |this |sore |stiff )?(?:neck|shoulders?|knees?|hips?|elbows?|wrists?|ankles?|feet|foot|legs?|arms?|hands?|fingers?|thumbs?|toes?|ribs?|calf|calves|thighs?|shin|shins|hamstring|quad|glutes?|traps?|muscles?|joints?)\b(?: is| are| has been| keeps?| feels?| really| so)* (?:is killing me|are killing me|killing me|hurts?|hurting|sore|aches?|aching|achy|stiff|throbbing|is bothering me|are bothering me|bothering me|acting up|in pain|is in pain|is messed up|tight|locked up|pain)\b/;
  const SYMPTOM_WORDS = [
    [/\bi (nicked|sliced|knicked|gashed|pricked|cut) (my|myself)\b(?!.*\b(on purpose|wont stop)\b).*|\b(a|got a) (nick|knick|small cut|cut) on my \w+\b|\b(nicked|sliced|knicked|gashed) (my|myself)\b.*|\bshaving (cut|nick)\b|\brazor (cut|burn|nick)\b|\bcut (myself )?shaving\b|\bhangnail\b/, "minor cut"],
    [/\bstubbed my toe\b|\bjammed my (finger|thumb|toe)\b|\bbanged my \w+\b|\bbumped my \w+\b|\bwhacked my \w+\b/, "bruise"], [/\bcharley horse\b|\bleg cramps?\b|\bshin splints\b|\bsore from (the )?(gym|workout|running|lifting)\b|\bslept wrong\b|\bcrick in my neck\b|\bthrew my back out\b|\bmy back went out\b/, "muscle pain"],
    [BODY_ACHE, "muscle pain"], [/\bmy back (has been |keeps |is |is really |really )?(killing me|hurting|hurts?|sore|aches?|aching|acting up|bothering me|stiff)\b/, "back pain"],
    [/\b(my )?(stomach|belly|tummy|gut) (is )?(killing me|acting up|messed up|hurts?|bothering me)\b/, "upset stomach"], [/\b(my )?throat (is )?(killing me|on fire|raw|hurts?|sore)\b/, "sore throat"], [/\b(my )?(tooth|teeth|molar) (is |are )?(killing me|hurts?|aches?|throbbing)\b/, "toothache"], [/\bear ?ache\b|\b(my )?ear (is )?(killing me|hurts?|aches?)\b/, "earache"],
    [/\b(my )?head (is )?(splitting|pounding|throbbing|killing me)\b|\bbad head\b/, "headache"], [/\bstuffed up nose\b|\bnose is stuffed\b/, "stuffy nose"], [/\b(nose is dripping|dripping nose)\b/, "runny nose"],
    [/\b(tummy|belly) ?ache\b|\bsour stomach\b|\bate too much( and feel sick)?\b/, "upset stomach"], [/\blower back( ache| hurts)?\b|\b(?:sore|stiff|achy) back\b/, "back pain"], [/\bpulled (a|my) muscle\b|\bsore muscles?\b|\bstiff neck from sleeping( wrong)?\b|\b(?:sore|stiff|achy) (?:neck|shoulders?|knees?|hips?|elbows?|wrists?|ankles?|feet|foot|legs?|arms?|hands?|fingers?|thumbs?|toes?|calf|calves|thighs?|shins?)\b/, "muscle pain"],
    [/\b(i )?(think i )?ate something (bad|off|weird)\b|\bfood poisoning\b/, "upset stomach"], [/\bblocked nose\b/, "stuffy nose"], [/\bgoing to the beach\b|\bat the beach\b/, "sunscreen"], [/\bachy all over\b/, "body aches"], [/\bsweat a lot( and feel drained)?\b/, "dehydrated"], [/\b(get |feel )?(nauseous|sick) on (a )?(planes?|boats?|cars?|trains?)\b|\bgoing on a boat( and get sick)?\b/, "motion sickness"],
    [/\bskinned my \w+\b/, "scrape"], [/\bno soap( around)?\b/, "hand sanitizer"], [/\bmosquito bites?( itch)?\b/, "bug bite"], [/\bdont want to burn( in the sun)?\b/, "sunscreen"],
  ];

  // ---- conditions that look alike ----
  // Clues only. Nothing here clears anyone: every answer ends by saying when to get checked anyway.
  const LOOKALIKES = [
    { re: /\bstitches\b|\bpuntos\b/, en: "A cut probably needs stitches if it's deeper than about ¼ inch, gapes open, won't stop bleeding after 10 minutes of firm pressure, you can see fat or bone, or it's on the face, a joint or from a bite. Go within a few hours, since stitches work best early. Spurting blood is a 911 call.", es: "Una cortada probablemente necesita puntos si tiene más de ¼ de pulgada de profundidad, queda abierta, no deja de sangrar tras 10 minutos de presión firme, se ve grasa o hueso, o está en la cara, una articulación o es por mordedura. Vaya en unas horas. Si la sangre sale a chorros, llame al 911." },
    { re: /\bburn\b|\bquemadura\b/, en: "A burn needs a doctor if it's bigger than about 3 inches, blisters over a large area, looks white, leathery or charred, doesn't hurt in the middle, or is on the face, hands, feet, groin or a joint. Chemical and electrical burns always need care. Large or deep burns are a 911 call.", es: "Una quemadura necesita un médico si mide más de unas 3 pulgadas, tiene ampollas en un área grande, se ve blanca o carbonizada, no duele en el centro, o está en la cara, manos, pies, ingle o una articulación. Las quemaduras químicas y eléctricas siempre necesitan atención. Las grandes o profundas son una llamada al 911." },
    { re: /\b(head ?bump|bump on (the|my) head|hit (my|the|his|her) head|concussion|conmocion|golpe en la cabeza)\b/, en: "After a hit to the head, watch for repeated vomiting, a headache that keeps getting worse, confusion, unusual sleepiness, passing out, seizures, or one pupil bigger than the other. Any of those means 911 or the ER. A small bump with none of them can usually be iced and watched, with someone checking on you for 24 hours.", es: "Después de un golpe en la cabeza, vigile vómito repetido, dolor que empeora, confusión, sueño inusual, desmayo, convulsiones o una pupila más grande. Cualquiera de esos significa 911 o emergencias. Un chichón pequeño sin nada de eso se puede enfriar y vigilar, con alguien pendiente durante 24 horas." },
    { re: /\bdehydrat\w*|deshidrat\w*/, en: "Signs of dehydration: dark urine or peeing less, dry mouth, thirst, dizziness when standing, and tiredness. Sip fluids; electrolytes help. Confusion, fainting, a racing heart, or no urine in about 8 hours needs urgent care or the ER.", es: "Señales de deshidratación: orina oscura o poca, boca seca, sed, mareo al pararse y cansancio. Beba a sorbos; los electrolitos ayudan. Confusión, desmayo, corazón acelerado o no orinar en unas 8 horas necesita atención urgente o emergencias." },
    { re: /\bheadache\b.*\b(serious|bad|dangerous|worry|worried)\b|\b(serious|bad|dangerous)\b.*\bheadache\b|dolor de cabeza.*\b(grave|serio)\b/, en: "Most headaches aren't dangerous. Call 911 if it's sudden and the worst of your life, or comes with confusion, weakness, numbness, trouble speaking or seeing, a stiff neck with fever, or a recent head injury. See a doctor if they keep coming back or keep getting worse.", es: "La mayoría de los dolores de cabeza no son peligrosos. Llame al 911 si es repentino y el peor de su vida, o viene con confusión, debilidad, entumecimiento, problemas para hablar o ver, cuello rígido con fiebre, o un golpe reciente. Vea a un médico si siguen volviendo o empeoran." },
    { re: /\bstrain\b/, en: "A sprain is a stretched or torn ligament at a joint, like an ankle. A strain is a stretched or torn muscle or tendon, like the back or hamstring. Both swell and hurt, and both get rest, ice and gentle movement. If you can't put weight on it or it looks out of shape, get it X-rayed.", es: "Un esguince es un ligamento estirado o roto en una articulación, como el tobillo. Una distensión es un músculo o tendón estirado o roto, como en la espalda. Ambos se hinchan y duelen, y necesitan descanso, hielo y movimiento suave. Si no puede apoyar peso o se ve deformado, hágase una radiografía." },
    { re: /\b(er|emergency room|urgent care)\b/, en: "Go to the ER or call 911 for chest pain, trouble breathing, stroke signs, severe bleeding, severe burns, or passing out. Urgent care is for things that can't wait but aren't life-threatening, like sprains, minor cuts needing stitches, UTIs, and fevers. If unsure, go to the ER.", es: "Vaya a emergencias o llame al 911 por dolor de pecho, dificultad para respirar, señales de derrame, sangrado grave, quemaduras graves o desmayo. La atención urgente es para lo que no puede esperar pero no pone en peligro la vida, como torceduras, cortadas que necesitan puntos, infecciones urinarias y fiebre. Si tiene dudas, vaya a emergencias." },
    { re: /\bchest pain\b|dolor de pecho/, en: "No. Chest pain also comes from heartburn, strained muscles and panic. But you can't tell by feel, because a heart attack can feel like any of them. New or unexplained chest pain needs checking now: call 911 rather than guessing.", es: "No. El dolor de pecho también viene de acidez, músculos distendidos o pánico. Pero no se puede saber por cómo se siente, porque un ataque al corazón puede parecerse a cualquiera. El dolor nuevo o sin explicación necesita revisión ahora: llame al 911 en vez de adivinar." },
    { re: /heart attack|ataque (al corazon|cardiaco)/, en: "You can't rule out a heart attack by feel, and neither can this kiosk. It takes an ECG and blood tests at an ER. These are only clues:\n• More like a heart attack: pressure or squeezing in the chest, spreading to the arm, jaw or back, with sweating, nausea or shortness of breath, often lasting more than a few minutes.\n• More like heartburn: burning behind the breastbone after eating or lying down, with a sour taste. Feeling better after an antacid does not prove it wasn't your heart.\n• More like a panic attack: sudden fear, tingling and a racing heart that peak within about 10 minutes.\n• More like a strained muscle: a sore spot that hurts more when you press on it or move.\nIf there's any chance it's your heart, call 911. Don't wait to find out.", es: "No se puede descartar un ataque al corazón por cómo se siente, y este quiosco tampoco puede. Se necesita un electrocardiograma y análisis de sangre en emergencias. Estas son solo pistas:\n• Más como ataque al corazón: presión u opresión en el pecho, que se extiende al brazo, mandíbula o espalda, con sudor, náuseas o falta de aire, a menudo por más de unos minutos.\n• Más como acidez: ardor detrás del esternón después de comer o al acostarse, con sabor agrio. Mejorar con un antiácido no prueba que no sea el corazón.\n• Más como ataque de pánico: miedo repentino, hormigueo y corazón acelerado que alcanzan su punto máximo en unos 10 minutos.\n• Más como un músculo distendido: un punto que duele más al presionarlo o moverse.\nSi hay alguna posibilidad de que sea el corazón, llame al 911. No espere a averiguarlo." },
    { re: /(?<!heat ?)stroke|derrame|embolia/, en: "A stroke and a migraine can look alike, and only a hospital scan can tell for sure. Clues:\n• More like a stroke: comes on suddenly, with face droop, arm weakness, slurred speech, or loss of vision or balance.\n• More like a migraine: builds over minutes, you've had the same pattern before, and vision changes spread slowly.\nA first-ever attack, or anything sudden, is a 911 call. Note the time it started.", es: "Un derrame cerebral y una migraña pueden parecerse, y solo un estudio en el hospital lo confirma. Pistas:\n• Más como derrame: empieza de repente, con cara caída, debilidad en un brazo, habla enredada o pérdida de visión o equilibrio.\n• Más como migraña: aumenta en minutos, ya ha tenido el mismo patrón, y los cambios de visión se extienden lentamente.\nUna primera vez, o algo repentino, es una llamada al 911. Anote la hora en que empezó." },
    { re: /anaphyla|severe (allergic )?reaction|reaccion grave/, en: "Clues for telling them apart:\n• More like a mild allergy: sneezing, itchy eyes, or a few hives, and you can breathe and talk normally.\n• More like anaphylaxis: trouble breathing, swelling of the lips, tongue or throat, dizziness, or vomiting, usually soon after a food, sting or medicine.\nIf you're unsure, treat it as anaphylaxis: use an EpiPen if there is one and call 911.", es: "Pistas para distinguirlas:\n• Más como alergia leve: estornudos, ojos con picazón o pocas ronchas, y puede respirar y hablar normalmente.\n• Más como anafilaxia: dificultad para respirar, hinchazón de labios, lengua o garganta, mareo o vómito, poco después de un alimento, picadura o medicamento.\nSi tiene dudas, trátela como anafilaxia: use un EpiPen si hay uno y llame al 911." },
    { re: /heat ?stroke|heat exhaustion|golpe de calor/, en: "Clues:\n• More like heat exhaustion: heavy sweating, cool clammy skin, weakness, headache, nausea. Move somewhere cool and sip fluids.\n• More like heat stroke: very high temperature, hot skin, confusion, fainting. Call 911 and cool them down right away.\nConfusion always means 911.", es: "Pistas:\n• Más como agotamiento por calor: mucho sudor, piel fría y húmeda, debilidad, dolor de cabeza, náuseas. Vaya a un lugar fresco y beba a sorbos.\n• Más como golpe de calor: temperatura muy alta, piel caliente, confusión, desmayo. Llame al 911 y enfríe a la persona de inmediato.\nLa confusión siempre significa 911." },
    { re: /appendicitis|apendicitis|appendix/, en: "Clues:\n• More like a stomach bug: cramps that come and go, with vomiting or diarrhea, often with others sick too.\n• More like appendicitis: pain that starts near the belly button, moves to the lower right, and keeps getting worse, especially when you move or cough.\nSteadily worsening belly pain needs the ER today.", es: "Pistas:\n• Más como infección estomacal: cólicos que van y vienen, con vómito o diarrea, a menudo con otros enfermos.\n• Más como apendicitis: dolor que empieza cerca del ombligo, pasa a la parte baja derecha y empeora, sobre todo al moverse o toser.\nEl dolor abdominal que empeora necesita emergencias hoy." },
    { re: /meningitis/, en: "Clues: flu brings fever and body aches. Meningitis can add a severe headache, a stiff neck, confusion, light sensitivity, or a rash that doesn't fade when pressed. Any of those with a fever is a 911 call.", es: "Pistas: la gripe trae fiebre y dolores. La meningitis puede agregar dolor de cabeza fuerte, cuello rígido, confusión, sensibilidad a la luz o un sarpullido que no desaparece al presionarlo. Cualquiera de esos con fiebre es una llamada al 911." },
    { re: /\b(fracture|broken|broke|sprain|torcedura|fractura)\b/, en: "Only an X-ray can tell for sure. Clues:\n• More like a sprain: swelling and bruising around a joint, and you can still put some weight on it.\n• More like a break: the limb looks out of shape, you felt a snap, you can't put weight on it, or one spot on the bone is very tender.\nIf you can't use it or it looks wrong, go to urgent care or the ER.", es: "Solo una radiografía lo confirma. Pistas:\n• Más como torcedura: hinchazón y moretones alrededor de una articulación, y aún puede apoyar algo de peso.\n• Más como fractura: la extremidad se ve deformada, sintió un chasquido, no puede apoyar peso, o un punto del hueso duele mucho.\nSi no puede usarla o se ve mal, vaya a atención urgente o emergencias." },
    { re: /\b(covid|flu|gripe|cold|resfriado|allerg\w*|alergia\w*)\b/, en: "They overlap a lot, and only a test can confirm COVID or flu. Clues:\n• Allergies: itchy eyes and sneezing, no fever, same season each year.\n• Cold: comes on slowly with a runny nose and sore throat, little or no fever.\n• Flu: hits fast, with fever, chills and body aches.\n• COVID: can look like any of these, sometimes with loss of taste or smell.\nTrouble breathing or chest pain means 911.", es: "Se parecen mucho, y solo una prueba confirma COVID o gripe. Pistas:\n• Alergias: ojos con picazón y estornudos, sin fiebre, cada año en la misma temporada.\n• Resfriado: empieza lentamente con nariz que gotea y dolor de garganta, poca o ninguna fiebre.\n• Gripe: llega rápido, con fiebre, escalofríos y dolores.\n• COVID: puede parecerse a cualquiera, a veces con pérdida del gusto u olfato.\nDificultad para respirar o dolor de pecho significa 911." },
    { re: /\bstrep\b/, en: "Only a throat swab can tell. Clues: a cold brings a cough and runny nose. Strep tends to bring sudden throat pain, fever and white patches, usually with no cough. Suspect strep? Get tested at a clinic.", es: "Solo un cultivo de garganta lo confirma. Pistas: el resfriado trae tos y nariz que gotea. La faringitis estreptocócica suele traer dolor repentino, fiebre y manchas blancas, normalmente sin tos. Si la sospecha, hágase la prueba en una clínica." },
    { re: /food poisoning|stomach (flu|bug)|intoxicacion/, en: "They feel nearly the same. Clues: food poisoning tends to start within hours of a meal, sometimes hitting others who ate it. A stomach bug often spreads between people over a day or two. See a doctor for blood in the stool, high fever, or if you can't keep fluids down.", es: "Se sienten casi igual. Pistas: la intoxicación suele empezar horas después de comer, a veces en otros que comieron lo mismo. La infección estomacal suele pasar entre personas en uno o dos días. Vea a un médico si hay sangre en las heces, fiebre alta o no retiene líquidos." },
    { re: /migraine|migrana|tension headache|cluster/, en: "Clues: a tension headache feels like a tight band on both sides. A migraine usually throbs on one side, with nausea or light sensitivity. If it's the worst headache of your life or came on suddenly, call 911.", es: "Pistas: el dolor de cabeza por tensión se siente como una banda apretada en ambos lados. La migraña suele palpitar en un lado, con náuseas o sensibilidad a la luz. Si es el peor de su vida o empezó de repente, llame al 911." },
    { re: /panic|panico|anxiety|ansiedad/, en: "Panic and heart problems can feel the same, and you can't tell for sure on your own. Panic often comes with sudden fear and tingling and peaks within about 10 minutes. If it's your first time, or you have chest pain, call 911 and let them check.", es: "El pánico y los problemas del corazón pueden sentirse igual, y no se puede saber con certeza por su cuenta. El pánico suele venir con miedo repentino y hormigueo, y alcanza su máximo en unos 10 minutos. Si es la primera vez o tiene dolor de pecho, llame al 911." },
  ];
  function handleLookalike(raw, R) {
    if (!isLookalikeQuestion(raw)) return false;
    const t = safetyNormalize(raw), hit = LOOKALIKES.find((x) => x.re.test(t));
    if (!hit) {
      if (!/\b(condition|conditions|things|sickness|illness|medical|enfermedad\w*)\b/.test(t)) return false;
      R.say(R.L("Lots of conditions look alike, and I can't tell them apart for you. Tell me the two you're wondering about, like \"heart attack or heartburn\", and I'll share the clues. If anything feels serious or sudden, call 911.", "Muchas condiciones se parecen, y no puedo distinguirlas por usted. Dígame cuáles le preocupan, como \"ataque al corazón o acidez\", y le daré las pistas. Si algo parece grave o repentino, llame al 911."));
      return true;
      return false;
    }
    R.say(hit[R.lang], "warn");
    R.say(R.L("This is general information, not a diagnosis.", "Esta es información general, no un diagnóstico."), "system");
    R.care = true;
    return true;
  }

  // ---- drug-name spelling ----
  // Medicine names are where a wrong guess hurts, so they get their own correction: one slip in a
  // long unknown word, or in a whole multi-word name ("band aidds"). Known words are never touched.
  const isSwap = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join(); // "midlo", "afrni"
  // Ordinary words one letter from an emergency word: leave them alone.
  const REAL_WORDS = new Set("alive olive bleed blood bread sound round found hours house horse mouse month world words wound would could should couple people cooking threat threats strike stoke prison breeding breadth pleasure heard hearts hearth flood wealth cheap cheat stroll stolen shoulder plastic".split(" "));
  const SHORT_BRANDS = ["advil", "afrin", "midol", "motrin", "nsaids", "bayer", "tylenol"]; // "advl", "avil"
  let MED_TOKENS = null, MED_PHRASES = null;
  function buildMedVocab() {
    const words = new Set(), phrases = new Set(Object.values(EXTRA_ALIASES).flat().filter((a) => a.includes(" ")));
    ALIASES.forEach(({ alias }) => { if (alias.includes(" ")) phrases.add(alias); });
    Object.values(EXTRA_ALIASES).flat().concat(ALLERGENS.flatMap((e) => e.re.replace(/\(\?:[^)]*\)|[()?]/g, "").split("|"))).forEach((a) => a.split(" ").forEach((w) => { if (w.length >= 5 && /^[a-z]+$/.test(w)) words.add(w); }));
    // Words an emergency is spotted by: a typo here must not hide it.
    "pressure tightness crushing breathe breathing bleeding unconscious collapsed seizure seizures convulsions stroke suicide suicidal overdose overdosed choking swallowed swelling swollen throat tongue numbness drooping headache myself poison anaphylaxis anaphylactic antifreeze vomiting spurting wheezing gasping desmayo respirar sangre pastillas matarme".split(" ").forEach((w) => words.add(w));
    ["asprin", "ibuprofin"].forEach((w) => words.delete(w)); // aliases that are themselves misspellings
    // Everything the emergency rules look for, so "cruhsed" still reads as "crushed".
    Object.values(RED_FLAGS).flat().forEach((re) => (re.source.replace(/\\[a-zA-Z]/g, " ").match(/[a-z]+/g) || []).forEach((w) => (w.length >= 6 ? words : REAL_WORDS).add(w)));
    "shoulder elbow finger thumb throat sudden coming reflux allergies stools planes severe acting twisted blister carsick seasick airsick blocked soaking through killing throbbing stomach stuffed burning hoarse skinned scraped sliced bumped dripping splitting nicked shaving pounding bothering aching".split(" ").forEach((w) => words.add(w));
    MED_TOKENS = [...words]; MED_PHRASES = [...phrases].filter((a) => a.length >= 8);
  }
  const medFixCache = new Map(); // shortcut: unbounded, but a kiosk session only sees a handful of words
  function medFix(raw) {
    ensureBuilt();
    if (!MED_TOKENS) buildMedVocab();
    let out = raw.replace(/[A-Za-zÀ-ÿ]{4,}/g, (tok) => {
      if (medFixCache.has(tok)) return medFixCache.get(tok);
      const fixed = medFixToken(tok);
      medFixCache.set(tok, fixed);
      return fixed;
    });
    const toks = out.split(/\s+/);
    MED_PHRASES.forEach((ph) => {
      const n = ph.split(" ").length;
      for (let i = 0; i + n <= toks.length; i++) {
        if (toks[i][0] && toks[i][0].toLowerCase() !== ph[0]) continue;
        const win = safetyNormalize(toks.slice(i, i + n).join(" "));
        if (win !== ph && Math.abs(win.length - ph.length) <= 1 && lev(win, ph, Infinity, true) === 1) toks.splice(i, n, ph);
      }
    });
    return toks.join(" ");
  }
  function medFixToken(tok) {
    {
      const low = safetyNormalize(tok);
      if (COMMON.has(low) || VOCAB.has(low) || MED_TOKENS.includes(low) || REAL_WORDS.has(low)) return tok;
      // Same first letter: "laughter" must never turn into "daughter".
      const hit = MED_TOKENS.find((w) => w[0] === low[0] && Math.abs(w.length - low.length) <= 1 && lev(low, w, Infinity, true) === 1 && (low.length >= 6 || (low.length === 5 && w.length >= 6) || isSwap(low, w) || (low.length >= 4 && SHORT_BRANDS.includes(w))));
      return hit || tok;
    }
  }

  // ---- allergies and ingredients ----
  function mergeProfile(profile, said) {
    const merged = Object.assign({}, profile, said);
    ["allergies", "allergyInactive", "allergyDrugs", "avoid", "labelConds"].forEach((k) => {
      const all = [...new Set([...((profile || {})[k] || []), ...(said[k] || [])])];
      if (all.length) merged[k] = all;
    });
    if (said.notPregnant) { delete merged.pregnant; delete merged.maybePregnant; }
    return merged;
  }

  // Requests to misuse medicine or dodge safeguards: refuse, and point to help.
  const MISUSE_REPLIES = [
    { when: (p, R) => (/\b(skip|bypass|fool|trick|fake|get around|without)\b.*\b(id|scanner|age check|verification)\b/.test(p) || /\b(underage|under age|minor)\b.*\b(buy|get|cold medicine)\b|\bbuy\b.*\b(underage|under age)\b/.test(p) || /\bim 1[0-7]\b.*\bbuy\b/.test(p)), en: "I can't help get around ID checks. Age-restricted items need a valid photo ID from the buyer, and there's no way to skip it.",
      es: "No puedo ayudar a evitar la verificación de identidad. Los artículos con restricción de edad requieren una identificación con foto válida del comprador, y no se puede omitir.", warn: true },
    { re: /\b(drug|poison|knock out|knock) (someone|somebody|a person|him|her)\b|\bknock someone out\b|\bslip in (a|her|his|their|someones) drink\b|\bkill a person\b/, en: "I can't help with anything that could hurt someone. If someone is in danger, call 911.",
      es: "No puedo ayudar con nada que pueda dañar a alguien. Si alguien está en peligro, llame al 911.", warn: true },
    { re: /\b(no id|without (an )?id|skip the id|brothers id|sisters id|fake id|someone elses id)\b/, en: "Age-restricted items need a valid photo ID from the buyer, and I can't skip that.",
      es: "Los artículos con restricción de edad requieren una identificación con foto válida del comprador, y no puedo omitirla.", warn: true },
    { re: /\b(pass a drug test|make myself sick)\b/, en: "I can't help with that. If you're not feeling safe or well, a doctor or pharmacist can talk it through with you.",
      es: "No puedo ayudar con eso. Si no se siente seguro o bien, un médico o farmacéutico puede hablarlo con usted." },
    { re: /\b(drink|huff|sniff|inhale|smoke)\b.{0,20}\b(sanitizer|purell|patch)\b/, en: "Please don't. Hand sanitizer and patches are for skin only, and swallowing or inhaling them can poison you. If someone already did, call Poison Control at 1-800-222-1222.",
      es: "Por favor no lo haga. El desinfectante y los parches son solo para la piel, y tragarlos o inhalarlos puede envenenar. Si alguien ya lo hizo, llame a Control de Envenenamientos al 1-800-222-1222.", warn: true },
    { re: /\b(get|getting|got) (high|wasted|drunk|messed up)\b|\b\w+ trip (how many|dose)\b|\bto trip\b|\b(tripping|buzz|abuse|abusing|snort|inject|shoot up|recreational|robo|hallucinate|hallucinating)\b|\bto see things\b|\bopioid effects\b|\bmake meth\b|\bmeth\b/, en: "I can't help with using medicine that way. Taking more than the label says can cause heart problems, seizures, liver failure and death. If you or a friend are struggling, SAMHSA's free helpline is 1-800-662-4357, 24/7. If someone already took too much, call Poison Control at 1-800-222-1222.",
      es: "No puedo ayudar a usar medicamentos de esa manera. Tomar más de lo que indica la etiqueta puede causar problemas del corazón, convulsiones, insuficiencia hepática y la muerte. Si usted o un amigo lo están pasando mal, la línea gratuita de SAMHSA es 1-800-662-4357, 24/7. Si alguien ya tomó demasiado, llame a Control de Envenenamientos al 1-800-222-1222.", warn: true },
  ];
  function handleMisuse(p, R) {
    return replyFrom(MISUSE_REPLIES, p, R);
  }

  function handleForget(p, R) {
    if (!/\b(forget|clear|erase|delete|ignore)\b.*\b(allerg\w*|sensitive|conditions?|what i (said|told you))\b/.test(p)) return false;
    R.cond = {};
    R.profileCleared = true;
    R.say(R.L("Okay, I've cleared what you told me about your health.", "De acuerdo, borré lo que me dijo sobre su salud."));
    return true;
  }

  const entryIn = (text) => ALLERGENS.find((e) => new RegExp(`\\b(?:${e.re})\\b`).test(text));
  const inactiveNote = (words, R) => R.L(
    `This kiosk doesn't have inactive-ingredient lists, so I can't tell you whether any item has ${words.join(" or ")}. Tablets, chews and creams can contain fillers and dyes. Read the inactive ingredients on the package, or ask a pharmacist, before using anything.`,
    `Este quiosco no tiene listas de ingredientes inactivos, así que no puedo decirle si algún artículo tiene ${words.join(" o ")}. Las tabletas y cremas pueden contener rellenos y colorantes. Lea los ingredientes inactivos en el paquete o consulte a un farmacéutico antes de usar algo.`);
  const DRUG_NOTES = {
    penicillin: ["None of this kiosk's active ingredients are penicillin-type antibiotics. The ointment contains bacitracin, a different antibiotic.", "Ningún ingrediente activo de este quiosco es un antibiótico tipo penicilina. El ungüento contiene bacitracina, un antibiótico diferente."],
    sulfa: ["None of this kiosk's active ingredients are sulfa drugs.", "Ningún ingrediente activo de este quiosco es una sulfa."],
    codeine: ["None of this kiosk's active ingredients are codeine or other opioids.", "Ningún ingrediente activo de este quiosco es codeína u otro opioide."],
    iodine: ["None of this kiosk's items list iodine as an active ingredient.", "Ningún artículo de este quiosco tiene yodo como ingrediente activo."],
    latex: ["The Band-Aids here are labeled latex-free. The labels I have don't say either way for the other items, like tape, pads or tampons, so check those packages.", "Las curitas de aquí están etiquetadas sin látex. Las etiquetas que tengo no lo indican para otros artículos, como cinta, toallas o tampones, así que revise esos paquetes."],
  };

  // "does ibuprofen have gluten" / "is acetaminophen safe with a soy allergy"
  function handleInactiveQuestion(said, askedIds, R) {
    if (!said.allergyInactive || !askedIds.length) return false;
    R.say(inactiveNote(said.allergyInactive, R), "warn");
    R.inactiveNoted = true;
    return true;
  }

  function handleAllergyStatement(said, cond, askedIds, p, R) {
    if (!said.allergy || (askedIds.length && /\b(can|could|should|add|buy|get|what|how|take|puedo|agrega)\b|^is\b|\bis it\b/.test(p)) || findTopics(p.replace(/\bsensitive\b/g, "")).length) return false;
    const es = R.lang === "es";
    R.drugNoted = true;
    if (said.allergyAll) return true;
    (said.allergyDrugs || []).forEach((k) => R.say(`${DRUG_NOTES[k][es ? 1 : 0]} ${R.L("I can't see inactive ingredients on the packages from here, so check them or ask a pharmacist.", "No puedo ver los ingredientes inactivos de los paquetes desde aquí; revíselos o consulte a un farmacéutico.")}`));
    const out = PRODUCTS.filter((x) => (said.allergies || []).some((key) => { const e = ALLERGENS.find((a) => a.key === key); return e.ids.includes(x.id) || (e.also || []).includes(x.id); }));
    if (out.length) R.say(R.L(`Got it. For this visit I'll keep these out of my suggestions because they contain or are related to what you're allergic to:\n${out.map((x) => `• ${x.name}`).join("\n")}\nTell me what you need help with.`,
      `Entendido. Durante esta visita dejaré fuera de mis sugerencias estos artículos, porque contienen o están relacionados con aquello a lo que es alérgico:\n${out.map((x) => `• ${x.name}`).join("\n")}\nDígame en qué necesita ayuda.`));
    return !!out.length || !!(said.allergyDrugs || []).length || !!(said.allergyInactive || []).length || !!said.allergyOther;
  }

  function ingredientLine(pr, R) {
    if (!pr.activeIngredient) return R.L(`${pr.name} has no active drug ingredient listed.`, `${pr.name} no indica ningún ingrediente activo.`);
    const note = pr.id === "motionsickness" ? R.L(" (dimenhydrinate contains diphenhydramine)", " (el dimenhidrinato contiene difenhidramina)") : "";
    return R.L(`Active ingredients in ${pr.name}: ${pr.activeIngredient}${note}.`, `Ingredientes activos de ${pr.name}: ${pr.activeIngredient}${note}.`);
  }

  function handleIngredient(q, p, R, ctx, prods) {
    const L = R.L, es = R.lang === "es", tr = (x) => x[es ? "es" : "en"];
    const answerHas = (pr, e) => {
      R.last = pr;
      if (e.ids.includes(pr.id)) R.say(L(`Yes. ${pr.name} contains ${e.name.en}. ${ingredientLine(pr, R)}`, `Sí. ${pr.name} contiene ${e.name.es}. ${ingredientLine(pr, R)}`));
      else if ((e.also || []).includes(pr.id)) R.say(L(`No, but ${pr.name} is closely related to ${e.name.en}, so skip it if you're allergic. ${ingredientLine(pr, R)}`, `No, pero ${pr.name} está muy relacionado con ${e.name.es}; evítelo si es alérgico. ${ingredientLine(pr, R)}`));
      else R.say(L(`No. ${pr.name} doesn't list ${e.name.en} as an active ingredient. ${ingredientLine(pr, R)}`, `No. ${pr.name} no incluye ${e.name.es} como ingrediente activo. ${ingredientLine(pr, R)}`));
      return true;
    };
    // "does A contain B" / "is A an NSAID" / "is A the same as B" / "A contiene B"
    const m = q.match(/^(?:does|do|did|is there|can) (.+?) (?:contain|contains|have|has|include|includes)(?: any| an?)? (.+?)(?: in (?:it|them))?$/) || q.match(/^(?:is|are) (.+?) (?:an?|the same as) (.+)$/) || q.match(/^(?:el |la )?(.+?) (?:contiene|tiene) (.+)$/);
    if (m) {
      const pr = findProducts(correct(toEnglish(toPlain(normKeep(m[1]))).text))[0] || (/^(it|this|that)$/.test(m[1]) ? ctx.lastProduct : null), e = entryIn(m[2]);
      if (pr && e) return answerHas(pr, e);
      if (pr && /^latex/.test(m[2])) { R.say(pr.id === "bandaid" ? DRUG_NOTES.latex[es ? 1 : 0] : `${L("No latex information on this label.", "Esta etiqueta no indica nada sobre látex.")} ${DRUG_NOTES.latex[es ? 1 : 0]}`); R.last = pr; return true; }
      const inactive = pr && m[2].match(new RegExp(`\\b(?:${INACTIVE_ALLERGENS})\\b`));
      if (inactive) { R.say(inactiveNote([inactive[0]], R), "warn"); R.inactiveNoted = true; R.last = pr; return true; }
    }
    if (/\b(whats in|what is in|ingredients?|ingredientes?|made of|made with|que contiene)\b/.test(q) && !/\bwhich\b/.test(q)) {
      const pr = prods[0] || (/\b(it|this|that)\b/.test(p) ? ctx.lastProduct : null);
      if (pr) { R.last = pr; R.say(`${ingredientLine(pr, R)} ${L("I don't have the inactive ingredients here, so check the package if you have allergies.", "No tengo los ingredientes inactivos aquí; revise el paquete si tiene alergias.")}`); return true; }
    }
    const e = detectConditions(q).allergy ? null : entryIn(q); // "allergic to aspirin, what do you have" isn't asking what has aspirin
    if (!e) return false;
    const holders = (ids) => PRODUCTS.filter((x) => ids.includes(x.id));
    if (!holders(e.ids).length) return false; // nothing here contains it
    const lines = (list) => list.map((x) => `• ${x.name}`).join("\n");
    const without = /\b(not|without|free of|non|sin)\b/.test(q);
    if (/\b(which|what)\b.*\b(contain|contains|have|has|with|without|not)\b/.test(q) && (without || !findProducts(q.replace(new RegExp(`\\b(?:${e.re})\\b`, "g"), "")).length)) {
      const list = without ? PRODUCTS.filter((x) => x.category === "pain" && x.highRisk && !e.ids.includes(x.id)) : holders(e.ids);
      R.say(without ? L(`Pain relievers here without ${e.name.en}:\n${lines(list)}`, `Analgésicos de aquí sin ${e.name.es}:\n${lines(list)}`) : L(`These items contain ${e.name.en}:\n${lines(list)}`, `Estos artículos contienen ${e.name.es}:\n${lines(list)}`));
      R.products = list.slice(0, 3); R.lastList = list;
      return true;
    }
    if (e.what && /^(what is|whats|que es)\b/.test(q) && !/\b(price|cost|used|use|uses|for|do|does|run)\b/.test(q) && q.split(" ").length <= 6 && !/\bfor$/.test(q) ) {
      R.say(L(`${e.name.en[0].toUpperCase() + e.name.en.slice(1)} is ${tr(e.what)} Found in:\n${lines(holders(e.ids))}\n${holders(e.ids)[0].name} is used for: ${holders(e.ids)[0].uses}`, `${e.name.es[0].toUpperCase() + e.name.es.slice(1)} es ${tr(e.what)} Se encuentra en:\n${lines(holders(e.ids))}\n${holders(e.ids)[0].name} se usa para: ${holders(e.ids)[0].uses}`));
      return true;
    }
    return false;
  }

  // ---- honest "we don't carry that" ----
  // Checked before product matching so "tylenol pm" can't be answered as plain Tylenol.
  const NOT_CARRIED = [
    // This kiosk sits in a care waiting room: nothing is sold that you swallow.
    { re: /\b(advil|ibuprofen|ibuprofeno|motrin|tylenol|acetaminophen|acetaminofen|paracetamol|bayer|aspirin|aspirina|pamprin|midol|benadryl|diphenhydramine|halls|cough drops?|lozenges?|dayquil|nyquil|tums|antacids?|pedialyte|electrolytes?|dramamine|imodium|loperamide|aleve|naproxen|zyrtec|claritin|allegra|pepto|mucinex|sudafed|melatonin|pain (?:pills?|meds|medicine|medication|relievers?|killers?)|painkillers?|pills?|tablets?|caplets?|cold medicine|cough (?:syrup|medicine)|allergy (?:pills?|medicine|meds)|something to (?:take|swallow)|medicine for|medicina|pastillas?|jarabe)\b/, en: "This kiosk doesn't sell any medicine you swallow. If you think you need some, please ask the staff at the front desk or your care team.",
      es: "Este quiosco no vende medicamentos que se tragan. Si cree que necesita alguno, pregunte al personal de la recepción o a su equipo de atención." },
    { re: /\b(water|snacks?|food|hungry|thirsty|gum|candy|mints?|coffee|juice|soda|drinks?|comida|agua|hambre|sed|chicle|dulces?)\b/, en: "This kiosk doesn't sell food, drinks, gum or mints. Please ask the staff at the front desk before you eat or drink anything while you wait.", es: "Este quiosco no vende comida, bebidas, chicle ni mentas. Pregunte al personal de la recepción antes de comer o beber algo mientras espera." },
    { re: /\b(hit|poked|punched|elbowed|smacked)\b.{0,20}\b(in|on) (the|my) eye\b/, closest: "coldpack", care: true, en: "Hold a wrapped cold pack gently on it, without pressing on the eye. Go to the ER for vision changes, severe pain, blood in the eye, or if you can't move the eye normally:", es: "Ponga una compresa fría envuelta suavemente, sin presionar el ojo. Vaya a emergencias si hay cambios en la vista, dolor fuerte, sangre en el ojo o no puede moverlo normalmente:" },
    { re: /\b(dry|burning|itchy red|irritated|red) eyes?\b|\beyes? (are|is) (dry|burning|red|irritated)\b/, care: true, en: "This kiosk doesn't carry eye products. Rest your eyes and a pharmacy can suggest lubricating drops. See a doctor for pain, vision changes or discharge:", es: "Este quiosco no tiene productos para los ojos. Descanse la vista; una farmacia puede sugerir gotas lubricantes. Vea a un médico si hay dolor, cambios en la vista o secreción:" },
    { re: /\bhiccups?\b|\bhipo\b/, en: "Hiccups usually pass on their own. Sipping cold water or holding your breath briefly may help. See a doctor if they last more than 2 days.", es: "El hipo suele pasar solo. Beber agua fría a sorbos o aguantar la respiración brevemente puede ayudar. Vea a un médico si dura más de 2 días." },
    { re: /\b(tired|exhausted|no energy|fatigue|cansad\w*) (all the time|constantly|every day|for weeks)\b|\balways (tired|exhausted)\b/, care: true, en: "Nothing here treats ongoing tiredness. Sleep, stress, low iron, thyroid problems and more can cause it, so if it's lasted over two weeks, see a doctor:", es: "Nada aquí trata el cansancio continuo. El sueño, el estrés, falta de hierro, problemas de tiroides y más pueden causarlo; si dura más de dos semanas, vea a un médico:" },
    { re: /\b(poison (ivy|oak|sumac)|hiedra venenosa)\b/, care: true, en: "Wash the skin and clothes with soap and water right away, and don't scratch. A pharmacy has anti-itch creams we don't carry. See a doctor if it's on your face or genitals, or covers a large area:", es: "Lave la piel y la ropa con agua y jabón de inmediato, y no se rasque. Una farmacia tiene cremas para la picazón que no tenemos. Vea a un médico si está en la cara o los genitales, o cubre un área grande:" },
    { re: /\b(canker sores?|mouth sores?|afta|aftas|llaga en la boca)\b/, care: true, en: "Canker sores usually heal in 1 to 2 weeks. Avoid spicy or acidic food. See a dentist or doctor if one lasts over 3 weeks:", es: "Las aftas suelen sanar en 1 a 2 semanas. Evite comidas picantes o ácidas. Vea a un dentista o médico si dura más de 3 semanas:" },
    { re: /\bearache\b/, care: true, en: "This kiosk has nothing for inside the ear, and an earache can be an infection, so see a clinic if it lasts more than a day or two or comes with fever. Ask the staff before taking anything for the pain:", es: "Este quiosco no tiene nada para el oído, y el dolor puede ser una infección; vea una clínica si dura más de uno o dos días o hay fiebre. Pregunte al personal antes de tomar algo para el dolor:" },
    { re: /\b(generic|store brand|off brand|unbranded|genericos?|marca blanca)\b/, en: "Everything here is a name brand, so there's no generic version. Ask me about the ingredient and I'll show you the brand that has it.", es: "Todo aquí es de marca, así que no hay versión genérica. Pregúnteme por el ingrediente y le muestro la marca que lo tiene." },
    { re: /\b(acne|pimples?|eczema|psoriasis|hemorrhoids?|dandruff|athletes foot|ringworm|warts?|acne|eczema|hemorroides|caspa)\b/, care: true, en: "This kiosk doesn't carry anything for that. A pharmacist can suggest an over-the-counter option, or see a doctor if it's spreading, painful or not improving:", es: "Este quiosco no tiene nada para eso. Un farmacéutico puede sugerir una opción de venta libre, o vea a un médico si se extiende, duele o no mejora:" },
    { re: /\b(birth control|the pill|contraceptives?|anticonceptivos?)\b/, care: true, en: "This kiosk doesn't carry birth control. A pharmacy or clinic can help, and some pills are sold without a prescription:", es: "Este quiosco no tiene anticonceptivos. Una farmacia o clínica puede ayudar, y algunas pastillas se venden sin receta:" },
    { re: /\b(relapsed|relapse|recaida|recai)\b|\bsmoked weed\b/, care: true, en: "If anyone's in danger or feels very unwell, call 911. SAMHSA's free, confidential helpline is 1-800-662-4357, 24/7:", es: "Si alguien está en peligro o se siente muy mal, llame al 911. La línea gratuita y confidencial de SAMHSA es 1-800-662-4357, 24/7:" },
    { re: /\b(tooth|diente|muela)\b.{0,12}\b(fell out|knocked out|broke|se cayo)\b/, care: true, en: "See a dentist today. An adult tooth that was knocked out needs care within an hour: hold it by the top, keep it in milk, and go now:", es: "Vea a un dentista hoy. Un diente adulto que se cayó por un golpe necesita atención en menos de una hora: tómelo por la corona, guárdelo en leche y vaya ahora:" },
    { re: /\b(frostbite|congelacion)\b/, care: true, en: "Get somewhere warm, don't rub the skin, and warm it with lukewarm (not hot) water. Numb, hard, white or blistered skin needs the ER:", es: "Vaya a un lugar cálido, no frote la piel y caliéntela con agua tibia (no caliente). La piel entumecida, dura, blanca o con ampollas necesita emergencias:" },
    { re: /\b(pepper sprayed|pepper spray|mace|gas pimienta)\b/, care: true, en: "Get to fresh air and rinse your skin and eyes with cool water for 15 minutes. Don't rub. Call 911 for trouble breathing:", es: "Salga al aire libre y enjuague la piel y los ojos con agua fría 15 minutos. No frote. Llame al 911 si le cuesta respirar:" },
    { re: /\b(splinter|astilla)\b/, closest: "bandaid", en: "Wash the area, pull the splinter out with clean tweezers in the direction it went in, then wash again and cover it. See a doctor if it's deep or gets red and swollen:", es: "Lave el área, saque la astilla con pinzas limpias en la dirección en que entró, lave de nuevo y cúbrala. Vea a un médico si es profunda o se pone roja e hinchada:" },
    { re: /\b(havent eaten|not eating|cant eat)\b/, care: true, en: "Please try a little food and fluid, and see a doctor if you can't keep it down or feel faint. If you're going without food because of cost, dialing 211 connects you to local food help:", es: "Intente comer y beber un poco, y vea a un médico si no lo retiene o se siente débil. Si es por falta de dinero, el 211 le conecta con ayuda local de alimentos:" },
    { re: /\b(broken|broke|fractured?)\b.{0,15}\b(arm|leg|wrist|ankle|bone|finger|toe|hand|foot|rib|nose|collarbone)\b|\b(arm|leg|wrist|ankle|bone|finger|toe|hand|foot|rib|nose)\b.{0,12}\b(is |might be |may be )?(broken|fractured)\b/, closest: "coldpack", care: true, en: "A possible broken bone needs an X-ray, so go to urgent care or the ER and keep it still. Call 911 if bone is showing or the limb looks badly out of place. A wrapped cold pack can ease swelling on the way:", es: "Un posible hueso roto necesita una radiografía; vaya a atención urgente o a emergencias y manténgalo inmóvil. Llame al 911 si se ve el hueso o la extremidad está muy deformada. Una compresa fría envuelta puede aliviar la hinchazón:" },
    { re: /\b(blood|sangre)\b.{0,12}\b(pee|urine|orina)\b/, care: true, en: "Blood in your urine needs a doctor today. Nothing here treats it. Go to urgent care, or the ER if you can't pee or have severe pain:", es: "Sangre en la orina necesita un médico hoy. Nada aquí la trata. Vaya a atención urgente, o a emergencias si no puede orinar o tiene dolor fuerte:" },
    { re: /\b(fever|fiebre)\b.{0,25}\b(rash|sarpullido)\b|\b(rash|sarpullido)\b.{0,25}\b(fever|fiebre)\b/, care: true, en: "A fever with a rash needs a doctor today. Go to the ER right away if the rash doesn't fade when you press on it, spreads fast, or you feel very sick:", es: "Fiebre con sarpullido necesita un médico hoy. Vaya a emergencias de inmediato si el sarpullido no desaparece al presionarlo, se extiende rápido o se siente muy mal:" },
    { re: /\b(strep|white spots|white patches|amigdalitis|tonsillitis)\b/, care: true, en: "That can be strep, which needs a test and antibiotics from a clinic. Go to urgent care. Nothing here treats the infection itself:", es: "Eso puede ser faringitis estreptocócica, que necesita una prueba y antibióticos de una clínica. Vaya a atención urgente. Nada aquí trata la infección:" },
    { re: /\b(throwing up|vomiting|vomit\w*|diarrhea|diarrea)\b.{0,20}\b(for|past)\s+(\d|two|three|several|a few|days?)\b.{0,8}\b(days?)\b|\bcant stop (throwing up|vomiting)\b/, care: true, en: "That's long enough that you should see a doctor today, especially if you can't keep fluids down, as dehydration can get serious. Sip fluids; an electrolyte packet can help:", es: "Eso ya es suficiente para ver a un médico hoy, sobre todo si no retiene líquidos, porque la deshidratación puede ser grave. Beba a sorbos; un sobre de electrolitos puede ayudar:" },
    { re: /\b(bleach|chemical|cleaner|drain cleaner|acid|cloro|lejia|quimico)\b.{0,15}\b(on|in|en)\b.{0,8}\b(my|his|her|their|the|mi)?\s*(hand|skin|arm|leg|face|mano|piel|brazo|cara)\b/, en: "Rinse the skin with cool running water for at least 20 minutes and take off anything it splashed on. Call Poison Control at 1-800-222-1222. Go to the ER for burns or severe pain.", es: "Enjuague la piel con agua fría durante al menos 20 minutos y quítese lo que se haya salpicado. Llame a Control de Envenenamientos al 1-800-222-1222. Vaya a emergencias si hay quemaduras o dolor fuerte." },
    { re: /\b(out of|ran out|run out|lost|forgot|sin)\b.{0,15}\b(insulin|insulina|inhaler|blood pressure (pills?|meds?|medicine)|seizure (meds?|medicine)|heart (meds?|medicine)|medication|prescription|meds)\b/, care: true, en: "Don't wait on that. Nothing here replaces prescription medicine. Call your pharmacy or doctor now about an emergency refill, or go to urgent care. Running out of insulin or heart medicine can get dangerous quickly, so go to the ER if you feel unwell:", es: "No lo deje para después. Nada aquí reemplaza un medicamento con receta. Llame ahora a su farmacia o médico para un resurtido de emergencia, o vaya a atención urgente. Quedarse sin insulina o medicina del corazón puede ser peligroso; vaya a emergencias si se siente mal:" },
    { re: /\b(baby|infant|newborn|bebe)\b.{0,15}\bsunburn\b|\bsunburn\b.{0,15}\b(baby|infant|newborn|bebe)\b/, care: true, en: "A sunburned baby under 1 needs a doctor today. Keep them out of the sun and offer fluids. Nothing here is labeled for babies:", es: "Un bebé menor de 1 año con quemadura de sol necesita un médico hoy. Manténgalo fuera del sol y ofrézcale líquidos. Nada aquí está etiquetado para bebés:" },
    { re: /\b(pee|peeing|urinating|urinate|orina|orinar)\b.*\b(burn|burns|burning|hurts|painful|arde|duele)\b|\b(burn|burns|burning|hurts|painful)\b.*\b(pee|peeing|urinating|urinate)\b/, care: true, en: "Burning when you pee is often a urinary infection, which needs a doctor and usually a prescription. Nothing here treats it. Go to urgent care today, and sooner with fever, back pain or vomiting:", es: "El ardor al orinar suele ser una infección urinaria, que necesita un médico y normalmente receta. Nada aquí la trata. Vaya hoy a atención urgente, y antes si tiene fiebre, dolor de espalda o vómito:" },
    { re: /\b(yeast infection|candidiasis|monistat)\b/, care: true, en: "This kiosk doesn't carry yeast infection treatment. A pharmacy sells it without a prescription. See a doctor if it's your first one, you're pregnant, or you have fever or belly pain:", es: "Este quiosco no tiene tratamiento para candidiasis. Una farmacia lo vende sin receta. Vea a un médico si es la primera vez, está embarazada o tiene fiebre o dolor abdominal:" },
    { re: /\b(lice|head lice|nits|piojos|scabies|sarna)\b/, care: true, en: "This kiosk doesn't carry lice or scabies treatment.", es: "Este quiosco no tiene tratamiento para piojos o sarna." },
    { re: /\b(cold sores?|fever blisters?|herpes|abreva|fuego labial)\b/, care: true, en: "This kiosk doesn't carry cold sore treatment. A pharmacy sells it without a prescription. See a doctor if it's near your eye or doesn't heal in two weeks:", es: "Este quiosco no tiene tratamiento para el herpes labial. Una farmacia lo vende sin receta. Vea a un médico si está cerca del ojo o no sana en dos semanas:" },
    { re: /\b(diaper rash|rozadura|pañalitis|panalitis|teething|teeth coming in|denticion|orajel)\b/, care: true, en: "This kiosk doesn't carry baby products, and nothing here is labeled for babies. A pharmacist or your pediatrician can help:", es: "Este quiosco no tiene productos para bebés, y nada aquí está etiquetado para ellos. Un farmacéutico o su pediatra pueden ayudarle:" },
    { re: /\b(something|dirt|sand|an eyelash|debris|chemical|bleach|algo) (in|into|en) (my|his|her|their|el|mi) (eye|eyes|ojo|ojos)\b/, care: true, en: "Rinse your eye with clean water for several minutes and don't rub it. Go to urgent care if it still hurts or your vision changes. For chemicals, keep rinsing for 15 minutes and call Poison Control at 1-800-222-1222:", es: "Enjuague el ojo con agua limpia varios minutos y no lo frote. Vaya a atención urgente si sigue doliendo o cambia su vista. Con químicos, siga enjuagando 15 minutos y llame a Control de Envenenamientos al 1-800-222-1222:" },
    { re: /\b(tylenol pm|advil pm|zzzquil|unisom|sleep aid|sleeping pills?|melatonina?|cant sleep(?!.*\b(?:noisy|loud|noise)\b)|insomnia|pastillas para dormir)\b/, closest: null, care: false,
      en: "This kiosk doesn't carry sleep aids or melatonin. A regular bedtime, a dark cool room, and no screens or caffeine late in the day can help; see a doctor if poor sleep lasts more than a couple of weeks.",
      es: "Este quiosco no tiene productos para dormir ni melatonina. Un horario fijo, un cuarto oscuro y fresco, y evitar pantallas y cafeína por la noche pueden ayudar; consulte a un médico si dura más de un par de semanas." },
    { re: /\b(nyquil|nighttime cold)\b/, en: "We don't carry NyQuil or any nighttime formula. The closest item is daytime, so it won't help you sleep:", es: "No tenemos NyQuil ni fórmulas de noche. Lo más cercano es de día, así que no le ayudará a dormir:" },
    { re: /\b(aleve|naproxen|naproxeno)\b/, en: "We don't carry Aleve (naproxen). The closest item is another NSAID. Never take the two together:", es: "No tenemos Aleve (naproxeno). Lo más cercano es otro AINE. Nunca tome los dos juntos:" },
    { re: /\b(childrens?( s)?|infants?( s)?|kids?( s)?|pediatric|liquid) (motrin|tylenol|advil|ibuprofen|acetaminophen|benadryl|medicine|cold medicine|fever medicine)\b/, closest: null, care: true,
      en: "This kiosk doesn't carry children's medicine: everything here is labeled for older kids and adults. Please don't split adult tablets. A pharmacist can give you the right product and dose:", es: "Este quiosco no tiene medicinas para niños: todo está etiquetado para niños mayores y adultos. No parta tabletas de adulto. Un farmacéutico puede darle el producto y la dosis correctos:" },
    { re: /\b(bengay|biofreeze|tiger balm)\b/, closest: "patch", en: "We don't carry that brand. The closest item is a menthol patch, Icy Hot:", es: "No tenemos esa marca. Lo más cercano es un parche de mentol:" },
    { re: /\b(zyrtec|claritin|allegra|cetirizine|loratadine|non drowsy allergy)\b/, en: "We don't carry non-drowsy allergy medicine. The closest item can make you very drowsy:", es: "No tenemos antialérgicos que no den sueño. Lo más cercano puede dar mucho sueño:" },
    { re: /\b(sudafed|pseudoephedrine|mucinex|guaifenesin)\b/, closest: "decongestant", en: "We don't carry that. The closest item for congestion is a nasal spray:", es: "No tenemos eso. Lo más cercano para la congestión es un aerosol nasal:" },
    { re: /\b(pepto|bismuth)\b/, en: "We don't carry Pepto-Bismol. The closest item for an upset stomach is an antacid:", es: "No tenemos Pepto-Bismol. Lo más cercano para el malestar estomacal es un antiácido:" },
    { re: /\b(thermometers?|termometro)\b/, care: true, en: "This kiosk doesn't carry thermometers.", es: "Este quiosco no tiene termómetros." },
    { re: /\b(covid|flu test|rapid test)\b/, care: true, en: "This kiosk doesn't carry COVID or flu tests.", es: "Este quiosco no tiene pruebas de COVID ni de gripe." },
    { re: /\b(plan b|morning after|emergency contraception|anticonceptivo de emergencia)\b/, care: true, en: "This kiosk doesn't carry emergency contraception. Pharmacies sell it without a prescription, and it works best the sooner it's taken:", es: "Este quiosco no tiene anticonceptivos de emergencia. Las farmacias los venden sin receta, y funcionan mejor cuanto antes se tomen:" },
    { re: /\b(condoms?|condones?)\b/, care: true, en: "This kiosk doesn't carry condoms.", es: "Este quiosco no tiene condones." },
    { re: /\b(narcan|naloxone|naloxona)\b/, care: true, en: "This kiosk doesn't carry naloxone. Pharmacies sell it without a prescription. If someone may be overdosing right now, call 911:", es: "Este quiosco no tiene naloxona. Las farmacias la venden sin receta. Si alguien puede estar en sobredosis ahora, llame al 911:" },
    { re: /\b(fentanyl|percs?|oxy|xans?|weed|marijuana|cocaine|heroin|adderall|xanax|oxycodone|oxycontin|vicodin|percocet|hydrocodone|valium|ambien|tramadol|ozempic|viagra|inhaler|albuterol|epipen|epinephrine|insulin|antibiotics?(?! ointment| cream)(?!.*\b(with|and)\b)|prescriptions?|inhalador|insulina|antibioticos?|receta)\b/, care: true, en: "This kiosk only has over-the-counter items, so nothing that needs a prescription. If you're having trouble breathing or a severe reaction, call 911. Otherwise:", es: "Este quiosco solo tiene productos de venta libre, nada con receta. Si tiene dificultad para respirar o una reacción grave, llame al 911. De lo contrario:" },
    { re: /\b(constipated|constipation|estrenido|estrenida|estrenimiento|miralax|laxatives?|laxantes?)\b/, care: true, en: "This kiosk doesn't carry anything for constipation. Water, fiber and walking often help. See a doctor for severe belly pain, blood in your stool, or if it lasts more than a week. A pharmacy can help too:", es: "Este quiosco no tiene nada para el estreñimiento. El agua, la fibra y caminar suelen ayudar. Consulte a un médico si tiene dolor fuerte, sangre en las heces o dura más de una semana. Una farmacia también puede ayudar:" },
    { re: /\b(pink eye|conjunctivitis|conjuntivitis|eye drops|gotas para los ojos)\b/, care: true, en: "This kiosk doesn't carry eye products. Pink eye spreads easily, so wash your hands, don't share towels, and stop wearing contacts. See urgent care for eye pain or vision changes:", es: "Este quiosco no tiene productos para los ojos. La conjuntivitis se contagia fácilmente: lávese las manos, no comparta toallas y deje de usar lentes de contacto. Vaya a atención urgente si hay dolor o cambios en la vista:" },
    { re: /\b(uti|urinary tract|bladder infection|burns? when i pee|infeccion urinaria)\b/, care: true, en: "A possible UTI needs a doctor, since it's usually treated with a prescription, and nothing here treats it. Go to urgent care today, and sooner with fever, back pain or vomiting:", es: "Una posible infección urinaria necesita un médico, porque suele tratarse con receta, y nada aquí la trata. Vaya hoy a atención urgente, y antes si tiene fiebre, dolor de espalda o vómito:" },
    { re: /\b(hydrocortisone|hidrocortisona|vitamins?|vitaminas?|nicotine|nicotina|cough syrup|jarabe)\b/, care: true, en: "This kiosk doesn't carry that.", es: "Este quiosco no tiene eso." },
  ];

  // One reply table entry: matched by `re` or `when`; either says en/es (as a warning if `warn`),
  // offers the `closest` product, flags nearby care, or does something custom in `run`.
  function replyFrom(table, p, R, skip) {
    const hit = table.find((x) => (x.re ? x.re.test(p) : x.when(p, R)) && !(skip && skip(x)));
    if (!hit) return false;
    if (hit.run) return hit.run(p, R) !== false;
    R.say(hit[R.lang], hit.warn ? "warn" : undefined);
    const alt = hit.closest && PRODUCTS.find((x) => x.id === hit.closest);
    if (alt && R.avail(alt)) { R.products = [alt]; R.chip(`Add ${alt.name}`, `Agregar ${alt.name}`); }
    if (hit.care) R.care = true;
    return true;
  }

  function handleNotCarried(p, R) {
    // "benadryl with my oxycodone" is about the benadryl.
    const hit = NOT_CARRIED.find((n) => n.re.test(p));
    if (hit && /only has over-the-counter/.test(hit.en) && findProducts(p).length) return false;
    return replyFrom(NOT_CARRIED, p, R);
  }


  const LABEL_STOP = new Set("should could would about there these those which label medicine product doctor after before using taking safe still years children adults being while their people".split(" "));

  // ---- questions about the whole shelf ----
  // Questions about the whole shelf or about situations, not one product.
  const shelfLines = (list) => list.map((x) => `• ${x.name}`).join("\n");
  const shelf = (test) => PRODUCTS.filter((x) => test(x._en || x, x));
  const SHELF_REPLIES = [
    { when: (p, R) => /\b(reaction)\b/.test(p) && /\b(what|anything|help|helps|can|does|do|should)\b/.test(p), en: "If there's any swelling of the face, lips or throat, trouble breathing, or dizziness, call 911 now. Nothing here treats a severe reaction. For mild itching or a few hives with none of those, Benadryl Allergy is labeled for itching from allergies, and a pharmacist or doctor can advise you.",
      es: "Si hay hinchazón de la cara, labios o garganta, dificultad para respirar o mareo, llame al 911 ahora. Nada aquí trata una reacción grave. Para picazón leve o pocas ronchas sin nada de eso, Benadryl para Alergias está etiquetado para picazón por alergias, y un farmacéutico o médico puede aconsejarle.", warn: true, care: true },
    { when: (p, R) => /\b(for|past|last)( a| \d+| two| three| four| several| a few)? (weeks?|months?)\b/.test(p) && findTopics(p).length, en: "That's gone on too long to keep treating yourself. Please see a doctor; a clinic can find out what's causing it.",
      es: "Eso lleva demasiado tiempo para seguir tratándolo por su cuenta. Por favor vea a un médico; una clínica puede averiguar la causa.", warn: true, care: true },
    { re: /\b(hangover|hungover|resaca|cruda)\b/, en: "Rest helps most. Ask the staff before you take any medicine, or eat or drink anything.",
      es: "El descanso ayuda más. Pregunte al personal antes de tomar cualquier medicamento o de comer o beber." },
    { re: /\b(tick|garrapata)\b/, en: "Pull the tick straight out with fine tweezers, close to the skin, then wash with soap and water. See a doctor if a rash spreads or you get a fever or body aches in the next few weeks, or if it was attached a long time.",
      es: "Saque la garrapata recto con pinzas finas, cerca de la piel, y lave con agua y jabón. Vea a un médico si se extiende un sarpullido o tiene fiebre o dolores en las siguientes semanas, o si estuvo pegada mucho tiempo." },
    { re: /\b(period|regla)\b.*\b(late|missed|atrasad\w*)\b|\b(missed|late)\b.*\b(period|regla)\b/, en: "A late period can have many causes, including pregnancy. This kiosk has a pregnancy test. See a doctor if your period stays away, or if you have severe pain.",
      es: "Un retraso puede tener muchas causas, incluido el embarazo. Este quiosco tiene una prueba de embarazo. Vea a un médico si sigue sin llegar o si tiene dolor fuerte.", closest: "pregnancytest" },
    { re: /\b(split|splitting|crush|crushing|cut|halve|half|chew)\b.*\b(caplets?|tablets?|pills?|tabletas?|comprimidos?)\b/, en: "Only do that if the package says you can. Some pills aren't meant to be split or crushed, and half an adult pill is not a safe dose for a child. A pharmacist can check for you.",
      es: "Hágalo solo si el paquete lo permite. Algunas pastillas no deben partirse ni triturarse, y media pastilla de adulto no es una dosis segura para un niño. Un farmacéutico puede revisarlo." },
    { re: /\b(diagnose|diagnosis|what do i have|whats wrong with me|diagnostico)\b/, en: "I can't diagnose anything. I'm software, not a clinician. Tell me your symptoms and I'll share label facts and when to see a doctor.",
      es: "No puedo diagnosticar nada. Soy un programa, no un profesional de salud. Dígame sus síntomas y le daré datos de las etiquetas y cuándo ver a un médico.", care: true },
    { re: /\b(vegan|vegetarian|halal|kosher|sugar free|sugar|gelatin|azucar)\b/, run: (p, R) => {
      R.say(inactiveNote([p.match(/\b(vegan|vegetarian|halal|kosher|sugar free|sugar|gelatin|azucar)\b/)[0] + R.L(" ingredients", " ")], R));
    } },
    { when: (p, R) => /\b(alcoholic|recovering|sober|sobriety|alcoholico)\b/.test(p) && /\balcohol\b/.test(p), en: "Only Purell Hand Sanitizer lists alcohol as an active ingredient, and it's for skin only. I don't have inactive ingredients, so check the package or ask a pharmacist. Liquid cold medicines elsewhere often contain alcohol, but we don't carry those.",
      es: "Solo el Desinfectante de Manos Purell tiene alcohol como ingrediente activo, y es solo para la piel. No tengo los ingredientes inactivos; revise el paquete o consulte a un farmacéutico." },
    { re: /\b(best value|best deal|best price)\b/, run: (p, R) => {
      const sorted = PRODUCTS.filter((x) => R.avail(x)).sort((a, b) => a.price - b.price).slice(0, 3);
      R.say(R.L(`The lowest prices here: ${sorted.map((x) => `${x.name} (${usd(x.price)})`).join(", ")}. Tell me what you need it for and I'll compare the right ones.`, `Los precios más bajos: ${sorted.map((x) => `${x.name} (${usd(x.price)})`).join(", ")}. Dígame para qué lo necesita y comparo los adecuados.`));
    } },
    { re: /\b(strongest|most powerful|strongest thing|mas fuerte)\b/, en: "Everything here is over-the-counter, and stronger isn't safer, so I don't rank them that way. Tell me what's going on and what you can't take, and I'll narrow it down. For severe pain, see a doctor.",
      es: "Todo aquí es de venta libre, y más fuerte no significa más seguro, así que no los clasifico así. Dígame qué le pasa y qué no puede tomar, y lo reduzco. Para dolor fuerte, vea a un médico." },
    { re: /\b(which|what)\b.*\b(drowsy|sleepy|drowsiness|sueno)\b/, run: (p, R) => {
      const list = shelf((x) => /drows/i.test(x.warnings));
      if (!list.length) { R.say(R.L("None of the items here are taken by mouth, and none of their labels warn about drowsiness.", "Ningún artículo de aquí se toma por la boca, y ninguna etiqueta advierte de somnolencia.")); return; }
      R.say(R.L(`These labels warn about drowsiness:\n${shelfLines(list)}\nDon't drive after taking them until you know how they affect you.`, `Estas etiquetas advierten de somnolencia:\n${shelfLines(list)}\nNo maneje después de tomarlos hasta saber cómo le afectan.`));
    } },
    { when: (p, R) => /\b(which|what)\b.*\b(pregnan\w*|breastfeeding|nursing)\b/.test(p) && !/\btests?\b/.test(p) && !(R.cond && R.cond.maybePregnant), en: "I can't clear any medicine as safe in pregnancy or while nursing. That's for a pharmacist or doctor. I can tell you the ibuprofen and aspirin labels warn against use in the last 3 months of pregnancy.",
      es: "No puedo declarar ningún medicamento como seguro en el embarazo o la lactancia. Eso le corresponde a un farmacéutico o médico. Sí puedo decirle que las etiquetas del ibuprofeno y la aspirina advierten contra su uso en los últimos 3 meses del embarazo.", warn: true, care: true },
    { when: (p, R) => /\b(not|isnt|arent|non) (a )?(medicine|medicines|medication|medications|pill|pills|drug|drugs)\b/.test(p) || /\b(without|no) (medicine|drugs)\b/.test(p), run: (p, R) => {
      const list = /\bpills?\b/.test(p) ? shelf((x, raw) => !ORAL_MED_IDS.includes(raw.id) || ["decongestant", "electrolyte"].includes(raw.id)) : shelf((x) => !x.activeIngredient);
      R.say(R.L(`Here's what we have:\n${shelfLines(list)}`, `Esto es lo que tenemos:\n${shelfLines(list)}`));
    } },
  ];
  function handleShelfQuestion(p, R) {
    return replyFrom(SHELF_REPLIES, p, R);
  }

  // ---- questions the label answers directly ----
  const labelLine = (text, re) => text.split(/(?<=[.:;])\s+/).find((s) => re.test(s));

  function handleLabelQuestion(p, R, pr) {
    const L = R.L;
    R.last = pr;
    const isDose = /\b(take|give|use|have|dose)\b/.test(p);
    if (/\b(risks?|dangers?|dangerous)\b/.test(p)) { R.say(L(`The label for ${pr.name} warns: ${pr.warnings}`, `La etiqueta de ${pr.name} advierte: ${pr.warnings}`)); return true; }
    if (/\bwhat drug is\b/.test(p)) { R.say(`${ingredientLine(pr, R)} ${pr.uses}`); return true; }
    if (/\bhow many dollars\b|\bhow much$|\bexpensive\b|\bprice check\b|\brun$/.test(p)) { R.say(L(`${pr.name} is ${usd(pr.price)} before tax.`, `${pr.name} cuesta ${usd(pr.price)} antes de impuestos.`)); return true; }
    if (/\b(price|cost|costs)\b|\bhow much (is|are|does|do|for|would)\b/.test(p) && !isDose) {
      if (R.cond && productConflicts(pr, R.cond).length) return false;
      R.say(L(`${pr.name} is ${usd(pr.price)} before tax.`, `${pr.name} cuesta ${usd(pr.price)} antes de impuestos.`));
      if (R.avail(pr)) R.chip(`Add ${pr.name}`, `Agregar ${pr.name}`);
      return true;
    }
    // Longer than the label allows: "imodium for a week", "nasal spray for 5 days"
    const span = p.match(/\b(?:for|past|last)( a| \d+| two| three| four| five| six| seven)? (day|days|week|weeks|month|months)\b/);
    const limit = (pr._en || pr).warnings.match(/more than (\d+) (day|week)s?|longer than (\d+) (week)/);
    if (span && limit && /\b(been|taking|took|used|using)\b/.test(p)) {
      const num = { " two": 2, " three": 3, " four": 4, " five": 5, " six": 6, " seven": 7, " a": 1, undefined: 1 }[span[1]] ?? parseInt(span[1], 10);
      const days = num * (/week/.test(span[2]) ? 7 : /month/.test(span[2]) ? 30 : 1);
      const max = parseInt(limit[1] || limit[3], 10) * (/week/.test(limit[2] || limit[4]) ? 7 : 1);
      if (days > max) { R.say(L(`That's longer than the label allows. Stop using ${pr.name} and see a doctor. The label says: ${pr.warnings}`, `Eso es más de lo que permite la etiqueta. Deje de usar ${pr.name} y vea a un médico. La etiqueta dice: ${pr.warnings}`), "warn"); R.care = true; return true; }
    }
    if (/\b(expired|expire|expires|expiration|out of date|vencido|caducado)\b/.test(p)) { R.say(L("Don't use medicine past the date on its package, because it may not work properly or be safe. Each package shows its own date.", "No use medicamentos después de la fecha del paquete, porque pueden no funcionar bien o no ser seguros. Cada paquete muestra su fecha.")); return true; }
    if (pr.id === "ointment" && /\b(bite|bites|bit|bitten|blisters?|serious burn|deep|puncture|mordida)\b/.test(p)) { R.say(L(`Ask a doctor first. The label for ${pr.name} says: ${pr.warnings}`, `Consulte primero a un médico. La etiqueta de ${pr.name} dice: ${pr.warnings}`), "warn"); return true; }
    if (pr.id === "patch" && /\b(sunburn|burn|wound|cut|broken skin|rash|heating pad)\b/.test(p)) { R.say(L(`No. The label for ${pr.name} says not to use it on wounds or damaged skin, or with a heating pad.`, `No. La etiqueta de ${pr.name} dice que no se use en heridas o piel dañada, ni con almohadilla térmica.`), "warn"); return true; }
    if (pr.id === "acetaminophen" && R.cond && R.cond.pregnant) { R.say(L("Acetaminophen is generally what doctors reach for first in pregnancy, at the lowest dose for the shortest time. Please confirm with your OB, because it depends on you.", "El acetaminofén suele ser lo primero que usan los médicos en el embarazo, en la dosis más baja por el menor tiempo. Confírmelo con su obstetra, porque depende de usted."), "warn"); return true; }
    if (pr.id === "acetaminophen" && R.cond && R.cond.bloodThinner) { R.say(L("Ask a doctor or pharmacist first. Regular acetaminophen can change how a blood thinner like warfarin works, even though it's usually preferred over Advil or aspirin.", "Consulte primero a un médico o farmacéutico. El acetaminofén regular puede cambiar cómo funciona un anticoagulante como la warfarina, aunque suele preferirse a Advil o aspirina."), "warn"); return true; }
    if (pr.id === "sunscreen" && /\b(baby|babies|infant|newborn|bebe)\b/.test(p)) { R.say(L("Ask a doctor before using sunscreen on a baby under 6 months. Keep young babies in the shade and covered.", "Consulte a un médico antes de usar protector solar en un bebé menor de 6 meses. Mantenga a los bebés en la sombra y cubiertos."), "warn"); return true; }
    if (/\b(in|into) (my|his|her|their|the) eyes?\b|\bleak\w*\b/.test(p)) { R.say(L("Rinse with plenty of cool running water for 15 minutes. Call Poison Control at 1-800-222-1222 for advice, or 911 for severe pain or vision changes.", "Enjuague con abundante agua fría durante 15 minutos. Llame a Control de Envenenamientos al 1-800-222-1222, o al 911 si hay dolor fuerte o cambios en la vista."), "warn"); return true; }
    if (pr.id === "tampons" && /\b(overnight|sleep|all night|how long)\b/.test(p)) { R.say(L(`The label says: ${pr.warnings} So don't leave one in past 8 hours, overnight included.`, `La etiqueta dice: ${pr.warnings} No lo deje más de 8 horas, tampoco de noche.`)); return true; }
    if (pr.id === "pregnancytest" && /\b(positive|negative|accurate|reliable|what now)\b/.test(p)) { R.say(L(`${pr.instructions} ${pr.warnings} If it's positive, see a doctor soon and ask before taking any medicine.`, `${pr.instructions} ${pr.warnings} Si es positiva, vea a un médico pronto y pregunte antes de tomar cualquier medicamento.`)); return true; }
    if (/\bhow long\b/.test(p) && !/\b(work|kick|take to|help)\b/.test(p)) { const stop = labelLine(pr.warnings, /\b(more|longer) than \d+ (days?|weeks?)|m[aá]s de \d+ (d[ií]as?|semanas?)/i); if (stop) { R.say(L(`From the label for ${pr.name}: "${stop}"`, `De la etiqueta de ${pr.name}: "${stop}"`)); return true; } const l = labelLine(pr.instructions, /\b(minutes|hours|days|minutos|horas|d[ií]as)\b/); if (l) { R.say(L(`From the label for ${pr.name}: "${l}"`, `De la etiqueta de ${pr.name}: "${l}"`)); return true; } }
    // Told us a condition this label doesn't mention: say so, instead of a generic blurb.
    const conds = R.cond && R.cond.labelConds;
    if (conds && conds.length && !productConflicts(pr, R.cond).length) { R.say(L(`The label for ${pr.name} doesn't mention ${LABEL_CONDS[conds[0]].en}, so ask a pharmacist or doctor to be sure.`, `La etiqueta de ${pr.name} no menciona ${LABEL_CONDS[conds[0]].es}; consulte a un farmacéutico o médico para estar seguro.`)); return true; }
    if (pr.id !== "ointment" && /\b(with|on|and)\b.*\b(antibiotics?|prescriptions?|my (pills|meds|medication|medicine))\b/.test(p)) {
      const line = labelLine(pr.warnings, /prescription|receta/i);
      R.say(line ? L(`The label for ${pr.name} says: "${line}"`, `La etiqueta de ${pr.name} dice: "${line}"`) : L(`The label for ${pr.name} doesn't cover your other medicine, so ask a pharmacist before combining them.`, `La etiqueta de ${pr.name} no cubre su otro medicamento; consulte a un farmacéutico antes de combinarlos.`));
      return true;
    }
    if (/\b(coffee|caffeine|tea|water|juice|milk|cafe)\b/.test(p) && /\b(with|and|drink)\b/.test(p) && !/\b(mix|packet)\b/.test(p)) { R.say(L(`The label for ${pr.name} doesn't mention that. Ask a pharmacist if you're unsure.`, `La etiqueta de ${pr.name} no menciona eso. Consulte a un farmacéutico si tiene dudas.`)); return true; }
    if (/\b(anything|what|things?) (i |should i |do i |to )*(should )?know\b|\bbefore (using|taking|i use|i take)\b/.test(p)) {
      R.say(L(`Before using ${pr.name}, the label warns: ${pr.warnings}`, `Antes de usar ${pr.name}, la etiqueta advierte: ${pr.warnings}`));
      return true;
    }
    if (/\b(sleepy|drowsy|drowsiness|tired|drive|driving|machinery|sueno|somnolencia|manejar|conducir)\b/.test(p)) {
      const line = labelLine(pr.warnings, /drows|somnolencia/i);
      if (line && /\b(took|taken|just had)\b/.test(p)) { R.say(L(`Please don't drive. The label for ${pr.name} warns: "${line}" Pull over somewhere safe, and get a ride or wait until you're fully alert.`, `Por favor no maneje. La etiqueta de ${pr.name} advierte: "${line}" Deténgase en un lugar seguro y pida que lo lleven o espere hasta estar totalmente alerta.`), "warn"); return true; }
      R.say(line
        ? L(`${/\b(drive|driving|machinery)\b/.test(p) ? "No, don't drive after taking it." : "Yes, it can."} The label for ${pr.name} warns: "${line}"`, `${/\b(drive|driving|machinery)\b/.test(p) ? "No maneje después de tomarlo." : "Sí, puede."} La etiqueta de ${pr.name} advierte: "${line}"`)
        : L(`Drowsiness isn't listed on the label for ${pr.name}. If you do feel drowsy, don't drive.`, `La somnolencia no aparece en la etiqueta de ${pr.name}. Si siente sueño, no maneje.`));
      return true;
    }
    if (/\bhow (long|fast|quickly|soon)\b.*\b(work|kick|help|take)\b|\bcuanto tarda\b/.test(p)) {
      R.say(L(`The label for ${pr.name} doesn't say how fast it works, so I won't guess. A pharmacist can tell you. Its directions: ${pr.instructions}`, `La etiqueta de ${pr.name} no dice qué tan rápido funciona, así que no voy a adivinar. Un farmacéutico puede decírselo. Instrucciones: ${pr.instructions}`));
      return true;
    }
    if (/\b(max|maximum|most|limit|per day|a day|in a day|al dia|maximo)\b/.test(p)) {
      const line = labelLine(pr.instructions, /24 (hours|horas)/);
      if (line) { R.say(L(`The label limit for ${pr.name}: "${line}"`, `El límite en la etiqueta de ${pr.name}: "${line}"`)); return true; }
    }
    if (/\bhow often\b|\bcada cuanto\b|\bhow many times\b/.test(p)) {
      const line = labelLine(pr.instructions, /\b(every|cada)\b/);
      if (line) { R.say(L(`From the label for ${pr.name}: "${line}"`, `De la etiqueta de ${pr.name}: "${line}"`)); return true; }
    }
    if (/\b(more|another|again)\b/.test(p) && /\b(took|had|still)\b/.test(p)) {
      R.say(L(`Only follow the label's timing and daily limit, counting what you already took. ${pr.name}: ${pr.instructions} If it isn't helping, ask a pharmacist or doctor instead of taking extra.`, `Siga solo el horario y el límite diario de la etiqueta, contando lo que ya tomó. ${pr.name}: ${pr.instructions} Si no ayuda, consulte a un farmacéutico o médico en vez de tomar más.`));
      return true;
    }
    if (/\blatex\b/.test(p)) { R.say(DRUG_NOTES.latex[R.lang === "es" ? 1 : 0]); return true; }
    if (/\b(empty stomach|with food|without food|estomago vacio|con comida)\b/.test(p)) {
      R.say(/NSAID/.test(pr.activeIngredient || "")
        ? L(`${pr.name} is an NSAID and can irritate the stomach. Taking it with food or milk can help if it upsets your stomach. Skip it and ask a doctor if you've had ulcers or stomach bleeding.`, `${pr.name} es un AINE y puede irritar el estómago. Tomarlo con comida o leche puede ayudar si le cae mal. Evítelo y consulte a un médico si ha tenido úlceras o sangrado estomacal.`)
        : L(`The label for ${pr.name} doesn't say anything about food, so ask a pharmacist if that's a concern.`, `La etiqueta de ${pr.name} no menciona la comida; consulte a un farmacéutico si le preocupa.`));
      return true;
    }
    // Anything else: quote the label sentence that mentions what they asked about ("with a heating pad").
    if (/^(can|could|should|is|are|does|do|will)\b/.test(p) && !detectQuestionCategory(p)) {
      const nameWords = new Set(toPlain(normKeep((pr._en || pr).name)).split(" "));
      const words = p.split(" ").filter((w) => w.length >= 5 && !nameWords.has(w) && !LABEL_STOP.has(w));
      const line = (`${pr.warnings} ${pr.instructions}`).split(/(?<=[.:;])\s+/).find((s) => words.some((w) => new RegExp(`\\b${w}`, "i").test(s)));
      if (line) { R.say(L(`The label for ${pr.name} says: "${line}"`, `La etiqueta de ${pr.name} dice: "${line}"`)); return true; }
    }
    return false;
  }

  // ---- "the second one", "which is cheapest", "which should I get" ----
  function ordinalPick(p, list) {
    if (list.length < 2 || !/\b(one|option|item|choice)\b|^(the )?(first|second|third|last)$/.test(p)) return null;
    const m = p.match(/\b(first|1st|second|2nd|third|3rd|last)\b/);
    if (!m) return null;
    return list[{ first: 0, "1st": 0, second: 1, "2nd": 1, third: 2, "3rd": 2, last: list.length - 1 }[m[1]]] || null;
  }

  function handleListQuestion(p, R, ctx) {
    const list = ctx.lastList || [];
    if (list.length < 2) return false;
    const short = p.split(" ").length <= 7;
    if (short && /\b(cheapest|cheaper|least expensive|lowest price)\b/.test(p) && (/\b(which|one|these|those|them)\b/.test(p))) {
      const sorted = list.slice().sort((a, b) => a.price - b.price);
      R.say(R.L(`Of those, ${sorted[0].name} is the cheapest at ${usd(sorted[0].price)}.`, `De esos, ${sorted[0].name} es el más barato, ${usd(sorted[0].price)}.`));
      R.products = [sorted[0]];
      R.chip(`Add ${sorted[0].name}`, `Agregar ${sorted[0].name}`);
      return true;
    }
    if (short && /\b(which|what)\b.*\b(should|best|better|recommend|pick|choose|get)\b/.test(p)) {
      const lines = list.slice(0, 3).map((x) => `• ${x.name} (${x.activeIngredient || x.dosage}), ${usd(x.price)}`).join("\n");
      R.say(R.L(`I can't pick for you without knowing your health, but here's how they differ:\n${lines}\nTell me your age, medicines, allergies or conditions like pregnancy, and I'll rule out anything unsafe. A pharmacist can give personal advice.`,
        `No puedo elegir por usted sin conocer su salud, pero así se diferencian:\n${lines}\nDígame su edad, medicamentos, alergias o condiciones como embarazo, y descartaré lo que no sea seguro. Un farmacéutico puede darle consejo personal.`));
      R.products = list.slice(0, 3);
      return true;
    }
    return false;
  }

  // ---- "make it 3", "remove one bandaid" ----
  const QTY_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  function handleVague(text, R) {
    if (!/\b(im|i am|i feel|feeling|i dont feel|estoy|me siento)( so| really| very| kinda| pretty| like| muy)* (sick|crap|terrible|awful|unwell|ill|not well|not good|bad|shit|enfermo|enferma|mal)\b|\bi dont feel (so |very |too )?(well|good)\b/.test(text)) return false;
    if (/\b(headache|fever|cough|stomach|throat|pain|nausea|cramps)\b/.test(text)) return false;
    R.say(R.L("Sorry you're not feeling well. What's bothering you most?", "Lamento que no se sienta bien. ¿Qué es lo que más le molesta?"));
    [["Headache", "Dolor de cabeza"], ["Fever", "Fiebre"], ["Cough or cold", "Tos o resfriado"], ["Upset stomach", "Dolor de estómago"]].forEach(([en, es]) => R.chip(en, es));
    return true;
  }

  function handleQuantity(p, R, ctx, prods) {
    const items = (ctx.cart || []);
    if ((/\b(whats|what is|how much)\b.*\btotal\b|\bhow many\b.*\b(do i have|in my (cart|order)|did i add)\b|^total$|\b(how much|what) do i owe\b|\bhow much is (everything|it all|all of it|all this)\b/.test(p)) && !prods.length) {
      const { sub, tax, total } = cartTotals(ctx);
      R.say(items.length
        ? R.L(`You have ${items.reduce((n, c) => n + c.qty, 0)} item(s): ${items.map((c) => `${c.product.name} × ${c.qty}`).join(", ")}. Total ${usd(total)} (${usd(sub)} + ${usd(tax)} tax).`, `Tiene ${items.reduce((n, c) => n + c.qty, 0)} artículo(s): ${items.map((c) => `${c.product.name} × ${c.qty}`).join(", ")}. Total ${usd(total)} (${usd(sub)} + ${usd(tax)} de impuesto).`)
        : R.L("Your cart is empty.", "Su carrito está vacío."));
      return true;
    }
    if (!items.length) return false;
    // "is that ok?" right after adding things: check the cart itself.
    if (items.length >= 2 && /^(is|are) (that|this|it|these|those|they)\b.*\b(ok|okay|safe|fine|alright)\b/.test(p)) {
      const combos = findInteractions(items.map((c) => c.product), R.lang);
      if (combos.length) combos.forEach((w) => R.say(`${w.title}: ${w.names.join(" + ")}. ${w.detail}`, "warn"));
      else R.say(R.L("The kiosk's safety checks don't flag anything in your cart together. Check each label, and ask a pharmacist if you take other medicines.", "Las revisiones del quiosco no señalan nada en su carrito. Revise cada etiqueta y consulte a un farmacéutico si toma otros medicamentos."));
      return true;
    }
    if (ctx.lastProduct && /^(please )?(add )?(another|one more)( one)?$/.test(p)) {
      R.say(R.L(`Adding one more ${ctx.lastProduct.name}.`, `Agregando otro ${ctx.lastProduct.name}.`));
      R.actions.push({ type: "add", id: ctx.lastProduct.id, qty: 1 });
      return true;
    }
    const n = "(\\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten)";
    const setM = p.match(new RegExp(`\\b(?:make|change|set|update)\\b.*?\\b${n}\\b(?!\\s*(?:mg|year))`)) || p.match(new RegExp(`^(?:i (?:only )?(?:want|need)|just|only|can i (?:get|have)) ${n}\\b(?: of (?:those|them|that|it)| instead)?$`)) || p.match(new RegExp(`^${n}$`)) || (ctx.lastProduct && p.match(new RegExp(`^(?:i (?:only )?(?:want|need)|just|only) ${n}\\b`)));
    if (ctx.lastProduct && /^(take it out|get rid of (it|that)|i dont want (it|that|this)( anymore)?|delete (it|that)|nevermind remove it|never mind remove it|remove it|remove that|take that out|dont want it anymore)$/.test(p) && items.some((c) => c.product.id === ctx.lastProduct.id)) {
      R.say(R.L(`Removing ${ctx.lastProduct.name} from your cart.`, `Quitando ${ctx.lastProduct.name} de su carrito.`));
      R.actions.push({ type: "remove", id: ctx.lastProduct.id });
      return true;
    }
    const decM = /^(please )?(remove|take out|take off|drop) (one|1|a|an)\b/.test(p);
    if (!setM && !decM) return false;
    const targetId = (prods[0] || (ctx.lastProduct && items.some((c) => c.product.id === ctx.lastProduct.id) && ctx.lastProduct) || (items.length === 1 && items[0].product) || {}).id;
    const line = items.find((c) => c.product.id === targetId);
    if (!line) {
      if (!/\b(make|change|set|update|remove|take|drop)\b/.test(p)) return false; // "i need 2 bandaids" is an add
      R.say(R.L("Which item should I change?", "¿Qué artículo cambio?"));
      items.forEach((c) => R.chip(`Make ${c.product.name} ${setM ? setM[1] : 1}`, `Cambiar ${c.product.name} a ${setM ? setM[1] : 1}`));
      return true;
    }
    if (decM && !setM && /^(please )?(remove|take out|take off|drop) \d/.test(p) === false && line.qty <= 1) { R.say(R.L(`Removing ${line.product.name} from your cart.`, `Quitando ${line.product.name} de su carrito.`)); R.actions.push({ type: "remove", id: line.product.id }); return true; }
    const want = decM ? line.qty - 1 : (QTY_WORDS[setM[1]] ?? parseInt(setM[1], 10));
    const max = line.product.highRisk ? 2 : 10;
    const qty = Math.min(want, max);
    if (want > max) R.say(R.L(`The limit is ${max} per order for ${line.product.name}.`, `El límite es ${max} por pedido para ${line.product.name}.`), "warn");
    R.say(qty > 0
      ? R.L(`Done: ${line.product.name} × ${qty}.`, `Listo: ${line.product.name} × ${qty}.`)
      : R.L(`Removing ${line.product.name} from your cart.`, `Quitando ${line.product.name} de su carrito.`));
    R.actions.push(qty > 0 ? { type: "setQty", id: line.product.id, qty } : { type: "remove", id: line.product.id });
    R.last = line.product;
    return true;
  }

  // carry memory forward
  function finish(R, ctx) {
    if (R.cond) applyConditions(R, R.cond);
    // Questions about overdose amounts aren't emergencies, but always surface the number.
    if (!R.emergency && /\b(overdose|too much|too many)\b/.test(R.cond !== undefined ? safetyNormalize(R.rawText || "") : "") ) {
      R.say(R.L("If someone has already taken too much, call Poison Control at 1-800-222-1222 (free, 24/7).", "Si alguien ya tomó demasiado, llame a Control de Envenenamientos al 1-800-222-1222 (gratis, 24/7)."), "system");
    }
    if (R.cond && R.cond.ageUnknown && !R.emergency) {
      R.say(R.L("How old is your child? Label rules change with age, so I can check properly.", "¿Qué edad tiene su hijo? Las reglas de la etiqueta cambian con la edad, así puedo revisar bien."));
      R.pending = { type: "askAge", text: R.rawText };
    }
    if (R.lang === "es" && ctx.lang !== "es") R.chip("Cambiar a español", "Cambiar a español");
    if (R.cond && R.products.length) {
      // "i take zorvex": a medicine we don't recognize means ask, never a product card.
      const m = safetyNormalize(R.rawText).match(/\b(?:i take|im on|i am on|im taking|i am taking|tomo)\s+([a-z]{5,})\b/);
      if (m && !COMMON.has(m[1]) && !VOCAB.has(m[1]) && !hasConditions(detectConditions(R.rawText)) && !/^(medicine|medication|vacation|break|lunch|naps?|tylenol|advil|aspirin)$/.test(m[1])) {
        R.products = []; R.actions = R.actions.filter((a) => a.type !== "add"); R.chips = [];
        R.replies = [{ kind: "warn", text: R.L(`I don't recognize "${m[1]}", so I can't say what's safe with it. Please ask a pharmacist before adding anything.`, `No reconozco "${m[1]}", así que no puedo decir qué es seguro con eso. Consulte a un farmacéutico antes de agregar algo.`) }];
        R.care = true;
      }
    }
    if (R.cond) {
      // What they tell us about themselves holds for the whole visit (cleared when the kiosk resets).
      const { age, ageUnknown, pet, notPregnant, avoid, allergyOther, ...keep } = R.cond;
      if (avoid && /\b(cant|cannot|can not|not allowed|told not|no puedo)\b/.test(safetyNormalize(R.rawText))) keep.avoid = avoid;
      R.profile = R.profileCleared ? {} : keep;
      const said = detectConditions(R.rawText);
      if (said.allergyAll) R.say(R.L("I can't safely suggest any medicine for you here. Please talk to a pharmacist or your doctor before taking anything.", "No puedo sugerirle ningún medicamento con seguridad. Hable con un farmacéutico o su médico antes de tomar algo."), "warn");
      if (said.allergyDrugs && !R.drugNoted) said.allergyDrugs.forEach((k) => R.say(DRUG_NOTES[k][R.lang === "es" ? 1 : 0], "warn"));
      if (said.allergyInactive && !R.inactiveNoted) R.replies.unshift({ kind: "warn", text: inactiveNote(said.allergyInactive, R) });
      if (said.allergyOther) R.say(R.L(`I don't have information about "${said.allergyOther}". Check each package's full ingredient list, or ask a pharmacist.`, `No tengo información sobre "${said.allergyOther}". Revise la lista completa de ingredientes de cada paquete o consulte a un farmacéutico.`), "warn");
      // Tell them if something unsafe for them is already in the cart.
      (ctx.cart || []).forEach((c) => {
        const why = productConflicts(c.product, R.cond);
        if (why.length) { R.say(R.L(`Your cart has ${c.product.name}: ${why[0].en}. I'd remove it.`, `Su carrito tiene ${c.product.name}: ${why[0].es}. Le sugiero quitarlo.`), "warn"); R.chip(`Remove ${c.product.name}`, `Quitar ${c.product.name}`); }
      });
    }
    // Replies flagged for care used to lead into a nearby-care card; this build sends people to the front desk instead.
    if (R.care && !R.emergency) {
      R.replies.forEach((x) => { x.text = x.text.replace(/\s*(Otherwise|De lo contrario):$/, "").replace(/:$/, "."); });
      R.say(R.L(`You're at ${KIOSK_SITE.name}. The staff at the front desk can help you get the right care here.`, `Está en ${KIOSK_SITE.name}. El personal de la recepción puede ayudarle a recibir la atención adecuada aquí.`));
    }
    if (R.products.length === 1) { R.last = R.products[0]; R.lastList = [R.products[0]]; }
    if (R.products.length > 1 && R.pending && R.pending.type === "add" && R.pending.ids.length === 1) R.pending = null; // "yes" to a list must ask which one
    R.prev = R.last && ctx.lastProduct && R.last.id !== ctx.lastProduct.id ? ctx.lastProduct : ctx.prevProduct;
    if (R.last === undefined) R.last = ctx.lastProduct || null;
    if (R.lastList === undefined) R.lastList = ctx.lastList || [];
    if (!R.chips.length && !R.emergency) {
      const cartHas = ctx.cart && ctx.cart.length;
      if (cartHas) { R.chip("What's in my cart?", "¿Qué hay en mi carrito?"); R.chip("Checkout", "Pagar"); }
      R.chip("Where am I?", "¿Dónde estoy?");
    }
    return R;
  }

  return { respond, suggestedPrompts };
})();
