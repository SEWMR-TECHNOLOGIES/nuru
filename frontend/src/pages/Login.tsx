import { useState } from "react";
import SuspensionModal from "@/components/SuspensionModal";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { useQueryClient } from "@tanstack/react-query";
import { api, showApiErrorsShadcn } from "@/lib/api";
import nuruLogo from "@/assets/nuru-logo.png";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [suspensionInfo, setSuspensionInfo] = useState<{ open: boolean; reason?: string | null }>({ open: false });
  const [formData, setFormData] = useState({
    credential: "",
    password: "",
    forgotEmail: ""
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
        // Check if suspended
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

  const handleForgotPassword = async (e: React.FormEvent) => {
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
        setShowForgotPassword(false);
        setFormData(prev => ({ ...prev, forgotEmail: "" }));
      } else {
        showApiErrorsShadcn(response, toast, "Reset Failed");
      }
    } catch (err) {
      toast({ title: "Error", description: "Unable to send reset link. Try again later.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useMeta({ title: "Sign In", description: "Sign in to your Nuru account to manage events." });

  // Show premium full-screen suspension modal instead of the login form
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
            {showForgotPassword ? "Reset password" : "Welcome back"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {showForgotPassword
              ? "Enter your email to receive reset instructions"
              : "Sign in to continue managing your events"}
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
                    onClick={() => setShowForgotPassword(true)} 
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
              <form onSubmit={handleForgotPassword} className="space-y-5">
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
                >
                  Send reset link
                </Button>
              </form>

              <button 
                onClick={() => setShowForgotPassword(false)} 
                className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </button>
            </>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default Login;
