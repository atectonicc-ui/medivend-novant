// Run: node tests/assistant.test.js — end-to-end checks through the real chat engine (Novant waiting-room catalog).
const fs = require("fs"), vm = require("vm"), assert = require("assert"), path = require("path");
const ctx = { console }; vm.createContext(ctx);
vm.runInContext("function money(n){return '$'+n.toFixed(2)}", ctx);
for (const f of ["products.js", "safety.js", "ai.js", "med-qa.js", "i18n.js", "rules.js", "knowledge.js", "assistant.js"])
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
vm.runInContext("this.A = Assistant; this.P = PRODUCTS", ctx);
const ask = (q, extra) => ctx.A.respond(q, Object.assign({ lang: "en", cart: [], taxRate: 0.07, isAvailable: (p) => p.inStock, unavailableReason: (p) => (p.inStock ? null : "stock") }, extra));
const names = (r) => r.products.map((p) => p.id).concat(r.actions.filter((a) => a.type === "add").map((a) => a.id));
const text = (r) => r.replies.map((x) => x.text).join(" ");
const byId = (id) => ctx.P.find((p) => p.id === id);
let n = 0;
const check = (cond, msg) => { assert.ok(cond, msg); n++; };

// Nothing in the catalog is swallowed: waiting-room patients can't take medicine from the kiosk.
const SWALLOWED = ["ibuprofen", "acetaminophen", "aspirin", "periodrelief", "antihistamine", "coughdrops", "coldflu", "antacid", "electrolyte", "motionsickness", "antidiarrheal"];
for (const id of SWALLOWED) check(!byId(id), `catalog still has ${id}`);
check(ctx.P.length === 17, "catalog size");

for (const q of ["i took 20 tylenol", "my chest hurts", "quiero suicidarme", "me duele el pecho", "my toddler drank some hand sanitizer", "i want to end it all"])
  check(ask(q).emergency, `not emergency: ${q}`);
check(/front desk/.test(text(ask("my chest hurts"))), "emergency doesn't point to the front desk");
check(!ask("what is the overdose limit for tylenol").emergency, "overdose-limit false positive");
check(/1-800-222-1222/.test(text(ask("what is the overdose limit for tylenol"))), "overdose info lacks Poison Control");

const infant = ask("my baby has a fever of 101 and is 2 months old");
check(!infant.products.length && /doctor|pediatrician/i.test(text(infant)), "infant fever got products");

{ // medicine and food requests go to the staff, never to a product
  for (const q of ["do you have advil", "i need tylenol", "how much is ibuprofen", "what is advil", "do you have nyquil", "do you have melatonin", "something for my allergies pills", "can i get cough drops", "necesito pastillas", "i have a headache", "i have a sore throat", "my kid is 4 and has a fever what can i give"]) {
    const r = ask(q);
    check(/staff|personal/.test(text(r)), `no staff note: ${q}`);
    check(names(r).every((id) => !SWALLOWED.includes(id)), `offered medicine: ${q}`);
  }
  for (const q of ["do you have water", "can i get a snack", "i'm thirsty", "do you sell gum", "tengo sed"])
    check(/food|comida/.test(text(ask(q))) && !names(ask(q)).length, `food not handled: ${q}`);
  const dog = ask("can i give my dog ibuprofen");
  check(!dog.products.length && /veterinarian|ASPCA/.test(text(dog)), "pet case");
}
{ // waiting-room basics are found by everyday words
  for (const [q, id] of [["its so loud in here", "earplugs"], ["too loud", "earplugs"], ["my phone is dead", "cable"], ["my phone died", "cable"], ["i need a face mask", "masks"], ["germs face mask", "masks"], ["runny nose", "tissues"], ["my eyes are watering", "tissues"], ["i need hand wipes", "wipes"], ["i cut my finger", "bandaid"], ["i might be pregnant", "pregnancytest"], ["my neck is killing me also i nicked my face when shaving", "bandaid"]])
    check(names(ask(q)).includes(id), `"${q}" didn't offer ${id}`);
  check(/\$3\.99/.test(text(ask("how much are earplugs"))), "price");
  check(/don't carry|doesn't carry|needs a doctor/.test(text(ask("i think i have a uti"))), "honest about uti");
}
{ // conversation memory and cart
  const list = ask("i cut my finger");
  const mem = { lastList: list.lastList, lastProduct: list.last };
  check(names(ask("the second one", mem))[0] === list.lastList[1].id, "ordinal");
  check(!ask("add it", mem).actions.length && /Which one/.test(text(ask("add it", mem))), "add it guessed from a list");
  check(!ask("yes", { lastList: list.lastList, lastProduct: list.last, pending: list.pending }).actions.length, "yes silently added from a list");
  const band = byId("bandaid"), cartCtx = { cart: [{ product: band, qty: 2 }], lastProduct: band };
  check(ask("make it 3", cartCtx).actions[0].qty === 3, "make it 3");
  check(ask("remove one bandaid", cartCtx).actions[0].qty === 1, "decrement");
  check(ask("i need 2 ointment", { cart: [{ product: band, qty: 2 }] }).actions[0].type === "add", "need N is an add");
  const wipes = byId("wipes");
  check(ask("add wipes").actions[0].id === "wipes", "add by name");
  check(ask("add another", { cart: [{ product: wipes, qty: 1 }], lastProduct: wipes }).actions[0].type === "add", "add another");
  check(/Remov/.test(text(ask("actually remove that", { cart: [{ product: wipes, qty: 1 }], lastProduct: wipes }))), "filler");
  check(/\$3\.20/.test(text(ask("whats my total", { cart: [{ product: wipes, qty: 1 }] }))), "total");
  check(/What's bothering/.test(text(ask("i feel like crap"))), "vague symptom");
  for (const q of ["i feel good", "im good"]) check(!/What's bothering/.test(text(ask(q))), `false vague: ${q}`);
}
{ // location: this hospital, never a directory of outside care
  for (const q of ["where am i", "where is the nearest er", "nearest pharmacy", "donde estoy"]) check(/Rowan Medical Center/.test(text(ask(q))), `location: ${q}`);
  const thermo = text(ask("do you have a thermometer"));
  check(/front desk/.test(thermo) && !/:\s*$/.test(thermo) && !/nearby pharmacy/.test(thermo), "care reply still points to nearby care");
  check(!/Sriansh/.test(text(ask("who made this"))), "credit");
}
console.log(`assistant: ${n} checks passed`);
