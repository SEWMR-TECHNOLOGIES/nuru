import { useEffect, useState, useRef, useCallback } from "react";
import { 
  CheckCircle, Edit, Loader2, 
  Mail, Phone, User as UserIcon, Shield, ShieldCheck, ShieldAlert,
  Upload, FileText, AlertCircle, Clock, ImagePlus, Users, X, SendHorizonal
} from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { authApi } from "@/lib/api/auth";
import { VerifiedUserBadge } from '@/components/ui/verified-badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { NuruOfficialBadge, NuruOfficialCoverOverlay, NuruOfficialAvatarRing } from '@/components/ui/nuru-official-badge';
import SvgIcon from '@/components/ui/svg-icon';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';
import NuruLogo from '@/assets/nuru-logo.png';
import LocationIcon from '@/assets/icons/location-icon.svg';
import CameraIcon from '@/assets/icons/camera-icon.svg';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PillTabsNav } from "@/components/ui/pill-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNavigate } from "react-router-dom";
import { useWorkspaceMeta } from "@/hooks/useWorkspaceMeta";
import { profileApi } from "@/lib/api/profile";
import { showCaughtError } from "@/lib/api";
import { toast } from "sonner";
import { formatDateMedium } from "@/utils/formatDate";
import { useQueryClient } from "@tanstack/react-query";
import AvatarCropDialog from "@/components/AvatarCropDialog";

const UserProfile = () => {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Followers/Following dialog state
  const [socialDialog, setSocialDialog] = useState<{ open: boolean; type: "followers" | "following" }>({ open: false, type: "followers" });
  const [socialList, setSocialList] = useState<any[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);

  const openSocialDialog = useCallback(async (type: "followers" | "following") => {
    if (!currentUser?.id) return;
    setSocialDialog({ open: true, type });
    setSocialLoading(true);
    setSocialList([]);
    try {
      const res = type === "followers"
        ? await profileApi.getFollowers(currentUser.id, { limit: 50 })
        : await profileApi.getFollowing(currentUser.id, { limit: 50 });
      if (res.success && res.data) {
        const data = res.data as any;
        setSocialList(data.followers || data.following || []);
      }
    } catch { /* silently fail */ } finally {
      setSocialLoading(false);
    }
  }, [currentUser?.id]);

  useWorkspaceMeta({
    title: 'Profile',
    description: 'View and manage your Nuru profile and account settings.'
  });

  const [isEditing, setIsEditing] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState("verification");
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [verificationStep, setVerificationStep] = useState<"idle" | "form" | "submitted" | "verified" | "rejected">("idle");
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [verifyFiles, setVerifyFiles] = useState<{ id_front?: File; id_back?: File; selfie?: File }>({});

  // Avatar crop state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string>("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [editData, setEditData] = useState({
    first_name: "",
    last_name: "",
    bio: "",
    phone: "",
    location: "",
    email: "",
  });
  // Email OTP verification state
  const [emailOtpMode, setEmailOtpMode] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);
  const [emailResendLoading, setEmailResendLoading] = useState(false);

  // Fetch verification status from API on mount
  useEffect(() => {
    if (currentUser) {
      setEditData({
        first_name: currentUser.first_name || "",
        last_name: currentUser.last_name || "",
        bio: currentUser.bio || "",
        phone: currentUser.phone || "",
        location: currentUser.location || "",
        email: currentUser.email || "",
      });

      if (currentUser.is_identity_verified) {
        setVerificationStep("verified");
        setVerificationLoading(false);
      } else {
        // Fetch actual verification status from API
        setVerificationLoading(true);
        profileApi.getVerificationStatus().then(res => {
          if (res.success && res.data) {
            const status = res.data.status;
            if (status === "verified") setVerificationStep("verified");
            else if (status === "pending") setVerificationStep("submitted");
            else if (status === "rejected") {
              setVerificationStep("rejected");
              setRejectionReason(res.data.rejection_reason || null);
            }
          }
        }).catch(() => {}).finally(() => {
          setVerificationLoading(false);
        });
      }
    }
  }, [currentUser]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("first_name", editData.first_name);
      formData.append("last_name", editData.last_name);
      formData.append("bio", editData.bio);
      formData.append("phone", editData.phone);
      formData.append("location", editData.location);

      // Handle email update separately if changed
      const emailChanged = editData.email !== (currentUser?.email || "");
      if (emailChanged && editData.email) {
        try {
          await profileApi.updateEmail({ new_email: editData.email, password: "" });
          toast.info("A verification code has been sent to " + editData.email);
          setEmailOtpMode(true);
          setEmailOtp("");
          // Auto-switch to Contact Info tab so user sees the OTP input
          setActiveProfileTab("contact");
        } catch (emailErr: any) {
          const msg = emailErr?.response?.data?.message || emailErr?.message || "";
          if (!msg.toLowerCase().includes("password")) {
            toast.error(msg || "Failed to update email");
          }
        }
      }

      await profileApi.update(formData);
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch (err: any) {
      showCaughtError(err, "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleCroppedAvatar = async (blob: Blob) => {
    setAvatarSaving(true);
    try {
      const formData = new FormData();
      formData.append("avatar", blob, "avatar.jpg");
      const res = await profileApi.update(formData);
      if (res.success) {
        await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
        toast.success("Avatar updated!");
        setCropDialogOpen(false);
      } else {
        toast.error(res.message || "Failed to update avatar");
      }
    } catch (err: any) {
      showCaughtError(err, "Failed to upload avatar");
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleStartVerification = () => setVerificationStep("form");

  const handleSubmitVerification = async () => {
    if (!verifyFiles.id_front) {
      toast.error("Please upload the front of your ID");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      if (verifyFiles.id_front) formData.append("id_front", verifyFiles.id_front);
      if (verifyFiles.id_back) formData.append("id_back", verifyFiles.id_back);
      if (verifyFiles.selfie) formData.append("selfie", verifyFiles.selfie);
      const res = await profileApi.submitVerification(formData);
      if (res.success) {
        setVerificationStep("submitted");
        setVerifyFiles({});
        toast.success("Verification documents submitted for review");
      } else {
        toast.error(res.message || "Failed to submit verification");
      }
    } catch (err: any) {
      showCaughtError(err, "Failed to submit verification");
    } finally {
      setSaving(false);
    }
  };

  if (userLoading) {
    return (
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <Skeleton className="h-48 w-full" />
          <CardContent className="pt-0">
            <div className="flex gap-6 -mt-16 relative z-10">
              <Skeleton className="w-32 h-32 rounded-full" />
              <div className="flex-1 mt-16 space-y-3">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-full max-w-md" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please log in to view your profile.</p>
      </div>
    );
  }

  const fullName = `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim() || "User";
  const initials = `${(currentUser.first_name || "U").charAt(0)}${(currentUser.last_name || "").charAt(0)}`.toUpperCase();
  const joinDate = currentUser.created_at ? formatDateMedium(currentUser.created_at) : "N/A";
  const isVerified = currentUser.is_identity_verified || verificationStep === "verified";
  const isNuruOfficial = currentUser.username?.toLowerCase() === 'nuru';
  return (
    <div className="space-y-6">
      {/* Hidden avatar file input */}
      <input
        ref={avatarInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleAvatarFileSelect}
      />

      {/* Avatar Crop Dialog */}
      <AvatarCropDialog
        open={cropDialogOpen}
        onClose={() => setCropDialogOpen(false)}
        imageSrc={cropImageSrc}
        onCropComplete={handleCroppedAvatar}
        saving={avatarSaving}
      />

      {/* Profile Header - Premium Cover */}
      <Card className="overflow-hidden border-0 shadow-xl">
        <div className={`relative ${isNuruOfficial ? 'h-64 md:h-72' : 'h-56 md:h-64'}`}>
          {isNuruOfficial ? (
            <NuruOfficialCoverOverlay />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
              <div className="absolute inset-0 opacity-[0.06]" style={{
                backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.3) 1px, transparent 1px), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.2) 1px, transparent 1px)`,
                backgroundSize: '30px 30px, 20px 20px',
              }} />
              <div className="absolute -top-20 -right-20 w-72 h-72 bg-primary-foreground/8 rounded-full blur-3xl" />
              <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-accent/20 rounded-full blur-3xl" />
              <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-primary-foreground/5 rounded-full blur-2xl" />
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent" />
            </>
          )}

          {!isEditing && (
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-4 right-4 gap-2 shadow-lg backdrop-blur-md bg-background/70 hover:bg-background/90 border border-border/50"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </Button>
          )}

          {/* Bottom gradient for text readability */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent" />
        </div>

        <CardContent className="pt-0 pb-6">
          <div className="flex flex-col md:flex-row gap-6 -mt-20 relative z-10 px-1">
            {/* Avatar with camera button */}
            <div className="relative flex-shrink-0 self-start group rounded-full overflow-hidden">
              {isNuruOfficial ? (
                <NuruOfficialAvatarRing>
                  <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
                    <AvatarImage src={currentUser.avatar || undefined} alt={fullName} />
                    <AvatarFallback className="text-2xl font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                </NuruOfficialAvatarRing>
              ) : (
                <div className="p-1 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 shadow-2xl">
                  <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
                    <AvatarImage src={currentUser.avatar || undefined} alt={fullName} />
                    <AvatarFallback className="text-2xl font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                </div>
              )}

              {/* Camera overlay */}
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Change avatar"
              >
                <SvgIcon src={CameraIcon} alt="Camera" className="w-6 h-6" forceWhite />
              </button>

            </div>

            <div className="flex-1 mt-14 md:mt-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">First Name</label>
                      <Input value={editData.first_name} onChange={(e) => setEditData(prev => ({ ...prev, first_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Last Name</label>
                      <Input value={editData.last_name} onChange={(e) => setEditData(prev => ({ ...prev, last_name: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Bio</label>
                    <Textarea value={editData.bio} onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))} rows={3} placeholder="Tell us about yourself..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                      <Input type="email" value={editData.email} onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))} placeholder="your@email.com" />
                      {!currentUser.email && (
                        <p className="text-[11px] text-muted-foreground mt-1">Optional — add to receive notifications</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
                      <Input value={editData.phone} onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
                    <Input value={editData.location} onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))} placeholder="City, Country" />
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                      {fullName}
                      {isVerified && <VerifiedUserBadge size="md" />}
                      {['mpinzile', 'mangowi'].includes(currentUser.username?.toLowerCase()) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <img src={NuruLogo} alt="Nuru Creator" className="w-7 h-7 object-contain cursor-pointer" />
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="flex items-center gap-2 bg-card border-primary/20 px-3 py-2 rounded-lg shadow-lg">
                            <img src={NuruLogo} alt="" className="w-4 h-4" />
                            <span className="text-xs font-semibold text-foreground">Nuru Creator</span>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </h1>
                    {isNuruOfficial && <span className="hidden md:inline-flex"><NuruOfficialBadge size="md" /></span>}
                  </div>
                  {currentUser.username && (
                    <p className="text-muted-foreground text-sm mb-2">@{currentUser.username}</p>
                  )}
                  {currentUser.bio && (
                    <p className="text-muted-foreground mb-4 max-w-lg">{currentUser.bio}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                    {currentUser.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-4 h-4" /> {currentUser.email}
                      </span>
                    )}
                    {currentUser.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-4 h-4" /> {currentUser.phone}
                      </span>
                    )}
                    {currentUser.location && (
                      <span className="flex items-center gap-1.5">
                        <SvgIcon src={LocationIcon} alt="Location" className="w-4 h-4" /> {currentUser.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <SvgIcon src={CalendarIcon} alt="Calendar" className="w-4 h-4" /> Joined {joinDate}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Events", value: currentUser.event_count ?? 0 },
          { label: "Services", value: currentUser.service_count ?? 0 },
          { label: "Followers", value: currentUser.follower_count ?? 0, action: () => openSocialDialog("followers") },
          { label: "Following", value: currentUser.following_count ?? 0, action: () => openSocialDialog("following") },
        ].map(stat => (
          <Card
            key={stat.label}
            className={`border-0 shadow-sm hover:shadow-md transition-shadow ${stat.action ? "cursor-pointer" : ""}`}
            onClick={stat.action}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Followers / Following Dialog */}
      <Dialog open={socialDialog.open} onOpenChange={(open) => setSocialDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="p-5 pb-0">
            <DialogTitle className="text-lg font-semibold capitalize">{socialDialog.type}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] px-5 pb-5">
            {socialLoading ? (
              <div className="space-y-3 py-2">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-11 h-11 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : socialList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {socialDialog.type === "followers" ? "No followers yet" : "Not following anyone yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-1 py-2">
                {socialList.map((user: any) => {
                  const name = user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || "User";
                  const initials = `${(user.first_name || name || "U").charAt(0)}${(user.last_name || "").charAt(0)}`.toUpperCase();
                  return (
                    <button
                      key={user.id}
                      className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-muted/60 transition-colors text-left"
                      onClick={() => {
                        setSocialDialog(prev => ({ ...prev, open: false }));
                        navigate(user.username ? `/u/${user.username}` : `/u/${user.id}`);
                      }}
                    >
                      <Avatar className="w-11 h-11 border border-border">
                        <AvatarImage src={user.avatar || undefined} alt={name} />
                        <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm truncate">{name}</span>
                          {user.is_verified && <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                        </div>
                        {user.username && (
                          <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                        )}
                      </div>
                      {user.is_followed_by && socialDialog.type === "followers" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 shrink-0">Follows you</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs value={activeProfileTab} onValueChange={setActiveProfileTab} className="space-y-4">
        <PillTabsNav
          activeTab={activeProfileTab}
          onTabChange={setActiveProfileTab}
          tabs={[
            { value: 'verification', label: 'Identity Verification', icon: <Shield className="w-4 h-4" /> },
            { value: 'contact', label: 'Contact Info', icon: <UserIcon className="w-4 h-4" /> },
          ]}
        />

        <TabsContent value="verification">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Identity Verification</CardTitle>
              <p className="text-sm text-muted-foreground">
                Verify your identity to build trust, protect your account, and unlock full platform features
              </p>
            </CardHeader>
            <CardContent>
              {verificationLoading ? (
                <div className="flex items-center gap-4 p-5 bg-muted/30 rounded-xl">
                  <Skeleton className="w-14 h-14 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
              ) : verificationStep === "verified" || isVerified ? (
                <div className="flex items-center gap-4 p-5 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-800/30">
                  <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-7 h-7 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-800 dark:text-green-400">Identity Verified</h4>
                    <p className="text-sm text-green-700/70 dark:text-green-500/70">
                      Your identity has been verified. You have full access to all platform features.
                    </p>
                  </div>
                </div>
              ) : verificationStep === "submitted" ? (
                <div className="flex items-center gap-4 p-5 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800/30">
                  <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="w-7 h-7 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-amber-800 dark:text-amber-400">Under Review</h4>
                    <p className="text-sm text-amber-700/70 dark:text-amber-500/70">
                      Your documents have been submitted and are being reviewed. This usually takes 1-3 business days.
                    </p>
                  </div>
                </div>
              ) : verificationStep === "rejected" ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-5 bg-destructive/5 rounded-xl border border-destructive/20">
                    <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <ShieldAlert className="w-7 h-7 text-destructive" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-destructive">Verification Rejected</h4>
                      <p className="text-sm text-muted-foreground">
                        {rejectionReason || "Your verification was rejected. Please re-submit with clearer documents."}
                      </p>
                    </div>
                  </div>
                  <Button onClick={handleStartVerification} size="sm">
                    <Shield className="w-4 h-4 mr-2" />
                    Re-submit Documents
                  </Button>
                </div>
              ) : verificationStep === "form" ? (
                <div className="space-y-5">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">Quick Identity Check</p>
                        <p>Upload a clear photo of the front of your national ID (NIDA) or passport. Back side and selfie are optional but speed up the process.</p>
                      </div>
                    </div>
                  </div>

                  {[
                    { key: "id_front" as const, label: "ID Front", desc: "Front side of your national ID or passport", required: true },
                    { key: "id_back" as const, label: "ID Back (optional)", desc: "Back side of your national ID", required: false },
                    { key: "selfie" as const, label: "Selfie (optional)", desc: "A clear photo of your face", required: false },
                  ].map(slot => (
                    <div key={slot.key} className="border border-dashed border-border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                            {verifyFiles[slot.key] ? <FileText className="w-5 h-5 text-green-600" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{slot.label} {slot.required && <span className="text-destructive">*</span>}</p>
                            <p className="text-xs text-muted-foreground">{verifyFiles[slot.key] ? verifyFiles[slot.key]!.name : slot.desc}</p>
                          </div>
                        </div>
                        <label className="cursor-pointer">
                          <Button variant="outline" size="sm" asChild>
                            <span>{verifyFiles[slot.key] ? "Change" : "Upload"}</span>
                          </Button>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                setVerifyFiles(prev => ({ ...prev, [slot.key]: e.target.files![0] }));
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-3">
                    <Button onClick={handleSubmitVerification} disabled={saving || !verifyFiles.id_front}>
                      {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : "Submit for Review"}
                    </Button>
                    <Button variant="outline" onClick={() => setVerificationStep("idle")}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-5 bg-muted/30 rounded-xl">
                    <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                      <ShieldAlert className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">Verify Your Identity</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        A quick identity check helps keep Nuru safe for everyone. Once verified, you'll get a verified badge on your profile.
                      </p>
                      <Button onClick={handleStartVerification} size="sm">
                        <Shield className="w-4 h-4 mr-2" />
                        Get Verified
                      </Button>
                    </div>
                  </div>

                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-4 pb-4">
                      <h4 className="text-sm font-semibold mb-2">What you'll need</h4>
                      <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                        <li>National ID (NIDA) or Passport (front side required)</li>
                        <li>Back side and selfie are optional but speed up the review</li>
                      </ul>
                      <h4 className="text-sm font-semibold mt-3 mb-2">Why verify?</h4>
                      <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                        <li>Protects your account from impersonation</li>
                        <li>Adds a verified badge next to your name</li>
                        <li>Required for service providers and organisers who handle payments</li>
                        <li>Helps prevent fraud and builds trust across the platform</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { label: "Full Name", value: fullName, icon: UserIcon },
                  { label: "Username", value: currentUser.username ? `@${currentUser.username}` : "—", icon: UserIcon },
                  { label: "Phone", value: currentUser.phone || "—", icon: Phone, verified: currentUser.is_phone_verified },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                    <div className="w-9 h-9 bg-muted/50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-medium text-sm">{item.value}</p>
                      {item.verified !== undefined && (
                        <Badge variant="outline" className={`mt-1 text-xs ${item.verified ? "border-green-300 text-green-700" : "border-amber-300 text-amber-700"}`}>
                          {item.verified ? "Verified" : "Not verified"}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}

                {/* Email — special handling for optional email */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                  <div className="w-9 h-9 bg-muted/50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Email</p>
                    {currentUser.email ? (
                      <>
                        <p className="font-medium text-sm">{currentUser.email}</p>
                        {currentUser.is_email_verified ? (
                          <Badge variant="outline" className="mt-1 text-xs border-green-300 text-green-700">
                            Verified
                          </Badge>
                        ) : emailOtpMode ? (
                          /* OTP Verification UI */
                          <div className="mt-3 space-y-3">
                            <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to your email</p>
                            <InputOTP maxLength={6} value={emailOtp} onChange={setEmailOtp}>
                              <InputOTPGroup className="gap-2 justify-center w-full">
                                {[0,1,2,3,4,5].map(i => (
                                  <InputOTPSlot key={i} index={i} className="w-9 h-10 text-base font-semibold rounded-lg border" />
                                ))}
                              </InputOTPGroup>
                            </InputOTP>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-8 text-xs"
                                disabled={emailOtp.length < 6 || emailOtpLoading}
                                onClick={async () => {
                                  if (!currentUser?.id) return;
                                  setEmailOtpLoading(true);
                                  try {
                                    const res = await authApi.verifyOtp({
                                      user_id: currentUser.id,
                                      verification_type: "email",
                                      otp_code: emailOtp,
                                    });
                                    if (res.success) {
                                      toast.success("Email verified successfully!");
                                      setEmailOtpMode(false);
                                      setEmailOtp("");
                                      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
                                    } else {
                                      toast.error(res.message || "Invalid code");
                                    }
                                  } catch (err: any) {
                                    toast.error(err?.message || "Verification failed");
                                  } finally {
                                    setEmailOtpLoading(false);
                                  }
                                }}
                              >
                                {emailOtpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                                Verify
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={emailResendLoading}
                                onClick={async () => {
                                  if (!currentUser?.id) return;
                                  setEmailResendLoading(true);
                                  try {
                                    const res = await authApi.requestOtp({
                                      user_id: currentUser.id,
                                      verification_type: "email",
                                    });
                                    toast.success(res.success ? "Code resent!" : "Failed to resend");
                                  } catch {
                                    toast.error("Failed to resend code");
                                  } finally {
                                    setEmailResendLoading(false);
                                  }
                                }}
                              >
                                {emailResendLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                Resend Code
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* Not verified, show verify button */
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                              Not verified
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[11px] px-2"
                              disabled={emailResendLoading}
                              onClick={async () => {
                                if (!currentUser?.id) return;
                                setEmailResendLoading(true);
                                try {
                                  const res = await authApi.requestOtp({
                                    user_id: currentUser.id,
                                    verification_type: "email",
                                  });
                                  if (res.success) {
                                    toast.success("Verification code sent to " + currentUser.email);
                                    setEmailOtpMode(true);
                                    setEmailOtp("");
                                  } else {
                                    toast.error(res.message || "Failed to send code");
                                  }
                                } catch {
                                  toast.error("Failed to send verification code");
                                } finally {
                                  setEmailResendLoading(false);
                                }
                              }}
                            >
                              {emailResendLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <SendHorizonal className="w-3 h-3 mr-1" />}
                              Verify Now
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">No email added</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 h-7 text-xs"
                          onClick={() => setIsEditing(true)}
                        >
                          <Mail className="w-3 h-3 mr-1.5" />
                          Add Email
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserProfile;
