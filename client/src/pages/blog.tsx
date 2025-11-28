import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  Calendar, 
  User, 
  ChevronLeft, 
  ChevronRight,
  BookOpen,
  FileText,
  Sparkles,
  Megaphone,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  publishedDate: string;
  tags: string[];
  featuredImageUrl: string;
  category: string;
}

interface BlogResponse {
  posts: BlogPost[];
  page: number;
  totalPages: number;
  total: number;
}

const categories = [
  { id: "all", label: "All Posts", icon: FileText },
  { id: "Tutorial", label: "Tutorial", icon: BookOpen },
  { id: "Case Study", label: "Case Study", icon: Sparkles },
  { id: "Feature", label: "Feature", icon: Sparkles },
  { id: "Announcement", label: "Announcement", icon: Megaphone },
];

function BlogPostCard({ post }: { post: BlogPost }) {
  const formattedDate = post.publishedDate 
    ? format(new Date(post.publishedDate), "MMM d, yyyy")
    : "";

  return (
    <Card 
      className="group overflow-hidden hover-elevate transition-all duration-200"
      data-testid={`card-blog-post-${post.id}`}
    >
      <div className="aspect-video overflow-hidden bg-muted">
        {post.featuredImageUrl ? (
          <img
            src={post.featuredImageUrl}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            data-testid={`img-blog-post-${post.id}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-purple-500/10">
            <FileText className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 mb-2">
          <Badge 
            variant="secondary" 
            className="text-xs"
            data-testid={`badge-category-${post.id}`}
          >
            {post.category}
          </Badge>
        </div>
        <Link href={`/blog/${post.slug}`}>
          <h3 
            className="text-lg font-semibold line-clamp-2 hover:text-primary transition-colors cursor-pointer"
            data-testid={`text-title-${post.id}`}
          >
            {post.title}
          </h3>
        </Link>
      </CardHeader>
      <CardContent className="pb-3">
        <p 
          className="text-sm text-muted-foreground line-clamp-3"
          data-testid={`text-excerpt-${post.id}`}
        >
          {post.excerpt}
        </p>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 pt-3 border-t text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span data-testid={`text-author-${post.id}`}>{post.author}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span data-testid={`text-date-${post.id}`}>{formattedDate}</span>
          </div>
        </div>
        <Link href={`/blog/${post.slug}`}>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1 text-primary"
            data-testid={`button-read-more-${post.id}`}
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
    <Card className="overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-20 mb-2" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4 mt-1" />
      </CardHeader>
      <CardContent className="pb-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-2/3 mt-2" />
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 pt-3 border-t">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-8 w-16" />
      </CardFooter>
    </Card>
  );
}

export default function Blog() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialCategory = searchParams.get("category") || "all";
  const initialSearch = searchParams.get("q") || "";
  
  const [page, setPage] = useState(initialPage);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

  useEffect(() => {
    document.title = "Blog - AI Content Creation Tips & Tutorials | Artivio AI";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Stay updated with AI content creation tips, tutorials, case studies, and announcements. Learn how to create stunning videos, images, and music with AI.");
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = "Stay updated with AI content creation tips, tutorials, case studies, and announcements. Learn how to create stunning videos, images, and music with AI.";
      document.head.appendChild(meta);
    }
  }, []);

  const updateUrl = useCallback((newPage: number, newCategory: string, newSearch: string) => {
    const params = new URLSearchParams();
    if (newPage > 1) params.set("page", newPage.toString());
    if (newCategory !== "all") params.set("category", newCategory);
    if (newSearch) params.set("q", newSearch);
    
    const queryString = params.toString();
    setLocation(`/blog${queryString ? `?${queryString}` : ""}`, { replace: true });
  }, [setLocation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (searchQuery !== debouncedSearch) {
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    updateUrl(page, selectedCategory, debouncedSearch);
  }, [page, selectedCategory, debouncedSearch, updateUrl]);

  const buildQueryKey = () => {
    if (debouncedSearch) {
      return `/api/blog/search?q=${encodeURIComponent(debouncedSearch)}&page=${page}`;
    }
    
    let url = `/api/blog/posts?page=${page}&sort=latest`;
    if (selectedCategory !== "all") {
      url += `&category=${encodeURIComponent(selectedCategory)}`;
    }
    return url;
  };

  const { data, isLoading, error } = useQuery<BlogResponse>({
    queryKey: [buildQueryKey()],
  });

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const renderPagination = () => {
    if (!data || data.totalPages <= 1) return null;

    const pages: (number | string)[] = [];
    const totalPages = data.totalPages;
    const currentPage = data.page;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }

    return (
      <div className="flex items-center justify-center gap-2 mt-12" data-testid="pagination-controls">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
          data-testid="button-prev-page"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <div className="hidden sm:flex items-center gap-1">
          {pages.map((pageItem, idx) => 
            pageItem === "..." ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">...</span>
            ) : (
              <Button
                key={pageItem}
                variant={currentPage === pageItem ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(pageItem as number)}
                data-testid={`button-page-${pageItem}`}
              >
                {pageItem}
              </Button>
            )
          )}
        </div>
        
        <span className="sm:hidden text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange(currentPage + 1)}
          data-testid="button-next-page"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-purple-500/10 border-b">
        <div className="absolute inset-0 bg-grid-white/5 bg-[size:20px_20px]" style={{ maskImage: 'linear-gradient(to bottom, transparent, black, transparent)' }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Artivio Blog</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Blog
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stay updated with AI content creation tips, tutorials, and announcements
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          
          <div className="flex flex-wrap gap-2" data-testid="category-filters">
            {categories.map((category) => {
              const Icon = category.icon;
              const isActive = selectedCategory === category.id;
              return (
                <Button
                  key={category.id}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleCategoryChange(category.id)}
                  className="gap-1.5"
                  data-testid={`button-category-${category.id}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {category.label}
                </Button>
              );
            })}
          </div>
        </div>

        {error ? (
          <div className="text-center py-16" data-testid="error-state">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
              <FileText className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Unable to Load Posts</h2>
            <p className="text-muted-foreground mb-4">
              There was an error loading blog posts. Please try again.
            </p>
            <Button onClick={() => window.location.reload()} data-testid="button-retry">
              Try Again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="loading-state">
            {Array.from({ length: 6 }).map((_, idx) => (
              <BlogPostSkeleton key={idx} />
            ))}
          </div>
        ) : data?.posts && data.posts.length > 0 ? (
          <>
            <div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              data-testid="blog-posts-grid"
            >
              {data.posts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>
            
            {renderPagination()}
            
            {data.total > 0 && (
              <p className="text-center text-sm text-muted-foreground mt-6" data-testid="text-total-posts">
                Showing {data.posts.length} of {data.total} posts
              </p>
            )}
          </>
        ) : (
          <div className="text-center py-16" data-testid="empty-state">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Posts Found</h2>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? `No posts matching "${searchQuery}". Try a different search term.`
                : selectedCategory !== "all"
                  ? `No posts in the ${selectedCategory} category yet.`
                  : "No blog posts available at the moment."}
            </p>
            {(searchQuery || selectedCategory !== "all") && (
              <Button 
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setPage(1);
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
