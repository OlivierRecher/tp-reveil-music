/** Signature de `fetch` injectée dans les adaptateurs HTTP (remplacée par un faux en test). */
export type HttpFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
