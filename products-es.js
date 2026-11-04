// Spanish label text for PRODUCTS, keyed by id. Translated line by line from
// the English Drug Facts wording in products.js, with no new medical claims.
// localizeProducts(lang) swaps these into the shared PRODUCTS objects so every
// screen (catalog, cart, chat, safety dialog, QR facts page) follows the
// language without each renderer having to know about it.
// shortcut: hand translation, should be checked against the Spanish-language label before real deployment.

const PRODUCTS_ES = {
  bandaid: {
    name: "Curitas Band-Aid Surtidas", dosage: "Caja de 30",
    uses: "Cubre y protege cortadas, raspones y ampollas menores de la suciedad y las bacterias mientras sanan.",
    instructions: "Limpie la herida, aplique la curita y cámbiela a diario o cuando se moje.",
    warnings: "Solo para uso externo. No la aplique sobre heridas profundas por punción ni mordeduras de animales: busque atención médica.",
    allergyAlert: "Adhesivo sin látex.",
  },
  ointment: {
    name: "Ungüento Neosporin Original", dosage: "Tubo de 1 oz",
    uses: "Ayuda a prevenir infecciones en cortadas, raspones y quemaduras menores.",
    instructions: "Adultos y niños de 2 años en adelante: limpie el área afectada y aplique una pequeña cantidad (del tamaño de la yema de un dedo) de 1 a 3 veces al día. Puede cubrirse con un vendaje estéril. Niños menores de 2 años: consulte a un médico.",
    warnings: "Solo para uso externo. No lo use en los ojos ni sobre áreas grandes del cuerpo. Consulte primero a un médico si tiene heridas profundas o por punción, mordeduras de animales o quemaduras graves. Deje de usarlo y consulte a un médico si necesita usarlo más de 1 semana, si la afección continúa o empeora, o si aparece sarpullido u otra reacción alérgica.",
    allergyAlert: "En casos raros puede causar una reacción alérgica en la piel.",
  },
  gauze: {
    name: "Gasas y Cinta Nexcare", dosage: "5 gasas + rollo de cinta",
    uses: "Cubre y protege heridas más grandes que una curita no alcanza a cubrir.",
    instructions: "Colóquela directamente sobre la herida y sujétela con la cinta.",
    warnings: "Un solo uso: deséchela después de usarla. Busque atención médica si una herida no deja de sangrar.",
    allergyAlert: "Ninguna conocida.",
  },
  coldpack: {
    name: "Compresa Fría Instantánea ACE", dosage: "1 compresa de un solo uso",
    uses: "Da terapia de frío para reducir la hinchazón y el dolor de lesiones menores, torceduras y moretones.",
    instructions: "Apriétela para activarla, envuélvala en un paño y aplíquela sobre la lesión hasta 20 minutos.",
    warnings: "No la aplique directamente sobre la piel desnuda ni sobre heridas abiertas.",
    allergyAlert: "Ninguna conocida.",
  },
  ibuprofen: {
    name: "Advil 200mg", dosage: "24 tabletas de 200mg",
    uses: "Alivia temporalmente dolores menores por dolor de cabeza, dolor muscular, dolor de espalda, artritis leve, cólicos menstruales, dolor de muelas y el resfriado común; reduce temporalmente la fiebre.",
    instructions: "Adultos y niños de 12 años en adelante: tome 1 tableta cada 4 a 6 horas mientras duren los síntomas. Si el dolor o la fiebre no mejoran con 1 tableta, puede tomar 2 tabletas. No tome más de 6 tabletas en 24 horas a menos que se lo indique un médico. Niños menores de 12 años: consulte a un médico.",
    warnings: "Advertencia de sangrado estomacal: el riesgo es mayor si tiene 60 años o más, ha tenido úlceras o sangrado estomacal, toma un anticoagulante o un esteroide, toma otros AINE, toma 3 o más bebidas alcohólicas al día, o toma más cantidad o por más tiempo de lo indicado. Advertencia de ataque cardíaco y derrame cerebral: los AINE pueden aumentar el riesgo. No lo use justo antes o después de una cirugía del corazón. Consulte primero a un médico si toma aspirina para el corazón o tiene presión arterial alta, enfermedad del corazón o de los riñones. Embarazo: no lo use a partir de las 20 semanas de embarazo a menos que se lo indique un médico. Deje de usarlo si el dolor dura más de 10 días o la fiebre más de 3 días.",
    allergyAlert: "El ibuprofeno puede causar una reacción alérgica grave (ronchas, hinchazón de la cara, asma/silbido al respirar, choque). No lo use si alguna vez tuvo una reacción alérgica a cualquier analgésico o reductor de fiebre, incluida la aspirina.",
  },
  acetaminophen: {
    name: "Tylenol Extra Fuerte 500mg", dosage: "24 comprimidos de 500mg",
    uses: "Alivia temporalmente dolores menores por dolor de cabeza, dolor muscular, dolor de espalda, artritis leve, el resfriado común y dolor de muelas; reduce temporalmente la fiebre.",
    instructions: "Adultos y niños de 12 años en adelante: tome 2 comprimidos cada 6 horas mientras duren los síntomas. No tome más de 6 comprimidos en 24 horas a menos que se lo indique un médico. No lo use por más de 10 días a menos que se lo indiquen. Niños menores de 12 años: consulte a un médico.",
    warnings: "Advertencia sobre el hígado: puede ocurrir daño grave al hígado si toma más de 6 comprimidos en 24 horas, lo toma con otros medicamentos que contienen acetaminofén, o toma 3 o más bebidas alcohólicas todos los días. Consulte primero a un médico si tiene enfermedad del hígado o toma el anticoagulante warfarina. Deje de usarlo si el dolor dura más de 10 días o la fiebre más de 3 días. Sobredosis: busque ayuda médica o llame a Control de Envenenamientos de inmediato, aunque se sienta bien.",
    allergyAlert: "El acetaminofén puede causar reacciones graves en la piel (enrojecimiento, ampollas, sarpullido). Si ocurre una reacción en la piel, deje de usarlo y busque ayuda médica de inmediato.",
  },
  aspirin: {
    name: "Aspirina Bayer 325mg", dosage: "24 tabletas de 325mg",
    uses: "Alivia temporalmente dolores menores por dolor de cabeza, dolor muscular, artritis leve y dolor de muelas; reduce temporalmente la fiebre.",
    instructions: "Adultos y niños de 12 años en adelante: tome 1 a 2 tabletas con agua cada 4 horas mientras duren los síntomas. No tome más de 12 tabletas en 24 horas a menos que se lo indique un médico. Niños menores de 12 años: consulte a un médico.",
    warnings: "Síndrome de Reye: los niños y adolescentes que tienen o se están recuperando de varicela o síntomas parecidos a la gripe no deben usar este producto. Advertencia de sangrado estomacal: el riesgo es mayor si tiene 60 años o más, ha tenido úlceras o sangrado estomacal, toma un anticoagulante o un esteroide, toma otros AINE, toma 3 o más bebidas alcohólicas al día, o toma más cantidad o por más tiempo de lo indicado. Embarazo: no lo use a partir de las 20 semanas de embarazo a menos que se lo indique un médico. Deje de usarlo si el dolor dura más de 10 días o la fiebre más de 3 días, o si siente zumbido en los oídos.",
    allergyAlert: "La aspirina puede causar una reacción alérgica grave (ronchas, hinchazón de la cara, asma/silbido al respirar, choque). No la use si es alérgico a la aspirina o a cualquier otro analgésico o reductor de fiebre.",
  },
  patch: {
    name: "Parche Medicado Icy Hot", dosage: "4 parches",
    uses: "Alivia temporalmente dolores menores de músculos y articulaciones por dolor de espalda, artritis, distensiones y torceduras.",
    instructions: "Adultos y niños de 12 años en adelante: limpie y seque el área afectada y aplique 1 parche hasta por 8 horas. No use más de 4 parches en 24 horas. Niños menores de 12 años: consulte a un médico.",
    warnings: "Solo para uso externo. No lo use con una almohadilla térmica, sobre heridas o piel dañada, ni con otros ungüentos o cremas. No lo cubra con un vendaje apretado. Deje de usarlo si tiene irritación excesiva, enrojecimiento o ardor en la piel, o si la afección empeora o dura más de 7 días.",
    allergyAlert: "Ninguna conocida.",
  },
  periodrelief: {
    name: "Pamprin Multisíntomas", dosage: "20 comprimidos",
    uses: "Alivia temporalmente síntomas premenstruales y menstruales, como cólicos, hinchazón, retención de líquidos y dolor de cabeza.",
    instructions: "Adultos y niños de 12 años en adelante: tome 2 comprimidos con agua cada 6 horas según sea necesario. No tome más de 6 comprimidos en 24 horas. Niños menores de 12 años: consulte a un médico.",
    warnings: "Contiene acetaminofén. Advertencia sobre el hígado: puede ocurrir daño grave al hígado si toma más de 6 comprimidos en 24 horas, toma otros medicamentos que contienen acetaminofén, o toma 3 o más bebidas alcohólicas todos los días. Puede causar somnolencia; el alcohol, los sedantes y los tranquilizantes la aumentan. Evite manejar u operar maquinaria. Consulte primero a un médico si tiene enfermedad del hígado, glaucoma, un problema respiratorio o dificultad para orinar por agrandamiento de la próstata.",
    allergyAlert: "El acetaminofén puede causar reacciones graves en la piel (enrojecimiento, ampollas, sarpullido). Si ocurre una reacción en la piel, deje de usarlo y busque ayuda médica de inmediato.",
  },
  heatpatch: {
    name: "Parches de Calor Menstrual ThermaCare", dosage: "3 parches",
    uses: "Da un calor suave y constante que ayuda a aliviar cólicos menstruales y musculares menores.",
    instructions: "Aplíquelo en la parte baja del abdomen o de la espalda, sobre la ropa. Da hasta 8 horas de calor.",
    warnings: "No lo aplique directamente sobre la piel desnuda. No lo use mientras duerme.",
    allergyAlert: "Ninguna conocida.",
  },
  antihistamine: {
    name: "Benadryl para Alergias 25mg", dosage: "24 tabletas de 25mg",
    uses: "Alivia temporalmente la nariz que gotea, los estornudos, los ojos llorosos con picazón y la picazón de nariz o garganta por fiebre del heno u otras alergias respiratorias.",
    instructions: "Adultos y niños de 12 años en adelante: tome 1 a 2 tabletas cada 4 a 6 horas. No tome más de 6 dosis en 24 horas. Niños menores de 12 años: consulte a un médico.",
    warnings: "No lo use con ningún otro producto que contenga difenhidramina, incluso uno que se aplique en la piel. Consulte primero a un médico si tiene glaucoma, un problema respiratorio como enfisema o bronquitis crónica, o dificultad para orinar por agrandamiento de la próstata. Puede causar somnolencia marcada; el alcohol, los sedantes y los tranquilizantes la aumentan. Evite manejar u operar maquinaria. Puede causar excitación, sobre todo en niños. No lo use para dar sueño a un niño.",
    allergyAlert: "Ninguna conocida.",
  },
  coughdrops: {
    name: "Pastillas Halls Mentho-Lyptus", dosage: "18 pastillas",
    uses: "Alivia temporalmente la irritación leve ocasional de la garganta y la tos por resfriado.",
    instructions: "Deje que una pastilla se disuelva lentamente en la boca. Repita según sea necesario.",
    warnings: "Peligro de asfixia para niños pequeños: no es para niños menores de 5 años. Deje de usarlo y consulte a un médico si el dolor de garganta es fuerte o dura más de 2 días, o la tos más de 7 días.",
    allergyAlert: "Ninguna conocida.",
  },
  coldflu: {
    name: "Vicks DayQuil Resfriado y Gripe", dosage: "16 LiquiCaps",
    uses: "Alivia temporalmente la tos, el dolor del cuerpo, el dolor de cabeza y la fiebre del resfriado común o la gripe.",
    instructions: "Adultos y niños de 12 años en adelante: tome 2 LiquiCaps con agua cada 4 horas. No tome más de 4 dosis (8 LiquiCaps) en 24 horas. Niños menores de 12 años: consulte a un médico.",
    warnings: "Advertencia sobre el hígado: contiene acetaminofén; puede ocurrir daño grave al hígado si toma más de lo indicado, toma otros medicamentos que contienen acetaminofén, o toma 3 o más bebidas alcohólicas todos los días. No lo use si toma un IMAO (ciertos medicamentos para la depresión, afecciones psiquiátricas o emocionales, o la enfermedad de Parkinson) ni durante 2 semanas después de dejarlo. Consulte primero a un médico si tiene enfermedad del hígado, enfermedad del corazón, presión arterial alta, enfermedad de la tiroides, diabetes o dificultad para orinar por agrandamiento de la próstata. Deje de usarlo si se siente nervioso, mareado o no puede dormir, o si los síntomas duran más de 7 días o la fiebre más de 3 días. Restringido por edad en este quiosco (dextrometorfano): se requiere identificación con foto válida.",
    allergyAlert: "Ninguna conocida.",
  },
  decongestant: {
    name: "Aerosol Nasal Afrin Original", dosage: "0.5 fl oz",
    uses: "Alivia temporalmente la congestión nasal por el resfriado común, la fiebre del heno u otras alergias respiratorias.",
    instructions: "Adultos y niños de 6 años en adelante: 2 a 3 aplicaciones en cada fosa nasal, no más de una vez cada 10 a 12 horas. No use más de 2 dosis en 24 horas. Niños menores de 6 años: consulte a un médico.",
    warnings: "No lo use por más de 3 días: usarlo más tiempo puede empeorar la congestión (congestión de rebote). Consulte primero a un médico si tiene enfermedad del corazón, presión arterial alta, enfermedad de la tiroides, diabetes o dificultad para orinar por agrandamiento de la próstata. No comparta este envase: puede propagar infecciones. Puede causar ardor, picazón o estornudos temporales.",
    allergyAlert: "Ninguna conocida.",
  },
  antacid: {
    name: "Tums Extra Fuerte", dosage: "32 tabletas masticables",
    uses: "Alivia la acidez, la indigestión ácida y el malestar estomacal.",
    instructions: "Adultos y niños de 12 años en adelante: mastique 2 a 4 tabletas cuando tenga síntomas. No tome más de 10 tabletas en 24 horas, y no use la dosis máxima por más de 2 semanas salvo indicación de un médico.",
    warnings: "Consulte primero a un médico o farmacéutico si toma un medicamento con receta: los antiácidos pueden interactuar con ciertos medicamentos con receta. No tome más de 10 tabletas en 24 horas.",
    allergyAlert: "Ninguna conocida.",
  },
  electrolyte: {
    name: "Sobres Pedialyte en Polvo", dosage: "6 sobres",
    uses: "Ayuda a reponer líquidos y electrolitos perdidos por sudor, deshidratación leve o diarrea.",
    instructions: "Mezcle un sobre con 8 oz de agua y bébalo.",
    warnings: "Consulte a un médico si el vómito o la diarrea duran más de 24 horas. Menores de 1 año: consulte a un médico.",
    allergyAlert: "Ninguna conocida.",
  },
  motionsickness: {
    name: "Dramamine Original", dosage: "8 tabletas",
    uses: "Previene y trata las náuseas, el vómito y el mareo por movimiento.",
    instructions: "Adultos y niños de 12 años en adelante: tome 1 a 2 tabletas cada 4 a 6 horas; no tome más de 8 tabletas en 24 horas. Tome la primera dosis de 30 minutos a 1 hora antes de viajar. Niños menores de 12 años: consulte a un médico.",
    warnings: "Consulte primero a un médico si tiene glaucoma, un problema respiratorio como enfisema o bronquitis crónica, o dificultad para orinar por agrandamiento de la próstata. Puede causar somnolencia marcada; evite el alcohol, los sedantes y los tranquilizantes, y no maneje ni opere maquinaria.",
    allergyAlert: "Ninguna conocida.",
  },
  antidiarrheal: {
    name: "Imodium A-D", dosage: "12 comprimidos",
    uses: "Controla los síntomas de la diarrea, incluida la diarrea del viajero.",
    instructions: "Adultos y niños de 12 años en adelante: tome 2 comprimidos después de la primera evacuación suelta y luego 1 comprimido después de cada evacuación suelta. No tome más de 4 comprimidos en 24 horas. Niños menores de 12 años: consulte a un médico.",
    warnings: "No lo use si tiene heces con sangre o negras. Consulte primero a un médico si tiene fiebre, moco en las heces o antecedentes de enfermedad del hígado. Deje de usarlo y consulte a un médico si los síntomas empeoran o la diarrea dura más de 2 días. Advertencia sobre el corazón: tomar más de lo indicado puede causar problemas graves del corazón o la muerte.",
    allergyAlert: "Ninguna conocida.",
  },
  pads: {
    name: "Toallas Always Regulares", dosage: "20 unidades, absorción regular",
    uses: "Para la higiene femenina durante la menstruación.",
    instructions: "Cámbiela cada 4 a 6 horas o según sea necesario. Siga las instrucciones del paquete.",
    warnings: "Solo para uso externo. Deje de usarla si causa irritación.",
    allergyAlert: "Ninguna conocida.",
  },
  tampons: {
    name: "Tampones Tampax Pearl Regular", dosage: "18 unidades, regular",
    uses: "Para la higiene femenina durante la menstruación.",
    instructions: "Cámbielo cada 4 a 8 horas. Lávese las manos antes y después de usarlo. Siga el instructivo del paquete para colocarlo.",
    warnings: "En raras ocasiones se asocia con el síndrome de choque tóxico (SCT). Use la menor absorción necesaria y no lo deje puesto más de 8 horas. Fiebre, sarpullido, vómito, diarrea o mareo pueden ser SCT: retire el tampón y busque ayuda médica de inmediato.",
    allergyAlert: "Ninguna conocida.",
  },
  pregnancytest: {
    name: "Prueba de Embarazo First Response", dosage: "1 prueba",
    uses: "Para detectar el embarazo en casa.",
    instructions: "Hágase la prueba al despertar para obtener el resultado más preciso. Siga las instrucciones del paquete.",
    warnings: "Consulte a un médico para confirmar cualquier resultado.",
    allergyAlert: "Ninguna conocida.",
  },
  sanitizer: {
    name: "Desinfectante de Manos Purell", dosage: "2 fl oz",
    uses: "Ayuda a reducir las bacterias en la piel cuando no hay agua y jabón.",
    instructions: "Aplíquelo en las manos y frótelas hasta que se sequen.",
    warnings: "Inflamable. Manténgalo lejos del fuego. Solo para uso externo.",
    allergyAlert: "Ninguna conocida.",
  },
  sunscreen: {
    name: "Protector Solar Coppertone Sport FPS 30", dosage: "3 fl oz",
    uses: "Ayuda a prevenir las quemaduras de sol.",
    instructions: "Aplíquelo generosamente 15 minutos antes de exponerse al sol; vuelva a aplicarlo cada 2 horas.",
    warnings: "Solo para uso externo. Evite el contacto con los ojos. Menores de 6 meses: consulte a un médico.",
    allergyAlert: "Ninguna conocida.",
  },
};

const LOCALIZED_FIELDS = ["name", "dosage", "uses", "instructions", "warnings", "allergyAlert"];

function localizeProducts(lang) {
  PRODUCTS.forEach((p) => {
    if (!p._en) { p._en = {}; LOCALIZED_FIELDS.forEach((f) => { p._en[f] = p[f]; }); }
    const src = lang === "es" && PRODUCTS_ES[p.id] ? PRODUCTS_ES[p.id] : p._en;
    LOCALIZED_FIELDS.forEach((f) => { if (src[f] != null) p[f] = src[f]; });
  });
}
