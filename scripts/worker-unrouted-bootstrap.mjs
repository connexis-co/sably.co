/** The first Worker version is inert and has no domain or workers.dev route. */
export default {fetch(){return new Response('Production cutover has not been activated.',{status:503,headers:{'cache-control':'no-store','x-robots-tag':'noindex'}});}};
