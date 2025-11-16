import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Award } from "lucide-react";

interface LeaderboardEntry {
  userId: string;
  userName: string;
  profileImageUrl: string | null;
  totalReferrals: number;
  totalCreditsEarned: number;
}

export default function LeaderboardPage() {
  const { data: leaderboard, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/referral/leaderboard?limit=50"],
  });

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 1:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 2:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>;
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(p => p);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl" data-testid="page-leaderboard">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Referral Leaderboard</h1>
        <p className="text-muted-foreground text-lg">
          Top referrers who are earning the most credits by sharing Artivio AI
        </p>
      </div>

      {leaderboard && leaderboard.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Top Referrers</CardTitle>
            <CardDescription>
              The most successful members of our referral program
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                    index < 3 ? 'bg-accent/50' : 'hover:bg-accent/30'
                  }`}
                  data-testid={`leaderboard-entry-${index}`}
                >
                  <div className="flex items-center justify-center w-12">
                    {getRankIcon(index)}
                  </div>

                  <Avatar className="h-12 w-12">
                    <AvatarImage src={entry.profileImageUrl || undefined} alt={entry.userName} />
                    <AvatarFallback>{getInitials(entry.userName)}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <p className="font-medium" data-testid={`text-username-${index}`}>
                      {entry.userName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {entry.totalReferrals} {entry.totalReferrals === 1 ? 'referral' : 'referrals'}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-primary text-lg" data-testid={`text-credits-${index}`}>
                      {entry.totalCreditsEarned.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">credits earned</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Trophy className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No referrals yet</p>
              <p>Be the first to refer friends and top the leaderboard!</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
