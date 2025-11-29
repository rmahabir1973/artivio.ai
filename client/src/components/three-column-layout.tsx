import { ReactNode } from "react";
import { SidebarInset } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ThreeColumnLayoutProps {
  sidebar?: ReactNode;
  form: ReactNode;
  preview?: ReactNode;
  showPreview?: boolean;
}

export function ThreeColumnLayout({
  sidebar,
  form,
  preview,
  showPreview = true,
}: ThreeColumnLayoutProps) {
  return (
    <SidebarInset>
      <div className="flex min-h-screen w-full overflow-x-hidden">
        {/* Optional Left Sidebar (for additional navigation/filters) */}
        {sidebar && (
          <aside className="w-64 border-r flex-shrink-0 hidden lg:block">
            <div className="min-h-screen overflow-y-auto">
              <div className="p-4">{sidebar}</div>
            </div>
          </aside>
        )}

        {/* Center Form Panel - Narrower to give more space to video */}
        <div
          className={`flex-shrink-0 ${
            showPreview ? "w-full lg:w-[380px] xl:w-[420px]" : "flex-1"
          } border-r`}
        >
          <div className="min-h-screen overflow-y-auto">
            <div className="p-6">{form}</div>
          </div>
        </div>

        {/* Right Preview Panel - Takes remaining space for larger video */}
        {showPreview && preview && (
          <div className="hidden lg:flex flex-1 min-w-0">
            <div className="min-h-screen w-full flex items-start justify-center p-8 bg-muted/10">
              <div className="w-full max-w-4xl">
                {preview}
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarInset>
  );
}
