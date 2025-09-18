import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const VerifyPhone = () => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
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

    // Automatically request OTP on page load
    resendOtp();
    }, []);


  const handleVerify = async () => {
    if (!otp) {
      toast({ title: "Enter code", description: "Please enter the verification code.", variant: "destructive" });
      return;
    }
    if (!userId) {
      toast({ title: "Missing user", description: "Please sign in again.", variant: "destructive" });
      navigate("/login");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/users/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, verification_type: "phone", otp_code: otp })
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: "Phone verified!", description: data.message });
        localStorage.removeItem("userId");
        navigate("/login");
      } else {
        toast({ title: "Verification failed", description: data.message, variant: "destructive" });
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
      const res = await fetch(`${BASE_URL}/users/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, verification_type: "phone" })
      });
      const data = await res.json();
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

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-xl">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold">Verify Your Phone</CardTitle>
            <p className="text-muted-foreground text-sm">
              Enter the 6-digit code sent to <strong>{phone ?? "your phone"}</strong>
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="pl-10"
                maxLength={6}
              />
            </div>

            <div className="flex justify-between items-center">
              <Button onClick={resendOtp} disabled={resendLoading} variant="outline">
                {resendLoading ? "Sending..." : "Resend OTP"}
              </Button>
              <Button onClick={handleVerify} disabled={loading}>
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
