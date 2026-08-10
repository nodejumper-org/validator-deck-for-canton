"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api, ApiError } from "./api"
import type {
  DarUploadResult,
  DashboardResult,
  FleetHealth,
  LedgerUser,
  LocalScanState,
  Network,
  NodeOverview,
  NodeSummary,
  PackagesResult,
  PartiesPage,
  PartyDetails,
  TestResult,
  UserRight,
  ValidatorSummary,
} from "./types"

export const queryKeys = {
  nodes: () => ["nodes"] as const,
  node: (id: string) => ["nodes", id] as const,
  overview: (id: string) => ["nodes", id, "overview"] as const,
  users: (id: string) => ["nodes", id, "users"] as const,
  rights: (id: string, userId: string) => ["nodes", id, "users", userId, "rights"] as const,
  parties: (id: string, opts: { filter: string; pageToken: string }) =>
    ["nodes", id, "parties", opts] as const,
  localParties: (id: string) => ["nodes", id, "parties", "local"] as const,
  packages: (id: string) => ["nodes", id, "packages"] as const,
  validator: (id: string) => ["nodes", id, "validator"] as const,
  dashboard: () => ["dashboard"] as const,
  /** Both dashboard queries sit under the `dashboard` prefix, so the
      invalidateQueries calls already spread through this file reach them. */
  dashboardHealth: () => ["dashboard", "health"] as const,
  dashboardNetwork: (network: Network) => ["dashboard", "network", network] as const,
}

export function useNodes() {
  return useQuery({
    queryKey: queryKeys.nodes(),
    queryFn: () => api<{ nodes: NodeSummary[] }>("/api/nodes").then((r) => r.nodes),
  })
}

export function useNode(id: string) {
  const { data, ...rest } = useNodes()
  return { ...rest, data: data?.find((n) => n.id === id) }
}

/**
 * Shared mutation wrapper. Every write toasts the server's message verbatim on
 * failure — Canton's own error text is what an operator needs, not a paraphrase.
 */
function useNodeMutation<TArgs, TResult>(
  run: (args: TArgs) => Promise<TResult>,
  successMessage: (result: TResult, args: TArgs) => string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (result, args) => {
      toast.success(successMessage(result, args))
      void qc.invalidateQueries({ queryKey: queryKeys.nodes() })
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard() })
    },
    onError: (e: ApiError) => toast.error(e.message),
  })
}

export function useCreateNode() {
  return useNodeMutation(
    (input: Record<string, unknown>) =>
      api<{ node: NodeSummary }>("/api/nodes", { method: "POST", body: JSON.stringify(input) }),
    (r) => `Registered ${r.node.name}`,
  )
}

export function useUpdateNode(id: string) {
  return useNodeMutation(
    (input: Record<string, unknown>) =>
      api<{ node: NodeSummary }>(`/api/nodes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    (r) => `Updated ${r.node.name}`,
  )
}

export function useDeleteNode() {
  return useNodeMutation(
    (nodeId: string) => api<void>(`/api/nodes/${nodeId}`, { method: "DELETE" }),
    () => "Node removed",
  )
}

export function useTestNode() {
  return useMutation({
    mutationFn: (nodeId: string) => api<TestResult>(`/api/nodes/${nodeId}/test`, { method: "POST" }),
    onError: (e: ApiError) => toast.error(e.message),
  })
}

// ---------------------------------------------------------------- node detail

export function useOverview(nodeId: string) {
  return useQuery({
    queryKey: queryKeys.overview(nodeId),
    queryFn: () => api<NodeOverview>(`/api/nodes/${nodeId}/overview`),
    enabled: Boolean(nodeId),
  })
}

// ---------------------------------------------------------------------- users

/** Invalidates a node's own queries plus the cross-node dashboard. */
function useNodeScopedMutation<TArgs, TResult>(
  nodeId: string,
  run: (args: TArgs) => Promise<TResult>,
  successMessage: (result: TResult, args: TArgs) => string,
  extraKeys: readonly unknown[][] = [],
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (result, args) => {
      toast.success(successMessage(result, args))
      void qc.invalidateQueries({ queryKey: ["nodes", nodeId] })
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard() })
      for (const key of extraKeys) void qc.invalidateQueries({ queryKey: key })
    },
    onError: (e: ApiError) => toast.error(e.message),
  })
}

export function useUsers(nodeId: string) {
  return useQuery({
    queryKey: queryKeys.users(nodeId),
    queryFn: () => api<{ users: LedgerUser[] }>(`/api/nodes/${nodeId}/users`).then((r) => r.users),
    enabled: Boolean(nodeId),
  })
}

export function useCreateUser(nodeId: string) {
  return useNodeScopedMutation(
    nodeId,
    (input: { userId: string; primaryParty?: string; rights?: UserRight[] }) =>
      api<{ user: LedgerUser }>(`/api/nodes/${nodeId}/users`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    (r) => `Created user ${r.user.id}`,
  )
}

export function useUpdateUser(nodeId: string) {
  return useNodeScopedMutation(
    nodeId,
    ({ userId, ...body }: { userId: string; primaryParty?: string; isDeactivated?: boolean }) =>
      api<{ user: LedgerUser }>(`/api/nodes/${nodeId}/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    (r) => (r.user.isDeactivated ? `Deactivated ${r.user.id}` : `Updated ${r.user.id}`),
  )
}

export function useDeleteUser(nodeId: string) {
  return useNodeScopedMutation(
    nodeId,
    (userId: string) =>
      api<void>(`/api/nodes/${nodeId}/users/${encodeURIComponent(userId)}`, { method: "DELETE" }),
    (_r, userId) => `Deleted user ${userId}`,
  )
}

export function useUserRights(nodeId: string, userId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.rights(nodeId, userId),
    queryFn: () =>
      api<{ rights: UserRight[] }>(
        `/api/nodes/${nodeId}/users/${encodeURIComponent(userId)}/rights`,
      ).then((r) => r.rights),
    enabled: enabled && Boolean(nodeId && userId),
  })
}

export function useGrantRights(nodeId: string, userId: string) {
  return useNodeScopedMutation(
    nodeId,
    (rights: UserRight[]) =>
      api<{ rights: UserRight[] }>(
        `/api/nodes/${nodeId}/users/${encodeURIComponent(userId)}/rights`,
        { method: "POST", body: JSON.stringify({ rights }) },
      ),
    (_r, rights) => `Granted ${rights.length === 1 ? rights[0]!.kind : `${rights.length} rights`}`,
  )
}

export function useRevokeRights(nodeId: string, userId: string) {
  return useNodeScopedMutation(
    nodeId,
    (rights: UserRight[]) =>
      api<{ rights: UserRight[] }>(
        `/api/nodes/${nodeId}/users/${encodeURIComponent(userId)}/rights`,
        { method: "PATCH", body: JSON.stringify({ rights }) },
      ),
    (_r, rights) => `Revoked ${rights.length === 1 ? rights[0]!.kind : `${rights.length} rights`}`,
  )
}

// -------------------------------------------------------------------- parties

export function useParties(nodeId: string, opts: { filter: string; pageToken: string }) {
  return useQuery({
    queryKey: queryKeys.parties(nodeId, opts),
    queryFn: () => {
      const q = new URLSearchParams({ pageSize: "100" })
      if (opts.filter) q.set("filter", opts.filter)
      if (opts.pageToken) q.set("pageToken", opts.pageToken)
      return api<PartiesPage>(`/api/nodes/${nodeId}/parties?${q}`)
    },
    enabled: Boolean(nodeId),
    placeholderData: (previous) => previous,
  })
}

/**
 * Polls while the server-side scan is running. The scan takes about a minute on
 * devnet, so this is the one query in the app that refetches on a timer.
 */
export function useLocalParties(nodeId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.localParties(nodeId),
    queryFn: () => api<LocalScanState>(`/api/nodes/${nodeId}/parties/local`),
    enabled: enabled && Boolean(nodeId),
    refetchInterval: (query) => (query.state.data?.status === "scanning" ? 2000 : false),
    // The scan takes about a minute, so an operator will very likely switch tabs
    // while it runs. Without this the poll pauses and the page looks frozen.
    refetchIntervalInBackground: true,
    staleTime: 0,
  })
}

export function useRescanLocalParties(nodeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api<LocalScanState>(`/api/nodes/${nodeId}/parties/local`, { method: "POST" }),
    onSuccess: (state) => {
      qc.setQueryData(queryKeys.localParties(nodeId), state)
    },
    onError: (e: ApiError) => toast.error(e.message),
  })
}

export function useAllocateParty(nodeId: string) {
  return useNodeScopedMutation(
    nodeId,
    (partyIdHint: string) =>
      api<{ party: PartyDetails }>(`/api/nodes/${nodeId}/parties`, {
        method: "POST",
        body: JSON.stringify({ partyIdHint }),
      }),
    (r) => `Allocated ${r.party.party}`,
  )
}

// ------------------------------------------------------------------- packages

export function usePackages(nodeId: string) {
  return useQuery({
    queryKey: queryKeys.packages(nodeId),
    queryFn: () => api<PackagesResult>(`/api/nodes/${nodeId}/packages`),
    enabled: Boolean(nodeId),
  })
}

export function useUploadDar(nodeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { file: File; vetAllPackages: boolean; validateOnly: boolean }) => {
      const form = new FormData()
      form.set("file", input.file)
      form.set("vetAllPackages", String(input.vetAllPackages))
      form.set("validateOnly", String(input.validateOnly))
      return api<DarUploadResult>(`/api/nodes/${nodeId}/dars`, { method: "POST", body: form })
    },
    onSuccess: (result) => {
      if (!result.validated) {
        void qc.invalidateQueries({ queryKey: queryKeys.packages(nodeId) })
        void qc.invalidateQueries({ queryKey: queryKeys.dashboard() })
      }
    },
    // The dialog renders the error inline, so no toast here.
  })
}

// ------------------------------------------------------------------ validator

export function useValidator(nodeId: string) {
  return useQuery({
    queryKey: queryKeys.validator(nodeId),
    queryFn: () => api<ValidatorSummary>(`/api/nodes/${nodeId}/validator`),
    enabled: Boolean(nodeId),
  })
}

// ------------------------------------------------------------------ dashboard

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: () => api<DashboardResult>("/api/dashboard"),
  })
}

/** Every node, every network — the fleet table. Light probes, so it lands first. */
export function useFleetHealth() {
  return useQuery({
    queryKey: queryKeys.dashboardHealth(),
    queryFn: () => api<FleetHealth>("/api/dashboard/health").then((r) => r.nodes),
  })
}
