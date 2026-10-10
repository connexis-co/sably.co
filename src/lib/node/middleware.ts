import type { MiddlewareHandler } from 'astro';
import redirectSource from '../../../public/_redirects?raw';
import { env } from './runtime-bindings';
import { invalidateNodePages } from './cache-provider';
import { createNodeRequestHandler } from './request-handler';

const handle = createNodeRequestHandler({ env, redirects: redirectSource, invalidate: invalidateNodePages });

// Configured through EmDash's middleware.outer so redirects and setup protection
// run before CMS initialization and final headers include EmDash's response work.
export const onRequest: MiddlewareHandler = ({ request }, next) => handle(request, next);
