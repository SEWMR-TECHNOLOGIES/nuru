import { useState, useMemo } from "react";
import { Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceMeta } from "@/hooks/useWorkspaceMeta";
import { api, showApiErrorsShadcn } from "@/lib/api";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /\d/.test(p) },
  { label: "One special character", test: (p: string) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(p) },
];

const ChangePassword = () => {
  const { toast } = useToast();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
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
        setTimeout(() => setIsSuccess(false), 3000);
      } else {
        showApiErrorsShadcn(response, toast, "Change Failed");
      }
    } catch {
      toast({ title: "Error", description: "Unable to change password. Try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-6 px-4 md:px-0">
      <h1 className="text-2xl font-bold text-foreground mb-1">Change Password</h1>
      <p className="text-muted-foreground text-sm mb-6">Update your account password</p>

      {isSuccess && (
        <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-3 rounded-xl mb-6 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Password changed successfully
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Current Password */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Current Password</label>
          <div className="relative">
            <Input
              type={showCurrent ? "text" : "password"}
              placeholder="Enter current password"
              value={formData.current_password}
              onChange={e => setFormData(prev => ({ ...prev, current_password: e.target.value }))}
              className="h-12 pr-12 rounded-xl"
              autoComplete="off"
              required
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">New Password</label>
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              placeholder="Enter new password"
              value={formData.new_password}
              onChange={e => setFormData(prev => ({ ...prev, new_password: e.target.value }))}
              className="h-12 pr-12 rounded-xl"
              autoComplete="off"
              required
            />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {formData.new_password.length > 0 && (
            <ul className="mt-3 space-y-1">
              {passwordChecks.map(c => (
                <li key={c.label} className={`flex items-center gap-2 text-xs ${c.passed ? "text-green-600" : "text-muted-foreground"}`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${c.passed ? "text-green-600" : "text-muted-foreground/40"}`} />
                  {c.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Confirm New Password */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Confirm New Password</label>
          <Input
            type={showNew ? "text" : "password"}
            placeholder="Confirm new password"
            value={formData.confirm_password}
            onChange={e => setFormData(prev => ({ ...prev, confirm_password: e.target.value }))}
            className="h-12 rounded-xl"
            autoComplete="off"
            required
          />
          {formData.confirm_password.length > 0 && formData.new_password !== formData.confirm_password && (
            <p className="text-xs text-destructive mt-1">Passwords do not match</p>
          )}
        </div>

        <Button type="submit" className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 rounded-full" disabled={isLoading || !allPassed}>
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Changing...</> : "Change Password"}
        </Button>
      </form>
    </div>
  );
};

export default ChangePassword;
