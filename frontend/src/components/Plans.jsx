import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { formatMoney } from "../lib/format.js";

export default function Plans({ onChoose, onDevActivate, message }) {
  const [currency, setCurrency] = useState("Rwf");
  const [state, setState] = useState({ loading: true, plans: [], devPaymentBypass: false, error: "" });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    api(`/api/billing/plans?currency=${encodeURIComponent(currency)}`)
      .then((data) => alive && setState({ loading: false, plans: data.plans, devPaymentBypass: Boolean(data.devPaymentBypass), error: "" }))
      .catch((error) => alive && setState({ loading: false, plans: [], devPaymentBypass: false, error: error.message }));
    return () => { alive = false; };
  }, [currency]);

  return (
    <section className="membership-section" id="plans">
      <div className="section-heading centered">
        <p className="eyebrow">ONE MEMBERSHIP. MORE MOVIE NIGHTS.</p>
        <h2>Choose your membership</h2>
        <p className="muted">Monthly plans. Cancel before your next renewal if you do not want to continue.</p>
        <label className="currency-picker">
          Display currency
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="USD">USD — US dollar</option>
            <option value="RWF">RWF — Rwandan franc</option>
          </select>
        </label>
      </div>

      <div className="plan-grid">
        {state.loading && <p className="muted">Loading membership plans…</p>}
        {state.error && <p className="muted">{state.error}</p>}
        {!state.loading && !state.error && state.plans.length === 0 && (
          <p className="muted">No {currency} plans have been configured yet.</p>
        )}
        {state.plans.map((plan, index) => (
          <article key={plan.price.id} className={`plan-card${index === 1 ? " featured" : ""}`}>
            <h3>{plan.name}</h3>
            <p className="plan-description">{plan.description || "Monthly movie membership."}</p>
            <p className="plan-price">
              {formatMoney(plan.price.amount, plan.price.currency)}
              <small> / month</small>
            </p>
            <p className="plan-meta">
              {plan.maxScreens} screen{plan.maxScreens === 1 ? "" : "s"} · up to {plan.maxResolution}
            </p>
            <button className="button button-primary" onClick={() => onChoose(plan.price.id)}>Choose plan</button>
            {state.devPaymentBypass && (
              <button className="button button-outline button-full" onClick={() => onDevActivate(plan.price.id)}>
                Test activate (dev only)
              </button>
            )}
          </article>
        ))}
      </div>

      <p className="fine-print">
        Monthly membership is paid for one month at a time and does not renew automatically — come back and renew
        whenever you like. Payment methods vary by country. Content availability depends on streaming rights in your region.
      </p>
      <p className="form-message centered-text" aria-live="polite">{message}</p>
    </section>
  );
}
