import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { anyAccountExists } from "@/server/accounts"

export const metadata = { title: "Create an account" }

// The predicate is database state, so this page can never be prerendered.
export const dynamic = "force-dynamic"

export default async function SignUpPage() {
  if (await anyAccountExists()) redirect("/sign-in")
  return <AuthForm mode="sign-up" signupOpen />
}
