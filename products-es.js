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



  patch: {
    name: "Parche Medicado Icy Hot", dosage: "4 parches",
    uses: "Alivia temporalmente dolores menores de músculos y articulaciones por dolor de espalda, artritis, distensiones y torceduras.",
    instructions: "Adultos y niños de 12 años en adelante: limpie y seque el área afectada y aplique 1 parche hasta por 8 horas. No use más de 4 parches en 24 horas. Niños menores de 12 años: consulte a un médico.",
    warnings: "Solo para uso externo. No lo use con una almohadilla térmica, sobre heridas o piel dañada, ni con otros ungüentos o cremas. No lo cubra con un vendaje apretado. Deje de usarlo si tiene irritación excesiva, enrojecimiento o ardor en la piel, o si la afección empeora o dura más de 7 días.",
    allergyAlert: "Ninguna conocida.",
  },

  heatpatch: {
    name: "Parches de Calor Menstrual ThermaCare", dosage: "3 parches",
    uses: "Da un calor suave y constante que ayuda a aliviar cólicos menstruales y musculares menores.",
    instructions: "Aplíquelo en la parte baja del abdomen o de la espalda, sobre la ropa. Da hasta 8 horas de calor.",
    warnings: "No lo aplique directamente sobre la piel desnuda. No lo use mientras duerme.",
    allergyAlert: "Ninguna conocida.",
  },



  decongestant: {
    name: "Aerosol Nasal Afrin Original", dosage: "0.5 fl oz",
    uses: "Alivia temporalmente la congestión nasal por el resfriado común, la fiebre del heno u otras alergias respiratorias.",
    instructions: "Adultos y niños de 6 años en adelante: 2 a 3 aplicaciones en cada fosa nasal, no más de una vez cada 10 a 12 horas. No use más de 2 dosis en 24 horas. Niños menores de 6 años: consulte a un médico.",
    warnings: "No lo use por más de 3 días: usarlo más tiempo puede empeorar la congestión (congestión de rebote). Consulte primero a un médico si tiene enfermedad del corazón, presión arterial alta, enfermedad de la tiroides, diabetes o dificultad para orinar por agrandamiento de la próstata. No comparta este envase: puede propagar infecciones. Puede causar ardor, picazón o estornudos temporales.",
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
  tissues: {
    name: "Pañuelos Faciales Kleenex", dosage: "Paquete de viaje, 3 x 10 pañuelos",
    uses: "Pañuelos suaves para la nariz que gotea, los estornudos o las lágrimas.",
    instructions: "Úselo una vez y tírelo, luego lávese o desinfecte las manos.",
    warnings: "Un solo uso. Tírelo después de usarlo para ayudar a evitar que se propaguen los gérmenes.",
    allergyAlert: "Ninguna conocida.",
  },
  earplugs: {
    name: "Tapones para los Oídos Mack's", dosage: "4 pares",
    uses: "Bloquea el ruido para que pueda descansar mientras espera.",
    instructions: "Enrolle el tapón hasta que quede delgado, jale la oreja hacia arriba y atrás, introdúzcalo y sosténgalo mientras se expande.",
    warnings: "No los empuje muy adentro del oído. Quíteselos si duelen. Manténgalos lejos de niños pequeños: peligro de asfixia.",
    allergyAlert: "Ninguna conocida.",
  },
  masks: {
    name: "Mascarillas Diarias 3M", dosage: "10 mascarillas",
    uses: "Cubre la nariz y la boca para ayudar a reducir la propagación de gérmenes, como en una sala de espera.",
    instructions: "Lávese las manos, cubra la nariz y la boca, ajuste el alambre sobre la nariz y cámbiela cuando se humedezca o ensucie.",
    warnings: "No es un respirador. Un solo uso. No es para menores de 2 años ni para quien no pueda quitársela solo.",
    allergyAlert: "Ninguna conocida.",
  },
  wipes: {
    name: "Toallitas para Manos Wet Ones", dosage: "20 toallitas",
    uses: "Limpia las manos y superficies cuando no hay agua y jabón cerca.",
    instructions: "Saque una toallita, limpie las manos o superficies y tírela. Cierre bien el paquete para que no se sequen.",
    warnings: "Solo para uso externo. Evite los ojos. Deje de usarlas si la piel se irrita. No las tire al inodoro.",
    allergyAlert: "Ninguna conocida.",
  },
  cable: {
    name: "Cable de Carga USB-C Anker", dosage: "3 pies, USB-A a USB-C",
    uses: "Carga un teléfono o tableta con puerto USB-C mientras espera.",
    instructions: "Conecte el extremo USB-A a un puerto o adaptador de carga y el extremo USB-C a su dispositivo.",
    warnings: "Manténgalo lejos del agua. No use un cable dañado. No sirve para iPhone con puerto Lightning.",
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
