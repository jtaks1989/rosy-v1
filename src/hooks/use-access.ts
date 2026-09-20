import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAccess, setDemoRole, type AccessSnapshot } from "@/lib/access.functions";

export function useAccess() {
  const fn = useServerFn(getAccess);
  return useQuery<AccessSnapshot>({
    queryKey: ["access"],
    queryFn: () => fn({}) as Promise<AccessSnapshot>,
    staleTime: 60_000,
  });
}

export function useSetDemoRole() {
  const fn = useServerFn(setDemoRole);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: string) => fn({ data: { role } }) as Promise<AccessSnapshot>,
    onSuccess: (snapshot) => {
      // A permission change must invalidate every cached answer, not just navigation.
      qc.setQueryData(["access"], snapshot);
      qc.invalidateQueries();
    },
  });
}

export function can(access: AccessSnapshot | undefined, permission: string) {
  return Boolean(access?.permissions.includes(permission));
}
