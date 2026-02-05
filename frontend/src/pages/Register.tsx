import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { api } from "@/lib/api";
import nuruLogo from "@/assets/nuru-logo.png";

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
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });

  const [otp, setOtp] = useState({ email: "", phone: "" });
  const { toast } = useToast();

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleOtpChange = (field: string, value: string) => {
    setOtp(prev => ({ ...prev, [field]: value }));
  };

  const validateStep1 = () => {
    const { firstName, lastName, username, email, phone, password, confirmPassword } = formData;
    if (!firstName || !lastName || !username || !email || !phone || !password || !confirmPassword) {
      toast({ title: "Please fill in all fields", description: "All fields are required.", variant: "destructive" });
      return false;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure your passwords match.", variant: "destructive" });
      return false;
    }
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters long.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!otp.email || !otp.phone) {
      toast({ title: "Please enter both OTP codes", description: "Verification codes are required.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSignup = async (): Promise<string | null> => {
    try {
      const response = await api.auth.signup({
        first_name: formData.firstName,
        last_name: formData.lastName,
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      });
      
      if (response.success) {
        toast({ title: "Signup successful", description: response.message });
        setUserId(response.data.id);
        return response.data.id;
      } else {
        toast({ title: "Signup failed", description: response.message, variant: "destructive" });
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
      const emailResponse = await api.auth.verifyOtp({ 
        user_id: userId, 
        verification_type: "email", 
        otp_code: otp.email 
      });
      
      if (!emailResponse.success) {
        toast({ title: "Email OTP Failed", description: emailResponse.message, variant: "destructive" });
        return false;
      }

      const phoneResponse = await api.auth.verifyOtp({ 
        user_id: userId, 
        verification_type: "phone", 
        otp_code: otp.phone 
      });
      
      if (!phoneResponse.success) {
        toast({ title: "Phone OTP Failed", description: phoneResponse.message, variant: "destructive" });
        return false;
      }

      return true;
    } catch (err) {
      toast({ title: "Error", description: "Unable to verify OTPs. Try again later.", variant: "destructive" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendOtp = async (type: "email" | "phone", id?: string) => {
    const uid = id || userId;
    if (!uid) return;

    setResendLoading(true);
    try {
      const response = await api.auth.requestOtp({ user_id: uid, verification_type: type });
      toast({
        title: response.success ? "OTP Sent" : "Failed",
        description: response.message,
        variant: response.success ? "default" : "destructive"
      });
    } catch (err) {
      toast({ title: "Error", description: "Unable to resend OTP. Try again later.", variant: "destructive" });
    } finally {
      setResendLoading(false);
    }
  };
  
  const handleNext = async () => {
    if (currentStep === 1 && !validateStep1()) return;

    if (currentStep === 1) {
      setIsSubmitting(true);
      const newUserId = await handleSignup();
      setIsSubmitting(false);
      if (!newUserId) return;

      await Promise.all([resendOtp("email", newUserId), resendOtp("phone", newUserId)]);
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!validateStep2()) return;
      const otpVerified = await handleVerifyOtp();
      if (!otpVerified) return;
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  useMeta({ title: "Create Account", description: "Create an account on Nuru to start planning and organizing your events." });

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Progress */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Step {currentStep} of {totalSteps}</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1 */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">Create your account</h1>
                  <p className="text-muted-foreground">Fill in your details to get started</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">First name</label>
                    <Input
                      type="text"
                      placeholder="First name"
                      value={formData.firstName}
                      onChange={e => handleInputChange("firstName", e.target.value)}
                      className="h-12 rounded-xl"
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
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Username</label>
                  <Input
                    type="text"
                    placeholder="Choose a username"
                    value={formData.username}
                    onChange={e => handleInputChange("username", e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                  <Input
                    type="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={e => handleInputChange("email", e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Phone</label>
                  <Input
                    type="tel"
                    placeholder="+255123456789"
                    value={formData.phone}
                    onChange={e => handleInputChange("phone", e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={e => handleInputChange("password", e.target.value)}
                      className="h-12 pr-12 rounded-xl"
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

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Confirm password</label>
                  <Input
                    type="password"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={e => handleInputChange("confirmPassword", e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 2 */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">Verify your details</h1>
                  <p className="text-muted-foreground">We've sent verification codes to your email and phone</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">Email verification code</label>
                  <InputOTP
                    maxLength={6}
                    value={otp.email}
                    onChange={(value) => handleOtpChange("email", value)}
                  >
                    <InputOTPGroup className="gap-2 justify-center w-full">
                      <InputOTPSlot index={0} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                      <InputOTPSlot index={1} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                      <InputOTPSlot index={2} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                      <InputOTPSlot index={3} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                      <InputOTPSlot index={4} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                      <InputOTPSlot index={5} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                    </InputOTPGroup>
                  </InputOTP>
                  <button 
                    className="text-sm text-muted-foreground hover:text-foreground mt-3 w-full text-center" 
                    disabled={resendLoading} 
                    onClick={() => resendOtp("email")}
                  >
                    Resend email code
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">Phone verification code</label>
                  <InputOTP
                    maxLength={6}
                    value={otp.phone}
                    onChange={(value) => handleOtpChange("phone", value)}
                  >
                    <InputOTPGroup className="gap-2 justify-center w-full">
                      <InputOTPSlot index={0} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                      <InputOTPSlot index={1} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                      <InputOTPSlot index={2} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                      <InputOTPSlot index={3} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                      <InputOTPSlot index={4} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                      <InputOTPSlot index={5} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                    </InputOTPGroup>
                  </InputOTP>
                  <button 
                    className="text-sm text-muted-foreground hover:text-foreground mt-3 w-full text-center" 
                    disabled={resendLoading} 
                    onClick={() => resendOtp("phone")}
                  >
                    Resend phone code
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3 */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center space-y-6"
              >
                <div className="w-16 h-16 bg-foreground rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-background" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">You're all set!</h1>
                  <p className="text-muted-foreground">Your account has been created successfully.</p>
                </div>
                <Button asChild className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 rounded-full">
                  <Link to="/login">Sign in to your account</Link>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          {currentStep < 3 && (
            <div className="flex gap-4 mt-8">
              {currentStep > 1 && (
                <Button 
                  variant="outline" 
                  onClick={handleBack} 
                  className="flex-1 h-12 rounded-full"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              <Button 
                onClick={handleNext} 
                disabled={isSubmitting} 
                className={`${currentStep === 1 ? 'w-full' : 'flex-1'} h-12 bg-foreground text-background hover:bg-foreground/90 rounded-full`}
              >
                {isSubmitting ? "Processing..." : currentStep === 2 ? "Verify" : "Continue"}
                {!isSubmitting && <ChevronRight className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          )}

          {currentStep < 3 && (
            <p className="text-center mt-8 text-sm text-muted-foreground">
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
