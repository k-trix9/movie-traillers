import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { formatDate, formatMoney } from "../lib/format.js";
import { useAuth } from "../context/AuthContext.jsx";
import MovieCard from "../components/MovieCard.jsx";

function Membership({ setMessage }) {
  const [state, setState] = useState({ loading: true, error: "", subscription: null, hasAccess: false });

  const load = useCallback(async () => {
    try {
      const { subscription, hasAccess } = await api("/api/billing/me");
      setState({ loading: false, error: "", subscription, hasAccess });
    } catch (error) {
      setState({ loading: false, error: error.message, subscription: null, hasAccess: false });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function cancel() {
    if (!window.confirm("Cancel your membership? You keep access until the end of the paid period.")) return;
    try {
      const data = await api("/api/billing/cancel", { method: "POST", body: "{}" });
      setMessage(data.message);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  const { loading, error, subscription, hasAccess } = state;

  return (
    <section className="panel">
      <h2>Membership</h2>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="muted">{error}</p>}
      {!loading && !error && !subscription && (
        <>
          <p className="muted">You do not have a membership yet.</p>
          <Link className="button button-primary" to="/#plans">Choose a plan</Link>
        </>
      )}
      {subscription && (
        <>
          <p className="membership-title">
            {subscription.plan} plan{" "}
            <span className={`badge ${hasAccess ? "badge-ok" : "badge-warn"}`}>{hasAccess ? "Active" : "Expired"}</span>
          </p>
          <p className="muted">{formatMoney(subscription.amount, subscription.currency)} per month</p>
          <p>
            {hasAccess
              ? `${subscription.cancelAtPeriodEnd ? "Ends" : "Paid until"} ${formatDate(subscription.currentPeriodEnd)}. Memberships are paid month by month and do not renew automatically.`
              : `Your access ended on ${formatDate(subscription.currentPeriodEnd)}.`}
          </p>
          <div className="watch-controls">
            <Link className="button button-primary" to="/#plans">
              {hasAccess ? "Renew early" : "Renew membership"}
            </Link>
            {hasAccess && !subscription.cancelAtPeriodEnd && (
              <button type="button" className="button button-outline" onClick={cancel}>Cancel membership</button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Shelves() {
  const [continueItems, setContinueItems] = useState([]);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    let alive = true;
    api("/api/account/continue-watching").then((d) => alive && setContinueItems(d.items)).catch(() => {});
    api("/api/account/favorites").then((d) => alive && setFavorites(d.movies)).catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <>
      {continueItems.length > 0 && (
        <section className="panel">
          <h2>Continue watching</h2>
          <div className="movie-grid">
            {continueItems.map((item) => (
              <MovieCard key={item.movie.id} movie={item.movie} positionSeconds={item.positionSeconds} />
            ))}
          </div>
        </section>
      )}
      {favorites.length > 0 && (
        <section className="panel">
          <h2>My list</h2>
          <div className="movie-grid">
            {favorites.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
          </div>
        </section>
      )}
    </>
  );
}

function Payments() {
  const [state, setState] = useState({ loading: true, error: "", payments: [] });

  useEffect(() => {
    let alive = true;
    api("/api/billing/payments")
      .then((d) => alive && setState({ loading: false, error: "", payments: d.payments }))
      .catch((e) => alive && setState({ loading: false, error: e.message, payments: [] }));
    return () => { alive = false; };
  }, []);

  return (
    <section className="panel">
      <h2>Payment history</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th><th>Reference</th></tr>
          </thead>
          <tbody>
            {state.loading && <tr><td colSpan={5}>Loading…</td></tr>}
            {state.error && <tr><td colSpan={5}>{state.error}</td></tr>}
            {!state.loading && !state.error && state.payments.length === 0 && (
              <tr><td colSpan={5}>No payments yet.</td></tr>
            )}
            {state.payments.map((p) => (
              <tr key={p.reference}>
                <td>{formatDate(p.paidAt || p.createdAt)}</td>
                <td>{p.plan}</td>
                <td>{formatMoney(p.amount, p.currency)}</td>
                <td>{p.status}</td>
                <td>{p.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Account() {
  const { user, loading } = useAuth();
  const [message, setMessage] = useState("");

  useEffect(() => { document.title = "My account — FILMORA"; }, []);

  if (loading) return <main className="account-wrap"><p className="muted">Loading…</p></main>;
  if (!user) return <Navigate to="/?signin=1" replace />;

  return (
    <main className="account-wrap">
      <p className="eyebrow">YOUR FILMORA</p>
      <h1 className="page-title">My account</h1>
      <p className="form-message" aria-live="polite">{message}</p>
      <Membership setMessage={setMessage} />
      <Shelves />
      <Payments />
    </main>
  );
}
