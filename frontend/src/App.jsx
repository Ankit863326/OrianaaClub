import React, { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import BackToTop from './components/BackToTop';
import Footer from './components/Footer';
import { AuthProvider } from './context/AuthContext.jsx';
import useAuth from './context/useAuth.js';
const logoImg = '/images/optimized/Oriana Club Luxury Emblem.webp';
import LuxuryCursor from './components/LuxuryCursor';
import OrianaaChatbot from './components/OrianaaChatbot.jsx';

const HomePage = lazy(() => import('./components/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage/LoginPage'));
const MembershipAll = lazy(() => import('./pages/LuxuryMembershipStepOne/MembershipAll'));
const MembershipBenefits = lazy(() => import('./pages/MembershipBenefits'));
const RoomCategories = lazy(() => import('./pages/RoomCategories/RoomCategories'));
const Experiences = lazy(() => import('./pages/Experiences/Experiences'));
const Events = lazy(() => import('./pages/Events/Events'));
const Blog = lazy(() => import('./pages/Blog/Blog'));
const Activate = lazy(() => import('./pages/Activate/Activate'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard/MemberDashboardPage'));
const FamilyVerificationPage = lazy(() => import('./pages/Dashboard/FamilyVerificationPage'));
const FamilyCheckoutPage = lazy(() => import('./pages/Dashboard/FamilyCheckoutPage'));
const NotFound = lazy(() => import('./pages/NotFound/NotFound'));

function SiteScrollMotion() {
  const location = useLocation();

  useLayoutEffect(() => {
    if (location.hash) {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname, location.hash]);

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      return undefined;
    }

    const targets = document.querySelectorAll(
      'main > section:not([class*="hero"]):not(#universe), .membership-benefits > .mb-container:not(.mb-container--hero), .log-page__content, .axd-membership-page__content, .axd-step-two-page__content, .axd-review-page__content',
    );
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01, rootMargin: '0px 0px 80px 0px' });

    targets.forEach((target, index) => {
      target.style.setProperty('--site-reveal-order', index % 4);
      target.classList.add('site-scroll-reveal');
      observer.observe(target);
    });

    return () => {
      observer.disconnect();
      targets.forEach((target) => {
        target.classList.remove('site-scroll-reveal', 'is-visible');
        target.style.removeProperty('--site-reveal-order');
      });
    };
  }, [location.pathname]);

  return null;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main aria-live="polite">Loading your account…</main>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function App() {
  const [isPreloading, setIsPreloading] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (!isPreloading) return undefined;
    const timer = window.setTimeout(() => setIsPreloading(false), 1850);
    return () => window.clearTimeout(timer);
  }, [isPreloading]);


  return (
    <AuthProvider>
    <Router>
      <LuxuryCursor />
      <div style={{ width: '100%', backgroundColor: '#0B1220', color: 'white', overflowX: 'clip' }}>
        <Navbar />
        <SiteScrollMotion />
        {isPreloading && (
          <div className="site-preloader" role="status" aria-label="Saptagiri Resorts and OrianaaClub are loading">
            <div className="site-preloader__content">
              <img className="site-preloader__emblem" src={logoImg} alt="OrianaaClub membership" />
              <p className="site-preloader__tagline">A private world, distinctly yours</p>
              <span className="site-preloader__rule" />
            </div>
          </div>
        )}
        <Suspense fallback={<main aria-live="polite" style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#e2ad32'}}>Loading…</main>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/resorts" element={<RoomCategories />} />
          <Route path="/experiences" element={<Experiences />} />
          <Route path="/events" element={<Events />} />
          <Route path="/blog" element={<Blog />} />
  <Route
    path="/membership-benefits"
    element={<MembershipBenefits />}
  />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activate" element={<Navigate to={`/set-password${window.location.search}`} replace />} />
          <Route path="/set-password" element={<Activate />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard/family/:familyId/verification" element={<ProtectedRoute><FamilyVerificationPage /></ProtectedRoute>} />
          <Route path="/dashboard/family/:familyId/payment" element={<ProtectedRoute><FamilyCheckoutPage /></ProtectedRoute>} />
          <Route path="/luxury-membership" element={<MembershipAll />} />
          <Route path="/luxury-membership-step-2" element={<Navigate to="/luxury-membership?step=2" replace />} />
          <Route path="/luxury-membership-step-3" element={<Navigate to="/luxury-membership?step=3" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        <Footer />
        <BackToTop />
        <OrianaaChatbot />
      </div>
    </Router>
    </AuthProvider>
  );
}

export default App;
