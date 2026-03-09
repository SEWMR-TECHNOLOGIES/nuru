import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { authApi, showApiErrorsShadcn } from "@/lib/api";
import { maskPhoneDisplay } from "@/components/ui/country-phone-input";
import { MessageCircle, Phone } from "lucide-react";

const VerifyPhone = () => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [otpChannel, setOtpChannel] = useState<"sms" | "whatsapp" | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const phone = searchParams.get("phone");
  const userId = localStorage.getItem("userId");

  useEffect(() => {
    if (!userId) {
      toast({
        title: "Missing information",
        description: "We need your account info to verify. Please sign in and try again.",
        variant: "destructive"
      });
      navigate("/login");
      return;
    }
    resendOtp();
  }, []);

  const handleVerify = async () => {
    if (!otp || otp.length < 6) {
      toast({ title: "Enter code", description: "Please enter the 6-digit verification code.", variant: "destructive" });
      return;
    }
    if (!userId) {
      toast({ title: "Missing user", description: "Please sign in again.", variant: "destructive" });
      navigate("/login");
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.verifyOtp({ user_id: userId, verification_type: "phone", otp_code: otp });

      if (data.success) {
        toast({ title: "Phone verified!", description: data.message });
        localStorage.removeItem("userId");
        navigate("/login");
      } else {
        showApiErrorsShadcn(data, toast, "Verification failed");
      }
    } catch (err) {
      toast({ title: "Error", description: "Unable to verify. Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!userId) {
      toast({ title: "Missing user", description: "Please sign in again to request a code.", variant: "destructive" });
      navigate("/login");
      return;
    }

    setResendLoading(true);
    try {
      const data = await authApi.requestOtp({ user_id: userId, verification_type: "phone" });
      if (data.success) {
        const msg = (data.message || "").toLowerCase();
        if (msg.includes("whatsapp")) setOtpChannel("whatsapp");
        else setOtpChannel("sms");
      }
      toast({
        title: data.success ? "OTP Sent" : "Failed to send",
        description: data.message,
        variant: data.success ? "default" : "destructive"
      });
    } catch (err) {
      toast({ title: "Error", description: "Could not resend OTP.", variant: "destructive" });
    } finally {
      setResendLoading(false);
    }
  };

  useMeta({
    title: "Verify Your Phone | Nuru",
    description: "Enter the OTP sent to your phone to activate your Nuru account."
  });

  const displayPhone = phone ? maskPhoneDisplay(phone.replace(/[^\d]/g, "")) : "your phone";

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center mb-2">
              {otpChannel === "whatsapp" ? (
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-green-600" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Phone className="w-6 h-6 text-blue-600" />
                </div>
              )}
            </div>
            <CardTitle className="text-2xl font-bold">Verify Your Phone</CardTitle>
            <p className="text-muted-foreground text-sm">
              Enter the 6-digit code sent {otpChannel === "whatsapp" ? "via WhatsApp" : otpChannel === "sms" ? "via SMS" : ""} to <strong>{displayPhone}</strong>
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {otpChannel && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                otpChannel === "whatsapp" ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
              }`}>
                {otpChannel === "whatsapp" ? <MessageCircle className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                {otpChannel === "whatsapp"
                  ? "Check your WhatsApp for the verification code"
                  : "Check your SMS messages for the verification code"
                }
              </div>
            )}

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => setOtp(value)}
              >
                <InputOTPGroup className="gap-2 justify-center">
                  <InputOTPSlot index={0} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                  <InputOTPSlot index={1} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                  <InputOTPSlot index={2} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                  <InputOTPSlot index={3} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                  <InputOTPSlot index={4} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                  <InputOTPSlot index={5} className="w-12 h-14 text-xl font-semibold rounded-xl border-2" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="flex justify-between items-center">
              <Button onClick={resendOtp} disabled={resendLoading} variant="outline">
                {resendLoading ? "Sending..." : "Resend OTP"}
              </Button>
              <Button onClick={handleVerify} disabled={loading || otp.length < 6}>
                {loading ? "Verifying..." : "Verify"}
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <button
                className="underline"
                onClick={() => {
                  localStorage.removeItem("userId");
                  navigate("/login");
                }}
              >
                Back to sign in
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default VerifyPhone;
