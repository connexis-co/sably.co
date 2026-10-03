/// <reference types="astro/client" />
/// <reference types="emdash/locals" />
import type { ContentSeo } from 'emdash';

declare global {
  namespace App {
    interface Locals {
      sablyContent?: { collection: string; id: string; slug?: string };
      sablySeo?: ContentSeo;
    }
  }
}
export {};
