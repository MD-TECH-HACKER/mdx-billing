import { useCallback } from 'react';
import { signIn, signOut } from "@auth/create/react";
import { shouldUseDevSocialShim } from "@/utils/authMode";

function devSocialShim(provider, callbackUrl) {
  const params = new URLSearchParams({ provider });
  if (callbackUrl) params.set('callbackUrl', callbackUrl);
  window.location.href = '/__create/social-dev-shim?' + params;
}

function useAuth() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const callbackUrl = typeof window !== 'undefined'
    ? new URLSearchParams(search).get('callbackUrl')
    : null;

  const signInWithCredentials = useCallback((options) => {
    return signIn("credentials-signin", {
      ...options,
      callbackUrl: callbackUrl ?? options.callbackUrl
    });
  }, [callbackUrl])

  const signUpWithCredentials = useCallback((options) => {
    return signIn("credentials-signup", {
      ...options,
      callbackUrl: callbackUrl ?? options.callbackUrl
    });
  }, [callbackUrl])

  const signInWithGoogle = useCallback((options) => {
    const cb = callbackUrl ?? options?.callbackUrl;
    if (shouldUseDevSocialShim("google", search)) return devSocialShim("google", cb);
    return signIn("google", { ...options, callbackUrl: cb });
  }, [callbackUrl, search]);
  const signInWithFacebook = useCallback((options) => {
    const cb = options?.callbackUrl;
    if (shouldUseDevSocialShim("facebook", search)) return devSocialShim("facebook", cb);
    return signIn("facebook", options);
  }, [search]);
  const signInWithTwitter = useCallback((options) => {
    const cb = options?.callbackUrl;
    if (shouldUseDevSocialShim("twitter", search)) return devSocialShim("twitter", cb);
    return signIn("twitter", options);
  }, [search]);
  const signInWithApple = useCallback((options) => {
    const cb = callbackUrl ?? options?.callbackUrl;
    if (shouldUseDevSocialShim("apple", search)) return devSocialShim("apple", cb);
    return signIn("apple", { ...options, callbackUrl: cb });
  }, [callbackUrl, search]);

  return {
    signInWithCredentials,
    signUpWithCredentials,
    signInWithGoogle,
    signInWithFacebook,
    signInWithTwitter,
    signInWithApple,
    signOut,
  }
}

export default useAuth;
