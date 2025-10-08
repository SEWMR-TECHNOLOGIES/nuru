import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { useQueryClient } from "@tanstack/react-query";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
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
      const res = await fetch(`${BASE_URL}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: formData.credential,
          password: formData.password
        })
      });
      const data = await res.json();
      if (data.success) {
        const user = data.data.user;

        if (!user.is_email_verified) {
          toast({ title: "Email not verified", description: "Please verify your email to continue.", variant: "destructive" });
          // Store user ID temporarily
          localStorage.setItem("userId", user.id);
          navigate(`/verify-email?email=${user.email}`);
          return;
        }

        if (!user.is_phone_verified) {
          toast({ title: "Phone not verified", description: "Please verify your phone to continue.", variant: "destructive" });
          // Store user ID temporarily
          localStorage.setItem("userId", user.id);
          navigate(`/verify-phone?phone=${user.phone}`);
          return;
        }
        const token = data.data.access_token;
        localStorage.setItem("token", token);
        localStorage.setItem("login", Date.now().toString());
        qc.setQueryData(["currentUser"], user);
        toast({ title: "Welcome back!", description: data.message });
        navigate("/", { replace: true });
      } else {
        toast({ title: "Login Failed", description: data.message, variant: "destructive" });
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

    try {
      // Call forgot password endpoint if available
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({ title: "Reset link sent", description: "Check your email for password reset instructions." });
      setShowForgotPassword(false);
      setFormData(prev => ({ ...prev, forgotEmail: "" }));
    } catch (err) {
      toast({ title: "Error", description: "Unable to send reset link. Try again later.", variant: "destructive" });
    }
  };

  useMeta({ title: "Login", description: "Sign in to your Nuru account to manage events." });

  return (
    <Layout>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <Card className="shadow-xl">
            <CardHeader className="text-center space-y-4">
              <CardTitle className="text-2xl font-bold text-foreground">
                {showForgotPassword ? "Reset Password" : "Welcome Back"}
              </CardTitle>
              <p className="text-muted-foreground mt-2 text-sm">
                {showForgotPassword
                  ? "Enter your email to receive reset instructions"
                  : "Sign in to continue planning amazing events"}
              </p>
            </CardHeader>

            <CardContent className="space-y-6">
              {!showForgotPassword ? (
                <>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Email / Phone / Username</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Email, phone, or username"
                          value={formData.credential}
                          onChange={e => handleInputChange("credential", e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={formData.password}
                          onChange={e => handleInputChange("password", e.target.value)}
                          className="pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="text-right">
                      <button type="button" onClick={() => setShowForgotPassword(true)} className="text-sm text-primary hover:underline">
                        Forgot password?
                      </button>
                    </div>

                    <Button type="submit" className="w-full btn-hero-primary" disabled={isLoading}>
                      {isLoading ? "Signing In..." : "Sign In"}
                    </Button>
                  </form>

                  <div className="relative my-4">
                    <Separator />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="bg-background px-2 text-sm text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" onClick={() => toast({ title: "Google login", description: "Redirecting to Google..." })}>Google</Button>
                    <Button variant="outline" onClick={() => toast({ title: "Apple login", description: "Redirecting to Apple..." })}>Apple</Button>
                  </div>

                  <div className="text-center mt-4">
                    <p className="text-sm text-muted-foreground">
                      Don't have an account? <Link to="/register" className="text-primary hover:underline font-medium">Join Nuru</Link>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="your.email@example.com"
                          value={formData.forgotEmail}
                          onChange={e => handleInputChange("forgotEmail", e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full btn-hero-primary">Send Reset Link</Button>
                  </form>

                  <div className="text-center mt-2">
                    <button onClick={() => setShowForgotPassword(false)} className="text-sm text-primary hover:underline">
                      Back to sign in
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Login;
