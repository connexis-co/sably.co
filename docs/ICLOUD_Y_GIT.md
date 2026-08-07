# iCloud desalojó el índice de git y el repositorio dejó de responder

> Incidente del 2026-08-07 en `sably.co`, resuelto sin pérdida de datos.
> Se documenta porque afecta a **todos** los repos bajo `~/Documents`.

## Qué pasó

En mitad de un lote de generación de contenido, cualquier comando de git empezó
a fallar con:

```
fatal: .git/worktrees/sably-online-courses-64463a/index:
       unable to map index file: Operation timed out
```

El primer sospechoso fue el disco: estaba al **100 %**, con 4,5 GB libres de
926 GB. Se liberaron 12 GB y **el error siguió igual**, así que no era eso.

## La causa real

```
$ stat -f 'tamaño=%z bloques=%b flags=%Sf' .git/.../index
tamaño=137360 bloques=0 flags=hidden,compressed,dataless
```

**Cero bloques para un archivo de 137 KB.** `dd` confirmaba la lectura de 0
bytes. El archivo era *dataless*: iCloud había subido su contenido y lo había
desalojado del disco local, dejando solo el metadato. Cuando git intenta hacer
`mmap` sobre él, macOS trata de rematerializarlo desde iCloud y agota el tiempo.

`~/Documents` está sincronizado con iCloud Drive en este equipo, y `.git/` entra
en la sincronización como cualquier otra carpeta. `brctl download` no lo
recuperó.

El detalle que lo confirma: `HEAD`, en el mismo directorio, se leía sin
problema. Solo el índice —el archivo grande y de escritura frecuente— había sido
elegido para el desalojo.

## Cómo se resolvió

El índice de git es **caché reconstruible**: describe el árbol de trabajo, no lo
contiene. Con los archivos intactos, se rehace desde el último commit.

```bash
mv .git/worktrees/<nombre>/index .git/worktrees/<nombre>/index.dataless.bak
git read-tree HEAD
```

Nada se perdió: los cambios sin commitear volvieron a aparecer como modificados
porque viven en el árbol de trabajo, no en el índice.

## Por qué conviene sacar los repos de Documents

El riesgo no se ha ido, solo se ha pospuesto. iCloud puede volver a desalojar
cualquier archivo de `.git/` cuando el disco apriete, y hay objetos que **no**
son reconstruibles:

- `.git/objects/` — los commits. Si se desaloja uno y no se puede rematerializar,
  se pierde historia que solo existe ahí.
- `.git/refs/` y `packed-refs` — a qué apunta cada rama.
- El índice, que fue lo que tocó esta vez, es el caso benigno.

Tres salidas, de mejor a peor:

1. **Mover los repos fuera de `~/Documents`** (por ejemplo `~/Code` o
   `~/Developer`, que iCloud no sincroniza). Es la única que elimina la causa.
2. **Excluir cada `.git/` de la sincronización.** iCloud Drive no ofrece
   exclusiones por carpeta, así que en la práctica no es viable.
3. **Desactivar "Optimizar almacenamiento del Mac"** en Ajustes → Apple ID →
   iCloud. Evita el desalojo mientras haya disco libre, pero vuelve en cuanto se
   llene.

Mientras tanto, mantener el disco con holgura reduce mucho la probabilidad:
el desalojo se dispara justamente cuando falta espacio.

## Señal para reconocerlo rápido

Cualquier error de git con `unable to map`, `Operation timed out` o
`Input/output error` sobre un archivo de `.git/`:

```bash
stat -f '%z bytes, %b bloques, flags=%Sf' <archivo>
```

Si dice `bloques=0` y `dataless`, es esto y no una corrupción del repositorio.
