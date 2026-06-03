// Simple fetch wrapper — all requests go directly to localhost (no platform proxy).
const originalFetch = fetch;

export const fetchWithHeaders = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  return originalFetch(input, init);
};

export default fetchWithHeaders;
