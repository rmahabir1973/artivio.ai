import { db } from '../db';
import { socialBrandKits, socialBrandScanJobs, socialBrandAssets } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

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
  domain?: string;
  error?: string;
  usedHeadless?: boolean;
}

interface ScanProgress {
  status: 'fetching' | 'parsing' | 'extracting_css' | 'extracting_images' | 'extracting_content' | 'completed' | 'failed';
  progress: number;
  message: string;
}

const limit = pLimit(3);

const FETCH_TIMEOUT = 15000;
const CSS_FETCH_TIMEOUT = 8000;
const HEADLESS_TIMEOUT = 30000;
const MIN_CONTENT_THRESHOLD = 50;

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, x)).toString(16);
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
    let color = match[0].toLowerCase();
    if (color.length === 4) {
      color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    colors.add(color);
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
  
  const filteredColors = Array.from(colors).filter(c => {
    const isBlackOrWhite = ['#000000', '#ffffff', '#fff', '#000', '#111111', '#fefefe', '#eeeeee'].includes(c);
    const isGray = /^#([0-9a-f])\1{5}$/i.test(c);
    return !isBlackOrWhite && !isGray;
  });
  
  return filteredColors.slice(0, 10);
}

function extractImagesWithCheerio($: cheerio.CheerioAPI, baseUrl: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const seenUrls = new Set<string>();
  const logoKeywords = ['logo', 'brand', 'icon', 'favicon'];
  const heroKeywords = ['hero', 'banner', 'header', 'cover', 'jumbotron', 'masthead'];
  const skipKeywords = ['pixel', 'tracking', 'analytics', 'ad', 'beacon', 'spacer', '1x1'];
  
  $('img, source[srcset], [style*="background-image"]').each((_, element) => {
    const $el = $(element);
    let src = $el.attr('src') || $el.attr('srcset')?.split(',')[0]?.trim().split(' ')[0];
    
    if (!src && element.tagName === 'div' || element.tagName === 'section') {
      const style = $el.attr('style') || '';
      const bgMatch = style.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
      if (bgMatch) {
        src = bgMatch[1];
      }
    }
    
    if (!src || src.startsWith('data:')) return;
    
    try {
      if (src.startsWith('//')) {
        src = 'https:' + src;
      } else if (src.startsWith('/')) {
        src = new URL(src, baseUrl).href;
      } else if (!src.startsWith('http')) {
        src = new URL(src, baseUrl).href;
      }
    } catch {
      return;
    }
    
    if (seenUrls.has(src)) return;
    if (skipKeywords.some(k => src.toLowerCase().includes(k))) return;
    
    seenUrls.add(src);
    
    const alt = $el.attr('alt') || '';
    const lowerSrc = src.toLowerCase();
    const lowerAlt = alt.toLowerCase();
    const className = ($el.attr('class') || '').toLowerCase();
    const id = ($el.attr('id') || '').toLowerCase();
    
    let type: 'logo' | 'hero' | 'product' | 'other' = 'other';
    
    if (logoKeywords.some(k => lowerSrc.includes(k) || lowerAlt.includes(k) || className.includes(k) || id.includes(k))) {
      type = 'logo';
    } else if (heroKeywords.some(k => lowerSrc.includes(k) || lowerAlt.includes(k) || className.includes(k) || id.includes(k))) {
      type = 'hero';
    }
    
    const headerParent = $el.closest('header, nav, .header, .navbar, .nav');
    if (headerParent.length > 0 && type === 'other') {
      type = 'logo';
    }
    
    const width = parseInt($el.attr('width') || '0') || undefined;
    const height = parseInt($el.attr('height') || '0') || undefined;
    
    images.push({ url: src, alt, type, width, height });
  });
  
  $('link[rel*="icon"], link[rel="apple-touch-icon"]').each((_, element) => {
    const href = $(element).attr('href');
    if (href && !href.startsWith('data:')) {
      let iconUrl = href;
      try {
        if (iconUrl.startsWith('//')) {
          iconUrl = 'https:' + iconUrl;
        } else if (iconUrl.startsWith('/')) {
          iconUrl = new URL(iconUrl, baseUrl).href;
        } else if (!iconUrl.startsWith('http')) {
          iconUrl = new URL(iconUrl, baseUrl).href;
        }
        
        if (!seenUrls.has(iconUrl)) {
          seenUrls.add(iconUrl);
          images.unshift({ url: iconUrl, alt: 'favicon', type: 'logo' });
        }
      } catch {}
    }
  });
  
  return images.slice(0, 30);
}

function extractContentWithCheerio($: cheerio.CheerioAPI): ExtractedContent {
  const content: ExtractedContent = {};
  
  content.title = $('title').first().text().trim().split('|')[0].split('-')[0].split('–')[0].trim();
  
  if (!content.title) {
    content.title = $('meta[property="og:title"]').attr('content')?.trim();
  }
  if (!content.title) {
    content.title = $('meta[name="twitter:title"]').attr('content')?.trim();
  }
  
  content.description = $('meta[name="description"]').attr('content')?.trim();
  if (!content.description) {
    content.description = $('meta[property="og:description"]').attr('content')?.trim();
  }
  if (!content.description) {
    content.description = $('meta[name="twitter:description"]').attr('content')?.trim();
  }
  
  const h1Text = $('h1').first().text().trim();
  if (h1Text && h1Text.length < 200) {
    content.tagline = h1Text;
  }
  
  const aboutSelectors = [
    '#about', '.about', '[class*="about-us"]', '[id*="about"]',
    '#who-we-are', '.who-we-are', '[class*="company"]',
    'section.about', 'div.about-section'
  ];
  
  for (const selector of aboutSelectors) {
    const aboutEl = $(selector).first();
    if (aboutEl.length) {
      const text = aboutEl.text().replace(/\s+/g, ' ').trim();
      if (text.length > 50 && text.length < 2000) {
        content.aboutText = text.substring(0, 1000);
        break;
      }
    }
  }
  
  const emailMatches = $.html().match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  const phoneMatches = $.html().match(/(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
  
  if (emailMatches || phoneMatches) {
    content.contactInfo = {};
    if (emailMatches) {
      const validEmail = emailMatches.find(e => !e.includes('example') && !e.includes('test'));
      if (validEmail) content.contactInfo.email = validEmail;
    }
    if (phoneMatches) content.contactInfo.phone = phoneMatches[0];
  }
  
  const socialPatterns = [
    { pattern: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi, platform: 'facebook' },
    { pattern: /https?:\/\/(?:www\.)?twitter\.com\/[^\s"'<>]+/gi, platform: 'twitter' },
    { pattern: /https?:\/\/(?:www\.)?x\.com\/[^\s"'<>]+/gi, platform: 'x' },
    { pattern: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi, platform: 'instagram' },
    { pattern: /https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/gi, platform: 'linkedin' },
    { pattern: /https?:\/\/(?:www\.)?youtube\.com\/[^\s"'<>]+/gi, platform: 'youtube' },
    { pattern: /https?:\/\/(?:www\.)?tiktok\.com\/[^\s"'<>]+/gi, platform: 'tiktok' },
    { pattern: /https?:\/\/(?:www\.)?pinterest\.com\/[^\s"'<>]+/gi, platform: 'pinterest' },
    { pattern: /https?:\/\/(?:www\.)?threads\.net\/[^\s"'<>]+/gi, platform: 'threads' },
    { pattern: /https?:\/\/(?:www\.)?bsky\.app\/[^\s"'<>]+/gi, platform: 'bluesky' },
  ];
  
  const html = $.html();
  const socialLinks: { platform: string; url: string }[] = [];
  const seenPlatforms = new Set<string>();
  
  for (const { pattern, platform } of socialPatterns) {
    const matches = html.match(pattern);
    if (matches && !seenPlatforms.has(platform)) {
      seenPlatforms.add(platform);
      let url = matches[0].replace(/["'<>].*$/, '').replace(/\/$/, '');
      socialLinks.push({ platform, url });
    }
  }
  
  if (socialLinks.length > 0) {
    content.socialLinks = socialLinks;
  }
  
  return content;
}

function extractFontsWithCheerio($: cheerio.CheerioAPI, css: string): string[] {
  const fonts = new Set<string>();
  const genericFonts = ['inherit', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana'];
  
  const fontFamilyRegex = /font-family:\s*["']?([^"';,}]+)/gi;
  let match;
  while ((match = fontFamilyRegex.exec(css)) !== null) {
    const font = match[1].trim().replace(/["']/g, '');
    if (!genericFonts.some(g => font.toLowerCase().includes(g.toLowerCase()))) {
      fonts.add(font);
    }
  }
  
  $('link[href*="fonts.googleapis.com"], link[href*="fonts.google.com"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const familyMatch = href.match(/family=([^&:]+)/);
    if (familyMatch) {
      const fontFamily = decodeURIComponent(familyMatch[1]).replace(/\+/g, ' ').split('|')[0];
      fonts.add(fontFamily);
    }
  });
  
  $('link[href*="use.typekit.net"]').each((_, el) => {
    fonts.add('Adobe Fonts (Typekit)');
  });
  
  return Array.from(fonts).slice(0, 8);
}

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchCSSFiles($: cheerio.CheerioAPI, baseUrl: string): Promise<string> {
  const cssUrls: string[] = [];
  
  $('link[rel="stylesheet"]').each((_, el) => {
    let href = $(el).attr('href');
    if (href) {
      try {
        if (href.startsWith('//')) {
          href = 'https:' + href;
        } else if (href.startsWith('/')) {
          href = new URL(href, baseUrl).href;
        } else if (!href.startsWith('http')) {
          href = new URL(href, baseUrl).href;
        }
        cssUrls.push(href);
      } catch {}
    }
  });
  
  const inlineCSS = $('style').map((_, el) => $(el).text()).get().join('\n');
  
  const cssPromises = cssUrls.slice(0, 5).map(cssUrl => 
    limit(async () => {
      try {
        const response = await fetchWithTimeout(cssUrl, CSS_FETCH_TIMEOUT);
        if (response.ok) {
          return await response.text();
        }
      } catch (e) {
        console.log(`[WebsiteScanner] Failed to fetch CSS: ${cssUrl}`);
      }
      return '';
    })
  );
  
  const externalCSS = (await Promise.all(cssPromises)).join('\n');
  return inlineCSS + '\n' + externalCSS;
}

function isContentEmpty($: cheerio.CheerioAPI): boolean {
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const imgCount = $('img').length;
  const linkCount = $('a').length;
  
  const hasReactRoot = $('#root, #app, #__next, [data-reactroot]').length > 0;
  const hasVueRoot = $('#app[data-v-app], [data-v-]').length > 0;
  const hasSvelteRoot = $('[class*="svelte-"]').length > 0;
  
  const isSPA = hasReactRoot || hasVueRoot || hasSvelteRoot;
  
  const isEmpty = bodyText.length < MIN_CONTENT_THRESHOLD && imgCount < 3 && linkCount < 5;
  
  return isEmpty && isSPA;
}

async function scanWithHeadless(url: string): Promise<{ html: string; success: boolean }> {
  console.log(`[WebsiteScanner] Attempting headless scan for: ${url}`);
  
  try {
    const playwright = await import('playwright');
    
    const browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    
    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
      });
      
      const page = await context.newPage();
      
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: HEADLESS_TIMEOUT,
      });
      
      await page.waitForTimeout(2000);
      
      const html = await page.content();
      
      await browser.close();
      
      console.log(`[WebsiteScanner] Headless scan successful, got ${html.length} bytes`);
      return { html, success: true };
    } catch (e) {
      await browser.close();
      throw e;
    }
  } catch (error: any) {
    console.error(`[WebsiteScanner] Headless scan failed:`, error.message);
    return { html: '', success: false };
  }
}

function getDomainFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

async function updateScanProgress(jobId: string, progress: ScanProgress): Promise<void> {
  try {
    await db
      .update(socialBrandScanJobs)
      .set({
        scanResult: {
          progress: progress.progress,
          status: progress.status,
          message: progress.message,
        },
      })
      .where(eq(socialBrandScanJobs.id, jobId));
  } catch (e) {
    console.error('[WebsiteScanner] Failed to update progress:', e);
  }
}

export async function scanWebsite(url: string, jobId?: string): Promise<WebsiteScanResult> {
  try {
    const parsedUrl = new URL(url);
    const baseUrl = parsedUrl.origin;
    const domain = getDomainFromUrl(url);
    
    console.log(`[WebsiteScanner] Starting scan for: ${url} (domain: ${domain})`);
    
    if (jobId) {
      await updateScanProgress(jobId, { status: 'fetching', progress: 10, message: 'Fetching website...' });
    }
    
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    let html = await response.text();
    let usedHeadless = false;
    
    let $ = cheerio.load(html);
    
    if (isContentEmpty($)) {
      console.log(`[WebsiteScanner] Detected SPA/React site with minimal content, trying headless...`);
      
      if (jobId) {
        await updateScanProgress(jobId, { status: 'fetching', progress: 20, message: 'Rendering JavaScript content...' });
      }
      
      const headlessResult = await scanWithHeadless(url);
      if (headlessResult.success) {
        html = headlessResult.html;
        $ = cheerio.load(html);
        usedHeadless = true;
        console.log(`[WebsiteScanner] Successfully rendered with headless browser`);
      } else {
        console.log(`[WebsiteScanner] Headless failed, continuing with static HTML`);
      }
    }
    
    if (jobId) {
      await updateScanProgress(jobId, { status: 'extracting_css', progress: 40, message: 'Extracting styles...' });
    }
    
    const css = await fetchCSSFiles($, baseUrl);
    
    if (jobId) {
      await updateScanProgress(jobId, { status: 'extracting_images', progress: 60, message: 'Finding images and logos...' });
    }
    
    const colors = extractColorsFromCSS(css + html);
    const images = extractImagesWithCheerio($, baseUrl);
    
    if (jobId) {
      await updateScanProgress(jobId, { status: 'extracting_content', progress: 80, message: 'Extracting content...' });
    }
    
    const content = extractContentWithCheerio($);
    const fonts = extractFontsWithCheerio($, css);
    
    console.log(`[WebsiteScanner] Scan complete. Found: ${colors.length} colors, ${images.length} images, ${fonts.length} fonts`);
    
    return {
      colors,
      images,
      content,
      fonts,
      domain,
      usedHeadless,
    };
  } catch (error: any) {
    console.error('[WebsiteScanner] Error scanning website:', error.message);
    return {
      colors: [],
      images: [],
      content: {},
      domain: getDomainFromUrl(url),
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
    
    const result = await scanWebsite(job.targetUrl, jobId);
    
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
    
    await updateScanProgress(jobId, { status: 'completed', progress: 90, message: 'Saving results...' });
    
    const existingBusinessOverview = (brandKit.businessOverview as Record<string, any>) || {};
    const updatedBusinessOverview: Record<string, any> = {
      ...existingBusinessOverview,
      coreIdentity: result.content.title || existingBusinessOverview.coreIdentity,
      description: result.content.description || existingBusinessOverview.description,
      tagline: result.content.tagline || existingBusinessOverview.tagline,
    };
    
    if (result.content.aboutText) {
      updatedBusinessOverview.aboutUs = result.content.aboutText;
    }
    
    if (result.content.contactInfo?.email) {
      updatedBusinessOverview.contactEmail = result.content.contactInfo.email;
    }
    
    if (result.content.contactInfo?.phone) {
      updatedBusinessOverview.contactPhone = result.content.contactInfo.phone;
    }
    
    const existingContentPrefs = (brandKit.contentPreferences as Record<string, any>) || {};
    const updatedContentPrefs = { ...existingContentPrefs };
    
    if (result.content.socialLinks && result.content.socialLinks.length > 0) {
      updatedContentPrefs.detectedSocialLinks = result.content.socialLinks;
    }
    
    await db
      .update(socialBrandKits)
      .set({
        businessOverview: updatedBusinessOverview,
        contentPreferences: updatedContentPrefs,
        visualIdentityDescription: result.content.description || brandKit.visualIdentityDescription,
        colors: result.colors.length > 0 ? result.colors : brandKit.colors,
        fonts: result.fonts && result.fonts.length > 0 ? result.fonts : brandKit.fonts,
        scanStatus: 'completed',
        lastScanAt: new Date(),
      })
      .where(eq(socialBrandKits.id, job.brandKitId));
    
    const domain = result.domain || 'scanned';
    const folder = `scan-${domain}`;
    
    const logoImages = result.images.filter(img => img.type === 'logo').slice(0, 5);
    for (const image of logoImages) {
      const mimeType = image.url.includes('.png') ? 'image/png' : 
                       image.url.includes('.svg') ? 'image/svg+xml' :
                       image.url.includes('.webp') ? 'image/webp' : 'image/jpeg';
      
      const existingAsset = await db.query.socialBrandAssets.findFirst({
        where: eq(socialBrandAssets.url, image.url),
      });
      
      if (!existingAsset) {
        await db.insert(socialBrandAssets).values({
          brandKitId: job.brandKitId,
          type: 'image',
          filename: image.alt || 'logo',
          url: image.url,
          mimeType: mimeType,
          folder: folder,
          sourceUrl: job.targetUrl,
          isSuggested: true,
        });
      }
    }
    
    const heroImages = result.images.filter(img => img.type === 'hero').slice(0, 5);
    for (const image of heroImages) {
      const mimeType = image.url.includes('.png') ? 'image/png' : 
                       image.url.includes('.webp') ? 'image/webp' : 'image/jpeg';
      
      const existingAsset = await db.query.socialBrandAssets.findFirst({
        where: eq(socialBrandAssets.url, image.url),
      });
      
      if (!existingAsset) {
        await db.insert(socialBrandAssets).values({
          brandKitId: job.brandKitId,
          type: 'image',
          filename: image.alt || 'hero-image',
          url: image.url,
          mimeType: mimeType,
          folder: folder,
          sourceUrl: job.targetUrl,
          isSuggested: true,
        });
      }
    }
    
    const otherImages = result.images.filter(img => img.type === 'other').slice(0, 10);
    for (const image of otherImages) {
      const mimeType = image.url.includes('.png') ? 'image/png' : 
                       image.url.includes('.webp') ? 'image/webp' : 'image/jpeg';
      
      const existingAsset = await db.query.socialBrandAssets.findFirst({
        where: eq(socialBrandAssets.url, image.url),
      });
      
      if (!existingAsset) {
        await db.insert(socialBrandAssets).values({
          brandKitId: job.brandKitId,
          type: 'image',
          filename: image.alt || 'image',
          url: image.url,
          mimeType: mimeType,
          folder: folder,
          sourceUrl: job.targetUrl,
          isSuggested: true,
        });
      }
    }
    
    await db
      .update(socialBrandScanJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        scanResult: {
          progress: 100,
          status: 'completed',
          message: 'Scan complete',
          colors: result.colors,
          fonts: result.fonts,
          usedHeadless: result.usedHeadless,
          domain: result.domain,
          logos: logoImages.map(img => img.url),
          images: result.images.map(img => ({ url: img.url, type: img.type, alt: img.alt })),
          textContent: {
            title: result.content.title,
            description: result.content.description,
            tagline: result.content.tagline,
            aboutContent: result.content.aboutText,
            socialLinks: result.content.socialLinks,
          },
        },
      })
      .where(eq(socialBrandScanJobs.id, jobId));
    
    console.log(`[WebsiteScanner] Successfully scanned ${job.targetUrl} (headless: ${result.usedHeadless})`);
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

export async function acceptSuggestedAsset(assetId: string): Promise<boolean> {
  try {
    await db
      .update(socialBrandAssets)
      .set({ 
        isSuggested: false,
        approvedAt: new Date(),
      })
      .where(eq(socialBrandAssets.id, assetId));
    return true;
  } catch (error) {
    console.error('[WebsiteScanner] Error accepting asset:', error);
    return false;
  }
}

export async function dismissSuggestedAsset(assetId: string): Promise<boolean> {
  try {
    await db
      .delete(socialBrandAssets)
      .where(eq(socialBrandAssets.id, assetId));
    return true;
  } catch (error) {
    console.error('[WebsiteScanner] Error dismissing asset:', error);
    return false;
  }
}
