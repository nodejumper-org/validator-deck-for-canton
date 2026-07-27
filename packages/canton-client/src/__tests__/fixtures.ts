/**
 * Every payload here was captured from the live devnet participant
 * (validator-dev-1, Canton 3.5.8 / Splice 0.6.12) during design research.
 * Keeping real shapes as fixtures is what makes the schemas trustworthy.
 */

export const PARTICIPANT_ID =
  "validator-dev-1::1220a5cd222348403b3db750ba80ddbd0c3f18a5692b425273d150c1efff5ceb63bd"

export const SYNCHRONIZER_ID =
  "global-domain::1220be58c29e65de40bf273be1dc2b266d43a9a002ea5b18955aeef7aac881bb471a"

export const versionResponse = {
  version: "3.5.8",
  features: {
    experimental: {
      staticTime: { supported: false },
      commandInspectionService: { supported: true },
    },
    userManagement: { supported: true, maxRightsPerUser: 1000, maxUsersPageSize: 1000 },
    partyManagement: { maxPartiesPageSize: 10000 },
  },
}

export const usersResponse = {
  users: [
    {
      id: "2b7fafd8-c0f4-44d1-a327-dcc6222970b8",
      primaryParty: PARTICIPANT_ID,
      isDeactivated: false,
      metadata: { resourceVersion: "1", annotations: {} },
      identityProviderId: "",
      primaryPartyAuthentication: false,
    },
  ],
  nextPageToken: "Ch5hdXRoMHw2OTI3Z",
}

export const rightsResponse = {
  rights: [
    { kind: { ParticipantAdmin: { value: {} } } },
    { kind: { CanActAs: { value: { party: PARTICIPANT_ID } } } },
    { kind: { CanReadAs: { value: { party: PARTICIPANT_ID } } } },
  ],
}

export const partiesResponse = {
  partyDetails: [
    {
      party: `cbtc-rfq-faucet::${PARTICIPANT_ID.split("::")[1]}`,
      isLocal: true,
      localMetadata: { resourceVersion: "0", annotations: {} },
      identityProviderId: "",
    },
    {
      party: "--provider::1220cddaf354fb12d4cbdee3d314430aa6fd26d6060b9f35c34a022885e3c681ec63",
      isLocal: false,
      localMetadata: { resourceVersion: "", annotations: {} },
      identityProviderId: "",
    },
  ],
  nextPageToken: "ClAtLXByb3ZpZGVy",
}

export const vettedPackagesResponse = {
  vettedPackages: [
    {
      packages: [
        {
          packageId: "60c61c542207080e97e378ab447cc355ecc47534b3a3ebbff307c4fb8339bc4d",
          validFromInclusive: null,
          validUntilExclusive: null,
          packageName: "daml-stdlib-DA-Stack-Types",
          packageVersion: "1.0.0",
        },
        {
          packageId: "86d888f34152dae8729900966b44abcb466b9c111699678de58032de601d2b04",
          validFromInclusive: null,
          validUntilExclusive: null,
          packageName: "splice-amulet",
          packageVersion: "0.1.22",
        },
      ],
      participantId: PARTICIPANT_ID,
      synchronizerId: SYNCHRONIZER_ID,
      topologySerial: 42,
    },
  ],
  nextPageToken: "",
}

export const connectedSynchronizersResponse = {
  connectedSynchronizers: [
    {
      synchronizerAlias: "global",
      synchronizerId: SYNCHRONIZER_ID,
      permission: "PARTICIPANT_PERMISSION_UNSPECIFIED",
    },
  ],
}

export const walletBalanceResponse = {
  round: 54683,
  effective_unlocked_qty: "2003398.0180157556",
  effective_locked_qty: "0.0000000000",
  total_holding_fees: "0.0000000000",
}

export const walletTransactionsResponse = {
  items: [
    {
      transaction_type: "transfer",
      transaction_subtype: {
        template_id:
          "727c0fb9711d59b506fbb3cff2342e55eb583bb88682a946220525c304feca4a:Splice.Wallet.Install:WalletAppInstall",
        choice: "WalletAppInstall_ExecuteBatch",
        amulet_operation: null,
        interface_id: null,
      },
      event_id: "#12205d8e23083599f5c3a0352fc3a54f10fea9e9d399b35eefba2c2b51bb71061b84:1",
      date: "2026-07-27T20:42:14.014892Z",
      sender: { party: PARTICIPANT_ID, amount: "55.7187007429" },
      receivers: [],
      holding_fees: "0.0000000000",
      app_rewards_used: "55.7187007429",
      validator_rewards_used: "0.0000000000",
      sv_rewards_used: "0.0000000000",
    },
  ],
}

export const validatorUserResponse = {
  party_id: PARTICIPANT_ID,
  user_name: "2b7fafd8-c0f4-44d1-a327-dcc6222970b8",
  featured: true,
}
