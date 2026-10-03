/** The framework boundary for public CMS controllers; no theme dependency. */
export interface PublicPageContext {
 params:Record<string,string|undefined>;
 url:URL;
 locals:App.Locals;
 response:{headers:Headers};
}
