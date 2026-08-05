# Guía de Contribución — sably.co (Frontend)

## Reglas fundamentales

1. 📋 Todo cambio comienza consultando los issues/board del proyecto.
2. 🚫 Nunca commits directos a `main` o `develop` — siempre rama + PR (incluso trabajando solo).
3. 🌿 Toda feature/fix requiere su propia rama y PR.
4. 📝 Los commits siguen [Conventional Commits](https://www.conventionalcommits.org) (enforced por husky + commitlint).
5. 👀 Code review: [Solo] self-review del diff + CI verde = merge. [Equipo] mínimo 1 review aprobada.
6. 🔀 Merge = Deploy: `develop` → staging (branch deploy CF Pages), `main` → producción (sably.co).
7. ✅ El pipeline de CI debe pasar antes del merge.
8. 🧹 Las ramas se eliminan después del merge.
9. 🏷️ Releases con SemVer estricto (release-please los automatiza).
10. 🔒 Tokens y secretos NUNCA en el código ni en chats — GitHub Secrets exclusivamente.

## Branching (Git Flow)

| Rama | Propósito | Deploy |
|---|---|---|
| `main` | Producción | https://sably.co |
| `develop` | Integración | https://develop.sably.pages.dev |
| `feature/...` | Nueva funcionalidad (desde `develop`) | Preview por PR |
| `bugfix/...` | Corrección no crítica (desde `develop`) | Preview por PR |
| `hotfix/vX.Y.Z` | Urgente (desde `main`, merge a `main` + `develop`) | — |

Nombres en kebab-case: `feature/agregar-busqueda-cmdk`, `bugfix/corregir-hreflang-us`.

## Flujo rápido

```bash
git checkout develop && git pull origin develop
git checkout -b feature/mi-cambio
# ...desarrollo con commits convencionales...
npm run check && npm run build     # verificar localmente
git push origin feature/mi-cambio  # → PR hacia develop
```

## Tipos de commit

`feat` (MINOR) · `fix` (PATCH) · `docs` · `style` · `refactor` · `perf` · `test` · `chore` · `ci` · `build` · `revert`.
Breaking change: sufijo `!` + footer `BREAKING CHANGE:`.

## Deploy manual (si el pipeline falla)

```bash
npm run build && ./scripts/deploy-pages.sh
```
