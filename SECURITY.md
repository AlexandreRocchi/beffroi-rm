# Politique de sécurité

## Versions prises en charge

Seule la dernière version publiée sur la page [Releases](https://github.com/AlexandreRocchi/beffroi-rm/releases) reçoit des correctifs de sécurité.

## Signaler une vulnérabilité

Ne publiez pas de vulnérabilité dans une issue publique.

Utilisez le signalement privé de GitHub : onglet **Security** du dépôt, puis **Report a vulnerability**
([formulaire](https://github.com/AlexandreRocchi/beffroi-rm/security/advisories/new)).

Indiquez la version concernée, les étapes pour reproduire le problème et son impact. Vous recevrez un
accusé de réception, puis un retour sur l'analyse. Une fois le correctif publié, la vulnérabilité peut
être divulguée avec une mention de votre contribution si vous le souhaitez.

## Pour aller plus loin

Le [dossier de sécurité](docs/securite.md) décrit les menaces prises en compte, les mesures, la
configuration de production et les risques résiduels connus. Les exécutables et archives publiés
s'accompagnent d'une somme de contrôle SHA-256 et d'une attestation de provenance
(`gh attestation verify <fichier> --repo AlexandreRocchi/beffroi-rm`).
