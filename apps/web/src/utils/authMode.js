export function shouldUseDevSocialShim(provider, search = "") {
  const params = new URLSearchParams(search);
  return params.get("simulateAuth") === provider;
}
