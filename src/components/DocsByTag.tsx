import DocList from './DocList';

// `<DocsByTag tag>` — the body of a tag page: a `#tag` header + the filtered feed.
export default function DocsByTag({ tag, shape = 'feed' }: { tag: string; shape?: 'feed' | 'grid' }) {
  return (
    <div>
      <div className="grove-doclist__head">
        <h2><span className="grove-tag" data-active="1">#{tag}</span></h2>
      </div>
      <DocList shape={shape} tag={tag} />
    </div>
  );
}
