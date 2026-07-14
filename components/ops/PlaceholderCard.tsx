type PlaceholderCardProps = {
  title: string;
  description: string;
};

export function PlaceholderCard({ title, description }: PlaceholderCardProps) {
  return (
    <div className="card-tool rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-slate-600">Phase 1 — coming next</p>
    </div>
  );
}
