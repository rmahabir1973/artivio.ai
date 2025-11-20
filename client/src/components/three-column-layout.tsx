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
      <div className="flex h-full">
        {/* Optional Left Sidebar (for additional navigation/filters) */}
        {sidebar && (
          <aside className="w-64 border-r flex-shrink-0 hidden lg:block">
            <ScrollArea className="h-full">
              <div className="p-4">{sidebar}</div>
            </ScrollArea>
          </aside>
        )}

        {/* Center Form Panel */}
        <div
          className={`flex-1 ${
            showPreview ? "lg:max-w-xl xl:max-w-2xl" : ""
          } border-r`}
        >
          <ScrollArea className="h-full">
            <div className="p-6">{form}</div>
          </ScrollArea>
        </div>

        {/* Right Preview Panel */}
        {showPreview && preview && (
          <div className="hidden lg:block flex-1">
            <div className="h-full flex items-center justify-center bg-muted/20">
              {preview}
            </div>
          </div>
        )}
      </div>
    </SidebarInset>
  );
}
