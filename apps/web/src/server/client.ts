import {
  createLedgerClient,
  createTokenProvider,
  createValidatorClient,
  type LedgerClient,
  type ValidatorClient,
} from "@validator-deck/canton-client"
import { open } from "./crypto"
import { getNode } from "./nodes"
import { HttpError } from "./route-helpers"
import type { NodeRecord } from "./schema"

async function requireNode(nodeId: string, userId: string): Promise<NodeRecord> {
  const node = await getNode(nodeId, userId)
  // A node owned by someone else is indistinguishable from one that does not
  // exist, on purpose.
  if (!node) throw new HttpError(404, "NODE_NOT_FOUND", `No node registered with id ${nodeId}`)
  return node
}

/** Keyed by node id, so each node's bearer token is cached and refreshed alone. */
function tokenFor(node: NodeRecord) {
  return createTokenProvider(node.id, {
    tokenUrl: node.authTokenUrl,
    clientId: node.authClientId,
    clientSecret: open(node.authClientSecretEnc),
    audience: node.authAudience ?? undefined,
    scope: node.authScope ?? undefined,
  })
}

export async function ledgerFor(nodeId: string, userId: string): Promise<LedgerClient> {
  const node = await requireNode(nodeId, userId)
  return ledgerForNode(node)
}

/** For the scheduler, which already holds the row and has no session. */
export function ledgerForNode(node: NodeRecord): LedgerClient {
  return createLedgerClient({ baseUrl: node.ledgerApiUrl, getToken: tokenFor(node) })
}

export async function validatorFor(nodeId: string, userId: string): Promise<ValidatorClient> {
  const node = await requireNode(nodeId, userId)
  if (!node.validatorApiUrl) {
    throw new HttpError(400, "NO_VALIDATOR", `Node "${node.name}" has no validator API configured`)
  }
  return createValidatorClient({ baseUrl: node.validatorApiUrl, getToken: tokenFor(node) })
}

/** True when the node also exposes a Splice validator API. */
export async function hasValidator(nodeId: string, userId: string): Promise<boolean> {
  return Boolean((await getNode(nodeId, userId))?.validatorApiUrl)
}
