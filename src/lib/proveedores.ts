/**
 * Proveedores del catálogo y su política de cupón.
 *
 * No todos los creadores venden igual. El grueso del catálogo pertenece a
 * Mauricio Duque (MasterClasses), cuyo checkout acepta el cupón `031016` que el
 * sitio interpreta como `?offDiscount=`. Otros creadores no manejan ese cupón:
 * o traen su oferta horneada dentro del acortador (`?off=<oferta>`), o
 * sencillamente el cupón del sitio no les descuenta nada.
 *
 * Por qué importa: si el sitio anuncia «−50 %» en la ficha de un curso cuyo
 * checkout NO honra el cupón, el visitante llega a pagar el precio entero. Es
 * discrepancia entre anuncio y destino, y es exactamente lo que pasaba con
 * `curso-de-peluqueria` (checkout 333 USD con y sin cupón, comprobado).
 *
 * Cómo se sabe quién acepta el cupón: no se adivina por el nombre del creador,
 * se mide. `scripts/auditar-cupon.mjs` visita cada checkout con y sin
 * `?offDiscount=031016` y compara el precio. Los que no bajan van aquí con
 * `cupon: false`.
 *
 * El proveedor es un atributo del frontmatter (`proveedor:`). Un curso sin ese
 * campo se trata como del proveedor por defecto —MasterClasses—, porque es el
 * dueño del cupón y cubre 95 de los 98 cursos con producto. Marcar los tres que
 * NO lo son es más barato y menos frágil que marcar los noventa y cinco que sí.
 */
export interface Proveedor {
  /** Identificador estable; es el valor que va en el frontmatter `proveedor:`. */
  id: string;
  /** Nombre legible, para el panel de promociones y los informes. */
  nombre: string;
  /**
   * `false` si el checkout de este creador NO acepta el cupón `031016` del sitio.
   *
   * Cuando es false hay que respetarlo en TRES sitios o el cliente deshace lo
   * que decidió el build: `buildHotmartUrl` no añade `offDiscount`,
   * `PromoBanner` no lo pega a los CTA al confirmarse campaña, y el controlador
   * de precios no repinta con el porcentaje. El tercero es el que más duele:
   * enseñaría media tarifa mientras el checkout cobra entera.
   */
  cupon: boolean;
}

/** Proveedor que se asume cuando el frontmatter no declara `proveedor:`. */
export const PROVEEDOR_DEFECTO = 'masterclasses';

export const PROVEEDORES: Record<string, Proveedor> = {
  masterclasses: {
    id: 'masterclasses',
    nombre: 'Mauricio Duque · MasterClasses',
    // Dueño del cupón 031016. Es el proveedor por defecto: el cupón le aplica
    // en el checkout, verificado en 95 de los 98 cursos con producto.
    cupon: true,
  },
  cursosdecocina: {
    id: 'cursosdecocina',
    nombre: 'Escuela Cursosdecocina',
    // Maneja tres precios (25/35/45 USD) y no cupones. El tier elegido viaja
    // dentro del acortador como `?off=<oferta>`; el enlace ya llega completo.
    cupon: false,
  },
  peluqueria: {
    id: 'peluqueria',
    nombre: 'Peluquería Básica y Avanzada (productor externo)',
    // Checkout B28818422Q: 333 USD con y sin `?offDiscount=031016` (comprobado
    // el 2026-08-14 con scripts/auditar-cupon.mjs). El cupón del sitio no le
    // descuenta nada, así que anunciar −50 % aquí sería cobrar el doble de lo
    // prometido. No se le conoce cupón propio; si aparece, se añade.
    cupon: false,
  },
};

/** Normaliza el `proveedor` del frontmatter al id de un proveedor conocido. */
export function proveedorDe(proveedor?: string): string {
  const id = proveedor?.trim().toLowerCase();
  return id && PROVEEDORES[id] ? id : PROVEEDOR_DEFECTO;
}

/** Nombre legible del proveedor de un curso. */
export function nombreProveedor(proveedor?: string): string {
  return PROVEEDORES[proveedorDe(proveedor)]!.nombre;
}

/** ¿A este curso se le puede añadir el cupón `031016` del sitio? */
export function aceptaCupon(proveedor?: string): boolean {
  return PROVEEDORES[proveedorDe(proveedor)]!.cupon;
}
