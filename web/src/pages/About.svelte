<script lang="ts">
  import LogoMark from "../components/LogoMark.svelte";
  import { auth } from "../lib/auth.svelte";

  const COMPLIANCE: [string, string, string][] = [
    ["Recommandations relatives à l'authentification multifacteur et aux mots de passe", "Implémenté", "Second facteur TOTP exigé par défaut (anti-rejeu, codes de secours) ou authentification unique OpenID Connect avec niveau d'authentification vérifié ; mots de passe ≥ 12 caractères, trois types, mots courants et 5 derniers refusés, empreintes scrypt poivrées, verrouillage, information de dernière connexion."],
    ["Recommandations pour la mise en œuvre d'un site web : maîtriser les standards de sécurité côté navigateur", "Implémenté", "CSP stricte sans script ni feuille de style injectés, COOP/COEP/CORP, Fetch Metadata, contrôle d'origine, HSTS, cookies __Host- HttpOnly SameSite=Strict, protection CSRF, aucune ressource tierce."],
    ["Recommandations de sécurité relatives à TLS", "Implémenté", "TLS 1.2 minimum, suites AEAD à confidentialité persistante, HSTS ; ou terminaison TLS par un reverse proxy conforme ; TLS vérifié vers PostgreSQL."],
    ["Recommandations pour la mise en place de cloisonnement système", "Partiellement implémenté", "Fournis : conteneurs non privilégiés en lecture seule, sans capacités, ressources bornées, base sur réseau interne, rôles PostgreSQL séparés (moindre privilège). Durcissement de l'hôte à la charge de l'exploitant."],
    ["Recommandations de configuration d'un système GNU/Linux", "À implémenter via l'homologation", "Durcissement de l'hôte à la charge de l'exploitant."],
    ["Recommandations de sécurité pour la mise en œuvre d'un système de journalisation", "Implémenté", "Journal scellé (HMAC) et chaîné, en ajout seul imposé par la base, vérifiable et exportable ; copie JSON en temps réel vers un collecteur ou un SIEM."],
    ["Recommandations relatives à l'administration sécurisée des SI", "Partiellement implémenté", "Administrateur applicatif distinct, sans accès aux analyses, second facteur exigé, session de 15 minutes ; administration système depuis un poste dédié à la charge de l'exploitant."],
  ];
</script>

<div class="page narrow">
  <div class="section-title">
    <div class="row top" style="gap: 18px">
      <LogoMark size={64} title="Beffroi RM" />
      <div>
        <div class="eyebrow">À propos</div>
        <h1>Beffroi RM {auth.appVersion ? `v${auth.appVersion}` : ""}</h1>
        <div class="subtitle">Application d'appréciation et de traitement des risques numériques selon la méthode EBIOS Risk Manager (guide ANSSI v1.5, septembre 2024, et fiches méthodes). Son nom vient de la tour de guet des villes, d'où l'on surveillait l'horizon et sonnait l'alerte.</div>
      </div>
    </div>
  </div>
  <div class="card col mb-lg">
    <h2>Conditions générales d'emploi et d'usage</h2>
    <div class="callout warning">
      <ul style="margin: 0; padding-left: 18px">
        <li>L'évaluation de conformité réalisée par l'ANSSI au titre du label EBIOS Risk Manager se restreint aux aspects fonctionnels d'une solution vis-à-vis de la méthode EBIOS Risk Manager.</li>
        <li>Le label EBIOS Risk Manager ne se substitue pas aux démarches de certification ou de qualification décrites sur le site de l'ANSSI.</li>
        <li>Le label EBIOS Risk Manager ne garantit en aucun cas la robustesse d'une application face à des actions malveillantes.</li>
        <li>Afin de déterminer les mesures de sécurité nécessaires à la protection de l'application et des données qui y sont contenues, il est recommandé d'entreprendre une démarche d'homologation de sécurité telle que décrite par l'ANSSI (cyber.gouv.fr/lhomologation-de-securite).</li>
      </ul>
    </div>
    <p class="muted small">Beffroi RM n'est pas, à ce jour, une solution labellisée par l'ANSSI. EBIOS est une marque déposée du Secrétariat général de la défense et de la sécurité nationale.</p>
    <h3>Recommandations d'utilisation</h3>
    <ul>
      <li>Renseignez systématiquement la mention de protection de chaque analyse ; elle figure sur tous les écrans et livrables.</li>
      <li>Une analyse de risques décrit les vulnérabilités de l'organisation : hébergez l'application sur un système homologué au niveau de sensibilité des données traitées, derrière un accès HTTPS.</li>
      <li>Pour des informations portant une mention de classification de défense, l'application doit être déployée sur un système d'information homologué pour ce niveau ; le présent logiciel n'est pas conçu pour le traitement d'informations classifiées.</li>
      <li>Conservez la clé maître de chiffrement hors de la sauvegarde de la base, et limitez les droits d'accès aux études au strict besoin d'en connaître.</li>
      <li>Les fichiers exportés (PDF, Word, Excel, JSON) ne sont pas chiffrés : protégez-les selon leur mention de protection.</li>
    </ul>
  </div>
  <div class="card col mb-lg">
    <h2>Souveraineté</h2>
    <ul style="margin: 0">
      <li><strong>Aucune requête sortante</strong> : ni télémétrie, ni mise à jour automatique, ni police, script ou service tiers. Le navigateur ne charge que des ressources servies par cette instance.</li>
      <li><strong>Données sur votre infrastructure</strong> : études chiffrées (AES-256-GCM) avec une clé qui reste chez vous ; les exports sont générés dans votre navigateur.</li>
      <li><strong>Fonctionne sans Internet</strong> : installation depuis une archive autonome, sans téléchargement de dépendances.</li>
      <li><strong>Composants open source</strong> à licences permissives, inventoriés dans la nomenclature logicielle (SBOM CycloneDX) livrée avec l'archive d'installation.</li>
    </ul>
  </div>
  <div class="card">
    <h2>Matrice de conformité aux guides de l'ANSSI</h2>
    <div class="table-wrap auto">
      <table class="table">
        <thead><tr><th>Guide ou bonnes pratiques</th><th>État</th><th>Commentaire</th></tr></thead>
        <tbody>
          {#each COMPLIANCE as [g, s, c] (g)}
            <tr><td>{g}</td><td><span class="badge {s === 'Implémenté' ? 'green' : s.startsWith('Partiellement') ? 'orange' : 'blue'}">{s}</span></td><td>{c}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
