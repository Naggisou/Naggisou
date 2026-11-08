// Contenu des appels : ce que dit l'appelant, les questions de l'opérateur et les canulars.

export const GREETING = {
  fire: "Pompiers, 118, où se trouve l'urgence ?",
  ems: "Urgences sanitaires, 144, je vous écoute.",
  police: "Police, 117, quelle est votre urgence ?",
  customs: "Office fédéral de la douane, centrale d'engagement, j'écoute.",
};

// Ce que dit l'appelant, par type d'intervention (une variante est tirée au hasard)
export const CALLER = {
  conteneur: ["Il y a une benne à ordures qui brûle devant chez moi, ça fait une grosse fumée noire !", "Les containers de la déchetterie sont en feu !"],
  alarme: ["Ici la réception de l'hôtel, l'alarme incendie s'est déclenchée au 3e étage, on ne voit rien pour l'instant.", "L'alarme de l'école sonne et les enfants sont dans la cour."],
  cave: ["Ma cave est sous l'eau, il y a au moins 30 centimètres et ça monte !", "Un tuyau a éclaté au sous-sol, l'eau arrive partout."],
  arbre: ["Un grand sapin est tombé en travers de la route, on ne peut plus passer.", "Un arbre s'est couché sur les câbles électriques au bord de la route."],
  hydro: ["Il y a une grosse flaque d'huile sur la chaussée, une voiture a déjà glissé.", "Un tracteur perd du diesel sur toute la route du village."],
  voiture: ["Une voiture est en feu sur le parking du centre commercial !", "Il y a des flammes qui sortent du capot d'une voiture sur le bord de la route."],
  broussailles: ["Le talus au bord de la route est en train de brûler, le vent pousse les flammes.", "Ça brûle dans les herbes sèches derrière les maisons !"],
  foret: ["Je vois des flammes dans la forêt au-dessus du village, ça s'étend vite !", "Il y a une énorme colonne de fumée qui sort de la forêt."],
  appart: ["Ça brûle chez mes voisins du dessus, il y a de la fumée dans la cage d'escalier !", "Mon appartement est en feu, je suis sorti sur le balcon !"],
  immeuble: ["Tout un immeuble est en feu, des gens crient aux fenêtres !", "Le feu est sur plusieurs étages, on voit des flammes au toit !"],
  gaz: ["Ça sent très fort le gaz dans tout l'immeuble, j'ai peur que ça explose.", "Une pelleteuse a arraché une conduite de gaz sur le chantier !"],
  chimique: ["Un camion-citerne s'est renversé, il y a un liquide qui fume sur la route.", "Il y a une fuite de produit chimique à l'usine, les gens toussent."],
  inondation: ["La rivière est sortie de son lit, plusieurs maisons ont les pieds dans l'eau.", "Tout le quartier est inondé, l'eau monte dans les rues !"],
  malaise: ["Un monsieur s'est effondré à l'arrêt de bus, il ne répond pas bien.", "Ma collègue a fait un malaise au bureau, elle est toute pâle."],
  chute: ["Ma grand-mère est tombée dans la salle de bain, elle n'arrive plus à se relever.", "Mon voisin âgé est tombé dans l'escalier, il a mal à la hanche."],
  acr: ["Mon mari ne respire plus ! Il est tout bleu, aidez-moi !", "Un joueur s'est effondré sur le terrain de foot, il ne bouge plus !"],
  cambriolage: ["Je rentre de vacances et ma porte est fracturée, tout est retourné…", "J'entends quelqu'un fouiller chez les voisins, ils sont absents !"],
  bagarre: ["Ça se bat devant le bar, ils sont au moins quatre, il y a du sang.", "Une grosse bagarre a éclaté à la sortie de la discothèque !"],
  tapage: ["Mes voisins font une fête depuis des heures, la musique est à fond, il est tard !", "Il y a un groupe qui hurle et klaxonne dans la rue depuis une heure."],
  vol: ["Ici le gérant de la supérette, on a retenu un client qui a volé de la marchandise.", "Quelqu'un vient de partir de la boutique avec un sac plein sans payer !"],
  controle: ["Une voiture zigzague sur la route devant moi, le conducteur a l'air complètement ivre.", "Un conducteur vient de sortir du bar en titubant et démarre sa voiture."],
  accident: ["Deux voitures se sont percutées au carrefour, une personne a l'air blessée.", "Un scooter a été renversé par une voiture devant la boulangerie."],
  incarc: ["Une voiture a fini contre un arbre, le conducteur est coincé à l'intérieur !", "Une voiture est sur le toit dans le fossé, il y a quelqu'un dedans qui appelle !"],
  poursuite: ["Une voiture vient de griller le contrôle et fonce à travers le village !", "Un véhicule volé roule à toute vitesse, il a failli renverser des piétons !"],
  braquage: ["On vient de se faire braquer, ils étaient deux, cagoulés ! Ils sont encore dans le coin !", "Il y a un homme avec une arme dans la bijouterie !"],
  otage: ["Un homme s'est barricadé dans la maison avec sa famille, il menace tout le monde !", "Quelqu'un retient des employés dans la banque !"],
  manif: ["Il y a des centaines de personnes qui bloquent la route principale, ça commence à chauffer.", "Un cortège sauvage traverse le centre-ville, des vitrines sont cassées."],
  disparu: ["Mon père a Alzheimer et il est parti de la maison il y a deux heures, on ne le trouve pas.", "Mon fils de 8 ans n'est pas rentré de l'école !"],
  fuite: ["On vient de me rentrer dedans et le conducteur est parti sans s'arrêter !", "Une voiture a renversé un cycliste et a pris la fuite !"],
  domestique: ["J'entends des cris et des coups chez mes voisins, une femme appelle à l'aide.", "Mon compagnon est violent, j'ai peur, je suis enfermée dans la salle de bain."],
  vitesse: ["Il y a un fou qui roule à au moins 150 dans le village, il va tuer quelqu'un !", "Des voitures font la course sur la route du lac."],
  carambolage: ["C'est un carambolage sur l'autoroute, il y a au moins six voitures impliquées !", "Plusieurs véhicules se sont encastrés dans le brouillard, c'est le chaos !"],
  montagne: ["Mon ami a chuté en randonnée, il est dans un pierrier, on ne peut pas descendre.", "Un parapentiste s'est écrasé sur la pente au-dessus des alpages !"],
  accouchement: ["Ma femme va accoucher, les contractions sont toutes les deux minutes !", "Le bébé arrive, on n'aura pas le temps d'aller à la maternité !"],
  transport: ["Ici le home médicalisé, nous avons un résident à transférer à l'hôpital pour un examen.", "Bonjour, c'est pour un transport de patient vers sa dialyse."],
  intox: ["Plusieurs personnes ont vomi après le repas du mariage, il y en a une vingtaine !", "Il y a du monoxyde dans la salle de sport, plusieurs personnes sont tombées."],
  noyade: ["Quelqu'un a disparu sous l'eau au bord du lac, on ne le voit plus !", "Un enfant est tombé dans la rivière, le courant l'emporte !"],
  contrebande: ["Ici le poste frontière, un véhicule a refusé le contrôle et le coffre est plein de cartons.", "On a repéré une camionnette qui décharge des colis près de la frontière."],
  franchissement: ["Un garde nous signale un groupe qui traverse la frontière à pied, hors des postes.", "Des personnes passent la frontière par le chemin forestier."],
  animaux: ["Un chauffeur transporte des chiots dans des cages sans papiers, ils ont l'air mal en point.", "Il y a des oiseaux exotiques cachés dans un coffre au passage de la douane."],
  poidslourd: ["Un poids lourd a des documents douteux, le chargement ne correspond pas à la déclaration.", "Le camion est bien plus lourd que ce qui est déclaré."],
  armes: ["On a trouvé des armes dans le coffre lors d'un contrôle de routine.", "Il y a des munitions cachées dans les portières d'une voiture."],
  stups: ["Le chien a marqué sur une voiture, il y a une odeur suspecte et le conducteur est nerveux.", "On soupçonne un transport de stupéfiants dans un bus de voyage."],
  forcage: ["Une voiture vient de forcer la barrière du poste de douane à toute vitesse !", "Un véhicule a forcé le passage et a failli renverser un douanier !"],
  frontiere_verte: ["Des capteurs signalent des mouvements dans la forêt le long de la frontière.", "Un agriculteur voit des gens traverser ses champs depuis la frontière."],
  double_fond: ["Le camion sonne creux, on soupçonne un double fond.", "Les dimensions de la remorque ne correspondent pas, il y a un compartiment caché."],
  fuite_douane: ["Une voiture a passé la douane et accélère, elle a jeté quelque chose par la fenêtre !", "Le conducteur a pris la fuite pendant le contrôle !"],
  passeurs: ["On a des informations sur un réseau de passeurs qui opère cette nuit.", "Plusieurs groupes sont guidés à travers la frontière par des passeurs."],
  contrefacons: ["Un camion transporte des centaines de sacs de luxe, ça a tout l'air de contrefaçons.", "Des montres « suisses » en quantité dans un coffre, elles sont fausses."],
};

// Questions de l'opérateur. add : renforts nécessaires si la réponse est « grave ».
// p : probabilité que la réponse soit grave.
export const QUESTIONS = {
  fire: [
    { q: "Y a-t-il encore des personnes à l'intérieur ?", bad: "Oui, je crois qu'il reste quelqu'un !", ok: "Non, tout le monde est sorti.", add: { amb: 1 }, p: 0.3 },
    { q: "Le feu se propage-t-il ?", bad: "Oui, ça gagne le bâtiment d'à côté !", ok: "Non, ça reste localisé.", add: { tp: 1 }, p: 0.3 },
    { q: "Y a-t-il des produits dangereux ?", bad: "Oui, il y a des bonbonnes de gaz dans le garage !", ok: "Non, rien de particulier.", add: { chim: 1 }, p: 0.15 },
  ],
  ems: [
    { q: "La personne respire-t-elle normalement ?", bad: "Non… elle respire très mal, elle devient grise !", ok: "Oui, elle respire.", add: { smur: 1 }, p: 0.22 },
    { q: "Y a-t-il plusieurs victimes ?", bad: "Oui, il y en a une deuxième !", ok: "Non, une seule personne.", add: { amb: 1 }, p: 0.2 },
    { q: "L'endroit est-il facile d'accès ?", bad: "Non, c'est au bout d'un chemin de montagne.", ok: "Oui, c'est au bord de la route.", add: { heli: 1 }, p: 0.1 },
  ],
  police: [
    { q: "Les auteurs sont-ils armés ?", bad: "Oui, j'ai vu un couteau !", ok: "Je ne crois pas, non.", add: { pat: 1 }, p: 0.25 },
    { q: "Y a-t-il des blessés ?", bad: "Oui, quelqu'un saigne beaucoup.", ok: "Non, personne n'est blessé.", add: { amb: 1 }, p: 0.25 },
    { q: "Les auteurs sont-ils encore sur place ?", bad: "Non, ils s'enfuient en voiture !", ok: "Oui, ils sont encore là.", add: { moto: 1 }, p: 0.2 },
  ],
  customs: [
    { q: "Combien de personnes sont impliquées ?", bad: "Plusieurs, au moins cinq.", ok: "Une seule personne.", add: { dou: 1 }, p: 0.3 },
    { q: "Le véhicule a-t-il pris la fuite ?", bad: "Oui, il file vers l'intérieur du pays !", ok: "Non, il est immobilisé.", add: { pat: 1 }, p: 0.25 },
    { q: "Y a-t-il des marchandises cachées ?", bad: "Oui, des colis bien dissimulés.", ok: "Rien de visible pour l'instant.", add: { cyno: 1 }, p: 0.25 },
  ],
};

// Canulars : l'appelant n'est pas crédible…
export const PRANK_CALLER = [
  "Allô ? Oui… y'a le feu… chez… euh… *rires étouffés*… dans mon frigo !",
  "C'est pour signaler un dragon au-dessus du lac. Si si, je vous jure.",
  "*Respiration*… *musique en fond*… « vas-y dis-le ! »… *rires*",
  "Oui bonjour, c'est urgent… mon chat regarde le mur depuis une heure.",
  "Euh il y a… un accident… avec… euh… attendez *chuchotements* … un ovni !",
];
export const PRANK_ANSWER = ["*rires*", "Euh… je sais pas trop…", "*On entend des ados pouffer de rire*", "Ben… peut-être… *raccroche presque*"];
export const PRANK_P = 0.07;
