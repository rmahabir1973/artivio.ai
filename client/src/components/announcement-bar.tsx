import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, AlertCircle, Info, CheckCircle2, Megaphone } from "lucide-react";
import type { Announcement } from "@shared/schema";

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements/active"],
    refetchInterval: 60000, // Refetch every minute
  });

  useEffect(() => {
    const stored = localStorage.getItem("dismissed_announcements");
    if (stored) {
      try {
        setDismissed(new Set(JSON.parse(stored)));
      } catch (e) {
        // Invalid data, ignore
      }
    }
  }, []);

  // Create unique dismissal key that includes updatedAt timestamp
  // This ensures edited announcements redisplay to users who dismissed the old version
  const getDismissalKey = (announcement: Announcement) => {
    const timestamp = announcement.updatedAt ? new Date(announcement.updatedAt).getTime() : 0;
    return `${announcement.id}-${timestamp}`;
  };

  const handleDismiss = (announcement: Announcement) => {
    const dismissalKey = getDismissalKey(announcement);
    const newDismissed = new Set(dismissed);
    newDismissed.add(dismissalKey);
    setDismissed(newDismissed);
    localStorage.setItem("dismissed_announcements", JSON.stringify(Array.from(newDismissed)));
  };

  const visibleAnnouncements = announcements.filter(a => !dismissed.has(getDismissalKey(a)));

  if (visibleAnnouncements.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case "warning": return <AlertCircle className="h-4 w-4" />;
      case "success": return <CheckCircle2 className="h-4 w-4" />;
      case "promo": return <Megaphone className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getStyles = (type: string) => {
    switch (type) {
      case "warning": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "success": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "promo": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default: return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <div className="space-y-1">
      {visibleAnnouncements.map(announcement => (
        <div
          key={announcement.id}
          className={`border-b ${getStyles(announcement.type)} px-4 py-2 flex items-center justify-between gap-4`}
          data-testid="announcement-bar"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {getIcon(announcement.type)}
            <p className="text-sm truncate">{announcement.message}</p>
          </div>
          <button
            onClick={() => handleDismiss(announcement)}
            className="p-1 hover:bg-background/50 rounded-sm transition-colors flex-shrink-0"
            aria-label="Dismiss announcement"
            data-testid="button-dismiss-announcement"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
