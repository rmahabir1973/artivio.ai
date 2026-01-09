import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthProvider';
import { Bug, Send, Clock, AlertTriangle, AlertCircle, CheckCircle2, XCircle, Loader2, Edit, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const bugReportSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(500),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  stepsToReproduce: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  browserInfo: z.string().optional(),
  deviceInfo: z.string().optional(),
  reporterName: z.string().optional(),
  reporterEmail: z.string().email().optional().or(z.literal('')),
  pageUrl: z.string().optional(),
});

type BugReportForm = z.infer<typeof bugReportSchema>;

type BugReport = {
  id: string;
  title: string;
  description: string;
  stepsToReproduce: string | null;
  severity: string;
  browserInfo: string | null;
  deviceInfo: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  pageUrl: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

const severityConfig = {
  low: { icon: Clock, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', label: 'Low' },
  medium: { icon: AlertTriangle, color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', label: 'Medium' },
  high: { icon: AlertCircle, color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', label: 'High' },
  critical: { icon: Bug, color: 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Critical' },
};

const statusConfig = {
  open: { icon: AlertCircle, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', label: 'Open' },
  in_progress: { icon: Clock, color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', label: 'In Progress' },
  resolved: { icon: CheckCircle2, color: 'bg-green-500/10 text-green-500 border-green-500/20', label: 'Resolved' },
  closed: { icon: XCircle, color: 'bg-gray-500/10 text-gray-500 border-gray-500/20', label: 'Closed' },
  wont_fix: { icon: XCircle, color: 'bg-gray-500/10 text-gray-500 border-gray-500/20', label: "Won't Fix" },
};

export default function BugsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingBug, setEditingBug] = useState<BugReport | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  
  const isAdmin = user?.isAdmin === true;

  const form = useForm<BugReportForm>({
    resolver: zodResolver(bugReportSchema),
    defaultValues: {
      title: '',
      description: '',
      stepsToReproduce: '',
      severity: 'medium',
      browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      deviceInfo: typeof navigator !== 'undefined' ? `${navigator.platform || 'Unknown'}` : '',
      reporterName: '',
      reporterEmail: '',
      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    },
  });

  const { data: bugs = [], isLoading } = useQuery<BugReport[]>({
    queryKey: ['/api/bugs'],
  });

  const submitMutation = useMutation({
    mutationFn: async (data: BugReportForm) => {
      const cleanData = {
        ...data,
        reporterEmail: data.reporterEmail || undefined,
      };
      const response = await fetch('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit bug report');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Bug Report Submitted',
        description: 'Thank you for your report! Our team will review it soon.',
      });
      form.reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/bugs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit bug report',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: BugReportForm) => {
    submitMutation.mutate(data);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes: string }) => {
      const response = await fetch(`/api/admin/bugs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, adminNotes }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update bug');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Bug Updated', description: 'Bug status and notes saved successfully.' });
      setEditingBug(null);
      queryClient.invalidateQueries({ queryKey: ['/api/bugs'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const openEditDialog = (bug: BugReport) => {
    setEditingBug(bug);
    setEditStatus(bug.status);
    setEditNotes(bug.adminNotes || '');
  };

  const handleSaveEdit = () => {
    if (editingBug) {
      updateMutation.mutate({ id: editingBug.id, status: editStatus, adminNotes: editNotes });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Bug className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Artivio AI Bug Tracker</h1>
          </div>
          <p className="text-muted-foreground">
            Help us improve by reporting issues you encounter during testing.
          </p>
          <p className="text-sm text-muted-foreground">
            Target launch: February 1, 2026
          </p>
        </div>

        <div className="flex justify-center">
          <Button
            onClick={() => setShowForm(!showForm)}
            size="lg"
            data-testid="button-toggle-form"
          >
            {showForm ? 'Cancel' : 'Report a Bug'}
          </Button>
        </div>

        {showForm && (
          <Card data-testid="bug-report-form">
            <CardHeader>
              <CardTitle>Submit Bug Report</CardTitle>
              <CardDescription>
                Please provide as much detail as possible to help us reproduce and fix the issue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="reporterName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your Name (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} data-testid="input-reporter-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="reporterEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your Email (optional)</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} data-testid="input-reporter-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bug Title *</FormLabel>
                        <FormControl>
                          <Input placeholder="Brief description of the issue" {...field} data-testid="input-bug-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Severity *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-severity">
                              <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low - Minor issue, easy workaround</SelectItem>
                            <SelectItem value="medium">Medium - Annoying but workable</SelectItem>
                            <SelectItem value="high">High - Significant impact on usage</SelectItem>
                            <SelectItem value="critical">Critical - Completely blocks functionality</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe what happened and what you expected to happen"
                            className="min-h-[100px]"
                            {...field}
                            data-testid="input-bug-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stepsToReproduce"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Steps to Reproduce (optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
                            className="min-h-[80px]"
                            {...field}
                            data-testid="input-steps"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Page URL (auto-filled)</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-page-url" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={submitMutation.isPending}
                    data-testid="button-submit-bug"
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Bug Report
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Reported Issues ({bugs.length})
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : bugs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Bug className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No bugs reported yet.</p>
                <p className="text-sm text-muted-foreground">Be the first to report an issue!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {bugs.map((bug) => {
                const severity = severityConfig[bug.severity as keyof typeof severityConfig] || severityConfig.medium;
                const status = statusConfig[bug.status as keyof typeof statusConfig] || statusConfig.open;
                const SeverityIcon = severity.icon;
                const StatusIcon = status.icon;

                return (
                  <Card key={bug.id} data-testid={`bug-report-${bug.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium" data-testid={`bug-title-${bug.id}`}>{bug.title}</h3>
                            <Badge variant="outline" className={severity.color}>
                              <SeverityIcon className="h-3 w-3 mr-1" />
                              {severity.label}
                            </Badge>
                            <Badge variant="outline" className={status.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{bug.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {bug.reporterName && (
                              <span>Reported by: {bug.reporterName}</span>
                            )}
                            <span>
                              {formatDistanceToNow(new Date(bug.createdAt), { addSuffix: true })}
                            </span>
                            {bug.pageUrl && (
                              <span className="truncate max-w-[200px]" title={bug.pageUrl}>
                                Page: {bug.pageUrl.replace(/^https?:\/\/[^/]+/, '')}
                              </span>
                            )}
                          </div>
                          {bug.adminNotes && (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                              <span className="font-medium">Admin Notes: </span>
                              {bug.adminNotes}
                            </div>
                          )}
                        </div>
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(bug)}
                            data-testid={`button-edit-bug-${bug.id}`}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Respond
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-center text-sm text-muted-foreground pt-6 border-t">
          <p>Thank you for helping us make Artivio AI better!</p>
          <p>For urgent issues, please contact us directly.</p>
        </div>
      </div>

      <Dialog open={!!editingBug} onOpenChange={(open) => !open && setEditingBug(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Respond to Bug Report
            </DialogTitle>
            <DialogDescription>
              {editingBug?.title}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="wont_fix">Won't Fix</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Notes / Response</label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes, response, or resolution details..."
                className="min-h-[100px]"
                data-testid="input-edit-notes"
              />
            </div>

            {editingBug && (
              <div className="p-3 bg-muted rounded-md text-sm space-y-1">
                <p><span className="font-medium">Reporter:</span> {editingBug.reporterName || 'Anonymous'}</p>
                {editingBug.reporterEmail && (
                  <p><span className="font-medium">Email:</span> {editingBug.reporterEmail}</p>
                )}
                <p><span className="font-medium">Severity:</span> {editingBug.severity}</p>
                <p><span className="font-medium">Description:</span> {editingBug.description}</p>
                {editingBug.stepsToReproduce && (
                  <p><span className="font-medium">Steps:</span> {editingBug.stepsToReproduce}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBug(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending} data-testid="button-save-edit">
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
