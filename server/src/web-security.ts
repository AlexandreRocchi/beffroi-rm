import type { NextFunction, Request, Response } from "express";
import { CSRF_HEADER, HttpError } from "./auth.js";

/**
 * Politique de sécurité du contenu (guide ANSSI « Recommandations pour la mise en œuvre d'un site
 * web ») : uniquement des ressources servies par Beffroi RM ; aucun script en ligne ; aucune feuille
 * de style injectée (seuls les attributs « style » des composants sont admis).
 */
export function csp(secure: boolean) {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    ...(secure ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** En-têtes de sécurité de toutes les réponses ; l'API n'est jamais mise en cache. */
export function securityHeaders(secure: boolean) {
  const policy = csp(secure);
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Origin-Agent-Cluster", "?1");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader(
      "Permissions-Policy",
      "accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), serial=(), usb=(), interest-cohort=()",
    );
    res.setHeader("Content-Security-Policy", policy);
    if (secure) res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    if (req.path.startsWith("/api/")) {
      // Données sensibles : jamais mises en cache (navigateur, proxy).
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
    }
    next();
  };
}

/**
 * Contrôles des requêtes d'API : isolation des ressources (Fetch Metadata), protection CSRF et
 * corps JSON uniquement. `allowCrossSite` admet certaines navigations (retour OIDC).
 */
export function requestGuards(allowCrossSite: (req: Request) => boolean = () => false) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Isolation des ressources (Fetch Metadata) : l'API ne répond qu'à l'application elle-même.
    const site = req.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none" && !allowCrossSite(req)) throw new HttpError(403, "Requête inter-sites refusée.");
    const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (mutating) {
      // Protection CSRF : en-tête personnalisé (impossible à poser en inter-origines sans CORS),
      // cookie SameSite=Strict, et origine de la requête identique à l'hôte servi.
      if (req.get(CSRF_HEADER) !== "1") throw new HttpError(403, "En-tête anti-CSRF manquant.");
      const origin = req.get("origin");
      if (origin && origin !== "null") {
        let host = "";
        try {
          host = new URL(origin).host;
        } catch {
          /* origine invalide */
        }
        if (host !== req.get("host")) throw new HttpError(403, "Origine de la requête refusée.");
      }
      // Corps non vide : JSON uniquement (une requête sans corps, comme la déconnexion, reste admise).
      const hasBody = Number(req.get("content-length") ?? 0) > 0 || req.get("transfer-encoding") !== undefined;
      if (hasBody && !req.is("application/json")) throw new HttpError(415, "Format de requête non pris en charge (JSON attendu).");
    }
    next();
  };
}
