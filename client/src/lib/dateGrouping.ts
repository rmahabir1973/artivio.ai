import { isToday, isYesterday, isThisWeek, isThisMonth, format } from 'date-fns';

export interface GroupedConversations {
  label: string;
  conversations: any[];
}

export function groupConversationsByDate(conversations: any[]): GroupedConversations[] {
  const groups: { [key: string]: any[] } = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    older: [],
  };

  conversations.forEach(conv => {
    const date = new Date(conv.updatedAt);
    if (isToday(date)) {
      groups.today.push(conv);
    } else if (isYesterday(date)) {
      groups.yesterday.push(conv);
    } else if (isThisWeek(date)) {
      groups.thisWeek.push(conv);
    } else if (isThisMonth(date)) {
      groups.thisMonth.push(conv);
    } else {
      groups.older.push(conv);
    }
  });

  const result: GroupedConversations[] = [];

  if (groups.today.length > 0) {
    result.push({ label: 'Today', conversations: groups.today });
  }
  if (groups.yesterday.length > 0) {
    result.push({ label: 'Yesterday', conversations: groups.yesterday });
  }
  if (groups.thisWeek.length > 0) {
    result.push({ label: 'This Week', conversations: groups.thisWeek });
  }
  if (groups.thisMonth.length > 0) {
    result.push({ label: 'This Month', conversations: groups.thisMonth });
  }
  if (groups.older.length > 0) {
    result.push({ label: 'Older', conversations: groups.older });
  }

  return result;
}
