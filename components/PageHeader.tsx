type PageHeaderProps = {
  title: string;
  description?: string;
  badge?: string;
  className?: string;
};

export function PageHeader({ title, description, badge, className = "" }: PageHeaderProps) {
  return (
    <header className={`mb-0 ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-2 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
        {badge ? (
          <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-400 ring-1 ring-brand-500/20">
            {badge}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p>
      ) : null}
    </header>
  );
}
