import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Share2, Send, Image as ImageIcon, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Comment {
  id: string;
  author: string;
  avatar: string;
  content?: string;
  image?: string;
  timestamp: string;
}

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const inputFileRef = useRef<HTMLInputElement | null>(null);

  const handleBack = () => {
    // If there's history state, go back normally, otherwise navigate to home
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  useEffect(() => {
    if (location.state?.post) {
      setPost(location.state.post);
    } else {
      const posts = JSON.parse(localStorage.getItem('posts') || '[]');
      const foundPost = posts.find((p: any) => p.id === id);

      if (!foundPost) {
        setPost({
          id,
          type: 'event',
          author: {
            name: 'Sarah Johnson',
            avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b5c5?w=150&h=150&fit=crop&crop=face',
            timeAgo: '2 hours ago',
          },
          event: {
            title: "Sarah & John's Wedding Celebration",
            text: "Join us for our special day! Ceremony at 4 PM followed by reception. Dress code: Formal. Can't wait to celebrate with all our loved ones!",
            image: '/src/assets/feed-images/sophia-wedding.png',
            hostedBy: 'Sarah & John',
            date: 'December 25, 2024',
          },
          likes: 24,
          comments: 8,
        });
      } else {
        setPost(foundPost);
      }
    }

    const savedComments = JSON.parse(localStorage.getItem(`comments_${id}`) || '[]');
    setComments(savedComments);
  }, [id, location.state]);

  // Image handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (inputFileRef.current) inputFileRef.current.value = '';
  };

  const sendEcho = () => {
    if (!input.trim() && !imagePreview) return;

    const comment: Comment = {
      id: Date.now().toString(),
      author: 'You',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      content: input.trim() || undefined,
      image: imagePreview || undefined,
      timestamp: 'Just now'
    };

    const updated = [...comments, comment];
    setComments(updated);
    localStorage.setItem(`comments_${id}`, JSON.stringify(updated));
    setInput('');
    removeImage();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendEcho();
    }
  };

  if (!post) return <div>Loading...</div>;

  return (
    <>
      <div className="flex items-center mb-3 md:mb-4">
        <Button variant="ghost" onClick={handleBack} className="flex items-center gap-2 text-sm md:text-base">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      {/* Post Content */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden mb-4 md:mb-6">
        {/* Post Header */}
        <div className="p-3 md:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <img src={post.author.avatar} alt={post.author.name} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground text-sm md:text-base truncate">{post.author.name}</h3>
              <p className="text-xs md:text-sm text-muted-foreground">{post.author.timeAgo}</p>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="text-muted-foreground flex-shrink-0">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Image */}
        {post.event?.image && (
          <div className="px-3 md:px-4">
            <img src={post.event.image} alt={post.event.title || 'Post image'} className="w-full h-48 md:h-64 object-cover rounded-lg" />
          </div>
        )}

        {/* Content */}
        <div className="px-3 md:px-4 py-2 md:py-3">
          <h2 className="text-lg md:text-xl font-bold text-foreground mb-1">{post.event?.title || 'Post Title'}</h2>
          {(post.event?.hostedBy || post.event?.date) && (
            <p className="text-xs md:text-sm text-muted-foreground">
              {post.event.hostedBy ? `Hosted by ${post.event.hostedBy}` : null}
              {post.event.hostedBy && post.event.date ? ' • ' : null}
              {post.event.date ? post.event.date : null}
            </p>
          )}
          {post.event?.text && <p className="mt-2 text-sm md:text-base text-foreground">{post.event.text}</p>}
        </div>

        {/* Action Buttons */}
        <div className="px-3 md:px-4 py-2 md:py-3 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex gap-1.5 md:gap-2 flex-wrap">
            <button
              onClick={() => setLiked(!liked)}
              className={`flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-lg transition-colors text-xs md:text-sm ${
                liked ? 'bg-red-100 text-red-600' : 'bg-gray-200/20 text-muted-foreground hover:bg-gray-200/30 hover:text-foreground'
              }`}
            >
              <Heart className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{liked ? 'Glowed' : 'Glow'}</span>
            </button>

            <button
              onClick={() => {}}
              className="flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-lg bg-gray-200/20 text-muted-foreground hover:bg-gray-200/30 hover:text-foreground transition-colors text-xs md:text-sm"
            >
              <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Echo</span>
            </button>

            <button
              onClick={() => {}}
              className="flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-lg bg-gray-200/20 text-muted-foreground hover:bg-gray-200/30 hover:text-foreground transition-colors text-xs md:text-sm"
            >
              <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Spark</span>
            </button>
          </div>

          <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
            <span>{post.likes + (liked ? 1 : 0)} {post.likes + (liked ? 1 : 0) === 1 ? 'Glow' : 'Glows'}</span>
            <span>{comments.length} {comments.length === 1 ? 'Echo' : 'Echoes'}</span>
          </div>
        </div>
      </div>

      {/* Echoes */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-3 md:p-4">
        <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Echoes ({comments.length})</h2>

        {/* Image preview (if any) */}
        {imagePreview && (
          <div className="mb-3 relative w-full max-h-40 md:max-h-48 rounded-lg overflow-hidden border border-border">
            <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
            <button
              onClick={removeImage}
              className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors"
              aria-label="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input row using the same UI as Messages */}
        <div className="flex gap-2 md:gap-3 mb-3 md:mb-4">
          <img
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
            alt="Your avatar"
            className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0"
          />

          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 md:gap-2 bg-transparent rounded-lg px-2 md:px-3 py-2 flex-1 border border-border min-w-0">
              <input
                type="text"
                placeholder="Add an echo..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                className="flex-1 bg-transparent text-muted-foreground text-sm outline-none placeholder:text-muted-foreground min-w-0"
                aria-label="Add an echo"
              />

              <label className="p-1.5 md:p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors flex-shrink-0" title="Attach image">
                <ImageIcon className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                <input
                  ref={inputFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              <button className="p-1.5 md:p-2 hover:bg-muted rounded-lg transition-colors hidden sm:block flex-shrink-0" title="Location">
                <MapPin className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
              </button>
            </div>

            <Button
              size="sm"
              className="px-3 md:px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 flex-shrink-0"
              onClick={sendEcho}
              disabled={!input.trim() && !imagePreview}
              aria-label="Post Echo"
            >
              <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Button>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-2 md:space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2 md:gap-3">
              <img src={comment.avatar} alt={comment.author} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="bg-muted/50 rounded-lg p-2 md:p-3">
                  <div className="flex items-center gap-2 mb-1.5 md:mb-2">
                    <span className="font-semibold text-xs md:text-sm truncate">{comment.author}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{comment.timestamp}</span>
                  </div>

                  {comment.image && (
                    <div className="mb-2 rounded-lg overflow-hidden border border-border">
                      <img src={comment.image} alt="echo image" className="w-full h-32 md:h-40 object-cover" />
                    </div>
                  )}

                  {comment.content && <p className="text-sm break-words">{comment.content}</p>}
                </div>
              </div>
            </div>
          ))}

          {comments.length === 0 && <p className="text-center text-muted-foreground py-3 md:py-4 text-sm md:text-base">No echoes yet. Be the first to add one!</p>}
        </div>
      </div>
    </>
  );
};

export default PostDetail;
