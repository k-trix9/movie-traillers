import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/format.js";
import MovieCard from "./MovieCard.jsx";

// Green/amber strip under the header showing membership status for signed-in users.
export function MemberBanner({ user, version }) {
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    let alive = true;
    setBanner(null);
    if (!user) return undefined;

    api("/api/billing/me")
      .then(({ subscription, hasAccess }) => {
        if (!alive) return;
        if (hasAccess) {
          setBanner({
            warn: false,
            text: `Your ${subscription.plan} membership is active until ${formatDate(subscription.currentPeriodEnd)}.`
          });
        } else if (subscription) {
          setBanner({
            warn: true,
            text: `Your ${subscription.plan} membership ended on ${formatDate(subscription.currentPeriodEnd)}. Choose a plan below to keep watching.`
          });
        } else {
          setBanner({ warn: true, text: "Welcome! Choose a membership plan below to start watching." });
        }
      })
      .catch(() => { /* banner is optional */ });

    return () => { alive = false; };
  }, [user?.id, version]);

  if (!banner) return null;
  return <div className={`member-banner${banner.warn ? " warn" : ""}`} role="status">{banner.text}</div>;
}

export function ContinueWatching({ user }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    setItems([]);
    if (!user) return undefined;

    api("/api/account/continue-watching")
      .then((data) => alive && setItems(data.items))
      .catch(() => { /* optional */ });

    return () => { alive = false; };
  }, [user?.id]);

  if (!items.length) return null;
  return (
    <section className="section" id="continue-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
          <h2>Continue watching</h2>
        </div>
      </div>
      <div className="movie-grid">
        {items.map((item) => (
          <MovieCard key={item.movie.id} movie={item.movie} positionSeconds={item.positionSeconds} />
        ))}
      </div>
    </section>
  );
}
