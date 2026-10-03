# Guía de Contribución — sably.co (Frontend)

## Reglas fundamentales

1. 📋 Todo cambio comienza consultando los issues/board del proyecto.
2. 🚫 Nunca commits directos a `main` o `develop` — siempre rama + PR (incluso trabajando solo).
3. 🌿 Toda feature/fix requiere su propia rama y PR.
4. 📝 Los commits siguen [Conventional Commits](https://www.conventionalcommits.org) (enforced por husky + commitlint).
5. 👀 Code review: [Solo] self-review del diff + CI verde = merge. [Equipo] mínimo 1 review aprobada.
6. 🔀 `develop` despliega a dev.sably.co tras CI. `main` valida el código; producción requiere promoción manual del SHA exacto, según [CI_CD.md](docs/CI_CD.md).
7. ✅ El pipeline de CI debe pasar antes del merge.
8. 🧹 Las ramas se eliminan después del merge.
9. 🏷️ Releases con SemVer estricto (release-please los automatiza).
10. 🔒 Tokens y secretos NUNCA en el código ni en chats — GitHub Secrets exclusivamente.

## Branching (Git Flow)

| Rama | Propósito | Deploy |
|---|---|---|
| `main` | Código aprobado para producción | Candidato manual; no cambia tráfico al fusionar |
| `develop` | Integración | https://dev.sably.co |
| `feature/...` | Nueva funcionalidad (desde `develop`) | Preview por PR |
| `bugfix/...` | Corrección no crítica (desde `develop`) | Preview por PR |
| `hotfix/vX.Y.Z` | Urgente (desde `main`, merge a `main` + `develop`) | — |

Nombres en kebab-case: `feature/agregar-busqueda-cmdk`, `bugfix/corregir-hreflang-us`.

## Flujo rápido

```bash
git checkout develop && git pull origin develop
git checkout -b feature/mi-cambio
# ...desarrollo con commits convencionales...
npm run test:migration && npm run check && npm run check:functions && npm run build:dev
git push origin feature/mi-cambio  # → PR hacia develop
```

## Tipos de commit

`feat` (MINOR) · `fix` (PATCH) · `docs` · `style` · `refactor` · `perf` · `test` · `chore` · `ci` · `build` · `revert`.
Breaking change: sufijo `!` + footer `BREAKING CHANGE:`.

## Deploy manual (si el pipeline falla)

```bash
npm run build:dev && npm run deploy:development
```

Los despliegues y las copias editoriales usan el mismo lock de desarrollo. No conectar las bases productivas al Worker de desarrollo ni incluir volcados de autenticación/solicitudes en artefactos.
