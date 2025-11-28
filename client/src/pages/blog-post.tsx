import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Eye,
  FileText,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";

interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featuredImageUrl: string;
  publishedDate: string;
}

interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author: string;
  publishedDate: string;
  tags: string[];
  featuredImageUrl: string;
  category: string;
  metaDescription: string;
  viewCount: number;
  relatedPosts: RelatedPost[];
}

function RelatedPostCard({ post }: { post: RelatedPost }) {
  const formattedDate = post.publishedDate 
    ? format(new Date(post.publishedDate), "MMM d, yyyy")
    : "";

  return (
    <Card 
      className="group overflow-hidden hover-elevate transition-all duration-200"
      data-testid={`card-related-post-${post.id}`}
    >
      <div className="aspect-video overflow-hidden bg-muted">
        {post.featuredImageUrl ? (
          <img
            src={post.featuredImageUrl}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            data-testid={`img-related-post-${post.id}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-purple-500/10">
            <FileText className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>
      <CardHeader className="pb-2">
        <Link href={`/blog/${post.slug}`}>
          <h3 
            className="text-lg font-semibold line-clamp-2 hover:text-primary transition-colors cursor-pointer"
            data-testid={`text-related-title-${post.id}`}
          >
            {post.title}
          </h3>
        </Link>
      </CardHeader>
      <CardContent className="pb-3">
        <p 
          className="text-sm text-muted-foreground line-clamp-2"
          data-testid={`text-related-excerpt-${post.id}`}
        >
          {post.excerpt}
        </p>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 pt-3 border-t text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          <span data-testid={`text-related-date-${post.id}`}>{formattedDate}</span>
        </div>
        <Link href={`/blog/${post.slug}`}>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1 text-primary"
            data-testid={`button-read-related-${post.id}`}
          >
            Read
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function BlogPostSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-6 w-32 mb-8" />
        <Skeleton className="aspect-video w-full rounded-lg mb-8" />
        <div className="space-y-4 mb-8">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-10 w-1/2" />
          <div className="flex gap-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md mx-4" data-testid="blog-post-not-found">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold" data-testid="text-not-found-title">Post Not Found</h1>
          
          <p className="text-muted-foreground" data-testid="text-not-found-message">
            The blog post you're looking for doesn't exist or may have been removed.
          </p>

          <div className="pt-4">
            <Button asChild data-testid="button-back-to-blog">
              <Link href="/blog">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Blog
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading, error } = useQuery<BlogPostData>({
    queryKey: ['/api/blog/posts', slug],
    enabled: !!slug,
  });

  useEffect(() => {
    if (post) {
      document.title = `${post.title} | Artivio AI Blog`;
      
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute("content", post.metaDescription || post.excerpt);
      } else {
        const meta = document.createElement("meta");
        meta.name = "description";
        meta.content = post.metaDescription || post.excerpt;
        document.head.appendChild(meta);
      }

      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute("content", post.title);
      } else {
        const meta = document.createElement("meta");
        meta.setAttribute("property", "og:title");
        meta.content = post.title;
        document.head.appendChild(meta);
      }

      const ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) {
        ogDescription.setAttribute("content", post.metaDescription || post.excerpt);
      } else {
        const meta = document.createElement("meta");
        meta.setAttribute("property", "og:description");
        meta.content = post.metaDescription || post.excerpt;
        document.head.appendChild(meta);
      }

      if (post.featuredImageUrl) {
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) {
          ogImage.setAttribute("content", post.featuredImageUrl);
        } else {
          const meta = document.createElement("meta");
          meta.setAttribute("property", "og:image");
          meta.content = post.featuredImageUrl;
          document.head.appendChild(meta);
        }
      }
    }
  }, [post]);

  if (isLoading) {
    return <BlogPostSkeleton />;
  }

  if (error || !post) {
    return <NotFoundState />;
  }

  const formattedDate = post.publishedDate 
    ? format(new Date(post.publishedDate), "MMMM d, yyyy")
    : "";

  return (
    <div className="min-h-screen bg-background" data-testid="blog-post-page">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Link href="/blog">
          <Button 
            variant="ghost" 
            className="mb-6 gap-2 -ml-2"
            data-testid="link-back-to-blog"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Button>
        </Link>

        {post.featuredImageUrl && (
          <div className="aspect-video overflow-hidden rounded-lg bg-muted mb-8">
            <img
              src={post.featuredImageUrl}
              alt={post.title}
              className="w-full h-full object-cover"
              data-testid="img-featured"
            />
          </div>
        )}

        <header className="mb-8 sm:mb-12">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge 
              variant="secondary"
              data-testid="badge-category"
            >
              {post.category}
            </Badge>
            {post.tags && post.tags.length > 0 && post.tags.slice(0, 3).map((tag, index) => (
              <Badge 
                key={index} 
                variant="outline"
                data-testid={`badge-tag-${index}`}
              >
                {tag}
              </Badge>
            ))}
          </div>

          <h1 
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6"
            data-testid="text-post-title"
          >
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm sm:text-base text-muted-foreground">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span data-testid="text-post-author">{post.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <time 
                dateTime={post.publishedDate}
                data-testid="text-post-date"
              >
                {formattedDate}
              </time>
            </div>
            {post.viewCount > 0 && (
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span data-testid="text-view-count">
                  {post.viewCount.toLocaleString()} views
                </span>
              </div>
            )}
          </div>
        </header>

        <div 
          className="prose dark:prose-invert prose-lg max-w-none
            prose-headings:font-semibold prose-headings:tracking-tight
            prose-h1:text-3xl prose-h1:mt-12 prose-h1:mb-6
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4
            prose-p:leading-relaxed prose-p:my-4
            prose-ul:my-4 prose-ol:my-4 prose-li:my-1
            prose-strong:font-semibold
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r prose-blockquote:italic
            prose-img:rounded-lg prose-img:shadow-md
            prose-hr:my-8"
          data-testid="blog-post-content"
        >
          <ReactMarkdown
            rehypePlugins={[rehypeRaw]}
            components={{
              code: ({ node, inline, className, children, ...props }: any) => {
                const codeContent = String(children).replace(/\n$/, '');
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';
                
                if (inline) {
                  return (
                    <code 
                      className="bg-muted px-1.5 py-0.5 rounded text-[14px] font-mono text-foreground" 
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }
                
                return (
                  <div className="relative my-6 rounded-lg overflow-hidden border border-border/50">
                    {language && (
                      <div className="bg-muted/80 px-4 py-2 border-b border-border/50">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          {language}
                        </span>
                      </div>
                    )}
                    <pre className="bg-[#1e1e1e] dark:bg-[#0d0d0d] p-4 overflow-x-auto">
                      <code className="text-sm font-mono leading-relaxed text-gray-200" {...props}>
                        {children}
                      </code>
                    </pre>
                  </div>
                );
              },
              img: ({ src, alt }) => (
                <img 
                  src={src} 
                  alt={alt || ""} 
                  className="rounded-lg shadow-md w-full" 
                  loading="lazy"
                />
              ),
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="mt-12 pt-8 border-t" data-testid="tags-section">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag, index) => (
                <Badge 
                  key={index} 
                  variant="outline"
                  data-testid={`badge-footer-tag-${index}`}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </article>

      {post.relatedPosts && post.relatedPosts.length > 0 && (
        <section 
          className="border-t bg-muted/20 py-12 sm:py-16"
          data-testid="related-posts-section"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-8" data-testid="text-related-heading">
              Related Posts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {post.relatedPosts.map((relatedPost) => (
                <RelatedPostCard key={relatedPost.id} post={relatedPost} />
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 border-t">
        <Link href="/blog">
          <Button 
            variant="outline" 
            className="gap-2"
            data-testid="link-back-to-blog-bottom"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Button>
        </Link>
      </div>
    </div>
  );
}
