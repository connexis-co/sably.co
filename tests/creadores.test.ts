import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asignarCursos, creadorSchema, creatorDelCurso, nombresCreadores, separadorDeLista, tipoDeCreador, urlCreador } from '../src/lib/creadores.ts';
import { autorDe } from '../src/lib/hotmartLive.ts';

test('el tipo sale de lo que el creador declara de sí mismo', () => {
  assert.equal(tipoDeCreador({ nombre: 'MasterClasses.La®', bio: 'Master Classes Latinoamérica es una empresa desarrolladora de cursos virtuales en video.' }), 'Organization');
  assert.equal(tipoDeCreador({ nombre: 'Cursos Pro', bio: 'Somos cursosdecocina, una escuela que ha formado a cientos de alumnos.' }), 'Organization');
  assert.equal(tipoDeCreador({ nombre: 'ESCUELA CURSOSDECOCINA' }), 'Organization');
  assert.equal(tipoDeCreador({ nombre: 'Mauricio Duque Zuluaga', bio: 'Trabajando en Internet desde 1996, Mauricio Duque siempre se ha interesado por enseñar.' }), 'Person');
  assert.equal(tipoDeCreador({ nombre: 'Fisioparallevar', bio: 'Soy Abril López, fisioterapeuta. Mi marca se dedica a la creación de contenido online.' }), 'Person');
  // Una frase que menciona una empresa sin presentarse como tal no la convierte en una.
  assert.equal(tipoDeCreador({ nombre: 'Ana Pérez', bio: 'Trabajé diez años en una empresa de eventos.' }), 'Person');
});

test('el creador del curso y el de su página son el mismo nodo', () => {
  const url = urlCreador('https://sably.co/', 'mx', 'masterclasses-la');
  assert.equal(url, 'https://sably.co/mx/creadores/masterclasses-la/');
  assert.deepEqual(creadorSchema({ slug: 'masterclasses-la', nombre: 'MasterClasses.La®' }, url), {
    '@type': 'Organization',
    '@id': 'https://sably.co/mx/creadores/masterclasses-la/#creador',
    name: 'MasterClasses.La®',
    url,
  });
});

test('la línea visible une los nombres en español', () => {
  assert.equal(nombresCreadores([]), '');
  assert.equal(nombresCreadores(['A']), 'A');
  assert.equal(nombresCreadores(['A', 'B']), 'A y B');
  assert.equal(nombresCreadores(['A', 'B', 'C']), 'A, B y C');
  assert.deepEqual([0, 1, 2].map((i) => separadorDeLista(i, 3)), ['', ', ', ' y ']);
});

test('el CMS manda; Hotmart solo cubre los cursos sin creador en el CMS', () => {
  const creadores = [
    { slug: 'masterclasses-la', courseSlugs: [] },
    { slug: 'mauricio-duque', courseSlugs: ['curso-legado'] },
  ];
  const hotmart: Record<string, string> = {
    'curso-de-unas': 'masterclasses-la',
    'curso-editado': 'masterclasses-la',
    'curso-legado': 'masterclasses-la',
    'curso-de-otro': 'creador-sin-pagina',
  };
  const asignacion = asignarCursos(
    creadores,
    [
      { id: 'curso-de-unas', creatorManaged: true }, // relación vacía, como hoy en producción
      { id: 'curso-editado', creatorSlug: 'mauricio-duque', creatorManaged: true }, // el editor decidió
      { id: 'curso-legado' }, // sin campo de relación: vale `course_slugs`
      { id: 'curso-de-otro', creatorManaged: true }, // Hotmart nombra a alguien sin página
      { id: 'curso-pendiente', creatorManaged: true }, // sin producto: nadie lo reclama
    ],
    (slug) => hotmart[slug],
  );
  assert.deepEqual(Object.fromEntries(asignacion), {
    'masterclasses-la': ['curso-de-unas'],
    'mauricio-duque': ['curso-editado', 'curso-legado'],
  });
  // Sin respaldo de Hotmart la relación vacía sigue vacía.
  assert.deepEqual(asignarCursos(creadores, [{ id: 'curso-de-unas', creatorManaged: true }]).get('masterclasses-la'), []);
});

test('el Course declara creator solo si consta uno real', () => {
  assert.deepEqual(creatorDelCurso(undefined), {});
  assert.deepEqual(creatorDelCurso([]), {});
  const url = 'https://sably.co/co/creadores/masterclasses-la/';
  const mc = { slug: 'masterclasses-la', nombre: 'MasterClasses.La®', url };
  assert.deepEqual(creatorDelCurso([mc]), { creator: { '@type': 'Organization', '@id': `${url}#creador`, name: 'MasterClasses.La®', url } });
  const md = { slug: 'mauricio-duque', nombre: 'Mauricio Duque Zuluaga', url: 'https://sably.co/co/creadores/mauricio-duque/' };
  assert.deepEqual(
    (creatorDelCurso([mc, md]).creator as { '@type': string }[]).map((n) => n['@type']),
    ['Organization', 'Person'],
  );
});

test('el autor de Hotmart está capturado para los cursos con producto', () => {
  assert.equal(autorDe('curso-de-unas')?.slug, 'masterclasses-la');
  assert.equal(autorDe('curso-que-no-existe'), null);
});
