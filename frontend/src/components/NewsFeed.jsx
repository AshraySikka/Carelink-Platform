// Shared "News & updates" card, shown at the top of most dashboards. Fetches
// its own data so any page can drop it in with no props required.
import { useEffect, useState } from "react";
import { api } from "../api";
import Icon from "./Icons.jsx";

export default function NewsFeed() {
  const [news, setNews] = useState([]);

  useEffect(() => {
    api("/news/").then(setNews).catch(() => {});
  }, []);

  if (news.length === 0) return null;

  return (
    <div className="card news-feed">
      <div className="row" style={{ gap: 8, marginBottom: 4 }}>
        <Icon name="megaphone" />
        <strong>News & updates</strong>
      </div>
      <div className="stack" style={{ gap: 10, marginTop: 10 }}>
        {news.map((n) => (
          <div key={n.id} className="news-item">
            <div className="row between">
              <strong>{n.title}</strong>
              <span className="muted small">{new Date(n.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
            </div>
            <div className="small muted" style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}