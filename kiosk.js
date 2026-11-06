// MediVend kiosk app logic. Vanilla JS, no build step, no network
// dependency — everything (product matching, translations, icons) is
// loaded from local <script> tags so this runs on offline kiosk hardware.

// ============================================================
// Icon injection (static, one-time)
// ============================================================

function setIcon(id, kind) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = iconSvg(kind);
}

[
  ["headerLogo", "logo"], ["headerCartIcon", "cart"], ["langIcon", "globe"],
  ["a11yIcon", "access"], ["idleLogo", "logo"], ["searchIcon", "search"],
  ["micIcon", "mic"], ["helperIcon", "help"], ["bannerIcon", "alert"],
  ["cartIcon", "cart"], ["reviewPayArrow", "chevronRight"], ["pdCloseIcon", "close"],
  ["pdMinusIcon", "minus"], ["pdPlusIcon", "plus"], ["symCloseIcon", "close"],
  ["checkoutBackIcon", "chevronLeft"], ["reviewContinueIcon", "chevronRight"], ["termsAgreeIcon", "chevronRight"],
  ["verifyIcon", "idCard"], ["scanIdIcon", "idCard"], ["payIcon", "nfc"],
  ["nfcIcon", "nfc"], ["cardIcon2", "card"], ["fsaIcon", "card"],
  ["resetClockIcon", "clock"], ["emergencyIcon", "alert"],
  ["judgesToggleIcon", "star"], ["judgesCloseIcon", "close"],
  ["thermalOverrideIcon", "thermometer"], ["dispenserJamIcon", "wrench"],
  ["redFlagIcon", "pulse"], ["interactionIcon", "alert"],
  ["toastIcon", "check"], ["dispenseIcon", "pill"],
  ["aabIcon", "chat"], ["aabChevron", "chevronRight"], ["aiChatCloseIcon", "close"],
  ["chatMicIcon", "mic"], ["chatSendIcon", "chevronRight"], ["aboutBackIcon", "chevronLeft"],
].forEach(([id, kind]) => setIcon(id, kind));

// ============================================================
// Scale-to-fit: the kiosk is a fixed 1080x1920 canvas, scaled down to fit
// whatever browser window it's previewed in (real hardware is 1080x1920,
// so scale lands at ~1 there).
// ============================================================

const scaler = document.getElementById("kioskScaler");
const kiosk = document.getElementById("kiosk");

function fitKiosk() {
  const margin = 24;
  const scale = Math.min(
    (window.innerWidth - margin * 2) / 1080,
    (window.innerHeight - margin * 2) / 1920,
    1
  );
  kiosk.style.transform = `scale(${scale})`;
  scaler.style.width = 1080 * scale + "px";
  scaler.style.height = 1920 * scale + "px";
}
window.addEventListener("resize", fitKiosk);
fitKiosk();

// ============================================================
// Clock
// ============================================================

const headerClock = document.getElementById("headerClock");
headerClock.innerHTML = iconSvg("clock") + '<span id="clockTime"></span>';
const clockTimeEl = document.getElementById("clockTime");
function updateClock() {
  clockTimeEl.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
updateClock();
setInterval(updateClock, 1000);

// ============================================================
// Toast
// ============================================================

const toastEl = document.getElementById("toast");
const toastTextEl = document.getElementById("toastText");
let toastTimer = null;
function showToast(text, warn) {
  toastTextEl.textContent = text;
  toastEl.classList.toggle("warn", !!warn);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), warn ? 6000 : 2200);
}

// The kiosk's own English/Spanish picker for short UI strings (i18n.js holds the longer ones).
const L = (en, es) => (currentLang === "es" ? es : en);

// ============================================================
// Cart state
// ============================================================

const TAX_RATE = 0.07;
let cart = []; // [{ id, qty }]

// ============================================================
// Judges-panel demo scenario state
// ============================================================
// Liquid/gel items a cabinet over-temperature would chemically degrade.
const HEAT_SENSITIVE_IDS = ["ointment", "decongestant", "sanitizer", "sunscreen", "coldpack"];

let cabinetOverheated = false; // Thermal Stability Override
let simulateDispenserJam = false; // one-shot: consumed by the next dispense

function isTempLocked(product) {
  return cabinetOverheated && HEAT_SENSITIVE_IDS.includes(product.id);
}
// null | "temp" | "stock" — why a product can't be added right now, if at all.
function unavailableReason(product) {
  if (isTempLocked(product)) return "temp";
  if (!product.inStock) return "stock";
  return null;
}
function isAvailable(product) { return unavailableReason(product) === null; }

// If the top match in a result list is unavailable, find the first other
// match that IS available, so the AI can proactively suggest it instead of
// just apologizing.
function findInStockAlternative(products) {
  if (!products.length || isAvailable(products[0])) return null;
  return products.find(isAvailable) || null;
}

// Escape anything interpolated into innerHTML (catalog data is static today, but don't rely on it).
function esc(v) { return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function money(n) { return "$" + n.toFixed(2); }
function findProduct(id) { return PRODUCTS.find((p) => p.id === id); }
function cartItems() { return cart.map((c) => ({ product: findProduct(c.id), qty: c.qty })).filter((c) => c.product); }
function cartCount() { return cart.reduce((sum, c) => sum + c.qty, 0); }
function cartSubtotal() { return cartItems().reduce((sum, c) => sum + c.product.price * c.qty, 0); }

// Returns false (and adds nothing) if the item is out of stock or
// temperature-locked, so no code path can sneak an unavailable item into an order.
function addToCart(product, qty) {
  if (!isAvailable(product)) return false;
  // High-risk medicines are capped per order, like a pharmacy counter limit.
  const max = product.highRisk ? 2 : 10;
  const existing = cart.find((c) => c.id === product.id);
  if (existing && existing.qty >= max) {
    showToast(L(`Limit ${max} per order for ${product.name}`, `Límite de ${max} por pedido para ${product.name}`));
    return false;
  }
  if (existing) existing.qty = Math.min(existing.qty + qty, max);
  else cart.push({ id: product.id, qty: Math.min(qty, max) });
  updateCartFooter();
  bumpCartBadges();
  return true;
}

// An item can become unavailable AFTER it's in the cart (judges flip stock,
// thermal lockout kicks in). Drop those so they can't be paid for and
// "dispensed". Returns the removed product names.
function pruneUnavailableCart() {
  const removed = [];
  cart = cart.filter((c) => {
    const p = findProduct(c.id);
    if (p && isAvailable(p)) return true;
    if (p) removed.push(p.name);
    return false;
  });
  if (removed.length) updateCartFooter();
  return removed;
}

function syncCartWithAvailability() {
  const removed = pruneUnavailableCart();
  if (!removed.length) return;
  showToast(`${removed.join(", ")} ${L("is no longer available and was removed from your cart", "ya no está disponible y se quitó del carrito")}`);
  if (checkoutScreen.classList.contains("show")) {
    if (cartCount() === 0) { closeCheckout(); return; }
    renderReviewList();
    refreshCheckoutSteps();
  }
}

// ============================================================
// Mandatory safety acknowledgment for dangerous medicines
// ============================================================
// Items flagged `highRisk` in products.js can't be added (or dispensed in
// the regular flow) until the customer ticks a box saying they've read the
// product's own label warnings and know what they're doing. Once
// acknowledged, that item isn't asked again for the rest of the customer's
// session (reset with the kiosk), so bumping the quantity isn't nagged.

const safetyAckOverlay = document.getElementById("safetyAckOverlay");
const ackCheckRow = document.getElementById("ackCheckRow");
const ackConfirmBtn = document.getElementById("ackConfirmBtn");
let ackedProductIds = new Set();
let ackPending = null; // { product, mode, onConfirm, onCancel }
let ackChecked = false;

// One label sentence per bullet; "ask a doctor first" / "do not use" lines in bold.
function warningListHtml(text) {
  return `<ul class="warn-list">${text.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚ¿])/).map((x) =>
    `<li${/\b(ask a doctor|do not use|consulte primero|no lo use|no la use)\b/i.test(x) ? ' class="key"' : ""}>${esc(x)}</li>`).join("")}</ul>`;
}

function needsSafetyAck(product) {
  return !!product.highRisk && !ackedProductIds.has(product.id);
}

function setAckChecked(on) {
  ackChecked = on;
  ackCheckRow.classList.toggle("checked", on);
  ackCheckRow.classList.remove("shake", "missing");
  ackCheckRow.setAttribute("aria-checked", String(on));
  document.getElementById("ackCheckbox").innerHTML = on ? iconSvg("check") : "";
  ackConfirmBtn.classList.toggle("locked", !on);
  ackConfirmBtn.setAttribute("aria-disabled", String(!on));
  document.getElementById("ackHint").classList.remove("show");
}

function openSafetyAck(product, mode, onConfirm, onCancel) {
  ackPending = { product, mode, onConfirm, onCancel };
  document.getElementById("ackIcon").innerHTML = iconSvg("alert");
  document.getElementById("ackProductIcon").innerHTML = iconSvg(product.icon);
  document.getElementById("ackProductName").textContent = product.name;
  document.getElementById("ackProductDose").textContent = product.dosage;
  document.getElementById("ackWarnings").innerHTML = warningListHtml(product.warnings);
  const hasAllergy = product.allergyAlert && !/^(none known|ninguna conocida)\.?$/i.test(product.allergyAlert.trim());
  document.getElementById("ackAllergyBlock").style.display = hasAllergy ? "" : "none";
  document.getElementById("ackAllergy").textContent = product.allergyAlert;
  // Label text is deliberately kept in English (see i18n.js); say so.
  document.getElementById("ackNote").textContent = "";
  document.getElementById("ackConfirmLabel").textContent = t(mode === "dispense" ? "ackConfirmDispense" : "ackConfirm");
  document.getElementById("ackConfirmLabel").removeAttribute("data-i18n");
  setAckChecked(false);
  document.getElementById("ackCard").scrollTop = 0;
  safetyAckOverlay.classList.add("show");
  ackCheckRow.focus({ preventScroll: true });
}

function closeSafetyAck(confirmed) {
  if (!ackPending) { safetyAckOverlay.classList.remove("show"); return; }
  const pending = ackPending;
  ackPending = null;
  safetyAckOverlay.classList.remove("show");
  if (confirmed) {
    ackedProductIds.add(pending.product.id);
    pending.onConfirm();
  } else if (pending.onCancel) {
    pending.onCancel();
  }
}

ackCheckRow.addEventListener("click", () => setAckChecked(!ackChecked));
ackCheckRow.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); setAckChecked(!ackChecked); }
});
document.getElementById("ackCancelBtn").addEventListener("click", () => closeSafetyAck(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ackPending) closeSafetyAck(false);
});
ackConfirmBtn.addEventListener("click", () => {
  if (!ackChecked) {
    // Not ticked: don't proceed — nudge the checkbox instead.
    ackCheckRow.classList.remove("shake");
    void ackCheckRow.offsetWidth;
    ackCheckRow.classList.add("shake", "missing");
    document.getElementById("ackHint").classList.add("show");
    return;
  }
  closeSafetyAck(true);
});

// The one door into the cart for customer-driven adds: shows the mandatory
// acknowledgment first when the item needs it. done(added) runs afterwards
// (added === false if unavailable or the customer cancelled).
function guardedAdd(product, qty, done) {
  const finish = (ok) => { if (done) done(ok); if (ok) warnNewInteraction(product); };
  if (!isAvailable(product)) { finish(false); return; }
  if (needsSafetyAck(product)) {
    openSafetyAck(product, "add", () => finish(addToCart(product, qty)), () => finish(false));
    return;
  }
  finish(addToCart(product, qty));
}

// Flag a clash the moment the second item lands in the cart, not at checkout.
// Runs after the caller's own "Added" toast so this one wins.
function warnNewInteraction(product) {
  // Tapping Add on a card skips the chat, so check what they already told the assistant.
  const clash = productConflicts(product, assistantMemory.profile || {});
  if (clash.length) { showToast(`${product.name}: ${clash[0][L("en", "es")]}`, true); return; }
  const prods = cart.map((c) => findProduct(c.id)).filter(Boolean);
  const hit = findInteractions(prods, currentLang).find((c) => c.names.includes(product.name));
  if (hit) showToast(`${hit.title}: ${hit.detail}`, true);
}

// Little pop on the cart counters whenever the count changes.
function bumpCartBadges() {
  ["cartCountNum", "headerCartBadge"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("bump");
    void el.offsetWidth; // restart the animation
    el.classList.add("bump");
  });
}

// Product "flies" from the tapped button into the cart footer.
function flyToCart(fromEl, product) {
  if (!fromEl || !fromEl.animate) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = document.getElementById("cartCountNum");
  const kRect = kiosk.getBoundingClientRect();
  const scale = kRect.width / 1080 || 1;
  const a = fromEl.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const fly = document.createElement("div");
  fly.className = "fly-dot";
  fly.innerHTML = iconSvg(product.icon);
  const sx = (a.left + a.width / 2 - kRect.left) / scale - 22;
  const sy = (a.top + a.height / 2 - kRect.top) / scale - 22;
  const ex = (b.left + b.width / 2 - kRect.left) / scale - 22;
  const ey = (b.top + b.height / 2 - kRect.top) / scale - 22;
  fly.style.left = sx + "px";
  fly.style.top = sy + "px";
  kiosk.appendChild(fly);
  const anim = fly.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${(ex - sx) * 0.5}px, ${(ey - sy) * 0.5 - 90}px) scale(1.15)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${ex - sx}px, ${ey - sy}px) scale(0.3)`, opacity: 0.2 },
    ],
    { duration: 650, easing: "cubic-bezier(.4,.1,.3,1)" }
  );
  anim.onfinish = () => fly.remove();
}

function setCartQty(id, qty) {
  const entry = cart.find((c) => c.id === id);
  if (!entry) return;
  if (qty <= 0) cart = cart.filter((c) => c.id !== id);
  else entry.qty = qty;
  updateCartFooter();
}

const cartCountNum = document.getElementById("cartCountNum");
const cartCountLabel = document.getElementById("cartCountLabel");
const cartTotalValue = document.getElementById("cartTotalValue");
const reviewPayBtn = document.getElementById("reviewPayBtn");

// Count the footer total up/down instead of snapping to the new value.
function tweenMoney(el, to) {
  const from = parseFloat(el.dataset.v || "0");
  el.dataset.v = String(to);
  cancelAnimationFrame(el._raf);
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || from === to) { el.textContent = money(to); return; }
  const t0 = performance.now(), dur = 380;
  const step = (now) => {
    const k = Math.min(1, Math.max(0, (now - t0) / dur)); // rAF time can predate t0 → negative totals
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = money(from + (to - from) * eased);
    if (k < 1) el._raf = requestAnimationFrame(step);
    else el.textContent = money(to);
  };
  el._raf = requestAnimationFrame(step);
}

function itemsSelectedLabel(n) {
  if (currentLang === "es") return n === 1 ? "1 artículo seleccionado" : `${n} artículos seleccionados`;
  return n === 1 ? "1 item selected" : `${n} items selected`;
}

// "Add" until it's in the cart, then "Add another · 2 in order" so nobody double-buys by accident.
function addLabelFor(product) {
  const line = cart.find((c) => c.id === product.id);
  if (!line) return L("Add", "Agregar");
  return L(`Add another · ${line.qty} in order`, `Agregar otro · ${line.qty} en pedido`);
}
function syncCardCartState() {
  document.querySelectorAll("#productGrid .product-card").forEach((card) => {
    const btn = card.querySelector(".add-btn");
    const p = findProduct(card.dataset.id);
    card.classList.toggle("in-cart", cart.some((c) => c.id === card.dataset.id));
    if (p && btn && !btn.disabled && !btn.classList.contains("added")) btn.querySelector("span").textContent = addLabelFor(p);
  });
}

function updateCartFooter() {
  syncCardCartState();
  const n = cartCount();
  cartCountNum.textContent = String(n);
  cartCountLabel.textContent = itemsSelectedLabel(n);
  tweenMoney(cartTotalValue, cartSubtotal());
  reviewPayBtn.disabled = n === 0;
  const headerCartBadge = document.getElementById("headerCartBadge");
  headerCartBadge.textContent = String(n);
  headerCartBadge.classList.toggle("hidden", n === 0);
}

// ============================================================
// Filter bar + catalog grid
// ============================================================

const filterBarEl = document.getElementById("filterBar");
const productGridEl = document.getElementById("productGrid");
const noResultsEl = document.getElementById("noResults");
const searchBannerEl = document.getElementById("searchBanner");
const bannerTextEl = document.getElementById("bannerText");
const bannerIconEl = document.getElementById("bannerIcon");
const searchInput = document.getElementById("searchInput");

let currentCategory = "all";
let lastMode = { type: "category", value: "all" }; // remembers what to re-render on language change

function renderFilterBar() {
  filterBarEl.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.className = "filter-pill" + (currentCategory === "all" ? " active" : "");
  allBtn.textContent = CATEGORY_LABELS[currentLang].all;
  allBtn.addEventListener("click", () => selectCategory("all"));
  filterBarEl.appendChild(allBtn);

  CATEGORIES.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "filter-pill" + (cat.id === "emergency" ? " emergency-pill" : "") + (currentCategory === cat.id ? " active" : "");
    btn.innerHTML = iconSvg(cat.icon) + `<span></span>`;
    btn.querySelector("span").textContent = CATEGORY_LABELS[currentLang][cat.id];
    btn.addEventListener("click", () => selectCategory(cat.id));
    filterBarEl.appendChild(btn);
  });
}

function selectCategory(catId) {
  currentCategory = catId;
  searchInput.value = "";
  hideBanner();
  lastMode = { type: "category", value: catId };
  renderFilterBar();
  const list = catId === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === catId);
  renderGrid(list);
  document.getElementById("catalogScroll").scrollTop = 0;
}

function hideBanner() { searchBannerEl.classList.remove("show"); }
function showBanner(text, variant) {
  variant = variant || "warn";
  bannerTextEl.textContent = text;
  bannerIconEl.innerHTML = iconSvg(variant === "info" ? "chevronRight" : "alert");
  searchBannerEl.classList.remove("warn", "info");
  searchBannerEl.classList.add(variant, "show");
}

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.dataset.cat = product.category;
  card.dataset.id = product.id;
  const reason = unavailableReason(product);

  const badges = [];
  if (reason === "temp") {
    badges.push(`<div class="card-badge templocked">${iconSvg("thermometer")}<span>${t("tempLocked")}</span></div>`);
  } else if (product.ageRestricted) {
    badges.push(`<div class="card-badge age">${iconSvg("alert")}<span>${t("idRequired")}</span></div>`);
  }
  if (reason === "stock") {
    badges.push(`<div class="card-badge oos"><span>${t("outOfStock")}</span></div>`);
  }

  card.innerHTML = `
    <div class="card-art"><div class="card-badges">${badges.join("")}</div>${productArtSvg(product)}</div>
    <div class="card-title"></div>
    <div class="card-dosage"></div>
    <div class="card-bottom-row">
      <div class="card-price"></div>
      <div class="stock-text"></div>
    </div>
  `;
  card.querySelector(".card-title").textContent = product.name;
  card.querySelector(".card-dosage").textContent = product.dosage;
  card.querySelector(".card-price").textContent = money(product.price);

  const stockEl = card.querySelector(".stock-text");
  if (reason === "temp") { stockEl.textContent = t("tempLocked"); stockEl.classList.add("out"); }
  else if (reason === "stock") { stockEl.textContent = t("outOfStock"); stockEl.classList.add("out"); }
  else { stockEl.textContent = t("inStock"); stockEl.classList.add("in"); }

  const addBtn = document.createElement("button");
  addBtn.className = "add-btn";
  addBtn.innerHTML = iconSvg("plus") + `<span>${addLabelFor(product)}</span>`;
  if (reason) { addBtn.disabled = true; addBtn.querySelector("span").textContent = reason === "temp" ? t("tempLocked") : t("outOfStock"); }
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    quickAdd(product, addBtn);
  });
  card.appendChild(addBtn);

  card.addEventListener("click", () => openProductModal(product));
  return card;
}

function renderGrid(products) {
  productGridEl.innerHTML = "";
  if (products.length === 0) {
    noResultsEl.classList.add("show");
    return;
  }
  noResultsEl.classList.remove("show");
  products.forEach((p, i) => {
    const card = createProductCard(p);
    card.style.setProperty("--i", Math.min(i, 14)); // staggered entrance
    productGridEl.appendChild(card);
  });
}

function quickAdd(product, btnEl) {
  guardedAdd(product, 1, (ok) => {
    if (!ok) return;
    showToast(`${product.name} ${L("added to your order", "agregado a su pedido")}`);
    flyToCart(btnEl, product);
    btnEl.classList.add("added");
    btnEl.innerHTML = iconSvg("check") + `<span>${t("added")}</span>`;
    clearTimeout(btnEl._restoreTimer);
    btnEl._restoreTimer = setTimeout(() => {
      btnEl.classList.remove("added");
      btnEl.innerHTML = iconSvg("plus") + `<span>${addLabelFor(product)}</span>`;
    }, 900);
  });
}

// ============================================================
// Search (hooks into ai.js triage: emergency / prescription-only / match)
// ============================================================

let searchDebounce = null;
function onSearchInput() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => runSearch(searchInput.value), 350);
}
searchInput.addEventListener("input", onSearchInput);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { clearTimeout(searchDebounce); runSearch(searchInput.value); }
});

function runSearch(query) {
  const q = query.trim();
  hideBanner();

  if (q === "") {
    lastMode = { type: "category", value: currentCategory };
    const list = currentCategory === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === currentCategory);
    renderGrid(list);
    return;
  }

  lastMode = { type: "search", value: q };
  document.querySelectorAll(".filter-pill.active").forEach((el) => el.classList.remove("active"));
  // Same engine as the AI chat, so Spanish, red flags, and "for my 4 year old" /
  // "I'm on blood thinners" filtering behave identically in search.
  const resp = Assistant.respond(q, assistantCtx());
  if (resp.emergency) { triggerEmergency(resp.emergencyKind); return; }
  const warnReply = resp.replies.find((r) => r.kind === "warn");
  if (hasConditions(resp.cond || {}) || resp.lang === "es" || (warnReply && resp.care)) {
    if (warnReply) showBanner(warnReply.text);
    if (resp.products.length) { renderGrid(resp.products); return; }
    if (warnReply) { renderGrid([]); noResultsEl.classList.remove("show"); return; }
  }

  const result = classify(q);
  if (result.type === "emergency") {
    triggerEmergency(result.kind);
    return;
  }
  if (result.type === "not_equipped") {
    renderGrid([]);
    noResultsEl.classList.remove("show");
    showBanner(t("notEquippedText"));
    return;
  }
  if (result.type === "unclear") {
    renderGrid([]);
    return;
  }

  // Top match unavailable (out of stock or temp-locked)? Lead with a safe,
  // available alternative instead of just showing a dead end.
  const alt = findInStockAlternative(result.products);
  if (alt) {
    const primary = result.products[0];
    const reasonText = unavailableReason(primary) === "temp"
      ? L("is temporarily temperature-locked", "está bloqueado temporalmente por temperatura")
      : L("is out of stock", "está agotado");
    showBanner(
      currentLang === "es"
        ? `${primary.name} ${reasonText} ahora mismo — mostrando ${alt.name} como alternativa segura.`
        : `${primary.name} ${reasonText} right now — showing ${alt.name} as a safe alternative.`,
      "info"
    );
    renderGrid([alt, ...result.products.filter((p) => p !== alt)]);
    return;
  }
  renderGrid(result.products);
}


// Voice input — shared between the catalog search mic and the AI chat mic.
const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let listening = false;
let voiceTarget = "search"; // "search" | "chat"
let activeMicBtn = null;
const micBtn = document.getElementById("micBtn");
const chatMicBtn = document.getElementById("chatMicBtn");

function stopListeningUI() {
  listening = false;
  if (activeMicBtn) activeMicBtn.classList.remove("listening");
  activeMicBtn = null;
}

if (SpeechRecognitionImpl) {
  recognizer = new SpeechRecognitionImpl();
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;
  recognizer.addEventListener("result", (e) => {
    if (e.timeStamp && listenEpoch !== chatEpoch) return; // customer changed mid-utterance
    const transcript = e.results[0][0].transcript;
    if (voiceTarget === "chat") {
      chatInput.value = transcript;
      handleChatSend(transcript);
    } else {
      searchInput.value = transcript;
      runSearch(transcript);
    }
  });
  recognizer.addEventListener("end", stopListeningUI);
  recognizer.addEventListener("error", stopListeningUI);
} else {
  micBtn.title = "Voice input not supported in this browser";
  chatMicBtn.title = "Voice input not supported in this browser";
}

let listenEpoch = 0;
let voiceConsented = false; // per customer; reset in resetKiosk
function startListening(target, btnEl) {
  if (!recognizer) return;
  if (listening) { recognizer.stop(); return; }
  if (!voiceConsented) {
    // Health symptoms are about to leave the device: say so before the first use.
    voiceConsented = true;
    showToast(currentLang === "es"
      ? "La voz usa el servicio de Google y necesita internet. Toque el micrófono otra vez para hablar."
      : "Voice uses Google's speech service and needs internet. Tap the mic again to speak.");
    return;
  }
  listenEpoch = chatEpoch;
  voiceTarget = target;
  activeMicBtn = btnEl;
  recognizer.lang = L("en-US", "es-ES");
  listening = true;
  btnEl.classList.add("listening");
  try {
    recognizer.start();
  } catch (err) {
    // start() throws if a previous session hasn't fully ended; don't leave
    // the mic button stuck in its "listening" state.
    stopListeningUI();
  }
}
micBtn.addEventListener("click", () => startListening("search", micBtn));
chatMicBtn.addEventListener("click", () => startListening("chat", chatMicBtn));

// ============================================================
// AI Assistant chat modal
// ============================================================

const aiChatOverlay = document.getElementById("aiChatOverlay");
const chatLog = document.getElementById("chatLog");
const chatInput = document.getElementById("chatInput");
let chatStarted = false;
// The most recent product this conversation was about, so a bare
// follow-up like "how do I use it?" still resolves to the right item.

function addChatMessage(text, cls) {
  const div = document.createElement("div");
  div.className = "chat-msg " + cls;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

function addChatProductCards(products) {
  const wrap = document.createElement("div");
  wrap.className = "chat-products";
  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "chat-product-card";
    card.innerHTML = `
      <div class="cp-icon">${iconSvg(p.icon)}</div>
      <div class="cp-info">
        <div class="cp-name"></div>
        <div class="cp-meta"></div>
      </div>
    `;
    card.querySelector(".cp-name").textContent = p.name;
    const chatReason = unavailableReason(p);
    card.querySelector(".cp-meta").textContent = `${money(p.price)} · ${chatReason === "temp" ? t("tempLocked") : chatReason === "stock" ? t("outOfStock") : t("inStock")}`;

    const btn = document.createElement("button");
    btn.className = "cp-add";
    const addLabel = L("Add", "Agregar");
    btn.textContent = addLabel;
    if (!isAvailable(p)) btn.disabled = true;
    btn.addEventListener("click", () => {
      guardedAdd(p, 1, (ok) => {
        if (!ok) return;
        showToast(`${p.name} ${L("added to your order", "agregado a su pedido")}`);
        flyToCart(btn, p);
        btn.classList.add("added");
        btn.textContent = t("chatAdded");
        clearTimeout(btn._restoreTimer);
        btn._restoreTimer = setTimeout(() => { btn.classList.remove("added"); btn.textContent = addLabel; }, 900);
      });
    });
    card.appendChild(btn);
    wrap.appendChild(card);
  });
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ---- Assistant plumbing (the brain lives in assistant.js; this performs it) ----

let assistantMemory = { lastProduct: null, lastList: [], pending: null };
let chatEpoch = 0; // bumped on reset so in-flight replies don't leak into the next customer's chat

function assistantCtx() {
  return {
    lang: currentLang,
    cart: cartItems(),
    taxRate: TAX_RATE,
    now: new Date(),
    isAvailable,
    unavailableReason,
    lastProduct: assistantMemory.lastProduct,
    lastList: assistantMemory.lastList,
    prevProduct: assistantMemory.prevProduct,
    profile: assistantMemory.profile,
    pending: assistantMemory.pending,
    ackedIds: [...ackedProductIds],
  };
}

function clearChatChips() {
  chatLog.querySelectorAll(".chat-chips").forEach((el) => el.remove());
}

function addChatChips(labels) {
  clearChatChips();
  const wrap = document.createElement("div");
  wrap.className = "chat-chips";
  labels.slice(0, 6).forEach((label, i) => {
    const b = document.createElement("button");
    b.className = "chat-chip";
    b.textContent = label;
    b.style.setProperty("--i", i);
    b.addEventListener("click", () => handleChatSend(label));
    wrap.appendChild(b);
  });
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function showChatTyping() {
  const typing = document.createElement("div");
  typing.className = "chat-msg ai typing";
  typing.innerHTML = "<span></span><span></span><span></span>";
  chatLog.appendChild(typing);
  chatLog.scrollTop = chatLog.scrollHeight;
  return typing;
}

// Carry out what the assistant decided to DO (add/remove/checkout/...). Adds
// go through guardedAdd so the mandatory dangerous-medicine acknowledgment
// still applies to anything added by chat.
function runAssistantActions(actions, epoch) {
  const es = currentLang === "es";
  const step = (i) => {
    if (epoch !== chatEpoch || i >= actions.length) return;
    const a = actions[i];
    const next = () => step(i + 1);
    if (a.type === "add") {
      const product = findProduct(a.id);
      guardedAdd(product, a.qty || 1, (ok) => {
        if (epoch !== chatEpoch) return;
        if (ok) {
          showToast(`${product.name} ${es ? "agregado a su pedido" : "added to your order"}`);
          addChatMessage(es ? `✓ Agregado: ${product.name}${a.qty > 1 ? " × " + a.qty : ""}. Total actual: ${money(cartSubtotal() * (1 + TAX_RATE))} con impuesto.` : `✓ Added ${product.name}${a.qty > 1 ? " × " + a.qty : ""}. Cart total so far: ${money(cartSubtotal() * (1 + TAX_RATE))} with tax.`, "system");
        } else {
          addChatMessage(es ? `De acuerdo — no agregué ${product.name}.` : `Okay — I didn't add ${product.name}.`, "system");
        }
        next();
      });
      return;
    }
    if (a.type === "remove") {
      setCartQty(a.id, 0);
      if (checkoutScreen.classList.contains("show")) { if (cartCount() === 0) closeCheckout(); else { renderReviewList(); refreshCheckoutSteps(); } }
    } else if (a.type === "setQty") {
      setCartQty(a.id, a.qty);
      if (checkoutScreen.classList.contains("show")) renderReviewList();
    } else if (a.type === "clearCart") {
      cart = [];
      updateCartFooter();
      if (checkoutScreen.classList.contains("show")) closeCheckout();
    } else if (a.type === "openCheckout") {
      closeAiChat();
      openCheckout();
    } else if (a.type === "setLang") {
      setLanguage(a.lang);
    } else if (a.type === "browse") {
      selectCategory(a.category);
      showToast(L("Showing them on the main screen", "Mostrando en la pantalla principal"));
    }
    next();
  };
  step(0);
}

// Plays a response one bubble at a time with a typing indicator between.
function playAssistantResponse(resp) {
  const epoch = chatEpoch;
  const steps = [];
  resp.replies.forEach((r) => steps.push({ delay: Math.min(1000, 320 + r.text.length * 3), run: () => addChatMessage(r.text, r.kind) }));
  if (resp.products.length) steps.push({ delay: 300, run: () => addChatProductCards(resp.products) });
  if (resp.chips.length) steps.push({ delay: 200, run: () => addChatChips(resp.chips) });

  const go = (i) => {
    if (epoch !== chatEpoch) return;
    if (i >= steps.length) {
      if (resp.emergency) { closeAiChat(); setTimeout(() => triggerEmergency(resp.emergencyKind), 400); return; }
      runAssistantActions(resp.actions, epoch);
      return;
    }
    const typing = showChatTyping();
    setTimeout(() => {
      typing.remove();
      if (epoch !== chatEpoch) return; // kiosk was reset while "typing"
      steps[i].run();
      go(i + 1);
    }, i === 0 ? Math.min(steps[0].delay, 600) : steps[i].delay);
  };
  go(0);
}

function handleChatSend(raw) {
  const text = raw.trim();
  if (!text) return;
  addChatMessage(text, "user");
  chatInput.value = "";
  clearChatChips();
  const resp = Assistant.respond(text, assistantCtx());
  if (resp.last !== undefined) assistantMemory.lastProduct = resp.last;
  if (resp.lastList !== undefined) assistantMemory.lastList = resp.lastList;
  assistantMemory.prevProduct = resp.prev;
  if (resp.profile !== undefined) assistantMemory.profile = resp.profile;
  assistantMemory.pending = resp.pending;
  playAssistantResponse(resp);
}

function openAiChat() {
  if (!chatStarted) {
    chatStarted = true;
    addChatMessage(t("chatGreeting"), "ai");
    addChatMessage(t("chatGreetingSub"), "system");
    addChatChips(Assistant.suggestedPrompts(currentLang).slice(0, 5));
  }
  aiChatOverlay.classList.add("show");
}
function closeAiChat() { aiChatOverlay.classList.remove("show"); }

document.getElementById("aiAssistantBtn").addEventListener("click", openAiChat);
document.getElementById("aiChatClose").addEventListener("click", closeAiChat);
aiChatOverlay.addEventListener("click", (e) => { if (e.target === aiChatOverlay) closeAiChat(); });
document.getElementById("chatSendBtn").addEventListener("click", () => handleChatSend(chatInput.value));
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleChatSend(chatInput.value); });


// ============================================================
// Symptom selector modal
// ============================================================

const symptomModalOverlay = document.getElementById("symptomModalOverlay");
const symptomGridEl = document.getElementById("symptomGrid");

function renderSymptomGrid() {
  symptomGridEl.innerHTML = "";
  SYMPTOMS.forEach((s) => {
    const chip = document.createElement("button");
    chip.className = "symptom-chip";
    chip.textContent = s[currentLang] || s.en;
    chip.addEventListener("click", () => {
      closeSymptomModal();
      searchInput.value = s[currentLang] || s.en;
      runSearch(s.query);
      document.getElementById("catalogScroll").scrollTop = 0;
    });
    symptomGridEl.appendChild(chip);
  });
}

function openSymptomModal() { renderSymptomGrid(); symptomModalOverlay.classList.add("show"); }
function closeSymptomModal() { symptomModalOverlay.classList.remove("show"); }
document.getElementById("helperBtn").addEventListener("click", openSymptomModal);
document.getElementById("symptomModalClose").addEventListener("click", closeSymptomModal);
symptomModalOverlay.addEventListener("click", (e) => { if (e.target === symptomModalOverlay) closeSymptomModal(); });

// ============================================================
// Product detail modal
// ============================================================

const productModalOverlay = document.getElementById("productModalOverlay");
const productModalBody = document.getElementById("productModalBody");
const pdQtyValue = document.getElementById("pdQtyValue");
let modalProduct = null;
let modalQty = 1;

function openProductModal(product) {
  modalProduct = product;
  modalQty = 1;
  pdQtyValue.textContent = "1";

  const ageBanner = product.ageRestricted
    ? `<div class="age-banner">${iconSvg("alert")}<span>${t("ageBanner")}</span></div>`
    : "";
  const riskBanner = product.highRisk
    ? `<div class="risk-banner">${iconSvg("alert")}<span>${t("riskBanner")}</span></div>`
    : "";
  // Cards only carry "ID Required"; everything else about the item lives here.
  const bpBanner = /high blood pressure/.test((product._en || product).warnings)
    ? `<div class="risk-banner">${iconSvg("alert")}<span>${t("bpBanner")}</span></div>`
    : "";
  const ingredientBlock = product.activeIngredient
    ? `<div class="fact-block"><div class="fact-label">${t("factIngredient")}</div><div class="fact-value"></div></div>`
    : "";
  const langNote = "";

  productModalBody.innerHTML = `
    <div class="pd-art">${productArtSvg(product)}</div>
    ${riskBanner}
    ${bpBanner}
    ${ageBanner}
    <div class="card-title" style="font-size:1.4rem;margin-bottom:4px;"></div>
    <div class="card-dosage" style="margin-bottom:10px;"></div>
    ${ingredientBlock}
    <div class="fact-block"><div class="fact-label">${t("factUses")}</div><div class="fact-value" id="pdUses"></div></div>
    <div class="fact-block"><div class="fact-label">${t("factDosage")}</div><div class="fact-value" id="pdInstructions"></div></div>
    <div class="fact-block"><div class="fact-label">${t("factWarnings")}</div><div class="fact-value" id="pdWarnings"></div></div>
    <div class="fact-block"><div class="fact-label">${t("factAllergy")}</div><div class="fact-value" id="pdAllergy"></div></div>
    ${langNote}
  `;
  productModalBody.querySelector(".card-title").textContent = product.name;
  productModalBody.querySelector(".card-dosage").textContent = `${product.dosage} · ${money(product.price)}`;
  if (product.activeIngredient) productModalBody.querySelector(".fact-block .fact-value").textContent = product.activeIngredient;
  document.getElementById("pdUses").textContent = product.uses;
  document.getElementById("pdInstructions").textContent = product.instructions;
  document.getElementById("pdWarnings").innerHTML = warningListHtml(product.warnings);
  document.getElementById("pdAllergy").textContent = product.allergyAlert;

  const addBtn = document.getElementById("pdAddBtn");
  const modalReason = unavailableReason(product);
  addBtn.disabled = modalReason !== null;
  addBtn.querySelector("span").textContent =
    modalReason === "temp" ? t("tempLocked") : modalReason === "stock" ? t("outOfStock") : t("addToOrder");

  productModalOverlay.classList.add("show");
}

function closeProductModal() { productModalOverlay.classList.remove("show"); }
document.getElementById("productModalClose").addEventListener("click", closeProductModal);
productModalOverlay.addEventListener("click", (e) => { if (e.target === productModalOverlay) closeProductModal(); });

document.getElementById("pdQtyMinus").addEventListener("click", () => {
  modalQty = Math.max(1, modalQty - 1);
  pdQtyValue.textContent = String(modalQty);
});
document.getElementById("pdQtyPlus").addEventListener("click", () => {
  modalQty = Math.min(10, modalQty + 1);
  pdQtyValue.textContent = String(modalQty);
});
document.getElementById("pdAddBtn").addEventListener("click", () => {
  if (!modalProduct) return;
  const product = modalProduct, qty = modalQty;
  guardedAdd(product, qty, (ok) => {
    if (!ok) return;
    showToast(`${product.name} ${L("added to your order", "agregado a su pedido")}`);
    flyToCart(document.getElementById("pdAddBtn"), product);
    closeProductModal();
  });
});

// ============================================================
// Checkout flow
// ============================================================

const checkoutScreen = document.getElementById("checkoutScreen");
const checkoutTitle = document.getElementById("checkoutTitle");
const stepDotsEl = document.getElementById("stepDots");
const reviewListEl = document.getElementById("reviewList");

let activeSteps = ["review", "terms", "pay"];
let stepIndex = 0;
let idVerified = false;
let termsAgreed = false;

function needsAgeVerification() {
  return cartItems().some((c) => c.product.ageRestricted);
}

// Rules live in rules.js (shared with the phone-side facts page).
function checkCartInteractions() {
  return findInteractions(cartItems().map((c) => c.product), currentLang);
}

function computeActiveSteps() {
  // The interaction sign-off is the last gate before payment.
  const steps = ["review", "terms"];
  if (needsAgeVerification()) steps.push("verify");
  if (checkCartInteractions().length) steps.push("interaction");
  steps.push("pay");
  return steps;
}

function openCheckout() {
  lastRemoved = null;
  pruneUnavailableCart();
  if (cartCount() === 0) return;
  cancelCheckoutTimers();
  activeSteps = computeActiveSteps();
  stepIndex = 0;
  idVerified = false;
  termsAgreed = false;
  interactionAcked = false;
  renderReviewList();
  checkoutScreen.classList.add("show");
  renderCheckoutStep();
}

// Verification / payment simulations run on timers. If the checkout is
// closed or reset mid-timer they must not fire later and push the flow to a
// step that no longer exists (that used to throw) or dispense an empty cart.
let checkoutTimers = [];
let checkoutBusy = false; // an ID scan / payment is in flight — back is locked
function checkoutLater(fn, ms) {
  const id = setTimeout(() => {
    checkoutTimers = checkoutTimers.filter((x) => x !== id);
    fn();
  }, ms);
  checkoutTimers.push(id);
}
function cancelCheckoutTimers() {
  checkoutTimers.forEach(clearTimeout);
  checkoutTimers = [];
  checkoutBusy = false;
}

function closeCheckout() {
  cancelCheckoutTimers();
  checkoutScreen.classList.remove("show");
}

// Steps depend on the cart (interaction warning, age check). After the cart
// changes mid-checkout, recompute them but keep the customer on the review
// step — a stale index used to make them skip the Terms step entirely.
function refreshCheckoutSteps() {
  activeSteps = computeActiveSteps();
  stepIndex = Math.max(0, activeSteps.indexOf("review"));
  renderCheckoutStep();
}

const stepTitleKey = { interaction: "interactionStepTitle", review: "orderReview", terms: "termsTitle", verify: "ageVerification", pay: "payment" };

function renderCheckoutStep() {
  document.querySelectorAll(".checkout-step").forEach((el) => el.classList.remove("active"));
  if (stepIndex >= activeSteps.length) stepIndex = activeSteps.length - 1;
  if (stepIndex < 0) stepIndex = 0;
  const stepName = activeSteps[stepIndex];
  document.getElementById("step" + stepName[0].toUpperCase() + stepName.slice(1)).classList.add("active");
  checkoutTitle.textContent = t(stepTitleKey[stepName]);

  stepDotsEl.innerHTML = "";
  activeSteps.forEach((_, i) => {
    const dot = document.createElement("div");
    dot.className = "step-dot" + (i === stepIndex ? " active" : i < stepIndex ? " done" : "");
    stepDotsEl.appendChild(dot);
  });

  if (stepName === "interaction") renderInteractionStep();
  if (stepName === "terms") resetTermsStep();
  if (stepName === "verify") resetVerifyStep();
  if (stepName === "pay") resetPayStep();
}

let interactionAcked = false;
const interactionAckRow = document.getElementById("interactionAckRow");
const interactionContinueBtn = document.getElementById("interactionContinueBtn");

function setInteractionAck(on) {
  interactionAcked = on;
  interactionAckRow.classList.toggle("checked", on);
  interactionAckRow.classList.remove("shake", "missing");
  interactionAckRow.setAttribute("aria-checked", String(on));
  document.getElementById("interactionAckBox").innerHTML = on ? iconSvg("check") : "";
  interactionContinueBtn.classList.toggle("locked", !on);
  interactionContinueBtn.setAttribute("aria-disabled", String(!on));
  document.getElementById("interactionAckHint").classList.remove("show");
}

function renderInteractionStep() {
  const list = document.getElementById("interactionList");
  list.innerHTML = checkCartInteractions().map((w) => `
    <div class="interaction-card">
      <div class="ic-title">${esc(w.title)}</div>
      <div class="ic-items">${esc(w.names.join(" + "))}</div>
      <div class="ic-detail">${esc(w.detail)}</div>
    </div>
  `).join("");
  setInteractionAck(false); // must be re-confirmed every time this step is shown
}
interactionAckRow.addEventListener("click", () => setInteractionAck(!interactionAcked));
interactionAckRow.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); setInteractionAck(!interactionAcked); }
});
document.getElementById("interactionBackBtn").addEventListener("click", closeCheckout);
interactionContinueBtn.addEventListener("click", () => {
  if (!interactionAcked) {
    interactionAckRow.classList.remove("shake");
    void interactionAckRow.offsetWidth;
    interactionAckRow.classList.add("shake", "missing");
    document.getElementById("interactionAckHint").classList.add("show");
    return;
  }
  stepIndex++;
  renderCheckoutStep();
});

document.getElementById("checkoutBackBtn").addEventListener("click", () => {
  if (checkoutBusy) return; // don't allow leaving mid-scan / mid-payment
  if (stepIndex === 0) { closeCheckout(); return; }
  stepIndex--;
  renderCheckoutStep();
});

// ---- Step 1: order review ----

let lastRemoved = null; // { id, qty } for the review screen's Undo

function renderReviewList() {
  reviewListEl.innerHTML = "";
  const es = currentLang === "es";
  const combos = checkCartInteractions();
  const banner = document.getElementById("reviewInteractionBanner");
  banner.style.display = combos.length ? "flex" : "none";
  banner.querySelector("span").textContent = combos.length
    ? `${combos.map((w) => w.names.join(" + ")).join("; ")}: ${t("reviewInteractionBanner")}`
    : "";
  if (lastRemoved) {
    const p = findProduct(lastRemoved.id);
    const undo = document.createElement("div");
    undo.className = "review-undo";
    undo.innerHTML = `<span></span><button class="review-undo-btn"></button>`;
    undo.querySelector("span").textContent = es ? `Quitó ${p.name}.` : `Removed ${p.name}.`;
    undo.querySelector("button").textContent = es ? "Deshacer" : "Undo";
    undo.querySelector("button").addEventListener("click", () => {
      // Re-adding skips the safety prompt only because this customer already confirmed it.
      cart.push({ id: lastRemoved.id, qty: lastRemoved.qty });
      lastRemoved = null;
      updateCartFooter();
      renderReviewList();
      refreshCheckoutSteps();
    });
    reviewListEl.appendChild(undo);
  }
  cartItems().forEach(({ product, qty }) => {
    const max = product.highRisk ? 2 : 10;
    const row = document.createElement("div");
    row.className = "review-item";
    row.innerHTML = `
      <div class="ri-icon">${iconSvg(product.icon)}</div>
      <div class="ri-info">
        <div class="ri-name"></div>
        <div class="ri-dosage"></div>
      </div>
      <div class="ri-stepper">
        <button class="ri-step" data-d="-1">${iconSvg("minus")}</button>
        <span class="ri-qty">${qty}</span>
        <button class="ri-step" data-d="1" ${qty >= max ? "disabled" : ""}>${iconSvg("plus")}</button>
      </div>
      <div class="ri-price"></div>
      <button class="ri-remove">${iconSvg("close")}</button>
    `;
    row.querySelector(".ri-name").textContent = product.name;
    row.querySelector(".ri-dosage").textContent = product.dosage;
    row.querySelector(".ri-price").textContent = money(product.price * qty);
    row.querySelector('[data-d="-1"]').setAttribute("aria-label", t("ariaQtyMinus"));
    row.querySelector('[data-d="1"]').setAttribute("aria-label", t("ariaQtyPlus"));
    row.querySelector(".ri-remove").setAttribute("aria-label", (es ? "Quitar " : "Remove ") + product.name);
    const remove = () => {
      lastRemoved = { id: product.id, qty };
      setCartQty(product.id, 0);
      if (cartCount() === 0) { lastRemoved = null; closeCheckout(); return; }
      renderReviewList();
      refreshCheckoutSteps();
    };
    row.querySelectorAll(".ri-step").forEach((b) => b.addEventListener("click", () => {
      const next = qty + Number(b.dataset.d);
      if (next <= 0) { remove(); return; }
      setCartQty(product.id, Math.min(next, max));
      lastRemoved = null;
      renderReviewList();
      refreshCheckoutSteps();
    }));
    row.querySelector(".ri-remove").addEventListener("click", remove);
    reviewListEl.appendChild(row);
  });
  updateReviewSummary();
}

// The review screen's empty space explains what's left, in order (it is a real sequence).
function updateReviewSummary() {
  const subtotal = cartSubtotal();
  const tax = subtotal * TAX_RATE;
  document.getElementById("sumSubtotal").textContent = money(subtotal);
  document.getElementById("sumTax").textContent = money(tax);
  document.getElementById("sumTotal").textContent = money(subtotal + tax);
}

document.getElementById("reviewContinueBtn").addEventListener("click", () => {
  stepIndex++;
  renderCheckoutStep();
});

// ---- Step: terms & liability ----

const termsCheckbox = document.getElementById("termsCheckbox");
const termsAgreeBtn = document.getElementById("termsAgreeBtn");

function resetTermsStep() {
  termsAgreed = false;
  termsCheckbox.classList.remove("checked");
  termsCheckbox.innerHTML = "";
  termsAgreeBtn.disabled = true;
  document.getElementById("termsCheckRow").setAttribute("aria-checked", "false");
  document.getElementById("stepTerms").querySelector(".step-scroll").scrollTop = 0;
}

function toggleTermsCheckbox() {
  termsAgreed = !termsAgreed;
  termsCheckbox.classList.toggle("checked", termsAgreed);
  termsCheckbox.innerHTML = termsAgreed ? iconSvg("check") : "";
  termsAgreeBtn.disabled = !termsAgreed;
  document.getElementById("termsCheckRow").setAttribute("aria-checked", String(termsAgreed));
}
// One handler on the row only: the checkbox (and its check icon) live inside
// it, so a second handler on the checkbox toggled twice when the checkmark
// itself was tapped and made un-checking impossible.
document.getElementById("termsCheckRow").addEventListener("click", toggleTermsCheckbox);
document.getElementById("termsCheckRow").addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleTermsCheckbox(); } });

termsAgreeBtn.addEventListener("click", () => {
  if (!termsAgreed) return;
  stepIndex++;
  renderCheckoutStep();
});

// ---- Step 2: age verification ----

const verifyIconWrap = document.getElementById("verifyIconWrap");
const scanProgress = document.getElementById("scanProgress");
const scanProgressBar = document.getElementById("scanProgressBar");
const scanIdBtn = document.getElementById("scanIdBtn");

function resetVerifyStep() {
  idVerified = false;
  verifyIconWrap.classList.remove("verified");
  verifyIconWrap.innerHTML = iconSvg("idCard");
  document.getElementById("verifyTitle").textContent = t("verifyTitle");
  document.getElementById("verifySub").textContent = t("verifySub");
  scanProgress.classList.remove("show");
  scanProgressBar.style.width = "0%";
  scanIdBtn.disabled = false;
  scanIdBtn.innerHTML = iconSvg("idCard") + `<span id="scanIdLabel">${t("scanIdBtn")}</span>`;
}

scanIdBtn.addEventListener("click", () => {
  if (idVerified) { cancelCheckoutTimers(); stepIndex++; renderCheckoutStep(); return; }
  checkoutBusy = true;
  scanIdBtn.disabled = true;
  scanProgress.classList.add("show");
  document.getElementById("verifyTitle").textContent = t("scanning");
  requestAnimationFrame(() => { scanProgressBar.style.width = "100%"; });

  checkoutLater(() => {
    idVerified = true;
    verifyIconWrap.classList.add("verified");
    verifyIconWrap.innerHTML = iconSvg("check");
    document.getElementById("verifyTitle").textContent = t("verified");
    document.getElementById("verifySub").textContent = t("verifiedSub");
    scanIdBtn.disabled = false;
    scanIdBtn.innerHTML = iconSvg("chevronRight") + `<span>${t("continueToPayment")}</span>`;
    checkoutLater(() => { checkoutBusy = false; stepIndex++; renderCheckoutStep(); }, 900);
  }, 1700);
});

// ---- Step 3: payment ----

const payProcessing = document.getElementById("payProcessing");
const simulatePayBtn = document.getElementById("simulatePayBtn");

function resetPayStep() {
  const total = cartSubtotal() * (1 + TAX_RATE);
  document.getElementById("payAmountLine").textContent =
    L("Total due: ", "Total a pagar: ") + money(total);
  payProcessing.classList.remove("show");
  simulatePayBtn.disabled = false;
  simulatePayBtn.querySelector("span").textContent = t("simulatePay");
}

simulatePayBtn.addEventListener("click", () => {
  if (checkoutBusy) return;
  // Defense in depth: never take payment for a flagged combination that
  // hasn't been acknowledged, however this step was reached.
  if (checkCartInteractions().length && !interactionAcked) {
    const idx = activeSteps.indexOf("interaction");
    stepIndex = idx >= 0 ? idx : 0;
    renderCheckoutStep();
    return;
  }
  checkoutBusy = true;
  simulatePayBtn.disabled = true;
  payProcessing.classList.add("show");
  checkoutLater(() => {
    payProcessing.classList.remove("show");
    // Last-second guard: never dispense something that went out of stock
    // while the payment was "processing".
    const removed = pruneUnavailableCart();
    closeCheckout();
    if (removed.length) {
      // Nothing was charged; send them back to their (now different) cart.
      showToast(`${removed.join(", ")} ${L("is no longer available — you were not charged", "ya no está disponible — no se realizó ningún cargo")}`);
      return;
    }
    startDispense();
  }, 1500);
});

reviewPayBtn.addEventListener("click", openCheckout);
document.querySelector(".cart-count").addEventListener("click", () => document.getElementById("headerCartBtn").click());
document.getElementById("headerCartBtn").addEventListener("click", () => {
  if (cartCount() > 0) openCheckout();
  else showToast(L("Your cart is empty", "Su carrito está vacío"));
});

// ============================================================
// Dispense & safety screen
// ============================================================

const dispenseScreen = document.getElementById("dispenseScreen");
const dispenseAnim = document.getElementById("dispenseAnim");
const dispenseStatus = document.getElementById("dispenseStatus");
const dispenseSub = document.getElementById("dispenseSub");
const receiptCard = document.getElementById("receiptCard");
const safetyCard = document.getElementById("safetyCard");
const doneNowBtn = document.getElementById("doneNowBtn");
const autoResetNote = document.getElementById("autoResetNote");
const autoResetText = document.getElementById("autoResetText");

let resetCountdownInterval = null;

function startDispense() {
  const jam = simulateDispenserJam;
  simulateDispenserJam = false; // one-shot, consumed now regardless of outcome

  const items = cartItems();
  const orderSnapshot = items.map((i) => ({ id: i.product.id, name: i.product.name, qty: i.qty, price: i.product.price }));
  const orderTotal = cartSubtotal() * (1 + TAX_RATE);

  receiptCard.classList.remove("show");
  safetyCard.classList.remove("show");
  doneNowBtn.classList.remove("show");
  autoResetNote.classList.remove("show");
  dispenseAnim.classList.remove("failed");
  dispenseAnim.classList.add("working");
  dispenseAnim.innerHTML = iconSvg("pill");
  dispenseStatus.textContent = t("dispensing");
  dispenseSub.textContent = "";
  dispenseScreen.classList.add("show");

  if (jam) {
    // Hardware fails before anything physically drops — nothing dispensed,
    // charge reversed, cart preserved isn't needed since the transaction
    // itself is voided.
    setTimeout(() => failDispense(), 1400);
    return;
  }

  let idx = 0;
  function nextItem() {
    if (idx >= items.length) { finishDispense(orderSnapshot, orderTotal); return; }
    const { product, qty } = items[idx];
    dispenseSub.textContent = `${idx + 1} / ${items.length} — ${product.name}${qty > 1 ? " x" + qty : ""}`;
    const drop = document.createElement("span");
    drop.className = "drop-icon";
    drop.innerHTML = iconSvg(product.icon);
    dispenseAnim.appendChild(drop);
    setTimeout(() => drop.remove(), 1000);
    idx++;
    setTimeout(nextItem, 1100);
  }
  nextItem();
}

function failDispense() {
  dispenseAnim.classList.remove("working");
  dispenseAnim.classList.add("failed");
  dispenseAnim.innerHTML = iconSvg("alert");
  dispenseStatus.textContent = t("dispenseFailTitle");
  dispenseSub.textContent = t("dispenseFailSub");

  receiptCard.innerHTML = `<div class="receipt-row"><span>${t("receiptReversed")}</span><span>$0.00</span></div>`;
  receiptCard.classList.add("show");
  doneNowBtn.classList.add("show");

  cart = [];
  updateCartFooter();

  startResetCountdown(60);
}

function finishDispense(orderSnapshot, orderTotal) {
  dispenseAnim.classList.remove("working");
  dispenseAnim.innerHTML = iconSvg("check");
  dispenseStatus.textContent = t("orderComplete");
  dispenseSub.textContent = t("orderCompleteSub");

  receiptCard.innerHTML = orderSnapshot
    .map((i) => {
      // directions on screen too: not everyone has a phone to scan the QR
      const p = findProduct(i.id);
      const how = p && p.activeIngredient ? `<div class="receipt-how"><b>${t("factDosage")}:</b> ${esc(p.instructions)}</div>` : "";
      return `<div class="receipt-row"><span>${esc(i.name)}${i.qty > 1 ? " × " + i.qty : ""}</span><span>${money(i.price * i.qty)}</span></div>${how}`;
    })
    .join("") + `<div class="receipt-row"><span><strong>${t("total")}</strong></span><span><strong>${money(orderTotal)}</strong></span></div>`;
  receiptCard.classList.add("show");
  renderOrderQr(orderSnapshot);
  safetyCard.classList.add("show");
  doneNowBtn.classList.add("show");

  cart = [];
  updateCartFooter();

  startResetCountdown(60);
}


// Real QR code for the order: opens the phone-side facts page (facts.html)
// for exactly the items that were just dispensed.
function renderOrderQr(orderSnapshot) {
  const url = factsUrlFor(orderSnapshot.map((i) => i.id), currentLang);
  document.getElementById("orderQr").innerHTML = qrSvg(url, { ecc: "M" });
  const link = document.getElementById("orderQrUrl");
  link.textContent = url.replace(/^https?:\/\//, "").split(/[?#]/)[0];
  link.href = url;
}

function startResetCountdown(seconds) {
  let remaining = seconds;
  autoResetNote.classList.add("show");
  const render = () => {
    autoResetText.textContent = currentLang === "es"
      ? `Volviendo al inicio en ${remaining}s...`
      : `Returning to home screen in ${remaining}s...`;
  };
  render();
  clearInterval(resetCountdownInterval);
  resetCountdownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) { clearInterval(resetCountdownInterval); resetKiosk(); return; }
    render();
  }, 1000);
}

doneNowBtn.addEventListener("click", () => { clearInterval(resetCountdownInterval); resetKiosk(); });

// ============================================================
// Emergency overlay
// ============================================================

const emergencyOverlay = document.getElementById("emergencyOverlay");
function triggerEmergency(kind) {
  // a language switch re-runs lastMode; never let it re-fire this screen
  lastMode = { type: "category", value: currentCategory };
  // Crisis gets the 988 line, poisoning gets Poison Control; everything else the standard 911 text.
  emergencyOverlay.querySelector("p").textContent = t(kind === "crisis" ? "crisisText" : kind === "poison" ? "poisonText" : "emergencyText");
  const erListEl = document.getElementById("emergencyErList");
  erListEl.innerHTML = `
    <div class="emergency-er-card">
      <div class="er-name">${KIOSK_SITE.name}</div>
      <div class="er-detail">${KIOSK_SITE.address} · ${KIOSK_SITE.phone}</div>
    </div>
  `;
  emergencyOverlay.classList.add("show");
}
document.getElementById("emergencyReset").addEventListener("click", () => {
  emergencyOverlay.classList.remove("show");
  resetKiosk();
});


// ============================================================
// Idle / attract loop + inactivity auto-reset
// ============================================================

const idleOverlay = document.getElementById("idleOverlay");
const idleTipEl = document.getElementById("idleTip");
let idleTipInterval = null;
let idleTipIdx = 0;

function showIdle() {
  idleOverlay.classList.remove("hide");
  idleTipIdx = 0;
  const tips = STRINGS[currentLang].idleTips || STRINGS.en.idleTips;
  idleTipEl.textContent = tips[0];
  clearInterval(idleTipInterval);
  idleTipInterval = setInterval(() => {
    idleTipIdx = (idleTipIdx + 1) % tips.length;
    idleTipEl.textContent = tips[idleTipIdx];
  }, 5000);
  clearTimeout(inactivityTimer);
}

function hideIdle() {
  idleOverlay.classList.add("hide");
  clearInterval(idleTipInterval);
  bumpActivity();
}

document.getElementById("idleCta").addEventListener("click", hideIdle);
idleOverlay.addEventListener("click", (e) => { if (!e.target.closest(".idle-link")) hideIdle(); });

// ---- "How MediVend works": the exhibit explains itself without a presenter ----
// Figures are cited on the screen; keep them in sync with the sources listed there.

let inactivityTimer = null;
const INACTIVITY_MS = 120000;
function bumpActivity() {
  if (!idleOverlay.classList.contains("hide")) return; // idle already showing
  if (dispenseScreen.classList.contains("show")) return; // dispense has its own countdown
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(returnToIdleFromInactivity, INACTIVITY_MS);
}
function returnToIdleFromInactivity() {
  // Leave the emergency screen up longer, but never forever: the next customer
  // must not inherit the last person's chat and cart.
  if (emergencyOverlay.classList.contains("show") && !returnToIdleFromInactivity.extended) {
    returnToIdleFromInactivity.extended = true;
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(returnToIdleFromInactivity, INACTIVITY_MS * 2);
    return;
  }
  returnToIdleFromInactivity.extended = false;
  askStillThere();
}

// Warn before wiping someone's cart: 20 seconds and a big "I need more time" button.
const stillThere = document.getElementById("stillThere");
let stillThereInterval = null;
function askStillThere() {
  if (!idleOverlay.classList.contains("hide")) return;
  let left = 20;
  const update = () => {
    document.getElementById("stillThereCount").textContent = currentLang === "es"
      ? `La pantalla se reiniciará en ${left} s.` : `The screen will reset in ${left} s.`;
  };
  update();
  stillThere.classList.add("show");
  clearInterval(stillThereInterval);
  stillThereInterval = setInterval(() => {
    left--;
    if (left <= 0) { closeStillThere(); resetKiosk(); return; }
    update();
  }, 1000);
}
function closeStillThere() {
  clearInterval(stillThereInterval);
  stillThere.classList.remove("show");
}
document.getElementById("stillThereBtn").addEventListener("click", () => { closeStillThere(); bumpActivity(); });
// Tapping/clicking was the only thing that counted as "activity" before,
// so typing a chat message, reading the Terms box, or scrolling with a
// mouse wheel (none of which fire pointerdown) could silently run out the
// clock and bounce someone back to the idle screen mid-use. Listen for
// the full range of real interaction instead. `scroll` doesn't bubble, so
// it's caught in the capture phase to still hear it from any inner
// scrollable panel (chat log, terms box, checkout steps, etc.).
["pointerdown", "keydown", "input", "wheel", "touchmove"].forEach((evt) => {
  kiosk.addEventListener(evt, bumpActivity, { passive: true });
});
kiosk.addEventListener("scroll", bumpActivity, true);

function resetKiosk() {
  closeStillThere();
  if (recognizer && listening) { try { recognizer.abort(); } catch (e) {} }
  stopListeningUI();
  voiceConsented = false;
  cart = [];
  updateCartFooter();
  closeCheckout();
  dispenseScreen.classList.remove("show");
  clearInterval(resetCountdownInterval);
  closeProductModal();
  closeSymptomModal();
  closeAiChat();
  langDropdown.classList.remove("show");
  a11yDropdown.classList.remove("show");
  emergencyOverlay.classList.remove("show");
  cancelCheckoutTimers();
  ackPending = null;
  safetyAckOverlay.classList.remove("show");
  ackedProductIds = new Set(); // a new customer must acknowledge again
  searchInput.value = "";
  chatInput.value = "";
  // Fresh customer: demo scenarios, language and display settings back to defaults.
  resetAllScenarios(true);
  lastMode = { type: "category", value: "all" };
  if (currentLang !== "en") setLanguage("en");
  ["largeTextToggle", "highContrastToggle", "darkModeToggle"].forEach((id) => {
    const el = document.getElementById(id);
    if (el.classList.contains("on")) el.click();
  });
  hideBanner();
  selectCategory("all");
  // Fresh customer, fresh conversation.
  chatLog.innerHTML = "";
  chatStarted = false;
  chatEpoch++;
  assistantMemory = { lastProduct: null, lastList: [], pending: null };
  showIdle();
}

// ============================================================
// Header dropdowns: language + accessibility
// ============================================================

const langDropdown = document.getElementById("langDropdown");
const a11yDropdown = document.getElementById("a11yDropdown");

function toggleLangDropdown(e) {
  e.stopPropagation();
  a11yDropdown.classList.remove("show");
  langDropdown.classList.toggle("show");
}
function toggleA11yDropdown(e) {
  e.stopPropagation();
  langDropdown.classList.remove("show");
  a11yDropdown.classList.toggle("show");
}
document.getElementById("langBtn").addEventListener("click", toggleLangDropdown);
document.getElementById("a11yBtn").addEventListener("click", toggleA11yDropdown);
const DROPDOWN_OPEN_IDS = new Set(["langBtn", "a11yBtn"]);
kiosk.addEventListener("pointerdown", (e) => {
  if (!langDropdown.contains(e.target) && !DROPDOWN_OPEN_IDS.has(e.target.id)) langDropdown.classList.remove("show");
  if (!a11yDropdown.contains(e.target) && !DROPDOWN_OPEN_IDS.has(e.target.id)) a11yDropdown.classList.remove("show");
});

document.getElementById("langEnBtn").addEventListener("click", () => { setLanguage("en"); langDropdown.classList.remove("show"); });
document.getElementById("langEsBtn").addEventListener("click", () => { setLanguage("es"); langDropdown.classList.remove("show"); });

// Icon-only buttons get a spoken name in the current language.
const ARIA_LABELS = {
  headerCartBtn: "ariaCart", langBtn: "ariaLanguage", a11yBtn: "ariaAccessibility", micBtn: "ariaVoice", helperBtn: "ariaHelper",
  productModalClose: "ariaClose", pdQtyMinus: "ariaQtyMinus", pdQtyPlus: "ariaQtyPlus", symptomModalClose: "ariaClose", aiChatClose: "ariaClose",
  chatMicBtn: "ariaVoice", chatSendBtn: "ariaSend", checkoutBackBtn: "ariaBack", aboutBackBtn: "ariaBack", judgesClose: "ariaClose",
};
function applyAriaLabels() {
  Object.entries(ARIA_LABELS).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) { el.setAttribute("aria-label", t(key)); el.title = t(key); }
  });
}

function setLanguage(lang) {
  currentLang = lang;
  localizeProducts(lang);
  document.documentElement.lang = lang === "es" ? "es-US" : "en";
  applyAriaLabels();
  document.getElementById("langCode").textContent = lang.toUpperCase();
  document.getElementById("langEnBtn").classList.toggle("active", lang === "en");
  document.getElementById("langEsBtn").classList.toggle("active", lang === "es");

  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.getAttribute("data-i18n-placeholder")); });

  renderFilterBar();
  updateCartFooter();
  renderScenarioBanners();
  if (judgesOverlay.classList.contains("show")) { renderJudgesStockList(); updateJudgesToggleButtons(); }
  if (lastMode.type === "search") runSearch(lastMode.value);
  else selectCategory(lastMode.value);
}

// Accessibility toggles
function wireToggle(btnId, onChange) {
  const el = document.getElementById(btnId);
  const flip = () => {
    const on = !el.classList.contains("on");
    el.classList.toggle("on", on);
    el.setAttribute("aria-checked", String(on));
    onChange(on);
  };
  el.addEventListener("click", flip);
  el.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } });
}
wireToggle("largeTextToggle", (on) => {
  kiosk.classList.toggle("a11y-large", on);
  // `rem` is always relative to <html>, not to .kiosk, so the class has to
  // land on the real root too or every rem-sized font-size in the app
  // silently ignores this toggle.
  document.documentElement.classList.toggle("a11y-large", on);
});
wireToggle("highContrastToggle", (on) => kiosk.classList.toggle("high-contrast", on));
wireToggle("darkModeToggle", (on) => { kiosk.dataset.theme = on ? "dark" : "light"; });

// ============================================================
// Judges panel — quick demo controls for presenting the kiosk live
// (simulate real-world scenarios, flip any item's stock on the fly)
// rather than exposing raw source. Directly mutates PRODUCTS' inStock
// flags and re-renders whatever view is currently open.
// ============================================================

const judgesOverlay = document.getElementById("judgesOverlay");
const judgesStockListEl = document.getElementById("judgesStockList");

function refreshCurrentView() {
  if (lastMode.type === "search") runSearch(lastMode.value);
  else selectCategory(lastMode.value);
}

function setProductStock(id, inStock) {
  const p = findProduct(id);
  if (!p || p.inStock === inStock) return;
  p.inStock = inStock;
  renderJudgesStockList();
  refreshCurrentView();
  syncCartWithAvailability();
}

function renderJudgesStockList() {
  judgesStockListEl.innerHTML = "";
  PRODUCTS.forEach((p) => {
    const row = document.createElement("div");
    row.className = "judges-row";
    row.innerHTML = `
      <div class="jr-icon">${iconSvg(p.icon)}</div>
      <div class="jr-name"></div>
      <span class="jr-status"></span>
      <button class="jr-toggle"></button>
    `;
    row.querySelector(".jr-name").textContent = p.name;
    const statusEl = row.querySelector(".jr-status");
    const locked = isTempLocked(p);
    if (locked) { statusEl.textContent = t("tempLocked"); statusEl.classList.add("out"); }
    else { statusEl.textContent = p.inStock ? t("inStock") : t("outOfStock"); statusEl.classList.add(p.inStock ? "in" : "out"); }
    const btn = row.querySelector(".jr-toggle");
    if (locked) {
      btn.textContent = L("Locked", "Bloqueado");
      btn.disabled = true;
    } else {
      btn.textContent = p.inStock
        ? L("Mark Out", "Agotar")
        : L("Mark In", "Reponer");
      btn.addEventListener("click", () => setProductStock(p.id, !p.inStock));
    }
    judgesStockListEl.appendChild(row);
  });
}

// ---- Scenario 1: Thermal Stability Override ----

function renderScenarioBanners() {
  const el = document.getElementById("scenarioBanners");
  const banners = [];
  if (cabinetOverheated) {
    banners.push(`
      <div class="scenario-banner temp">
        ${iconSvg("thermometer")}
        <span class="sb-text">${t("thermalBannerText")}</span>
        <button id="resolveThermalBtn">${L("Resolve", "Resolver")}</button>
      </div>
    `);
  }
  el.innerHTML = banners.join("");
  const resolveThermal = document.getElementById("resolveThermalBtn");
  if (resolveThermal) resolveThermal.addEventListener("click", toggleThermalOverride);
}

function updateJudgesToggleButtons() {
  const thermalLabel = document.getElementById("thermalOverrideLabel");
  thermalLabel.textContent = cabinetOverheated
    ? L("Clear Thermal Lockout", "Borrar Bloqueo Térmico")
    : L("Trigger Thermal Stability Override", "Activar Bloqueo Térmico");
  document.getElementById("thermalOverrideBtn").classList.toggle("active-state", cabinetOverheated);


  const jamLabel = document.getElementById("dispenserJamLabel");
  jamLabel.textContent = simulateDispenserJam
    ? L("Jam Armed — Ready", "Atasco Armado — Listo")
    : L("Arm Dispenser Jam (Next Order)", "Armar Atasco del Dispensador (Próximo Pedido)");
  document.getElementById("dispenserJamBtn").classList.toggle("active-state", simulateDispenserJam);
}

function toggleThermalOverride() {
  cabinetOverheated = !cabinetOverheated;
  updateJudgesToggleButtons();
  renderScenarioBanners();
  refreshCurrentView();
  syncCartWithAvailability();
  if (cabinetOverheated) showToast(L("🌡️ Thermal stability override triggered", "🌡️ Anulación de estabilidad térmica activada"));
}

function armDispenserJam() {
  simulateDispenserJam = true;
  updateJudgesToggleButtons();
  showToast(L("🔧 Dispenser jam armed for the next order", "🔧 Atasco del dispensador armado para el próximo pedido"));
}

function triggerRedFlagDemo() {
  closeJudgesPanel();
  const query = "chest pain and left arm numbness";
  searchInput.value = query;
  runSearch(query);
}

function resetAllScenarios(silent) {
  PRODUCTS.forEach((p) => { p.inStock = true; });
  cabinetOverheated = false;
  simulateDispenserJam = false;
  renderJudgesStockList();
  updateJudgesToggleButtons();
  renderScenarioBanners();
  refreshCurrentView();
  syncCartWithAvailability();
  if (!silent) showToast(L("All demo scenarios reset", "Todos los escenarios de demostración restablecidos"));
}

function openJudgesPanel() {
  renderJudgesStockList();
  updateJudgesToggleButtons();
  judgesOverlay.classList.add("show");
}
function closeJudgesPanel() { judgesOverlay.classList.remove("show"); }
document.getElementById("judgesToggle").addEventListener("click", openJudgesPanel);
document.getElementById("judgesClose").addEventListener("click", closeJudgesPanel);
document.getElementById("thermalOverrideBtn").addEventListener("click", toggleThermalOverride);
document.getElementById("dispenserJamBtn").addEventListener("click", armDispenserJam);
document.getElementById("redFlagBtn").addEventListener("click", triggerRedFlagDemo);
document.getElementById("resetAllScenariosBtn").addEventListener("click", () => resetAllScenarios());

// ============================================================
// Init
// ============================================================

applyAriaLabels();
// Exhibit/demo builds show the Judges controls; a real unit launches with ?kiosk and hides them.
if (new URLSearchParams(location.search).has("kiosk")) {
  ["judgesToggle"].forEach((id) => document.getElementById(id).remove());
}
// Chrome's speech recognition runs on Google's servers, so the mic only appears when online.
function syncMicAvailability() { [micBtn, chatMicBtn].forEach((b) => { b.hidden = !navigator.onLine || !recognizer; }); }
window.addEventListener("online", syncMicAvailability);
window.addEventListener("offline", syncMicAvailability);
syncMicAvailability();
renderFilterBar();
selectCategory("all");
updateCartFooter();
showIdle();
