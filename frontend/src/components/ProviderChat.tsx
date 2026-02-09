import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { messagesApi } from '@/lib/api/messages';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * ProviderChat - Redirects to the real Messages view.
 * Starts or finds a conversation with the service provider user.
 */
const ProviderChat = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const providerId = searchParams.get('providerId');
  const providerName = searchParams.get('providerName') || 'Service Provider';
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!providerId) {
      navigate('/messages', { replace: true });
      return;
    }

    const initChat = async () => {
      try {
        // Try to start a conversation - backend should return existing one if it exists
        const response = await messagesApi.startConversation({
          recipient_id: providerId,
          message: `Hi, I'm interested in your services.`,
        });

        if (response.success && response.data?.id) {
          navigate('/messages', { replace: true });
        } else {
          toast.error(response.message || 'Could not start conversation');
          navigate('/messages', { replace: true });
        }
      } catch {
        toast.error('Failed to start conversation');
        navigate('/messages', { replace: true });
      }
    };

    initChat();
  }, [providerId, navigate]);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Starting chat with {providerName}...</p>
      </div>
    </div>
  );
};

export default ProviderChat;
