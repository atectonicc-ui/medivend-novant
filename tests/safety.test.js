// Run: node tests/safety.test.js — every red-flag phrase must be caught, every
// look-alike must not, and conditions must block the unsafe products.
const assert = require("assert");
const { redFlag, detectConditions, productConflicts } = require("../safety.js");
const P = (id) => ({ id });

const must = {
  crisis: ["I want to die", "i want to end it all", "quiero suicidarme", "quiero morir", "i dont want to be alive anymore", "thinking about killing myself", "i want to hurt myself", "no quiero vivir", "me quiero morir", "I feel like taking all my pills", "I want to sleep forever", "I dont see the point anymore", "quiero tomar todas mis pastillas", "i wanna die lol this headache", "i feel like dying", "i want to kms", "i want to disappear forever", "I want to take the whole bottle of pills so I don't wake up", "overdose on purpose", "i just want to sleep forever"],
  poison: ["i took 20 tylenol", "my friend took a whole bottle of tylenol", "my kid swallowed some pills", "my toddler drank some hand sanitizer", "swallowed a battery", "my friend took 20 pills", "i overdosed", "took too many advil", "mi hijo se trago unas pastillas", "tome 15 pastillas", "sobredosis", "tomé muchas pastillas", "I took 6 extra strength tylenol", "took four tylenol pm and a dayquil", "mi perro se comió ibuprofeno", "how much tylenol is an overdose i took 15", "what are signs of an overdose, i took 30 pills", "i took a lot of pills"],
  emergency: ["my chest hurts", "my chest feels tight", "crushing pressure in my chest", "chest pain", "I can not breathe", "i can’t breathe", "he collapsed", "she passed out", "coughing up blood", "dizzy and my arm is numb", "my lips are swelling after eating peanuts", "bee sting and my throat feels tight", "i hit my head and now im confused and throwing up", "fever of 105", "having a seizure", "i think hes having a stroke", "bleeding a lot and it wont stop", "worst headache of my life", "dolor de pecho", "dolor en el pecho", "me duele el pecho", "no puedo respirar", "convulsiones", "sangrado abundante", "he is choking", "i think i have heat stroke", "stiff neck and fever and headache", "my friend isnt breathing", "sangre en el vomito", "tengo fiebre de 40", "fever 40 C", "my heart is racing and i feel faint"],
  urgent: ["my baby has a fever of 101 and is 2 months old", "newborn has a fever", "my 3 week old feels hot", "diarrhea with blood", "black stool and diarrhea", "fever of 103 for 4 days", "severe abdominal pain right side", "diarrea con sangre", "blood in my stool", "i got bit by a dog", "i got bitten by a dog on my hand"],
};
const mustNot = ["what is the overdose limit for tylenol", "what is heat stroke", "are cough drops a choking hazard for kids", "stroke of luck", "i have a headache", "my head hurts", "sore throat", "how much tylenol is an overdose", "what are signs of a stroke", "i burned my hand", "cut my finger", "my baby is 2 months old", "fever of 101", "i drink coffee", "my stomach hurts", "took 2 tylenol", "i have diarrhea", "fever of 101", "take 1 caplet", "took 1 tylenol", "i took 2 advil an hour ago can i take more", "my chest is congested", "my chest is sore from coughing", "chest congestion", "does it come with 24 caplets", "fever of 99"];

let n = 0;
for (const [kind, list] of Object.entries(must)) for (const s of list) { const r = redFlag(s); assert.ok(r && r.kind === kind, `expected ${kind}: "${s}" got ${JSON.stringify(r)}`); n++; }
for (const s of mustNot) { assert.strictEqual(redFlag(s), null, `false positive: "${s}" -> ${JSON.stringify(redFlag(s))}`); n++; }

const blocked = (text, id) => productConflicts(P(id), detectConditions(text)).length > 0;
const cases = [
  ["my kid is 4 and has a fever what can i give", "acetaminophen", true],
  ["ibuprofen for my 2 year old", "ibuprofen", true],
  ["benadryl for my 4 year old", "antihistamine", true],
  ["my 14 year old has the flu", "aspirin", true],
  ["is aspirin ok for a 12 year old", "aspirin", true],
  ["my 14 year old has the flu", "acetaminophen", false],
  ["im allergic to aspirin what can i take for my headache", "aspirin", true],
  ["im allergic to aspirin what can i take for my headache", "ibuprofen", true],
  ["im allergic to aspirin what can i take for my headache", "acetaminophen", false],
  ["can i take aspirin if im on blood thinners", "aspirin", true],
  ["is ibuprofen ok if i have high blood pressure", "ibuprofen", true],
  ["im 74 and take blood pressure pills, i have a cough", "decongestant", true],
  ["can i take cold and flu with my zoloft", "coldflu", true],
  ["can i give my dog ibuprofen", "ibuprofen", true],
  ["im pregnant and have a headache", "ibuprofen", true],
  ["tylenol after drinking alcohol", "acetaminophen", true],
  ["i have a headache", "ibuprofen", false],
  ["bandages for my 5 year old", "bandaid", false],
  ["what is 2+3*4", "ibuprofen", false],
  ["is 2 ibuprofen ok", "ibuprofen", false],
  ["my son is 7 and has a headache", "ibuprofen", true],
  ["I had 7 beers and want tylenol", "acetaminophen", true],
  ["i take lisinopril can i take ibuprofen", "ibuprofen", true],
  ["im on lithium can i take advil", "ibuprofen", true],
  ["i take methotrexate, is aspirin ok", "aspirin", true],
  ["im on prednisone, can i take ibuprofen", "ibuprofen", true],
];
for (const [text, id, want] of cases) { assert.strictEqual(blocked(text, id), want, `conflict ${want ? "missed" : "false"}: "${text}" / ${id}`); n++; }
console.log(`safety: ${n} checks passed`);
