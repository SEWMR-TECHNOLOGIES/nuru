import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash2, Eye, EyeOff, X, Image as ImageIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNavigate } from 'react-router-dom';
import birthdayImage from '@/assets/feed-images/birthday.webp';
import sophiaWeddingImage from '@/assets/feed-images/sophia-wedding.png';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { toast } from 'sonner';

interface UserMoment {
  id: string;
  type: 'event' | 'memorial' | 'wedding' | 'birthday';
  author: {
    name: string;
    avatar: string;
    timeAgo: string;
  };
  event?: {
    title?: string;
    text?: string;
    image?: string;
    hostedBy?: string;
    date?: string;
  };
  content?: {
    title?: string;
    text?: string;
    image?: string;
  };
  likes: number;
  comments: number;
  isPublic: boolean;
}

const MyMoments = () => {
  const navigate = useNavigate();
  const [moments, setMoments] = useState<UserMoment[]>([
    {
      id: '1',
      type: 'event' as const,
      author: {
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        timeAgo: 'Yesterday at 3:45 PM'
      },
      event: {
        title: "My 25th Birthday Party 🎉",
        text: "Join us as we celebrate with food, music, and good vibes.",
        image: birthdayImage,
        hostedBy: 'Me',
        date: 'Sunday, July 28, 2024'
      },
      likes: 24,
      comments: 5,
      isPublic: true
    },
    {
      id: '7',
      type: 'wedding' as const,
      author: {
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        timeAgo: 'Just now'
      },
      event: {
        title: "Beach Wedding Celebration 🌊",
        text: "A romantic ceremony by the ocean.",
        image: sophiaWeddingImage,
        hostedBy: 'You',
        date: 'Saturday, September 22, 2024'
      },
      likes: 67,
      comments: 18,
      isPublic: false
    }
  ]);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMoment, setEditingMoment] = useState<UserMoment | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  useWorkspaceMeta({
    title: "Your Moments",
    description: "Manage your moments, edit, delete, or change their visibility."
  });

  const handleDelete = (momentId: string) => {
    setMoments(moments.filter(m => m.id !== momentId));
    toast.success('Moment deleted successfully');
  };

  const toggleVisibility = (momentId: string) => {
    setMoments(moments.map(m => 
      m.id === momentId ? { ...m, isPublic: !m.isPublic } : m
    ));
    const moment = moments.find(m => m.id === momentId);
    toast.success(`Moment is now ${moment?.isPublic ? 'private' : 'public'}`);
  };

  const handleEdit = (moment: UserMoment) => {
    setEditingMoment(moment);
    const title = moment.event?.title || moment.content?.title || '';
    const text = moment.event?.text || moment.content?.text || '';
    const image = moment.event?.image || moment.content?.image || '';
    
    setEditTitle(title);
    setEditText(text);
    setEditImage(image);
    setEditImagePreview(image);
    setEditDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const preview = URL.createObjectURL(file);
      setEditImagePreview(preview);
      // In real app, you'd upload the file here
    }
  };

  const removeEditImage = () => {
    setEditImagePreview(null);
    setEditImage('');
  };

  const saveEdit = () => {
    if (!editingMoment) return;

    setMoments(moments.map(m => {
      if (m.id === editingMoment.id) {
        const updated = { ...m };
        if (updated.event) {
          updated.event = {
            ...updated.event,
            title: editTitle,
            text: editText,
            image: editImagePreview || editImage
          };
        } else if (updated.content) {
          updated.content = {
            ...updated.content,
            title: editTitle,
            text: editText,
            image: editImagePreview || editImage
          };
        }
        return updated;
      }
      return m;
    }));

    toast.success('Moment updated successfully');
    setEditDialogOpen(false);
    setEditingMoment(null);
  };

  const viewMoment = (moment: UserMoment) => {
    navigate(`/post/${moment.id}`, { state: { post: moment } });
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Your Moments</h1>
        <Button onClick={() => navigate('/')} variant="outline">
          Share New Moment
        </Button>
      </div>

      {moments.length === 0 ? (
        <div className="bg-card rounded-lg shadow-sm border border-border p-8 text-center">
          <p className="text-muted-foreground mb-4">You haven't shared any moments yet.</p>
          <Button onClick={() => navigate('/')}>Share Your First Moment</Button>
        </div>
      ) : (
        moments.map((moment) => {
          const title = moment.event?.title || moment.content?.title || 'Untitled Moment';
          const text = moment.event?.text || moment.content?.text || '';
          const image = moment.event?.image || moment.content?.image;
          const hostedBy = moment.event?.hostedBy;
          const date = moment.event?.date;

          return (
            <div
              key={moment.id}
              className="bg-card rounded-lg shadow-sm border border-border overflow-hidden"
            >
              {/* Moment Header */}
              <div className="p-3 md:p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <img
                    src={moment.author.avatar}
                    alt={moment.author.name}
                    className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm md:text-base text-foreground">{moment.author.name}</h3>
                      {moment.isPublic ? (
                        <span title="Public"><Eye className="w-4 h-4 text-green-600" /></span>
                      ) : (
                        <span title="Private"><EyeOff className="w-4 h-4 text-muted-foreground" /></span>
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">{moment.author.timeAgo}</p>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background z-50">
                    <DropdownMenuItem onClick={() => handleEdit(moment)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleVisibility(moment.id)}>
                      {moment.isPublic ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-2" />
                          Make Private
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-2" />
                          Make Public
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(moment.id)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Image */}
              {image && (
                <div className="px-3 md:px-4 cursor-pointer" onClick={() => viewMoment(moment)}>
                  <img
                    src={image}
                    alt={title}
                    className="w-full h-48 md:h-64 object-cover rounded-lg"
                  />
                </div>
              )}

              {/* Content */}
              <div className="px-3 md:px-4 py-3 cursor-pointer" onClick={() => viewMoment(moment)}>
                <h2 className="text-lg md:text-xl font-bold text-foreground mb-1">{title}</h2>

                {(hostedBy || date) && (
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {hostedBy ? `Hosted by ${hostedBy}` : null}
                    {hostedBy && date ? ' • ' : null}
                    {date ? date : null}
                  </p>
                )}

                {text && (
                  <div className="mt-2">
                    <p className="text-foreground">{text}</p>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="px-3 md:px-4 py-2 md:py-3 border-t border-border">
                <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
                  <span>{moment.likes} {moment.likes === 1 ? 'Glow' : 'Glows'}</span>
                  <span>{moment.comments} {moment.comments === 1 ? 'Echo' : 'Echoes'}</span>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Moment</DialogTitle>
            <DialogDescription>Make changes to your moment.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter moment title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="text">Description</Label>
              <Textarea
                id="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Enter moment description"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Image</Label>
              {editImagePreview ? (
                <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border">
                  <img
                    src={editImagePreview}
                    alt="preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={removeEditImage}
                    className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                  <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Click to upload image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyMoments;
