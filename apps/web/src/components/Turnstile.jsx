import { useEffect, useRef, useState } from "react";

const SITE_KEY =
  import.meta.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
  import.meta.env.VITE_TURNSTILE_SITE_KEY ||
  "0x4AAAAAADW_lQGoLFujXvjp";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export default function Turnstile({ onToken, onError }) {
  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.turnstile) {
      setLoaded(true);
      return undefined;
    }

    let script = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const handleLoad = () => setLoaded(true);
    script.addEventListener("load", handleLoad);
    return () => script.removeEventListener("load", handleLoad);
  }, []);

  useEffect(() => {
    if (!loaded || !window.turnstile || !containerRef.current || widgetRef.current) return;
    widgetRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      theme: "light",
      callback: (token) => onToken?.(token),
      "error-callback": () => {
        onToken?.("");
        onError?.("Security check failed. Please try again.");
      },
      "expired-callback": () => onToken?.(""),
    });
  }, [loaded, onError, onToken]);

  return (
    <div className="rounded-2xl bg-white/10 border border-white/15 p-3">
      <div ref={containerRef} className="min-h-[65px] flex items-center justify-center" />
      {!loaded ? <div className="text-white/60 text-xs text-center">Loading security check...</div> : null}
    </div>
  );
}
