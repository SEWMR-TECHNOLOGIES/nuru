import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Mail, 
  Phone, 
  User, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";

const BASE_URL = import.meta.env.VITE_API_BASE_URL; 

const Register = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

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

  // Step 1 validation
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

  // Step 2 validation
  const validateStep2 = () => {
    if (!otp.email || !otp.phone) {
      toast({ title: "Please enter both OTP codes", description: "Verification codes are required.", variant: "destructive" });
      return false;
    }
    return true;
  };

  // Signup API call
  const handleSignup = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${BASE_URL}/users/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: formData.firstName,
          last_name: formData.lastName,
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          password: formData.password
        })
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Signup successful", description: data.message });
        setUserId(data.data.id); // still set state
        return data.data.id; // return the ID
      } else {
        toast({ title: "Signup failed", description: data.message, variant: "destructive" });
        return null;
      }
    } catch (err) {
      toast({ title: "Error", description: "Unable to reach server. Try again later.", variant: "destructive" });
      return null;
    }
  };


  const handleVerifyOtp = async () => {
    if (!userId) return false;

    setIsSubmitting(true); // show loading
    try {
      // Verify email OTP
      const emailRes = await fetch(`${BASE_URL}/users/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, verification_type: "email", otp_code: otp.email })
      });
      const emailData = await emailRes.json();
      if (!emailData.success) {
        toast({ title: "Email OTP Failed", description: emailData.message, variant: "destructive" });
        return false;
      }

      // Verify phone OTP
      const phoneRes = await fetch(`${BASE_URL}/users/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, verification_type: "phone", otp_code: otp.phone })
      });
      const phoneData = await phoneRes.json();
      if (!phoneData.success) {
        toast({ title: "Phone OTP Failed", description: phoneData.message, variant: "destructive" });
        return false;
      }

      return true;
    } catch (err) {
      toast({ title: "Error", description: "Unable to verify OTPs. Try again later.", variant: "destructive" });
      return false;
    } finally {
      setIsSubmitting(false); // hide loading
    }
  };


  // Resend OTP
  const resendOtp = async (type: "email" | "phone", id?: string) => {
    const uid = id || userId;
    if (!uid) return;

    setResendLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/users/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid, verification_type: type })
      });
      const data = await res.json();
      toast({
        title: data.success ? "OTP Sent" : "Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive"
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

    // Use newUserId directly
    await Promise.all([resendOtp("email", newUserId), resendOtp("phone", newUserId)]);

    setCurrentStep(2);
  } else if (currentStep === 2) {
      if (!validateStep2()) return;

      const otpVerified = await handleVerifyOtp(); // <-- verify both OTPs
      if (!otpVerified) return;

      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const stepVariants = { hidden: { opacity: 0, x: 50 }, visible: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -50 } };

  useMeta({ title: "Join Nuru", description: "Create an account on Nuru to start planning and organizing your events." });

  return (
    <Layout>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-md">
          <Card className="shadow-xl">
            <CardHeader className="text-center space-y-4">
              <div>
                <CardTitle className="text-2xl font-bold text-foreground">Join Nuru Today</CardTitle>
                <p className="text-muted-foreground mt-2">Plan and share your moments on Nuru in minutes</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Step {currentStep} of {totalSteps}</span>
                  <span>{Math.round(progress)}% Complete</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <AnimatePresence mode="wait">
                {/* Step 1 */}
                {currentStep === 1 && (
                  <motion.div key="step1" variants={stepVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.3 }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">First Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input type="text" placeholder="First name" value={formData.firstName} onChange={e => handleInputChange("firstName", e.target.value)} className="pl-10" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Last Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input type="text" placeholder="Last name" value={formData.lastName} onChange={e => handleInputChange("lastName", e.target.value)} className="pl-10" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Username</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="text" placeholder="Choose a username" value={formData.username} onChange={e => handleInputChange("username", e.target.value)} className="pl-10" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="email" placeholder="your.email@example.com" value={formData.email} onChange={e => handleInputChange("email", e.target.value)} className="pl-10" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="tel" placeholder="+255123456789" value={formData.phone} onChange={e => handleInputChange("phone", e.target.value)} className="pl-10" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="Create a strong password" value={formData.password} onChange={e => handleInputChange("password", e.target.value)} className="pr-10" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Confirm Password</label>
                      <Input type="password" placeholder="Confirm your password" value={formData.confirmPassword} onChange={e => handleInputChange("confirmPassword", e.target.value)} />
                    </div>
                  </motion.div>
                )}

                {/* Step 2 */}
                {currentStep === 2 && (
                  <motion.div key="step2" variants={stepVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.3 }} className="space-y-6">
                    <div className="text-center">
                      <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">Verify Your Details</h3>
                      <p className="text-sm text-muted-foreground">We've sent verification codes to your email and phone number</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Email Verification Code</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="text" placeholder="Enter 6-digit code" value={otp.email} onChange={e => handleOtpChange("email", e.target.value)} className="pl-10" maxLength={6} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Phone Verification Code</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="text" placeholder="Enter 6-digit code" value={otp.phone} onChange={e => handleOtpChange("phone", e.target.value)} className="pl-10" maxLength={6} />
                      </div>
                    </div>

                    <div className="text-center flex justify-center gap-4">
                      <button className="text-sm text-primary hover:underline" disabled={resendLoading} onClick={() => resendOtp("email")}>Resend Email OTP</button>
                      <button className="text-sm text-primary hover:underline" disabled={resendLoading} onClick={() => resendOtp("phone")}>Resend Phone OTP</button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3 */}
                {currentStep === 3 && (
                  <motion.div key="step3" variants={stepVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.3 }} className="text-center space-y-6">
                    <div>
                      <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-foreground mb-2">Welcome to Nuru!</h3>
                      <p className="text-muted-foreground">Your account has been created successfully. You're ready to start planning amazing events.</p>
                    </div>
                    <div className="bg-primary/5 rounded-lg p-4">
                      <h4 className="font-semibold text-foreground mb-2">What's next?</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Explore our featured service providers</li>
                        <li>• Create your first event</li>
                        <li>• Connect with your community</li>
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Buttons */}
              <div className="flex justify-between space-x-4">
                {currentStep > 1 && currentStep < 3 && <Button variant="outline" onClick={handleBack} className="flex-1"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>}
                {currentStep < 3 ? (
                  <Button onClick={handleNext} disabled={isSubmitting} className={`${currentStep === 1 ? 'w-full' : 'flex-1'} btn-hero-primary`}>
                    {isSubmitting ? "Processing..." : currentStep === 2 ? 'Verify & Complete' : 'Continue'}
                    {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                ) : (
                  <div className="w-full">
                    <Button asChild className="w-full btn-hero-primary">
                      <Link to="/login">Start using Nuru</Link>
                    </Button>
                  </div>
                )}
              </div>

              {/* Login Link */}
              {currentStep < 3 && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Already have an account? <Link to="/login" className="text-primary hover:underline font-medium">Sign in here</Link></p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Register;
