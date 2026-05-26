import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function useProfile({ enabled = true } = {}) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  const update = useMutation({
    mutationFn: async (patch) => {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save profile");
      }
      return res.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(["profile"], data);
    },
  });

  return {
    profile: query.data?.profile || null,
    loading: query.isLoading,
    refetch: query.refetch,
    update: update.mutate,
    updateAsync: update.mutateAsync,
    saving: update.isPending,
  };
}
