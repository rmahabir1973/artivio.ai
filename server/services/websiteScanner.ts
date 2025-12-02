import { db } from '../db';
import { socialBrandKits, socialBrandScanJobs, socialBrandAssets } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface ExtractedImage {
  url: string;
  alt?: string;
  type: 'logo' | 'hero' | 'product' | 'other';
  width?: number;
  height?: number;
}

interface ExtractedContent {
  title?: string;
  description?: string;
  tagline?: string;
  aboutText?: string;
  services?: string[];
  products?: string[];
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  socialLinks?: {
    platform: string;
    url: string;
  }[];
}

interface WebsiteScanResult {
  colors: string[];
  images: ExtractedImage[];
  content: ExtractedContent;
  fonts?: string[];
  error?: string;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function extractColorsFromCSS(css: string): string[] {
  const colors = new Set<string>();
  const hexColorRegex = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
  
  let match;
  while ((match = hexColorRegex.exec(css)) !== null) {
    colors.add(match[0].toLowerCase());
  }
  
  const rgbRegex = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g;
  while ((match = rgbRegex.exec(css)) !== null) {
    const hex = rgbToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
    colors.add(hex.toLowerCase());
  }
  
  const hslRegex = /hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?/g;
  while ((match = hslRegex.exec(css)) !== null) {
    const hex = hslToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
    colors.add(hex.toLowerCase());
  }
  
  return Array.from(colors).filter(c => {
    return c !== '#000000' && c !== '#ffffff' && c !== '#fff' && c !== '#000';
  }).slice(0, 10);
}

function extractImagesFromHTML(html: string, baseUrl: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  const logoKeywords = ['logo', 'brand', 'icon'];
  const heroKeywords = ['hero', 'banner', 'header', 'cover'];
  
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    let src = match[1];
    const alt = match[2] || '';
    
    if (src.startsWith('//')) {
      src = 'https:' + src;
    } else if (src.startsWith('/')) {
      src = new URL(src, baseUrl).href;
    } else if (!src.startsWith('http')) {
      src = new URL(src, baseUrl).href;
    }
    
    if (src.includes('data:') || src.includes('.svg') && src.includes('data:')) {
      continue;
    }
    
    let type: 'logo' | 'hero' | 'product' | 'other' = 'other';
    const lowerSrc = src.toLowerCase();
    const lowerAlt = alt.toLowerCase();
    
    if (logoKeywords.some(k => lowerSrc.includes(k) || lowerAlt.includes(k))) {
      type = 'logo';
    } else if (heroKeywords.some(k => lowerSrc.includes(k) || lowerAlt.includes(k))) {
      type = 'hero';
    }
    
    images.push({ url: src, alt, type });
  }
  
  return images.slice(0, 20);
}

function extractContentFromHTML(html: string): ExtractedContent {
  const content: ExtractedContent = {};
  
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    content.title = titleMatch[1].trim().split('|')[0].split('-')[0].trim();
  }
  
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (descMatch) {
    content.description = descMatch[1].trim();
  }
  
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (ogDescMatch && !content.description) {
    content.description = ogDescMatch[1].trim();
  }
  
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    content.tagline = h1Match[1].trim();
  }
  
  const aboutPatterns = [
    /<(?:section|div)[^>]*(?:id|class)=["'][^"']*about[^"']*["'][^>]*>([\s\S]*?)<\/(?:section|div)>/gi,
    /<(?:section|div)[^>]*(?:id|class)=["'][^"']*who-we-are[^"']*["'][^>]*>([\s\S]*?)<\/(?:section|div)>/gi,
  ];
  
  for (const pattern of aboutPatterns) {
    const match = pattern.exec(html);
    if (match) {
      const stripped = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (stripped.length > 50 && stripped.length < 2000) {
        content.aboutText = stripped.substring(0, 1000);
        break;
      }
    }
  }
  
  const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = html.match(/(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  
  if (emailMatch || phoneMatch) {
    content.contactInfo = {};
    if (emailMatch) content.contactInfo.email = emailMatch[0];
    if (phoneMatch) content.contactInfo.phone = phoneMatch[0];
  }
  
  const socialPatterns = [
    { pattern: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi, platform: 'facebook' },
    { pattern: /https?:\/\/(?:www\.)?twitter\.com\/[^\s"'<>]+/gi, platform: 'twitter' },
    { pattern: /https?:\/\/(?:www\.)?x\.com\/[^\s"'<>]+/gi, platform: 'x' },
    { pattern: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi, platform: 'instagram' },
    { pattern: /https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/gi, platform: 'linkedin' },
    { pattern: /https?:\/\/(?:www\.)?youtube\.com\/[^\s"'<>]+/gi, platform: 'youtube' },
    { pattern: /https?:\/\/(?:www\.)?tiktok\.com\/[^\s"'<>]+/gi, platform: 'tiktok' },
  ];
  
  const socialLinks: { platform: string; url: string }[] = [];
  for (const { pattern, platform } of socialPatterns) {
    const match = pattern.exec(html);
    if (match) {
      socialLinks.push({ platform, url: match[0] });
    }
  }
  if (socialLinks.length > 0) {
    content.socialLinks = socialLinks;
  }
  
  return content;
}

function extractFontsFromCSS(css: string): string[] {
  const fonts = new Set<string>();
  const fontFamilyRegex = /font-family:\s*["']?([^"';,}]+)/gi;
  
  let match;
  while ((match = fontFamilyRegex.exec(css)) !== null) {
    const font = match[1].trim();
    if (!font.includes('inherit') && !font.includes('sans-serif') && 
        !font.includes('serif') && !font.includes('monospace') &&
        !font.includes('cursive') && !font.includes('fantasy') &&
        !font.includes('system-ui') && !font.includes('-apple-system')) {
      fonts.add(font);
    }
  }
  
  const googleFontRegex = /fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/g;
  while ((match = googleFontRegex.exec(css)) !== null) {
    const fontFamily = decodeURIComponent(match[1]).split(':')[0].replace(/\+/g, ' ');
    fonts.add(fontFamily);
  }
  
  return Array.from(fonts).slice(0, 5);
}

export async function scanWebsite(url: string): Promise<WebsiteScanResult> {
  try {
    const parsedUrl = new URL(url);
    const baseUrl = parsedUrl.origin;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ArtivioBot/1.0; +https://artivio.ai)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let inlineCSS = '';
    let match;
    while ((match = styleRegex.exec(html)) !== null) {
      inlineCSS += match[1] + '\n';
    }
    
    const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi;
    const cssUrls: string[] = [];
    while ((match = linkRegex.exec(html)) !== null) {
      let cssUrl = match[1];
      if (cssUrl.startsWith('//')) {
        cssUrl = 'https:' + cssUrl;
      } else if (cssUrl.startsWith('/')) {
        cssUrl = baseUrl + cssUrl;
      } else if (!cssUrl.startsWith('http')) {
        cssUrl = baseUrl + '/' + cssUrl;
      }
      cssUrls.push(cssUrl);
    }
    
    let externalCSS = '';
    const cssPromises = cssUrls.slice(0, 5).map(async (cssUrl) => {
      try {
        const cssResponse = await fetch(cssUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArtivioBot/1.0)' },
          signal: AbortSignal.timeout(10000),
        });
        if (cssResponse.ok) {
          return await cssResponse.text();
        }
      } catch (e) {
      }
      return '';
    });
    
    const cssResults = await Promise.all(cssPromises);
    externalCSS = cssResults.join('\n');
    
    const allCSS = inlineCSS + externalCSS;
    
    const colors = extractColorsFromCSS(allCSS);
    const images = extractImagesFromHTML(html, baseUrl);
    const content = extractContentFromHTML(html);
    const fonts = extractFontsFromCSS(allCSS + html);
    
    return {
      colors,
      images,
      content,
      fonts,
    };
  } catch (error: any) {
    console.error('[WebsiteScanner] Error scanning website:', error.message);
    return {
      colors: [],
      images: [],
      content: {},
      error: error.message,
    };
  }
}

export async function processScanJob(jobId: string): Promise<void> {
  try {
    const job = await db.query.socialBrandScanJobs.findFirst({
      where: eq(socialBrandScanJobs.id, jobId),
    });
    
    if (!job) {
      console.error('[WebsiteScanner] Job not found:', jobId);
      return;
    }
    
    await db
      .update(socialBrandScanJobs)
      .set({ status: 'processing', startedAt: new Date() })
      .where(eq(socialBrandScanJobs.id, jobId));
    
    const result = await scanWebsite(job.targetUrl);
    
    if (result.error) {
      await db
        .update(socialBrandScanJobs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          error: result.error,
        })
        .where(eq(socialBrandScanJobs.id, jobId));
      
      await db
        .update(socialBrandKits)
        .set({ scanStatus: 'failed' })
        .where(eq(socialBrandKits.id, job.brandKitId));
      
      return;
    }
    
    const brandKit = await db.query.socialBrandKits.findFirst({
      where: eq(socialBrandKits.id, job.brandKitId),
    });
    
    if (!brandKit) {
      throw new Error('Brand kit not found');
    }
    
    const existingBusinessOverview = brandKit.businessOverview || {};
    const updatedBusinessOverview = {
      ...existingBusinessOverview,
      coreIdentity: result.content.title || existingBusinessOverview.coreIdentity,
    };
    
    await db
      .update(socialBrandKits)
      .set({
        businessOverview: updatedBusinessOverview,
        visualIdentityDescription: result.content.description || brandKit.visualIdentityDescription,
        colors: result.colors.length > 0 ? result.colors : brandKit.colors,
        fonts: result.fonts && result.fonts.length > 0 ? result.fonts : brandKit.fonts,
        scanStatus: 'completed',
        lastScanAt: new Date(),
      })
      .where(eq(socialBrandKits.id, job.brandKitId));
    
    const logoImages = result.images.filter(img => img.type === 'logo').slice(0, 3);
    for (const image of logoImages) {
      const mimeType = image.url.includes('.png') ? 'image/png' : 
                       image.url.includes('.svg') ? 'image/svg+xml' : 'image/jpeg';
      await db.insert(socialBrandAssets).values({
        brandKitId: job.brandKitId,
        type: 'image',
        filename: image.alt || 'logo',
        url: image.url,
        mimeType: mimeType,
      });
    }
    
    const heroImages = result.images.filter(img => img.type === 'hero').slice(0, 3);
    for (const image of heroImages) {
      const mimeType = image.url.includes('.png') ? 'image/png' : 
                       image.url.includes('.webp') ? 'image/webp' : 'image/jpeg';
      await db.insert(socialBrandAssets).values({
        brandKitId: job.brandKitId,
        type: 'image',
        filename: image.alt || 'hero-image',
        url: image.url,
        mimeType: mimeType,
      });
    }
    
    await db
      .update(socialBrandScanJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        scanResult: {
          colors: result.colors,
          logos: logoImages.map(img => img.url),
          images: result.images.map(img => img.url),
          textContent: {
            title: result.content.title,
            description: result.content.description,
            aboutContent: result.content.aboutText,
            products: result.content.products,
            services: result.content.services,
          },
        },
      })
      .where(eq(socialBrandScanJobs.id, jobId));
    
    console.log(`[WebsiteScanner] Successfully scanned ${job.targetUrl}`);
  } catch (error: any) {
    console.error('[WebsiteScanner] Error processing scan job:', error);
    
    await db
      .update(socialBrandScanJobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        error: error.message,
      })
      .where(eq(socialBrandScanJobs.id, jobId));
  }
}

export async function getScanJobStatus(jobId: string) {
  const job = await db.query.socialBrandScanJobs.findFirst({
    where: eq(socialBrandScanJobs.id, jobId),
  });
  return job;
}
