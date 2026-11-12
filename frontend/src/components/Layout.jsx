import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AuthDialog from "./AuthDialog.jsx";

function ScrollToHash() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    if (hash) {
      // Wait a tick so the target section has been rendered.
      const timer = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 50);
      return () => clearTimeout(timer);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash, key]);

  return null;
}

function Header() {
  const { user, openAuth, logout } = useAuth();

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      window.alert(error.message);
    }
  }

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="FILMORA home">FILM<span>ORA</span></Link>
      <nav className="main-nav">
        <Link to="/#movies">Explore</Link>
        <Link to="/#plans">Plans</Link>
        <Link to="/#how-it-works">How it works</Link>
        {user && <NavLink to="/account">My account</NavLink>}
      </nav>
      <div className="header-actions">
        <span className="account-label">{user?.fullName || user?.email || "Guest"}</span>
        {user ? (
          <button className="button button-quiet" onClick={handleLogout}>Sign out</button>
        ) : (
          <>
            <button className="button button-quiet" onClick={() => openAuth("login")}>Sign in</button>
            <button className="button button-primary" onClick={() => openAuth("register")}>Join now</button>
          </>
        )}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <Link className="brand" to="/">FILM<span>ORA</span></Link>
      <p>© {new Date().getFullYear()} FILMORA. All rights reserved.</p>
      <p className="muted"><Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link></p>
    </footer>
  );
}

export default function Layout() {
  return (
    <>
      <ScrollToHash />
      <Header />
      <Outlet />
      <Footer />
      <AuthDialog />
    </>
  );
}
