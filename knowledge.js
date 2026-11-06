// Knowledge base for the AI Assistant (assistant.js). Fully offline.
//
// HEALTH_TOPICS: general, widely published first-aid / self-care guidance.
// The thresholds and steps below were checked against public guidance from
// the American Red Cross, Mayo Clinic, MedlinePlus, the CDC, and the federal
// Poison Help line site. They are deliberately conservative, short, and
// always paired with "get medical help if…" red flags. This is general
// information, never a diagnosis — the assistant says so every time.
//
// KIOSK_FAQ: facts about this machine, taken from what the app actually does.
//
// `triggers` are English phrases matched against the (accent-stripped,
// Spanish→English-normalized) message, so one list serves both languages.

const HEALTH_TOPICS = [
  {
    id: "cut",
    triggers: ["cut", "cuts", "scrape", "scrapes", "scratch", "graze", "paper cut", "small cut", "minor cut", "wound", "bleeding cut"],
    title: { en: "Minor cuts & scrapes", es: "Cortes y raspones leves" },
    steps: {
      en: [
        "Wash your hands, then press gently on the cut with a clean cloth or bandage until bleeding stops.",
        "Rinse the wound with clean running water and wash around it with soap (keep soap out of the wound). Skip hydrogen peroxide and iodine — they can irritate.",
        "Dab on a thin layer of antibiotic ointment, then cover with a bandage or gauze.",
        "Change the dressing daily, or whenever it gets wet or dirty.",
      ],
      es: [
        "Lávese las manos y presione suavemente la cortada con un paño limpio o una venda hasta que deje de sangrar.",
        "Enjuague la herida con agua corriente limpia y lave alrededor con jabón (sin meter jabón en la herida). Evite el agua oxigenada y el yodo — pueden irritar.",
        "Aplique una capa fina de pomada antibiótica y cubra con una venda o gasa.",
        "Cambie el vendaje a diario, o cuando se moje o ensucie.",
      ],
    },
    seek: {
      en: "the cut is deep (more than about ¼ inch), on the face, or you can see bone; bleeding won't stop after firm pressure; you can't get all the dirt out; it later gets red, swollen, or starts oozing pus, or you get a fever; or your last tetanus shot was over 10 years ago (5 years if the wound is deep or dirty).",
      es: "la cortada es profunda (más de aproximadamente ¼ de pulgada), está en la cara, o se ve el hueso; el sangrado no para con presión firme; no puede sacar toda la suciedad; luego se pone roja, hinchada o supura pus, o le da fiebre; o su última vacuna contra el tétanos fue hace más de 10 años (5 años si la herida es profunda o está sucia).",
    },
    products: ["bandaid", "ointment", "gauze"],
  },
  {
    id: "burn",
    triggers: ["burn", "burned", "burnt", "scald", "scalded", "burned myself", "hot water burn", "touched something hot"],
    title: { en: "Minor burns", es: "Quemaduras leves" },
    steps: {
      en: [
        "Cool the burn right away under cool (not ice-cold) running water for about 10–20 minutes.",
        "Take off rings or tight items near the burn before it swells.",
        "Don't use ice, butter, or oils, and don't pop blisters.",
        "Ask the staff before you take any medicine, or eat or drink anything.",
      ],
      es: [
        "Enfríe la quemadura de inmediato bajo agua corriente fresca (no helada) durante unos 10–20 minutos.",
        "Quítese anillos u objetos apretados cerca de la quemadura antes de que se hinche.",
        "No use hielo, mantequilla ni aceites, y no reviente las ampollas.",
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
      ],
    },
    seek: {
      en: "the burn is bigger than about 3 inches, covers a large area, or is on the face, hands, feet, groin, buttocks, or a major joint; it's from chemicals or electricity; the skin looks white, leathery or charred (call 911); or you see signs of infection later.",
      es: "la quemadura es mayor de unas 3 pulgadas, cubre un área grande, o está en la cara, manos, pies, ingle, glúteos o una articulación grande; fue por químicos o electricidad; la piel se ve blanca, acartonada o carbonizada (llame al 911); o luego hay señales de infección.",
    },
    products: ["gauze", "ointment"],
  },
  {
    id: "sunburn",
    triggers: ["sunburn", "sun burn", "sunburned", "too much sun", "burned in the sun"],
    title: { en: "Sunburn", es: "Quemadura de sol" },
    steps: {
      en: [
        "Get out of the sun. Cool the skin with a cool shower or cool damp cloths.",
        "Ask the staff before you take any medicine, or eat or drink anything.",
        "Next time: sunscreen 15 minutes before going out, and reapply every 2 hours.",
      ],
      es: [
        "Salga del sol. Enfríe la piel con una ducha fresca o paños húmedos y frescos.",
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
        "La próxima vez: protector solar 15 minutos antes de salir, y vuelva a aplicarlo cada 2 horas.",
      ],
    },
    seek: {
      en: "you have blisters over a large area, fever or chills, severe pain, dizziness, or signs of dehydration.",
      es: "tiene ampollas en un área grande, fiebre o escalofríos, dolor intenso, mareo o señales de deshidratación.",
    },
    products: ["sunscreen"], medsAtDesk: true,
  },
  {
    id: "sprain",
    triggers: ["sprain", "sprained", "twisted ankle", "rolled ankle", "rolled my ankle", "strain", "pulled muscle", "bruise", "bruised", "swelling", "swollen ankle", "swollen", "sports injury"],
    title: { en: "Sprains, strains & bruises", es: "Esguinces, distensiones y moretones" },
    steps: {
      en: [
        "Rest the area and avoid putting weight on it.",
        "Ice it for 15–20 minutes at a time, several times a day for the first 48 hours, with a thin towel between the ice and your skin.",
        "Compress with an elastic wrap (snug, not tight) and keep the area raised above heart level when you can.",
        "Ask the staff before you take any medicine, or eat or drink anything.",
      ],
      es: [
        "Descanse la zona y evite apoyar peso sobre ella.",
        "Aplique hielo durante 15–20 minutos a la vez, varias veces al día durante las primeras 48 horas, con una toalla delgada entre el hielo y la piel.",
        "Comprima con una venda elástica (firme, no apretada) y mantenga la zona elevada por encima del corazón cuando pueda.",
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
      ],
    },
    seek: {
      en: "you can't put weight on it, the joint feels unstable or numb, it looks out of shape, there's no improvement after about a week, or colored streaks spread from the area.",
      es: "no puede apoyar peso, la articulación se siente inestable o adormecida, se ve deformada, no mejora después de una semana, o salen rayas de color desde la zona.",
    },
    products: ["coldpack", "patch"], medsAtDesk: true,
  },
  {
    id: "nosebleed",
    triggers: ["nosebleed", "nose bleed", "nose bleeding", "bloody nose", "my nose is bleeding"],
    title: { en: "Nosebleed", es: "Sangrado nasal" },
    steps: {
      en: [
        "Sit up and lean forward (not back) so blood doesn't run down your throat.",
        "Pinch the soft part of your nose firmly and breathe through your mouth for 10–15 minutes without letting go to check.",
        "If it's still bleeding, pinch again for another 10–15 minutes.",
      ],
      es: [
        "Siéntese y inclínese hacia adelante (no hacia atrás) para que la sangre no baje por la garganta.",
        "Apriete firmemente la parte blanda de la nariz y respire por la boca durante 10–15 minutos sin soltar para revisar.",
        "Si sigue sangrando, apriete de nuevo otros 10–15 minutos.",
      ],
    },
    seek: {
      en: "it still hasn't stopped after 30 minutes or two tries, it followed an injury, you're losing a lot of blood, or it's hard to breathe.",
      es: "no ha parado después de 30 minutos o dos intentos, ocurrió tras una lesión, pierde mucha sangre, o le cuesta respirar.",
    },
    products: ["gauze"],
  },
  {
    id: "fever",
    triggers: ["fever", "temperature", "feverish", "chills", "running a fever", "high temperature", "burning up"],
    title: { en: "Fever", es: "Fiebre" },
    steps: {
      en: [
        "Ask the staff before you take any medicine, or eat or drink anything.",
      ],
      es: [
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
      ],
    },
    seek: {
      en: "an adult's temperature is 103°F (39.4°C) or higher, or the fever lasts more than 3 days; there's trouble breathing, chest pain, a bad headache or stiff neck, confusion, belly pain, repeated vomiting, a rash, or signs of dehydration. For a baby, any fever in an infant under 3 months needs a doctor right away.",
      es: "la temperatura de un adulto es de 103°F (39.4°C) o más, o la fiebre dura más de 3 días; hay dificultad para respirar, dolor de pecho, dolor de cabeza fuerte o rigidez de cuello, confusión, dolor abdominal, vómitos repetidos, sarpullido o señales de deshidratación. En un bebé, cualquier fiebre en menores de 3 meses requiere atención médica de inmediato.",
    },
    products: [], medsAtDesk: true,
  },
  {
    id: "headache",
    triggers: ["headache", "head ache", "head hurts", "migraine", "head pounding", "my head hurts", "head is pounding"],
    title: { en: "Headache", es: "Dolor de cabeza" },
    steps: {
      en: [
        "Ask the staff before you take any medicine, or eat or drink anything.",
      ],
      es: [
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
      ],
    },
    seek: {
      en: "it's sudden and severe (\"the worst headache of your life\") or follows a head injury; or comes with confusion, a stiff neck with fever, weakness, numbness, vision or speech trouble — call 911 for those.",
      es: "es repentino y muy intenso (\"el peor dolor de cabeza de su vida\") o sigue a un golpe en la cabeza; o viene con confusión, rigidez de cuello con fiebre, debilidad, adormecimiento, problemas de visión o del habla — llame al 911 en esos casos.",
    },
    products: [], medsAtDesk: true,
  },
  {
    id: "sorethroat",
    triggers: ["sore throat", "throat hurts", "scratchy throat", "throat pain", "strep", "tonsils"],
    title: { en: "Sore throat", es: "Dolor de garganta" },
    steps: {
      en: [
        "Ask the staff before you take any medicine, or eat or drink anything.",
      ],
      es: [
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
      ],
    },
    seek: {
      en: "you have trouble breathing or swallowing or are drooling, the fever is above 101°F, or it lasts more than a week.",
      es: "tiene dificultad para respirar o tragar o babea, la fiebre es de más de 101°F, o dura más de una semana.",
    },
    products: [], medsAtDesk: true,
  },
  {
    id: "coldcough",
    triggers: ["cough", "coughing", "cold", "common cold", "flu", "nose wont stop running", "nose is running", "runny nose", "stuffy nose", "congestion", "congested", "sneezing", "sinus"],
    title: { en: "Cold, cough & congestion", es: "Resfriado, tos y congestión" },
    steps: {
      en: [
        "Ask the staff before you take any medicine, or eat or drink anything.",
        "Wash your hands often and cover coughs to avoid spreading it.",
      ],
      es: [
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
        "Lávese las manos con frecuencia y cúbrase al toser para no contagiar.",
      ],
    },
    seek: {
      en: "you have shortness of breath, wheezing, chest pain, a high fever, or you cough up blood (call 911 for trouble breathing or coughing blood); or symptoms last more than about 10 days or get worse after improving.",
      es: "tiene falta de aire, silbidos al respirar, dolor de pecho, fiebre alta, o tose con sangre (llame al 911 si le cuesta respirar o tose sangre); o los síntomas duran más de unos 10 días o empeoran después de mejorar.",
    },
    products: ["decongestant"], medsAtDesk: true,
  },
  {
    id: "allergy",
    triggers: ["allergy", "allergies", "allergic", "hay fever", "hives", "itchy eyes", "seasonal allergies", "pollen", "sneezing allergy", "itching"],
    title: { en: "Mild allergies", es: "Alergias leves" },
    steps: {
      en: [
        "Avoid the trigger if you know it (pollen, pets, dust) and rinse off after being outdoors.",
        "Ask the staff before you take any medicine, or eat or drink anything.",
      ],
      es: [
        "Evite el desencadenante si lo conoce (polen, mascotas, polvo) y lávese después de estar afuera.",
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
      ],
    },
    seek: {
      en: "you have trouble breathing, swelling of the lips, face, eyelids or throat, dizziness or fainting, a weak fast pulse, or vomiting after exposure — that can be anaphylaxis: call 911 right away, even if it's just one or two of these.",
      es: "tiene dificultad para respirar, hinchazón de labios, cara, párpados o garganta, mareo o desmayo, pulso débil y rápido, o vómito tras la exposición — puede ser anafilaxia: llame al 911 de inmediato, aunque sea solo uno o dos de estos síntomas.",
    },
    products: [], medsAtDesk: true,
  },
  {
    id: "stomach",
    triggers: ["threw up", "throw up", "vomited", "puking", "puked", "upset stomach", "stomach ache", "stomachache", "nausea", "nauseous", "queasy", "vomiting", "throwing up", "indigestion", "heartburn", "acid reflux", "bloated", "gas", "sour stomach", "belly ache", "stomach pain"],
    title: { en: "Upset stomach, nausea & heartburn", es: "Malestar estomacal, náuseas y acidez" },
    steps: {
      en: [
        "Ask the staff before you take any medicine, or eat or drink anything.",
      ],
      es: [
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
      ],
    },
    seek: {
      en: "you have severe belly pain, vomit blood or have black or bloody stools, can't keep fluids down, or vomiting lasts more than a day (or you show signs of dehydration).",
      es: "tiene dolor abdominal intenso, vomita sangre o tiene heces negras o con sangre, no retiene líquidos, o el vómito dura más de un día (o hay señales de deshidratación).",
    },
    products: [], medsAtDesk: true,
  },
  {
    id: "diarrhea",
    triggers: ["diarrhea", "diarrhoea", "loose stools", "runs", "stomach bug", "food poisoning mild"],
    title: { en: "Diarrhea", es: "Diarrea" },
    steps: {
      en: [
        "Ask the staff before you take any medicine, or eat or drink anything.",
        "An anti-diarrheal can help adults — follow the label, and don't use it if you have bloody or black stool without asking a doctor.",
      ],
      es: [
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
        "Ask the staff before you take any medicine, or eat or drink anything.",
        "Un antidiarreico puede ayudar a los adultos — siga la etiqueta, y no lo use si tiene heces con sangre o negras sin consultar a un médico.",
      ],
    },
    seek: {
      en: "it lasts more than a couple of days (sooner for young children or older adults), you have a fever above 102°F, bloody or black stools, severe belly pain, or signs of dehydration (very dry mouth, little urine, dizziness).",
      es: "dura más de un par de días (antes en niños pequeños o adultos mayores), tiene fiebre de más de 102°F, heces con sangre o negras, dolor abdominal intenso, o señales de deshidratación (boca muy seca, poca orina, mareo).",
    },
    products: [], medsAtDesk: true,
  },
  {
    id: "heat",
    triggers: ["dehydrated", "dehydration", "heat exhaustion", "heatstroke", "heat stroke", "overheated", "too hot", "dizzy in the heat", "sweating a lot", "heat wave", "hot weather", "very thirsty"],
    title: { en: "Dehydration & heat exhaustion", es: "Deshidratación y agotamiento por calor" },
    steps: {
      en: [
        "Get out of the heat into shade or air conditioning, and lie down with your legs slightly raised.",
        "Ask the staff before you take any medicine, or eat or drink anything.",
      ],
      es: [
        "Salga del calor hacia la sombra o el aire acondicionado, y acuéstese con las piernas ligeramente elevadas.",
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
      ],
    },
    seek: {
      en: "the person is confused, agitated, faints, has a seizure, can't drink, vomits, or has a body temperature of 104°F or more — that may be heatstroke: call 911. Also seek care if they don't improve.",
      es: "la persona está confundida, agitada, se desmaya, convulsiona, no puede beber, vomita, o tiene temperatura corporal de 104°F o más — puede ser un golpe de calor: llame al 911. También busque atención si no mejora.",
    },
    products: ["coldpack"], medsAtDesk: true,
  },
  {
    id: "sting",
    triggers: ["insect bite", "bug bite", "bee sting", "wasp sting", "sting", "stung", "mosquito bite", "spider bite", "bitten by"],
    title: { en: "Insect bites & stings", es: "Picaduras de insectos" },
    steps: {
      en: [
        "If a stinger is stuck in the skin, scrape it out with a straight edge like a credit card (or pull it with tweezers).",
        "Wash with soap and water, then hold a cold pack wrapped in a thin towel on it. Try not to scratch.",
        "Ask the staff before you take any medicine, or eat or drink anything.",
      ],
      es: [
        "Si el aguijón quedó en la piel, sáquelo raspando con un borde recto como una tarjeta (o con pinzas).",
        "Lave con agua y jabón y coloque una compresa fría envuelta en una toalla delgada. Trate de no rascarse.",
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
      ],
    },
    seek: {
      en: "you have trouble breathing, swelling of the lips, face or throat, dizziness or fainting, a weak fast pulse, or nausea/vomiting — that's a possible severe reaction: call 911.",
      es: "tiene dificultad para respirar, hinchazón de labios, cara o garganta, mareo o desmayo, pulso débil y rápido, o náuseas/vómito — es una posible reacción grave: llame al 911.",
    },
    products: ["coldpack", "ointment"], medsAtDesk: true,
  },
  {
    id: "motion",
    triggers: ["motion sickness", "car sick", "carsick", "seasick", "sea sick", "travel sickness", "airsick", "nauseous in the car"],
    title: { en: "Motion sickness", es: "Mareo por movimiento" },
    steps: {
      en: [
        "Face forward, look at the horizon, and get fresh air if you can. Avoid reading or screens.",
        "Ask the staff before you take any medicine, or eat or drink anything.",
      ],
      es: [
        "Mire hacia adelante, fije la vista en el horizonte y tome aire fresco si puede. Evite leer o mirar pantallas.",
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
      ],
    },
    seek: {
      en: "vomiting won't stop, or you feel dizzy, weak, or dehydrated.",
      es: "el vómito no cesa, o se siente mareado, débil o deshidratado.",
    },
    products: [], medsAtDesk: true,
  },
  {
    id: "cramps",
    triggers: ["period cramps", "menstrual cramps", "cramps", "period pain", "painful period", "time of the month", "pms", "menstrual pain"],
    title: { en: "Period cramps", es: "Cólicos menstruales" },
    steps: {
      en: [
        "Heat helps: a heating patch on the lower belly, or a warm bath.",
        "Ask the staff before you take any medicine, or eat or drink anything.",
      ],
      es: [
        "El calor ayuda: un parche térmico en el bajo vientre o un baño tibio.",
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
      ],
    },
    seek: {
      en: "the pain is severe or gets in the way of daily life, comes on suddenly and sharply, or bleeding is very heavy (soaking a pad or tampon every hour for several hours).",
      es: "el dolor es intenso o interfiere con la vida diaria, aparece de repente y agudo, o el sangrado es muy abundante (empapa una toalla o tampón cada hora durante varias horas).",
    },
    products: ["heatpatch", "pads"], medsAtDesk: true,
  },
  {
    id: "musclepain",
    triggers: ["back pain", "backache", "muscle ache", "muscle pain", "sore muscles", "body aches", "joint pain", "neck pain", "stiff neck sore", "arthritis"],
    title: { en: "Back & muscle aches", es: "Dolor de espalda y músculos" },
    steps: {
      en: [
        "Keep gently moving — long bed rest usually makes back pain worse.",
        "Ask the staff before you take any medicine, or eat or drink anything.",
      ],
      es: [
        "Manténgase en movimiento suave — el reposo prolongado en cama suele empeorar el dolor de espalda.",
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
      ],
    },
    seek: {
      en: "you have numbness or weakness in a leg, trouble controlling your bladder or bowels, fever, or the pain followed a fall or injury or isn't improving after a couple of weeks.",
      es: "tiene adormecimiento o debilidad en una pierna, dificultad para controlar la vejiga o el intestino, fiebre, o el dolor siguió a una caída o lesión o no mejora después de un par de semanas.",
    },
    products: ["patch", "coldpack"], medsAtDesk: true,
  },
  {
    id: "toothache",
    triggers: ["toothache", "tooth ache", "tooth pain", "sore tooth", "dental pain", "wisdom tooth"],
    title: { en: "Toothache", es: "Dolor de muelas" },
    steps: {
      en: [
        "Ask the staff before you take any medicine, or eat or drink anything.",
        "It's temporary relief only: book a dentist visit.",
      ],
      es: [
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
        "Es solo un alivio temporal: programe una visita al dentista.",
      ],
    },
    seek: {
      en: "your face or jaw is swollen, you have a fever, or it hurts to swallow or breathe — get care right away.",
      es: "tiene la cara o la mandíbula hinchada, fiebre, o le duele al tragar o respirar — busque atención de inmediato.",
    },
    products: [], medsAtDesk: true,
  },
  {
    id: "hygiene",
    triggers: ["wash hands", "hand washing", "handwashing", "germs", "sanitizer work", "stop the spread", "prevent illness", "avoid getting sick"],
    title: { en: "Hand hygiene", es: "Higiene de manos" },
    steps: {
      en: [
        "Wash with soap and water for about 20 seconds — it's the best option when hands look dirty.",
        "When there's no soap, use a hand sanitizer with at least 60% alcohol and rub until dry (the one here is 65% ethyl alcohol).",
      ],
      es: [
        "Lave con agua y jabón durante unos 20 segundos — es la mejor opción cuando las manos se ven sucias.",
        "Si no hay jabón, use un desinfectante de manos con al menos 60% de alcohol y frote hasta que seque (el de aquí es de 65% de alcohol etílico).",
      ],
    },
    seek: { en: "", es: "" },
    products: ["sanitizer"],
  },
  {
    id: "safety",
    triggers: ["take medicine safely", "medication safety", "how to take medicine", "medicine safety", "safe use", "expired medicine", "store medicine", "storing medicine", "keep away from children", "double dose", "missed a dose", "take more than", "how long can i take"],
    title: { en: "Using medicine safely", es: "Uso seguro de medicamentos" },
    steps: {
      en: [
        "Read the whole label before every use, and never take more than it says.",
        "Ask the staff before you take any medicine, or eat or drink anything.",
        "Store medicines in a cool, dry place out of children's reach, and don't use them past the expiration date.",
      ],
      es: [
        "Lea toda la etiqueta antes de cada uso y nunca tome más de lo que indica.",
        "Pregunte al personal antes de tomar cualquier medicamento o de comer o beber.",
        "Guarde los medicamentos en un lugar fresco y seco, fuera del alcance de los niños, y no los use después de la fecha de vencimiento.",
      ],
    },
    seek: { en: "", es: "" },
    products: [],
  },
  {
    id: "poison",
    triggers: ["poison control", "poison hotline", "poison help", "poison center", "swallowed something", "took too much", "took too many", "ate something toxic", "accidentally swallowed"],
    title: { en: "Poison Help", es: "Ayuda por envenenamiento" },
    steps: {
      en: [
        "In the U.S., call Poison Help at 1-800-222-1222 — free, confidential, 24/7. You'll reach a nurse, pharmacist or doctor.",
        "If the person collapsed, has a seizure, or isn't breathing, call 911 instead.",
      ],
      es: [
        "En EE. UU., llame a Poison Help al 1-800-222-1222 — gratis, confidencial, 24/7. Le atenderá una enfermera, farmacéutico o médico.",
        "Si la persona se desplomó, convulsiona o no respira, llame al 911.",
      ],
    },
    seek: { en: "", es: "" },
    products: [],
  },
  {
    id: "whentogo",
    triggers: ["when should i see a doctor", "when to see a doctor", "should i go to the er", "er or urgent care", "urgent care or er", "do i need a doctor", "should i see a doctor", "when to go to the hospital", "what counts as an emergency"],
    title: { en: "Doctor, urgent care, or ER?", es: "¿Médico, atención urgente o sala de emergencias?" },
    steps: {
      en: [
        "Call 911 / go to the ER for: chest pain, trouble breathing, signs of stroke (face drooping, arm weakness, slurred speech), severe bleeding, fainting or confusion, a severe allergic reaction, or poisoning/overdose.",
        "Urgent care fits things that can't wait for your doctor but aren't life-threatening: minor cuts needing stitches, sprains, mild fever or infections.",
        "A regular doctor or pharmacist is best for ongoing symptoms and medicine questions.",
      ],
      es: [
        "Llame al 911 / vaya a la sala de emergencias por: dolor de pecho, dificultad para respirar, señales de derrame cerebral (cara caída, debilidad en un brazo, habla arrastrada), sangrado intenso, desmayo o confusión, reacción alérgica grave, o envenenamiento/sobredosis.",
        "La atención urgente sirve para lo que no puede esperar a su médico pero no pone la vida en riesgo: cortadas que necesitan puntos, esguinces, fiebre leve o infecciones.",
        "Un médico de cabecera o farmacéutico es lo mejor para síntomas continuos y dudas sobre medicamentos.",
      ],
    },
    seek: { en: "", es: "" },
    products: [],
    showCare: true,
  },
];

// ---- Kiosk FAQ: facts about this machine ----
// Answers may use {tax} (tax percent) — filled in by assistant.js.
const KIOSK_FAQ = [
  {
    id: "hours",
    triggers: ["hours", "open", "opening hours", "what time do you open", "are you open", "24 hours", "closing time", "open now", "when are you open"],
    answer: {
      en: "This kiosk is open 24 hours a day, 7 days a week, and it's restocked and inspected daily.",
      es: "Este quiosco está abierto las 24 horas del día, los 7 días de la semana, y se reabastece e inspecciona a diario.",
    },
  },
  {
    id: "payment",
    triggers: ["payment", "pay with", "accept", "do you accept", "accept cash", "take cash", "pay with cash", "accepted", "credit card", "debit card", "apple pay", "google pay", "fsa", "hsa", "cash", "payment methods", "how do i pay", "can i pay", "tap to pay", "venmo", "insurance"],
    answer: {
      en: "You can pay by tapping Apple/Google Pay, with a chip (EMV) card, or with an FSA/HSA card. This kiosk doesn't take cash, and insurance isn't billed. (In this demo, payment is simulated — no real charge is made.)",
      es: "Puede pagar con Apple/Google Pay, con tarjeta de chip (EMV) o con tarjeta FSA/HSA. Este quiosco no acepta efectivo ni factura al seguro. (En esta demostración el pago es simulado — no se hace ningún cargo real.)",
    },
  },
  {
    id: "tax",
    triggers: ["tax", "sales tax", "how much tax", "total with tax", "plus tax"],
    answer: {
      en: "An estimated {tax}% sales tax is added at checkout, and you'll see the subtotal, tax and total before you pay.",
      es: "Se agrega un impuesto de venta estimado del {tax}% al pagar, y verá el subtotal, el impuesto y el total antes de pagar.",
    },
  },
  {
    id: "pickup",
    triggers: ["where do the items come out", "where does it come out", "where do i get my items", "how do i get my items", "where do i pick up", "pick up my items"],
    answer: {
      en: "After you pay, your items drop into the kiosk's pickup slot, and the screen tells you when they're ready.",
      es: "Después de pagar, sus artículos caen en la ranura de recogida del quiosco, y la pantalla le avisa cuando estén listos.",
    },
  },
  {
    id: "limit",
    triggers: ["is there a limit", "how many can i buy", "how many can i get", "purchase limit", "limit per order", "maximum i can buy"],
    answer: {
      en: "Medicines with a safety warning are limited to 2 per order. Everything else is limited to 10.",
      es: "Los medicamentos con advertencia de seguridad tienen un límite de 2 por pedido. Todo lo demás, 10.",
    },
  },
  {
    id: "expiry",
    triggers: ["expiration date", "expiry date", "when does it expire", "does it expire", "are these expired", "fecha de vencimiento", "fecha de caducidad"],
    answer: {
      en: "The expiration date is printed on each package. I can't see it from here, so check it before use and don't use anything past its date.",
      es: "La fecha de vencimiento está impresa en cada paquete. No puedo verla desde aquí, así que revísela antes de usarlo y no use nada vencido.",
    },
  },
  {
    id: "demo",
    triggers: ["are these real", "real medicine", "is this real", "is this a real kiosk", "is this legit"],
    answer: {
      en: "This is a student-built demo, so no real payment is taken and nothing is really dispensed. The product labels are written to mirror standard over-the-counter Drug Facts.",
      es: "Esta es una demostración creada por estudiantes, así que no se cobra de verdad ni se entrega nada. Las etiquetas imitan la información estándar de medicamentos de venta libre.",
    },
  },
  {
    id: "refund",
    triggers: ["can i get a refund", "get my money back", "refund", "return", "exchange", "money back", "send it back", "return policy", "wrong item", "cancel my order", "cancel order"],
    answer: {
      en: "All sales are final — for safety, dispensed medication can't be returned, exchanged, or refunded. If the machine fails to dispense (a jam or sensor timeout), the transaction is reversed automatically and you're not charged. You can cancel any time before you pay by removing items from your cart.",
      es: "Todas las ventas son finales — por seguridad, los medicamentos dispensados no se pueden devolver, cambiar ni reembolsar. Si la máquina no dispensa (atasco o fallo del sensor), la transacción se revierte automáticamente y no se le cobra. Puede cancelar en cualquier momento antes de pagar quitando artículos del carrito.",
    },
  },
  {
    id: "jam",
    triggers: ["stuck", "jammed", "didn't come out", "did not come out", "won't dispense", "machine broke", "machine is broken", "not working", "dispenser", "item didn't drop", "nothing came out", "kiosk broken"],
    answer: {
      en: "Sorry about that! If the machine can't dispense your order, it reverses the transaction automatically — \"Transaction Reversed — No Charge\" — and you can try again. If something's still wrong, please contact the kiosk operator.",
      es: "¡Lo lamento! Si la máquina no puede dispensar su pedido, revierte la transacción automáticamente — \"Transacción Revertida — Sin Cargo\" — y puede intentarlo de nuevo. Si algo sigue mal, comuníquese con el operador del quiosco.",
    },
  },
  {
    id: "id",
    triggers: ["id required", "need id", "need an id", "photo id", "age restriction", "age restricted", "how old", "minimum age", "under 18", "underage", "age verification", "scan id", "id check", "do i need id"],
    answer: {
      en: "Some items are age-restricted (for example Vicks DayQuil Cold & Flu, because of the cough suppressant). If your order has one, you'll be asked to scan a valid government-issued photo ID at checkout. (ID scanning is simulated in this demo.)",
      es: "Algunos artículos tienen restricción de edad (por ejemplo, Vicks DayQuil, por el supresor de la tos). Si su pedido incluye uno, se le pedirá escanear una identificación con foto válida al pagar. (El escaneo de ID es simulado en esta demostración.)",
    },
  },
  {
    id: "howto",
    triggers: ["how does this work", "how do i use this kiosk", "use this kiosk", "use the kiosk", "how do i use the machine", "how do i use this machine", "how do i order", "how to order", "how do i buy", "how to buy", "how does it work", "how do i get started", "instructions for kiosk", "how do i use the kiosk", "walk me through"],
    answer: {
      en: "It's easy: 1) Browse by category or search a symptom, or just tell me what's wrong. 2) Tap Add on what you need. 3) Tap Review & Pay, read the order and terms, and pay. 4) Take your items from the bin and scan the QR code for your drug facts. Some medicines ask you to confirm you understand their warnings first.",
      es: "Es fácil: 1) Explore por categoría o busque un síntoma, o simplemente dígame qué le pasa. 2) Toque Agregar en lo que necesite. 3) Toque Revisar y Pagar, lea el pedido y los términos, y pague. 4) Retire sus artículos de la bandeja y escanee el código QR para ver la información de sus medicamentos. Algunos medicamentos piden confirmar primero que entiende sus advertencias.",
    },
  },
  {
    id: "qr",
    triggers: ["qr code", "qr", "scan the code", "scan code", "receipt", "drug facts page", "what is the qr", "the code at the end"],
    answer: {
      en: "After you pay, the screen shows a QR code. Point your phone's camera at it to open a page with the drug facts, directions and safety warnings for exactly what you bought — plus emergency numbers. In Disaster Relief Mode the QR holds the guidance as plain text, so it works with no cell data.",
      es: "Después de pagar, la pantalla muestra un código QR. Apunte la cámara de su teléfono para abrir una página con la información, instrucciones y advertencias de seguridad de lo que compró — más números de emergencia. En el Modo de Emergencia por Desastre el QR contiene la guía como texto, así que funciona sin datos móviles.",
    },
  },
  {
    id: "privacy",
    triggers: ["privacy", "private", "do you store", "save my data", "personal information", "data collected", "are you recording", "tracking", "safe to use", "is my data safe", "who sees this"],
    answer: {
      en: "Your cart and this chat are cleared automatically after each customer, and I don't send anything over the internet — I run entirely on this kiosk. In this demo, ID scanning and payment are simulated, so no real personal or payment information is collected.",
      es: "Su carrito y este chat se borran automáticamente después de cada cliente, y no envío nada por internet — funciono completamente en este quiosco. En esta demostración, el escaneo de ID y el pago son simulados, así que no se recopila información personal ni de pago real.",
    },
  },
  {
    id: "offline",
    triggers: ["are you ai", "how do you work", "how are you built", "are you chatgpt", "are you a real ai", "do you use the internet", "are you online", "internet", "wifi", "how smart are you", "what are you powered by", "language model", "llm"],
    answer: {
      en: "I'm a rule-based assistant that runs right here on the kiosk — no internet and no live AI model. I answer only from this kiosk's own product labels (which mirror each item's OTC Drug Facts) and general first-aid guidance, so my answers are consistent and auditable. I'm not a doctor, and I can't diagnose.",
      es: "Soy un asistente basado en reglas que funciona aquí mismo en el quiosco — sin internet ni un modelo de IA en vivo. Respondo solo con las etiquetas de los productos de este quiosco (que reflejan la información de medicamentos OTC de cada artículo) y guías generales de primeros auxilios, así que mis respuestas son consistentes y verificables. No soy médico y no puedo diagnosticar.",
    },
  },
  {
    id: "maker",
    triggers: ["who made you", "who built you", "who made this", "who created", "who built this", "who designed", "creator", "developer", "who is chetan", "who is sriansh", "made by"],
    answer: {
      en: "This kiosk was built by Chetan Nallapaneni and Sriansh Madari as a student-built demo of a 24/7 over-the-counter medical vending kiosk. It isn't a certified medical device or a licensed pharmacy system.",
      es: "Este quiosco fue creado por Chetan Nallapaneni y Sriansh Madari como una demostración hecha por estudiantes de un quiosco médico de venta libre 24/7. No es un dispositivo médico certificado ni un sistema de farmacia con licencia.",
    },
  },
  {
    id: "location",
    triggers: ["where am i", "where is this kiosk", "kiosk location", "what is the address", "which library", "what city", "where is this"],
    answer: {
      en: "This kiosk is at the Library & Active Living Center at Afton Ridge, Concord, NC. For real, nearby options (ERs, urgent care, pharmacies) tap \"Nearby Care & Pharmacy\".",
      es: "Este quiosco está en el Library & Active Living Center en Afton Ridge, Concord, NC. Para opciones reales cercanas (salas de emergencia, atención urgente, farmacias) toque \"Atención Cercana y Farmacia\".",
    },
  },
  {
    id: "prescription",
    triggers: ["prescription", "antibiotics", "do you sell prescription", "controlled", "refill", "need a script", "rx"],
    answer: {
      en: "Everything here is over-the-counter — no prescription needed, and this kiosk can't dispense prescription medicines (like antibiotic pills, insulin, or controlled substances). For those, a pharmacy or doctor is the right place — I can show you the nearest ones.",
      es: "Todo aquí es de venta libre — no se necesita receta, y este quiosco no puede dispensar medicamentos con receta (como antibióticos en pastillas, insulina o sustancias controladas). Para eso, una farmacia o un médico es el lugar correcto — puedo mostrarle los más cercanos.",
    },
    showCare: true,
  },
  {
    id: "accessibility",
    triggers: ["accessibility", "larger text", "bigger text", "text size", "can't read", "cant read", "hard to see", "high contrast", "dark mode", "font size", "colorblind", "color blind", "screen reader", "make it bigger"],
    answer: {
      en: "Tap the ♿ accessibility button at the top right to turn on Larger Text, High Contrast (strong black-and-white borders), or Dark Mode. You can also use the microphone button to speak instead of type.",
      es: "Toque el botón de accesibilidad ♿ arriba a la derecha para activar Texto Más Grande, Alto Contraste (bordes fuertes en blanco y negro) o Modo Oscuro. También puede usar el botón del micrófono para hablar en lugar de escribir.",
    },
  },
  {
    id: "languages",
    triggers: ["languages", "what languages", "other languages", "translate", "translation", "do you speak"],
    answer: {
      en: "I speak English and Spanish — tap the globe button at the top to switch the whole kiosk, or just write to me in Spanish and I'll answer in Spanish. (Drug-label warnings stay in English so their wording is exact.)",
      es: "Hablo inglés y español — toque el botón del globo arriba para cambiar todo el quiosco, o simplemente escríbame en español y le responderé en español. (Las advertencias de las etiquetas se mantienen en inglés para que su redacción sea exacta.)",
    },
  },
  {
    id: "disaster",
    triggers: ["disaster mode", "disaster relief", "relief mode", "emergency mode", "hurricane", "power outage", "blackout", "natural disaster", "what is disaster"],
    answer: {
      en: "Disaster Relief Mode is a special off-grid triage mode for emergencies like storms or outages: it sorts supplies by need (hydration, wounds, burns, fever), dispenses limited essentials free under a per-person ration with a 30-second cooldown, and still sells everything else at normal price. It's switched on from the operator's Judges panel.",
      es: "El Modo de Emergencia por Desastre es un modo especial de triaje sin conexión para emergencias como tormentas o apagones: organiza los suministros por necesidad (hidratación, heridas, quemaduras, fiebre), entrega gratis lo esencial con una ración limitada por persona y 30 segundos de espera, y vende todo lo demás a precio normal. Se activa desde el panel Judges del operador.",
    },
  },
  {
    id: "restock",
    triggers: ["restock", "when will you have", "back in stock", "sold out", "coming soon", "out of stock why", "will you get more"],
    answer: {
      en: "The kiosk is restocked and inspected daily. If something's marked Out of Stock, I can suggest a safe alternative that's available right now — just tell me what you were looking for.",
      es: "El quiosco se reabastece e inspecciona a diario. Si algo está Agotado, puedo sugerirle una alternativa segura disponible ahora — dígame qué buscaba.",
    },
  },
  {
    id: "temperature",
    triggers: ["temp locked", "temperature lock", "why is it locked", "locked for safety", "thermal", "too hot inside", "heatwave lock"],
    answer: {
      en: "If the cabinet gets too warm (over about 77°F), heat-sensitive items like ointments, sprays, sanitizer, sunscreen and cold packs are locked so they aren't sold degraded. They unlock as soon as the cabinet cools down.",
      es: "Si el gabinete se calienta demasiado (más de unos 77°F), los artículos sensibles al calor como pomadas, sprays, desinfectante, protector solar y compresas frías se bloquean para no venderse degradados. Se desbloquean en cuanto el gabinete se enfría.",
    },
  },
];
