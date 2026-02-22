import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Check, CheckCircle2, Loader2, User, AtSign, Lock, Phone, ChevronRight, ChevronLeft, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { api, showApiErrorsShadcn } from "@/lib/api";
import nuruLogo from "@/assets/nuru-logo.png";

// ── Welcome Screen ──────────────────────────────────────────────────────────
const WelcomeScreen = ({ firstName, onContinue }: { firstName: string; onContinue: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onContinue, 3000);
    return () => clearTimeout(t);
  }, [onContinue]);

  return (
    <motion.div
      key="step5"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
      className="text-center space-y-6 py-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 18 }}
        className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto shadow-lg"
      >
        <PartyPopper className="w-10 h-10 text-primary-foreground" />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h1 className="text-3xl font-bold text-foreground mb-2">Welcome, {firstName}! 🎉</h1>
        <p className="text-muted-foreground">Your account is verified. Taking you to your workspace…</p>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
        <div className="flex justify-center gap-1.5 mt-2">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};


const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /\d/.test(p) },
  { label: "One special character", test: (p: string) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(p) },
];

const STEP_META = [
  { icon: User, title: "What's your name?", subtitle: "Let's start with the basics" },
  { icon: AtSign, title: "Choose a username", subtitle: "This is how others will find you" },
  { icon: Lock, title: "Secure your account", subtitle: "Create a strong password" },
  { icon: Phone, title: "Verify your phone", subtitle: "We'll send you a verification code" },
];

const Register = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });

  // Username availability
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [otp, setOtp] = useState("");
  const { toast } = useToast();

  const totalSteps = 5; // 4 form steps + 1 success
  const progress = (currentStep / totalSteps) * 100;

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map(r => ({ ...r, passed: r.test(formData.password) })),
    [formData.password]
  );
  const allPasswordPassed = passwordChecks.every(c => c.passed);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Username availability check with debounce
  useEffect(() => {
    if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);
    
    const username = formData.username.trim();
    if (username.length < 3) {
      setUsernameStatus("idle");
      setUsernameSuggestions([]);
      return;
    }

    setUsernameStatus("checking");
    usernameCheckTimer.current = setTimeout(async () => {
      try {
        const res = await api.auth.checkUsername(username, formData.firstName, formData.lastName);
        if (res.success && res.data) {
          const data = res.data as any;
          if (data.available) {
            setUsernameStatus("available");
            setUsernameSuggestions([]);
          } else {
            setUsernameStatus("taken");
            setUsernameSuggestions(data.suggestions?.length ? data.suggestions : generateLocalSuggestions(username));
          }
        } else {
          setUsernameStatus("idle");
        }
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);

    return () => {
      if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);
    };
  }, [formData.username]);

  const generateLocalSuggestions = (base: string): string[] => {
    const fn = formData.firstName.toLowerCase().replace(/\s/g, "");
    const ln = formData.lastName.toLowerCase().replace(/\s/g, "");
    const rand = () => Math.floor(Math.random() * 999);
    const suggestions: string[] = [];
    if (fn && ln) {
      suggestions.push(`${fn}_${ln}`, `${fn}${ln}`, `${fn}${ln[0]}`, `${fn}_${ln}${Math.floor(Math.random() * 99)}`);
    }
    suggestions.push(`${base}${rand()}`, `${base}_tz`, `the_${base}`);
    return suggestions.slice(0, 5);
  };

  // Tanzanian phone validation
  const isValidTzPhone = (phone: string) => {
    const cleaned = phone.replace(/[\s-+]/g, "");
    return /^(0|255)\d{9}$/.test(cleaned) || /^\d{9}$/.test(cleaned);
  };

  const formatPhoneForApi = (phone: string) => {
    let cleaned = phone.replace(/[\s-+]/g, "");
    if (cleaned.startsWith("0")) cleaned = "255" + cleaned.slice(1);
    if (cleaned.length === 9) cleaned = "255" + cleaned;
    return cleaned;
  };

  const handleSignup = async (): Promise<string | null> => {
    try {
      const response = await api.auth.signup({
        first_name: formData.firstName,
        last_name: formData.lastName,
        username: formData.username,
        email: "", // Email is now optional
        phone: formatPhoneForApi(formData.phone),
        password: formData.password
      });
      
      if (response.success) {
        toast({ title: "Account created!", description: "Please verify your phone number." });
        setUserId(response.data.id);
        return response.data.id;
      } else {
        showApiErrorsShadcn(response, toast, "Signup failed");
        return null;
      }
    } catch (err) {
      toast({ title: "Error", description: "Unable to reach server. Try again later.", variant: "destructive" });
      return null;
    }
  };

  const handleVerifyOtp = async () => {
    if (!userId) return false;

    setIsSubmitting(true);
    try {
      const phoneResponse = await api.auth.verifyOtp({ 
        user_id: userId, 
        verification_type: "phone", 
        otp_code: otp 
      });
      
      if (!phoneResponse.success) {
        showApiErrorsShadcn(phoneResponse, toast, "Verification Failed");
        return false;
      }

      // Auto sign-in after successful verification
      const signinResponse = await api.auth.signin({
        credential: formatPhoneForApi(formData.phone),
        password: formData.password,
      });

      if (signinResponse.success && signinResponse.data) {
        const d = signinResponse.data as any;
        if (d.access_token) {
          localStorage.setItem("access_token", d.access_token);
          localStorage.setItem("token", d.access_token);
        }
        if (d.refresh_token) localStorage.setItem("refresh_token", d.refresh_token);
        localStorage.setItem("login", Date.now().toString());
      }

      return true;
    } catch (err) {
      toast({ title: "Error", description: "Unable to verify. Try again later.", variant: "destructive" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendOtp = async (id?: string) => {
    const uid = id || userId;
    if (!uid) return;

    setResendLoading(true);
    try {
      const response = await api.auth.requestOtp({ user_id: uid, verification_type: "phone" });
      toast({
        title: response.success ? "Code Sent" : "Failed",
        description: response.message,
        variant: response.success ? "default" : "destructive"
      });
    } catch (err) {
      toast({ title: "Error", description: "Unable to resend code.", variant: "destructive" });
    } finally {
      setResendLoading(false);
    }
  };
  
  const handleNext = async () => {
    if (currentStep === 1) {
      if (!formData.firstName.trim() || !formData.lastName.trim()) {
        toast({ title: "Required", description: "Please enter your first and last name.", variant: "destructive" });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!formData.username.trim() || formData.username.length < 3) {
        toast({ title: "Required", description: "Username must be at least 3 characters.", variant: "destructive" });
        return;
      }
      if (usernameStatus === "taken") {
        toast({ title: "Username taken", description: "Please choose a different username.", variant: "destructive" });
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!allPasswordPassed) {
        toast({ title: "Weak password", description: "Please meet all password requirements.", variant: "destructive" });
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast({ title: "Passwords don't match", description: "Please make sure your passwords match.", variant: "destructive" });
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      if (!formData.phone.trim()) {
        toast({ title: "Required", description: "Phone number is required.", variant: "destructive" });
        return;
      }
      if (!isValidTzPhone(formData.phone)) {
        toast({ title: "Invalid phone", description: "Please enter a valid Tanzanian phone number.", variant: "destructive" });
        return;
      }

      // Create account and send OTP
      setIsSubmitting(true);
      const newUserId = await handleSignup();
      setIsSubmitting(false);
      if (!newUserId) return;

      await resendOtp(newUserId);
      setCurrentStep(4.5); // Show OTP input
    }
  };

  const handleVerifyAndFinish = async () => {
    if (!otp || otp.length < 6) {
      toast({ title: "Enter code", description: "Please enter the 6-digit verification code.", variant: "destructive" });
      return;
    }
    const verified = await handleVerifyOtp();
    if (verified) {
      setCurrentStep(5);
    }
  };

  const handleBack = () => {
    if (currentStep === 4.5) setCurrentStep(4);
    else if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  useMeta({ title: "Create Account", description: "Create an account on Nuru to start planning and organizing your events." });

  const stepIcon = currentStep <= 4 ? STEP_META[Math.ceil(currentStep) - 1] : null;

  return (
    <Layout>
      <div className="min-h-screen flex items-start md:items-center justify-center px-6 pt-16 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Progress */}
          {currentStep < 5 && (
            <div className="mb-8">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Step {Math.min(Math.ceil(currentStep), 4)} of 4</span>
              </div>
              <Progress value={Math.min(progress, 80)} className="h-1" />
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Step 1 — Name */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">What's your name?</h1>
                    <p className="text-sm text-muted-foreground">Let's start with the basics</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">First name</label>
                    <Input
                      type="text"
                      placeholder="First name"
                      value={formData.firstName}
                      onChange={e => handleInputChange("firstName", e.target.value)}
                      className="h-12 rounded-xl"
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Last name</label>
                    <Input
                      type="text"
                      placeholder="Last name"
                      value={formData.lastName}
                      onChange={e => handleInputChange("lastName", e.target.value)}
                      className="h-12 rounded-xl"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2 — Username */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <AtSign className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Choose a username</h1>
                    <p className="text-sm text-muted-foreground">This is how others will find you</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Username</label>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="e.g., john_doe"
                      value={formData.username}
                      onChange={e => handleInputChange("username", e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                      className="h-12 rounded-xl pr-10"
                      autoComplete="off"
                      autoFocus
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {usernameStatus === "checking" && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                      {usernameStatus === "available" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      {usernameStatus === "taken" && <span className="text-xs text-destructive font-medium">Taken</span>}
                    </div>
                  </div>

                  {usernameStatus === "available" && formData.username.length >= 3 && (
                    <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {formData.username} is available!
                    </p>
                  )}

                  {usernameStatus === "taken" && usernameSuggestions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Try one of these:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {usernameSuggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleInputChange("username", s)}
                            className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors text-foreground"
                          >
                            @{s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3 — Password */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Secure your account</h1>
                    <p className="text-sm text-muted-foreground">Create a strong password</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={formData.password}
                        onChange={e => handleInputChange("password", e.target.value)}
                        className="h-12 pr-12 rounded-xl"
                        autoComplete="off"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {formData.password.length > 0 && !allPasswordPassed && (
                      <ul className="mt-3 space-y-1.5">
                        {passwordChecks.map(c => (
                          <li
                            key={c.label}
                            className={`flex items-center gap-2 text-xs transition-colors ${c.passed ? "text-green-600" : "text-muted-foreground"}`}
                          >
                            <CheckCircle2
                              className={`w-3.5 h-3.5 shrink-0 transition-colors ${c.passed ? "text-green-600" : "text-muted-foreground/30"}`}
                            />
                            {c.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Confirm password</label>
                    <Input
                      type="password"
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={e => handleInputChange("confirmPassword", e.target.value)}
                      className="h-12 rounded-xl"
                      autoComplete="off"
                    />
                    {formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword && (
                      <p className="text-xs text-destructive mt-1.5">Passwords do not match</p>
                    )}
                    {formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword && allPasswordPassed && (
                      <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4 — Phone */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Add your phone</h1>
                    <p className="text-sm text-muted-foreground">We'll verify it with a code</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Phone number</label>
                  <Input
                    type="tel"
                    placeholder="0712 345 678"
                    value={formData.phone}
                    onChange={e => handleInputChange("phone", e.target.value)}
                    className="h-12 rounded-xl"
                    autoComplete="off"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">Tanzanian phone numbers only</p>
                </div>
              </motion.div>
            )}

            {/* Step 4.5 — OTP Verification */}
            {currentStep === 4.5 && (
              <motion.div
                key="step4-otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Enter verification code</h1>
                    <p className="text-sm text-muted-foreground">Sent to {formData.phone}</p>
                  </div>
                </div>

                <div>
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={setOtp}
                  >
                    <InputOTPGroup className="gap-2 justify-center w-full">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <InputOTPSlot key={i} index={i} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  <button 
                    className="text-sm text-muted-foreground hover:text-foreground mt-4 w-full text-center" 
                    disabled={resendLoading} 
                    onClick={() => resendOtp()}
                  >
                    {resendLoading ? "Sending..." : "Resend code"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 5 — Success */}
            {currentStep === 5 && (
               <WelcomeScreen
                firstName={formData.firstName}
                onContinue={() => { window.location.href = "/"; }}
              />
            )}
          </AnimatePresence>

          {/* Navigation */}
          {currentStep < 5 && (
            <div className="flex gap-4 mt-8">
              {currentStep > 1 && (
                <Button 
                  variant="outline" 
                  onClick={handleBack}
                  className="flex-1 h-12 rounded-full"
                  disabled={isSubmitting}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              <Button 
                onClick={currentStep === 4.5 ? handleVerifyAndFinish : handleNext}
                className="flex-1 h-12 rounded-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {currentStep === 4.5 ? "Verify & Finish" : currentStep === 4 ? "Create Account" : "Continue"}
                {currentStep < 4 && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          )}

          {/* Login link */}
          {currentStep < 5 && (
            <p className="text-center mt-6 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-foreground hover:underline font-medium">
                Sign in
              </Link>
            </p>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default Register;
