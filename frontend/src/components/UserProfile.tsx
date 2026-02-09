import { useEffect, useState, useRef } from "react";
import { 
  MapPin, Calendar, CheckCircle, Edit, Camera, Loader2, 
  Mail, Phone, User as UserIcon, Shield, ShieldCheck, ShieldAlert,
  Upload, FileText, AlertCircle, Clock, ImagePlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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

  useWorkspaceMeta({
    title: 'Profile',
    description: 'View and manage your Nuru profile and account settings.'
  });

  const [isEditing, setIsEditing] = useState(false);
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
  });

  // Fetch verification status from API on mount
  useEffect(() => {
    if (currentUser) {
      setEditData({
        first_name: currentUser.first_name || "",
        last_name: currentUser.last_name || "",
        bio: currentUser.bio || "",
        phone: currentUser.phone || "",
        location: currentUser.location || "",
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

      {/* Profile Header - Improved Cover */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="relative h-52 md:h-56">
          {/* Gradient cover with pattern overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/85 to-accent" />
          <div className="absolute inset-0 opacity-[0.08]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23fff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
          {/* Decorative blobs */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-primary-foreground/5 rounded-full blur-xl" />

          {!isEditing && (
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-4 right-4 gap-2 shadow-md backdrop-blur-sm bg-background/80 hover:bg-background/95"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </Button>
          )}
        </div>

        <CardContent className="pt-0 pb-6">
          <div className="flex flex-col md:flex-row gap-6 -mt-16 relative z-10">
            {/* Avatar with camera button */}
            <div className="relative flex-shrink-0 group">
              <Avatar className="w-32 h-32 border-4 border-background shadow-xl ring-2 ring-primary/10">
                <AvatarImage src={currentUser.avatar || undefined} alt={fullName} />
                <AvatarFallback className="text-2xl font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>

              {/* Camera overlay */}
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Change avatar"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>

              {isVerified && (
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 shadow-sm">
                  <ShieldCheck className="w-6 h-6 text-green-600" />
                </div>
              )}
            </div>

            <div className="flex-1 mt-14 md:mt-4">
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
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
                      <Input value={editData.phone} onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
                      <Input value={editData.location} onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))} placeholder="City, Country" />
                    </div>
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
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-foreground">{fullName}</h1>
                    {isVerified && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </Badge>
                    )}
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
                        <MapPin className="w-4 h-4" /> {currentUser.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" /> Joined {joinDate}
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
          { label: "Followers", value: currentUser.follower_count ?? 0 },
          { label: "Following", value: currentUser.following_count ?? 0 },
        ].map(stat => (
          <Card key={stat.label} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="verification" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="verification" className="gap-2">
            <Shield className="w-4 h-4" /> Identity Verification
          </TabsTrigger>
          <TabsTrigger value="contact" className="gap-2">
            <UserIcon className="w-4 h-4" /> Contact Info
          </TabsTrigger>
        </TabsList>

        <TabsContent value="verification">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Identity Verification</CardTitle>
              <p className="text-sm text-muted-foreground">
                Verify your identity to build trust and unlock premium features
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
                        <p className="font-medium text-foreground mb-1">Documents Required</p>
                        <p>Upload clear photos of your government-issued ID (front & back) and a selfie for verification.</p>
                      </div>
                    </div>
                  </div>

                  {[
                    { key: "id_front" as const, label: "ID Front", desc: "Front side of your national ID or passport" },
                    { key: "id_back" as const, label: "ID Back", desc: "Back side of your national ID" },
                    { key: "selfie" as const, label: "Selfie", desc: "A clear photo of your face" },
                  ].map(slot => (
                    <div key={slot.key} className="border border-dashed border-border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                            {verifyFiles[slot.key] ? <FileText className="w-5 h-5 text-green-600" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{slot.label} {slot.key !== "selfie" && "*"}</p>
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
                <div className="flex items-center gap-4 p-5 bg-muted/30 rounded-xl">
                  <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                    <ShieldAlert className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Not Yet Verified</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Verify your identity to gain trust, offer services, and access all features.
                    </p>
                    <Button onClick={handleStartVerification} size="sm">
                      <Shield className="w-4 h-4 mr-2" />
                      Start Verification
                    </Button>
                  </div>
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
                  { label: "Email", value: currentUser.email, icon: Mail, verified: currentUser.is_email_verified },
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserProfile;
