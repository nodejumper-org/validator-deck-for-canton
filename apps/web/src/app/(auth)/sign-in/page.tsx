import { AuthForm } from "@/components/auth-form"
import { anyAccountExists } from "@/server/accounts"

export const metadata = { title: "Sign in" }

// The sign-up link depends on database state; never prerender.
export const dynamic = "force-dynamic"

export default async function SignInPage() {
  return <AuthForm mode="sign-in" signupOpen={!(await anyAccountExists())} />
}
