import { useEffect } from 'react';
import CreatePostBox from './CreatePostBox';
import Post from './Post';
import AdCard from './AdCard';
import PromotedEvent from './PromotedEvent';
import birthdayImage from '@/assets/feed-images/birthday.webp';
import sophiaWeddingImage from '@/assets/feed-images/sophia-wedding.png';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';

const Feed = () => {
  useEffect(() => {
    const savedPosition = sessionStorage.getItem('feedScrollPosition');
    if (savedPosition) {
      setTimeout(() => {
        const scrollContainer = document.querySelector('.flex-1.overflow-y-auto');
        if (scrollContainer) {
          scrollContainer.scrollTop = parseInt(savedPosition, 10);
        }
        sessionStorage.removeItem('feedScrollPosition');
      }, 0);
    }
  }, []);

  const posts = [
  {
    id: '1',
    type: 'event' as const,
    author: {
      name: 'Ella Lane',
      avatar: 'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=40&h=40&fit=crop&crop=face',
      timeAgo: 'Yesterday at 3:45 PM'
    },
    event: {
      title: "Ella's 25th Birthday Party 🎉",
      text: "Join us as we celebrate Ella turning 25 with food, music, and good vibes. Hosted by Bile Larve.",
      image: birthdayImage,
      hostedBy: 'Bile Larve',
      date: 'Sunday, July 28, 2024'
    },
    likes: 24,
    comments: 5
  },
  {
    id: '2',
    type: 'memorial' as const,
    author: {
      name: 'Michael Smith',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
      timeAgo: '2 hours ago'
    },
    content: {
      title: "In Loving Memory of Grandma Sarah",
      text: "RIP Grandma Sarah. You will be deeply missed. Thank you for all the wonderful memories and love you shared with our family. 💔",
      image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=400&fit=crop'
    },
    likes: 48,
    comments: 12
  },
  {
    id: '3',
    type: 'wedding' as const,
    author: {
      name: 'Jessica & David',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=40&h=40&fit=crop&crop=face',
      timeAgo: '5 hours ago'
    },
    event: {
      title: "Jessica & David’s Wedding Ceremony 💍",
      text: "A beautiful day to celebrate love as Jessica and David tie the knot. Hosted by the Johnson Family.",
      image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=400&fit=crop',
      hostedBy: 'The Johnson Family',
      date: 'Saturday, September 15, 2024'
    },
    likes: 89,
    comments: 23
  },
  {
    id: '4',
    type: 'birthday' as const,
    author: {
      name: 'Liam Cooper',
      avatar: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=40&h=40&fit=crop&crop=face',
      timeAgo: '3 days ago'
    },
    event: {
      title: "Surprise Birthday Bash for Sophie 🎂",
      text: "We pulled off the best surprise for Sophie’s big day. Great friends, laughter, and an unforgettable night.",
      image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&h=400&fit=crop',
      hostedBy: 'Liam Cooper',
      date: 'Friday, August 30, 2024'
    },
    likes: 34,
    comments: 9
  },
  {
    id: '5',
    type: 'memorial' as const,
    author: {
      name: 'Amelia Johnson',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=40&h=40&fit=crop&crop=face',
      timeAgo: '1 day ago'
    },
    content: {
      title: "Remembering Grandpa John",
      text: "His wisdom, humor, and kindness will always remain in our hearts. A man who left a lasting legacy.",
      image: 'https://images.unsplash.com/photo-1524503033411-c9566986fc8f?w=600&h=400&fit=crop'
    },
    likes: 22,
    comments: 4
  },
  {
    id: '6',
    type: 'event' as const,
    author: {
      name: 'Noah Williams',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face',
      timeAgo: '6 hours ago'
    },
    event: {
      title: "Neighborhood Community Meetup",
      text: "An open gathering for neighbors to connect, share ideas, and enjoy some snacks together.",
      image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&h=400&fit=crop',
      hostedBy: 'Noah Williams',
      date: 'Sunday, September 8, 2024'
    },
    likes: 55,
    comments: 14
  },
  {
    id: '7',
    type: 'wedding' as const,
    author: {
      name: 'Sophia & Ethan',
      avatar: 'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=40&h=40&fit=crop&crop=face',
      timeAgo: 'Just now'
    },
    event: {
      title: "Sophia & Ethan's Beach Wedding Celebration 🌊",
      text: "A romantic ceremony by the ocean as Sophia and Ethan exchange vows in front of family and friends.",
      image: sophiaWeddingImage,
      hostedBy: 'Sophia & Ethan',
      date: 'Saturday, September 22, 2024'
    },
    likes: 67,
    comments: 18
  }
];

  useWorkspaceMeta({
    title: "Workspace",
    description: "See the latest events, weddings, birthdays, and community posts on Nuru."
  });

  return (
    <div className="space-y-4 md:space-y-6 pb-4">
      <CreatePostBox />
      
      {posts.map((post, index) => (
        <div key={post.id}>
          <Post post={post} />
          
          {/* Insert ads and promoted content strategically */}
          {index === 1 && (
            <div className="mt-6">
              <AdCard
                title="Nuru Event Planning Services"
                description="Professional event planning for all occasions. Weddings, birthdays, corporate events and more!"
                image="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=250&fit=crop"
                cta="Plan Your Event"
              />
            </div>
          )}
          
          {index === 0 && (
            <div className="mt-6">
              <PromotedEvent
                title="Annual Tech Conference 2024"
                date="October 20, 2024"
                location="Convention Center, Nairobi"
                image="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=250&fit=crop"
                attendees={324}
              />
            </div>
          )}
        </div>
      ))}

      {/* Additional Ad */}
      <AdCard
        title="Nuru Catering Services"
        description="Delicious meals for your special events. From intimate gatherings to large celebrations."
        image="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=250&fit=crop"
        cta="Book Now"
      />
    </div>
  );
};

export default Feed;