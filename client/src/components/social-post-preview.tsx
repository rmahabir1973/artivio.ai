import { Button } from "@/components/ui/button";
import { 
  Heart, 
  MessageSquare, 
  Send, 
  Bookmark, 
  Share2, 
  ThumbsUp, 
  BarChart2,
  Image as ImageIcon,
} from "lucide-react";
import { Repeat2 } from "lucide-react";
import {
  SiInstagram, 
  SiTiktok, 
  SiLinkedin, 
  SiYoutube, 
  SiFacebook, 
  SiX,
  SiThreads,
  SiPinterest,
  SiBluesky,
} from "react-icons/si";

export interface PostData {
  caption: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  hashtags?: string[];
  mediaItems?: Array<{ url: string; type: string }>;
}

interface SocialPostPreviewProps {
  platform: string;
  post: PostData;
  username?: string;
  profileImage?: string;
}

const PLATFORM_ICONS: Record<string, any> = {
  instagram: SiInstagram,
  tiktok: SiTiktok,
  linkedin: SiLinkedin,
  youtube: SiYoutube,
  facebook: SiFacebook,
  x: SiX,
  threads: SiThreads,
  pinterest: SiPinterest,
  bluesky: SiBluesky,
};

export function SocialPostPreview({ 
  platform, 
  post, 
  username = "yourprofile",
  profileImage
}: SocialPostPreviewProps) {
  const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${username}&backgroundColor=6366f1`;
  const avatarUrl = profileImage || defaultAvatar;
  
  const mediaUrl = post.mediaItems?.[0]?.url || post.mediaUrl;
  const mediaType = post.mediaItems?.[0]?.type || post.mediaType;
  
  if (platform === 'instagram') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900" data-testid="preview-instagram">
        <div className="flex items-center gap-3 p-3 border-b">
          <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-full object-cover" />
          <span className="font-semibold text-sm">{username}</span>
        </div>
        <div className="aspect-square bg-muted">
          {mediaUrl ? (
            mediaType?.startsWith('video') ? (
              <video src={mediaUrl} className="w-full h-full object-cover" controls playsInline />
            ) : (
              <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <ImageIcon className="w-12 h-12 opacity-30" />
            </div>
          )}
        </div>
        <div className="p-3">
          <div className="flex items-center gap-4 mb-2">
            <Heart className="w-6 h-6" />
            <MessageSquare className="w-6 h-6" />
            <Send className="w-6 h-6" />
            <Bookmark className="w-6 h-6 ml-auto" />
          </div>
          <p className="text-sm">
            <span className="font-semibold">{username}</span>{' '}
            <span className="whitespace-pre-wrap">{post.caption?.substring(0, 100)}{(post.caption?.length || 0) > 100 ? '...' : ''}</span>
          </p>
          {post.hashtags && post.hashtags.length > 0 && (
            <p className="text-sm text-primary mt-1">
              {post.hashtags.slice(0, 5).map(tag => `#${tag.replace(/^#/, '')}`).join(' ')}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (platform === 'x') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 p-4" data-testid="preview-x">
        <div className="flex gap-3">
          <img src={avatarUrl} alt={username} className="w-10 h-10 rounded-full object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm">{username}</span>
              <span className="text-muted-foreground text-sm">@{username}</span>
              <span className="text-muted-foreground text-sm">· 1m</span>
            </div>
            <p className="text-sm whitespace-pre-wrap mt-1">{post.caption?.substring(0, 280)}</p>
            {mediaUrl && (
              <div className="mt-3 rounded-xl overflow-hidden border">
                {mediaType?.startsWith('video') ? (
                  <video src={mediaUrl} className="w-full max-h-64 object-cover" controls playsInline />
                ) : (
                  <img src={mediaUrl} alt="" className="w-full max-h-64 object-cover" />
                )}
              </div>
            )}
            <div className="flex items-center justify-between mt-3 text-muted-foreground">
              <div className="flex items-center gap-1"><MessageSquare className="w-4 h-4" /><span className="text-xs">0</span></div>
              <div className="flex items-center gap-1"><Repeat2 className="w-4 h-4" /><span className="text-xs">0</span></div>
              <div className="flex items-center gap-1"><Heart className="w-4 h-4" /><span className="text-xs">0</span></div>
              <div className="flex items-center gap-1"><BarChart2 className="w-4 h-4" /><span className="text-xs">0</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (platform === 'facebook') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900" data-testid="preview-facebook">
        <div className="p-3 flex items-center gap-3">
          <img src={avatarUrl} alt={username} className="w-10 h-10 rounded-full object-cover" />
          <div>
            <p className="font-semibold text-sm">{username}</p>
            <p className="text-xs text-muted-foreground">Just now · Public</p>
          </div>
        </div>
        <div className="px-3 pb-2">
          <p className="text-sm whitespace-pre-wrap">{post.caption?.substring(0, 200)}{(post.caption?.length || 0) > 200 ? '...' : ''}</p>
        </div>
        {mediaUrl && (
          <div className="bg-muted">
            {mediaType?.startsWith('video') ? (
              <video src={mediaUrl} className="w-full max-h-80 object-cover" controls playsInline />
            ) : (
              <img src={mediaUrl} alt="" className="w-full max-h-80 object-cover" />
            )}
          </div>
        )}
        <div className="flex items-center justify-around p-2 border-t text-muted-foreground">
          <Button variant="ghost" size="sm" className="flex-1 gap-2"><ThumbsUp className="w-4 h-4" />Like</Button>
          <Button variant="ghost" size="sm" className="flex-1 gap-2"><MessageSquare className="w-4 h-4" />Comment</Button>
          <Button variant="ghost" size="sm" className="flex-1 gap-2"><Share2 className="w-4 h-4" />Share</Button>
        </div>
      </div>
    );
  }

  if (platform === 'linkedin') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900" data-testid="preview-linkedin">
        <div className="p-3 flex items-center gap-3">
          <img src={avatarUrl} alt={username} className="w-12 h-12 rounded-full object-cover" />
          <div>
            <p className="font-semibold text-sm">{username}</p>
            <p className="text-xs text-muted-foreground">Your Headline</p>
            <p className="text-xs text-muted-foreground">Just now · Public</p>
          </div>
        </div>
        <div className="px-3 pb-3">
          <p className="text-sm whitespace-pre-wrap">{post.caption?.substring(0, 200)}{(post.caption?.length || 0) > 200 ? '... see more' : ''}</p>
        </div>
        {mediaUrl && (
          <div className="bg-muted">
            {mediaType?.startsWith('video') ? (
              <video src={mediaUrl} className="w-full max-h-80 object-cover" controls playsInline />
            ) : (
              <img src={mediaUrl} alt="" className="w-full max-h-80 object-cover" />
            )}
          </div>
        )}
        <div className="flex items-center justify-around p-2 border-t text-muted-foreground">
          <Button variant="ghost" size="sm" className="flex-1 gap-1"><ThumbsUp className="w-4 h-4" />Like</Button>
          <Button variant="ghost" size="sm" className="flex-1 gap-1"><MessageSquare className="w-4 h-4" />Comment</Button>
          <Button variant="ghost" size="sm" className="flex-1 gap-1"><Repeat2 className="w-4 h-4" />Repost</Button>
          <Button variant="ghost" size="sm" className="flex-1 gap-1"><Send className="w-4 h-4" />Send</Button>
        </div>
      </div>
    );
  }

  if (platform === 'tiktok') {
    return (
      <div className="border rounded-lg overflow-hidden bg-black text-white aspect-[9/16] max-h-[400px] relative" data-testid="preview-tiktok">
        {mediaUrl && (
          mediaType?.startsWith('video') ? (
            <video src={mediaUrl} className="w-full h-full object-cover" controls playsInline />
          ) : (
            <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
          )
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-full object-cover" />
            <span className="font-semibold text-sm">@{username}</span>
          </div>
          <p className="text-sm line-clamp-3">{post.caption}</p>
        </div>
        <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4">
          <div className="text-center"><Heart className="w-7 h-7" /><span className="text-xs">0</span></div>
          <div className="text-center"><MessageSquare className="w-7 h-7" /><span className="text-xs">0</span></div>
          <div className="text-center"><Share2 className="w-7 h-7" /><span className="text-xs">0</span></div>
        </div>
      </div>
    );
  }

  if (platform === 'youtube') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900" data-testid="preview-youtube">
        <div className="aspect-video bg-muted relative">
          {mediaUrl ? (
            mediaType?.startsWith('video') ? (
              <video src={mediaUrl} className="w-full h-full object-cover" controls playsInline />
            ) : (
              <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <SiYoutube className="w-16 h-16 opacity-30" />
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="font-semibold text-sm line-clamp-2">{post.caption?.substring(0, 100)}</p>
          <div className="flex items-center gap-2 mt-2">
            <img src={avatarUrl} alt={username} className="w-6 h-6 rounded-full object-cover" />
            <span className="text-xs text-muted-foreground">{username}</span>
            <span className="text-xs text-muted-foreground">· 0 views · Just now</span>
          </div>
        </div>
      </div>
    );
  }

  if (platform === 'pinterest') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 max-w-[250px]" data-testid="preview-pinterest">
        <div className="aspect-[2/3] bg-muted relative">
          {mediaUrl ? (
            <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <SiPinterest className="w-12 h-12 opacity-30" />
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="text-sm font-semibold line-clamp-2">{post.caption?.substring(0, 60)}</p>
          <div className="flex items-center gap-2 mt-2">
            <img src={avatarUrl} alt={username} className="w-6 h-6 rounded-full object-cover" />
            <span className="text-xs text-muted-foreground">{username}</span>
          </div>
        </div>
      </div>
    );
  }

  if (platform === 'threads') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 p-4" data-testid="preview-threads">
        <div className="flex gap-3">
          <img src={avatarUrl} alt={username} className="w-10 h-10 rounded-full object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm">{username}</span>
              <span className="text-muted-foreground text-sm">· 1m</span>
            </div>
            <p className="text-sm whitespace-pre-wrap mt-1">{post.caption?.substring(0, 500)}</p>
            {mediaUrl && (
              <div className="mt-3 rounded-xl overflow-hidden border">
                {mediaType?.startsWith('video') ? (
                  <video src={mediaUrl} className="w-full max-h-64 object-cover" controls playsInline />
                ) : (
                  <img src={mediaUrl} alt="" className="w-full max-h-64 object-cover" />
                )}
              </div>
            )}
            <div className="flex items-center gap-6 mt-3 text-muted-foreground">
              <Heart className="w-5 h-5" />
              <MessageSquare className="w-5 h-5" />
              <Repeat2 className="w-5 h-5" />
              <Send className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (platform === 'bluesky') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 p-4" data-testid="preview-bluesky">
        <div className="flex gap-3">
          <img src={avatarUrl} alt={username} className="w-10 h-10 rounded-full object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm">{username}</span>
              <span className="text-muted-foreground text-sm">@{username}.bsky.social</span>
              <span className="text-muted-foreground text-sm">· 1m</span>
            </div>
            <p className="text-sm whitespace-pre-wrap mt-1">{post.caption?.substring(0, 300)}</p>
            {mediaUrl && (
              <div className="mt-3 rounded-xl overflow-hidden border">
                {mediaType?.startsWith('video') ? (
                  <video src={mediaUrl} className="w-full max-h-64 object-cover" controls playsInline />
                ) : (
                  <img src={mediaUrl} alt="" className="w-full max-h-64 object-cover" />
                )}
              </div>
            )}
            <div className="flex items-center gap-6 mt-3 text-muted-foreground">
              <MessageSquare className="w-5 h-5" />
              <Repeat2 className="w-5 h-5" />
              <Heart className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 p-4" data-testid={`preview-${platform}`}>
      <div className="flex items-center gap-3 mb-3">
        <img src={avatarUrl} alt={username} className="w-10 h-10 rounded-full object-cover" />
        <div>
          <p className="font-semibold text-sm capitalize">{platform}</p>
          <p className="text-xs text-muted-foreground">@{username}</p>
        </div>
      </div>
      {mediaUrl && (
        <div className="rounded-lg overflow-hidden mb-3">
          {mediaType?.startsWith('video') ? (
            <video src={mediaUrl} className="w-full max-h-64 object-cover" controls playsInline />
          ) : (
            <img src={mediaUrl} alt="" className="w-full max-h-64 object-cover" />
          )}
        </div>
      )}
      <p className="text-sm whitespace-pre-wrap">{post.caption}</p>
      {post.hashtags && post.hashtags.length > 0 && (
        <p className="text-sm text-primary mt-2">
          {post.hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ')}
        </p>
      )}
    </div>
  );
}
