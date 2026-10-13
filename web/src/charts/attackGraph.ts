export const LANE_W = 290;
export const ACTION_W = 210;
export const ACTION_H = 78;

/** Dimensions d'un nœud de graphe d'attaque selon son type. */
export const nodeSize = (t: string) => (t === "action" ? { w: ACTION_W, h: ACTION_H } : t === "goal" ? { w: 190, h: 56 } : { w: 46, h: 46 });
