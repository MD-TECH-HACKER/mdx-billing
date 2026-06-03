import { useQuery } from "@tanstack/react-query";

async function fetchPlatformSettings() {
  const response = await fetch("/api/platform/settings");
  if (!response.ok) {
    throw new Error("Failed to load platform settings");
  }
  return response.json();
}

export default function usePlatformSettings() {
  const query = useQuery({
    queryKey: ["platform-settings"],
    queryFn: fetchPlatformSettings,
    staleTime: 60 * 1000,
  });

  return {
    settings: query.data?.settings || null,
    currentUserIsAdmin: !!query.data?.currentUserIsAdmin,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
