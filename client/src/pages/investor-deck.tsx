import { useEffect, useRef, useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, ChevronUp, Video, Scissors, Smartphone, Palette, 
  Check, Target, DollarSign, Clapperboard, Bot, Mic, Volume2, 
  AudioLines, Wand2, ImageUp, Layers, MessageSquare, QrCode, 
  Library, TrendingUp, Users, Building2, Briefcase, Rocket, 
  Calendar, Share2, Megaphone, Handshake, Mail, Globe, Play,
  Clock, Zap, ArrowRight, CheckCircle2, X
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Legend 
} from 'recharts';

const BRAND = {
  primary: '#7C3AED',
  secondary: '#3B82F6',
  accent: '#06B6D4',
  success: '#10B981',
  dark: '#0F172A',
  light: '#F8FAFC',
};

const financialData = [
  { users: '100', revenue: 4000, expenses: 11200, margin: -180 },
  { users: '500', revenue: 16500, expenses: 14000, margin: 15 },
  { users: '1K', revenue: 40000, expenses: 22700, margin: 43 },
  { users: '5K', revenue: 200000, expenses: 76500, margin: 62 },
  { users: '10K', revenue: 420000, expenses: 133000, margin: 68 },
  { users: '50K', revenue: 2200000, expenses: 585000, margin: 73 },
  { users: '100K', revenue: 4500000, expenses: 1120000, margin: 75 },
];

const milestonesData = [
  { milestone: '600 users', metric: 'Break-even', value: '~$30k MRR' },
  { milestone: '1,700 users', metric: '$1M ARR', value: '$83k MRR' },
  { milestone: '18,500 users', metric: '$10M ARR', value: '$833k MRR' },
];

function SlideProgress({ currentSlide, totalSlides }: { currentSlide: number; totalSlides: number }) {
  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 hidden md:flex">
      {Array.from({ length: totalSlides }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-all duration-300 ${
            i === currentSlide 
              ? 'bg-white scale-150 shadow-lg' 
              : 'bg-white/40 hover:bg-white/60'
          }`}
        />
      ))}
      <div className="mt-2 text-white/60 text-xs text-center">
        {currentSlide + 1}/{totalSlides}
      </div>
    </div>
  );
}

interface SlideWrapperProps {
  children: React.ReactNode;
  gradient?: boolean;
  dark?: boolean;
  className?: string;
}

interface SlideWrapperWithIndexProps extends SlideWrapperProps {
  slideIndex?: number;
}

const SlideWrapper = forwardRef<HTMLElement, SlideWrapperWithIndexProps>(({ 
  children, 
  gradient = false,
  dark = false,
  className = '',
  slideIndex
}, ref) => {
  return (
    <section 
      ref={ref}
      data-slide-index={slideIndex}
      className={`slide-section min-h-screen w-full snap-start snap-always flex items-center justify-center px-4 md:px-8 lg:px-16 py-12 ${
        gradient 
          ? 'bg-gradient-to-br from-[#7C3AED] via-[#5B21B6] to-[#3B82F6]' 
          : dark 
            ? 'bg-slate-900' 
            : 'bg-slate-50'
      } ${className}`}
    >
      <div className="w-full max-w-7xl mx-auto">
        {children}
      </div>
    </section>
  );
});

function StatCard({ value, label, icon: Icon }: { value: string; label: string; icon?: any }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100"
    >
      {Icon && <Icon className="w-8 h-8 text-[#7C3AED] mb-3" />}
      <div className="text-3xl md:text-4xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="text-slate-600">{label}</div>
    </motion.div>
  );
}

function FeatureCard({ 
  icon: Icon, 
  title, 
  items,
  delay = 0 
}: { 
  icon: any; 
  title: string; 
  items: string[];
  delay?: number;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 hover:shadow-2xl transition-shadow"
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#3B82F6] flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-slate-600 text-sm flex items-start gap-2">
            <Check className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function PricingCard({ 
  name, 
  price, 
  credits, 
  features, 
  highlighted = false,
  goal 
}: { 
  name: string; 
  price: string; 
  credits: string;
  features: string[];
  highlighted?: boolean;
  goal: string;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className={`rounded-2xl p-6 ${
        highlighted 
          ? 'bg-gradient-to-br from-[#7C3AED] to-[#3B82F6] text-white shadow-2xl scale-105' 
          : 'bg-white text-slate-900 shadow-xl border border-slate-100'
      }`}
    >
      <div className="text-lg font-semibold mb-2">{name}</div>
      <div className="text-3xl font-bold mb-1">{price}</div>
      <div className={`text-sm mb-4 ${highlighted ? 'text-white/80' : 'text-slate-500'}`}>
        {credits}
      </div>
      <ul className="space-y-2 mb-4">
        {features.map((f, i) => (
          <li key={i} className={`text-sm flex items-center gap-2 ${highlighted ? 'text-white/90' : 'text-slate-600'}`}>
            <Check className={`w-4 h-4 ${highlighted ? 'text-white' : 'text-[#10B981]'}`} />
            {f}
          </li>
        ))}
      </ul>
      <div className={`text-xs ${highlighted ? 'text-white/70' : 'text-slate-400'}`}>
        {goal}
      </div>
    </motion.div>
  );
}

export default function InvestorDeck() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const totalSlides = 15;

  useEffect(() => {
    document.title = 'Artivio AI - Investor Deck';
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex, nofollow';
    document.head.appendChild(metaRobots);

    return () => {
      document.head.removeChild(metaRobots);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const slides = container.querySelectorAll('.slide-section');
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = parseInt((entry.target as HTMLElement).dataset.slideIndex || '0', 10);
            setCurrentSlide(index);
          }
        });
      },
      {
        root: container,
        threshold: 0.5,
      }
    );

    slides.forEach((slide) => observer.observe(slide));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      
      const slides = containerRef.current.querySelectorAll('.slide-section');
      
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        const nextIndex = Math.min(currentSlide + 1, totalSlides - 1);
        slides[nextIndex]?.scrollIntoView({ behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(currentSlide - 1, 0);
        slides[prevIndex]?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  return (
    <div 
      ref={containerRef}
      className="h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      <SlideProgress currentSlide={currentSlide} totalSlides={totalSlides} />

      {/* SLIDE 1: Cover */}
      <SlideWrapper gradient slideIndex={0}>
        <div className="text-center text-white">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight">
              Artivio AI
            </h1>
            <p className="text-2xl md:text-3xl lg:text-4xl font-light mb-4 text-white/90">
              The Complete AI Content Creation Ecosystem
            </p>
            <p className="text-lg md:text-xl text-white/70 mb-12">
              From Idea → Video → Published. All in One Platform.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="flex flex-col items-center gap-2 text-white/60"
          >
            <span className="text-sm">Scroll to explore</span>
            <ChevronDown className="w-6 h-6 animate-bounce" />
          </motion.div>
        </div>
      </SlideWrapper>

      {/* SLIDE 2: The Problem */}
      <SlideWrapper slideIndex={1}>
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-slate-900 mb-4"
          >
            The Content Creation Bottleneck
          </motion.h2>
          <p className="text-xl text-slate-600">Creators are trapped between quality and quantity</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard value="4-8 hrs" label="Per professional video" icon={Clock} />
          <StatCard value="$2-5K" label="Agency cost per video" icon={DollarSign} />
          <StatCard value="5+" label="Tools needed for one video" icon={Layers} />
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="bg-white rounded-2xl p-8 shadow-xl"
        >
          <h3 className="text-xl font-bold text-slate-900 mb-4">Pain Points</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "Small businesses can't afford consistent video content",
              "Creators spend more time editing than creating",
              "Fragmented tools create workflow friction and errors",
              "Technical barriers prevent talented people from monetizing expertise"
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-3">
                <X className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <span className="text-slate-700">{point}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </SlideWrapper>

      {/* SLIDE 3: The Solution */}
      <SlideWrapper gradient slideIndex={2}>
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Artivio AI: Complete Content Ecosystem
          </motion.h2>
          <p className="text-xl text-white/80">The only platform creators need from concept to publication</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <FeatureCard 
            icon={Video} 
            title="AI Video Generation" 
            items={['Veo 3.1, Runway, Sora 2 Pro', 'Budget to premium models']}
            delay={0.1}
          />
          <FeatureCard 
            icon={Scissors} 
            title="Pro Video Editor" 
            items={['Browser-based CapCut alternative', 'Timeline editing with effects']}
            delay={0.2}
          />
          <FeatureCard 
            icon={Smartphone} 
            title="Social Media Hub" 
            items={['AI-powered Hootsuite alternative', 'Auto-post to 9 platforms']}
            delay={0.3}
          />
          <FeatureCard 
            icon={Palette} 
            title="Brand Builder" 
            items={['Viral content templates', 'Workflow automation']}
            delay={0.4}
          />
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-2xl font-semibold text-white">
            10x faster content creation. One platform. Zero friction.
          </p>
        </motion.div>
      </SlideWrapper>

      {/* SLIDE 4: Five Key Differentiators */}
      <SlideWrapper slideIndex={3}>
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-slate-900 mb-4"
          >
            Not Another AI Video Tool
          </motion.h2>
          <p className="text-xl text-slate-600">What makes Artivio the category leader</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { icon: Check, title: 'Complete Ecosystem', desc: 'Generate, edit, and publish in one platform' },
            { icon: Target, title: 'Viral Templates', desc: 'Brand Builder with proven content formats' },
            { icon: DollarSign, title: 'Budget to Premium', desc: 'Free models to Sora 2 Pro' },
            { icon: Clapperboard, title: 'Custom Editor', desc: 'CapCut-like editor + Mobile Video Joiner' },
            { icon: Bot, title: 'AI Automation', desc: 'Auto-generate 30-day content calendars' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#3B82F6] flex items-center justify-center mx-auto mb-3">
                <item.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
              <p className="text-sm text-slate-600">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </SlideWrapper>

      {/* SLIDE 5: All 21 Tools */}
      <SlideWrapper dark slideIndex={4}>
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            21 Tools. One Platform.
          </motion.h2>
          <p className="text-xl text-white/70">Everything creators need to build their brand</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: 'Core Creation',
              color: 'from-[#7C3AED] to-[#5B21B6]',
              tools: ['Video Generation', 'Image Generation', 'Music Generation', 'Video Editor PRO', 'Video Joiner Express', 'Brand Builder']
            },
            {
              title: 'Voice & Audio',
              color: 'from-[#3B82F6] to-[#1D4ED8]',
              tools: ['Text-to-Speech', 'Voice Cloning', 'Talking Avatars', 'Lip Sync', 'Sound Effects']
            },
            {
              title: 'Enhancement',
              color: 'from-[#06B6D4] to-[#0891B2]',
              tools: ['Image Upscaler', 'Video Upscaler', 'Background Remover', 'Audio Converter', 'Speech-to-Text', 'Video Enhancement']
            },
            {
              title: 'Publishing & More',
              color: 'from-[#10B981] to-[#059669]',
              tools: ['Social Media Hub', 'AI Chat', 'Image Analysis', 'QR Generator', 'My Library']
            }
          ].map((cat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/10 backdrop-blur rounded-2xl p-6"
            >
              <div className={`inline-block px-4 py-2 rounded-full bg-gradient-to-r ${cat.color} text-white text-sm font-semibold mb-4`}>
                {cat.title}
              </div>
              <ul className="space-y-2">
                {cat.tools.map((tool, j) => (
                  <li key={j} className="text-white/80 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                    {tool}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </SlideWrapper>

      {/* SLIDE 6: Competition Comparison */}
      <SlideWrapper slideIndex={5}>
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-slate-900 mb-4"
          >
            Artivio vs. The Competition
          </motion.h2>
          <p className="text-xl text-slate-600">Why creators choose us over fragmented solutions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-red-50 rounded-2xl p-8 border border-red-100"
          >
            <h3 className="text-xl font-bold text-red-800 mb-6 flex items-center gap-2">
              <X className="w-6 h-6" /> Current Solutions
            </h3>
            <ul className="space-y-3">
              {[
                'Runway: Video generation only',
                'CapCut: Video editing only',
                'Hootsuite: Social media only ($99/mo)',
                'Midjourney: Image generation only',
                'Requires 5+ separate subscriptions',
                'Manual workflow between tools',
                "Data doesn't transfer between platforms",
                'Steep learning curve for each tool',
                'Total cost: $200-500/month'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-red-700">
                  <X className="w-4 h-4 mt-1 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-[#7C3AED] to-[#3B82F6] rounded-2xl p-8 text-white"
          >
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Check className="w-6 h-6" /> Artivio AI
            </h3>
            <ul className="space-y-3">
              {[
                'Video generation + editing + publishing',
                'Image generation + enhancement',
                'Music generation + audio tools',
                'Social media automation',
                'One integrated platform',
                'Seamless workflow, all tools connected',
                'Single library for all assets',
                'One interface to master',
                'Total cost: $29-$99/month'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-white/90">
                  <Check className="w-4 h-4 mt-1 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </SlideWrapper>

      {/* SLIDE 7: Market Opportunity */}
      <SlideWrapper gradient slideIndex={6}>
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            The Creator Economy Is Exploding
          </motion.h2>
          <p className="text-xl text-white/80">Multi-billion dollar market with explosive growth</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl p-8 text-center"
          >
            <div className="text-4xl md:text-5xl font-bold text-[#7C3AED] mb-2">$250B</div>
            <div className="text-slate-600">Creator economy by 2026</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-8 text-center"
          >
            <div className="text-4xl md:text-5xl font-bold text-[#3B82F6] mb-2">200M+</div>
            <div className="text-slate-600">Content creators globally</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-8 text-center"
          >
            <div className="text-4xl md:text-5xl font-bold text-[#06B6D4] mb-2">$20B</div>
            <div className="text-slate-600">Video editing software market</div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users, title: 'Solo Creators', desc: 'YouTubers, TikTokers, Influencers', stat: '2M+ in US/Canada' },
            { icon: Building2, title: 'Small Businesses', desc: 'Local businesses needing content', stat: '30M+ globally' },
            { icon: Briefcase, title: 'Marketing Agencies', desc: 'Multi-client content production', stat: '500K+ agencies' },
            { icon: TrendingUp, title: 'Enterprise Brands', desc: 'Large content teams', stat: 'White-label ready' },
          ].map((market, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/10 backdrop-blur rounded-xl p-5"
            >
              <market.icon className="w-8 h-8 text-white mb-3" />
              <h3 className="font-bold text-white mb-1">{market.title}</h3>
              <p className="text-sm text-white/70 mb-2">{market.desc}</p>
              <div className="text-sm font-semibold text-[#10B981]">{market.stat}</div>
            </motion.div>
          ))}
        </div>
      </SlideWrapper>

      {/* SLIDE 8: Google/Gemini/Veo */}
      <SlideWrapper slideIndex={7}>
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-slate-900 mb-4"
          >
            Powered by Google's Cutting-Edge AI
          </motion.h2>
          <p className="text-xl text-slate-600">Early access to Veo and Gemini unlocks unprecedented capabilities</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { 
              icon: Video, 
              title: 'Veo 2 Video Generation',
              items: ['Generate professional B-roll instantly', 'Create complete videos from text', 'Transform to AI-native platform', 'Category-defining advantage']
            },
            { 
              icon: Zap, 
              title: 'Gemini 2.0 Flash',
              items: ['Platform-optimized scripts', 'TikTok, YouTube, Instagram content', 'Analyze trending topics', 'Real-time strategy suggestions']
            },
            { 
              icon: Palette, 
              title: 'Imagen 3',
              items: ['Auto-generate thumbnails', 'Branded graphics with optimal CTR', 'Platform-specific visual assets', 'Consistent brand identity']
            },
          ].map((item, i) => (
            <FeatureCard key={i} icon={item.icon} title={item.title} items={item.items} delay={i * 0.1} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] rounded-2xl p-8 text-white text-center"
        >
          <p className="text-xl md:text-2xl font-semibold mb-2">
            "Early Veo 2 access = category-defining competitive advantage"
          </p>
          <p className="text-white/80">
            We're tackling one of AI's hardest problems: making professional video creation accessible to everyone.
          </p>
        </motion.div>
      </SlideWrapper>

      {/* SLIDE 9: Business Model */}
      <SlideWrapper dark slideIndex={8}>
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Scalable SaaS with Strong Unit Economics
          </motion.h2>
          <p className="text-xl text-white/70">Freemium model with clear upgrade path</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <PricingCard
            name="Free Tier"
            price="$0/mo"
            credits="1,000 credits • 7 days"
            features={['All AI models', 'All tools', 'No credit card']}
            goal="Viral acquisition"
          />
          <PricingCard
            name="Starter"
            price="$19/mo"
            credits="4,000 credits/month"
            features={['All AI models', 'Priority generation', 'Voice cloning']}
            goal="Target: 30% of users"
          />
          <PricingCard
            name="Pro"
            price="$49/mo"
            credits="10,000 credits/month"
            features={['All AI models', 'Priority generation', 'Voice cloning']}
            highlighted
            goal="Target: 40% of users"
          />
          <PricingCard
            name="Business"
            price="$99/mo"
            credits="20,000 credits/month"
            features={['All AI models', 'Priority generation', 'Team features']}
            goal="Agencies & brands"
          />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {[
            { label: 'ARPU', value: '$45/mo' },
            { label: 'CAC', value: '$50-75' },
            { label: 'LTV', value: '$810' },
            { label: 'LTV/CAC', value: '10.8-16.2x' },
            { label: 'Gross Margin', value: '75-80%' },
            { label: 'Payback', value: '1.7 mo' },
          ].map((metric, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white">{metric.value}</div>
              <div className="text-sm text-white/60">{metric.label}</div>
            </div>
          ))}
        </motion.div>
      </SlideWrapper>

      {/* SLIDE 10: Financial Projections */}
      <SlideWrapper slideIndex={9}>
        <div className="text-center mb-8">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-slate-900 mb-4"
          >
            Path to Profitability & Scale
          </motion.h2>
          <p className="text-xl text-slate-600">Conservative projections with strong margins</p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="bg-white rounded-2xl p-6 shadow-xl mb-8"
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={financialData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="users" stroke="#64748B" />
              <YAxis stroke="#64748B" tickFormatter={(v) => `$${v >= 1000000 ? (v/1000000).toFixed(1) + 'M' : v >= 1000 ? (v/1000) + 'K' : v}`} />
              <Tooltip 
                formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '8px', color: 'white' }}
              />
              <Legend />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#7C3AED" fillOpacity={1} fill="url(#colorRevenue)" />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" fillOpacity={1} fill="url(#colorExpenses)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {milestonesData.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-gradient-to-br from-[#7C3AED]/10 to-[#3B82F6]/10 rounded-xl p-6 text-center border border-[#7C3AED]/20"
            >
              <div className="text-lg font-bold text-[#7C3AED]">{m.milestone}</div>
              <div className="text-2xl font-bold text-slate-900">{m.metric}</div>
              <div className="text-slate-600">{m.value}</div>
            </motion.div>
          ))}
        </div>
      </SlideWrapper>

      {/* SLIDE 11: Go-to-Market */}
      <SlideWrapper gradient slideIndex={10}>
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Customer Acquisition & Growth
          </motion.h2>
          <p className="text-xl text-white/80">Multi-channel strategy targeting creator communities</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {[
            { icon: Target, title: 'Viral Product Features', items: ['Free tier with sharing incentives', 'Watermarked exports = free marketing', 'Referral: Get 2 months free'] },
            { icon: Share2, title: 'Content Marketing', items: ['YouTube tutorials & demos', 'TikTok creator partnerships', 'Target: 100k followers in 12 mo'] },
            { icon: Megaphone, title: 'Paid Acquisition', items: ['Meta & YouTube ads', 'TikTok & Google ads', 'Budget: $10k-25k/mo'] },
            { icon: Handshake, title: 'Strategic Partnerships', items: ['Creator education platforms', 'Marketing agencies', 'Influencer programs'] },
          ].map((pillar, i) => (
            <FeatureCard key={i} icon={pillar.icon} title={pillar.title} items={pillar.items} delay={i * 0.1} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="bg-white/10 backdrop-blur rounded-xl p-6"
        >
          <h3 className="font-bold text-white mb-4">12-Month Milestones</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { period: 'Month 1-3', goal: '100 beta users' },
              { period: 'Month 4-6', goal: '1,000 paying users' },
              { period: 'Month 7-9', goal: '5,000 users, $200k MRR' },
              { period: 'Month 10-12', goal: '10,000 users, $400k MRR' },
            ].map((m, i) => (
              <div key={i} className="text-center">
                <div className="text-sm text-white/60">{m.period}</div>
                <div className="font-semibold text-white">{m.goal}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </SlideWrapper>

      {/* SLIDE 12: Roadmap */}
      <SlideWrapper slideIndex={11}>
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-slate-900 mb-4"
          >
            Momentum & Execution
          </motion.h2>
          <p className="text-xl text-slate-600">Proven team building at velocity</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-[#10B981]/10 to-[#059669]/10 rounded-2xl p-8 border border-[#10B981]/20"
          >
            <h3 className="text-xl font-bold text-[#059669] mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" /> Already Built (Q4 2025)
            </h3>
            <ul className="space-y-3">
              {[
                'Custom Video Editor (90% complete)',
                'Drag-and-drop interface working',
                'FFmpeg integration successful',
                'AWS Lambda video processing',
                '21 AI tools integrated',
                'Social Media Poster (80% complete)',
                'Video Joiner functional',
                'Infrastructure deployed',
                'Brand Builder templates created',
                'User authentication & billing ready'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-slate-700">
                  <Check className="w-4 h-4 text-[#10B981]" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            {[
              { quarter: 'Q1 2026', items: ['Beta launch 50-100 users', 'Gemini/Veo integration', 'Social Media Hub v1', 'iOS/Android MVP'] },
              { quarter: 'Q2 2026', items: ['1,000 paying users', 'Mobile responsiveness', 'Advanced editor features', 'Team collaboration'] },
              { quarter: 'Q3 2026', items: ['5,000 users, $200k MRR', 'White-label capabilities', 'API access', 'Enterprise features'] },
            ].map((q, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-lg border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <Rocket className="w-5 h-5 text-[#7C3AED]" />
                  <span className="font-bold text-slate-900">{q.quarter}</span>
                </div>
                <ul className="space-y-1">
                  {q.items.map((item, j) => (
                    <li key={j} className="text-sm text-slate-600 flex items-center gap-2">
                      <ArrowRight className="w-3 h-3 text-[#3B82F6]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </motion.div>
        </div>
      </SlideWrapper>

      {/* SLIDE 13: Team */}
      <SlideWrapper dark slideIndex={12}>
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Proven Entrepreneurs & Technologists
          </motion.h2>
          <p className="text-xl text-white/70">40+ combined years building tech products</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl p-8"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#3B82F6] flex items-center justify-center text-white text-2xl font-bold mb-4">
              RM
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Ryan Mahabir</h3>
            <p className="text-[#7C3AED] font-semibold mb-4">Co-Founder & CEO</p>
            <ul className="space-y-2 text-sm text-slate-600 mb-4">
              <li>• 20+ years software engineering & IT leadership</li>
              <li>• Full-stack developer (React, Node.js, Python, AWS)</li>
              <li>• IT Director / Manager with $20M+ budget experience</li>
              <li>• Network Engineer and Project Manager</li>
              <li>• Built multiple software products</li>
            </ul>
            <div className="text-sm font-semibold text-[#10B981]">Key: Technical execution & product vision</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-8"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#06B6D4] to-[#10B981] flex items-center justify-center text-white text-2xl font-bold mb-4">
              WM
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Wendy Mahabir</h3>
            <p className="text-[#06B6D4] font-semibold mb-4">Co-Founder & COO</p>
            <ul className="space-y-2 text-sm text-slate-600 mb-4">
              <li>• Service Delivery Manager (15 years)</li>
              <li>• Social Media Influencer + Brand Builder</li>
              <li>• Led go-to-market strategies for tech products</li>
              <li>• Expert in creator economy and social marketing</li>
              <li>• Built and managed high-performing teams</li>
            </ul>
            <div className="text-sm font-semibold text-[#10B981]">Key: Growth, sales & customer success</div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="bg-white/10 rounded-xl p-6"
        >
          <h3 className="font-bold text-white mb-4 text-center">Why We'll Win</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              'Technical depth for complex AI products',
              'Marketing expertise for acquisition',
              'Domain knowledge - we ARE the customer',
              'Bootstrap discipline - maximize every $',
              'Track record of shipping products',
              'Complementary skill sets'
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-white/80 text-sm">
                <Check className="w-4 h-4 text-[#10B981] shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </motion.div>
      </SlideWrapper>

      {/* SLIDE 14: The Ask */}
      <SlideWrapper gradient slideIndex={13}>
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Partner With Us
          </motion.h2>
          <p className="text-xl text-white/80">Strategic funding to accelerate growth and market dominance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <FeatureCard
            icon={DollarSign}
            title="Equity Funding: $150-300K"
            items={['Marketing & Acquisition: 50%', 'Product Development: 30%', 'Infrastructure & Ops: 20%']}
          />
          <FeatureCard
            icon={Globe}
            title="Google Cloud Credits: $350K"
            items={['Video processing compute', 'AI model inference at scale', 'Extends runway 6-8 months']}
          />
          <FeatureCard
            icon={Rocket}
            title="Early Model Access"
            items={['Veo 2 video generation', 'Gemini 2.0 Flash', 'Imagen 3 for graphics']}
          />
          <FeatureCard
            icon={Handshake}
            title="Technical Partnership"
            items={['DeepMind integration support', 'Go-to-market guidance', 'Co-marketing opportunities']}
          />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="bg-white/10 backdrop-blur rounded-xl p-6 text-center"
        >
          <div className="text-2xl font-bold text-white mb-4">Total Package Value: $500K-650K</div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-white/60">Month 6</div>
              <div className="font-semibold text-white">1,000 users</div>
            </div>
            <div>
              <div className="text-sm text-white/60">Month 12</div>
              <div className="font-semibold text-white">5,000 users, $200k MRR</div>
            </div>
            <div>
              <div className="text-sm text-white/60">Month 18</div>
              <div className="font-semibold text-white">10,000 users, profitable</div>
            </div>
          </div>
        </motion.div>
      </SlideWrapper>

      {/* SLIDE 15: Vision & Closing */}
      <SlideWrapper dark slideIndex={14}>
        <div className="text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Let's Build the Future of Content Creation
          </motion.h2>
          <p className="text-xl text-white/70 mb-12">From impossible to inevitable</p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-[#7C3AED] to-[#3B82F6] rounded-2xl p-8 md:p-12 mb-12"
          >
            <p className="text-2xl md:text-3xl font-light text-white italic">
              "In 5 years, we'll look back and wonder how anyone created content without Artivio AI."
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              { icon: Globe, title: 'Democratize Creation', desc: 'Every person with a story deserves professional tools to share it.' },
              { icon: Rocket, title: 'Empower Creators', desc: '200M+ creators globally are building businesses. We give them the tools.' },
              { icon: Zap, title: 'Define the Category', desc: "We're building the operating system for the creator economy." },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/10 rounded-xl p-6"
              >
                <item.icon className="w-8 h-8 text-[#06B6D4] mx-auto mb-3" />
                <h3 className="font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/70">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-white"
          >
            <div className="text-lg font-semibold mb-2">Ryan Mahabir & Wendy Mahabir</div>
            <div className="text-white/70 mb-4">Founders, Artivio AI</div>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-sm">
              <a href="mailto:ryan@artivio.ai" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
                <Mail className="w-4 h-4" /> ryan@artivio.ai
              </a>
              <a href="https://artivio.ai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
                <Globe className="w-4 h-4" /> artivio.ai
              </a>
            </div>
          </motion.div>
        </div>
      </SlideWrapper>
    </div>
  );
}
