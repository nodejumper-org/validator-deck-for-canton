import {
  createLedgerClient,
  createTokenProvider,
  createValidatorClient,
  type LedgerClient,
  type ValidatorClient,
} from "@canton/client"
import { open } from "./crypto"
import { getNode } from "./nodes"
import { HttpError } from "./route-helpers"
import type { NodeRecord } from "./schema"

async function requireNode(nodeId: string): Promise<NodeRecord> {
  const node = await getNode(nodeId)
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

export async function ledgerFor(nodeId: string): Promise<LedgerClient> {
  const node = await requireNode(nodeId)
  return createLedgerClient({ baseUrl: node.ledgerApiUrl, getToken: tokenFor(node) })
}

export async function validatorFor(nodeId: string): Promise<ValidatorClient> {
  const node = await requireNode(nodeId)
  if (!node.validatorApiUrl) {
    throw new HttpError(400, "NO_VALIDATOR", `Node "${node.name}" has no validator API configured`)
  }
  return createValidatorClient({ baseUrl: node.validatorApiUrl, getToken: tokenFor(node) })
}

/** True when the node also exposes a Splice validator API. */
export async function hasValidator(nodeId: string): Promise<boolean> {
  return Boolean((await getNode(nodeId))?.validatorApiUrl)
}
