import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Menu, Search, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import useAuth from "../context/useAuth.js";
import logoImg from "../assets/Oriana Club Luxury Emblem Transparent.png";
import "./Navbar.css";

const searchItems = [
  { title: "Resorts", detail: "Stays and destinations", to: "/resorts", keywords: "rooms villas hotels destinations escapes" },
  { title: "Experiences", detail: "Wellness, dining and more", to: "/experiences", keywords: "spa wellness dining activities" },
  { title: "Events", detail: "Celebrations and gatherings", to: "/events", keywords: "wedding celebration gathering" },
  { title: "Membership Benefits", detail: "Explore the Orianaa membership", to: "/membership-benefits", keywords: "join member points benefits" },
  { title: "Members Login", detail: "Access your member account", to: "/login", keywords: "sign in account login" },
  { title: "Journal", detail: "Stories from the Orianaa world", to: "/blog", keywords: "blog stories journal" },
];

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(() => window.scrollY > 48);
  const headerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const destinationPath = "/resorts";
  const membershipPaths = [
    "/membership-benefits",
    "/luxury-membership",
    "/luxury-membership-step-2",
    "/luxury-membership-step-3",
  ];
  const activeNav =
    location.pathname === "/blog"
      ? "blog"
      : location.pathname === "/events"
      ? "event"
      : location.pathname === "/login"
        ? "sign-in"
        : membershipPaths.includes(location.pathname)
          ? "membership"
            : location.pathname === "/experiences"
              ? "experience"
              : location.pathname === "/resorts" || location.hash === "#destinations"
            ? "destination"
            : location.pathname === "/"
              ? "home"
              : "";
  const navLinkClass = (name) =>
    `home-nav__link${activeNav === name ? " is-active" : ""}`;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? searchItems.filter((item) => `${item.title} ${item.detail} ${item.keywords}`.toLowerCase().includes(normalizedQuery))
    : searchItems.slice(0, 3);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!headerRef.current?.contains(event.target)) setSearchOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSearchOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    let frameId = 0;
    const updateScrollState = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        const nextIsScrolled = window.scrollY > 48;
        setIsScrolled((current) => current === nextIsScrolled ? current : nextIsScrolled);
        frameId = 0;
      });
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateScrollState);
    };
  }, [location.pathname]);

  const handleJoinMembership = () => {
    navigate("/luxury-membership");
  };

  const handleLogout = async () => {
    try {
      await logout();
      setMenuOpen(false);
      navigate("/");
    } catch (error) {
      console.error("[auth] Could not log out cleanly:", error.message);
      window.alert(error.message);
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (!searchResults.length) return;
    navigate(searchResults[0].to);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleSearchResultClick = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleSearchToggle = () => {
    const willOpen = !searchOpen;
    setMenuOpen(false);
    setSearchOpen(willOpen);
    if (willOpen) {
      window.setTimeout(() => document.getElementById("home-nav-search-input")?.focus({ preventScroll: true }), 80);
    }
  };

  return (
      <header ref={headerRef} className={`home-nav${location.pathname === "/" ? "" : " home-nav--interior"}${isScrolled ? " is-scrolled" : ""}`}>
        <div className="home-nav__inner">
          <Button
            variant="ghost"
            size="icon"
            className="home-nav__menu-toggle"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </Button>
          <nav className="home-nav__links" aria-label="Main navigation">
            <Link className={navLinkClass("home")} to="/">Home</Link>
            <Link className={navLinkClass("destination")} to={destinationPath}>Destination</Link>
            <Link className={navLinkClass("experience")} to="/experiences">Experiences</Link>
            <Link className={navLinkClass("event")} to="/events">Event</Link>
            <Link className={navLinkClass("blog")} to="/blog">Blog</Link>
            <Link className={navLinkClass("membership")} to="/membership-benefits">Membership</Link>
          </nav>
          <Link className="home-nav__brand" to="/" aria-label="Orianaa Club home">
            <img src={logoImg} alt="Orianaa Club Luxury Membership" />
          </Link>
          <div className="home-nav__actions">
            <Button
              variant="ghost"
              size="icon"
              className={`home-nav__search-toggle${searchOpen ? " is-open" : ""}`}
              type="button"
              aria-label={searchOpen ? "Close search" : "Open search"}
              aria-expanded={searchOpen}
              aria-controls="home-nav-search"
              onClick={handleSearchToggle}
            >
              {searchOpen ? <X size={19} /> : <Search size={19} />}
            </Button>
            {user ? (
              <div className="home-nav__account">
                <Link className="home-nav__dashboard" to="/dashboard">
                  My Dashboard
                </Link>
                <Button variant="outline" className="home-nav__sign-in" onClick={handleLogout}>Logout</Button>
              </div>
            ) : (
              <>
                <Button asChild variant="glass" className={`home-nav__login home-nav__sign-in${activeNav === "sign-in" ? " is-active" : ""}`}>
                  <Link to="/login">Login</Link>
                </Button>
                <Button variant="default" className={`home-nav__membership${activeNav === "membership" ? " is-active" : ""}`} onClick={handleJoinMembership}>
                  Join Membership
                </Button>
              </>
            )}
          </div>
          <div
            id="home-nav-search"
            className={`home-nav__search-panel${searchOpen ? " is-open" : ""}`}
            aria-hidden={!searchOpen}
          >
            <form className="home-nav__search-form" role="search" onSubmit={handleSearchSubmit}>
              <Search size={18} aria-hidden="true" />
              <label className="home-nav__visually-hidden" htmlFor="home-nav-search-input">Search Orianaa Club</label>
              <input
                id="home-nav-search-input"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search stays, experiences, more"
                autoComplete="off"
                tabIndex={searchOpen ? 0 : -1}
              />
              {searchQuery && (
                <button
                  className="home-nav__search-clear"
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={16} />
                </button>
              )}
            </form>
            <p className="home-nav__search-heading">{normalizedQuery ? "Search results" : "Discover Orianaa"}</p>
            <div className="home-nav__search-results" aria-live="polite">
              {searchResults.length ? searchResults.map((item) => (
                <Link
                  className="home-nav__search-result"
                  key={item.to}
                  to={item.to}
                  tabIndex={searchOpen ? 0 : -1}
                  onClick={handleSearchResultClick}
                >
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )) : <p className="home-nav__search-empty">No matches found</p>}
            </div>
          </div>
          <nav
            className={`home-nav__mobile-menu ${menuOpen ? "is-open" : ""}`}
            aria-label="Mobile navigation"
          >
            <Link className={navLinkClass("home")} to="/" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link className={navLinkClass("destination")} to={destinationPath} onClick={() => setMenuOpen(false)}>Destination</Link>
            <Link className={navLinkClass("experience")} to="/experiences" onClick={() => setMenuOpen(false)}>Experiences</Link>
            <Link className={navLinkClass("event")} to="/events" onClick={() => setMenuOpen(false)}>Event</Link>
            <Link className={navLinkClass("blog")} to="/blog" onClick={() => setMenuOpen(false)}>Blog</Link>
            <Link className={navLinkClass("membership")} to="/membership-benefits" onClick={() => setMenuOpen(false)}>Membership</Link>
            {user ? (
              <>
                <span className="home-nav__mobile-greeting">Hello, {user.firstName}</span>
                <Link className="home-nav__link" to="/dashboard" onClick={() => setMenuOpen(false)}>
                  My Dashboard
                </Link>
                <Button onClick={handleLogout}>Logout</Button>
              </>
            ) : (
              <>
                <Link className={`home-nav__link${activeNav === "sign-in" ? " is-active" : ""}`} to="/login" onClick={() => setMenuOpen(false)}>Login</Link>
              </>
            )}
            {!user && (
              <Button onClick={() => { handleJoinMembership(); setMenuOpen(false); }}>
                Join Membership
              </Button>
            )}
          </nav>
        </div>
      </header>
    );
};

export default Navbar;