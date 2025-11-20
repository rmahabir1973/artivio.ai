import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, DollarSign, Users, TrendingUp, Mail, Copy, ExternalLink, Sparkles, Gift, Target, Zap } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const AFFILIATE_LINK = "https://artivio-ai.getrewardful.com/signup?campaign=artivio-affiliate-team&code=F4Ng9WuVZ9mhUHVjYMpAxkqM";

export default function Affiliates() {
  const { toast } = useToast();
  const [copiedEmail, setCopiedEmail] = useState<number | null>(null);

  const copyEmailTemplate = (template: string, index: number) => {
    navigator.clipboard.writeText(template);
    setCopiedEmail(index);
    toast({
      title: "Copied!",
      description: "Email template copied to clipboard",
    });
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const emailFunnel = [
    {
      day: 1,
      subject: "Welcome to Artivio AI - Your First Video Awaits!",
      body: `Hi [Name],

Welcome to Artivio AI! I'm thrilled you've joined our community of creators transforming ideas into stunning AI-powered content.

Here's what you can create right now:
• Professional videos with Veo 3.1, Runway, and Kling AI
• Breathtaking images with Flux, Midjourney v7, and 4o Image
• Custom music with Suno V5
• Voice cloning with ElevenLabs
• AI talking avatars and video editing

Your free plan includes 1,000 credits to get started. That's enough for:
- 2-3 AI videos (Veo 3.1)
- 10-15 AI images (Flux)
- 3-4 music tracks (Suno)

>> Start creating now: https://artivio.ai

Quick Start Tips:
1. Try the video generator first - it's our most popular feature
2. Use the workflow templates to save time
3. Join our community for tips and inspiration

Questions? Just reply to this email - I'm here to help!

Best,
[Your Name]
Artivio AI Advocate

P.S. Need more credits? Upgrade to Starter ($19.99/mo) for 5,000 credits - perfect for consistent creators!`
    },
    {
      day: 3,
      subject: "3 Killer Strategies to Maximize Your Artivio AI Credits",
      body: `Hey [Name],

Hope you've had a chance to explore Artivio AI! I wanted to share 3 strategies that helped me create 10x more content with the same credits:

[1] **Start with Templates**
   Don't write prompts from scratch. Use our 20 pre-built workflow templates - they're optimized for the best results with fewer retries.

[2] **Use Image-to-Video**
   Upload reference images instead of pure text-to-video. You'll get more consistent results on the first try, saving credits on regenerations.

[3] **Batch Your Creations**
   Plan your content in advance. Generate 5 videos at once instead of one at a time - you'll stay in the creative flow and waste less credits on experimentation.

** Pro Tip: The Image Analyzer feature is FREE - use it to perfect your reference images before generating videos. Zero credit cost!

Want to see these in action? I created a quick tutorial: [Link to your tutorial if you have one]

>> Jump back in: https://artivio.ai

Happy creating!
[Your Name]

P.S. Loving Artivio? Share it with a creator friend - we both get bonus credits!`
    },
    {
      day: 5,
      subject: "From $0 to $5,000/month: How Creators Are Monetizing AI Content",
      body: `Hi [Name],

You joined Artivio to create amazing content. But did you know creators are now making $1,000-$5,000/month selling AI-generated content?

Here's how they're doing it:

** Stock Video Sales **
Generate unique B-roll footage and sell on Pond5, Adobe Stock, Shutterstock. One creator made $3,200 last month.

** Custom Client Work **
Offer AI image/video services on Fiverr, Upwork. Charge $50-$200 per video, costs you 200-400 credits ($1-2).

** Music Licensing **
Create background music for YouTubers, podcasters. License for $25-$100 per track, costs 100 credits ($0.50).

** Social Media Content **
Manage clients' Instagram/TikTok with daily AI videos. Charge $500-$1,500/month per client.

**Real Numbers:**
- Pro Plan: $49.99/month (15,000 credits)
- Generate 30 high-quality videos
- Sell at $75 average = $2,250/month
- Profit: $2,200+/month

Want the full playbook? I put together a guide on monetizing AI content: [Link]

>> Start your side hustle: https://artivio.ai

To your success,
[Your Name]

P.S. Serious about this? The Pro plan pays for itself with just one client. Upgrade today and start profiting tomorrow!`
    },
    {
      day: 7,
      subject: "Last Chance: Your Free Trial Credit Insights + Exclusive Bonus",
      body: `Hey [Name],

Quick check-in - you've been with Artivio for a week now!

I noticed you have [X credits remaining] left. Here's what you could still create:

With your remaining credits:
- [Y] more AI videos
- [Z] more AI images
- Or mix and match!

** EXCLUSIVE BONUS FOR YOU: **
Upgrade to Starter or Pro in the next 48 hours and get:
• +1,000 bonus credits (on top of your monthly allocation)
• Priority generation queue (3x faster)
• Early access to new AI models
• Premium support

**Why upgrade now?**
• Creators on paid plans generate 5x more content
• 92% see ROI within the first month
• Cancel anytime, keep your generated content forever

>> Claim your bonus: https://artivio.ai/pricing

Still have questions? Hit reply - I'm here to help you decide if an upgrade makes sense for your goals.

Best,
[Your Name]
Artivio AI Advocate

P.S. This bonus is only valid for 48 hours. After that, standard pricing applies. Don't miss out!

---
Not ready to upgrade? No problem! You can always purchase credit top-ups as needed.`
    },
    {
      day: 10,
      subject: "Your Custom Artivio AI Action Plan (Based on Your Usage)",
      body: `Hi [Name],

I've been analyzing how you've used Artivio AI over the past 10 days, and I created a personalized action plan to help you get even more value:

**Your Usage Profile:**
[Customize based on their actual usage - examples below]

If they're creating mostly videos:
"I noticed you love video generation! Here's your plan:
1. Try image-to-video with reference frames for more control
2. Experiment with Runway Aleph for cinematic shots
3. Use the Video Editor to combine multiple clips

Recommended plan: Starter ($19.99) for 5,000 credits = 10-15 videos/month"

If they're creating images:
"You're crushing it with images! Here's what's next:
1. Try advanced editing modes (inpainting, outpainting)
2. Generate image sets for consistent brand assets
3. Upscale your favorites to 4K with Topaz AI

Recommended plan: Pro ($49.99) for 15,000 credits = 100+ images/month"

If they haven't used much:
"I see you haven't created much yet - no worries! Sometimes it takes time to explore.

Let me help you get started:
1. Try this pre-made prompt: [Include a specific, proven prompt]
2. Check out our workflow templates (20 ready-to-use)
3. Join our community Discord for inspiration

Need help? I'm offering FREE 15-min onboarding calls this week. Interested?"

**Special Offer for You:**
Use code ADVOCATE10 for 10% off your first 3 months on any paid plan. Expires in 5 days.

>> Upgrade now: https://artivio.ai/pricing?code=ADVOCATE10

Let me know if you need any guidance - I'm here for you!

[Your Name]

P.S. Loving Artivio? Leave us a review and I'll send you 500 bonus credits!`
    },
    {
      day: 14,
      subject: "What's New at Artivio AI + A Special Thank You",
      body: `Hey [Name],

It's been 2 weeks since you joined Artivio AI - time flies!

First, **THANK YOU** for being part of our creator community. Whether you've generated 1 video or 100, you're helping shape the future of AI content creation.

**What's New This Week:**
• New Model: Seedance 1.0 Pro (ultra-realistic videos)
• Feature: Bulk video generation (create 10 at once)
• Integration: Export directly to YouTube, TikTok
• Templates: 5 new viral video templates added

**Community Highlights:**
• 10,000+ creators generated 50,000+ videos this week
• Top creator made 127 videos in 7 days
• Most popular: Product demo videos (22% of all generations)

**How You Can Help:**
We're growing fast thanks to creators like you. If you know anyone who'd benefit from AI content creation, here's our referral link:

>> Share Artivio: https://artivio.ai/referral/[your-code]

For every friend who signs up, you BOTH get 500 bonus credits. No limit!

**Your Current Status:**
Plan: [Free/Starter/Pro]
Credits Used: [X] / [Total]
Generations: [Y] videos, [Z] images, [A] music

Need more credits? Upgrade anytime: https://artivio.ai/pricing

Keep creating amazing content!

[Your Name]
Artivio AI Advocate

P.S. Got a success story? Reply and share - we might feature you in our newsletter!`
    },
    {
      day: 21,
      subject: "Become an Artivio AI Affiliate - Earn 30% Recurring Commissions",
      body: `Hi [Name],

You've been with Artivio AI for 3 weeks now, and I have an exciting opportunity for you.

**How would you like to earn money while helping other creators?**

Our Affiliate Program offers:
• 30% recurring commission on all referrals (for life!)
• Average affiliate earns $500-$2,000/month
• Top affiliates earning $10,000+/month
• Bonus: $50 for your first 5 paid referrals

**The Math:**
- Refer 10 Starter plans ($19.99) = $60/month recurring
- Refer 10 Pro plans ($49.99) = $150/month recurring
- Refer 50 Pro plans = $750/month passive income

**Why It Works:**
• 92% trial-to-paid conversion rate
• AI content creation is exploding (10x growth in 2025)
• We handle all support, billing, product development
• You just share your unique link and earn

**Who Should Join:**
- Content creators with an audience
- AI/tech bloggers and YouTubers
- Marketing agencies
- Anyone who loves Artivio and wants to share it!

**What You Get:**
• Real-time dashboard with analytics
• Monthly payouts via Stripe
• Pre-written email templates (7-day funnel)
• Marketing materials (banners, videos, posts)
• Dedicated affiliate support

>> Join the Affiliate Program: ${AFFILIATE_LINK}

**Success Stories:**
"I made $3,200 in my first month just by adding Artivio to my AI newsletter footer." - Sarah K., Tech Blogger

"As a YouTube creator, I mention Artivio in my videos. I'm now earning $8,500/month passively." - Mark T., YouTuber

Ready to turn your passion into profit?

[Your Name]
Artivio AI Advocate

P.S. The program is free to join, no approval needed. Sign up, get your link, start earning today!

---
Questions? Reply to this email or check out our Affiliate FAQ: https://artivio.ai/affiliates`
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative border-b overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Gift className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Earn 30% Recurring Commission</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              Turn Your Influence Into{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Passive Income
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join the Artivio AI Affiliate Program and earn generous commissions promoting the
              world's most powerful AI content creation platform.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <Button 
                size="lg" 
                className="text-lg px-8 h-14 min-w-[200px]"
                asChild
                data-testid="button-hero-join-affiliate"
              >
                <a href={AFFILIATE_LINK} target="_blank" rel="noopener noreferrer">
                  <DollarSign className="mr-2 h-5 w-5" />
                  Join Affiliate Program
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 h-14 min-w-[200px]"
                onClick={() => {
                  document.getElementById('email-funnel')?.scrollIntoView({ behavior: 'smooth' });
                }}
                data-testid="button-hero-see-templates"
              >
                See Email Templates
              </Button>
            </div>

            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-8 pt-12 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">30%</div>
                <div className="text-sm text-muted-foreground">Recurring Commission</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">92%</div>
                <div className="text-sm text-muted-foreground">Trial Conversion Rate</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">$750+</div>
                <div className="text-sm text-muted-foreground">Avg. Monthly Earnings</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Join Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Why Join Our Affiliate Program?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to succeed as an Artivio AI affiliate partner
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="hover-elevate" data-testid="card-benefit-commission">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>30% Lifetime Commission</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Earn 30% recurring commission for every paying customer you refer - for as long as they remain a subscriber. Average affiliate earns $500-$2,000/month.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-benefit-conversion">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Industry-Leading Conversion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  92% of trials convert to paid plans. Our product sells itself with cutting-edge AI models (Veo 3.1, Suno V5, Flux) that creators actually want to use.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-benefit-materials">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Ready-Made Materials</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Get access to a complete 7-day email funnel, banner ads, social media templates, and video assets. Everything you need to start promoting immediately.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-benefit-support">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Dedicated Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Direct access to our affiliate success team. Get help with campaigns, technical questions, and optimization strategies to maximize your earnings.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-benefit-dashboard">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Real-Time Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track clicks, conversions, and earnings in real-time with your Rewardful dashboard. See exactly which campaigns are performing best.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-benefit-payouts">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Fast Monthly Payouts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Get paid monthly via Stripe. No minimum payout threshold. Simple, transparent, and reliable payment processing.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Commission Structure */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Commission Structure</h2>
            <p className="text-xl text-muted-foreground">
              See how much you can earn with each referral
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="hover-elevate border-2" data-testid="card-commission-free">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl mb-2">Free Plan</CardTitle>
                <p className="text-sm text-muted-foreground">$0/month</p>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="text-5xl font-bold text-muted-foreground">$0</div>
                <p className="text-sm text-muted-foreground">
                  Free users help build your audience for future conversions
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate border-2 border-primary" data-testid="card-commission-starter">
              <CardHeader className="text-center">
                <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold inline-block mb-3">
                  Most Popular
                </div>
                <CardTitle className="text-2xl mb-2">Starter Plan</CardTitle>
                <p className="text-sm text-muted-foreground">$19.99/month</p>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="text-5xl font-bold text-primary">$6</div>
                <p className="text-sm font-medium">per month recurring</p>
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">10 referrals = $60/month</p>
                  <p className="text-xs text-muted-foreground">50 referrals = $300/month</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate border-2" data-testid="card-commission-pro">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl mb-2">Pro Plan</CardTitle>
                <p className="text-sm text-muted-foreground">$49.99/month</p>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="text-5xl font-bold text-primary">$15</div>
                <p className="text-sm font-medium">per month recurring</p>
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">10 referrals = $150/month</p>
                  <p className="text-xs text-muted-foreground">50 referrals = $750/month</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 p-6 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-start gap-4">
              <Sparkles className="h-6 w-6 text-primary shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-2">Special Launch Bonus</h3>
                <p className="text-muted-foreground">
                  Earn an extra <span className="font-bold text-foreground">$50 bonus</span> when you refer your first 5 paying customers! 
                  That's $50 on top of your regular 30% commissions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7-Day Email Funnel */}
      <section id="email-funnel" className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">7-Day Email Funnel Templates</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Copy-paste ready emails to nurture your audience and boost conversions. 
              Fully customizable and proven to convert.
            </p>
          </div>

          <div className="space-y-6">
            {emailFunnel.map((email, index) => (
              <Card key={index} className="hover-elevate" data-testid={`card-email-day-${email.day}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-primary">{email.day}</span>
                        </div>
                        <CardTitle className="text-lg">Day {email.day}</CardTitle>
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Subject: {email.subject}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyEmailTemplate(email.body, index)}
                      data-testid={`button-copy-email-${email.day}`}
                    >
                      {copiedEmail === index ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Template
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-sm font-mono text-muted-foreground">
                      {email.body}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 p-6 rounded-lg bg-accent/10 border border-accent/20">
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <Mail className="h-5 w-5 text-accent" />
              Pro Tips for Email Success
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span>Personalize [Name] and [X/Y/Z] placeholders with real data for higher engagement</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span>Send emails from a personal email address, not a no-reply address</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span>A/B test subject lines to improve open rates (aim for 30%+ opens)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span>Include your affiliate link 2-3 times per email for maximum conversions</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span>Track which emails drive the most conversions and double down on those</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Affiliate Success Stories</h2>
            <p className="text-xl text-muted-foreground">
              Real affiliates, real results
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="hover-elevate" data-testid="card-testimonial-1">
              <CardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg font-bold text-white">
                    SK
                  </div>
                  <div>
                    <CardTitle className="text-lg">Sarah K.</CardTitle>
                    <p className="text-sm text-muted-foreground">Tech Blogger</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground italic mb-4">
                  "I made <span className="font-bold text-foreground">$3,200 in my first month</span> just by adding Artivio to my AI newsletter footer. 
                  The 92% conversion rate is insane - my readers love it!"
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="font-medium">$3,200/month recurring</span>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-testimonial-2">
              <CardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg font-bold text-white">
                    MT
                  </div>
                  <div>
                    <CardTitle className="text-lg">Mark T.</CardTitle>
                    <p className="text-sm text-muted-foreground">YouTube Creator (150K subs)</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground italic mb-4">
                  "As a YouTube creator covering AI tools, I mention Artivio in my videos. 
                  I'm now earning <span className="font-bold text-foreground">$8,500/month passively</span>. 
                  Best decision ever!"
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="font-medium">$8,500/month recurring</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 border-t">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Start Earning?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join hundreds of affiliates earning passive income promoting the best AI content creation platform. 
            No approval needed - sign up and start promoting today!
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              className="text-lg px-8 h-14 min-w-[250px]"
              asChild
              data-testid="button-cta-join-affiliate"
            >
              <a href={AFFILIATE_LINK} target="_blank" rel="noopener noreferrer">
                <DollarSign className="mr-2 h-5 w-5" />
                Join Affiliate Program Free
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            No approval required • Start earning immediately • Cancel anytime
          </p>
        </div>
      </section>

    </div>
  );
}
