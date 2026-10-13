export const WS_COLORS: Record<number, string> = {
  1: "#3450b4",
  2: "#0e7c72",
  3: "#c25e0b",
  4: "#b8323a",
  5: "#6c45a6",
};

export const WORKSHOPS: { n: 1 | 2 | 3 | 4 | 5; label: string; short: string; items: { key: string; label: string }[] }[] = [
  {
    n: 1, label: "Cadrage et socle de sécurité", short: "Cadrage",
    items: [
      { key: "a1-cadre", label: "Cadre de l'étude" },
      { key: "a1-perimetre", label: "Périmètre métier et technique" },
      { key: "a1-er", label: "Événements redoutés" },
      { key: "a1-socle", label: "Socle de sécurité" },
    ],
  },
  {
    n: 2, label: "Sources de risque", short: "Sources de risque",
    items: [
      { key: "a2-couples", label: "Couples SR/OV" },
      { key: "a2-carto", label: "Cartographie et croisement ER" },
    ],
  },
  {
    n: 3, label: "Scénarios stratégiques", short: "Scénarios stratégiques",
    items: [
      { key: "a3-ecosysteme", label: "Cartographie de l'écosystème" },
      { key: "a3-scenarios", label: "Scénarios stratégiques" },
      { key: "a3-mesures", label: "Mesures sur l'écosystème" },
    ],
  },
  {
    n: 4, label: "Scénarios opérationnels", short: "Scénarios opérationnels",
    items: [{ key: "a4-scenarios", label: "Graphes d'attaque et vraisemblance" }],
  },
  {
    n: 5, label: "Traitement du risque", short: "Traitement du risque",
    items: [
      { key: "a5-synthese", label: "Synthèse des risques" },
      { key: "a5-traitement", label: "Stratégie et plan de traitement" },
      { key: "a5-residuels", label: "Risques résiduels" },
      { key: "a5-suivi", label: "Cadre de suivi" },
    ],
  },
];

export const TOOLS: { key: string; label: string; icon: string }[] = [
  { key: "carte-menace", label: "Carte de la menace", icon: "map" },
  { key: "parametres", label: "Métriques et référentiels", icon: "settings" },
  { key: "versions", label: "Versions", icon: "history" },
  { key: "partage", label: "Partage et droits", icon: "share" },
  { key: "exports", label: "Exports et imports", icon: "download" },
];

export function workshopOf(section: string): number | null {
  const m = /^a(\d)-/.exec(section);
  return m ? Number(m[1]) : null;
}

export const SECTION_PROGRESS_KEY: Record<string, string[]> = {
  "a1-cadre": ["a1-cadre"],
  "a1-perimetre": ["a1-perimetre"],
  "a1-er": ["a1-er"],
  "a1-socle": ["a1-socle"],
  "a2-couples": ["a2-couples"],
  "a2-carto": ["a2-selection"],
  "a3-ecosysteme": ["a3-ecosysteme"],
  "a3-scenarios": ["a3-scenarios"],
  "a3-mesures": ["a3-mesures"],
  "a4-scenarios": ["a4-scenarios"],
  "a5-synthese": ["a5-synthese"],
  "a5-traitement": ["a5-traitement"],
  "a5-residuels": ["a5-residuels"],
  "a5-suivi": ["a5-suivi"],
};
