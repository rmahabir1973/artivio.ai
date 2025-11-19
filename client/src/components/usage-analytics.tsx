import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  Activity,
  BarChart3,
  PieChart,
  Calendar
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { fetchWithAuth } from "@/lib/queryClient";

type AnalyticsData = {
  totalCreditsSpent: number;
  totalGenerations: number;
  successRate: number;
  byFeatureType: Array<{ type: string; count: number; credits: number }>;
  byModel: Array<{ model: string; count: number; credits: number }>;
  dailyTrends: Array<{ date: string; credits: number; count: number }>;
};

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const FEATURE_LABELS: Record<string, string> = {
  video: "Video Generation",
  image: "Image Generation",
  music: "Music Generation",
  chat: "AI Chat",
  voice: "Voice Cloning",
  unknown: "Other",
};

export function UsageAnalytics() {
  const [selectedPeriod, setSelectedPeriod] = useState<7 | 30 | 90>(30);
  const { user } = useAuth();

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", { days: selectedPeriod }],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/analytics?days=${selectedPeriod}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage Analytics</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return null;
  }

  const avgDailyCredits = analytics.dailyTrends.length > 0
    ? analytics.totalCreditsSpent / analytics.dailyTrends.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Usage Analytics</h2>
          <p className="text-muted-foreground">Track your AI generation usage and trends</p>
        </div>
        <Tabs value={selectedPeriod.toString()} onValueChange={(v) => setSelectedPeriod(parseInt(v) as 7 | 30 | 90)}>
          <TabsList data-testid="tabs-analytics-period">
            <TabsTrigger value="7" data-testid="tab-7-days">7 Days</TabsTrigger>
            <TabsTrigger value="30" data-testid="tab-30-days">30 Days</TabsTrigger>
            <TabsTrigger value="90" data-testid="tab-90-days">90 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Key Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits Spent</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-credits">
              {analytics.totalCreditsSpent.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {avgDailyCredits.toFixed(1)} avg per day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Generations</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-generations">
              {analytics.totalGenerations.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last {selectedPeriod} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            {analytics.successRate >= 80 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-yellow-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-success-rate">
              {analytics.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Successful completions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cost per Gen</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-avg-cost">
              {analytics.totalGenerations > 0 
                ? (analytics.totalCreditsSpent / analytics.totalGenerations).toFixed(0)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Credits per generation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3" data-testid="tabs-analytics-charts">
          <TabsTrigger value="trends" data-testid="tab-trends">
            <Calendar className="h-4 w-4 mr-2" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="features" data-testid="tab-features">
            <BarChart3 className="h-4 w-4 mr-2" />
            By Feature
          </TabsTrigger>
          <TabsTrigger value="models" data-testid="tab-models">
            <PieChart className="h-4 w-4 mr-2" />
            By Model
          </TabsTrigger>
        </TabsList>

        {/* Daily Trends Chart */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Usage Trends</CardTitle>
              <CardDescription>Credit spending and generation count over time</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {analytics.dailyTrends.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No usage data available for the selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.dailyTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      className="text-xs"
                    />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" />
                    <Tooltip 
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem'
                      }}
                    />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="credits" 
                      name="Credits Spent"
                      stroke={COLORS[0]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="count" 
                      name="Generations"
                      stroke={COLORS[1]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Feature Type */}
        <TabsContent value="features" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Usage by Feature</CardTitle>
                <CardDescription>Credits spent per AI feature</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {analytics.byFeatureType.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No feature usage data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.byFeatureType}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="type" 
                        tickFormatter={(type) => FEATURE_LABELS[type] || type}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        labelFormatter={(type) => FEATURE_LABELS[type] || type}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '0.5rem'
                        }}
                      />
                      <Bar dataKey="credits" name="Credits" fill={COLORS[2]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature Breakdown</CardTitle>
                <CardDescription>Detailed statistics by feature type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.byFeatureType.map((item, index) => (
                    <div key={item.type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">{FEATURE_LABELS[item.type] || item.type}</span>
                        </div>
                        <Badge variant="secondary">{item.count} gens</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{item.credits.toLocaleString()} credits</span>
                        <span>
                          {analytics.totalCreditsSpent > 0 
                            ? ((item.credits / analytics.totalCreditsSpent) * 100).toFixed(1) 
                            : 0}%
                        </span>
                      </div>
                      {index < analytics.byFeatureType.length - 1 && <Separator className="mt-2" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* By Model */}
        <TabsContent value="models" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Usage by Model</CardTitle>
                <CardDescription>Distribution of AI models used</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {analytics.byModel.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No model usage data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie
                        data={analytics.byModel.slice(0, 5)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ model, percent }) => 
                          `${model}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="credits"
                      >
                        {analytics.byModel.slice(0, 5).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '0.5rem'
                        }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Model Rankings</CardTitle>
                <CardDescription>Top models by usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.byModel.slice(0, 10).map((item, index) => (
                    <div key={item.model} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                            {index + 1}
                          </Badge>
                          <span className="font-medium font-mono text-sm">{item.model}</span>
                        </div>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.credits.toLocaleString()} credits
                      </div>
                      {index < Math.min(analytics.byModel.length, 10) - 1 && <Separator className="mt-2" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
