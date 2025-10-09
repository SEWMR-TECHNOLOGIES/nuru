import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Upload, CheckCircle2, Circle, FileCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';

interface VerificationItem {
  id: string;
  title: string;
  description: string;
  required: boolean;
  completed: boolean;
  files: File[];
}

const VERIFICATION_ITEMS: Omit<VerificationItem, 'completed' | 'files'>[] = [
  {
    id: 'govt-id',
    title: 'Government-issued ID',
    description: 'Upload a clear photo of your Passport, National ID, or Driver\'s License. Make sure all details are visible.',
    required: true,
  },
  {
    id: 'business-license',
    title: 'Business License',
    description: 'Provide a valid license to operate a business legally in Tanzania. This helps us ensure you\'re authorized to offer services.',
    required: true,
  },
  {
    id: 'tax-certificate',
    title: 'Tax Compliance Certificate',
    description: 'Submit proof of tax registration and compliance (TIN certificate or tax clearance). This verifies your business is registered with TRA.',
    required: true,
  },
  {
    id: 'professional-cert',
    title: 'Professional Certification',
    description: 'Upload certificates proving your service expertise such as DJ license, catering certificate, photography certification, or security license.',
    required: true,
  },
  {
    id: 'portfolio',
    title: 'Portfolio/Work Samples',
    description: 'Share photos, videos, or examples demonstrating your previous work and experience. This helps clients trust your quality.',
    required: true,
  },
];

const ServiceVerification = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);

  useWorkspaceMeta({
    title: 'Service Verification',
    description: 'Complete verification to become a trusted service provider on Nuru.'
  });

  useEffect(() => {
    // Initialize or load existing verification data
    const savedData = localStorage.getItem(`verification-${id}`);
    if (savedData) {
      setItems(JSON.parse(savedData));
    } else {
      setItems(
        VERIFICATION_ITEMS.map(item => ({
          ...item,
          completed: false,
          files: [],
        }))
      );
    }
  }, [id]);

  useEffect(() => {
    // Save verification data
    if (items.length > 0) {
      localStorage.setItem(`verification-${id}`, JSON.stringify(items));
    }
  }, [items, id]);

  const handleFileChange = (itemId: string, files: FileList | null) => {
    if (!files) return;
    
    const fileArray = Array.from(files);
    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, files: fileArray, completed: fileArray.length > 0 }
          : item
      )
    );
    toast.success('Files uploaded successfully!');
  };

  const removeFile = (itemId: string, fileIndex: number) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              files: item.files.filter((_, index) => index !== fileIndex),
              completed: item.files.length > 1,
            }
          : item
      )
    );
  };

  const completedCount = items.filter(item => item.completed).length;
  const progress = (completedCount / items.length) * 100;

  const handleSubmit = () => {
    const allCompleted = items.every(item => item.completed);
    if (!allCompleted) {
      toast.error('Please complete all verification items before submitting.');
      return;
    }
    toast.success('Verification submitted! Our team will review your documents within 24-48 hours.');
    navigate('/my-services');
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl md:text-3xl font-bold">Service Verification</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/my-services')}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-muted-foreground mb-4">
            Complete the verification process to become a trusted service provider and gain client confidence.
          </p>
          
          {/* Why Verification Card */}
          <Card className="bg-primary/5 border-primary/20 mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Why do we need verification?</h3>
                  <p className="text-sm text-muted-foreground">
                    We verify all service providers to ensure legitimacy, protect our clients, and maintain 
                    high-quality standards. Verified providers gain a trust badge, appear higher in search results, 
                    and receive more bookings. This process helps create a safe marketplace for everyone.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Verification Progress</span>
                <span className="text-sm text-muted-foreground">
                  {completedCount} of {items.length} completed
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="mt-2 text-xs text-muted-foreground">
                {progress === 100 ? (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    All items completed! Ready to submit.
                  </span>
                ) : (
                  `${Math.round(progress)}% complete`
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Verification Checklist */}
        <div className="space-y-4 mb-6">
          {items.map((item, index) => (
            <Card key={item.id} className={item.completed ? 'border-green-500/50' : ''}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {item.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
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
                        <Badge variant="outline" className="text-xs flex-shrink-0">Required</Badge>
                      )}
                      {item.completed && (
                        <Badge className="bg-green-600 text-xs flex-shrink-0">Completed</Badge>
                      )}
                    </div>
                    <CardDescription className="break-words">{item.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Upload Area */}
                <div className="space-y-3">
                  {item.files.length > 0 && (
                    <div className="space-y-2">
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
                  
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-3">
                      {item.files.length > 0 ? 'Add more files' : 'Upload documents'}
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
                      onClick={() => document.getElementById(`file-${item.id}`)?.click()}
                    >
                      Choose Files
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Accepted: JPG, PNG, PDF (Max 5MB per file)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Submit Button */}
        <Card className="bg-secondary/30">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/my-services')}
              >
                Save & Continue Later
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={progress < 100}
              >
                {progress === 100 ? 'Submit for Verification' : 'Complete All Items to Submit'}
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-3">
              You can save your progress and return later. Our team typically reviews submissions within 24-48 hours.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ServiceVerification;
