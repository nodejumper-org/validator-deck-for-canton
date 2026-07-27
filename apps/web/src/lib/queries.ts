"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api, ApiError } from "./api"
import type { NodeOverview, NodeSummary, TestResult } from "./types"

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
