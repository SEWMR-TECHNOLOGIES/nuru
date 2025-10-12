import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  Upload,
  CheckCircle2,
  Circle,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useWorkspaceMeta } from "@/hooks/useWorkspaceMeta";
import { useServiceKyc } from "@/data/useUserServiceKyc";
import { ServiceLoadingSkeleton } from "@/components/ui/ServiceLoadingSkeleton";

interface VerificationItem {
  id: string;
  title: string;
  description: string;
  required: boolean;
  completed: boolean;
  files: File[];
  status: string | null;
  remarks: string | null;
}

const ServiceVerification = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { kycList, loading, error, refetch } = useServiceKyc(serviceId); // <-- add refetch from hook
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useWorkspaceMeta({
    title: "Service Verification",
    description: "Complete verification to become a trusted service provider on Nuru.",
  });

  // Format KYC items from API
  useEffect(() => {
    if (kycList.length > 0) {
      const formatted = kycList.map((kyc: any) => ({
        id: kyc.id,
        title: kyc.name,
        description: kyc.description || "No description provided.",
        required: kyc.is_mandatory,
        completed: kyc.status === "verified" || kyc.status === "pending",
        files: [],
        status: kyc.status,
        remarks: kyc.remarks,
      }));
      setItems(formatted);
    }
  }, [kycList]);

  const handleFileChange = (itemId: string, files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, files: [...item.files, ...fileArray], completed: true }
          : item
      )
    );
    toast.success("Files uploaded successfully!");
  };

  const removeFile = (itemId: string, fileIndex: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              files: item.files.filter((_, i) => i !== fileIndex),
              completed: item.files.length > 1,
            }
          : item
      )
    );
  };

  const verifiedCount = items.filter((item) => item.status === "verified").length;
  const progress = items.length > 0 ? (verifiedCount / items.length) * 100 : 0;
  const hasEditableItems = items.some(
    (item) => item.status === null || item.status === "rejected"
  );

  const submitVerification = async (partial: boolean = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const itemsToSubmit = partial
      ? items.filter((item) => item.files.length > 0) 
      : items.filter((item) => item.status !== "verified" && item.status !== "pending"); 

    if (!partial && itemsToSubmit.some((item) => item.files.length === 0 && item.required)) {
      toast.error("Please attach files for all required items before submitting.");
      setIsSubmitting(false);
      return;
    }

    if (partial && itemsToSubmit.length === 0) {
      toast.success("Progress saved.");
      setIsSubmitting(false);
      navigate("/my-services");
      return;
    }

    if (!partial && itemsToSubmit.length === 0) {
      toast.error("No files to submit.");
      setIsSubmitting(false);
      return;
    }

    const form = new FormData();
    itemsToSubmit.forEach((item) => {
      item.files.forEach((file) => {
        form.append("kyc_files", file);
        form.append("kyc_ids", item.id);
      });
    });

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/services/submit-verification/${serviceId}`,
        {
          method: "POST",
          body: form,
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        }
      );
      const result = await response.json();
      if (!result.success) {
        toast.error(result.message || "Failed to submit verification");
        return;
      }
      toast.success(result.message);

      // Refresh KYC data
      await refetch();
      setItems([]);

      if (partial) navigate("/my-services"); 
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <ServiceLoadingSkeleton />;

  if (error)
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Failed to load KYC data: {error}
      </div>
    );

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl md:text-3xl font-bold">Service Verification</h1>
            <Button variant="ghost" size="icon" onClick={() => navigate("/my-services")}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-muted-foreground mb-4">
            Complete the verification process to become a trusted service provider.
          </p>

          <Card className="bg-primary/5 border-primary/20 mb-6">
            <CardContent className="pt-6 flex gap-3">
              <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Why do we need verification?</h3>
                <p className="text-sm text-muted-foreground">
                  We verify all service providers to ensure legitimacy and quality.
                  Verified providers gain trust and more bookings.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Verification Progress</span>
                <span className="text-sm text-muted-foreground">
                  {verifiedCount} of {items.length} verified
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="mt-2 text-xs text-muted-foreground">
                {verifiedCount === items.length ? (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    All items verified!
                  </span>
                ) : (
                  `${Math.round(progress)}% verified`
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Verification Checklist */}
        <div className="space-y-4 mb-6">
          {items.map((item, index) => (
            <Card key={item.id} className={item.completed ? "border-green-500/50" : ""}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {item.status === "verified" ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : item.status === "pending" ? (
                      <Circle className="w-6 h-6 text-yellow-500" />
                    ) : (
                      <Circle className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <CardTitle className="text-lg">
                        {index + 1}. {item.title}
                      </CardTitle>
                      {item.required && (
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          Required
                        </Badge>
                      )}
                      {item.status === "verified" && (
                        <Badge className="bg-green-600 text-xs flex-shrink-0">Verified</Badge>
                      )}
                      {item.status === "pending" && (
                        <Badge className="bg-yellow-500 text-xs flex-shrink-0">Pending</Badge>
                      )}
                      {item.status === "rejected" && (
                        <Badge className="bg-red-600 text-xs flex-shrink-0">Rejected</Badge>
                      )}
                    </div>
                    <CardDescription className="break-words">{item.description}</CardDescription>
                    {item.status === "rejected" && item.remarks && (
                      <p className="text-red-600 text-sm mt-1">Remarks: {item.remarks}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Upload UI */}
                {(item.status === null || item.status === "rejected") && (
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-3">
                      {item.files.length > 0
                        ? "Add more files"
                        : item.status === "rejected"
                        ? `Rejected: ${item.remarks || ""}. Re-upload your document.`
                        : "Upload documents"}
                    </p>
                    <input
                      type="file"
                      id={`file-${item.id}`}
                      className="hidden"
                      multiple
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(item.id, e.target.files)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        document.getElementById(`file-${item.id}`)?.click()
                      }
                    >
                      Choose Files
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Accepted: JPG, PNG, PDF (Max 1MB per file)
                    </p>
                  </div>
                )}

                {item.status === "pending" && (
                  <p className="text-sm text-yellow-600">
                    Your submission is under review. You cannot re-upload at this time.
                  </p>
                )}

                {item.status === "verified" && (
                  <p className="text-sm text-green-600 font-medium">KYC Verified</p>
                )}

                {item.files.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {item.files.map((file, fileIndex) => (
                      <div
                        key={fileIndex}
                        className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span className="text-sm truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(item.id, fileIndex)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Submit Buttons */}
        {hasEditableItems && (
          <Card className="bg-secondary/30">
            <CardContent className="pt-6 flex flex-col md:flex-row gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => submitVerification(true)}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save & Continue Later"}
              </Button>
              <Button
                className="flex-1"
                onClick={() => submitVerification(false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit for Verification"}
              </Button>
            </CardContent>
            <p className="text-xs text-center text-muted-foreground mt-3">
              You can save your progress and return later. Our team typically reviews submissions within 24-48 hours.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ServiceVerification;
