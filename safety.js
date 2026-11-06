// Clinical safety layer shared by the search box (ai.js classify) and the AI
// Assistant (assistant.js). Runs before any product matching:
//   redFlag(text)            -> { kind: "crisis" | "poison" | "emergency" | "urgent" } | null
//   detectConditions(text)   -> who/what the customer mentioned (child age, pregnancy, meds...)
//   productConflicts(p, c)   -> reasons a product is unsafe for those conditions
// Patterns run on accent-stripped, apostrophe-free lowercase text, and include
// Spanish directly so they never depend on the assistant's translation step.

function safetyNormalize(text) {
  return String(text)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’‘`´']/g, "")
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


const RED_FLAGS = {
  crisis: [
    /\bsuicid/, /\bkill(ing)? (myself|my self)\b/, /\b(want|wanna|going) to die\b/, /\bend (it all|my life)\b/,
    /\bdont want to (be alive|live|exist|wake up)\b/, /\bbetter off dead\b/, /\b(hurt|harm|cut|cutting) myself\b/,
    /\bself harm/, /\bno reason to live\b/, /\bwanna die\b/, /\bpills to not wake up\b/, /\bme quiero (matar|morir)\b/, /\bvoy a hacerme dano\b/, /\bya no quiero vivir\b/, /\blife (isnt|is not) worth living\b/, /\bthinking (of|about) ending (it|things|my life)\b/, /\b(sleep|sleeping) and never wake up\b/, /\b(hurt|hurting|harm|harming|kill|killing) (someone|somebody|people|others|him|her|them|my (wife|husband|partner|boyfriend|girlfriend|kid|kids|mom|dad))\b/, /\b(nobody|no one) (would|will|is going to) (miss|care if|notice if)\b/, /\beveryone (would|will) be better off\b/, /\bcant (go on|do this anymore|take it anymore|keep going)\b/, /\bwhats the point of living\b/, /\bnadie me (extranaria|va a extranar)\b/, /\bno quiero (vivir|seguir viviendo)\b/, /\bdont want to be here\b/, /\b(lethal|fatal|deadly) (dose|amount)\b/, /\bhow (many|much)\b.{0,30}\b(kill me|to die|would kill|to kill myself|to end it)\b/, /\bhow to (overdose|od)\b/, /\bfeel(ing)? like dying\b/, /\bkms\b/, /\bunalive\b/, /\btake my (own )?life\b/,
    /\b(take|taking|swallow|swallowing) all (of )?(my|the) (pills|meds|medicine|medication)/, /\bsleep forever\b/,
    /\b(dont|do not|cant|cannot) see (the|a) point\b/, /\bnot want to wake up\b/, /\bwish i (was|were) dead\b/, /\bdisappear forever\b/,
    /\b(so|and) (i|that i) (dont|do not|never|wont|will not) wake up\b/, /\b(take|swallow|down) (the |a )?(whole|entire) (bottle|box|pack)\b/,
    /\boverdose on purpose\b/, /\b(want|going|plan|planning) to overdose\b/, /\bnever wake up\b/, /\bsleep forever\b/,
    /\btomar(me)? todas (mis|las) pastillas\b/, /\bdormir para siempre\b/, /\bno (le )?veo (el )?sentido\b/, /\bquiero desaparecer\b/,
    /\bquiero morir/, /\bmatarme\b/, /\bno quiero vivir\b/, /\bhacerme dano\b/, /\bquitarme la vida\b/,
  ],
  poison: [
    /\boverdos(ed|ing)\b/, /\bi (just )?overdosed?\b/, /\bpoison(ed|ing)\b/,
    /\b(took|ate|swallowed|had|taken) (a |the |an )?(whole|full|entire|half (a|the)) (bottle|box|pack)/,
    /\b(baby|infant|toddler|kid|child|son|daughter|grandson|granddaughter|year old|hijo|hija|nino|nina)\b.{0,25}\b(ate|swallowed|licked|drank|got into|chewed|se comio|se trago)\b.{0,20}\b(patch|patches|icy hot|cough drops?|lozenges?|sanitizer|pills?|tablets?|caplets?|medicine|tylenol|advil|aspirin|ibuprofen|benadryl|sunscreen|ointment|antacids?|tums)\b/,
    /\bgave\b.{0,25}\b(baby|infant|toddler|kid|child|son|daughter|year old)\b.{0,25}\baspirin\b/,
    /\b(took|swallowed|drank|tomo|tome)\b.{0,12}\b(a|the|whole|entire|my whole|all my)\b.{0,4}\b(bottle|box|prescription|pack)\b/, /\bmixed (all )?(my )?pills\b/, /\btomo? muchas pastillas\b|\btome? muchas pastillas\b/,
    /\b(took|taken) too (many|much)\b/, /\b(took|taken) (one|a few|some|way) too many\b/,
    /\b(took|swallowed|ate|taken|had) (a lot|lots|a bunch|a handful|a ton|way too many|too many) of (pills|meds|medicine|medication|tablets|caplets|tylenol|advil|aspirin|ibuprofen)\b/,
    /\b(swallowed|ate|drank|drink|got into|chewed|licked)\b.{0,30}\b(battery|batteries|magnet|bleach|cleaner|detergent|laundry pod|tide pod|antifreeze|sanitizer|pills?|medicine|chemicals?|rat poison|nail polish)\b/,
    /\bsobredosis\b/, /\benvenen/, /\bse (trago|comio|tomo|bebio)\b/,
    /\b(trago|comio|bebio|tomo)\b.{0,30}\b(pastillas|cloro|blanqueador|bateria|pila|desinfectante|medicinas?|detergente)\b/,
    /\btome \d+ (pastillas|tabletas)/, /\b(tome|tomo|se tomo|trago|se trago) (muchas|demasiadas|un monton de|todo el frasco|toda la caja)\b/,
  ],
  emergency: [
    /\bchest (pain|hurts?|hurting|pressure|tight(ness)?|feels? (tight|heavy|crushed|weird))/, /\b(pressure|tightness|crushing) (in|on) (my |his |her )?chest\b/,
    /\bse me (hincha|hinchan|inflama|inflaman|cierra)\b.{0,15}\b(lengua|garganta|cara|labios)\b/, /\b(lengua|garganta|labios|cara) (hinchad\w+|inflamad\w+)\b/,
    /\bone side\b.{0,25}\b(weak|numb|droop|tingl\w*)\b/, /\b(cant|cannot|can not) (feel|move) (my|his|her|their) (legs?|arms?|face|hands?|feet|foot)\b/,
    /\b(pregnant|embarazada)\b.{0,30}\b(bleeding|sangrando|sangrado|water broke|contractions?|severe pain)\b|\bwater broke\b|\bse me rompio la fuente\b/,
    /\b(fell|fallen|fall)\b.{0,25}\b(cant|cannot|can not|wont) (get up|move|stand)\b/, /\bsnake ?bit\w*\b|\b(bit|bitten) by a snake\b|\bmordio una (serpiente|vibora)\b/,
    /\bcarbon monoxide\b|\bco alarm\b|\bmonoxido\b/, /\b(inhaled|breathed in|breathing in) (smoke|fumes|gas|chemicals)\b|\bsmoke inhalation\b/,
    /\b(blurry|blurred|double|lost|losing) vision\b.{0,30}\b(head|headache|pounding)\b|\b(head|headache)\b.{0,30}\b(blurry|blurred|double|lost|losing) vision\b|\bvision (went|is|going) (blurry|black|dark)\b/,
    /\bheart\b.{0,12}\b(racing|pounding)\b.{0,30}\b(high|drugs|cocaine|meth|took)\b|\b(im high|high on|took drugs|cocaine|meth)\b.{0,30}\bheart\b.{0,12}\b(racing|pounding)\b/,
    /\bmy chest\b.{0,15}\b(killing me|hurts?|hurting|aches?|aching|pain|tight|heavy|on fire)\b/, /\btoxic shock\b/, /\bheart (is stopping|stopped)\b/, /\b(spreading|going|radiating|shooting) (to|down|into) (my |the )?(jaw|arm|left arm)\b/,
    /\b(baby|infant|newborn|toddler)\b.{0,20}\b(limp|floppy|wont feed|wont eat|not feeding|bulging|soft spot)\b/, /\bsoft spot\b.{0,10}\bbulging\b/,
    /\b(cant|cannot) (lift|raise) my (arm|leg)\b/, /\b(talking funny|words coming out wrong|slurring|cant speak|no puedo hablar)\b/, /\bcara caida\b/,
    /\b(gasping|fighting) for (air|breath)\b/, /\b(cant|cannot) get (any )?air\b/, /\bwheezing and cant\b/, /\bno (puede|puedo) respirar\b|\bno respirar?\b/,
    /\bbleeding (really |very |so )?(bad|badly|a lot)\b/, /\b(spurting|gushing)\b/, /\bsangr\w+ mucho\b/, /\bbone (is )?(sticking|showing|poking)\b/, /\bcar (accident|crash)\b/,
    /\bepipen\b.{0,15}\b(didnt|did not|not) (work|help)\b/, /\bblood sugar\b.{0,25}\b(passing out|passed out|unconscious|crash)\b/, /\bdiabetic\b.{0,15}\bunconscious\b/,
    /\b(high fever|fever)\b.{0,12}\bconfus\w+\b/, /\bpurple rash\b|\brash\b.{0,15}\b(wont|doesnt|not) fade\b/, /\bsevere burn\b|\bburned all over\b/, /\bappendix\b.{0,10}\bburst\b|\bectopic\b/,
    /\belectric(al)? shock\b|\belectrocuted\b|\bstruck by lightning\b|\bdrown(ed|ing)\b|\bhypothermia\b/, /\bsudden(ly)? (blind\w*|vision loss|lost my vision)\b|\b(sudden )?vision loss\b/, /\bblindness\b/,
    /\b(severe|rigid|bad)\b.{0,20}\b(abdominal|belly|stomach)\b.{0,12}\b(rigid|hard|pregnant)\b|\bpregnant\b.{0,20}\b(severe|bad)\b.{0,12}\b(belly|stomach|abdominal)\b/, /\bblack\b.{0,12}\bstool\b.{0,12}\b(dizzy|faint)\b/,
    /\b(been )?shot\b|\bstabbed\b|\bgunshot\b/, /\bsoaking (through |though )?(a )?pads?\b/, /\bdolor\b.{0,20}\bpecho\b|\bpresion en el pecho\b|\bduele\b.{0,12}\bpecho\b/, /\bdolor de cabeza\b.{0,20}\b(repentino|de repente)\b/, /\bbebe\b.{0,10}\bmorado\b/,
    /\bjaw\b.{0,40}\b(sweat\w*|dizzy|nause\w*|short of breath|chest)\b|\b(sweat\w*|dizzy|nause\w*|short of breath|chest)\b.{0,40}\bjaw\b/, /\btoxic shock\b/, /\bheart attack\b(?! prevention)/, /\b(elephant|weight|pressure|something heavy)\b.{0,20}\b(on|in) my chest\b/, /\b(baby|infant|toddler|kid|child|son|daughter|he|she|lips?|face)\b.{0,12}\b(is|are|turning|turned) blue\b/, /\bdesangrando\b/, /\b(heart|pulse)\b.{0,20}\b(racing|pounding)\b.{0,30}\b(faint|dizzy|chest|pass out|passing out|short of breath|cant breathe)/,
    /\b(cant|can not|cannot|could not|couldnt) (breathe|breath|catch (my|his|her) breath)\b/, /\b(hard|trouble|difficulty|struggling) (to )?breath/,
    /\b(not|isnt|arent|wasnt|stopped|quit) breathing\b/, /\bno (esta|respira)\b.{0,10}\brespir/, /\bshort(ness)? of breath\b/,
    /\b(throat|tongue|lips?|face|mouth)\b.{0,15}\b(clos|swell|swollen|tight|puff)/, /\bswollen (throat|tongue|lips?|face)\b/, /\banaphyla/,
    /\b(unconscious|unresponsive|passed out|blacked out|fainted|collapsed|wont wake up|not waking up|not responding|turning blue|blue lips)\b/,
    /\b(seizure|seizing|convuls)/, /\bstroke\b/, /\bface (is )?droop/, /\bslurred speech\b/,
    /\b(arm|face|leg|one side)\b.{0,15}\b(numb|weak|tingl|droop)/, /\bnumb(ness)?\b.{0,15}\b(arm|face|one side|left side)\b/,
    /\b(bleeding|blood)\b.{0,20}\b(a lot|heavily|everywhere|wont stop|will not stop|cant stop|spurting|gushing)\b/, /\b(severe|heavy|uncontrolled) bleeding\b/,
    /\b(hit|bumped|banged|hurt) (my|his|her|their) head\b.{0,60}\b(confus|vomit|throw|puk|dizzy|sleepy|pass|black|seiz)/, /\bhead (injury|trauma)\b.{0,40}\b(confus|vomit|throw|dizzy)/,
    /\b(cough|coughing|vomit|vomiting|throw|throwing|puk)(ing)? (up )?blood\b/, /\bblood in (my |the )?(vomit|throw up)\b/,
    /\bworst headache\b/, /\bthunderclap\b/, /\bsudden (severe|terrible|worst) headache\b/,
    /\bfever\b.{0,20}\b(10[4-9]|11\d)\b/, /\b(10[4-9]|11\d) (degree|f\b|fever)/,
    /\b(fever|fiebre|temperatura)\b.{0,20}\b(4[0-3])(\.\d)?\b/, /\b(4[0-3])(\.\d)? ?(c|celsius|grados)\b/,
    /\b(vomit\w*|vomito|vomitando)\b.{0,10}\bsangre\b|\bsangre en el vomito\b|\b(tose|tosiendo) sangre\b/,
    /\bchoking\b(?!.{0,15}hazard)/, /\b(drowning|drowned|electrocuted|gunshot|been shot|got shot|stabbed|hit by a car)\b/,
    /\bdolor (de|en el) pecho\b/, /\bpresion en el pecho\b/, /\bme duele el pecho\b/, /\bno puedo respirar\b/, /\bme ahogo\b/, /\b(infarto|ataque al corazon|derrame cerebral)\b/,
    /\b(inconsciente|desmay|convulsi)/, /\bsangrado (abundante|fuerte)\b/, /\bno (para|deja) de sangrar\b/,
    /\bse me cierra la garganta\b/, /\b(labios|lengua|cara) hinchad/,
  ],
};

const COUNT_WORDS = { five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20 };
const MED_WORDS = "(pills?|tablets?|caplets?|capsules?|liquicaps?|gel ?caps?|imodium|loperamide|dramamine|pamprin|bayer|tums|tylenol|advil|motrin|aleve|aspirin|ibuprofen|acetaminophen|paracetamol|benadryl|dayquil|nyquil|excedrin|midol|pastillas?|tabletas?)";
const ACET_SOURCES = /\b(tylenol|acetaminophen|paracetamol|dayquil|nyquil|theraflu|excedrin|midol|cold and flu|cold flu)\b/g;

// "took 6 extra strength tylenol" — five or more of anything at once is past every label's single dose.
function overdoseByCount(t) {
  const re = new RegExp(`\\b(took|taken|take|had|swallowed|ate|tome|tomo|trago)\\b(?: \\w+){0,2}? (\\d+|${Object.keys(COUNT_WORDS).join("|")})\\b(?: \\w+){0,3}? ${MED_WORDS}`);
  const m = t.match(re);
  if (!m) {
    // "how much tylenol is an overdose, i took 15" — count without a unit, med named elsewhere
    const bare = t.match(/\b(took|swallowed|ate|had) (\d+)\b(?! ?(hours?|hrs?|minutes?|mins?|days?|weeks?|mg|ml|ago|years?|yrs?|am|pm|degrees?))/);
    return !!bare && new RegExp(MED_WORDS).test(t) && parseInt(bare[2], 10) >= 5;
  }
  const n = COUNT_WORDS[m[2]] || parseInt(m[2], 10);
  return n >= 5;
}
// Already took two acetaminophen-containing products (e.g. "tylenol pm and a dayquil").
function stackedAcetaminophen(t) {
  if (!/\b(took|taken|had|already)\b/.test(t)) return false;
  // "took tylenol, can i take dayquil?" has only taken one so far: count what comes before the question.
  const taken = t.split(/\b(?:can|could|should) i\b|\bis it (?:ok|safe)\b/)[0];
  return new Set(taken.match(ACET_SOURCES) || []).size >= 2;
}

// Warning signs straight from the products' own "do not use / ask a doctor" sections.
const URGENT = [
  { reason: "stool", re: /\b(bloody|black|tarry|blood in (my |the )?)\b.{0,12}\b(stool|poop|diarrhea|bowel)|\b(diarrhea|stool|poop)\b.{0,15}\b(blood|bloody|black)\b|\b(heces|diarrea) (con sangre|negras?)\b/ },
  { reason: "fever", re: /\b(fever|fiebre)\b.{0,20}\b39\.[5-9]\b|\bfever\b.{0,25}\b(10[3-9])\b|\b(10[3-9]) (degree|f)\b.{0,15}\bfever|\bfever\b.{0,25}\b(for )?([4-9]|four|five|six|seven) days\b|\bfiebre\b.{0,25}\b([4-9]|cuatro|cinco) dias\b/ },
  { reason: "bite", re: /\b(bit|bitten|bite|mordio|mordida|mordedura)\b.{0,25}\b(dog|cat|animal|raccoon|bat|perro|gato|animal)\b|\b(dog|cat|animal|perro|gato)\b.{0,15}\b(bit|bite|bitten|mordio)\b/ },
  { reason: "violence", re: /\b(being|was|been|getting|got|am) (abused|assaulted|raped|attacked|beaten)\b|\b(being|getting) hit by (my|him|her|them)\b|\b(he|she|they|my \w+) (hits|beats|chokes|hurts|threatens|stalks) me\b|\babuse at home\b|\bme (pega|golpea|violo|violaron|abusan?)\b|\bfui (violada|violado|agredida|agredido)\b/ },
  { reason: "reaction", re: new RegExp(`\\b(took|after|from|taking|tome|tomo|tomar|despues)\\b.{0,40}\\b(rash|hives|blisters|blistering|ronchas|sarpullido|ampollas)\\b.{0,40}|\\b(rash|hives|blisters|ronchas|sarpullido)\\b.{0,25}\\b(after|from|since)\\b.{0,25}${MED_WORDS}`) },
  { reason: "abdomen", re: /\b(severe|worst|really bad|terrible|sharp|intense)\b.{0,15}\b(abdominal|stomach|belly|tummy)\b.{0,10}\bpain|\b(lower )?right side\b.{0,25}\b(pain|hurts)\b|\bpain\b.{0,25}\b(lower )?right side\b|\bdolor (fuerte|intenso) (de|en el) (estomago|abdomen|vientre)\b/ },
];

// A baby under 3 months with any fever needs a doctor right away (not a 911 event, but never a product).
// Symptom combinations in plain words. Runs before any product matching, so none of these can be sold to.
// `all` = every pattern must match. No `en` text: the emergency screen. With text: that advice, and no product.
const CLINICAL = [
  { all: [/\b(heartburn|indigestion|acid reflux)\b/, /\b(arm|jaw|back|sweat\w*|short of breath|faint|dizzy)\b/] },
  { all: [/\bchest (pressure|tightness)\b|\b(pressure|tightness) in my chest\b/] },
  { all: [/\bworst\b.{0,20}\b(of my life|ever)\b/, /\b(headache|head|migraine)\b|\bcame on sudden/] },
  { all: [/\b(back|spine)\b/, /\b(cant pee|cant urinate|cant feel my legs|numb(ness)? in my (groin|legs)|lost control of my bladder)\b|\bcant (pee|urinate)\b.*\b(legs?)\b/] },
  { all: [/\bcoffee grounds\b/] }, { all: [/\bvertigo\b|\bdizzy\b/, /\bdouble vision\b|\bvision is double\b/] },
  { all: [/\bconfused\b|\bhard to wake\b|\bwont wake\b/, /\b(after|taking|took)\b/] },
  { all: [/\b(pregnant|embarazada)\b/, /\bbleeding (heavily|a lot|really bad|so much)\b|\bheavy bleeding\b|\bheavily\b|\bsangrando mucho\b/] },
  { all: [/\bpositive (pregnancy )?test\b|\bpregnant\b|\bmissed my period\b/, /\bsharp pain\b|\bone side\b|\bpain on (one|my left|my right) side\b/] },
  { all: [/\bchemo(therapy)?\b|\bon cancer treatment\b/, /\bfever\b|\btemperature\b/] },
  { en: "Yellow eyes or skin with dark urine can mean liver damage. Stop taking anything with acetaminophen, go to the ER today, and call Poison Control at 1-800-222-1222.", es: "Ojos o piel amarillos con orina oscura pueden significar daño al hígado. Deje de tomar acetaminofén, vaya hoy a emergencias y llame a Control de Envenenamientos al 1-800-222-1222.", all: [/\b(eyes|skin)\b.{0,20}\byellow\b|\byellow\b.{0,15}\b(eyes|skin)\b|\bjaundice\b|\bojos amarillos\b/] },
  { en: "Pain low on the right that keeps getting worse can be appendicitis. Please go to the ER today, and don't take anything for it first.", es: "Un dolor en la parte baja derecha que empeora puede ser apendicitis. Vaya hoy a emergencias y no tome nada antes.", all: [/\b(lower right|right side)\b/, /\b(stomach|belly|abdomen|abdominal|hurts|pain)\b/, /\b(worse|worsening|getting bad|severe)\b/] },
  { en: "Black stools can mean bleeding in the stomach, and medicines like Advil or aspirin can cause that. Stop them and go to urgent care or the ER today. Call 911 if you feel faint.", es: "Las heces negras pueden significar sangrado en el estómago, y medicinas como Advil o aspirina pueden causarlo. Déjelas y vaya hoy a atención urgente o emergencias. Llame al 911 si se siente débil.", all: [/\b(black|tarry)\b.{0,12}\b(stools?|poop)\b|\b(stools?|poop)\b.{0,12}\b(black|tarry)\b/, /\b(advil|ibuprofen|aspirin|motrin|taking|since)\b/] },
  { en: "Red streaks spreading from a cut can be a spreading infection, and ointment won't treat that. Get it seen today at urgent care. Go to the ER with a fever or if it's spreading fast.", es: "Las rayas rojas que salen de una herida pueden ser una infección que se extiende, y el ungüento no la trata. Hágase ver hoy en atención urgente. Vaya a emergencias si hay fiebre o avanza rápido.", all: [/\bred (streaks?|lines?)\b|\brayas rojas\b/] },
  { en: "A swollen, painful leg after a long trip or time sitting can be a blood clot. Don't rub it or put a patch on it. Get seen today, and call 911 if you have chest pain or trouble breathing.", es: "Una pierna hinchada y dolorosa después de un viaje largo puede ser un coágulo. No la frote ni le ponga un parche. Hágase ver hoy, y llame al 911 si hay dolor de pecho o dificultad para respirar.", all: [/\b(leg|calf)\b/, /\b(swollen|swelling|red|hot)\b/, /\b(flight|plane|long trip|long drive|sitting|birth control|surgery)\b/] },
  { en: "A foot sore that won't heal needs a doctor soon when you have diabetes, because infections can get serious quickly. Please get it seen in the next day or so.", es: "Una llaga en el pie que no sana necesita un médico pronto si tiene diabetes, porque las infecciones pueden agravarse rápido. Hágase ver en el próximo día más o menos.", all: [/\bdiabet\w+\b/, /\bfoot|feet|toe\b/, /\b(sore|wound|ulcer|heal|cut|blister)\b/] },
  { en: "That may be dehydration, which gets serious quickly in a baby. Call your pediatrician now or go to the ER.", es: "Eso puede ser deshidratación, que se agrava rápido en un bebé. Llame ahora al pediatra o vaya a emergencias.", all: [/\bbaby|infant|newborn|bebe\b/, /\b(no|hasnt had a|hasnt had|without a) wet diapers?\b|\bwet diaper\b.{0,15}\b(hours|today)\b|\bnot drinking\b/] },
  { en: "A tampon left in can cause toxic shock. Remove it if you can, and get to urgent care today. Fever, rash, vomiting or dizziness means call 911.", es: "Un tampón olvidado puede causar choque tóxico. Retírelo si puede y vaya hoy a atención urgente. Fiebre, sarpullido, vómito o mareo significa llamar al 911.", all: [/\btampon\b/, /\b(stuck|forgot|left in|days|fever|rash|lost)\b/] },
  { en: "Bleeding while pregnant needs checking. Call your OB now, and go to the ER if it's heavy or you have pain or feel faint.", es: "El sangrado durante el embarazo debe revisarse. Llame ahora a su obstetra y vaya a emergencias si es abundante o hay dolor o debilidad.", all: [/\bbleeding\b|\bsangr\w+\b/, /\b(pregnant|embarazada)\b/] },
  { en: "That sounds like rebound congestion from overusing the spray. Stop using it and talk to a pharmacist or doctor, who can help you come off it. Nothing here treats it.", es: "Eso parece congestión de rebote por usar demasiado el aerosol. Déjelo y hable con un farmacéutico o médico, que pueden ayudarle. Nada aquí la trata.", all: [/\b(afrin|nasal spray|oxymetazoline)\b/, /\b(without it|for (a |\d+ |two |three )?weeks?|rebound|for (a )?month|cant stop)\b/] },
];

function infantFever(t) {  if (/\b(limp|floppy|wont feed|wont eat|not feeding|bulging|blue)\b/.test(t)) return false; // worse than a fever alone: falls through to emergency
  if (!/\b(fever|temperature|temp|hot|fiebre|calentura)\b/.test(t)) return false;
  if (/\b(newborn|recien nacido)\b/.test(t)) return true;
  const m = t.match(/\b(\d+|one|two|a) (week|wk|month|mo|semana|mes)(s|es)?\b/);
  if (!m || !/\b(baby|infant|old|bebe|nino|nina|hijo|hija|daughter|son)\b/.test(t)) return false; // "sore throat for a week" isn't an age
  const n = { one: 1, two: 2, a: 1 }[m[1]] || parseInt(m[1], 10);
  return /^(week|wk|semana)/.test(m[2]) ? n < 13 : n < 3;
}

// Information questions ("what is heat stroke", "overdose limit for tylenol")
// mention scary words without describing an emergency happening now.
const INFO_Q = /^(what (is|are|does|counts)|whats|signs of|symptoms of|how (do|can|would) (i|you) (know|tell|prevent|avoid)|how to (prevent|avoid|recognize)|explain|tell me about|is it an overdose|how much (\w+ ){0,3}(is|counts as) (an )?overdose)|\b(overdose|max|maximum) (limit|amount|dose)\b|\bhazard\b/;

// "how do you know it's heartburn and not a heart attack". Anyone describing their own symptoms
// right now ("my chest hurts, is it heartburn?") doesn't count: that stays an emergency.
function isLookalikeQuestion(text) {
  const t = safetyNormalize(text);
  if (/\bis (chest pain|a headache|a rash|a fever) always\b|\b(panic attack|heart attack|stroke) or something else\b|\bwhen (do|does|should) (i|you|a|someone)\b.*\b(stitches|er|urgent care)\b/.test(t) && !/\bright now\b/.test(t)) return true;
  if (!/\b(difference|different|how (do|can|would|could|does) (i|you|someone|anyone|one|we)( \w+)? (know|tell)|how to tell|tell (the difference|them apart)|(what|could|can|might)\b.{0,25}\blooks? like|looks? the same|mistaken?|confused? with|versus|vs|como (saber|se si|distinguir)|diferencia)\b/.test(t)) return false;
  return !/\b(?<!if )(i have|i got|im having|i am having|i feel|i think i|my (chest|arm|jaw|head|face|throat|lips|tongue|heart|stomach|belly|baby|kid|son|daughter|wife|husband|mom|dad)|right now|hurts|me duele|tengo)\b/.test(t);
}

function redFlag(text) {
  if (isLookalikeQuestion(text)) return null; // asking how to tell two things apart, not reporting a symptom
  text = String(text).replace(/\b(cut|nicked|hurt|scratched|burned) myself\s+(shaving|cooking|gardening|at work|at the gym|on (a|the|some|my) \w+|by accident|accidentally|while \w+)/gi, "minor injury").replace(/\b(had|survived) a (heart attack|stroke) (last|in|years|a year|\d)[^.;,]*/gi, "had heart trouble before").replace(/\b(breathe|breathing) through my nose\b/gi, "stuffy nose").replace(/\b(die|dying|dead|choking|choke)\s+(laughing|of laughter|with laughter|from laughter)\b/gi, "laughing")
    .replace(/\b(warning )?(signs?|symptoms?) of (a |an )?(stroke|anaphylaxis|heart attack|overdose|poisoning)\b/gi, "info")
    .replace(/\bpassed out on the (couch|sofa|bed)\b|\b(puffy|swollen) from sleep\b|\bshort of breath after the stairs but fine\b|\bbut (im |i feel )?fine now\b/gi, "");
  const t = safetyNormalize(text);
  if (!t) return null;
  if (RED_FLAGS.crisis.some((r) => r.test(t))) return { kind: "crisis" }; // never exempted
  const clinical = CLINICAL.find((c) => c.all.every((re) => re.test(t)));
  if (clinical && !INFO_Q.test(t)) return clinical.en ? { kind: "urgent", text: clinical } : { kind: "emergency" };
  if (infantFever(t)) return { kind: "urgent", reason: "infant" };
  const reportedTaking = /\b(i|he|she|they|we|my \w+) (just |already )?(took|ate|swallowed|have taken|had|drank)\b/.test(t);
  const info = INFO_Q.test(t) && !reportedTaking;
  if (!info && (RED_FLAGS.poison.some((r) => r.test(t)) || overdoseByCount(t) || stackedAcetaminophen(t))) return { kind: "poison" };
  // Stiff neck with fever (possible meningitis) is an emergency, not "urgent".
  if (!info && /\bstiff neck\b|\bcuello rigido\b/.test(t) && /\b(fever|fiebre|headache|dolor de cabeza)\b/.test(t)) return { kind: "emergency" };
  if (!info && RED_FLAGS.emergency.some((r) => r.test(t)) && !/\bstroke of (luck|genius|midnight)\b/.test(t)) return { kind: "emergency" };
  const urgent = !info && URGENT.find((u) => u.re.test(t));
  if (urgent) return { kind: "urgent", reason: urgent.reason };
  return null;
}

const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17 };

function detectConditions(text) {
  const t = safetyNormalize(text).replace(/\bbaby aspirin\b/g, "daily aspirin"); // not about a baby
  const c = {};
  const age = t.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen) ?(year|yr|ano)s?( |-)?(old)?\b/) || t.match(/\b(\d{1,2}) ?(?:yo|y o|yrs?)\b/) ||
    t.match(/\b(?:son|daughter|kid|child|toddler|grandson|granddaughter|grandkid|hijo|hija|nino|nina|nieto|nieta)\b\D{0,18}?\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b(?! ?(mg|pills?|tablets?|caplets?|days?|hours?|f\b|degrees?|times|ml|oz|%))/);
  if (age) {
    const n = NUM_WORDS[age[1]] || parseInt(age[1], 10);
    if (n < 19) c.age = n;
  }
  if (/\b(baby|babies|infant|newborn|bebe|recien nacido)\b/.test(t) || /\b\d+ (week|month|semana|mes)(s|es)? old\b/.test(t)) c.age = Math.min(c.age ?? 99, 1);
  if (c.age === undefined && /\b(toddler|my kid|my child|my son|my daughter|for kids|for children|for a child|for a kid|for my kid|kids|child|children|ninos?|ninas?|hijo|hija)\b/.test(t)) { c.age = 6; c.ageUnknown = true; } // unspecified child: assume under 12
  if (c.age === undefined && /\b(teen|teenager|adolescente)\b/.test(t)) c.age = 15;
  // naming the product isn't saying you're pregnant
  const noTest = t.replace(/\b(pregnancy tests?|prueba de embarazo)\b/g, " ");
  if (/\b(not|no longer|arent|no estoy) (pregnant|embarazada)\b/.test(t)) c.notPregnant = true;
  else if (/\b(pregnan|embarazada|embarazo|expecting a baby)/.test(noTest)) c.pregnant = true;
  if (c.pregnant && /\b(might|may|could|think|maybe|if|quizas|creo|tal vez)\b.{0,15}\b(pregnan|embarazada)/.test(t)) c.maybePregnant = true;
  // "can't take ibuprofen", "not an nsaid", "no quiero aspirina"
  const avoid = new Set();
  const cant = /\b(cant take|cannot take|can not take|not allowed|told not to take|no puedo tomar)\b/;
  Object.entries(AVOID_WORDS).forEach(([id, words]) => {
    const m = t.replace(/\b(allerg\w+|alergic\w+) (to|a) .*?\bbut not\b.*/, " ").replace(/\bshould i avoid\b/, " ").match(new RegExp(`\\b(cant take|cannot take|can not take|not allowed( to take)?|told not to take|dont want|do not want|dont like|avoid|other than|besides|without|not|no|no puedo tomar|no quiero|sin)( any| an| a| the| to take)? (${words})\\b`));
    if (!m) return;
    // Can't take one NSAID usually means can't take any of them.
    if (id === "nsaid" || (cant.test(m[0]) && NSAID_IDS.includes(id))) NSAID_IDS.forEach((x) => avoid.add(x));
    else avoid.add(id);
  });
  if (avoid.size) c.avoid = [...avoid];
  if (/\b(breastfeed|breast feeding|nursing|lactan|amamant)/.test(t)) c.breastfeeding = true;
  if (/\b(blood thinner|warfarin|warfarina|coumadin|jantoven|pradaxa|dabigatran|brilinta|ticagrelor|effient|prasugrel|savaysa|lovenox|enoxaparin|fragmin|hemophilia|hemofilia|coumadin|eliquis|apixaban|xarelto|rivaroxaban|plavix|clopidogrel|heparin|anticoagul)/.test(t)) c.bloodThinner = true;
  if (/\b(antidepressant|ssri|maoi|sertraline|zoloft|fluoxetine|prozac|escitalopram|lexapro|citalopram|celexa|paroxetine|paxil|phenelzine|selegiline|antidepresivo)/.test(t)) c.antidepressant = true;
  if (/\b(lisinopril|losartan|amlodipine|metoprolol|atenolol|hydrochlorothiazide|hctz|valsartan|carvedilol|enalapril)\b/.test(t)) c.highBP = true;
  if (/\blithium\b|\blitio\b/.test(t)) c.lithium = true;
  if (/\bmethotrexate\b|\bmetotrexato\b/.test(t)) c.methotrexate = true;
  if (/\b(prednisone|prednisolone|steroids?|dexamethasone|methylprednisolone|medrol|esteroides?)\b/.test(t)) c.steroid = true;
  if (/\b(high blood pressure|hypertension|presion alta|hipertension)\b|\bblood pressure (pills?|meds?|medicines?|medications?)\b|\bpastillas? para la presion\b/.test(t)) c.highBP = true;
  if (/\b(kidney|renal|rinon)/.test(t)) c.kidney = true;
  if (/\b(liver|hepat|higado|cirrhosis)/.test(t)) c.liver = true;
  if (/\b(ulcer|stomach bleed|gi bleed|ulcera)/.test(t)) c.ulcer = true;
  if (/\b(alcohol|drinking|drunk|drank|beers?|wines?|liquor|shots|hungover|hangover|cervezas?|vinos?|tragos)\b/.test(t)) c.alcohol = true;
  if (/\b(heart disease|heart condition|heart failure|heart problem)/.test(t)) c.heart = true;
  if (/\b(my |the |our |a )(dog|cat|puppy|kitten|pet)\b|\b(perro|gato|mascota)\b/.test(t) && !/\b(bit|bitten|bite|mordio|mordida)\b/.test(t)) c.pet = true;
  Object.assign(c, findAllergies(t));
  // Medicine brand names people actually say, and conditions in their everyday wording.
  if (/\b(sertralina|fluoxetina|escitalopram|paroxetina|citalopram|antidepresivos?|pristiq|wellbutrin|trazodone|effexor|venlafaxine|cymbalta|duloxetine|an? snri|nardil|parnate|tranylcypromine|emsam)\b/.test(t)) c.antidepressant = true;
  if (/\b(heart failure|afib|a ?fib|atrial fibrillation|heart attack last|had a heart attack|arrhythmia|pacemaker|stent)\b/.test(t)) c.heart = true;
  if (/\b(dialysis)\b/.test(t)) c.kidney = true;
  if (/\b(drink|drinks)\b.{0,15}\b(every day|a day|daily|a night|every night|a lot)\b|\b\d+ drinks\b/.test(t)) c.alcohol = true;
  if (/\bim expecting\b/.test(t)) c.pregnant = true;
  if (/\b(bleeding disorder|bleed easily|bleed a lot|bruise easily)\b/.test(t)) c.bleeding = true;
  if (/\b(chicken ?pox|varicela)\b/.test(t)) c.chickenpox = true;
  if (/\b(nose ?bleeds?|bleeding gums|bruise easily|hemorragia nasal)\b/.test(t) && /\b(keep|always|often|lots of|frequent|daily|every day|a lot)\b/.test(t)) c.bleeding = true;
  if (/\b(gout|gota)\b/.test(t)) c.gout = true;
  if (/\b(crohns?|colitis|ibd|inflammatory bowel)\b/.test(t)) c.ibd = true;
  const labelConds = Object.keys(LABEL_CONDS).filter((k) => LABEL_CONDS[k].re.test(t));
  if (labelConds.length) c.labelConds = labelConds;
  const older = t.match(/\b(?:im|i am|tengo)\s+(\d{2})\b(?! ?(?:mg|f\b|degrees))|\b(\d{2}) ?(?:years?|yr|anos)( |-)?(?:old)?\b/);
  if (older && parseInt(older[1] || older[2], 10) >= 60) c.senior = true;
  // Prescription drugs that change what's safe here.
  if (/\b(oxycodone|oxycontin|hydrocodone|morphine|methadone|tramadol|percocet|norco|vicodin|codeine|ambien|zolpidem|lunesta|xanax|alprazolam|ativan|lorazepam|klonopin|clonazepam|valium|diazepam|seroquel|quetiapine|gabapentin|lyrica|muscle relaxers?|flexeril|sleeping pills?|sedatives?|opioids?)\b/.test(t)) c.sedative = true;
  if (/\b(norco|percocet|vicodin|excedrin|nyquil|tylenol pm|advil dual|theraflu|alka seltzer plus)\b/.test(t)) c.acetOther = true;
  if (/\b(levothyroxine|synthroid|thyroid (pills?|meds?|medicine)|cipro|ciprofloxacin|levofloxacin|doxycycline|tetracycline|digoxin|bisphosphonate|alendronate|fosamax|iron pills?)\b/.test(t)) c.antacidBlock = true;
  if (/\b(long qt|qt prolong\w*|methadone|c ?diff|amiodarone|haldol)\b/.test(t)) c.imodiumBlock = true;
  if (/\b(excedrin|daily aspirin|baby aspirin|aspirin (every day|daily)|aspirin for my heart)\b/.test(t)) c.onAspirin = true;
  // "not on blood thinners", "no kidney problems": mentioned, but the opposite of a risk.
  const NEGATED = { bloodThinner: "blood thinners?|anticoagulants?|anticoagulantes?", highBP: "high blood pressure|hypertension|presion alta", kidney: "kidney (?:problems?|disease)", liver: "liver (?:problems?|disease)", ulcer: "ulcers?", heart: "heart (?:problems?|disease)" };
  Object.entries(NEGATED).forEach(([k, re]) => { if (new RegExp(`\\b(?:not on|not taking|dont take|dont have|do not have|no|never had|sin|no tengo|no tomo)(?: a| any)? (?:${re})\\b`).test(t)) delete c[k]; });
  return c;
}

// Products that are swallowed or sprayed into the body; all are adult-strength (12+) here.
const ORAL_MED_IDS = ["ibuprofen", "acetaminophen", "aspirin", "periodrelief", "antihistamine", "coughdrops", "coldflu", "decongestant", "antacid", "motionsickness", "antidiarrheal", "electrolyte"];
const NSAID_IDS = ["ibuprofen", "aspirin"];
const ACETAMINOPHEN_IDS = ["acetaminophen", "periodrelief", "coldflu"];
const SEDATING_IDS = ["antihistamine", "motionsickness", "periodrelief"];

// Every active ingredient on the shelf. `ids` = products that contain it; `also` = close relatives an
// allergic person should also skip. `re` is matched on safetyNormalize() text (accents stripped).
const ALLERGENS = [
  { key: "aspirin", re: "aspirin|aspirina|bayer", ids: ["aspirin"], also: ["ibuprofen"], name: { en: "aspirin", es: "aspirina" }, what: { en: "a pain reliever and fever reducer. It's an NSAID, and it can cause Reye's syndrome in children and teens.", es: "un analgésico y reductor de fiebre. Es un AINE y puede causar el síndrome de Reye en niños y adolescentes." } },
  { key: "ibuprofen", re: "ibuprofen|ibuprofeno|advil|motrin", ids: ["ibuprofen"], also: ["aspirin"], name: { en: "ibuprofen", es: "ibuprofeno" }, what: { en: "a pain reliever and fever reducer. It's an NSAID, which can cause stomach bleeding.", es: "un analgésico y reductor de fiebre. Es un AINE, que puede causar sangrado estomacal." } },
  { key: "nsaid", re: "nsaids?|aines?|naproxen|naproxeno|aleve|anti inflammator(?:y|ies)|antiinflamatorios?", ids: ["ibuprofen", "aspirin"], name: { en: "NSAIDs", es: "AINE" }, what: { en: "a family of pain relievers that also reduce inflammation. Ibuprofen and aspirin are NSAIDs; acetaminophen isn't.", es: "una familia de analgésicos que también reducen la inflamación. El ibuprofeno y la aspirina son AINE; el acetaminofén no." } },
  { key: "acetaminophen", re: "acetaminophen|acetaminofen|tylenol|paracetamol", ids: ["acetaminophen", "periodrelief", "coldflu"], name: { en: "acetaminophen", es: "acetaminofén" }, what: { en: "a pain reliever and fever reducer. It isn't an NSAID. Too much can cause severe liver damage, and several products contain it.", es: "un analgésico y reductor de fiebre. No es un AINE. Demasiado puede causar daño grave al hígado, y varios productos lo contienen." } },
  { key: "diphenhydramine", re: "diphenhydramine|difenhidramina|benadryl", ids: ["antihistamine", "motionsickness"], name: { en: "diphenhydramine", es: "difenhidramina" }, what: { en: "an antihistamine for allergy symptoms. It can make you very drowsy.", es: "un antihistamínico para síntomas de alergia. Puede dar mucho sueño." } },
  { key: "dimenhydrinate", re: "dimenhydrinate|dimenhidrinato|dramamine", ids: ["motionsickness"], also: ["antihistamine"], name: { en: "dimenhydrinate", es: "dimenhidrinato" }, what: { en: "a motion-sickness medicine that contains diphenhydramine, so it can make you very drowsy.", es: "un medicamento para el mareo que contiene difenhidramina, así que puede dar mucho sueño." } },
  { key: "antihistamines", re: "antihistamines?|antihistaminicos?", ids: ["antihistamine", "motionsickness", "periodrelief"], name: { en: "antihistamines", es: "antihistamínicos" }, what: { en: "medicines that block histamine to ease allergy symptoms. Many of them cause drowsiness.", es: "medicamentos que bloquean la histamina para aliviar la alergia. Muchos dan sueño." } },
  { key: "pyrilamine", re: "pyrilamine|pirilamina", ids: ["periodrelief"], name: { en: "pyrilamine", es: "pirilamina" }, what: { en: "an antihistamine used in period-symptom products. It can cause drowsiness.", es: "un antihistamínico usado en productos para síntomas menstruales. Puede dar sueño." } },
  { key: "pamabrom", re: "pamabrom", ids: ["periodrelief"], name: { en: "pamabrom", es: "pamabrom" }, what: { en: "a mild diuretic that helps with bloating and water weight around your period.", es: "un diurético suave que ayuda con la hinchazón y la retención de líquidos durante la menstruación." } },
  { key: "dextromethorphan", re: "dextromethorphan|dextrometorfano|robitussin|delsym", ids: ["coldflu"], name: { en: "dextromethorphan", es: "dextrometorfano" }, what: { en: "a cough suppressant. It's why this kiosk asks for ID, and it must not be mixed with MAOI antidepressants.", es: "un supresor de la tos. Por eso este quiosco pide identificación, y no debe mezclarse con antidepresivos IMAO." } },
  { key: "phenylephrine", re: "phenylephrine|fenilefrina", ids: ["coldflu"], name: { en: "phenylephrine", es: "fenilefrina" }, what: { en: "an oral decongestant. It can raise blood pressure.", es: "un descongestionante oral. Puede subir la presión arterial." } },
  { key: "oxymetazoline", re: "oxymetazoline|oximetazolina|afrin", ids: ["decongestant"], name: { en: "oxymetazoline", es: "oximetazolina" }, what: { en: "a nasal decongestant spray. Using it more than 3 days can make congestion worse.", es: "un descongestionante nasal en aerosol. Usarlo más de 3 días puede empeorar la congestión." } },
  { key: "decongestants", re: "decongestants?|descongestionantes?", ids: ["coldflu", "decongestant"], name: { en: "decongestants", es: "descongestionantes" }, what: { en: "medicines that shrink swollen nasal passages. They can raise blood pressure.", es: "medicamentos que reducen la hinchazón nasal. Pueden subir la presión arterial." } },
  { key: "loperamide", re: "loperamide|loperamida|imodium", ids: ["antidiarrheal"], name: { en: "loperamide", es: "loperamida" }, what: { en: "an anti-diarrheal that slows the gut. Taking more than directed can cause serious heart problems.", es: "un antidiarreico que hace más lento el intestino. Tomar más de lo indicado puede causar problemas graves del corazón." } },
  { key: "calcium", re: "calcium carbonate|carbonato de calcio|tums|antacids?|antiacidos?", ids: ["antacid"], name: { en: "calcium carbonate", es: "carbonato de calcio" }, what: { en: "an antacid that neutralizes stomach acid. It can interact with some prescription drugs.", es: "un antiácido que neutraliza el ácido del estómago. Puede interactuar con algunos medicamentos con receta." } },
  { key: "menthol", re: "menthol|mentol|mint|menta|peppermint", ids: ["patch", "coughdrops"], name: { en: "menthol", es: "mentol" }, what: { en: "a cooling compound from mint, used in pain patches and throat drops.", es: "un compuesto refrescante de la menta, usado en parches para el dolor y pastillas para la garganta." } },
  { key: "bacitracin", re: "bacitracin|bacitracina|neosporin|antibiotic ointment|unguento antibiotico", ids: ["ointment"], name: { en: "bacitracin", es: "bacitracina" }, what: { en: "an antibiotic you put on the skin to help prevent infection in minor wounds.", es: "un antibiótico que se aplica en la piel para ayudar a prevenir infecciones en heridas menores." } },
  { key: "neomycin", re: "neomycin|neomicina|polymyxin b?|polimixina b?", ids: ["ointment"], name: { en: "neomycin and polymyxin", es: "neomicina y polimixina" }, what: { en: "antibiotics you put on the skin, found in Neosporin. Neomycin is a fairly common cause of skin allergy.", es: "antibióticos que se aplican en la piel, presentes en Neosporin. La neomicina es una causa bastante común de alergia en la piel." } },
  { key: "homosalate", re: "homosalate|homosalato|octocrylene|octocrileno", ids: ["sunscreen"], name: { en: "homosalate and octocrylene", es: "homosalato y octocrileno" }, what: { en: "sunscreen ingredients that absorb UV light.", es: "ingredientes de protector solar que absorben la luz UV." } },
  { key: "avobenzone", re: "avobenzone|avobenzona", ids: ["sunscreen"], name: { en: "avobenzone", es: "avobenzona" }, what: { en: "a sunscreen ingredient that absorbs UV light.", es: "un ingrediente de protector solar que absorbe la luz UV." } },
  { key: "octisalate", re: "octisalate|octisalato", ids: ["sunscreen"], name: { en: "octisalate", es: "octisalato" }, what: { en: "a sunscreen ingredient that absorbs UV light. It's a salicylate.", es: "un ingrediente de protector solar que absorbe la luz UV. Es un salicilato." } },
  { key: "salicylates", re: "salicylates?|salicilatos?", ids: ["aspirin", "sunscreen"], name: { en: "salicylates", es: "salicilatos" }, what: { en: "a chemical family that includes aspirin and the sunscreen ingredient octisalate.", es: "una familia química que incluye la aspirina y el octisalato del protector solar." } },
  { key: "alcohol", re: "ethyl alcohol|ethanol|etanol|alcohol etilico|hand sanitizer|desinfectante de manos", ids: ["sanitizer"], name: { en: "ethyl alcohol", es: "alcohol etílico" }, what: { en: "the germ-killing alcohol in hand sanitizer. It's flammable and for external use only.", es: "el alcohol que mata gérmenes en el desinfectante de manos. Es inflamable y solo para uso externo." } },
  { key: "adhesive", re: "adhesives?|adhesivos?|medical tape|cinta adhesiva", ids: ["bandaid", "gauze", "patch", "heatpatch"], name: { en: "adhesive", es: "adhesivo" } },
  { key: "painrelievers", re: "(?:all )?pain (?:medicines?|medications?|meds|relievers?|killers?)|analgesicos?", ids: ["ibuprofen", "acetaminophen", "aspirin", "periodrelief", "coldflu"], name: { en: "pain relievers", es: "analgésicos" } },
  { key: "sunscreen", re: "sunscreens?|sunblock|protector solar", ids: ["sunscreen"], name: { en: "sunscreen", es: "protector solar" } },
  { key: "coughdrops", re: "cough drops?|lozenges?|pastillas para la tos", ids: ["coughdrops"], name: { en: "cough drops", es: "pastillas para la tos" } },
];
// No data on these: inactive ingredients aren't in the catalog, so they can only ever get an honest "check the package".
const INACTIVE_ALLERGENS = "peanuts?|tree nuts?|nuts|gluten|wheat|lactose|dairy|milk|soy|eggs?|shellfish|fish|corn|red dye|dyes?|food coloring|sulfites?|fragrances?|perfumes?|parabens?|lanolin|cacahuates?|mani|nueces|lactosa|lacteos|leche|soja|huevos?|mariscos|maiz|colorantes?|trigo";
const DRUG_ALLERGENS = { penicillin: "penicillin|amoxicillin|penicilina|amoxicilina", sulfa: "sulfa|sulfonamides?", codeine: "codeine|morphine|opioids?|codeina|morfina", iodine: "iodine|yodo", latex: "latex" };
const ENV_ALLERGENS = /\b(cats?|dogs?|pets?|pollen|dust|mold|grass|trees?|bees?|wasps?|polen|polvo|gatos?|perros?|moho|abejas?)\b/;
const ALLERGEN_WORDS = [...ALLERGENS.map((e) => e.re), INACTIVE_ALLERGENS, ...Object.values(DRUG_ALLERGENS)].join("|");

// "allergic to aspirin and tylenol", "peanut allergy", "benadryl gives me hives", "alérgica a la aspirina"
function findAllergies(text) {
  const t = text.replace(/\bbenadryl allergy \d+ ?mg\b/g, "benadryl").replace(/\b(?:not|arent|wasnt|no soy|no estoy)\s+(?:allergic|alergic[oa])\s+(?:to|a|al)\s+\w+(?: \w+)?/g, " ");
  const segments = [];
  for (const m of t.matchAll(/\b(?:allergic|alergic[oa]|allergy|allergies|alergia|alergias|intolerant|sensitive|reaction|reacted|react)\s+(?:to|a|al|with)\s+([^.;?!]*)/g))
    segments.push(m[1].split(/,?\s+(?:what|whats|can|could|is|are|do|does|should|so|but|for|i|and i|y tengo|tengo|que|puedo|necesito|how|if|when|because)\b/)[0]);
  for (const m of t.matchAll(new RegExp(`\\b(${ALLERGEN_WORDS})\\s+(?:allergy|allergies|alergia|intolerance|sensitivity|gives me (?:hives|a rash)|makes me (?:break out|swell|itch)|makes? my \\w+ worse)\\b`, "g"))) segments.push(m[1]);
  for (const m of t.matchAll(new RegExp(`\\b(?:hives|rash|rashes|ronchas|swelling) (?:from|with|after|con|por) (${ALLERGEN_WORDS})\\b`, "g"))) segments.push(m[1]);
  const W = `(${ALLERGEN_WORDS})`;
  for (const re of [
    `\\b(?:cant have|cannot have|broke? out|break out|breaking out|swell up|swelled up|swelling)\\s+(?:from|with|after|on|to)?\\s*${W}\\b`,
    `\\breact\\w* (?:badly|poorly|bad)\\s+(?:to|with)\\s+${W}\\b`,
    `\\b${W}\\s+(?:makes?|made|gives?|gave)\\s+me\\s+(?:\\w+ )?(?:swell|break|rash|hives|itch)\\w*`,
    `\\b(?:took|take|had)\\s+${W}\\b.{0,12}\\bmy (?:face|lips?|throat|tongue|eyes?)\\b.{0,8}\\b(?:swell|swole|swollen)`,
  ]) for (const m of t.matchAll(new RegExp(re, "g"))) segments.push(m[1]);
  // "aspirin doesn't agree with me, allergic actually" / "allergic: aspirin"
  if (!segments.length && /\b(allergic|alergic[oa])\b/.test(t) && !/^(does|do|is|are|what|which|can|will|how|que)\b/.test(t)) for (const m of t.matchAll(new RegExp(`\\b${W}\\b`, "g"))) segments.push(m[1]);
  if (!segments.length) return {};
  const joined = segments.join(" , "), out = {};
  const hits = (re) => new RegExp(`\\b(?:${re})\\b`).test(joined);
  const allergies = ALLERGENS.filter((e) => hits(e.re)).map((e) => e.key);
  const inactive = [...new Set(joined.match(new RegExp(`\\b(?:${INACTIVE_ALLERGENS})\\b`, "g")) || [])];
  const drugs = Object.keys(DRUG_ALLERGENS).filter((k) => hits(DRUG_ALLERGENS[k]));
  if (/\b(everything|all (?:medicines?|meds|medications?)|todo|todos los medicamentos)\b/.test(joined)) { out.allergy = true; out.allergyAll = true; return out; }
  if (allergies.length) out.allergies = allergies;
  if (inactive.length) out.allergyInactive = inactive;
  if (drugs.length) out.allergyDrugs = drugs;
  if (allergies.length || inactive.length || drugs.length) out.allergy = true;
  else if (!ENV_ALLERGENS.test(joined) && joined.trim().split(" ").length <= 4 && joined.trim()) { out.allergy = true; out.allergyOther = joined.trim(); }
  return out;
}

const LABEL_CONDS = {
  glaucoma: { re: /\bglaucoma\b/, label: /glaucoma/i, en: "glaucoma", es: "glaucoma" },
  prostate: { re: /\b(prostate|prostata|trouble urinating|bph)\b/, label: /prostate/i, en: "an enlarged prostate", es: "agrandamiento de la próstata" },
  breathing: { re: /\b(emphysema|chronic bronchitis|copd|enfisema|bronquitis|breathing problem)\b/, label: /breathing problem/i, en: "a breathing problem", es: "un problema respiratorio" },
  diabetes: { re: /\b(diabetes|diabetic|diabetico|diabetica)\b/, label: /diabetes/i, en: "diabetes", es: "diabetes" },
  thyroid: { re: /\b(thyroid|tiroides|hyperthyroid\w*|hypothyroid\w*|graves)\b/, label: /thyroid/i, en: "thyroid disease", es: "enfermedad de la tiroides" },
  asthma: { re: /\b(asthma|asma|asthmatic|asmatico)\b/, label: /asthma/i, en: "asthma", es: "asma" },
};

const AVOID_WORDS = {
  ibuprofen: "ibuprofen|ibuprofeno|advil|motrin", acetaminophen: "acetaminophen|acetaminofen|tylenol|paracetamol", aspirin: "aspirin|aspirina|bayer",
  antihistamine: "benadryl|antihistamines?|antihistaminicos?|diphenhydramine", nsaid: "nsaids?|aines?|anti inflammator(y|ies)",
};

function hasConditions(c) { return Object.keys(c).length > 0; }

// [{ en, es }] reasons this product shouldn't be suggested to someone with these conditions.
function productConflicts(p, c) {
  const out = [];
  const add = (en, es) => out.push({ en, es });
  if (c.avoid && c.avoid.includes(p.id)) add("you asked me to leave it out", "usted pidió dejarlo fuera");
  if (c.allergyAll && ORAL_MED_IDS.includes(p.id)) add("you said you react to all medicines", "dijo que reacciona a todos los medicamentos");
  // Conditions the product's own label tells people to ask a doctor about.
  const label = p._en || p;
  [["liver", /liver disease/i, "liver disease", "enfermedad del hígado"], ["highBP", /high blood pressure/i, "high blood pressure", "presión arterial alta"], ["heart", /heart disease/i, "heart disease", "enfermedad del corazón"], ["kidney", /kidney disease/i, "kidney disease", "enfermedad de los riñones"]]
    .forEach(([k, re, en, es]) => { if (c[k] && re.test(label.warnings)) add(`its label says to ask a doctor first if you have ${en}`, `su etiqueta dice que consulte a un médico si tiene ${es}`); });
  (c.labelConds || []).forEach((k) => { const lc = LABEL_CONDS[k]; if (lc.label.test(`${label.warnings} ${label.allergyAlert}`)) add(`its label says to ask a doctor first if you have ${lc.en}`, `su etiqueta dice que consulte a un médico si tiene ${lc.es}`); });
  if (c.ibd && NSAID_IDS.includes(p.id)) add("NSAIDs can trigger bowel flare-ups, so ask your doctor first", "los AINE pueden provocar brotes intestinales; consulte a su médico primero");
  if (c.bleeding && NSAID_IDS.includes(p.id)) add("NSAIDs can make bleeding worse", "los AINE pueden empeorar el sangrado");
  if (c.gout && p.id === "aspirin") add("aspirin can make gout worse, so ask a doctor first", "la aspirina puede empeorar la gota; consulte a un médico primero");
  if (c.chickenpox && NSAID_IDS.includes(p.id)) add("doctors advise against NSAIDs during chickenpox, so ask one first", "los médicos desaconsejan los AINE durante la varicela; consulte a uno primero");
  if (c.sedative && ["antihistamine", "motionsickness", "periodrelief"].includes(p.id)) add("it adds to the sedation from your other medicine and can slow breathing", "se suma a la sedación de su otro medicamento y puede hacer lenta la respiración");
  if (c.acetOther && ["acetaminophen", "periodrelief", "coldflu"].includes(p.id)) add("what you take already has acetaminophen, and doubling up can cause liver failure", "lo que toma ya contiene acetaminofén, y duplicarlo puede causar insuficiencia hepática");
  if (c.antacidBlock && p.id === "antacid") add("it can stop your other medicine from absorbing, so ask a pharmacist how far apart to take them", "puede impedir que su otro medicamento se absorba; pregunte a un farmacéutico cuánto separarlos");
  if (c.imodiumBlock && p.id === "antidiarrheal") add("it can be dangerous with that, so don't use it without a doctor", "puede ser peligroso con eso; no lo use sin un médico");
  if (c.onAspirin && p.id === "ibuprofen") add("ibuprofen can block aspirin's heart protection and raises bleeding risk, so ask a pharmacist", "el ibuprofeno puede bloquear la protección de la aspirina y aumenta el riesgo de sangrado; consulte a un farmacéutico");
  if (c.senior && NSAID_IDS.includes(p.id)) add("its label warns of higher stomach-bleeding risk at 60 or older", "su etiqueta advierte mayor riesgo de sangrado estomacal a partir de los 60 años");
  (c.allergies || []).forEach((key) => {
    const e = ALLERGENS.find((x) => x.key === key);
    if (e && (e.ids.includes(p.id) || (e.also || []).includes(p.id))) add(`it contains or is related to ${e.name.en}, which you're allergic to`, `contiene o está relacionado con ${e.name.es}, a lo que usted es alérgico`);
  });
  if (c.pet && ORAL_MED_IDS.includes(p.id)) add("human medicines can poison pets — call a veterinarian", "los medicamentos para personas pueden envenenar a las mascotas — llame a un veterinario");
  // Minimum ages come from each label's directions; an unstated age gets the strictest answer.
  const labelAge = (((p._en || p).instructions || "").match(/children (\d+) years and over/i) || [])[1];
  const minAge = labelAge ? +labelAge : ({ coughdrops: 5, electrolyte: 1 }[p.id] || (ORAL_MED_IDS.includes(p.id) ? 12 : 0));
  if (c.age !== undefined && minAge && (c.age < minAge || (c.ageUnknown && ORAL_MED_IDS.includes(p.id) && p.id !== "electrolyte"))) add(`its label is for ages ${minAge} and over`, `su etiqueta es para mayores de ${minAge} años`);
  if (c.age !== undefined && c.age < 19 && p.id === "aspirin") add("aspirin can cause Reye's syndrome in children and teens", "la aspirina puede causar el síndrome de Reye en niños y adolescentes");
  if (NSAID_IDS.includes(p.id)) {
    if (c.bloodThinner) add("NSAIDs with a blood thinner raise the risk of serious bleeding", "los AINE con un anticoagulante aumentan el riesgo de sangrado grave");
    if (c.pregnant) add("NSAIDs can harm the baby, especially late in pregnancy", "los AINE pueden dañar al bebé, sobre todo al final del embarazo");
    if (c.kidney) add("NSAIDs can worsen kidney problems", "los AINE pueden empeorar problemas de riñón");
    if (c.ulcer) add("NSAIDs can cause stomach bleeding", "los AINE pueden causar sangrado estomacal");
    if (c.highBP || c.heart) add("NSAIDs can raise blood pressure and heart risk", "los AINE pueden subir la presión y el riesgo cardíaco");
    if (c.alcohol) add("NSAIDs with alcohol raise the risk of stomach bleeding", "los AINE con alcohol aumentan el riesgo de sangrado estomacal");
    if (c.lithium) add("NSAIDs can raise lithium to dangerous levels", "los AINE pueden subir el litio a niveles peligrosos");
    if (c.methotrexate) add("NSAIDs can make methotrexate toxic", "los AINE pueden volver tóxico el metotrexato");
    if (c.steroid) add("NSAIDs with steroids raise the risk of stomach bleeding", "los AINE con esteroides aumentan el riesgo de sangrado estomacal");
  }
  if (ACETAMINOPHEN_IDS.includes(p.id)) {
    if (c.liver) add("acetaminophen can cause liver damage", "el acetaminofén puede causar daño hepático");
    if (c.alcohol) add("acetaminophen with alcohol can cause liver damage", "el acetaminofén con alcohol puede causar daño hepático");
  }
  if (p.id === "coldflu" && c.antidepressant) add("dextromethorphan with antidepressants (MAOIs/SSRIs) can cause a dangerous reaction", "el dextrometorfano con antidepresivos (IMAO/ISRS) puede causar una reacción peligrosa");
  if ((p.id === "coldflu" || p.id === "decongestant") && (c.highBP || c.heart)) add("decongestants can raise blood pressure", "los descongestionantes pueden subir la presión");
  if (SEDATING_IDS.includes(p.id) && c.alcohol) add("it causes drowsiness, and alcohol makes that worse", "causa somnolencia y el alcohol la empeora");
  if ((c.pregnant || c.breastfeeding) && ORAL_MED_IDS.includes(p.id) && !NSAID_IDS.includes(p.id) && !["electrolyte", "antacid", "coughdrops"].includes(p.id)) add("ask a pharmacist or doctor before using it while pregnant or nursing", "consulte a un farmacéutico o médico antes de usarlo durante el embarazo o la lactancia");
  return out;
}

if (typeof module !== "undefined") module.exports = { safetyNormalize, redFlag, detectConditions, productConflicts, hasConditions, ORAL_MED_IDS, ALLERGENS };
