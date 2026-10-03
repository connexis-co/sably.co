export interface WhatsAppRule {
  id: string; label: string; enabled: boolean; priority: number;
  courses: string[]; categories: string[]; countries: string[]; paths: string[];
  number: string; message: string; startsAt: string; endsAt: string;
}
export interface WhatsAppSettings {
  enabled: boolean; number: string; message: string; label: string;
  position: 'left' | 'right'; x: number; y: number; delay: number;
  mobile: boolean; desktop: boolean; animate: boolean; color: string;
  hiddenPaths: string[]; timezone: string; weekdays: number[];
  startTime: string; endTime: string; rules: WhatsAppRule[];
}
export interface WhatsAppContext {
  path: string; course: string; title: string; category: string;
  country: string; countryName: string; countryNumber: string; url: string;
}
/** Content metadata determines a course; the title/slug never needs a naming prefix. */
export function courseSlugFromPage(page: { url: string; pageType: string; content?: { collection: string; slug: string | null } }): string {
  const courseCollection = page.content?.collection === 'courses';
  if (!courseCollection && !['course', 'course_city'].includes(page.pageType)) return '';
  const validSegment = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim() && !/[/?#\\\u0000-\u0020]/.test(value);
  if (courseCollection && validSegment(page.content?.slug)) return page.content.slug;
  try {
    const last = new URL(page.url).pathname.split('/').filter(Boolean).at(-1);
    const slug = last ? decodeURIComponent(last) : '';
    return validSegment(slug) ? slug : '';
  } catch { return ''; }
}
export const DEFAULT_SETTINGS: WhatsAppSettings = {
  enabled: true, number: '', message: 'Hola, estoy interesado(a) y quiero más información sobre {titulo}',
  label: 'Escríbenos por WhatsApp', position: 'right', x: 21, y: 58, delay: 0,
  mobile: true, desktop: true, animate: true, color: '#00e676', hiddenPaths: [],
  timezone: 'America/Bogota', weekdays: [0,1,2,3,4,5,6], startTime: '', endTime: '', rules: [],
};
export function matchesPath(path: string, pattern: string): boolean {
  if (!pattern.includes('*')) return path.replace(/\/$/, '') === pattern.replace(/\/$/, '');
  // Match a glob without compiling repeated .* into a backtracking RegExp.
  let p=0,t=0,star=-1,retry=0;
  while(t<path.length){
    if(pattern[p]==='*'){star=p++;retry=t;}
    else if(pattern[p]===path[t]){p++;t++;}
    else if(star!==-1){p=star+1;t=++retry;}
    else return false;
  }
  while(pattern[p]==='*')p++;
  return p===pattern.length;
}
function boundedText(input: unknown, name: string, max: number): string {
  if (typeof input !== 'string' || input.length > max) throw new Error(`${name}: texto de máximo ${max} caracteres.`);
  return input.trim();
}
function integer(input: unknown, name: string, min: number, max: number): number {
  if (!Number.isInteger(input) || Number(input) < min || Number(input) > max) throw new Error(`${name}: usa un entero entre ${min} y ${max}.`);
  return Number(input);
}
function strings(input: unknown, name: string, max = 150): string[] {
  if (!Array.isArray(input) || input.length > max) throw new Error(`${name}: lista inválida.`);
  return [...new Set(input.map(item => boundedText(item, name, 180)).filter(Boolean))];
}
function paths(input:unknown,name:string):string[]{
  const values=strings(input,name);
  if(values.some(value=>!/^\/(?!\/)[^\s?#\\]*$/.test(value)))throw new Error(`${name}: usa rutas absolutas del sitio, sin dominio ni parámetros.`);
  return values;
}
function phone(value: unknown): string {
  const number = boundedText(value, 'Número internacional', 20).replace(/[\s+()-]/g, '');
  if (number && !/^[1-9]\d{6,14}$/.test(number)) throw new Error('Número internacional: usa entre 7 y 15 dígitos, con código de país.');
  return number;
}
function bool(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name}: valor inválido.`);
  return value;
}
function date(value: unknown, name: string): string {
  const text = boundedText(value, name, 35);
  if (text && (!/(Z|[+-]\d{2}:\d{2})$/.test(text) || !Number.isFinite(Date.parse(text)))) throw new Error(`${name}: requiere fecha con zona horaria.`);
  return text;
}
export function validateSettings(input: unknown): WhatsAppSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuración inválida.');
  const v = input as Record<string, unknown>;
  const settings: WhatsAppSettings = {
    enabled: bool(v.enabled, 'Activo'), number: phone(v.number), message: boundedText(v.message, 'Mensaje', 1500),
    label: boundedText(v.label, 'Etiqueta', 100), position: v.position === 'left' ? 'left' : 'right',
    x: integer(v.x, 'Separación horizontal', 0, 300), y: integer(v.y, 'Separación vertical', 0, 500),
    delay: integer(v.delay, 'Espera', 0, 120), mobile: bool(v.mobile, 'Móvil'), desktop: bool(v.desktop, 'Escritorio'),
    animate: bool(v.animate, 'Animación'), color: boundedText(v.color, 'Color', 7),
    hiddenPaths: paths(v.hiddenPaths, 'Rutas ocultas'), timezone: boundedText(v.timezone, 'Zona horaria', 60),
    weekdays: Array.isArray(v.weekdays) ? [...new Set(v.weekdays.map(d => integer(d, 'Días', 0, 6)))] : [],
    startTime: boundedText(v.startTime, 'Inicio de horario', 5), endTime: boundedText(v.endTime, 'Fin de horario', 5), rules: [],
  };
  if(v.position!=='left'&&v.position!=='right')throw new Error('Lado inválido.');
  if(!settings.label)throw new Error('La etiqueta accesible no puede quedar vacía.');
  if(!Array.isArray(v.weekdays))throw new Error('Selecciona los días de atención.');
  if (!/^#[a-f0-9]{6}$/i.test(settings.color)) throw new Error('Color hexadecimal inválido.');
  try { new Intl.DateTimeFormat('en', { timeZone: settings.timezone }); } catch { throw new Error('Zona horaria IANA inválida.'); }
  if (!!settings.startTime !== !!settings.endTime || [settings.startTime,settings.endTime].some(t => t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw new Error('Completa ambas horas (HH:MM), o deja ambas vacías.');
  if (!Array.isArray(v.rules) || v.rules.length > 100) throw new Error('Máximo 100 reglas.');
  settings.rules = v.rules.map((input, index) => {
    if (!input || typeof input !== 'object') throw new Error(`Regla ${index + 1} inválida.`);
    const r = input as Record<string, unknown>;
    const rule: WhatsAppRule = {
      id: boundedText(r.id, 'ID', 80), label: boundedText(r.label, 'Nombre', 100), enabled: bool(r.enabled, 'Regla activa'),
      priority: integer(r.priority, 'Prioridad', -1000, 1000), courses: strings(r.courses,'Cursos'), categories: strings(r.categories,'Categorías'),
      countries: strings(r.countries,'Países',50), paths: paths(r.paths,'Rutas'), number: phone(r.number),
      message: boundedText(r.message,'Mensaje',1500), startsAt: date(r.startsAt,'Inicio'), endsAt: date(r.endsAt,'Fin'),
    };
    if (!/^[a-zA-Z0-9_-]+$/.test(rule.id) || !rule.label) throw new Error('Cada regla requiere un ID y un nombre.');
    if (rule.startsAt && rule.endsAt && Date.parse(rule.startsAt) >= Date.parse(rule.endsAt)) throw new Error('La fecha de fin debe ser posterior al inicio.');
    return rule;
  });
  if (new Set(settings.rules.map(r => r.id)).size !== settings.rules.length) throw new Error('Hay IDs de reglas repetidos.');
  return settings;
}
export function inSchedule(settings: WhatsAppSettings, now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: settings.timezone, weekday:'short', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(now);
  const get = (key: string) => parts.find(p => p.type === key)?.value ?? '';
  const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday'));
  const time = `${get('hour')}:${get('minute')}`;
  if (!settings.startTime) return settings.weekdays.includes(day);
  if (settings.startTime <= settings.endTime) return settings.weekdays.includes(day) && time >= settings.startTime && time < settings.endTime;
  return time >= settings.startTime ? settings.weekdays.includes(day) : time < settings.endTime && settings.weekdays.includes((day + 6) % 7);
}
export function resolveWhatsApp(settings: WhatsAppSettings, context: WhatsAppContext, now = new Date()) {
  if (!settings.enabled || (!settings.mobile && !settings.desktop) || settings.hiddenPaths.some(p => matchesPath(context.path,p)) || !inSchedule(settings,now)) return null;
  const matches = settings.rules.filter(r => r.enabled &&
    (!r.startsAt || now.valueOf() >= Date.parse(r.startsAt)) && (!r.endsAt || now.valueOf() < Date.parse(r.endsAt)) &&
    (!r.courses.length || r.courses.includes(context.course)) && (!r.categories.length || r.categories.includes(context.category)) &&
    (!r.countries.length || r.countries.includes(context.country)) && (!r.paths.length || r.paths.some(p => matchesPath(context.path,p))));
  const rule = matches.sort((a,b) => b.priority - a.priority || a.id.localeCompare(b.id))[0];
  const number = rule?.number || settings.number || context.countryNumber;
  if (!/^[1-9]\d{6,14}$/.test(number)) return null;
  const tokens: Record<string,string> = { titulo: context.title || 'los cursos de Sably', curso: context.title, categoria: context.category, pais: context.countryName, url: context.url };
  const message = (rule?.message || settings.message).replace(/\{(titulo|curso|categoria|pais|url)\}/g, (_, token: string) => tokens[token] ?? '');
  return { number, message, url: `https://wa.me/${number}?text=${encodeURIComponent(message)}`, rule: rule?.id ?? 'default' };
}
