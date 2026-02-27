import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { messagesApi } from '@/lib/api/messages';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * ProviderChat - Redirects to the real Messages view.
 * Starts or finds a service-specific conversation with the provider.
 */
const ProviderChat = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const providerId = searchParams.get('providerId');
  const providerName = searchParams.get('providerName') || 'Service Provider';
  const serviceId = searchParams.get('serviceId') || undefined;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!providerId) {
      navigate('/messages', { replace: true });
      return;
    }

    const initChat = async () => {
      try {
        const response = await messagesApi.startConversation({
          recipient_id: providerId,
          message: `Hi, I'm interested in your services.`,
          service_id: serviceId,
        });

        if (response.success && response.data?.id) {
          // Navigate with conversationId so the correct service-specific thread is selected
          navigate(`/messages?conversationId=${response.data.id}`, { replace: true });
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
  }, [providerId, serviceId, navigate]);

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
