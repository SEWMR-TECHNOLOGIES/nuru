import { useState, useMemo } from "react";
import { Eye, EyeOff, CheckCircle2, Loader2, ShieldCheck, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceMeta } from "@/hooks/useWorkspaceMeta";
import { api, showApiErrorsShadcn } from "@/lib/api";
import { useNavigate } from "react-router-dom";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /\d/.test(p) },
  { label: "One special character", test: (p: string) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(p) },
];

const ChangePassword = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useWorkspaceMeta({ title: "Change Password", description: "Update your account password." });

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map(r => ({ ...r, passed: r.test(formData.new_password) })),
    [formData.new_password]
  );
  const allPassed = passwordChecks.every(c => c.passed);
  const passwordsMatch = formData.new_password === formData.confirm_password && formData.confirm_password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.current_password) {
      toast({ title: "Missing field", description: "Enter your current password.", variant: "destructive" });
      return;
    }
    if (!allPassed) {
      toast({ title: "Weak password", description: "Please meet all password requirements.", variant: "destructive" });
      return;
    }
    if (formData.new_password !== formData.confirm_password) {
      toast({ title: "Mismatch", description: "New passwords do not match.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.auth.changePassword(
        formData.current_password,
        formData.new_password,
        formData.confirm_password
      );
      if (response.success) {
        setIsSuccess(true);
        setFormData({ current_password: "", new_password: "", confirm_password: "" });
        toast({ title: "Success", description: response.message || "Password changed successfully." });
      } else {
        showApiErrorsShadcn(response, toast, "Change Failed");
      }
    } catch {
      toast({ title: "Error", description: "Unable to change password. Try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-sm w-full space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Password Updated</h2>
          <p className="text-sm text-muted-foreground">Your password has been changed successfully. Keep it safe!</p>
          <Button onClick={() => navigate('/settings')} className="w-full rounded-full h-11 bg-foreground text-background hover:bg-foreground/90">
            Back to Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Change Password</h1>
          <p className="text-sm text-muted-foreground">Secure your account with a new password</p>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Current Password</label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                placeholder="Enter current password"
                value={formData.current_password}
                onChange={e => setFormData(prev => ({ ...prev, current_password: e.target.value }))}
                className="h-11 pr-12 rounded-xl"
                autoComplete="off"
                required
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">New Password</label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                placeholder="Enter new password"
                value={formData.new_password}
                onChange={e => setFormData(prev => ({ ...prev, new_password: e.target.value }))}
                className="h-11 pr-12 rounded-xl"
                autoComplete="off"
                required
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {formData.new_password.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {passwordChecks.map(c => (
                  <li key={c.label} className={`flex items-center gap-2 text-xs transition-colors ${c.passed ? "text-green-600" : "text-muted-foreground"}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 transition-colors ${c.passed ? "text-green-600" : "text-muted-foreground/30"}`} />
                    {c.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Confirm New Password</label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new password"
                value={formData.confirm_password}
                onChange={e => setFormData(prev => ({ ...prev, confirm_password: e.target.value }))}
                className="h-11 pr-12 rounded-xl"
                autoComplete="off"
                required
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formData.confirm_password.length > 0 && !passwordsMatch && (
              <p className="text-xs text-destructive mt-1.5">Passwords do not match</p>
            )}
            {passwordsMatch && (
              <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 rounded-full text-sm font-medium"
            disabled={isLoading || !allPassed || !passwordsMatch}
          >
            {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...</> : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
