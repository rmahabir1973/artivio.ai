import { Sparkles } from "lucide-react";
import { Link } from "wouter";

export function Footer() {
  const categories = [
    {
      title: "AI Video",
      links: [
        { label: "Video Generation", href: "/generate/video" },
        { label: "Video Editor", href: "/video-editor" },
        { label: "Sora 2 Pro", href: "/generate/sora" },
        { label: "Talking Avatars", href: "/talking-avatars" },
      ]
    },
    {
      title: "AI Image",
      links: [
        { label: "Image Generation", href: "/generate/image" },
        { label: "Image Analysis", href: "/analyze-image" },
        { label: "Background Remover", href: "/background-remover" },
        { label: "Upscaler", href: "/topaz-upscaler" },
      ]
    },
    {
      title: "Audio & Music",
      links: [
        { label: "Music Generation", href: "/generate/music" },
        { label: "Voice Cloning", href: "/voice-clone" },
        { label: "Text to Speech", href: "/text-to-speech" },
        { label: "Sound Effects", href: "/sound-effects" },
        { label: "Speech to Text", href: "/speech-to-text" },
        { label: "Audio Converter", href: "/audio-converter" },
      ]
    },
    {
      title: "Tools",
      links: [
        { label: "AI Chat", href: "/chat" },
        { label: "QR Generator", href: "/qr-generator" },
        { label: "Video Upscaler", href: "/topaz-video-upscaler" },
        { label: "Lip Sync", href: "/lip-sync" },
      ]
    },
    {
      title: "Company",
      links: [
        { label: "Blog", href: "/blog" },
        { label: "Pricing", href: "/pricing" },
        { label: "Affiliates", href: "/affiliates" },
        { label: "Support", href: "/support" },
        { label: "Contact", href: "/contact" },
      ]
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ]
    },
  ];

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Top Section with Logo and Description */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-8 md:gap-6 mb-12">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-gradient-to-br from-purple-500 to-blue-600 p-2 rounded-lg flex-shrink-0">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">Artivio AI</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The complete AI platform for creating stunning videos, images, music, and more. Bring your creative vision to life with cutting-edge AI technology.
            </p>
          </div>

          {/* Features Grid */}
          {categories.map((category) => (
            <div key={category.title}>
              <h3 className="text-sm font-semibold mb-4 text-foreground">{category.title}</h3>
              <ul className="space-y-2.5">
                {category.links.map((link) => (
                  <li key={link.href}>
                    <Link 
                      href={link.href} 
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 hover:translate-x-0.5 inline-block"
                      data-testid={`footer-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-border my-8" />

        {/* Bottom Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Artivio AI. All rights reserved.
          </p>
          
          {/* Social Links */}
          <div className="flex items-center gap-6">
            <a 
              href="https://twitter.com/artivioai" 
              className="text-muted-foreground hover:text-foreground transition-colors duration-200 hover:scale-110 inline-block"
              data-testid="social-twitter" 
              aria-label="Twitter"
              target="_blank"
              rel="noopener noreferrer"
              title="Twitter"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/>
              </svg>
            </a>
            <a 
              href="https://github.com/artivioai" 
              className="text-muted-foreground hover:text-foreground transition-colors duration-200 hover:scale-110 inline-block"
              data-testid="social-github" 
              aria-label="GitHub"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            <a 
              href="https://linkedin.com/company/artivioai" 
              className="text-muted-foreground hover:text-foreground transition-colors duration-200 hover:scale-110 inline-block"
              data-testid="social-linkedin" 
              aria-label="LinkedIn"
              target="_blank"
              rel="noopener noreferrer"
              title="LinkedIn"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
