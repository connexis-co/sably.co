/**
 * Política comercial por proveedor del curso.
 *
 * No todos los creadores del catálogo venden igual. El grueso acepta el cupón
 * `031016` que Hotmart interpreta como `?offDiscount=`, pero hay creadores que
 * no manejan cupones: publican varios precios y se elige uno, y esa elección va
 * horneada dentro del propio acortador (`?off=<oferta>`), no como parámetro que
 * añada el sitio.
 *
 * Vive aquí y no como un `sinCupon: true` por curso porque la política es del
 * proveedor, no del curso: si un creador cambia de política, se toca una línea
 * en vez de veinte ficheros. El campo `proveedor` del frontmatter es además un
 * atributo real, útil para atribución y reportes más allá del cupón.
 *
 * Un curso sin `proveedor`, o con uno que no esté aquí, se trata como el caso
 * general: lleva cupón. Es lo que hacen los 121 de hoy.
 */
export interface PoliticaProveedor {
  /** Nombre legible, para el panel y los informes. */
  nombre: string;
  /**
   * `false` si el checkout de este creador NO acepta el cupón del sitio.
   *
   * Cuando es false hay que respetarlo en TRES sitios, o el cliente deshace lo
   * que decidió el build: `buildHotmartUrl` no añade `offDiscount`,
   * `PromoBanner` no lo pega a los CTA al confirmarse campaña, y el controlador
   * de precios no repinta con el porcentaje. Ese tercero es el que más duele:
   * enseñaría media tarifa y el checkout cobraría entera.
   */
  cupon: boolean;
}

export const PROVEEDORES: Record<string, PoliticaProveedor> = {
  cursosdecocina: {
    nombre: 'Escuela Cursosdecocina',
    // Maneja tres precios (25/35/45 USD) y no cupones. El tier elegido viaja
    // dentro del acortador como `?off=<oferta>`; el enlace ya llega completo y
    // no se le añade nada.
    cupon: false,
  },
};

/** ¿A este curso se le puede añadir el cupón del sitio? */
export function aceptaCupon(proveedor?: string): boolean {
  if (!proveedor) return true;
  return PROVEEDORES[proveedor]?.cupon ?? true;
}
