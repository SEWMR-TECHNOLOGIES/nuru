import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { api, showApiErrorsShadcn } from "@/lib/api";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const { toast } = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    password_confirmation: "",
  });

  useMeta({ title: "Reset Password", description: "Set a new password for your Nuru account." });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.password || !formData.password_confirmation) {
      toast({ title: "Missing fields", description: "Both password fields are required.", variant: "destructive" });
      return;
    }
    if (formData.password !== formData.password_confirmation) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: "Too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (!token) {
      toast({ title: "Invalid link", description: "Reset token is missing. Please request a new reset link.", variant: "destructive" });
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
      toast({ title: "Error", description: "Unable to reset password. Try again.", variant: "destructive" });
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
              <h1 className="text-2xl font-bold text-foreground">Password Reset Successfully</h1>
              <p className="text-muted-foreground">You can now sign in with your new password.</p>
              <Button onClick={() => navigate("/login")} className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 rounded-full">
                Go to Sign In
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-foreground mb-2">Set new password</h1>
              <p className="text-muted-foreground mb-8">Enter your new password below</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">New Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={formData.password}
                      onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="h-12 pr-12 rounded-xl"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Confirm Password</label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={formData.password_confirmation}
                    onChange={e => setFormData(prev => ({ ...prev, password_confirmation: e.target.value }))}
                    className="h-12 rounded-xl"
                    required
                  />
                </div>

                <Button type="submit" className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 rounded-full" disabled={isLoading}>
                  {isLoading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>

              <Link to="/login" className="block w-full mt-4 text-sm text-center text-muted-foreground hover:text-foreground transition-colors">
                Back to sign in
              </Link>
            </>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default ResetPassword;
