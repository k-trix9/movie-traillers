import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { ContinueWatching, MemberBanner } from "../components/MemberSections.jsx";
import Featured from "../components/Featured.jsx";
import Collection from "../components/Collection.jsx";
import Plans from "../components/Plans.jsx";

export default function Home() {
  const { user, loading, dialog, openAuth } = useAuth();
  const [params] = useSearchParams();
  const [pendingPlan, setPendingPlan] = useState(null);
  const [planMessage, setPlanMessage] = useState("");
  const [memberVersion, setMemberVersion] = useState(0);

  // Pages like /account send people here with ?signin=1 when they need to sign in.
  useEffect(() => {
    if (!loading && !user && params.get("signin")) openAuth("login");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const startCheckout = useCallback(async (planPriceId) => {
    setPlanMessage("");
    if (!user) {
      setPendingPlan(planPriceId);
      openAuth("login", "Sign in or create an account to continue to checkout.");
      return;
    }
    try {
      setPlanMessage("Opening secure checkout…");
      const data = await api("/api/billing/checkout", { method: "POST", body: JSON.stringify({ planPriceId }) });
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setPlanMessage(error.message);
    }
  }, [user, openAuth]);

  // After signing in from a "Choose plan" click, carry on to checkout.
  useEffect(() => {
    if (user && pendingPlan) {
      const planPriceId = pendingPlan;
      setPendingPlan(null);
      startCheckout(planPriceId);
    }
  }, [user, pendingPlan, startCheckout]);

  // If the sign-in dialog is dismissed, forget the plan that was chosen.
  useEffect(() => {
    if (!dialog.open && !user) setPendingPlan(null);
  }, [dialog.open, user]);

  async function devActivate(planPriceId) {
    if (!user) {
      setPendingPlan(null);
      openAuth("login");
      return;
    }
    try {
      await api("/api/billing/dev-activate", { method: "POST", body: JSON.stringify({ planPriceId }) });
      setPlanMessage("Test membership activated for one month.");
      setMemberVersion((v) => v + 1);
    } catch (error) {
      setPlanMessage(error.message);
    }
  }

  return (
    <main>
      <MemberBanner user={user} version={memberVersion} />

      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">YOUR WORLD OF MOVIES</p>
          <h1>Stories worth<br /><span>staying in for.</span></h1>
          <p className="hero-copy">
            Discover films, find your next favourite and enjoy authorized movies with one simple monthly membership.
          </p>
          <div className="hero-actions">
            <a className="button button-primary button-large" href="#plans">Explore membership</a>
            <a className="button button-outline button-large" href="#movies">Browse movies</a>
          </div>
          <p className="hero-note">
            A subscription is required for playback. Availability depends on content rights in your region.
          </p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="poster poster-one"><span>THE<br />LAST<br />HORIZON</span></div>
          <div className="poster poster-two"><span>AFTER<br />THE<br />STORM</span></div>
          <div className="poster poster-three"><span>BEYOND<br />THE<br />LIGHT</span></div>
          <div className="glow" />
        </div>
      </section>

      <Featured user={user} />
      <ContinueWatching user={user} />
      <Collection user={user} />
      <Plans onChoose={startCheckout} onDevActivate={devActivate} message={planMessage} />

      <section className="section how-section" id="how-it-works">
        <p className="eyebrow">SIMPLE BY DESIGN</p>
        <h2>Movie night in three steps</h2>
        <div className="steps-grid">
          <article className="step-card"><span>01</span><h3>Create your account</h3><p>Register with your email and keep your membership details in one place.</p></article>
          <article className="step-card"><span>02</span><h3>Choose a monthly plan</h3><p>Complete checkout securely with an available payment method.</p></article>
          <article className="step-card"><span>03</span><h3>Press play</h3><p>Active members can stream titles that are licensed for their location.</p></article>
        </div>
      </section>
    </main>
  );
}
