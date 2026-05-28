import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { api, showApiErrorsShadcn } from "@/lib/api";

const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /\d/.test(p) },
  { label: "One special character", test: (p: string) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(p) },
];

type State = "loading" | "valid" | "expired" | "used" | "invalid" | "submitting" | "success";

const SetPassword = () => {
  useMeta({ title: "Set your Nuru password", description: "Securely set your password and sign in to Nuru." });
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [state, setState] = useState<State>("loading");
  const [firstName, setFirstName] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setState("invalid"); return; }
      const res = await api.auth.validateSetupToken(token);
      if (cancelled) return;
      const s = (res.data?.state || (res.success ? "valid" : "invalid")) as State;
      setFirstName(res.data?.first_name || "");
      setState(s === "valid" ? "valid" : (s as State));
    })();
    return () => { cancelled = true; };
  }, [token]);

  const checks = useMemo(() => RULES.map(r => ({ ...r, ok: r.test(password) })), [password]);
  const allOk = checks.every(c => c.ok) && password === confirm && confirm.length > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allOk) return;
    setState("submitting");
    const res = await api.auth.setPasswordWithToken(token, password, confirm);
    if (!res.success) {
      showApiErrorsShadcn(res, toast);
      setState("valid");
      return;
    }
    const data: any = res.data;
    if (data?.access_token) localStorage.setItem("access_token", data.access_token);
    if (data?.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
    setState("success");
    toast({ title: "Welcome to Nuru", description: "Your password has been set." });
    setTimeout(() => navigate("/"), 1200);
  };

  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm"
        >
          {state === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Checking your setup link...</p>
            </div>
          )}

          {(state === "expired" || state === "used" || state === "invalid") && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">
                {state === "expired" && "This link has expired"}
                {state === "used" && "This link has already been used"}
                {state === "invalid" && "This setup link is invalid"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Please ask the person who registered you to send a new setup link, or sign in if you already set your password.
              </p>
              <Button asChild variant="outline" className="mt-2"><Link to="/login">Go to sign in</Link></Button>
            </div>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="text-sm text-muted-foreground">Signing you in...</p>
            </div>
          )}

          {(state === "valid" || state === "submitting") && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                {firstName ? `Welcome, ${firstName}` : "Set your password"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a secure password to sign in to Nuru.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4" autoComplete="off">
                <div className="relative">
                  <Input
                    type={showPwd ? "text" : "password"}
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label="toggle password visibility">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Input
                  type={showPwd ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />

                <ul className="space-y-1 text-xs">
                  {checks.map(c => (
                    <li key={c.label} className={c.ok ? "text-primary" : "text-muted-foreground"}>
                      <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />{c.label}
                    </li>
                  ))}
                  {confirm.length > 0 && (
                    <li className={password === confirm ? "text-primary" : "text-destructive"}>
                      <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />Passwords match
                    </li>
                  )}
                </ul>

                <Button type="submit" className="w-full" disabled={!allOk || state === "submitting"}>
                  {state === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set password and sign in"}
                </Button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default SetPassword;
