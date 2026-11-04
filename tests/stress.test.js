// Run: node tests/stress.test.js [-v] — every allergen × every product × hard question types.
// Doesn't stop at the first failure: prints a score per group, exits 1 if anything fails.
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = { console }; vm.createContext(ctx);
vm.runInContext("function money(n){return '$'+n.toFixed(2)}", ctx);
for (const f of ["products.js", "products-es.js", "safety.js", "ai.js", "med-qa.js", "i18n.js", "rules.js", "knowledge.js", "assistant.js"])
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
vm.runInContext("this.A = Assistant; this.P = PRODUCTS", ctx);
const P = ctx.P, byId = Object.fromEntries(P.map((p) => [p.id, p]));
const base = { lang: "en", cart: [], taxRate: 0.07, isAvailable: (p) => p.inStock !== false, unavailableReason: () => null };
const ask = (q, m) => ctx.A.respond(q, Object.assign({}, base, m));
const carry = (r, m) => ({ lastProduct: r.last, lastList: r.lastList, pending: r.pending, prevProduct: r.prev, profile: r.profile !== undefined ? r.profile : (m && m.profile), cart: (m && m.cart) || [] });
const text = (r) => r.replies.map((x) => x.text).join(" ");
const offered = (r) => r.products.map((p) => p.id).concat(r.actions.filter((a) => a.type === "add").map((a) => a.id));
const DEAD = /can really only speak|not sure what would help|didn't understand|no entend|not sure i understood|no estoy seguro|solo puedo hablar|don't have that exact detail/i;

const groups = {}; let fails = 0; const verbose = process.argv.includes("-v");
const check = (group, ok, q, why) => {
  const g = groups[group] = groups[group] || { pass: 0, fail: 0, samples: [] };
  if (ok) g.pass++; else { g.fail++; fails++; g.samples.push(`${q}  ->  ${why}`); }
};

// word → products it rules out (active ingredient, or a close relative of it)
const ALLERGY = {
  aspirin: ["aspirin", "ibuprofen"], ibuprofen: ["ibuprofen", "aspirin"], advil: ["ibuprofen", "aspirin"], motrin: ["ibuprofen", "aspirin"], nsaids: ["ibuprofen", "aspirin"], naproxen: ["ibuprofen", "aspirin"], aleve: ["ibuprofen", "aspirin"],
  acetaminophen: ["acetaminophen", "periodrelief", "coldflu"], tylenol: ["acetaminophen", "periodrelief", "coldflu"], paracetamol: ["acetaminophen", "periodrelief", "coldflu"],
  diphenhydramine: ["antihistamine", "motionsickness"], benadryl: ["antihistamine", "motionsickness"], dimenhydrinate: ["motionsickness", "antihistamine"], dramamine: ["motionsickness", "antihistamine"], antihistamines: ["antihistamine", "motionsickness", "periodrelief"],
  pyrilamine: ["periodrelief"], pamabrom: ["periodrelief"],
  dextromethorphan: ["coldflu"], robitussin: ["coldflu"], phenylephrine: ["coldflu"], oxymetazoline: ["decongestant"], afrin: ["decongestant"], decongestants: ["coldflu", "decongestant"],
  loperamide: ["antidiarrheal"], imodium: ["antidiarrheal"], "calcium carbonate": ["antacid"], tums: ["antacid"],
  menthol: ["patch", "coughdrops"], mint: ["patch", "coughdrops"], peppermint: ["patch", "coughdrops"],
  bacitracin: ["ointment"], neosporin: ["ointment"], avobenzone: ["sunscreen"], octisalate: ["sunscreen"], salicylates: ["aspirin", "sunscreen"],
  "ethyl alcohol": ["sanitizer"], ethanol: ["sanitizer"], adhesive: ["bandaid", "gauze", "patch", "heatpatch"],
  "cough drops": ["coughdrops"], sunscreen: ["sunscreen"], "hand sanitizer": ["sanitizer"], "antibiotic ointment": ["ointment"], antacids: ["antacid"],
};
// A symptom each product is normally recommended for, so a miss actually shows up.
const SYMPTOM = { aspirin: "a headache", ibuprofen: "a headache", acetaminophen: "a fever", periodrelief: "period cramps", coldflu: "a cold", antihistamine: "allergies", motionsickness: "motion sickness", decongestant: "a stuffy nose", antidiarrheal: "diarrhea", antacid: "heartburn", patch: "back pain", coughdrops: "a sore throat", ointment: "a cut", sunscreen: "a sunburn", sanitizer: "dirty hands", bandaid: "a cut", gauze: "a cut", heatpatch: "period cramps" };
const STATE = ["im allergic to W", "i have a W allergy", "W gives me hives", "i had a bad reaction to W", "soy alergico a W", "tengo alergia a W", "my son is allergic to W"];

for (const [w, banned] of Object.entries(ALLERGY)) {
  for (const id of banned) {
    const sym = SYMPTOM[id];
    for (const q of [`im allergic to ${w}, what do you have for ${sym}`, `${w} allergy and i have ${sym}`, `soy alergica a ${w} y tengo ${sym}`]) {
      const r = ask(q); check("allergy: same message", !offered(r).includes(id), q, `offered ${id}`);
    }
    const name = byId[id].name;
    const direct = `can i take ${name} if im allergic to ${w}`;
    const d = ask(direct);
    check("allergy: asks about that exact item", !offered(d).includes(id) && d.replies.some((x) => x.kind === "warn"), direct, offered(d).includes(id) ? "offered it" : "no warning");
    const add = `add ${name}, im allergic to ${w}`;
    check("allergy: tries to buy it", !ask(add).actions.some((a) => a.type === "add" && a.id === id), add, "added it");
    // remembered across the conversation
    const m1 = carry(ask(`im allergic to ${w}`));
    const r2 = ask(`i have ${sym}`, m1);
    check("allergy: remembered next message", !offered(r2).includes(id), `allergic to ${w} || i have ${sym}`, `offered ${id}`);
    const r3 = ask(`add ${name}`, m1);
    check("allergy: remembered at add", !r3.actions.some((a) => a.type === "add" && a.id === id), `allergic to ${w} || add ${name}`, "added it");
    // already in the cart when they mention it
    const r4 = ask(`im allergic to ${w}`, { cart: [{ product: byId[id], qty: 1 }] });
    check("allergy: already in cart", new RegExp(name.split(" ")[0], "i").test(text(r4)) && r4.replies.some((x) => x.kind === "warn"), `[cart ${id}] allergic to ${w}`, "no warning about the cart");
  }
  for (const t of STATE) {
    const q = t.replace("W", w), r = ask(q);
    check("allergy: statement is understood", !DEAD.test(text(r)) && r.replies.length > 0, q, text(r).slice(0, 70));
  }
}

// Things we have no ingredient data for must never be called safe.
for (const w of ["peanuts", "tree nuts", "gluten", "wheat", "lactose", "dairy", "soy", "eggs", "shellfish", "corn", "red dye", "food coloring", "sulfites", "fragrance", "parabens", "lanolin"]) {
  for (const q of [`im allergic to ${w}`, `i have a ${w} allergy, what can i take for a headache`, `does ibuprofen have ${w} in it`, `is acetaminophen safe with a ${w} allergy`]) {
    const t = text(ask(q));
    check("unknown ingredient: honest", /inactive|package|ingredientes inactivos/i.test(t) && !DEAD.test(t), q, t.slice(0, 70));
    check("unknown ingredient: never says safe", !/\b(is safe|it's safe|safe for you|free of|doesn't contain|does not contain)\b/i.test(t), q, t.slice(0, 70));
  }
}
for (const [w, re] of [["penicillin", /penicillin/i], ["sulfa", /sulfa/i], ["codeine", /codeine/i], ["latex", /latex/i], ["iodine", /iodine/i]]) {
  const t = text(ask(`im allergic to ${w}`));
  check("drug-type allergy: addressed", re.test(t) && !DEAD.test(t), `im allergic to ${w}`, t.slice(0, 70));
}
{ const t = text(ask("does the bandaid have latex")); check("drug-type allergy: addressed", /latex.free/i.test(t), "does the bandaid have latex", t.slice(0, 70)); }

// Must not over-trigger.
for (const [q, stillOk] of [["im not allergic to aspirin, i have a headache", "aspirin"], ["no allergies, i have a headache", "ibuprofen"], ["i have allergies", "antihistamine"], ["im allergic to menthol, i have a headache", "ibuprofen"], ["im allergic to aspirin but not tylenol, i have a fever", "acetaminophen"], ["im allergic to cats", "antihistamine"], ["i have a pollen allergy", "antihistamine"], ["im not pregnant, i have a headache", "ibuprofen"], ["im not on blood thinners, i have a headache", "ibuprofen"]])
  check("no false alarms", offered(ask(q)).includes(stillOk), q, `lost ${stillOk}: ${offered(ask(q))}`);
{ const m = carry(ask("im pregnant")); const m2 = carry(ask("actually im not pregnant", m), m); check("no false alarms", offered(ask("i have a headache", m2)).includes("ibuprofen"), "pregnant || not pregnant || headache", "still blocked"); }
{ const m = carry(ask("im allergic to aspirin")); const m2 = carry(ask("forget my allergies", m), m); check("no false alarms", offered(ask("i have a headache", m2)).includes("aspirin"), "forget my allergies", "still blocked"); }
for (const [q, want, not] of [["im allergic to aspirin and tylenol, i have a headache", null, ["aspirin", "ibuprofen", "acetaminophen"]], ["allergic to menthol and adhesive, back pain", null, ["patch"]], ["im allergic to tylenol, benadryl and imodium", null, []]])
  check("several allergies at once", !not.some((id) => offered(ask(q)).includes(id)), q, String(offered(ask(q))));
{ const m = carry(ask("im allergic to tylenol, benadryl and imodium")); check("several allergies at once", ["acetaminophen", "antihistamine", "antidiarrheal"].every((id) => !offered(ask(`add ${byId[id].name}`, m)).includes(id)), "three allergies remembered", "lost one"); }

// Allergic reactions happening now are emergencies.
for (const q of ["i took ibuprofen and my throat is closing", "my lips are swelling after taking aspirin", "i have hives and cant breathe", "my face is swollen after benadryl", "im having an allergic reaction and cant breathe", "anaphylaxis", "se me cierra la garganta", "tengo la cara hinchada y no puedo respirar", "my tongue is swelling"])
  check("reaction happening now", ask(q).emergency, q, "no emergency");
for (const q of ["i took tylenol and got a rash", "i got hives after ibuprofen"]) {
  const r = ask(q); check("reaction happening now", /stop|doctor|911/i.test(text(r)) && !r.products.some((p) => /tylenol|ibuprofen/i.test(q) && (p.id === "acetaminophen" || p.id === "ibuprofen")), q, text(r).slice(0, 70));
}

// Ingredient knowledge: yes/no must match the data, for every product and ingredient.
const HAS = { ointment: ["bacitracin"], ibuprofen: ["ibuprofen"], acetaminophen: ["acetaminophen"], aspirin: ["aspirin"], patch: ["menthol"], periodrelief: ["acetaminophen", "pamabrom", "pyrilamine"], antihistamine: ["diphenhydramine"], coughdrops: ["menthol"], coldflu: ["acetaminophen", "dextromethorphan", "phenylephrine"], decongestant: ["oxymetazoline"], antacid: ["calcium carbonate"], motionsickness: ["dimenhydrinate", "diphenhydramine"], antidiarrheal: ["loperamide"], sanitizer: ["ethyl alcohol"], sunscreen: ["avobenzone", "octisalate"] };
const ALL_ING = [...new Set(Object.values(HAS).flat())];
for (const [id, list] of Object.entries(HAS)) {
  const name = byId[id].name;
  for (const q of [`what's in ${name}`, `what are the ingredients in ${name}`, `active ingredient of ${name}`])
    { const t = text(ask(q)); check("ingredients: what's in it", list.every((i) => new RegExp(i, "i").test(t)), q, t.slice(0, 80)); }
  for (const ing of ALL_ING) {
    const q = `does ${name} contain ${ing}`, r = ask(q), t = text(r), yes = list.includes(ing);
    check("ingredients: does X contain Y", yes ? /^\s*yes/i.test(t) : /^\s*no\b/i.test(t), q, `expected ${yes ? "yes" : "no"}: ${t.slice(0, 70)}`);
  }
}
for (const ing of ALL_ING) {
  const holders = Object.keys(HAS).filter((id) => HAS[id].includes(ing));
  for (const q of [`which products contain ${ing}`, `what has ${ing} in it`]) {
    const r = ask(q), t = text(r);
    check("ingredients: which items have it", holders.every((id) => t.includes(byId[id].name)), q, `missing: ${holders.filter((id) => !t.includes(byId[id].name))}`);
  }
  const q = `what is ${ing}`, t = text(ask(q));
  check("ingredients: what is it", t.length > 30 && !DEAD.test(t) && new RegExp(ing, "i").test(t), q, t.slice(0, 70));
}
for (const [q, re] of [["is ibuprofen an nsaid", /^\s*yes/i], ["is acetaminophen an nsaid", /^\s*no/i], ["is tylenol an nsaid", /^\s*no/i], ["is aspirin an nsaid", /^\s*yes/i], ["does cold and flu have tylenol in it", /^\s*yes/i], ["does period relief have tylenol in it", /^\s*yes/i], ["does dramamine have benadryl in it", /^\s*yes/i], ["is motion sickness the same as benadryl", /diphenhydramine/i], ["which items have nsaids", /Advil[\s\S]*Aspirin/], ["what pain relievers are not nsaids", /Tylenol/]])
  check("ingredients: tricky", re.test(text(ask(q))), q, text(ask(q)).slice(0, 80));

// Conditions printed on our own labels, plus freestyle questions that once got wrong answers.
for (const [cond, banned] of [["i have glaucoma", ["antihistamine", "motionsickness", "periodrelief"]], ["i have an enlarged prostate", ["antihistamine", "coldflu", "decongestant", "motionsickness", "periodrelief"]], ["im diabetic", ["coldflu", "decongestant"]], ["i have thyroid disease", ["coldflu", "decongestant"]], ["i have asthma", ["ibuprofen", "aspirin"]], ["i have copd", ["antihistamine", "motionsickness", "periodrelief"]], ["im 65", ["ibuprofen", "aspirin"]], ["i have emphysema", ["antihistamine"]]])
  for (const id of banned) {
    const q = `${cond}, can i take ${byId[id].name}`, r = ask(q);
    check("label conditions", !offered(r).includes(id) && r.replies.some((x) => x.kind === "warn"), q, offered(r).includes(id) ? "offered it" : "no warning");
    check("label conditions", !ask(`add ${byId[id].name}`, carry(ask(cond))).actions.some((a) => a.type === "add"), `${cond} || add ${byId[id].name}`, "added it");
  }
for (const [q, re, not] of [
  ["i get hives from nsaids what can i take for cramps", /Pamprin|ThermaCare/, /Advil 200mg, /],
  ["aspirin makes my asthma worse", /won't suggest/, null],
  ["im allergic to everything", /pharmacist/, /should help/],
  ["what can i take if im allergic to all pain medicine", /Tylenol|Advil/, /Advil 200mg, Tylenol/],
  ["my wife is allergic to sulfa and has a headache", /sulfa/, null],
  ["does benadryl help with an allergic reaction", /911/, /None known/],
  ["is there anything for a peanut reaction", /911/, null],
  ["i took benadryl and im still itchy can i take more", /daily limit/, null],
  ["can i take nasal spray and cold and flu", /Decongestant/, /don't flag/],
  ["can i use menthol patch with heating pad", /heating pad/, /exact detail/],
  ["which of your meds make you drowsy", /Dramamine/, null],
  ["what medicines are safe in pregnancy", /can't clear/, null],
  ["which items are not medicine", /Gauze/, null],
  ["what do you have that isnt a pill", /Ointment/, null],
  ["are the tampons latex free", /latex/i, null],
  ["is ibuprofen or tylenol better for fever", /compare/, /brand of/],
]) { const t = text(ask(q)); check("freestyle", re.test(t) && !(not && not.test(t)) && !DEAD.test(t), q, t.slice(0, 80)); }

// Every product answers every normal label question.
for (const p of P) {
  const n = p.name, oral = !!p.activeIngredient;
  const cases = [
    [`how much is ${n}`, (t) => t.includes(p.price.toFixed(2))],
    [`what is ${n} for`, (t) => t.includes(p.uses.slice(0, 25))],
    [`what are the warnings on ${n}`, (t) => t.includes(p.warnings.slice(0, 25))],
    [`how do i use ${n}`, (t) => t.includes(p.instructions.slice(0, 25))],
    [`does ${n} need id`, (t) => (p.ageRestricted ? /\b(yes|ID)\b/i : /\b(no|doesn't)\b/i).test(t)],
    [`is ${n} in stock`, (t) => /stock|yes/i.test(t)],
    [`can a pregnant person use ${n}`, (t) => /pharmacist|doctor|pregnan/i.test(t)],
    [`can i use ${n} if i drink alcohol`, (t) => !DEAD.test(t) && t.length > 20],
    [`is ${n} safe for a 3 year old`, (t) => !DEAD.test(t) && t.length > 20],
    [`any side effects from ${n}`, (t) => !DEAD.test(t) && t.length > 20],
    [`what happens if i take too much ${n}`, (t) => !DEAD.test(t) && /1-800-222-1222|poison|label|directed/i.test(t)],
  ];
  for (const [q, ok] of cases) { const t = text(ask(q)); check("every product: label questions", ok(t) && !DEAD.test(t), q, t.slice(0, 80)); }
}

// The same knowledge with the kiosk switched to Spanish (labels swapped in, accents typed).
vm.runInContext("localizeProducts('es')", ctx);
const askEs = (q, m) => ask(q, Object.assign({ lang: "es" }, m));
for (const [w, list] of [["aspirina", ["aspirin", "ibuprofen"]], ["ibuprofeno", ["ibuprofen", "aspirin"]], ["acetaminofén", ["acetaminophen", "periodrelief", "coldflu"]], ["difenhidramina", ["antihistamine", "motionsickness"]], ["mentol", ["patch", "coughdrops"]], ["bacitracina", ["ointment"]], ["loperamida", ["antidiarrheal"]], ["fenilefrina", ["coldflu"]], ["oximetazolina", ["decongestant"]], ["carbonato de calcio", ["antacid"]]])
  for (const id of list) {
    const name = byId[id].name;
    const r = askEs(`soy alérgica a ${w}`);
    check("español", !DEAD.test(text(r)) && text(r).includes(name), `soy alérgica a ${w}`, text(r).slice(0, 80));
    const add = askEs(`agrega ${name}`, carry(r));
    check("español", !add.actions.some((a) => a.type === "add"), `alérgica a ${w} || agrega ${name}`, "added it");
    check("español", add.replies.every((x) => !/\b(because you|the label|won't)\b/i.test(x.text)), `alérgica a ${w} || agrega ${name}`, `English: ${text(add).slice(0, 70)}`);
  }
for (const [q, re] of [["el ibuprofeno contiene aspirina", /^\s*no/i], ["la aspirina contiene aspirina", /^\s*s[ií]/i], ["qué es la bacitracina", /antibi[oó]tico/], ["qué es el mentol", /menta/], ["¿qué ingredientes tiene el acetaminofén?", /Acetaminophen|acetaminof/i], ["tengo glaucoma, ¿puedo tomar benadryl?", /glaucoma/], ["tengo asma, ¿puedo tomar aspirina?", /asma/], ["soy alérgico al maní", /inactivos/], ["soy alérgica a la penicilina", /penicilina/], ["se me hincha la lengua", /911/]])
  check("español", re.test(text(askEs(q))), q, text(askEs(q)).slice(0, 80));

let total = 0, pass = 0;
for (const [name, g] of Object.entries(groups)) {
  total += g.pass + g.fail; pass += g.pass;
  console.log(`${g.fail ? "✗" : "✓"} ${name}: ${g.pass}/${g.pass + g.fail}`);
  g.samples.slice(0, verbose ? 40 : 3).forEach((s) => console.log(`    ${s}`));
}
console.log(`stress: ${pass}/${total} passed`);
if (fails) process.exit(1);
