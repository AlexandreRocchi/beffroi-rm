/**
 * Documentation intégrée : tutoriels illustrés de Beffroi RM. Les captures (public/captures)
 * sont régénérées par « npm run docs:screenshots » à partir de l'étude exemple de l'ANSSI.
 * Mise en forme minimale dans les textes : **gras**, `code` et [[chapitre|libellé]] (lien interne).
 */

export type Block =
  | { p: string }
  | { h: string }
  | { steps: string[] }
  | { list: string[] }
  | { img: string; alt: string; caption?: string }
  | { tip: string }
  | { warn: string }
  | { terms: [string, string][] };

export type Chapter = { id: string; part: string; title: string; summary: string; blocks: Block[] };

export const PARTS = ["Prise en main", "Conduire une étude", "Outils de l'étude", "Administration", "Référence"] as const;

export const CHAPTERS: Chapter[] = [
  // ───────────── Prise en main ─────────────
  {
    id: "bienvenue",
    part: "Prise en main",
    title: "Bienvenue dans Beffroi RM",
    summary: "Ce que fait l'application, qui fait quoi, et le parcours d'une analyse de risques.",
    blocks: [
      { p: "Beffroi RM accompagne une équipe dans l'appréciation et le traitement des risques numériques selon la méthode **EBIOS Risk Manager** de l'ANSSI (guide v1.5 et fiches méthodes). Chaque étude se conduit atelier par atelier ; les cartographies, radars, graphes d'attaque et matrices de risque sont produits au fil de la saisie, et les livrables (PDF, Word, Excel) sont générés à tout moment." },
      { img: "a5-residuels", alt: "Cartographies du risque initial et résiduel", caption: "Un résultat typique : les risques de l'étude avant et après le plan de traitement (atelier 5)." },
      { h: "Deux rôles bien séparés" },
      { list: [
        "**Analyste** : crée et conduit des études, les partage avec ses collègues. Il ne voit que les études auxquelles il a accès (besoin d'en connaître).",
        "**Administrateur** : gère les comptes, les groupes et le journal d'audit. Il n'a **jamais** accès au contenu des analyses.",
      ] },
      { h: "Le parcours d'une étude" },
      { steps: [
        "**Atelier 1 — Cadrage et socle de sécurité** : objectifs, périmètre (valeurs métier, biens supports), événements redoutés et leur gravité, référentiels applicables.",
        "**Atelier 2 — Sources de risque** : qui pourrait attaquer, dans quel but ; sélection des couples source de risque / objectif visé (SR/OV) les plus pertinents.",
        "**Atelier 3 — Scénarios stratégiques** : parties prenantes dangereuses de l'écosystème, chemins d'attaque de haut niveau, mesures sur l'écosystème.",
        "**Atelier 4 — Scénarios opérationnels** : modes opératoires sous forme de graphes d'actions élémentaires, et leur vraisemblance.",
        "**Atelier 5 — Traitement du risque** : cartographie des risques, stratégie de traitement, plan de mesures, risques résiduels et cadre de suivi.",
      ] },
      { tip: "Pour découvrir l'outil, créez une étude à partir de l'**exemple du guide ANSSI** (société de biotechnologie) : tous les ateliers sont remplis, comme sur les captures de cette documentation. Voir [[portefeuille|Créer une étude]]." },
    ],
  },
  {
    id: "connexion",
    part: "Prise en main",
    title: "Se connecter et sécuriser son compte",
    summary: "Première connexion, second facteur (TOTP), codes de secours, sessions ouvertes.",
    blocks: [
      { p: "Votre administrateur vous transmet un **identifiant** et un **mot de passe temporaire**. La première connexion se fait en trois temps : mot de passe, nouveau mot de passe, puis activation du second facteur." },
      { img: "connexion", alt: "Écran de connexion", caption: "Écran de connexion. Toute connexion est journalisée ; le compte est verrouillé temporairement après plusieurs échecs." },
      { h: "1. Choisir votre mot de passe" },
      { p: "À la première connexion, le mot de passe temporaire doit être remplacé. Il faut au moins **12 caractères** et trois types parmi minuscules, majuscules, chiffres et caractères spéciaux. Les mots de passe courants, ceux qui contiennent votre identifiant ou votre nom, les suites (`123456`, `azerty`…) et vos 5 derniers mots de passe sont refusés." },
      { img: "mot-de-passe-initial", alt: "Changement du mot de passe initial" },
      { tip: "Une phrase de passe de plusieurs mots (« Veilleur-Tour-Nord-2026 ») est à la fois robuste et facile à retenir." },
      { h: "2. Activer le second facteur" },
      { p: "Installez sur votre téléphone une application d'authentification (FreeOTP, Aegis, Google Authenticator, Microsoft Authenticator, KeePassXC…). Beffroi RM vous demande d'abord votre mot de passe, puis affiche un QR code." },
      { steps: [
        "Saisissez votre mot de passe et cliquez sur **Continuer**.",
        "Dans l'application, ajoutez un compte en **scannant le QR code** (ou saisissez la clé affichée dessous, type « basé sur le temps »).",
        "Recopiez le code à 6 chiffres affiché par l'application et cliquez sur **Activer**.",
      ] },
      { img: "mfa-2", alt: "QR code et saisie du premier code", caption: "La clé n'est affichée qu'une fois ; elle est ensuite conservée chiffrée sur le serveur." },
      { h: "3. Conserver les codes de secours" },
      { p: "Dix codes de secours sont affichés **une seule fois**. Chacun permet une connexion si vous perdez votre téléphone. Téléchargez-les ou copiez-les dans un coffre-fort de mots de passe, cochez **J'ai conservé ces codes en lieu sûr**, puis **Terminer**." },
      { img: "mfa-3", alt: "Codes de secours" },
      { warn: "Sans téléphone ni code de secours, seul l'administrateur peut réinitialiser votre second facteur." },
      { h: "Connexions suivantes" },
      { p: "Après le mot de passe, saisissez le code affiché par l'application. Le lien **Utiliser un code de secours** permet de s'en passer ponctuellement. À chaque connexion, Beffroi RM indique la date de la connexion précédente et le nombre de tentatives échouées depuis : si ce n'était pas vous, changez votre mot de passe et prévenez l'administrateur." },
      { img: "connexion-second-facteur", alt: "Saisie du code à usage unique" },
      { h: "Votre profil" },
      { p: "Cliquez sur votre nom en haut à droite. Le profil permet de modifier votre nom et votre fonction, de **changer votre mot de passe**, de **régénérer des codes de secours** et de consulter vos **sessions ouvertes** : fermez toute session que vous ne reconnaissez pas." },
      { img: "profil", alt: "Profil, sécurité et sessions ouvertes" },
    ],
  },
  {
    id: "portefeuille",
    part: "Prise en main",
    title: "Portefeuille et création d'une étude",
    summary: "Retrouver ses études, en créer une (vide ou exemple ANSSI), importer, dupliquer.",
    blocks: [
      { p: "La page **Mes études** liste les analyses auxquelles vous avez accès. Les compteurs du haut agrègent vos études : risques initiaux et résiduels élevés, mesures terminées. Chaque carte affiche la mention de protection, votre droit (propriétaire, écriture, lecture), la répartition des risques et l'avancement des cinq ateliers." },
      { img: "portefeuille", alt: "Portefeuille" },
      { h: "Créer une étude" },
      { steps: [
        "Cliquez sur **Nouvelle étude**.",
        "Renseignez le **nom**, la **référence** et l'**organisation**.",
        "Choisissez la **mention de protection** (obligatoire) : elle s'affiche en bandeau sur chaque écran et sur chaque page des livrables.",
        "Choisissez le point de départ : **Étude vide**, ou **Exemple du guide ANSSI** pour découvrir l'outil sur un cas complet.",
        "Cliquez sur **Créer l'étude** : vous arrivez sur l'atelier 1.",
      ] },
      { img: "nouvelle-etude", alt: "Fenêtre de création d'une étude" },
      { h: "Importer une étude" },
      { p: "Le bouton **Importer** accepte un **export JSON** de Beffroi RM (sauvegarde, transfert depuis une autre instance) ou le **modèle Excel « EBIOS RM – Ateliers » de l'ANSSI** complété : les onglets sont analysés et transformés en étude." },
      { h: "Dupliquer ou supprimer" },
      { p: "Les icônes en bas de chaque carte dupliquent l'étude (pour repartir d'une analyse existante) ou la suppriment (propriétaire uniquement, après confirmation)." },
    ],
  },
  {
    id: "interface",
    part: "Prise en main",
    title: "Se repérer dans une étude",
    summary: "Vue d'ensemble, navigation par atelier, enregistrement, annulation, aide méthodologique.",
    blocks: [
      { p: "Une étude s'ouvre sur sa **vue d'ensemble** : chiffres clés, avancement de chaque atelier, prochaines étapes suggérées et cartographie du risque." },
      { img: "vue-ensemble", alt: "Vue d'ensemble d'une étude" },
      { h: "Les repères de l'écran" },
      { list: [
        "**Bandeau rouge** en haut : la mention de protection de l'étude (ici Diffusion Restreinte).",
        "**Frise des ateliers** : un clic ouvre l'atelier ; l'atelier en cours est mis en évidence.",
        "**Menu de gauche** : les activités de chaque atelier, avec leur état (cercle vert = complète, cercle partiel = en cours), puis les outils de l'étude (carte de la menace, métriques, versions, partage, exports).",
        "**À droite de la frise** : l'état de l'enregistrement, les boutons annuler / rétablir et le bouton **?** de l'aide méthodologique.",
      ] },
      { h: "Enregistrement automatique" },
      { p: "Chaque modification est enregistrée automatiquement (« Enregistré » s'affiche). Si un collègue modifie la même étude en même temps, Beffroi RM signale le conflit au lieu d'écraser son travail. En cas de coupure, les modifications en attente sont conservées dans le navigateur et renvoyées au retour de la connexion." },
      { h: "Aide méthodologique" },
      { p: "Le bouton **?** ouvre, pour chaque activité, un rappel de la méthode : objectif, participants, durée indicative, données de sortie, conseils et référence au guide ANSSI. Depuis ce panneau, le lien **Tutoriel illustré** ouvre le chapitre correspondant de cette documentation." },
      { img: "aide-methodologique", alt: "Panneau d'aide méthodologique" },
      { h: "Raccourcis clavier" },
      { list: [
        "`Alt` + `1` … `5` : aller à l'atelier correspondant ; `Alt` + `0` : vue d'ensemble.",
        "`Ctrl` + `Z` / `Ctrl` + `Y` : annuler / rétablir.",
        "`Ctrl` + `S` : forcer l'enregistrement.",
        "`Échap` : fermer une fiche ou une fenêtre.",
      ] },
    ],
  },

  // ───────────── Conduire une étude ─────────────
  {
    id: "atelier-1",
    part: "Conduire une étude",
    title: "Atelier 1 — Cadrage et socle de sécurité",
    summary: "Cadre de l'étude, périmètre métier et technique, événements redoutés, socle de sécurité.",
    blocks: [
      { p: "L'atelier 1 fixe le cadre : ce que l'on protège, ce que l'on redoute, et le niveau de sécurité déjà en place. Il réunit la direction, les métiers, le RSSI et la DSI." },
      { h: "Cadre de l'étude" },
      { p: "Décrivez l'**objet de l'étude** et sa **finalité** : ce choix détermine les ateliers à conduire (une étude complète pour une homologation, un atelier 1 seul pour un socle de sécurité…). Précisez les objectifs, les participants, le **responsable de l'acceptation des risques résiduels**, les cycles de revue (stratégique et opérationnel), les hypothèses et les contraintes." },
      { img: "a1-cadre", alt: "Cadre de l'étude" },
      { h: "Périmètre métier et technique" },
      { steps: [
        "Ajoutez les **missions** de l'objet étudié (bouton **Mission**).",
        "Onglet **Valeurs métier** : pour chaque processus ou information essentiel, indiquez sa nature, son responsable et ses besoins de sécurité **D I C T** (disponibilité, intégrité, confidentialité, traçabilité).",
        "Onglet **Biens supports** : systèmes, locaux, personnes et partenaires sur lesquels reposent les valeurs métier.",
        "Onglet **Carte du périmètre** : vue graphique des liens entre missions, valeurs métier et biens supports.",
      ] },
      { img: "a1-perimetre", alt: "Valeurs métier et besoins DICT" },
      { tip: "Un périmètre déjà inventorié ailleurs ? **Modèle CSV** fournit le gabarit, **Importer CSV** charge valeurs métier et biens supports d'un coup." },
      { h: "Événements redoutés" },
      { p: "Pour chaque valeur métier, décrivez ce que l'on redoute (perte, altération, fuite, interruption…), les critères atteints, les catégories d'impacts et la **gravité** sur l'échelle G1 à G4 (ou G5). Le tableau du haut croise gravité et valeurs métier ; l'échelle de gravité est rappelée à droite." },
      { img: "a1-er", alt: "Événements redoutés et gravité par valeur métier" },
      { p: "Cliquez sur une ligne pour ouvrir la **fiche** de l'événement : description des impacts, gravité et justification de la cotation." },
      { img: "a1-er-fiche", alt: "Fiche d'un événement redouté" },
      { h: "Socle de sécurité" },
      { p: "Ajoutez les **référentiels** applicables (guide d'hygiène de l'ANSSI, ISO 27001, référentiel interne…) et indiquez pour chaque exigence son état d'application et les écarts. Le radar **Couverture du socle** montre les domaines faibles. Concluez par la **décision de poursuite** : renforcer d'abord le socle, ou poursuivre l'étude en considérant les non-conformités." },
      { img: "a1-socle", alt: "Socle de sécurité et couverture" },
    ],
  },
  {
    id: "atelier-2",
    part: "Conduire une étude",
    title: "Atelier 2 — Sources de risque",
    summary: "Couples source de risque / objectif visé, pertinence, sélection des couples prioritaires.",
    blocks: [
      { p: "Qui pourrait porter atteinte aux missions, et dans quel but ? L'atelier 2 identifie les **sources de risque** (SR) et leurs **objectifs visés** (OV), puis évalue la pertinence de chaque couple." },
      { h: "Couples SR/OV" },
      { steps: [
        "Cliquez sur **Source de risque** et choisissez sa catégorie (organisation criminelle, concurrent, activiste, État…) dans la base de connaissances.",
        "Pour chaque source, ajoutez un ou plusieurs **objectifs visés**.",
        "Cotez la **motivation**, les **ressources** et l'**activité** : la **pertinence** est calculée par la grille affichée à droite (fiche méthode 4), et la priorité en découle.",
        "Cochez **Retenu** pour les couples à étudier dans les ateliers suivants.",
      ] },
      { img: "a2-couples", alt: "Couples source de risque / objectif visé" },
      { tip: "3 à 6 couples variés constituent généralement une base suffisante ; le bandeau bleu en haut de page vous l'indique au fil de la sélection." },
      { h: "Cartographie et croisement avec les événements redoutés" },
      { p: "Le radar place chaque couple selon sa pertinence : plus il est proche du centre, plus il est pertinent. Privilégiez des couples proches du centre et suffisamment distincts, qui touchent des valeurs métier différentes. Le croisement avec les événements redoutés prépare l'atelier 3." },
      { img: "a2-carto", alt: "Radar des sources de risque" },
    ],
  },
  {
    id: "atelier-3",
    part: "Conduire une étude",
    title: "Atelier 3 — Scénarios stratégiques",
    summary: "Dangerosité de l'écosystème, scénarios stratégiques et chemins d'attaque, mesures sur l'écosystème.",
    blocks: [
      { p: "Les attaquants passent souvent par l'**écosystème** : prestataires, fournisseurs, partenaires, clients. L'atelier 3 repère les parties prenantes dangereuses et construit des **scénarios stratégiques** de haut niveau." },
      { h: "Cartographie de l'écosystème" },
      { p: "Ajoutez chaque **partie prenante** et cotez sa dépendance, sa pénétration, sa maturité cyber et la confiance qu'on lui accorde. Le niveau de dangerosité en découle et la place sur le radar : les parties prenantes des zones de **danger** et de **contrôle** sont critiques. Les seuils des zones sont réglables à droite." },
      { img: "a3-ecosysteme", alt: "Radar de dangerosité de l'écosystème" },
      { h: "Scénarios stratégiques" },
      { steps: [
        "Sous un couple SR/OV retenu, cliquez sur **Scénario** et donnez-lui un intitulé.",
        "Ajoutez un ou plusieurs **chemins d'attaque**, décrits comme une séquence d'événements : glissez depuis la **palette** de droite les parties prenantes critiques (événements intermédiaires) et les événements redoutés atteints.",
        "La **gravité du scénario** est calculée à partir des événements redoutés impliqués ; le lien **Forcer…** permet de la fixer autrement.",
      ] },
      { img: "a3-scenarios", alt: "Scénarios stratégiques par couple SR/OV" },
      { p: "Le schéma **Représentation du scénario** se construit tout seul : source de risque, écosystème traversé, puis valeurs métier atteintes." },
      { img: "a3-scenarios-schema", alt: "Schéma d'un scénario stratégique et de ses chemins d'attaque" },
      { h: "Mesures sur l'écosystème" },
      { p: "Pour réduire la dangerosité des parties prenantes critiques, fixez des **niveaux cibles** (dépendance, pénétration, maturité, confiance) et les mesures associées. Les deux radars comparent la dangerosité **initiale** et **résiduelle**." },
      { img: "a3-mesures", alt: "Dangerosité initiale et résiduelle" },
    ],
  },
  {
    id: "atelier-4",
    part: "Conduire une étude",
    title: "Atelier 4 — Scénarios opérationnels",
    summary: "Graphes d'attaque, actions élémentaires, méthodes de cotation de la vraisemblance.",
    blocks: [
      { p: "Chaque chemin d'attaque de l'atelier 3 est décliné en **scénario opérationnel** : les modes opératoires concrets de l'attaquant, sous forme de graphe d'actions élémentaires portant sur les biens supports." },
      { h: "Choisir la méthode de vraisemblance" },
      { list: [
        "**Expresse** : cotation directe de la vraisemblance du scénario (ou probabilité de succès × difficulté technique).",
        "**Standard** : probabilité de succès de chaque action ; l'indice se cumule le long du graphe (ET = minimum, OU = maximum).",
        "**Avancée** : probabilité de succès et difficulté technique de chaque action ; le scénario retient le mode opératoire le plus vraisemblable.",
      ] },
      { img: "a4-scenarios", alt: "Scénarios opérationnels et méthode de vraisemblance" },
      { h: "Construire le graphe d'attaque" },
      { steps: [
        "Sélectionnez un chemin d'attaque dans la liste (sa vraisemblance calculée est affichée à droite).",
        "Glissez des actions depuis le **catalogue d'actions élémentaires** (classées par phase : connaître, rentrer, trouver, exploiter) ou créez une **action personnalisée**.",
        "Reliez les actions entre elles, puis à l'**objectif** ; ajoutez des opérateurs **ET** / **OU** si plusieurs conditions se combinent.",
        "Cliquez sur une action pour la détailler : phase, bien support ciblé, partie prenante, probabilité de succès (une aide à la cotation est fournie).",
        "La **vraisemblance globale** est calculée depuis le graphe ; justifiez-la, ou forcez-la avec **Forcer…**.",
      ] },
      { img: "a4-graphe", alt: "Graphe d'attaque en plein écran avec une action sélectionnée" },
      { tip: "Le bouton **Plein écran** donne toute la place au graphe ; la molette zoome, et la mini-carte en bas à droite permet de s'y déplacer." },
    ],
  },
  {
    id: "atelier-5",
    part: "Conduire une étude",
    title: "Atelier 5 — Traitement du risque",
    summary: "Cartographie des risques, stratégie, plan de traitement, risques résiduels, cadre de suivi.",
    blocks: [
      { p: "Chaque chemin d'attaque et son scénario opérationnel forment un **scénario de risque**, positionné selon la gravité (atelier 3) et la vraisemblance (atelier 4)." },
      { h: "Synthèse des risques" },
      { p: "La **cartographie du risque initial** place chaque risque R1, R2… dans la matrice gravité × vraisemblance ; les couleurs correspondent aux niveaux de risque et à leur acceptabilité. Filtrez par source de risque ou par gravité." },
      { img: "a5-synthese", alt: "Cartographie du risque initial" },
      { h: "Stratégie et plan de traitement" },
      { steps: [
        "Onglet **Stratégie de traitement** : cliquez sur un risque pour choisir sa stratégie : **réduire**, **accepter**, **transférer / partager** ou **refuser / éviter**.",
        "Bouton **Mesure** : ajoutez les mesures de sécurité, issues du socle, de l'écosystème ou des scénarios, avec leur origine, responsable, échéance, coût / complexité, priorité, statut et scénarios de risque traités.",
        "Onglet **Plan de traitement** : l'ensemble des mesures, échelonnées dans le temps.",
        "Onglet **Avancement du plan** : suivi de la réalisation des mesures.",
      ] },
      { img: "a5-traitement", alt: "Stratégie de traitement" },
      { h: "Risques résiduels" },
      { p: "Réévaluez chaque risque après application des mesures : **glissez la pastille** du risque sur la cartographie résiduelle, ou choisissez la gravité et la vraisemblance résiduelles dans le tableau. L'option **Afficher l'évolution** trace le déplacement initial → résiduel. Le bouton **Documenter** ouvre la fiche du risque résiduel (vulnérabilités, mesures, justification)." },
      { img: "a5-residuels", alt: "Risques initiaux et résiduels" },
      { h: "Cadre de suivi" },
      { p: "Fixez la fréquence et les membres du **comité de pilotage**, la date du prochain comité, et les **indicateurs de pilotage** (cible, valeur actuelle, fréquence, responsable). Ce cadre déclenche les revues opérationnelles et stratégiques de l'étude (voir [[versions|Versions]])." },
      { img: "a5-suivi", alt: "Cadre de suivi des risques" },
    ],
  },

  // ───────────── Outils de l'étude ─────────────
  {
    id: "carte-menace",
    part: "Outils de l'étude",
    title: "Carte de la menace",
    summary: "Vue de synthèse pour la direction : qui menace, dans quel but, avec quel niveau de risque.",
    blocks: [
      { p: "La carte de la menace réunit sur une page les résultats des ateliers 2 à 5 : le **flux de la menace** (sources de risque → objectifs visés → valeurs métier → niveau de risque), le radar des sources de risque et celui de l'écosystème. Cochez **Niveaux résiduels** pour montrer l'effet du plan de traitement." },
      { img: "carte-menace", alt: "Flux de la menace" },
      { tip: "C'est le support idéal pour présenter l'étude en comité de direction : elle figure aussi dans les rapports PDF et Word." },
    ],
  },
  {
    id: "livrables",
    part: "Outils de l'étude",
    title: "Exports et livrables",
    summary: "Rapports PDF et Word, classeur Excel, sauvegarde JSON, imports.",
    blocks: [
      { p: "La page **Exports et imports** produit les livrables de l'étude, par atelier ou complets. Les fichiers sont générés **dans votre navigateur** : rien ne transite par un service extérieur." },
      { img: "exports", alt: "Exports et livrables" },
      { list: [
        "**Rapport PDF** : rapport figé, prêt à diffuser ou à archiver, avec police et visuels embarqués.",
        "**Rapport Word** : même contenu, modifiable, avec tableaux et visuels (cartographies, radars, scénarios, graphes d'attaque, matrices).",
        "**Classeur Excel** : un onglet par activité, avec filtres.",
        "**Fichier JSON** : export complet et ré-importable (sauvegarde, transfert vers une autre instance, archivage).",
      ] },
      { warn: "Les fichiers exportés ne sont **pas chiffrés** : la mention de protection figure en en-tête et en pied de page de chaque livrable ; stockez-les et transmettez-les conformément à cette mention." },
      { h: "Imports" },
      { list: [
        "Étude complète (JSON ou modèle Excel ANSSI) : depuis le portefeuille, bouton **Importer**.",
        "Valeurs métier et biens supports (CSV) : atelier 1, **Périmètre métier et technique**.",
        "Exigences d'un référentiel (CSV) : atelier 1, **Socle de sécurité**.",
        "Bases de connaissances : **Métriques et référentiels** › **Bases de connaissances**.",
      ] },
    ],
  },
  {
    id: "versions",
    part: "Outils de l'étude",
    title: "Versions et partage",
    summary: "Figer une version à chaque cycle, donner accès à ses collègues.",
    blocks: [
      { h: "Versions de l'analyse" },
      { p: "Une étude vit : elle est revue à chaque **cycle opérationnel** (incidents, nouvelles vulnérabilités → version x.y+1) et à chaque **cycle stratégique** (revue complète → version x+1.0). **Nouvelle version** fige l'état actuel, avec les ateliers concernés et un résumé des modifications. Les versions antérieures restent consultables en lecture seule, et la liste des modifications en cours est affichée." },
      { img: "versions", alt: "Versions de l'analyse" },
      { h: "Partage et droits" },
      { p: "Seules les personnes et groupes listés accèdent à l'étude (**besoin d'en connaître**). Ajoutez un collègue ou un groupe, puis choisissez son droit : **Lecture**, **Lecture et écriture** ou **Propriétaire** (qui peut aussi partager et supprimer). Cette page permet aussi de modifier le nom, la référence et la mention de protection de l'étude." },
      { img: "partage", alt: "Propriétés, partage et droits" },
      { tip: "Le compte administrateur ne peut pas recevoir d'accès aux analyses. Tous les accès et modifications sont journalisés." },
    ],
  },
  {
    id: "parametres",
    part: "Outils de l'étude",
    title: "Métriques et référentiels",
    summary: "Adapter échelles, grilles, règles de calcul et bases de connaissances à l'organisation.",
    blocks: [
      { p: "Toutes les échelles et grilles de l'étude sont adaptables : niveaux de risque et stratégie associée, gravité, vraisemblance, grilles de croisement (pertinence des couples SR/OV, matrice de risque), règles de calcul et bases de connaissances (catégories de sources de risque, parties prenantes, actions élémentaires…)." },
      { img: "parametres", alt: "Métriques et bases de connaissances" },
      { tip: "**Exporter les métriques** puis **Importer des métriques** dans une autre étude permet de partager les mêmes échelles dans toute l'organisation. **Réinitialiser** revient aux valeurs du guide ANSSI." },
    ],
  },

  // ───────────── Administration ─────────────
  {
    id: "administration",
    part: "Administration",
    title: "Administrer les comptes et le journal",
    summary: "Créer les comptes, gérer les groupes, réinitialiser un second facteur, vérifier le journal d'audit.",
    blocks: [
      { p: "Le compte **admin** est créé au premier démarrage. Il gère les accès mais n'a **pas accès** au contenu des analyses. Sa session expire après 15 minutes d'inactivité et le second facteur lui est exigé, sauf si l'exploitant a choisi la politique `MFA_POLICY=optional`." },
      { h: "Créer un compte" },
      { steps: [
        "Onglet **Utilisateurs** : cliquez sur **Nouvel utilisateur**.",
        "Saisissez un **identifiant** nominatif, le **nom affiché**, et si besoin le courriel et la fonction.",
        "Choisissez le rôle (**Analyste** ou **Administrateur**), le mode d'authentification (mot de passe local ou authentification unique) et, si l'analyste peut créer des études, cochez **Peut créer et importer des études**.",
        "**Enregistrer** : un **mot de passe temporaire** s'affiche une seule fois. Transmettez-le par un canal sûr ; il devra être changé à la première connexion.",
      ] },
      { img: "admin-nouvel-utilisateur", alt: "Création d'un compte" },
      { img: "admin-mot-de-passe-temporaire", alt: "Mot de passe temporaire à transmettre" },
      { p: "La liste des comptes indique le rôle, l'état (actif, mot de passe à changer, verrouillé, désactivé) et la dernière connexion. Cliquez sur un compte pour le modifier, le désactiver, réinitialiser son mot de passe ou son **second facteur** (téléphone perdu) : ses sessions sont alors fermées." },
      { img: "admin-utilisateurs", alt: "Liste des comptes" },
      { h: "Groupes" },
      { p: "Onglet **Groupes** : regroupez les analystes (équipe SSI, direction métier…) pour partager une étude avec tout un groupe en une fois." },
      { h: "Journal d'audit" },
      { p: "Chaque connexion, consultation, modification, partage ou export est tracé. Filtrez par action, utilisateur ou période, exportez en **CSV**, et cliquez sur **Vérifier l'intégrité** : le journal est scellé et chaîné, toute altération est détectée. Les entrées de plus d'un an peuvent être purgées." },
      { img: "admin-journal", alt: "Journal d'audit et vérification d'intégrité" },
    ],
  },

  // ───────────── Référence ─────────────
  {
    id: "glossaire",
    part: "Référence",
    title: "Glossaire EBIOS Risk Manager",
    summary: "Les termes de la méthode, tels qu'employés dans l'application.",
    blocks: [
      { terms: [
        ["Valeur métier (VM)", "Composante importante pour l'organisation dans l'accomplissement de ses missions : service, fonction, processus ou information."],
        ["Bien support (BS)", "Composante du système d'information sur laquelle repose une valeur métier : matériel, logiciel, réseau, local, personne, partenaire."],
        ["Besoins DICT", "Besoins de sécurité d'une valeur métier : Disponibilité, Intégrité, Confidentialité, Traçabilité."],
        ["Événement redouté (ER)", "Atteinte à une valeur métier (perte, altération, fuite…) et ses impacts, cotée en gravité."],
        ["Gravité (G)", "Estimation du niveau et de l'intensité des effets d'un risque, de G1 (mineure) à G4 (critique), voire G5."],
        ["Socle de sécurité", "Ensemble des référentiels applicables (hygiène, normes, réglementation) et de leur état d'application."],
        ["Source de risque (SR)", "Élément, personne, groupe ou organisation susceptible d'engendrer un risque (État, organisation criminelle, concurrent, activiste…)."],
        ["Objectif visé (OV)", "Finalité poursuivie par une source de risque (espionnage, sabotage, lucre, influence…)."],
        ["Pertinence", "Intérêt d'un couple SR/OV, déduit de la motivation et des ressources de la source de risque (fiche méthode 4)."],
        ["Partie prenante (PP)", "Élément de l'écosystème (prestataire, fournisseur, partenaire, client) en interaction avec l'objet étudié."],
        ["Dangerosité", "(Dépendance × Pénétration) / (Maturité cyber × Confiance) : plus elle est élevée, plus la partie prenante est un vecteur d'attaque."],
        ["Scénario stratégique", "Chemin(s) d'attaque qu'une source de risque pourrait emprunter pour atteindre son objectif, via l'écosystème, jusqu'aux événements redoutés."],
        ["Chemin d'attaque", "Séquence d'événements intermédiaires et redoutés constituant une déclinaison d'un scénario stratégique."],
        ["Scénario opérationnel", "Mode opératoire concret réalisant un chemin d'attaque, décrit par un graphe d'actions élémentaires."],
        ["Action élémentaire", "Action unitaire de l'attaquant sur un bien support, classée par phase : connaître, rentrer, trouver, exploiter."],
        ["Vraisemblance (V)", "Probabilité qu'un scénario se réalise, de V1 (peu vraisemblable) à V4 (quasi certain)."],
        ["Scénario de risque", "Couple scénario stratégique / scénario opérationnel, positionné selon sa gravité et sa vraisemblance."],
        ["Risque résiduel", "Risque subsistant après application des mesures de traitement ; son acceptation relève du responsable désigné à l'atelier 1."],
        ["Mention de protection", "Niveau de sensibilité de l'étude (Non protégé, Diffusion Restreinte…), affiché sur chaque écran et chaque livrable."],
      ] },
      { p: "Pour aller plus loin : guide **EBIOS Risk Manager** v1.5 de l'ANSSI et ses fiches méthodes (cyber.gouv.fr)." },
    ],
  },
];

/** Chapitre de la documentation correspondant à une section d'étude (aide contextuelle). */
export function chapterForSection(section: string): string {
  const w = /^a(\d)-/.exec(section);
  if (w) return `atelier-${w[1]}`;
  return ({ "carte-menace": "carte-menace", exports: "livrables", versions: "versions", partage: "versions", parametres: "parametres" } as Record<string, string>)[section] ?? "interface";
}
