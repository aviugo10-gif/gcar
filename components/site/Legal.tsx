export function Legal({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="wrap section">
      <article className="legal">
        <h1 className="t-display-l">{title}</h1>
        <p className="t-caption" style={{ marginTop: 8 }}>עודכן לאחרונה: {updated}</p>
        {children}
      </article>
    </div>
  );
}
export const TBD = ({ v, label }: { v: string | null | undefined; label: string }) => <>{v ?? `[${label}: יעודכן]`}</>;
