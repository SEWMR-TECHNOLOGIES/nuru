import { useState } from "react";
import SuspensionModal from "@/components/SuspensionModal";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { useQueryClient } from "@tanstack/react-query";
import { api, showApiErrorsShadcn } from "@/lib/api";
import nuruLogo from "@/assets/nuru-logo.png";

type ForgotStep = "choose" | "email" | "phone" | "otp";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>("choose");
  const [suspensionInfo, setSuspensionInfo] = useState<{ open: boolean; reason?: string | null }>({ open: false });
  const [formData, setFormData] = useState({
    credential: "",
    password: "",
    forgotEmail: "",
    forgotPhone: "",
    otp: "",
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForgotState = () => {
    setShowForgotPassword(false);
    setForgotStep("choose");
    setFormData(prev => ({ ...prev, forgotEmail: "", forgotPhone: "", otp: "" }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.credential || !formData.password) {
      toast({ title: "Missing fields", description: "Credential and password are required.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.auth.signin({
        credential: formData.credential,
        password: formData.password
      });
      
      if (response.success) {
        const user = response.data.user;

        if (!user.is_phone_verified) {
          toast({ title: "Phone not verified", description: "Please verify your phone to continue.", variant: "destructive" });
          localStorage.setItem("userId", user.id);
          navigate(`/verify-phone?phone=${user.phone}`);
          return;
        }
        const token = response.data.access_token;

        localStorage.setItem("token", token);
        localStorage.setItem("login", Date.now().toString());

        qc.setQueryData(["currentUser"], user);
        toast({ title: "Welcome back!", description: response.message });
        navigate("/", { replace: true });
      } else {
        const data = (response as any).data;
        if (data?.suspended) {
          setSuspensionInfo({ open: true, reason: data.suspension_reason });
        } else {
          showApiErrorsShadcn(response, toast, "Login Failed");
        }
      }
    } catch (err) {
      toast({ title: "Error", description: "Unable to reach server. Try again later.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Email reset ──
  const handleForgotEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.forgotEmail) {
      toast({ title: "Enter email", description: "We need your email to send reset instructions.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.auth.forgotPassword(formData.forgotEmail);
      if (response.success) {
        toast({ title: "Reset link sent", description: response.message || "Check your email for password reset instructions." });
        resetForgotState();
      } else {
        showApiErrorsShadcn(response, toast, "Reset Failed");
      }
    } catch (err) {
      toast({ title: "Error", description: "Unable to send reset link. Try again later.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Phone reset – send OTP ──
  const handleForgotPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.forgotPhone) {
      toast({ title: "Enter phone", description: "We need your phone number to send a reset code.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.auth.forgotPasswordPhone(formData.forgotPhone);
      if (response.success) {
        toast({ title: "Code sent", description: response.message || "Check your phone for the reset code." });
        setForgotStep("otp");
      } else {
        showApiErrorsShadcn(response, toast, "Reset Failed");
      }
    } catch (err) {
      toast({ title: "Error", description: "Unable to send reset code. Try again later.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Verify OTP ──
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.otp.length < 6) {
      toast({ title: "Enter code", description: "Please enter the 6-digit code sent to your phone.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.auth.verifyResetOtp(formData.forgotPhone, formData.otp);
      if (response.success && response.data?.reset_token) {
        toast({ title: "Verified!", description: "Set your new password." });
        navigate(`/reset-password?token=${response.data.reset_token}`);
        resetForgotState();
      } else {
        showApiErrorsShadcn(response, toast, "Verification Failed");
      }
    } catch (err) {
      toast({ title: "Error", description: "Unable to verify code. Try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Resend OTP ──
  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      const response = await api.auth.forgotPasswordPhone(formData.forgotPhone);
      if (response.success) {
        toast({ title: "Code resent", description: "A new code has been sent to your phone." });
      } else {
        showApiErrorsShadcn(response, toast, "Resend Failed");
      }
    } catch {
      toast({ title: "Error", description: "Unable to resend code.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useMeta({ title: "Sign In", description: "Sign in to your Nuru account to manage events." });

  if (suspensionInfo.open) {
    return (
      <SuspensionModal
        open={true}
        reason={suspensionInfo.reason}
        variant="fullscreen"
        onClose={() => setSuspensionInfo({ open: false })}
      />
    );
  }

  // ── Forgot password sub-views ──
  const renderForgotPassword = () => {
    if (forgotStep === "choose") {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-2">How would you like to reset your password?</p>
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl justify-start gap-3 text-foreground"
            onClick={() => setForgotStep("email")}
          >
            <Mail className="w-5 h-5" />
            Reset via email
          </Button>
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl justify-start gap-3 text-foreground"
            onClick={() => setForgotStep("phone")}
          >
            <Phone className="w-5 h-5" />
            Reset via phone (SMS)
          </Button>
        </div>
      );
    }

    if (forgotStep === "email") {
      return (
        <form onSubmit={handleForgotEmail} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email address</label>
            <Input
              type="email"
              placeholder="your.email@example.com"
              value={formData.forgotEmail}
              onChange={e => handleInputChange("forgotEmail", e.target.value)}
              className="h-12 rounded-xl"
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 rounded-full"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      );
    }

    if (forgotStep === "phone") {
      return (
        <form onSubmit={handleForgotPhone} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Phone number</label>
            <Input
              type="tel"
              placeholder="0712 345 678"
              value={formData.forgotPhone}
              onChange={e => handleInputChange("forgotPhone", e.target.value)}
              className="h-12 rounded-xl"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">We'll send a 6-digit code to this number</p>
          </div>
          <Button
            type="submit"
            className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 rounded-full"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send reset code"}
          </Button>
        </form>
      );
    }

    // OTP step
    return (
      <form onSubmit={handleVerifyOtp} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Enter verification code</label>
          <p className="text-xs text-muted-foreground mb-4">
            A 6-digit code was sent to your phone number
          </p>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={formData.otp}
              onChange={value => handleInputChange("otp", value)}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>
        <Button
          type="submit"
          className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 rounded-full"
          disabled={isLoading || formData.otp.length < 6}
        >
          {isLoading ? "Verifying..." : "Verify & continue"}
        </Button>
        <button
          type="button"
          onClick={handleResendOtp}
          disabled={isLoading}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Didn't receive a code? Resend
        </button>
      </form>
    );
  };

  const forgotTitle =
    forgotStep === "choose" ? "Reset password" :
    forgotStep === "email" ? "Reset via email" :
    forgotStep === "phone" ? "Reset via phone" :
    "Enter verification code";

  const forgotDescription =
    forgotStep === "choose" ? "Choose how to recover your account" :
    forgotStep === "email" ? "Enter your email to receive reset instructions" :
    forgotStep === "phone" ? "Enter your phone number to receive a reset code" :
    "We sent a 6-digit code to your phone";

  return (
    <Layout>
      <div className="min-h-screen flex items-start md:items-center justify-center px-6 pt-16 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {showForgotPassword ? forgotTitle : "Welcome back"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {showForgotPassword ? forgotDescription : "Sign in to continue managing your events"}
          </p>

          {!showForgotPassword ? (
            <>
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email, phone, or username
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter your credential"
                    value={formData.credential}
                    onChange={e => handleInputChange("credential", e.target.value)}
                    className="h-12 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={e => handleInputChange("password", e.target.value)}
                      className="h-12 pr-12 rounded-xl"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <button 
                    type="button" 
                    onClick={() => { setShowForgotPassword(true); setForgotStep("choose"); }} 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 rounded-full" 
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              <p className="text-center mt-8 text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/register" className="text-foreground hover:underline font-medium">
                  Create one
                </Link>
              </p>
            </>
          ) : (
            <>
              {renderForgotPassword()}

              <button 
                onClick={() => {
                  if (forgotStep === "otp") {
                    setForgotStep("phone");
                  } else if (forgotStep !== "choose") {
                    setForgotStep("choose");
                  } else {
                    resetForgotState();
                  }
                }} 
                className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {forgotStep === "choose" ? "Back to sign in" : "Back"}
              </button>
            </>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default Login;
