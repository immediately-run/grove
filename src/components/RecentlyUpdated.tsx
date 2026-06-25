import DocList from './DocList';

// `<RecentlyUpdated limit>` — a compact, date-sorted feed of the latest entries.
export default function RecentlyUpdated({ limit = 6, title }: { limit?: string | number; title?: string }) {
  return <DocList shape="feed" sort="date" limit={limit} title={title ?? 'Recently updated'} />;
}
