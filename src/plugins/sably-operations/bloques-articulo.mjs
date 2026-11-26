/**
 * Bloques propios del cuerpo de los artículos (editor Portable Text de EmDash, menú «/» → «Sably»; blog DISENO §5.2 y
 * §12.7). Solo datos: los declara el descriptor del plugin sably-operations en astro.config.mjs y los pinta
 * src/components/CmsRichBody.astro (componentes de src/components/bloques/). La galería y la tabla NO están aquí: son
 * bloques nativos del editor («Gallery» y «Table») y el blog solo les da estilo.
 * Cambiar rótulos o ayudas es seguro; el `type` y los `action_id` no (son las claves guardadas en cada artículo).
 */
const texto = (action_id, label, extra = {}) => ({ type: 'text_input', action_id, label, ...extra });

export const BLOQUES_ARTICULO = [
  { type: 'sably_aviso', label: 'Aviso', icon: 'info', category: 'Sably', description: 'Caja de consejo, importante o cuidado dentro del texto',
    fields: [
      { type: 'select', action_id: 'tono', label: 'Tono', initial_value: 'consejo', options: [
        { label: 'Consejo (azul)', value: 'consejo' }, { label: 'Importante (coral)', value: 'importante' }, { label: 'Cuidado (ámbar)', value: 'cuidado' }] },
      texto('titulo', 'Título (opcional)'),
      texto('texto', 'Texto', { multiline: true }),
    ] },
  { type: 'sably_pasos', label: 'Pasos', icon: 'list', category: 'Sably', description: 'Pasos numerados con título y explicación',
    fields: [
      texto('titulo', 'Título de los pasos (opcional)'),
      { type: 'repeater', action_id: 'pasos', label: 'Pasos', item_label: 'Paso', min_items: 1, max_items: 12,
        fields: [texto('titulo', 'Qué se hace'), texto('texto', 'Cómo (opcional)', { multiline: true })] },
    ] },
  { type: 'sably_cursos', label: 'Carrusel de cursos', icon: 'link', category: 'Sably', description: 'Tarjetas de cursos con su precio real del país',
    fields: [
      texto('titulo', 'Rótulo', { placeholder: 'Cursos para practicarlo' }),
      texto('cursos', 'Cursos (uno por línea: la dirección del curso o su slug)', { multiline: true, placeholder: 'https://sably.co/co/curso-de-soldadura/' }),
      texto('categoria', 'O una categoría (slug): sus cursos, si arriba no hay ninguno', { placeholder: 'belleza' }),
    ] },
];
