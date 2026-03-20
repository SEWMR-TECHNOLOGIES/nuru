import { useParams, Navigate } from 'react-router-dom';
import { decodeId, isShortId } from '@/utils/shortId';

/**
 * Redirects /s/:shortId to /shared/post/:uuid
 */
const ShortLinkRedirect = () => {
  const { shortId } = useParams<{ shortId: string }>();

  if (!shortId) return <Navigate to="/" replace />;

  try {
    const uuid = isShortId(shortId) ? decodeId(shortId) : shortId;
    return <Navigate to={`/shared/post/${uuid}?r=1`} replace />;
  } catch {
    return <Navigate to="/" replace />;
  }
};

export default ShortLinkRedirect;
