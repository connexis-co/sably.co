/** Utilidades de texto de los escaparates del héroe. */
export const corto = (t: string) => { const r = t.replace(/^curso\s+(online\s+)?(de|del)\s+/i, ''); return r.charAt(0).toUpperCase() + r.slice(1); };
export const notaCorta = (n: { cifra: string; texto: string } | null) => n && `${n.cifra} · ${n.texto.replace(/ calificaciones.*$/, '')} en Hotmart`;
