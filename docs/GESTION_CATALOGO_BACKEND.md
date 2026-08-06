# Gestionar 5.918 URLs desde Filament sin que Google lo penalice

> Documento de arquitectura para conectar sably.co (Astro SSG) con un backend
> Laravel 13 + Filament v5. Escrito el 2026-08-06 sobre el estado real medido
> del catálogo, no sobre un supuesto.

---

## 0. El punto de partida, medido

Antes de decidir nada, esto es lo que hay hoy en el build:

| Tipo de página | Cantidad | % del sitio |
|---|---|---|
| **curso × ciudad** (`/co/bogota/curso-de-barberia/`) | **4.356** | **73 %** |
| curso × país (`/co/curso-de-barberia/`) | 968 | 16 % |
| categoría × ciudad | 432 | 7 % |
| categoría × país | 96 | 1 % |
| ciudad, blog, legales | 66 | 1 % |
| | **5.918** | |

Y el dato que manda sobre todo lo demás — similitud de texto entre páginas
construidas, medida con `difflib` sobre el HTML renderizado:

| Comparación | Similitud | Lectura |
|---|---|---|
| `/co/curso-de-barberia/` vs `/co/bogota/…` | 74,1 % | Diferenciadas ✅ |
| `/co/bogota/…` vs `/co/medellin/…` | **98,2 %** | Casi idénticas 🔴 |
| `/co/bogota/…` vs `/co/cali/…` | **98,4 %** | Casi idénticas 🔴 |
| `/co/curso-de-barberia/` vs `/mx/…` | 86,7 % | Diferenciadas ✅ |

**El 73 % del sitio son páginas que se diferencian entre sí en un 2 %.**
Cambia el nombre de la ciudad y poco más. Eso es exactamente el patrón que
Google documenta como *doorway pages*: páginas múltiples dirigidas a regiones
o ciudades que llevan al mismo contenido.

Otros dos números relevantes:

- **Cuerpo de texto por curso:** mediana 191 palabras, mínimo 117. Por debajo de
  lo que sostiene una página comercial competitiva.
- **72 % de los cursos (88 de 121) apuntan a `pay.hotmart.com/PENDIENTE`**, un
  checkout que no existe.

---

## 1. ¿Es penalizable? Respuesta honesta

**Sí, en su forma actual el riesgo es alto y es el problema número uno del
sitio.** Pero conviene separar dos cosas que se confunden:

### Lo que Google hace casi seguro (no es una penalización)

No indexa las 4.356. Las agrupa, elige una canónica por su cuenta y marca el
resto como *"Página alternativa con etiqueta canónica adecuada"* o
*"Duplicada, Google eligió una canónica distinta de la del usuario"* en Search
Console. Esto **no es un castigo**: es el comportamiento normal ante contenido
casi idéntico. El coste es que el esfuerzo de generar 4.356 URLs rinde como si
hubieras publicado 121.

### Lo que sí sería una penalización

Una acción manual por *doorway pages* o el filtro algorítmico de contenido de
baja calidad, que **no golpea solo a las páginas malas, sino a la percepción de
calidad de todo el dominio**. El disparador no es tener páginas por ciudad —
eso es legítimo—, es tenerlas a escala industrial sin nada propio que decir en
cada una.

Aquí el riesgo es real porque se cumplen los tres agravantes: volumen alto
(4.356), diferenciación mínima (2 %) y dominio nuevo sin autoridad que
compense.

### Lo que el sitio sí tiene bien

Para no pintarlo peor de lo que es, esto ya está resuelto y es más de lo que
tiene la mayoría:

- Astro SSG: HTML estático, sin JS de framework, Core Web Vitals cómodos.
- `hreflang` entre los 8 países y canónicas declaradas.
- Datos estructurados `Course`, `FAQPage`, `BreadcrumbList`, `AggregateRating`
  coherentes con lo que se muestra en pantalla.
- 121 meta descriptions únicas, 0 cuerpos duplicados exactos entre cursos.
- Jerarquía pilar/satélite en 12 clústeres, que evita la canibalización
  *entre cursos distintos*.
- Sitemap, `robots.txt`, `llms.txt`, IndexNow.

**El diagnóstico en una frase:** la base técnica es sólida y el problema es de
contenido. No se arregla con más código, se arregla teniendo algo distinto que
decir en cada URL — o no publicándola.

---

## 2. La regla que debe gobernar el backend

> **Una URL solo existe si tiene algo propio que decir.**

No al revés. Hoy la web genera el producto cartesiano
`cursos × ciudades` y después se pregunta qué poner en cada celda. El backend
debe invertirlo: la celda se crea cuando hay contenido para llenarla.

Traducido a una regla operativa concreta, y esto es lo que debe validar el
backend antes de dejar publicar:

**Una página curso × ciudad se publica solo si aporta ≥ 250 palabras propias
que no aparecen en la página del país.** Si no las tiene, la ciudad no genera
URL: el enlace interno apunta a la página de país.

Con eso, de las 4.356 sobreviven las que de verdad valen — probablemente entre
200 y 600 al principio — y crecen a medida que haya contenido real.

### Qué cuenta como "propio"

No vale interpolar el nombre de la ciudad en la misma frase. Cuenta:

1. Testimonios de estudiantes reales de esa ciudad.
2. Rango salarial u ocupacional local del oficio, con fuente.
3. Barrios o zonas donde hay demanda del servicio.
4. Normativa o certificación local cuando aplique.
5. Comparativa de precio contra academias presenciales de esa ciudad.
6. FAQs específicas ("¿sirve el certificado en Medellín?").

---

## 3. Modelo de datos en Laravel

La clave es **separar lo global de lo local**, y que lo local sea opcional.

```
app/Models/
├── Course.php           ← el curso: título, temario, precio, hotmart_id
├── Country.php          ← 8 países: moneda, hreflang, whatsapp
├── City.php             ← ciudades, pertenecen a un país
├── CourseCountry.php    ← override por país  (opcional)
└── CourseCity.php       ← override por ciudad (opcional)
```

`CourseCity` es el corazón del asunto. **Solo existe la fila si hay algo que
decir.** No se pre-crean 4.356 filas vacías.

```php
// database/migrations/..._create_course_city_table.php
Schema::create('course_city', function (Blueprint $table) {
    $table->id();
    $table->foreignId('course_id')->constrained()->cascadeOnDelete();
    $table->foreignId('city_id')->constrained()->cascadeOnDelete();

    // Overrides opcionales: null = hereda del curso global
    $table->string('h1')->nullable();
    $table->string('meta_title')->nullable();
    $table->text('meta_description')->nullable();
    $table->longText('local_content')->nullable();   // el bloque diferenciador
    $table->json('local_faqs')->nullable();
    $table->json('salary_range')->nullable();

    // Control editorial
    $table->unsignedSmallInteger('unique_words')->default(0);  // calculado
    $table->enum('status', ['draft', 'review', 'published'])->default('draft');
    $table->timestamp('published_at')->nullable();

    $table->unique(['course_id', 'city_id']);
    $table->index(['status', 'published_at']);
});
```

El campo `unique_words` se calcula en un observer, no se escribe a mano, y es
lo que hace cumplir la regla:

```php
// app/Observers/CourseCityObserver.php
public function saving(CourseCity $pivot): void
{
    $pivot->unique_words = str_word_count(strip_tags($pivot->local_content ?? ''));

    // El backend no deja publicar una URL que no aporta nada.
    if ($pivot->status === 'published' && $pivot->unique_words < 250) {
        throw ValidationException::withMessages([
            'local_content' => "Faltan palabras propias: {$pivot->unique_words} de 250. "
                . 'Sin contenido diferenciado esta URL compite contra la del país.',
        ]);
    }
}
```

> Esto es deliberadamente un bloqueo duro, no un aviso. Un aviso se ignora, y
> el problema actual nació justamente de generar primero y llenar después.

### Localismos, que ya están medidos

El sondeo de `docs/data/localismos.json` demostró que el mismo curso se busca
con palabras distintas según el país: `plomería` en MX/AR/US, `gasfíter` en
CL/PE, `fontanería` en ES. Localizar esa familia vale **+93 % de tráfico**.

Eso vive en `CourseCountry`, no en `CourseCity`:

```php
// course_country
$table->string('h1')->nullable();          // "Curso de Fontanería" en ES
$table->json('keywords')->nullable();      // keywords locales del mercado
```

Solo lo necesitan las 6 familias con inversión real de término. El resto hereda
el título global.

---

## 4. Filament: cómo se opera esto a diario

### 4.1 Editar una URL concreta

El caso más frecuente. Un `RelationManager` dentro del `CourseResource`:

```php
// app/Filament/Resources/CourseResource/RelationManagers/CitiesRelationManager.php
public function table(Table $table): Table
{
    return $table
        ->columns([
            TextColumn::make('name')->label('Ciudad')->searchable(),
            TextColumn::make('pivot.unique_words')
                ->label('Palabras propias')
                ->badge()
                ->color(fn ($state) => $state >= 250 ? 'success'
                    : ($state > 0 ? 'warning' : 'danger')),
            TextColumn::make('pivot.status')->badge()->label('Estado'),
            TextColumn::make('url')->label('URL')
                ->url(fn ($r) => "https://sably.co/{$r->country->code}/{$r->slug}/{$this->getOwnerRecord()->slug}/")
                ->openUrlInNewTab(),
        ])
        ->filters([
            SelectFilter::make('status'),
            Filter::make('sin_contenido')
                ->label('Sin contenido propio')
                ->query(fn ($q) => $q->wherePivot('unique_words', '<', 250)),
        ]);
}
```

Buscas la ciudad, editas, guardas. La columna de palabras propias con semáforo
hace que el problema sea visible sin tener que auditarlo.

### 4.2 Modificaciones masivas

Aquí está el mayor ahorro de tiempo, y también el mayor riesgo si se hace mal.
Filament resuelve esto con `BulkAction`:

```php
->bulkActions([
    BulkAction::make('publicar')
        ->requiresConfirmation()
        ->action(function (Collection $records) {
            // Se filtra ANTES de actuar: nunca se publica lo que no cumple.
            [$listos, $incompletos] = $records->partition(
                fn ($r) => $r->pivot->unique_words >= 250
            );

            $listos->each->update(['status' => 'published', 'published_at' => now()]);

            Notification::make()
                ->title("{$listos->count()} publicadas")
                ->body($incompletos->isEmpty() ? null
                    : "{$incompletos->count()} omitidas por falta de contenido propio.")
                ->send();
        }),

    BulkAction::make('ajustar_precio')
        ->form([
            TextInput::make('pct')->numeric()->label('% de variación')->required(),
        ])
        ->action(fn (Collection $r, array $d) =>
            AjustarPreciosJob::dispatch($r->pluck('id')->all(), (float) $d['pct'])),
])
```

**Tres reglas para las acciones masivas:**

1. **Todo lo masivo va a un Job**, nunca inline. 4.000 registros en una petición
   HTTP la tumban, y con Octane además bloqueas un worker.
2. **Filtrar antes de actuar, no después.** El `partition()` de arriba: lo que
   no cumple no se toca y se reporta.
3. **Todo cambio masivo queda en `activitylog`** (`spatie/laravel-activitylog`).
   Cuando el tráfico caiga en tres semanas querrás saber qué se tocó.

### 4.3 Generar un curso nuevo, en una ciudad o en varias

Una `Page` de Filament con un wizard, respaldada por una Action:

```php
// app/Actions/PublicarCursoEnUbicaciones.php
final readonly class PublicarCursoEnUbicaciones
{
    public function handle(Course $curso, array $cityIds, bool $conIA): void
    {
        foreach ($cityIds as $cityId) {
            $pivot = CourseCity::firstOrCreate(
                ['course_id' => $curso->id, 'city_id' => $cityId],
                ['status' => 'draft'],
            );

            // La IA redacta el borrador; el estado sigue siendo draft.
            if ($conIA) {
                RedactarContenidoLocalJob::dispatch($pivot);
            }
        }
    }
}
```

El wizard pide: curso → países → ciudades (con "todas" o selección) → ¿redactar
con IA? El resultado **siempre entra como borrador**. Publicar es un segundo
paso, deliberado, y sujeto al umbral de 250 palabras.

### 4.4 Un widget que vigile el problema

Porque lo que no se mide, vuelve:

```php
// app/Filament/Widgets/SaludSeoWidget.php
protected function getStats(): array
{
    $publicadas = CourseCity::where('status', 'published')->count();
    $flojas = CourseCity::where('status', 'published')
        ->where('unique_words', '<', 250)->count();

    return [
        Stat::make('URLs ciudad publicadas', $publicadas),
        Stat::make('Con contenido flojo', $flojas)
            ->color($flojas > 0 ? 'danger' : 'success')
            ->description($flojas > 0 ? 'Riesgo de doorway pages' : 'Sin deuda'),
        Stat::make('Cursos sin checkout', Course::where('hotmart_id', null)->count())
            ->color('danger'),
    ];
}
```

---

## 5. IA dentro de Filament: dónde ayuda y dónde hace daño

**Sí, es la mejor herramienta disponible para este problema concreto**, y es
además la única forma realista de producir contenido local para cientos de
ciudades. Pero tiene una condición innegociable.

### El error que hay que evitar

Pedirle a la IA *"escribe una landing de curso de barbería en Medellín"* produce
un texto que es la misma landing con "Medellín" pegado encima. **Eso es
exactamente el problema actual, pero generado más rápido.** Multiplicar
contenido vacío con IA es la forma más eficiente de conseguir una penalización.

### El enfoque que sí funciona: datos primero, redacción después

La IA no debe *inventar* la diferenciación, debe **redactar sobre datos reales
que tú le das**:

```php
// app/Jobs/RedactarContenidoLocalJob.php
public function handle(ClaudeService $claude): void
{
    $ciudad = $this->pivot->city;

    // Los datos vienen de fuentes reales, no del modelo.
    $datos = [
        'salario'     => SalarioLocalService::para($this->pivot->course, $ciudad),
        'testimonios' => Testimonio::deCiudad($ciudad)->limit(3)->get(),
        'zonas'       => $ciudad->zonas_comerciales,
        'competencia' => AcademiaPresencial::enCiudad($ciudad)->avg('precio'),
        'busquedas'   => KeywordLocal::para($this->pivot->course, $ciudad),
    ];

    // Si no hay datos reales, no hay página. La IA no rellena el vacío.
    if (collect($datos)->filter()->count() < 3) {
        $this->pivot->update(['status' => 'draft']);
        return;
    }

    $this->pivot->update([
        'local_content' => $claude->redactar($datos),
        'status'        => 'review',   // nunca 'published' directo
    ]);
}
```

Tres condiciones que hacen la diferencia:

1. **Sin datos locales suficientes, no se genera nada.** La IA amplifica lo que
   le das; si le das vacío, produce relleno.
2. **Sale a `review`, jamás a `published`.** Un humano aprueba. Con 4.000 URLs
   suena costoso, pero solo aplica a las que superan el umbral, que son muchas
   menos.
3. **Modelo:** Claude Opus 5 (`claude-opus-5`) para redacción con criterio,
   Haiku 4.5 para tareas mecánicas como normalizar campos o extraer entidades.
   La diferencia de coste importa a este volumen.

### Dónde la IA aporta más que en redactar

- **Detectar canibalización** entre cursos nuevos y existentes antes de publicar.
- **Traducir localismos**: sabiendo que ES dice `fontanería` y CL `gasfíter`,
  adaptar el texto completo, no solo el título.
- **Auditar lo ya publicado**: pasar las URLs existentes y marcar las que no
  aportan nada.
- **Redactar FAQs locales** a partir de las consultas reales de Search Console.

---

## 6. Cómo se conecta con el frontend Astro

El punto delicado: **5.918 páginas estáticas no se pueden reconstruir enteras
cada vez que se edita un párrafo.** El build tarda ~90 segundos hoy y crecerá.

### Opción recomendada: SSG con build incremental por webhook

```
Filament (publicar) → webhook → GitHub Actions → astro build → Cloudflare Pages
```

Astro cachea el contenido no modificado, así que un cambio puntual reconstruye
rápido. Con `@astrojs/cloudflare` el deploy es atómico.

Para que funcione bien:

- **El webhook se dispara al publicar, no al guardar.** Agrupa cambios con un
  `debounce` de unos minutos (`Bus::batch` o un job con `WithoutOverlapping`).
- **`getStaticPaths()` consume la API y filtra por estado**, que es lo que hace
  cumplir la regla en el frontend:

```ts
export async function getStaticPaths() {
  const res = await fetch(`${API}/v1/course-cities?status=published`);
  const items = await res.json();
  // El backend ya garantizó las 250 palabras; aquí solo se consume.
  return items.data.map((i) => ({
    params: { country: i.country, item: i.city, slug: i.course },
    props: { data: i },
  }));
}
```

Una ciudad sin contenido propio no aparece en la respuesta, luego **no genera
URL**. El problema deja de ser posible por construcción.

### Cuándo pasar a SSR/híbrido

Si algún día hay que reflejar cambios al instante (stock, precios dinámicos),
Astro permite marcar rutas concretas como SSR sin renunciar al SSG del resto.
Hoy no hace falta: un catálogo de cursos no cambia por minuto, y el HTML
estático en el edge es imbatible en Core Web Vitals.

### Y algo que este proyecto ya aprendió por las malas

Los assets se sirven con `Cache-Control: immutable` de un año. **Los nombres
deben llevar el hash del contenido.** Sobrescribir `heroes/co.webp` en su sitio
dejó la versión vieja servida desde el edge sin forma de purgarla, porque el
token no tiene permiso de purga. Ya está resuelto para los heroes con
`scripts/publicar-heroes.py`; cuando el backend sirva imágenes, debe seguir la
misma regla desde el primer día.

---

## 7. Plan de migración

**Fase 1 — parar la hemorragia (antes de conectar nada).**
Despublicar las páginas curso × ciudad sin contenido propio. De 4.356 quedarán
unos cientos. Los enlaces internos apuntan a la página de país. Es contraintuitivo
publicar menos, pero 300 páginas indexadas rinden más que 4.356 agrupadas.

**Fase 2 — backend con la regla dentro.**
Modelos, observer con el umbral de 250 palabras y API `/api/v1`. La restricción
vive en el backend, no en la disciplina de quien edita.

**Fase 3 — Filament operativo.**
`CourseResource` + `CitiesRelationManager`, acciones masivas vía Job, wizard de
publicación por ubicaciones y el widget de salud SEO.

**Fase 4 — IA sobre datos reales.**
Empezar por las 20 ciudades con más volumen medido. Salida a `review`. Medir en
Search Console qué pasa con esas 20 antes de escalar.

**Fase 5 — escalar con evidencia.**
Solo se añaden ciudades nuevas cuando las anteriores demuestren que indexan y
traen tráfico. El crecimiento lo dicta el dato, no el producto cartesiano.

---

## 8. Resumen para decidir

| Pregunta | Respuesta |
|---|---|
| ¿Tiene buen SEO técnico? | Sí. Astro SSG, hreflang, schema, sitemap e IndexNow están bien resueltos. |
| ¿Tiene buen SEO de contenido? | No. El 73 % del sitio son páginas al 98 % de similitud entre sí. |
| ¿Es penalizable? | Riesgo alto en su forma actual. Lo más probable es que Google agrupe y no indexe; el escenario malo es un filtro de calidad que afecte a todo el dominio. |
| ¿Se arregla con código? | No. Se arregla teniendo algo propio que decir en cada URL, o no publicándola. |
| ¿Ayuda la IA en Filament? | Sí, y mucho — pero redactando sobre datos locales reales. Generando texto de la nada, acelera el problema. |
| ¿Qué hacer primero? | Despublicar lo que no aporta. Antes de conectar el backend. |
