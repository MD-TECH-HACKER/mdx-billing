import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";

const WEB_APP_URL = process.env.EXPO_PUBLIC_BASE_URL || "https://mdx-billing.app";

export default function Index() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" backgroundColor="#0f0c29" />
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_APP_URL }}
        style={styles.webView}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
        onError={(event) => {
          setError(event.nativeEvent.description || "Could not load MDX Billing");
          setIsLoading(false);
        }}
        onHttpError={(event) => {
          const statusCode = event.nativeEvent.statusCode;
          if (statusCode >= 500) setError(`Server error ${statusCode}`);
        }}
      />
      {isLoading ? (
        <View style={styles.loader}>
          <View style={styles.loaderCard}>
            <View style={styles.logo}>
              <Image source={require("../../assets/images/icon.png")} style={styles.logoImage} />
            </View>
            <Text style={styles.loaderTitle}>Loading MDX Billing</Text>
            <ActivityIndicator color="#a78bfa" style={styles.spinner} />
          </View>
        </View>
      ) : null}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f0c29",
  },
  webView: {
    flex: 1,
    backgroundColor: "#0f0c29",
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#0f0c29",
    justifyContent: "center",
  },
  loaderCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 24,
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
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  spinner: {
    marginTop: 14,
  },
  error: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#0f0c29",
    justifyContent: "center",
    padding: 20,
  },
  errorCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 24,
    padding: 22,
    width: "100%",
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    color: "rgba(255,255,255,0.75)",
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
