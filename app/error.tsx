'use client';
export default function Error({reset}: {reset:()=>void}) {
  return <main><section className="panel" role="alert"><div className="eyebrow">Workspace unavailable</div><h1>We couldn’t load this view.</h1><p>Retry to reload your workspace data. If this continues, check the database setup and connection.</p><button className="primary inlineAction" onClick={reset}>Try again</button><a className="ghost inlineAction" href="/">Command Center</a></section></main>;
}
