import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ThemeStyles from "@/components/ThemeStyles";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const themeBootScript = `
(function(){
  try {
    var t = localStorage.getItem('mdx_theme');
    var a = localStorage.getItem('mdx_accent');
    var v = localStorage.getItem('mdx_theme_v3');
    if (!v) {
      t = 'light'; localStorage.setItem('mdx_theme', 'light');
      a = '#F97316'; localStorage.setItem('mdx_accent', '#F97316');
      localStorage.setItem('mdx_theme_v3', '1');
    }
    t = t || 'light';
    a = a || '#F97316';
    var root = document.documentElement;
    root.setAttribute('data-theme', t);
    root.style.setProperty('--accent', a);
    var m = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(a);
    if (m) {
      root.style.setProperty('--accent-rgb', parseInt(m[1],16)+', '+parseInt(m[2],16)+', '+parseInt(m[3],16));
    }
  } catch(e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeStyles />
      <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      {children}
    </QueryClientProvider>
  );
}
