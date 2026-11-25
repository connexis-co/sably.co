/// <reference types="astro/client" />
/// <reference types="emdash/locals" />
import type { ContentSeo } from 'emdash';

declare global {
  namespace App {
    interface Locals {
      sablyContent?: { collection: string; id: string; slug?: string };
      sablySeo?: ContentSeo;
      /** Tema de esta petición (src/lib/ajustes-tema.ts), resuelto una sola vez. */
      sablyTema?: import('./lib/ajustes-tema').TemaDeLaPeticion;
      sablyCuenta?: import('./lib/cuenta/ajustes').EstadoCuenta;
    }
  }
}
export {};
