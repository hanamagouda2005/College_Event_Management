"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not sign in.");
      router.replace("/");
      router.refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-art">
        <div className="brand">
          <span className="brand-mark"><ShieldCheck size={19} /></span>
          <span><span className="brand-name">Campus Ledger</span><span className="brand-subtitle">Event intelligence</span></span>
        </div>
        <div className="login-quote">
          <h1>Every gathering<br />leaves a story.</h1>
          <p>One clear view of the events, students, and moments that bring your campus together.</p>
        </div>
        <div className="login-footer">Administrator workspace · College event reporting</div>
      </section>
      <section className="login-form-side">
        <form className="login-form" onSubmit={submit}>
          <span className="login-lock"><LockKeyhole size={19} /></span>
          <h2>Welcome back</h2>
          <p>Sign in with your administrator password to continue.</p>
          <div className="field">
            <label htmlFor="admin-password">Administrator password</label>
            <input id="admin-password" className="control" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {error && <div className="error-message" role="alert">{error}</div>}
          <button className="button button-primary" type="submit" disabled={loading}>
            {loading ? <><span className="spinner" /> Signing in</> : "Sign in securely"}
          </button>
        </form>
      </section>
    </main>
  );
}