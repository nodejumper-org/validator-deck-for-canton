"use client"

import { adminClient, genericOAuthClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

// genericOAuthClient is registered unconditionally — it only adds the
// signIn.oauth2 call. Whether the server has a provider behind it is the
// server's decision, and the sign-in page hides the button when it does not.
export const authClient = createAuthClient({
  plugins: [adminClient(), genericOAuthClient()],
})

export const { signIn, signUp, signOut, useSession } = authClient
