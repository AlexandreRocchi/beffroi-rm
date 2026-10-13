import { uid } from "./defaults.js";
import type { Referential, ReferentialType } from "./types.js";

export interface LibraryReferential {
  key: string;
  type: ReferentialType;
  name: string;
  description: string;
  source: string;
  requirements: { ref: string; title: string; section?: string }[];
}

const HYGIENE_SECTIONS: Record<string, string> = {
  I: "Sensibiliser et former",
  II: "Connaître le système d'information",
  III: "Authentifier et contrôler les accès",
  IV: "Sécuriser les postes",
  V: "Sécuriser le réseau",
  VI: "Sécuriser l'administration",
  VII: "Gérer le nomadisme",
  VIII: "Maintenir à jour le système d'information",
  IX: "Superviser, auditer, réagir",
  X: "Pour aller plus loin",
};

/** Guide d'hygiène informatique de l'ANSSI v2.0 (2017) — Licence Ouverte Etalab. */
const HYGIENE: LibraryReferential = {
  key: "anssi-hygiene-42",
  type: "hygiene",
  name: "Guide d'hygiène informatique de l'ANSSI (42 mesures)",
  description: "Renforcer la sécurité de son système d'information en 42 mesures — version 2.0, septembre 2017.",
  source: "https://messervices.cyber.gouv.fr/guides/guide-dhygiene-informatique",
  requirements: [
    "I — Former les équipes opérationnelles à la sécurité des systèmes d'information",
    "I — Sensibiliser les utilisateurs aux bonnes pratiques élémentaires de sécurité informatique",
    "I — Maîtriser les risques de l'infogérance",
    "II — Identifier les informations et serveurs les plus sensibles et maintenir un schéma du réseau",
    "II — Disposer d'un inventaire exhaustif des comptes privilégiés et le maintenir à jour",
    "II — Organiser les procédures d'arrivée, de départ et de changement de fonction des utilisateurs",
    "II — Autoriser la connexion au réseau de l'entité aux seuls équipements maîtrisés",
    "III — Identifier nommément chaque personne accédant au système et distinguer les rôles utilisateur/administrateur",
    "III — Attribuer les bons droits sur les ressources sensibles du système d'information",
    "III — Définir et vérifier des règles de choix et de dimensionnement des mots de passe",
    "III — Protéger les mots de passe stockés sur les systèmes",
    "III — Changer les éléments d'authentification par défaut sur les équipements et services",
    "III — Privilégier lorsque c'est possible une authentification forte",
    "IV — Mettre en place un niveau de sécurité minimal sur l'ensemble du parc informatique",
    "IV — Se protéger des menaces relatives à l'utilisation de supports amovibles",
    "IV — Utiliser un outil de gestion centralisée afin d'homogénéiser les politiques de sécurité",
    "IV — Activer et configurer le pare-feu local des postes de travail",
    "IV — Chiffrer les données sensibles transmises par voie Internet",
    "V — Segmenter le réseau et mettre en place un cloisonnement entre ces zones",
    "V — S'assurer de la sécurité des réseaux d'accès Wi-Fi et de la séparation des usages",
    "V — Utiliser des protocoles sécurisés dès qu'ils existent",
    "V — Mettre en place une passerelle d'accès sécurisé à Internet",
    "V — Cloisonner les services visibles depuis Internet du reste du système d'information",
    "V — Protéger sa messagerie professionnelle",
    "V — Sécuriser les interconnexions réseau dédiées avec les partenaires",
    "V — Contrôler et protéger l'accès aux salles serveurs et aux locaux techniques",
    "VI — Interdire l'accès à Internet depuis les postes ou serveurs utilisés pour l'administration du système d'information",
    "VI — Utiliser un réseau dédié et cloisonné pour l'administration du système d'information",
    "VI — Limiter au strict besoin opérationnel les droits d'administration sur les postes de travail",
    "VII — Prendre des mesures de sécurisation physique des terminaux nomades",
    "VII — Chiffrer les données sensibles, en particulier sur le matériel potentiellement perdable",
    "VII — Sécuriser la connexion réseau des postes utilisés en situation de nomadisme",
    "VII — Adopter des politiques de sécurité dédiées aux terminaux mobiles",
    "VIII — Définir une politique de mise à jour des composants du système d'information",
    "VIII — Anticiper la fin de la maintenance des logiciels et systèmes et limiter les adhérences logicielles",
    "IX — Activer et configurer les journaux des composants les plus importants",
    "IX — Définir et appliquer une politique de sauvegarde des composants critiques",
    "IX — Procéder à des contrôles et audits de sécurité réguliers puis appliquer les actions correctives associées",
    "IX — Désigner un référent en sécurité des systèmes d'information et le faire connaître auprès du personnel",
    "IX — Définir une procédure de gestion des incidents de sécurité",
    "X — Mener une analyse de risques formelle",
    "X — Privilégier l'usage de produits et de services qualifiés par l'ANSSI",
  ].map((t, i) => {
    const [num, title] = t.split(" — ");
    return { ref: `Règle ${i + 1}`, title, section: `${num} — ${HYGIENE_SECTIONS[num]}` };
  }),
};

/** Directive (UE) 2022/2555 (NIS 2), article 21 §2. */
const NIS2: LibraryReferential = {
  key: "nis2-art21",
  type: "regulation",
  name: "Directive NIS 2 — article 21 (mesures de gestion des risques)",
  description: "Directive (UE) 2022/2555, article 21, paragraphe 2 : mesures minimales de gestion des risques en matière de cybersécurité.",
  source: "https://eur-lex.europa.eu/eli/dir/2022/2555/oj",
  requirements: [
    ["21.2.a", "Politiques relatives à l'analyse des risques et à la sécurité des systèmes d'information"],
    ["21.2.b", "Gestion des incidents"],
    ["21.2.c", "Continuité des activités (gestion des sauvegardes, reprise des activités) et gestion des crises"],
    ["21.2.d", "Sécurité de la chaîne d'approvisionnement, y compris les relations avec les fournisseurs et prestataires directs"],
    ["21.2.e", "Sécurité de l'acquisition, du développement et de la maintenance des réseaux et systèmes d'information, y compris le traitement et la divulgation des vulnérabilités"],
    ["21.2.f", "Politiques et procédures pour évaluer l'efficacité des mesures de gestion des risques en matière de cybersécurité"],
    ["21.2.g", "Pratiques de base en matière de cyberhygiène et formation à la cybersécurité"],
    ["21.2.h", "Politiques et procédures relatives à l'utilisation de la cryptographie et, le cas échéant, du chiffrement"],
    ["21.2.i", "Sécurité des ressources humaines, politiques de contrôle d'accès et gestion des actifs"],
    ["21.2.j", "Authentification à plusieurs facteurs ou continue, communications vocales, vidéo et textuelles sécurisées, systèmes sécurisés de communication d'urgence"],
  ].map(([ref, title]) => ({ ref, title })),
};

export const REFERENTIAL_LIBRARY: LibraryReferential[] = [HYGIENE, NIS2];

export function instantiateReferential(lib: LibraryReferential): Referential {
  return {
    id: uid(),
    type: lib.type,
    name: lib.name,
    description: lib.description,
    statusForced: null,
    requirements: lib.requirements.map((r) => ({
      id: uid(),
      ref: r.ref,
      title: r.title,
      ...(r.section ? { section: r.section } : {}),
      status: "unknown",
      gap: "",
      justification: "",
    })),
  };
}
