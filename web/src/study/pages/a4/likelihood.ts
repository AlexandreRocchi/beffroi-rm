import type { LikelihoodMethod } from "@beffroi/shared";

export const METHODS: { id: LikelihoodMethod; label: string; desc: string }[] = [
  { id: "express", label: "Expresse", desc: "Cotation directe de la vraisemblance globale du scénario (et, au choix, de chaque mode opératoire), ou croisement probabilité de succès × difficulté technique au niveau du scénario." },
  { id: "standard", label: "Standard", desc: "Probabilité de succès de chaque action élémentaire ; indice cumulé = min(Pr de l'action, max des indices des prédécesseurs) ; ET = min, OU = max." },
  { id: "advanced", label: "Avancée", desc: "Probabilité de succès et difficulté technique de chaque action ; la vraisemblance de chaque mode opératoire croise Pr et difficulté ; le scénario retient le mode le plus vraisemblable." },
];

export const SOURCE_LABEL: Record<string, string> = {
  forced: "valeur forcée",
  express: "cotation expresse",
  graph: "calculée depuis le graphe d'attaque",
  modes: "maximum des modes opératoires",
  pertinence: "pertinence du couple SR/OV",
  none: "non évaluée",
};
