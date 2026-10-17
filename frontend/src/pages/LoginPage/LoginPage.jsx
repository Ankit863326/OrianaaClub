import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import loginBg from "../../assets/Member login clean.png";
import useAuth from "../../context/useAuth.js";
import { getMember } from "../../lib/memberApi.js";
import "./LoginPage.css";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [notice, setNotice] = useState(location.state?.message || "");

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const pageRef = useRef(null);

  // GSAP ambient background parallax and floating light particles
  useEffect(() => {
    let ctx;
    const initGsap = async () => {
      try {
        const { default: gsap } = await import("gsap");

        ctx = gsap.context(() => {
          // Floating ambient light particles
          gsap.utils.toArray(".login-ambient-particle").forEach((particle, idx) => {
            gsap.to(particle, {
              y: -(25 + idx * 10),
              x: idx % 2 === 0 ? 15 : -15,
              opacity: 0,
              duration: 2.8 + idx * 0.4,
              repeat: -1,
              ease: "power1.inOut",
              delay: idx * 0.35,
            });
          });

          // Subtle floating breathing effect on background
          gsap.to(".login-page__bg", {
            scale: 1.03,
            duration: 16,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        }, pageRef);
      } catch (err) {
        console.warn("GSAP animation skipped:", err);
      }
    };

    initGsap();
    return () => ctx && ctx.revert();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    setNotice("");

    if (!email.trim()) {
      newErrors.email = "Please enter your E-mail ID";
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Please enter your password";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true);
      try {
        await login({ email: email.trim(), password });
        setLoginSuccess(true);
        const destination = location.state?.from;
        let fallbackPath = "/luxury-membership";
        if (!destination) {
          try {
            const memberData = await getMember();
            if (memberData.membership?.status === "active") fallbackPath = "/dashboard";
          } catch (error) {
            console.warn("[auth] Could not determine the post-login destination:", error.message);
          }
        }
        window.setTimeout(() => {
          navigate(destination ? `${destination.pathname}${destination.search || ""}${destination.hash || ""}` : fallbackPath, { replace: true });
        }, 900);
      } catch (error) {
        setErrors({ form: error.message });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="login-page" ref={pageRef}>
      {/* ── Background Image from Figma ── */}
      <div
        className="login-page__bg"
        style={{ backgroundImage: `url("${loginBg}")` }}
      />

      {/* ── Ambient Soft Vignette Overlay ── */}
      <div className="login-page__vignette" />

      {/* ── Floating Amber Particles ── */}
      <div className="login-ambient-particles" aria-hidden="true">
        {[...Array(8)].map((_, i) => (
          <span
            key={i}
            className="login-ambient-particle"
            style={{
              left: `${20 + i * 10}%`,
              bottom: `${15 + (i % 3) * 18}%`,
            }}
          />
        ))}
      </div>

      {/* ── Split Layout: Left Clear Patio, Right Frosted Form ── */}
      <div className="login-page__container">
        {/* Left Side: Transparent viewport letting resort lounge show through */}
        <div className="login-page__left-spacer" />

        {/* Right Side: Frosted Glass Panel with Form */}
        <Motion.div
          className="login-form-panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <Motion.div
            className="login-form-inner"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <Motion.div
              className="login-header"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.15 }}
            >
              <h1 className="login-title">Member Login</h1>
              <p className="login-subtitle">Please enter your Details</p>
            </Motion.div>

            {/* Success Alert */}
            <AnimatePresence>
              {notice && !loginSuccess && (
                <Motion.div className="login-alert-success" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {notice}
                </Motion.div>
              )}
              {errors.form && !loginSuccess && (
                <Motion.div className="login-form-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {errors.form}
                </Motion.div>
              )}
              {loginSuccess && (
                <Motion.div
                  className="login-alert-success"
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  Welcome back! Redirecting to your member lounge...
                </Motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="login-form" noValidate>
              {/* E-mail Field */}
              <div className="login-field">
                <label htmlFor="login-email" className="login-label">
                  E-mail
                </label>
                <div className="login-input-wrapper">
                  <input
                    id="login-email"
                    type="email"
                    placeholder="Enter your E-mail ID"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    className={`login-input ${errors.email ? "login-input--error" : ""}`}
                    autoComplete="email"
                  />
                  {/* Underline expansion animation */}
                  <Motion.div
                    className="login-underline"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: emailFocused ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                {errors.email && (
                  <Motion.span
                    className="login-error-msg"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {errors.email}
                  </Motion.span>
                )}
              </div>

              {/* Password Field */}
              <div className="login-field">
                <label htmlFor="login-password" className="login-label">
                  Password
                </label>
                <div className="login-input-wrapper">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                    }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    className={`login-input ${errors.password ? "login-input--error" : ""}`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" />
                      </svg>
                    )}
                  </button>
                  {/* Underline expansion animation */}
                  <Motion.div
                    className="login-underline"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: passwordFocused ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                {errors.password && (
                  <Motion.span
                    className="login-error-msg"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {errors.password}
                  </Motion.span>
                )}
              </div>

              {/* Password reset shortcut */}
              <div className="login-options-row">
                <span />
                <Link to="/forgot-password" className="login-forgot-link">Forgot password?</Link>
              </div>

              {/* Log In Button */}
              <Motion.button
                type="submit"
                className="login-submit-btn"
                disabled={isSubmitting}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.98 }}
              >
                {isSubmitting ? (
                  <span className="login-btn-loading">
                    <span className="login-spinner" />
                    Authenticating...
                  </span>
                ) : (
                  "Log In"
                )}
              </Motion.button>
            </form>

          </Motion.div>
        </Motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
