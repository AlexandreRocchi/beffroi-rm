# Contribuer à Beffroi RM

## Branches

- `main` : version publiée. On n'y commite pas directement.
- `dev` : intégration. Toute fonctionnalité ou correction part de `dev`.
- `feature/<nom>` : une fonctionnalité, créée depuis `dev`, fusionnée dans `dev`.
- `hotfix/<nom>` : correction urgente, créée depuis `main`, fusionnée dans `main` puis dans `dev`.

## Messages de commit

Format :

```
type(scope): description
```

- **type** (obligatoire) : `feat`, `fix`, `docs`, `ci`, `deploy`, `refactor`, `test`, `style`, `chore`, `perf`, `build`.
- **scope** (facultatif) : `shared`, `server`, `web`, `deploy`, `docs`, `ci`, `e2e`, `scripts`, `poste`, `installer`.
- **description** : en français, première lettre en minuscule, sans point final, 72 caractères au plus.
- **changement incompatible** : `!` après le type ou le scope, par exemple `feat(server)!: …`.
- Le message ne contient ni `Co-Authored-By` ni mention d'outil généré.

Exemples :

```
feat(web): ajoute l'export PDF du plan de traitement
fix(server): corrige le délai d'expiration des sessions
docs: précise la procédure de sauvegarde
```

Les commits de fusion (`Merge …`), d'annulation (`Revert …`) et de correction (`fixup!`, `squash!`) ne sont pas contrôlés.

### Contrôle automatique

Le dépôt fournit un hook `commit-msg` dans [.githooks](.githooks/commit-msg). Après un clone, à faire une seule fois :

```bash
git config core.hooksPath .githooks
```

Un message non conforme est refusé avec le format attendu.

## Vérifications avant une fusion

```bash
npm run typecheck
npm test
npm run build
```
