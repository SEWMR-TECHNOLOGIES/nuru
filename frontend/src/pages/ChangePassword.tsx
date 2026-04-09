import { useState, useMemo } from "react";
import { Eye, EyeOff, CheckCircle2, Loader2, ShieldCheck, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceMeta } from "@/hooks/useWorkspaceMeta";
import { api, showApiErrorsShadcn } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const PASSWORD_RULES_KEYS = [
  { key: "at_least_8_chars", test: (p: string) => p.length >= 8 },
  { key: "one_uppercase", test: (p: string) => /[A-Z]/.test(p) },
  { key: "one_lowercase", test: (p: string) => /[a-z]/.test(p) },
  { key: "one_number", test: (p: string) => /\d/.test(p) },
  { key: "one_special_char", test: (p: string) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(p) },
];

const ChangePassword = () => {
  const { t } = useLanguage();
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

  useWorkspaceMeta({ title: t('change_password'), description: "Update your account password." });

  const passwordChecks = useMemo(
    () => PASSWORD_RULES_KEYS.map(r => ({ ...r, label: t(r.key), passed: r.test(formData.new_password) })),
    [formData.new_password, t]
  );
  const allPassed = passwordChecks.every(c => c.passed);
  const passwordsMatch = formData.new_password === formData.confirm_password && formData.confirm_password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.current_password) {
      toast({ title: t('missing_fields'), description: t('enter_current_password'), variant: "destructive" });
      return;
    }
    if (!allPassed) {
      toast({ title: t('error'), variant: "destructive" });
      return;
    }
    if (formData.new_password !== formData.confirm_password) {
      toast({ title: t('passwords_dont_match'), variant: "destructive" });
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
        toast({ title: t('success'), description: response.message || t('password_changed_success') });
      } else {
        showApiErrorsShadcn(response, toast, "Change Failed");
      }
    } catch {
      toast({ title: t('error'), description: "Unable to change password. Try again.", variant: "destructive" });
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
          <h2 className="text-xl font-semibold text-foreground">{t('password_updated')}</h2>
          <p className="text-sm text-muted-foreground">{t('password_changed_success')}</p>
          <Button onClick={() => navigate('/settings')} className="w-full rounded-full h-11 bg-foreground text-background hover:bg-foreground/90">
            {t('back_to_settings')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('change_password')}</h1>
          <p className="text-sm text-muted-foreground">{t('secure_account_new')}</p>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('current_password')}</label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                placeholder={t('enter_current_password')}
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

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('new_password')}</label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                placeholder={t('enter_new_password')}
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
                  <li key={c.key} className={`flex items-center gap-2 text-xs transition-colors ${c.passed ? "text-green-600" : "text-muted-foreground"}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 transition-colors ${c.passed ? "text-green-600" : "text-muted-foreground/30"}`} />
                    {c.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('confirm_password')}</label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                placeholder={t('confirm_new_password')}
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
              <p className="text-xs text-destructive mt-1.5">{t('passwords_dont_match')}</p>
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
            {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('updating')}</> : t('update_password')}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
