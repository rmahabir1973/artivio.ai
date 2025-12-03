import { BetaAnalyticsDataClient } from '@google-analytics/data';

const GA_PROPERTY_ID = process.env.GA_PROPERTY_ID;
const GA_CLIENT_EMAIL = process.env.GA_DATA_CLIENT_EMAIL;
const GA_PRIVATE_KEY = process.env.GA_DATA_PRIVATE_KEY?.replace(/\\n/g, '\n');

// Debug logging at startup
console.log('[Google Analytics] Configuration check:', {
  hasPropertyId: !!GA_PROPERTY_ID,
  hasClientEmail: !!GA_CLIENT_EMAIL,
  hasPrivateKey: !!GA_PRIVATE_KEY,
  propertyIdLength: GA_PROPERTY_ID?.length || 0,
  clientEmailLength: GA_CLIENT_EMAIL?.length || 0,
  privateKeyLength: GA_PRIVATE_KEY?.length || 0,
});

let analyticsClient: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient {
  if (!analyticsClient) {
    if (!GA_CLIENT_EMAIL || !GA_PRIVATE_KEY || !GA_PROPERTY_ID) {
      throw new Error('Google Analytics credentials not configured');
    }
    
    analyticsClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: GA_CLIENT_EMAIL,
        private_key: GA_PRIVATE_KEY,
      },
    });
  }
  return analyticsClient;
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const REALTIME_CACHE_TTL = 60 * 1000; // 1 minute for realtime

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T, ttl: number = CACHE_TTL): void {
  cache.set(key, { data, expiry: Date.now() + ttl });
}

export async function getTrafficOverview(days: number = 30) {
  const cacheKey = `traffic_overview_${days}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const client = getClient();
  const [response] = await client.runReport({
    property: `properties/${GA_PROPERTY_ID}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  });

  const dailyData = response.rows?.map(row => ({
    date: row.dimensionValues?.[0]?.value || '',
    users: parseInt(row.metricValues?.[0]?.value || '0'),
    sessions: parseInt(row.metricValues?.[1]?.value || '0'),
    pageViews: parseInt(row.metricValues?.[2]?.value || '0'),
    avgSessionDuration: parseFloat(row.metricValues?.[3]?.value || '0'),
    bounceRate: parseFloat(row.metricValues?.[4]?.value || '0'),
  })) || [];

  const totals = dailyData.reduce(
    (acc, day) => ({
      users: acc.users + day.users,
      sessions: acc.sessions + day.sessions,
      pageViews: acc.pageViews + day.pageViews,
      avgSessionDuration: acc.avgSessionDuration + day.avgSessionDuration,
    }),
    { users: 0, sessions: 0, pageViews: 0, avgSessionDuration: 0 }
  );

  const result = {
    daily: dailyData,
    totals: {
      ...totals,
      avgSessionDuration: dailyData.length > 0 ? totals.avgSessionDuration / dailyData.length : 0,
    },
  };

  setCache(cacheKey, result);
  return result;
}

export async function getAcquisitionChannels(days: number = 30) {
  const cacheKey = `acquisition_channels_${days}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const client = getClient();
  const [response] = await client.runReport({
    property: `properties/${GA_PROPERTY_ID}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'newUsers' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });

  const result = response.rows?.map(row => ({
    channel: row.dimensionValues?.[0]?.value || 'Unknown',
    users: parseInt(row.metricValues?.[0]?.value || '0'),
    sessions: parseInt(row.metricValues?.[1]?.value || '0'),
    newUsers: parseInt(row.metricValues?.[2]?.value || '0'),
  })) || [];

  setCache(cacheKey, result);
  return result;
}

export async function getTopLandingPages(days: number = 30) {
  const cacheKey = `top_pages_${days}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const client = getClient();
  const [response] = await client.runReport({
    property: `properties/${GA_PROPERTY_ID}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'landingPage' }],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'bounceRate' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });

  const result = response.rows?.map(row => ({
    page: row.dimensionValues?.[0]?.value || '/',
    sessions: parseInt(row.metricValues?.[0]?.value || '0'),
    users: parseInt(row.metricValues?.[1]?.value || '0'),
    bounceRate: parseFloat(row.metricValues?.[2]?.value || '0'),
  })) || [];

  setCache(cacheKey, result);
  return result;
}

export async function getGeographicData(days: number = 30) {
  const cacheKey = `geo_data_${days}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const client = getClient();
  const [response] = await client.runReport({
    property: `properties/${GA_PROPERTY_ID}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'country' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
    ],
    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
    limit: 15,
  });

  const result = response.rows?.map(row => ({
    country: row.dimensionValues?.[0]?.value || 'Unknown',
    users: parseInt(row.metricValues?.[0]?.value || '0'),
    sessions: parseInt(row.metricValues?.[1]?.value || '0'),
  })) || [];

  setCache(cacheKey, result);
  return result;
}

export async function getDeviceBreakdown(days: number = 30) {
  const cacheKey = `device_breakdown_${days}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const client = getClient();
  const [response] = await client.runReport({
    property: `properties/${GA_PROPERTY_ID}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'deviceCategory' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
    ],
    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
  });

  const result = response.rows?.map(row => ({
    device: row.dimensionValues?.[0]?.value || 'Unknown',
    users: parseInt(row.metricValues?.[0]?.value || '0'),
    sessions: parseInt(row.metricValues?.[1]?.value || '0'),
  })) || [];

  setCache(cacheKey, result);
  return result;
}

export async function getRealtimeUsers() {
  const cacheKey = 'realtime_users';
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const client = getClient();
  const [response] = await client.runRealtimeReport({
    property: `properties/${GA_PROPERTY_ID}`,
    metrics: [{ name: 'activeUsers' }],
  });

  const activeUsers = parseInt(response.rows?.[0]?.metricValues?.[0]?.value || '0');
  const result = { activeUsers };

  setCache(cacheKey, result, REALTIME_CACHE_TTL);
  return result;
}

export async function getSiteAnalyticsSummary(days: number = 30) {
  try {
    const [traffic, channels, pages, geo, devices, realtime] = await Promise.all([
      getTrafficOverview(days),
      getAcquisitionChannels(days),
      getTopLandingPages(days),
      getGeographicData(days),
      getDeviceBreakdown(days),
      getRealtimeUsers(),
    ]);

    return {
      traffic,
      channels,
      pages,
      geo,
      devices,
      realtime,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('[Google Analytics] Error fetching summary:', error.message);
    throw error;
  }
}

export function isGoogleAnalyticsConfigured(): boolean {
  const configured = !!(GA_CLIENT_EMAIL && GA_PRIVATE_KEY && GA_PROPERTY_ID);
  console.log('[Google Analytics] isConfigured check:', {
    configured,
    hasPropertyId: !!GA_PROPERTY_ID,
    hasClientEmail: !!GA_CLIENT_EMAIL,
    hasPrivateKey: !!GA_PRIVATE_KEY,
    propertyIdPreview: GA_PROPERTY_ID ? `${GA_PROPERTY_ID.substring(0, 10)}...` : 'NOT SET',
    clientEmailPreview: GA_CLIENT_EMAIL ? `${GA_CLIENT_EMAIL.substring(0, 15)}...` : 'NOT SET',
  });
  return configured;
}
