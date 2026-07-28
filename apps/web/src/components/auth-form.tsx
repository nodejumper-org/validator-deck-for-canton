"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn, signUp } from "@/lib/auth-client"

const MIN_PASSWORD = 10

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const isSignUp = mode === "sign-up"

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (isSignUp && password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`)
      return
    }

    setPending(true)
    const result = isSignUp
      ? await signUp.email({ name: name.trim() || email.split("@")[0]!, email, password })
      : await signIn.email({ email, password })
    setPending(false)

    if (result.error) {
      setError(result.error.message ?? "That did not work. Check your details and try again.")
      return
    }
    router.push("/")
    router.refresh()
  }

  return (
    <div className="bg-card rounded-lg border p-5">
      <h1 className="font-heading text-[18px] font-semibold">
        {isSignUp ? "Create an account" : "Sign in"}
      </h1>
      <p className="text-muted-foreground mt-1 text-[13px]">
        {isSignUp
          ? "Your nodes and their credentials are private to your account."
          : "Welcome back."}
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        {isSignUp ? (
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-[13px]">
              Name
            </Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex"
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px]">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[13px]">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isSignUp ? (
            <p className="text-muted-foreground text-[12px]">
              At least {MIN_PASSWORD} characters.
            </p>
          ) : null}
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Working…" : isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="text-muted-foreground mt-4 text-[13px]">
        {isSignUp ? "Already have an account? " : "No account yet? "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="text-foreground underline underline-offset-2"
        >
          {isSignUp ? "Sign in" : "Create one"}
        </Link>
      </p>
    </div>
  )
}
