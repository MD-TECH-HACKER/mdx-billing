import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Image,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { WebView } from "react-native-webview";

WebBrowser.maybeCompleteAuthSession();

const WEB_APP_URL = process.env.EXPO_PUBLIC_BASE_URL || "https://mdx-billing.app";
const MOBILE_AUTH_CALLBACK = "mdxbilling://auth";
const WEB_VIEW_SOURCE = {
  uri: WEB_APP_URL,
  headers: WEB_APP_URL.includes(".ngrok-free.dev")
    ? { "ngrok-skip-browser-warning": "1" }
    : undefined,
};

/* ────────────────────────────────────────────────────────
 * JavaScript injected into every page load.
 * Intercepts ANY click that would trigger Google sign-in
 * and sends a postMessage to React Native instead.
 * This fires BEFORE the WebView even tries to navigate,
 * so it works on Android where onShouldStartLoadWithRequest
 * misses server-side redirects.
 * ──────────────────────────────────────────────────────── */
const INJECTED_GOOGLE_INTERCEPT_JS = `
(function() {
  if (window.__mdxGoogleInterceptInstalled) return;
  window.__mdxGoogleInterceptInstalled = true;

  /* 1. Intercept clicks on any element whose href contains google sign-in */
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== document.body) {
      var href = el.href || '';
      var action = (el.getAttribute && el.getAttribute('action')) || '';
      if (
        (typeof href === 'string' && href.indexOf('/api/auth/signin/google') !== -1) ||
        (typeof action === 'string' && action.indexOf('/api/auth/signin/google') !== -1)
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'GOOGLE_SIGN_IN',
          url: window.location.origin + '/api/auth/signin/google?callbackUrl=' + encodeURIComponent(window.location.pathname || '/')
        }));
        return false;
      }
      el = el.parentElement;
    }
  }, true);

  /* 2. Intercept programmatic navigation (window.location assignment) */
  var _pushState = history.pushState;
  var _replaceState = history.replaceState;

  function checkGoogleNav(url) {
    if (typeof url === 'string' && (
      url.indexOf('/api/auth/signin/google') !== -1 ||
      url.indexOf('accounts.google.com') !== -1
    )) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'GOOGLE_SIGN_IN',
        url: window.location.origin + '/api/auth/signin/google?callbackUrl=' + encodeURIComponent(window.location.pathname || '/')
      }));
      return true;
    }
    return false;
  }

  history.pushState = function() {
    if (arguments[2] && checkGoogleNav(String(arguments[2]))) return;
    return _pushState.apply(this, arguments);
  };
  history.replaceState = function() {
    if (arguments[2] && checkGoogleNav(String(arguments[2]))) return;
    return _replaceState.apply(this, arguments);
  };

  /* 3. Intercept form submissions to Google sign-in */
  document.addEventListener('submit', function(e) {
    var form = e.target;
    var action = form.action || '';
    if (typeof action === 'string' && action.indexOf('/api/auth/signin/google') !== -1) {
      e.preventDefault();
      e.stopPropagation();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'GOOGLE_SIGN_IN',
        url: action
      }));
      return false;
    }
  }, true);
})();
true;
`;

function normalizeReturnTo(callbackUrl) {
  if (!callbackUrl) return "/";
  try {
    if (callbackUrl.startsWith("/")) return callbackUrl.startsWith("//") ? "/" : callbackUrl;
    const parsed = new URL(callbackUrl);
    const appOrigin = new URL(WEB_APP_URL).origin;
    return parsed.origin === appOrigin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : "/";
  } catch {
    return "/";
  }
}

/** Returns true if the URL is our Google sign-in endpoint OR Google's OAuth page */
function isGoogleAuthUrl(url) {
  try {
    const parsed = new URL(url);
    const appOrigin = new URL(WEB_APP_URL).origin;
    // Our own server endpoint that triggers Google OAuth
    if (parsed.origin === appOrigin && parsed.pathname === "/api/auth/signin/google") return true;
    // Google's OAuth domain (catches server-side redirects)
    if (parsed.hostname === "accounts.google.com") return true;
    return false;
  } catch {
    return false;
  }
}

function createMobileGoogleAuthUrl(url) {
  try {
    const requested = new URL(url);
    const returnTo = normalizeReturnTo(requested.searchParams.get("callbackUrl"));
    const bridgeUrl = new URL("/api/auth/mobile-success", WEB_APP_URL);
    bridgeUrl.searchParams.set("returnTo", returnTo);

    const signInUrl = new URL("/account/signin", WEB_APP_URL);
    signInUrl.searchParams.set("auto", "google");
    signInUrl.searchParams.set("callbackUrl", bridgeUrl.toString());
    return signInUrl.toString();
  } catch {
    // Fallback: build a default auth URL
    const bridgeUrl = `${WEB_APP_URL}/api/auth/mobile-success?returnTo=%2F`;
    return `${WEB_APP_URL}/account/signin?auto=google&callbackUrl=${encodeURIComponent(bridgeUrl)}`;
  }
}

function getQueryValue(queryParams, key) {
  const value = queryParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

/* ── Thin animated progress bar shown at the top during page navigations ── */
function TopProgressBar({ visible }) {
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      progress.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: false }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(progress, {
            toValue: 0.85,
            duration: 1200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.timing(progress, {
            toValue: 0.95,
            duration: 3000,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    } else {
      Animated.timing(progress, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: false }).start(() => {
          progress.setValue(0);
        });
      });
    }
  }, [visible, progress, opacity]);

  return (
    <Animated.View
      style={[styles.progressBarTrack, { opacity }]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.progressBarFill,
          {
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </Animated.View>
  );
}

export default function Index() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState(null);
  // Prevent opening Google auth multiple times
  const googleAuthInProgress = useRef(false);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  const retry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  const completeMobileGoogleAuth = useCallback((callbackUrl) => {
    const parsed = Linking.parse(callbackUrl);
    const token = getQueryValue(parsed.queryParams, "token");
    const returnTo = normalizeReturnTo(getQueryValue(parsed.queryParams, "returnTo"));
    if (!token) {
      setError("Google sign-in did not return a session. Please try again.");
      return;
    }

    const targetUrl = new URL(returnTo, WEB_APP_URL).toString();
    const sessionScript = `
      (function () {
        var token = ${JSON.stringify(token)};
        var maxAge = 60 * 60 * 24 * 30;
        var cookieValue = encodeURIComponent(token);
        document.cookie = "authjs.session-token=" + cookieValue + "; Path=/; Max-Age=" + maxAge + "; SameSite=Lax; Secure";
        document.cookie = "__Secure-authjs.session-token=" + cookieValue + "; Path=/; Max-Age=" + maxAge + "; SameSite=Lax; Secure";
        window.location.href = ${JSON.stringify(targetUrl)};
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(sessionScript);
  }, []);

  /* ── Listen for deep link callback from Chrome after Google sign-in ── */
  useEffect(() => {
    const handleDeepLink = (event) => {
      if (event.url && event.url.startsWith(MOBILE_AUTH_CALLBACK)) {
        googleAuthInProgress.current = false;
        completeMobileGoogleAuth(event.url);
      }
    };
    const subscription = Linking.addEventListener("url", handleDeepLink);

    // Also check if the app was opened via a deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith(MOBILE_AUTH_CALLBACK)) {
        completeMobileGoogleAuth(url);
      }
    });

    return () => subscription.remove();
  }, [completeMobileGoogleAuth]);

  /**
   * Opens Google sign-in in the ACTUAL Chrome / default browser app.
   * Uses Linking.openURL — NOT Chrome Custom Tab.
   * After Google auth completes, the server redirects to mdxbilling://auth
   * which brings the user back to this app via the deep link listener above.
   */
  const openGoogleInExternalBrowser = useCallback(async (url) => {
    if (googleAuthInProgress.current) return;
    googleAuthInProgress.current = true;

    try {
      const authUrl = createMobileGoogleAuthUrl(url || `${WEB_APP_URL}/api/auth/signin/google?callbackUrl=/`);
      // Opens the ACTUAL Chrome browser / default browser on the phone
      await Linking.openURL(authUrl);
    } catch (err) {
      setError(err?.message || "Could not open Google sign-in");
      googleAuthInProgress.current = false;
    }
  }, []);

  /** Handle messages from injected JavaScript (Layer 1: click interception) */
  const handleWebViewMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "GOOGLE_SIGN_IN") {
        openGoogleInExternalBrowser(data.url);
      }
    } catch {
      // Not our message, ignore
    }
  }, [openGoogleInExternalBrowser]);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);

  /** Layer 3: If WebView somehow lands on Google, go back and open external */
  const handleNavigationStateChange = useCallback((navState) => {
    setCanGoBack(navState.canGoBack);

    // If the WebView navigated to Google OAuth, stop it and open external browser
    if (navState.url && navState.url.includes("accounts.google.com")) {
      // Go back to previous page in WebView
      if (webViewRef.current) {
        webViewRef.current.stopLoading();
        webViewRef.current.goBack();
      }
      // Open in external browser
      openGoogleInExternalBrowser(null);
    }
  }, [openGoogleInExternalBrowser]);

  return (
    <View style={styles.safeArea}>
      <StatusBar hidden={true} />

      {/* ── Thin progress bar at top (only AFTER initial load is done) ── */}
      {!isInitialLoad && <TopProgressBar visible={isLoading} />}

      <WebView
        ref={webViewRef}
        source={WEB_VIEW_SOURCE}
        style={styles.webView}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        userAgent="Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
        /* Inject Google interception JS into every page */
        injectedJavaScript={INJECTED_GOOGLE_INTERCEPT_JS}
        /* Handle postMessage from injected JS */
        onMessage={handleWebViewMessage}
        /* Layer 2: Catch Google URLs that slip past injected JS */
        onShouldStartLoadWithRequest={(request) => {
          if (isGoogleAuthUrl(request.url)) {
            openGoogleInExternalBrowser(request.url);
            return false;
          }
          return true;
        }}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={handleLoadEnd}
        /* Layer 3: Last resort — if WebView lands on Google, go back + open external */
        onNavigationStateChange={handleNavigationStateChange}
        onError={(event) => {
          setError(event.nativeEvent.description || "Could not load MDX Billing");
          setIsLoading(false);
        }}
        onHttpError={(event) => {
          const statusCode = event.nativeEvent.statusCode;
          if (statusCode >= 500) setError(`Server error ${statusCode}`);
        }}
      />

      {/* ── Full splash loader: ONLY on initial app launch ── */}
      {isInitialLoad && isLoading ? (
        <View style={styles.splashLoader}>
          <View style={styles.loaderCard}>
            <View style={styles.logo}>
              <Image source={require("../../assets/images/icon.png")} style={styles.logoImage} />
            </View>
            <Text style={styles.loaderTitle}>Loading MDX Billing</Text>
            <ActivityIndicator color="#a78bfa" style={styles.spinner} />
          </View>
        </View>
      ) : null}

      {/* ── Error overlay ── */}
      {error ? (
        <View style={styles.error}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>MDX Billing could not open</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={retry}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  webView: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  /* ── Top progress bar ── */
  progressBarTrack: {
    height: 3,
    backgroundColor: "transparent",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#8b5cf6",
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },

  /* ── Full-screen splash (initial load only) ── */
  splashLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#ffffff",
    justifyContent: "center",
    zIndex: 50,
  },
  loaderCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 28,
    elevation: 4,
    paddingHorizontal: 28,
    paddingVertical: 24,
    shadowColor: "#111827",
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  logo: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    height: 64,
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
    width: 64,
  },
  logoImage: {
    height: 64,
    width: 64,
  },
  loaderTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  spinner: {
    marginTop: 14,
  },

  /* ── Error overlay ── */
  error: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#ffffff",
    justifyContent: "center",
    padding: 20,
    zIndex: 60,
  },
  errorCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    elevation: 4,
    padding: 22,
    shadowColor: "#111827",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    width: "100%",
  },
  errorTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: "#8b5cf6",
    borderRadius: 16,
    paddingVertical: 13,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
