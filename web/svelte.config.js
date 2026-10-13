import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// Les lignes et cartes cliquables reçoivent l'action `activable` (focus clavier, Entrée/Espace) :
// l'analyse statique ne la voit pas, d'où l'exclusion de ces deux avertissements.
const IGNORED = new Set(["a11y_click_events_have_key_events", "a11y_no_static_element_interactions", "a11y_no_noninteractive_element_interactions"]);

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    warningFilter: (w) => !IGNORED.has(w.code),
  },
};
