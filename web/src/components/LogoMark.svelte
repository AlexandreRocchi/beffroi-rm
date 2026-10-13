<script lang="ts">
  import { BRAND } from "../lib/brand";

  /** `size` à null : pas de dimensions intrinsèques (rendu raster qui fixe lui-même la taille). */
  let { size = 32, inverted = false, title }: { size?: number | null; inverted?: boolean; title?: string } = $props();
  const SHIELD = "M6 5.6C6 4.7 6.7 4 7.6 4h32.8c.9 0 1.6.7 1.6 1.6V23c0 10.6-7.4 17.7-18 22C13.4 40.7 6 33.6 6 23Z";
  // Anneau r = 10,5 : circonférence 65,97 ; 5 segments séparés d'un espace de 3 centré en haut.
  const RING = { cx: 24, cy: 22.5, r: 10.5, dash: "10.19 3", rotate: -81.81 };
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size ?? undefined} height={size ?? undefined} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
  <path d={SHIELD} fill={inverted ? "#ffffff" : BRAND.navy} />
  <circle cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke={inverted ? BRAND.navy : "#ffffff"} stroke-width="3.8" stroke-dasharray={RING.dash} transform="rotate({RING.rotate} {RING.cx} {RING.cy})" />
  <circle cx={RING.cx} cy={RING.cy} r="3.6" fill={BRAND.red} />
</svg>
