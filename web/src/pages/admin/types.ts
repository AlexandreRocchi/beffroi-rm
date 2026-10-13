export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  function: string;
  role: "admin" | "user";
  canCreate: boolean;
  mustChange: boolean;
  authSource: "local" | "oidc";
  linked: boolean;
  mfaEnabled: boolean;
  mfaEnabledAt: string | null;
  mustEnrollMfa: boolean;
  disabled: boolean;
  locked: boolean;
  lastLogin: string | null;
  createdAt: string;
  groups: { id: string; name: string }[];
}

export interface Group {
  id: string;
  name: string;
  description: string;
  members: { id: string; displayName: string; username: string }[];
}

export interface AuditRow {
  seq: number;
  ts: string;
  username: string;
  ip: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
}

export const ACTION_LABELS: Record<string, string> = {
  "auth.login.success": "Connexion",
  "auth.login.failure": "Échec de connexion",
  "auth.lockout": "Verrouillage de compte",
  "auth.logout": "Déconnexion",
  "auth.session_expired": "Session expirée",
  "auth.password_change": "Changement de mot de passe",
  "auth.password_change.failure": "Échec de changement de mot de passe",
  "user.create": "Création de compte",
  "user.update": "Modification de compte",
  "user.delete": "Suppression de compte",
  "user.unlock": "Déverrouillage de compte",
  "user.reset_password": "Réinitialisation de mot de passe",
  "user.profile_update": "Modification de profil",
  "user.oidc_link": "Rattachement à l'identité de l'organisation",
  "user.mfa_reset": "Réinitialisation du second facteur",
  "auth.mfa.challenge": "Demande de second facteur",
  "auth.mfa.failure": "Échec du second facteur",
  "auth.mfa.setup": "Début d'enrôlement du second facteur",
  "auth.mfa.enable": "Activation du second facteur",
  "auth.mfa.disable": "Désactivation du second facteur",
  "auth.mfa.recovery_used": "Utilisation d'un code de secours",
  "auth.mfa.recovery_regenerated": "Nouveaux codes de secours",
  "auth.reauth.failure": "Échec de ré-authentification",
  "auth.session_revoke": "Révocation de session",
  "audit.upgrade": "Scellement du journal (mise à niveau)",
  "crypto.rewrap": "Rechiffrement avec la clé courante",
  "group.create": "Création de groupe",
  "group.update": "Modification de groupe",
  "group.delete": "Suppression de groupe",
  "study.create": "Création d'étude",
  "study.import": "Import d'étude",
  "study.duplicate": "Duplication d'étude",
  "study.read": "Lecture d'étude",
  "study.write": "Écriture d'étude",
  "study.delete": "Suppression d'étude",
  "study.metadata_update": "Modification des propriétés d'étude",
  "study.version_create": "Nouvelle version d'étude",
  "study.acl_update": "Modification des droits d'étude",
  "study.export": "Export d'étude",
  "access.denied": "Accès refusé",
  "audit.read": "Consultation du journal",
  "audit.export": "Export du journal",
  "audit.verify": "Vérification du journal",
  "audit.purge": "Purge du journal",
  "app.start": "Démarrage de l'application",
  "app.stop": "Arrêt de l'application",
};
