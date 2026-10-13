import * as client from "openid-client";
import { HttpError } from "./auth.js";
import type { OidcConfig } from "./config.js";
import { one, tx, type DB } from "./db.js";

/** Durée de validité d'une demande d'authentification en attente. */
const REQUEST_TTL_MS = 10 * 60_000;

export interface OidcIdentity {
  issuer: string;
  sub: string;
  username: string;
  displayName: string;
  email: string;
}

/**
 * Client OpenID Connect (flux « code d'autorisation » avec PKCE, state et nonce).
 * Les paramètres de chaque demande sont conservés côté serveur et à usage unique.
 */
export class OidcClient {
  private discovered: Promise<client.Configuration> | null = null;

  constructor(
    readonly settings: OidcConfig,
    private readonly db: DB,
  ) {}

  private configuration(): Promise<client.Configuration> {
    if (!this.discovered) {
      this.discovered = client
        .discovery(new URL(this.settings.issuer), this.settings.clientId, this.settings.clientSecret, undefined, {
          execute: this.settings.allowHttp ? [client.allowInsecureRequests] : [],
        })
        .catch((e) => {
          // Nouvelle tentative à la prochaine demande (fournisseur momentanément indisponible).
          this.discovered = null;
          throw new HttpError(502, `Fournisseur d'identité injoignable : ${(e as Error).message}`);
        });
    }
    return this.discovered;
  }

  /** URL de redirection vers le fournisseur d'identité. */
  async start(): Promise<string> {
    const config = await this.configuration();
    const codeVerifier = client.randomPKCECodeVerifier();
    const state = client.randomState();
    const nonce = client.randomNonce();
    await this.db.query("DELETE FROM oidc_requests WHERE created_at < $1", [Date.now() - REQUEST_TTL_MS]);
    await this.db.query("INSERT INTO oidc_requests (state, code_verifier, nonce, created_at) VALUES ($1,$2,$3,$4)", [state, codeVerifier, nonce, Date.now()]);
    const params: Record<string, string> = {
      redirect_uri: this.settings.redirectUri,
      scope: this.settings.scopes,
      code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: "S256",
      state,
      nonce,
    };
    if (this.settings.acrValues) params.acr_values = this.settings.acrValues;
    return client.buildAuthorizationUrl(config, params).href;
  }

  /** Traite le retour du fournisseur (URL de rappel avec code et state) et renvoie l'identité vérifiée. */
  async finish(query: URLSearchParams): Promise<OidcIdentity> {
    const state = query.get("state") ?? "";
    const request = await tx(this.db, async (c) =>
      one<{ code_verifier: string; nonce: string; created_at: number }>(c, "DELETE FROM oidc_requests WHERE state = $1 RETURNING code_verifier, nonce, created_at", [state]),
    );
    if (!request || Date.now() - request.created_at > REQUEST_TTL_MS) throw new HttpError(400, "Demande d'authentification inconnue ou expirée : recommencez la connexion.");
    if (query.get("error")) throw new HttpError(401, `Authentification refusée par le fournisseur d'identité : ${query.get("error_description") ?? query.get("error")}`);

    const config = await this.configuration();
    // URL de rappel reconstruite à partir de la configuration (indépendante de l'en-tête Host).
    const current = new URL(this.settings.redirectUri);
    current.search = query.toString();
    let tokens;
    try {
      tokens = await client.authorizationCodeGrant(config, current, {
        pkceCodeVerifier: request.code_verifier,
        expectedState: state,
        expectedNonce: request.nonce,
        idTokenExpected: true,
      });
    } catch (e) {
      throw new HttpError(401, `Réponse du fournisseur d'identité invalide : ${(e as Error).message}`);
    }
    const claims = tokens.claims();
    if (!claims) throw new HttpError(401, "Jeton d'identité absent.");
    if (this.settings.acrValues) {
      const accepted = this.settings.acrValues.split(/\s+/);
      if (!claims.acr || !accepted.includes(String(claims.acr))) throw new HttpError(403, "Niveau d'authentification insuffisant (authentification multifacteur exigée).");
    }
    const email = typeof claims.email === "string" ? claims.email : "";
    const preferred = typeof claims.preferred_username === "string" ? claims.preferred_username : email.split("@")[0] || claims.sub;
    const name = typeof claims.name === "string" && claims.name.trim() ? claims.name : [claims.given_name, claims.family_name].filter((x) => typeof x === "string").join(" ") || preferred;
    return {
      issuer: String(claims.iss),
      sub: claims.sub,
      username: preferred.replace(/[^A-Za-z0-9._@-]/g, "").slice(0, 100) || "utilisateur",
      displayName: name.slice(0, 200),
      email: email.slice(0, 200),
    };
  }
}
