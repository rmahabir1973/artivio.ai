import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Save,
  FolderOpen,
  Trash2,
  Clock,
  TrendingUp,
  Star,
  Edit,
  Plus
} from "lucide-react";

type GenerationTemplate = {
  id: string;
  userId: string;
  featureType: string;
  name: string;
  description?: string;
  prompt: string;
  model?: string;
  parameters?: any;
  isPublic: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

type TemplateManagerProps = {
  featureType: 'video' | 'image' | 'music' | 'chat';
  onLoadTemplate?: (template: GenerationTemplate) => void;
  currentPrompt?: string;
  currentModel?: string;
  currentParameters?: any;
  trigger?: React.ReactNode;
};

export function TemplateManager({
  featureType,
  onLoadTemplate,
  currentPrompt,
  currentModel,
  currentParameters,
  trigger,
}: TemplateManagerProps) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<GenerationTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  // Fetch user templates
  const { data: userTemplates = [], isLoading: userLoading } = useQuery<GenerationTemplate[]>({
    queryKey: ['/api/templates', { featureType }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (featureType) params.append('featureType', featureType);
      const url = `/api/templates${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
    enabled: open && isAuthenticated,
  });

  // Fetch public templates
  const { data: publicTemplates = [], isLoading: publicLoading } = useQuery<GenerationTemplate[]>({
    queryKey: ['/api/templates/public', { featureType }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (featureType) params.append('featureType', featureType);
      const url = `/api/templates/public${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch public templates');
      return response.json();
    },
    enabled: open,
  });

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      if (!currentPrompt) {
        throw new Error("No prompt to save");
      }
      return apiRequest('/api/templates', 'POST', {
        name: data.name,
        description: data.description,
        prompt: currentPrompt,
        model: currentModel,
        parameters: currentParameters,
        featureType,
        isPublic: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      setSaveDialogOpen(false);
      setTemplateName("");
      setTemplateDescription("");
      toast({
        title: "Template Saved",
        description: "Your template has been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save template",
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/templates/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
      toast({
        title: "Template Deleted",
        description: "Your template has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        variant: "destructive",
      });
    },
  });

  // Use template mutation
  const useMutation_ = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/templates/${id}/use`, 'POST');
    },
  });

  const handleLoadTemplate = (template: GenerationTemplate) => {
    useMutation_.mutate(template.id);
    onLoadTemplate?.(template);
    setOpen(false);
    toast({
      title: "Template Loaded",
      description: `"${template.name}" has been loaded.`,
    });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast({
        title: "Error",
        description: "Template name is required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      name: templateName,
      description: templateDescription,
    });
  };

  const handleDeleteTemplate = () => {
    if (selectedTemplate) {
      deleteMutation.mutate(selectedTemplate.id);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button 
              variant="outline" 
              className="gap-2" 
              data-testid="button-template-manager"
              disabled={!isAuthenticated}
              onClick={(e) => {
                if (!isAuthenticated) {
                  e.preventDefault();
                  toast({
                    title: "Login Required",
                    description: "Please log in to access templates",
                    variant: "destructive",
                  });
                }
              }}
            >
              <FolderOpen className="h-4 w-4" />
              Templates
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Template Manager</DialogTitle>
            <DialogDescription>
              Save and load prompt templates for quick generation
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 mb-4">
            <Button
              onClick={() => setSaveDialogOpen(true)}
              disabled={!currentPrompt}
              className="gap-2"
              data-testid="button-save-template"
            >
              <Save className="h-4 w-4" />
              Save Current
            </Button>
          </div>

          <Tabs defaultValue="my-templates" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="my-templates" data-testid="tab-my-templates">
                My Templates ({userTemplates.length})
              </TabsTrigger>
              <TabsTrigger value="public-templates" data-testid="tab-public-templates">
                Public ({publicTemplates.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="my-templates" className="flex-1 overflow-y-auto mt-4">
              {userLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : userTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Save className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No saved templates yet</p>
                  <p className="text-sm mt-1">Save your current prompt to create your first template</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {userTemplates.map((template) => (
                    <Card key={template.id} className="hover-elevate">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate">{template.name}</CardTitle>
                            {template.description && (
                              <CardDescription className="line-clamp-2 mt-1">
                                {template.description}
                              </CardDescription>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedTemplate(template);
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-${template.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground line-clamp-2">{template.prompt}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            {template.model && (
                              <Badge variant="outline" className="text-xs">
                                {template.model}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              <span>{template.usageCount} uses</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleLoadTemplate(template)}
                            className="w-full mt-2"
                            size="sm"
                            data-testid={`button-load-${template.id}`}
                          >
                            Load Template
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="public-templates" className="flex-1 overflow-y-auto mt-4">
              {publicLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : publicTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No public templates available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {publicTemplates.map((template) => (
                    <Card key={template.id} className="hover-elevate">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate">{template.name}</CardTitle>
                            {template.description && (
                              <CardDescription className="line-clamp-2 mt-1">
                                {template.description}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground line-clamp-2">{template.prompt}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            {template.model && (
                              <Badge variant="outline" className="text-xs">
                                {template.model}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              <span>{template.usageCount} uses</span>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleLoadTemplate(template)}
                            className="w-full mt-2"
                            size="sm"
                            data-testid={`button-load-public-${template.id}`}
                          >
                            Load Template
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Template</DialogTitle>
            <DialogDescription>
              Save your current prompt and settings as a reusable template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                placeholder="e.g., Product Showcase Video"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">Description (Optional)</Label>
              <Textarea
                id="template-description"
                placeholder="Describe what this template is for..."
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={3}
                data-testid="input-template-description"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setSaveDialogOpen(false)}
                data-testid="button-cancel-save"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={createMutation.isPending}
                data-testid="button-confirm-save"
              >
                {createMutation.isPending ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
