import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { api, showApiErrorsShadcn } from "@/lib/api";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const PASSWORD_RULES_KEYS = [
  { key: "at_least_8_chars", test: (p: string) => p.length >= 8 },
  { key: "one_uppercase", test: (p: string) => /[A-Z]/.test(p) },
  { key: "one_lowercase", test: (p: string) => /[a-z]/.test(p) },
  { key: "one_number", test: (p: string) => /\d/.test(p) },
  { key: "one_special_char", test: (p: string) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(p) },
];

const ResetPassword = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const { toast } = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({ password: "", password_confirmation: "" });
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = useCallback(async () => {
    if (!resendEmail.trim() || resendCooldown > 0) return;
    setResendLoading(true);
    try {
      const isPhone = /^0[67]\d{8}$/.test(resendEmail.replace(/\s/g, ""));
      if (isPhone) {
        await api.auth.forgotPasswordPhone(resendEmail.replace(/\s/g, ""));
      } else {
        await api.auth.forgotPassword(resendEmail.trim());
      }
      toast({ title: t('success'), description: "A new reset link has been sent." });
      setResendCooldown(60);
    } catch {
      toast({ title: t('error'), description: "Unable to resend. Please try again.", variant: "destructive" });
    } finally {
      setResendLoading(false);
    }
  }, [resendEmail, resendCooldown, toast, t]);

  useMeta({ title: t('reset_password'), description: "Set a new password for your Nuru account." });

  const passwordChecks = useMemo(
    () => PASSWORD_RULES_KEYS.map(r => ({ ...r, label: t(r.key), passed: r.test(formData.password) })),
    [formData.password, t]
  );
  const allPassed = passwordChecks.every(c => c.passed);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.password || !formData.password_confirmation) {
      toast({ title: t('missing_fields'), variant: "destructive" });
      return;
    }
    if (!allPassed) {
      toast({ title: t('error'), description: "Please meet all password requirements.", variant: "destructive" });
      return;
    }
    if (formData.password !== formData.password_confirmation) {
      toast({ title: t('passwords_dont_match'), variant: "destructive" });
      return;
    }
    if (!token) {
      toast({ title: t('error'), description: "Reset token is missing.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.auth.resetPassword(token, formData.password, formData.password_confirmation);
      if (response.success) {
        setIsSuccess(true);
      } else {
        showApiErrorsShadcn(response, toast, "Reset Failed");
      }
    } catch {
      toast({ title: t('error'), description: "Unable to reset password. Try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {isSuccess ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 mx-auto text-primary" />
              <h1 className="text-2xl font-bold text-foreground">{t('password_reset_success')}</h1>
              <p className="text-muted-foreground">{t('can_sign_in_new_password')}</p>
              <Button onClick={() => navigate("/login")} className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 rounded-full">
                {t('go_to_sign_in')}
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-foreground mb-2">{t('set_new_password')}</h1>
              <p className="text-muted-foreground mb-8">{t('enter_new_password_below')}</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('new_password')}</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t('enter_new_password')}
                      value={formData.password}
                      onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="h-12 pr-12 rounded-xl"
                      autoComplete="off"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {formData.password.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {passwordChecks.map(c => (
                        <li key={c.key} className={`flex items-center gap-2 text-xs ${c.passed ? "text-green-600" : "text-muted-foreground"}`}>
                          <CheckCircle2 className={`w-3.5 h-3.5 ${c.passed ? "text-green-600" : "text-muted-foreground/40"}`} />
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('confirm_password')}</label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder={t('confirm_new_password')}
                    value={formData.password_confirmation}
                    onChange={e => setFormData(prev => ({ ...prev, password_confirmation: e.target.value }))}
                    className="h-12 rounded-xl"
                    autoComplete="off"
                    required
                  />
                  {formData.password_confirmation.length > 0 && formData.password !== formData.password_confirmation && (
                    <p className="text-xs text-destructive mt-1">{t('passwords_dont_match')}</p>
                  )}
                </div>

                <Button type="submit" className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 rounded-full" disabled={isLoading || !allPassed}>
                  {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('resetting')}</> : t('reset_password')}
                </Button>
              </form>

              <Link to="/login" className="block w-full mt-4 text-sm text-center text-muted-foreground hover:text-foreground transition-colors">
                {t('back_to_sign_in')}
              </Link>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3 text-center">{t('didnt_receive_link')}</p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder={t('email_or_phone')}
                    value={resendEmail}
                    onChange={e => setResendEmail(e.target.value)}
                    className="h-10 rounded-xl text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResend}
                    disabled={resendLoading || resendCooldown > 0 || !resendEmail.trim()}
                    className="shrink-0 h-10 rounded-xl"
                  >
                    {resendLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : resendCooldown > 0 ? (
                      `${resendCooldown}s`
                    ) : (
                      <><RefreshCw className="w-4 h-4 mr-1" /> {t('resend')}</>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default ResetPassword;
