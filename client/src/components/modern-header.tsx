import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { 
  Menu, 
  X, 
  User, 
  CreditCard, 
  LogOut, 
  Home,
  Shield,
  Video,
  Image as ImageIcon,
  Music,
  MessageSquare,
  Mic,
  Headphones,
  ScanEye,
  UserCircle,
  AudioWaveform,
  Scissors,
  History as HistoryIcon,
  Sparkles,
  Mic2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CreditDisplay } from "@/components/credit-display";

export function ModernHeader() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = (user as any)?.isAdmin;

  const featureCategories = [
    {
      label: "Video Tools",
      features: [
        { label: "Video Generation", href: "/generate/video", icon: Video },
        { label: "Talking Avatars", href: "/talking-avatars", icon: UserCircle },
      ]
    },
    {
      label: "Image Tools",
      features: [
        { label: "Image Generation", href: "/generate/image", icon: ImageIcon },
        { label: "Image Analysis", href: "/analyze-image", icon: ScanEye },
      ]
    },
    {
      label: "Audio & Music",
      features: [
        { label: "Music Generation", href: "/generate/music", icon: Music },
        { label: "Voice Cloning", href: "/voice-clone", icon: Mic },
        { label: "Text to Speech", href: "/text-to-speech", icon: Headphones },
        { label: "Speech to Text", href: "/speech-to-text", icon: Mic2 },
        { label: "Audio Converter", href: "/audio-converter", icon: AudioWaveform },
      ]
    },
    {
      label: "AI & Utilities",
      features: [
        { label: "AI Chat", href: "/chat", icon: MessageSquare },
        { label: "Video Editor", href: "/video-editor", icon: Scissors },
        { label: "History", href: "/history", icon: HistoryIcon },
        { label: "Workflows", href: "/workflows", icon: Sparkles },
      ]
    }
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex h-12 items-center justify-between">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-1.5 cursor-pointer group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-purple-500 rounded-md blur-sm group-hover:blur-md transition-all" />
                <div className="relative bg-gradient-to-r from-primary to-purple-500 p-1.5 rounded-md">
                  <span className="text-white font-bold text-base">A</span>
                </div>
              </div>
              <span className="font-bold text-base bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Artivio AI
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <Link href="/">
              <Button
                variant={location === "/" ? "default" : "ghost"}
                size="sm"
                className="gap-2"
                data-testid="nav-home"
              >
                <Home className="h-4 w-4" />
                Home
              </Button>
            </Link>
            
            {/* Features Dropdown - only show for authenticated users */}
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2" data-testid="nav-features">
                    <Sparkles className="h-4 w-4" />
                    Features
                    <span className="ml-1 text-xs">▼</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {featureCategories.map((category, idx) => (
                    <div key={category.label}>
                      {idx > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel>{category.label}</DropdownMenuLabel>
                      {category.features.map((feature) => (
                        <DropdownMenuItem key={feature.href} asChild>
                          <Link href={feature.href} className="cursor-pointer flex items-center gap-2">
                            <feature.icon className="h-4 w-4" />
                            <span>{feature.label}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Pricing link for unauthenticated users */}
            {!isAuthenticated && (
              <Link href="/pricing">
                <Button
                  variant={location === "/pricing" ? "default" : "ghost"}
                  size="sm"
                  data-testid="nav-pricing"
                >
                  Pricing
                </Button>
              </Link>
            )}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Credits Display - authenticated only */}
            {isAuthenticated && (
              <div className="hidden sm:block">
                <CreditDisplay />
              </div>
            )}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Login Button - unauthenticated only */}
            {!isAuthenticated && (
              <Button asChild size="sm" data-testid="nav-login">
                <a href="/api/login">Log in</a>
              </Button>
            )}

            {/* User Menu - authenticated only */}
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full" data-testid="button-user-menu">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="text-sm font-medium leading-none">
                      {(user as any)?.firstName && (user as any)?.lastName 
                        ? `${(user as any).firstName} ${(user as any).lastName}`
                        : (user as any)?.email || 'User'}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/billing" className="cursor-pointer">
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>Billing</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/support" className="cursor-pointer">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      <span>Support</span>
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer">
                          <Shield className="mr-2 h-4 w-4" />
                          <span>Admin Panel</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/api/logout" className="cursor-pointer text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right" className="w-[300px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 mt-8">
            {/* Authenticated users - show credits, features, profile, etc */}
            {isAuthenticated && (
              <>
                {/* Credits */}
                <div className="flex justify-center">
                  <CreditDisplay />
                </div>

                {/* Home */}
                <Link href="/">
                  <Button
                    variant={location === "/" ? "default" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-nav-home"
                  >
                    <Home className="h-5 w-5" />
                    Home
                  </Button>
                </Link>

                {/* Features by Category */}
                {featureCategories.map((category) => (
                  <div key={category.label} className="space-y-1">
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                      {category.label}
                    </div>
                    {category.features.map((feature) => (
                      <Link key={feature.href} href={feature.href}>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-3"
                          onClick={() => setMobileMenuOpen(false)}
                          data-testid={`mobile-nav-${feature.label.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <feature.icon className="h-5 w-5" />
                          {feature.label}
                        </Button>
                      </Link>
                    ))}
                  </div>
                ))}

                <div className="border-t pt-4 space-y-2">
                  <Link href="/profile">
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3"
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid="mobile-nav-profile"
                    >
                      <User className="h-5 w-5" />
                      Profile
                    </Button>
                  </Link>
                  <Link href="/billing">
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3"
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid="mobile-nav-billing"
                    >
                      <CreditCard className="h-5 w-5" />
                      Billing
                    </Button>
                  </Link>
                  {isAdmin && (
                    <Link href="/admin">
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3"
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid="mobile-nav-admin"
                      >
                        <Shield className="h-5 w-5" />
                        Admin Panel
                      </Button>
                    </Link>
                  )}
                </div>

                <div className="border-t pt-4">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-destructive hover:text-destructive"
                    asChild
                    data-testid="mobile-nav-logout"
                  >
                    <a href="/api/logout">
                      <LogOut className="h-5 w-5" />
                      Log out
                    </a>
                  </Button>
                </div>
              </>
            )}

            {/* Unauthenticated users - show home, pricing, login */}
            {!isAuthenticated && (
              <>
                <Link href="/">
                  <Button
                    variant={location === "/" ? "default" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-nav-home"
                  >
                    <Home className="h-5 w-5" />
                    Home
                  </Button>
                </Link>

                <Link href="/pricing">
                  <Button
                    variant={location === "/pricing" ? "default" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-nav-pricing"
                  >
                    <CreditCard className="h-5 w-5" />
                    Pricing
                  </Button>
                </Link>

                <div className="border-t pt-4">
                  <Button
                    variant="default"
                    className="w-full justify-start gap-3"
                    asChild
                    data-testid="mobile-nav-login"
                  >
                    <a href="/api/login">
                      <LogOut className="h-5 w-5" />
                      Log in
                    </a>
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
