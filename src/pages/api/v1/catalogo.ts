import type { APIRoute } from 'astro';
import { env } from 'virtual:sably-runtime';
import { catalogResponse, type CatalogBindings } from '../../../plugins/sably-operations/catalog-api';
export const prerender = false;
export const GET: APIRoute = ({request}) => catalogResponse(request,env as CatalogBindings);
