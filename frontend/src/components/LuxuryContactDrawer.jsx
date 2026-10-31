import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { m as Motion, useReducedMotion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import ReCAPTCHA from "react-google-recaptcha";
import { lockPageScroll, unlockPageScroll } from "../lib/scrollLock";
import { contentApi } from "../lib/contentApi.js";
import resortBg from "../assets/club-bg.jpg";
import "./LuxuryContactDrawer.css";

const fieldMotion = {
  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
  visible: (index) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      delay: 0.52 + index * 0.07,
      duration: 0.56,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const headerMotion = {
  hidden: () => ({ opacity: 0, y: 14, filter: "blur(5px)" }),
  visible: (i) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      delay: 0.34 + i * 0.07,
      duration: 0.52,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const shimmerMotion = {
  hidden: { opacity: 0, scaleX: 0 },
  visible: {
    opacity: 1,
    scaleX: 1,
    transition: { delay: 0.58, duration: 0.75, ease: [0.22, 1, 0.36, 1] },
  },
};

const interestAreas = [
  { value: "membership", label: "OrianaaClub Membership" },
  { value: "resorts", label: "Saptagiri Resorts and Stays" },
  { value: "wellness", label: "Wellness and Spa" },
  { value: "dining", label: "Pure Vegetarian Dining" },
  { value: "events", label: "Events & Celebrations" },
  { value: "general", label: "General Enquiry" },
];

const countryCodes = [
  { code: "+91", country: "India" },
  { code: "+1", country: "USA/Canada" },
  { code: "+44", country: "UK" },
  { code: "+971", country: "UAE" },
  { code: "+65", country: "Singapore" },
  { code: "+61", country: "Australia" },
];

const initialForm = {
  name: "",
  email: "",
  countryCode: "+91",
  phone: "",
  dob: "",
  interest: "membership",
  agreePromo: false,
};

const ChevronIcon = ({ open }) => (
  <span className={`lux-contact__chevron${open ? " is-open" : ""}`} aria-hidden="true">▾</span>
);

export default function LuxuryContactDrawer({ open, onOpenChange }) {
  const backdropRef = useRef(null);
  const bgImageRef = useRef(null);
  const panelRef = useRef(null);
  const accentRef = useRef(null);
  const shimmerRef = useRef(null);
  const contextRef = useRef(null);
  const innerRef = useRef(null);
  const isClosingRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const shouldReduceMotion = useReducedMotion();
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isMounted, setIsMounted] = useState(open);
  const [countryOpen, setCountryOpen] = useState(false);
  const [interestOpen, setInterestOpen] = useState(false);

  const finishClose = useCallback(() => {
    isClosingRef.current = false;
    isAnimatingRef.current = false;
    setIsMounted(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const runCloseAnimation = useCallback(() => {
    if (isClosingRef.current || isAnimatingRef.current === "opening") return;

    setCountryOpen(false);
    setInterestOpen(false);

    if (shouldReduceMotion || !panelRef.current) {
      finishClose();
      return;
    }

    isClosingRef.current = true;
    isAnimatingRef.current = "closing";

    import("gsap").then(({ default: gsap }) => {
      if (contextRef.current) {
        contextRef.current.kill();
        contextRef.current = null;
      }
      gsap.killTweensOf([
        panelRef.current,
        backdropRef.current,
        bgImageRef.current,
        accentRef.current,
        shimmerRef.current,
      ]);

      const tl = gsap.timeline({
        onComplete: finishClose,
        defaults: { overwrite: "auto" },
      });
      tl.to(panelRef.current, {
        scale: 0.965,
        y: 18,
        opacity: 0,
        duration: 0.42,
        ease: "power2.in",
      })
        .to(bgImageRef.current, {
          scale: 1.08,
          opacity: 0,
          duration: 0.48,
          ease: "power2.inOut",
        }, 0)
        .to(backdropRef.current, {
          opacity: 0,
          duration: 0.4,
          ease: "power2.out",
        }, 0.05);
    });
  }, [finishClose, shouldReduceMotion]);

  useEffect(() => {
    if (!isMounted) return undefined;

    const scrollSnapshot = lockPageScroll();

        const onKeyDown = (event) => {
      if (event.key === "Escape") runCloseAnimation();
    };
    window.addEventListener("keydown", onKeyDown);

    const handleClickOutside = () => {
      if (countryOpen || interestOpen) {
        setCountryOpen(false);
        setInterestOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);

    return () => {
      if (scrollSnapshot) unlockPageScroll(scrollSnapshot);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isMounted, runCloseAnimation, countryOpen, interestOpen]);

  useEffect(() => {
    if (open) {
      setIsMounted(true);
      isClosingRef.current = false;
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!isMounted || !open || isClosingRef.current) return undefined;

    if (shouldReduceMotion) {
      isAnimatingRef.current = false;
      return undefined;
    }

    let isActive = true;
    isAnimatingRef.current = "opening";

    import("gsap").then(({ default: gsap }) => {
      if (!isActive || isClosingRef.current || !panelRef.current) {
        isAnimatingRef.current = false;
        return;
      }

      if (contextRef.current) {
        contextRef.current.kill();
      }

      gsap.killTweensOf([
        panelRef.current,
        backdropRef.current,
        bgImageRef.current,
        accentRef.current,
        shimmerRef.current,
      ]);

      contextRef.current = gsap.context(() => {
        gsap.set(backdropRef.current, { opacity: 0 });
        gsap.set(bgImageRef.current, { opacity: 0, scale: 1.12 });
        gsap.set(panelRef.current, {
          opacity: 0,
          scale: 0.92,
          y: 32,
        });
        gsap.set(accentRef.current, { scaleX: 0, transformOrigin: "left center" });
        gsap.set(shimmerRef.current, { xPercent: -150, opacity: 0.95 });

        const tl = gsap.timeline({
        defaults: { overwrite: "auto" },
        onComplete: () => {
          if (isActive && !isClosingRef.current) {
            isAnimatingRef.current = false;
          }
        },
      });
        tl.to(backdropRef.current, {
          opacity: 1,
          duration: 0.48,
          ease: "power2.out",
        })
          .to(bgImageRef.current, {
            opacity: 0.9,
            scale: 1,
            duration: 0.95,
            ease: "power3.out",
          }, 0.04)
          .to(panelRef.current, {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.72,
            ease: "power3.out",
          }, 0.16)
          .to(accentRef.current, {
            scaleX: 1,
            duration: 0.8,
            ease: "power3.out",
          }, 0.38)
          .to(shimmerRef.current, {
            xPercent: 260,
            duration: 1.25,
            ease: "power2.inOut",
          }, 0.5)
          .to(shimmerRef.current, { opacity: 0, duration: 0.2 }, "-=0.18");

        gsap.to(bgImageRef.current, {
          scale: 1.05,
          duration: 16,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: 2.2,
        });
      });
    });

    return () => {
      isActive = false;
      if (contextRef.current) {
        contextRef.current.kill();
        contextRef.current = null;
      }
    };
  }, [isMounted, open, shouldReduceMotion]);

  useEffect(() => {
    if (!isMounted) {
      setSubmitted(false);
      setForm(initialForm);
      setFormError("");
      setFieldErrors({});
      setCountryOpen(false);
      setInterestOpen(false);
    }
  }, [isMounted]);

  const validateForm = () => {
    const nextErrors = {};
    const emailPattern = /\S+@\S+\.\S+/;
    const phonePattern = /^[\d\s\-()]{8,20}$/;

    if (!form.name.trim()) nextErrors.name = "Full name is required";
    if (!form.email.trim()) nextErrors.email = "Email is required";
    else if (!emailPattern.test(form.email.trim()))
      nextErrors.email = "Enter a valid email address";

    if (!form.phone.trim()) nextErrors.phone = "Mobile number is required";
    else if (!phonePattern.test(form.phone.trim()))
      nextErrors.phone = "Enter a valid mobile number";

    if (!form.dob.trim()) nextErrors.dob = "Date of birth is required";

    if (!form.agreePromo) nextErrors.agreePromo = "Checkbox agreement is required";

    return nextErrors;
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setFormError("");
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormError("All fields are required, including the promotional agreement checkbox.");
      innerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setFormError("");
    setFieldErrors({});
    setSubmitting(true);
    try {
      const response = await contentApi.submitEnquiry({
        type: "contact",
        name: form.name,
        email: form.email,
        mobile: `${form.countryCode} ${form.phone}`.trim(),
        message: `OrianaaClub enquiry about ${interestAreas.find((item) => item.value === form.interest)?.label || "general"}.`,
        extra: { dateOfBirth: form.dob, interest: form.interest, promotionalConsent: form.agreePromo },
        recaptchaToken: captchaToken,
      });
      setFormError("");
      setSubmitted(true);
      if (!response.success) setFormError(response.message || "Your enquiry could not be sent.");
    } catch (error) {
      setFormError(error.message || "Your enquiry could not be sent. Please try again.");
    } finally {
      setSubmitting(false);
      innerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const selectCountry = (code) => {
    setForm((c) => ({ ...c, countryCode: code }));
    setCountryOpen(false);
  };

  const selectInterest = (value) => {
    setForm((c) => ({ ...c, interest: value }));
    setInterestOpen(false);
  };

  if (typeof document === "undefined" || !isMounted) return null;

  return createPortal(
    <div
      className="lux-contact lux-contact--modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lux-contact-title"
    >
      <div
        ref={backdropRef}
        className="lux-contact__backdrop"
        onClick={runCloseAnimation}
        aria-hidden="true"
      />
      <div
        ref={bgImageRef}
        className="lux-contact__bg-image"
        style={{ backgroundImage: `url(${resortBg})` }}
        aria-hidden="true"
      >
        <div className="lux-contact__bg-overlay" />
      </div>

      <div className="lux-contact__modal-wrap">
        <div ref={panelRef} className="lux-contact__panel lux-contact__panel--modal">
          <div ref={accentRef} className="lux-contact__accent" aria-hidden="true">
            <span ref={shimmerRef} className="lux-contact__accent-shimmer" />
          </div>

                    <div className="lux-contact__inner" ref={innerRef}>
            <header className="lux-contact__header">
              <Motion.div
                className="lux-contact__badge"
                custom={0}
                initial={shouldReduceMotion ? false : "hidden"}
                animate="visible"
                variants={headerMotion}
              >
                Saptagiri Resorts · OrianaaClub
              </Motion.div>
              <Motion.h2
                id="lux-contact-title"
                custom={1}
                initial={shouldReduceMotion ? false : "hidden"}
                animate="visible"
                variants={headerMotion}
              >
                Get In Touch
              </Motion.h2>
              <Motion.p
                className="lux-contact__subtitle"
                custom={2}
                initial={shouldReduceMotion ? false : "hidden"}
                animate="visible"
                variants={headerMotion}
              >
                A members-only nature resort community focused on wellbeing, pure vegetarian hospitality, and time together.
              </Motion.p>
              <Motion.div
                className="lux-contact__divider"
                variants={shimmerMotion}
                initial={shouldReduceMotion ? false : "hidden"}
                animate="visible"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="lux-contact__close"
                onClick={runCloseAnimation}
                aria-label="Close contact form"
              >
                <X size={20} />
              </Button>
            </header>

            {submitted ? (
              <Motion.div
                className="lux-contact__success"
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="lux-contact__success-badge">
                  <span className="lux-contact__success-check" aria-hidden="true">✓</span>
                </div>
                <p className="lux-contact__success-eyebrow">Thank you</p>
                <h3>Your enquiry is with us.</h3>
                <p>Our team will be in touch soon about your Saptagiri Resorts and OrianaaClub enquiry.</p>
                <Button type="button" className="home-button home-button--green lux-contact__success-btn" onClick={runCloseAnimation}>
                  Close
                </Button>
              </Motion.div>
            ) : (
              <form className="lux-contact__form" onSubmit={handleSubmit} noValidate>
                {formError ? (
                  <Motion.div
                    className="lux-contact__form-alert"
                    role="alert"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {formError}
                  </Motion.div>
                ) : null}

                <Motion.div
                  className={`lux-contact__field${fieldErrors.name ? " lux-contact__field--invalid" : ""}`}
                  custom={0}
                  initial={shouldReduceMotion ? false : "hidden"}
                  animate="visible"
                  variants={fieldMotion}
                >
                  <div className="lux-contact__field-icon">
                    <span className="lux-contact__icon-char" aria-hidden="true">👤</span>
                  </div>
                  <div className="lux-contact__field-body">
                    <Label htmlFor="lux-name">Full name</Label>
                    <Input
                      id="lux-name"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      autoComplete="name"
                      placeholder="Enter your full name"
                      aria-invalid={fieldErrors.name ? "true" : undefined}
                      aria-describedby={fieldErrors.name ? "lux-name-error" : undefined}
                    />
                  </div>
                  {fieldErrors.name ? (
                    <p className="lux-contact__field-error" id="lux-name-error">
                      {fieldErrors.name}
                    </p>
                  ) : null}
                </Motion.div>

                <Motion.div
                  className={`lux-contact__field${fieldErrors.email ? " lux-contact__field--invalid" : ""}`}
                  custom={1}
                  initial={shouldReduceMotion ? false : "hidden"}
                  animate="visible"
                  variants={fieldMotion}
                >
                  <div className="lux-contact__field-icon">
                    <span className="lux-contact__icon-char" aria-hidden="true">✉</span>
                  </div>
                  <div className="lux-contact__field-body">
                    <Label htmlFor="lux-email">Email Id</Label>
                    <Input
                      id="lux-email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      autoComplete="email"
                      placeholder="you@example.com"
                      aria-invalid={fieldErrors.email ? "true" : undefined}
                      aria-describedby={fieldErrors.email ? "lux-email-error" : undefined}
                    />
                  </div>
                  {fieldErrors.email ? (
                    <p className="lux-contact__field-error" id="lux-email-error">
                      {fieldErrors.email}
                    </p>
                  ) : null}
                </Motion.div>

                                <Motion.div
                  className={`lux-contact__field${fieldErrors.phone ? " lux-contact__field--invalid" : ""}${countryOpen ? " is-active" : ""}`}
                  custom={2}
                  initial={shouldReduceMotion ? false : "hidden"}
                  animate="visible"
                  variants={fieldMotion}
                >
                  <div className="lux-contact__field-icon">
                    <span className="lux-contact__icon-char" aria-hidden="true">📞</span>
                  </div>
                  <div className="lux-contact__field-body">
                    <Label htmlFor="lux-phone">Mobile no.</Label>
                    <div className="lux-contact__phone-group">
                      <div className="lux-contact__select lux-contact__select--country">
                        <button
                          type="button"
                          className="lux-contact__select-trigger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCountryOpen((v) => !v);
                            setInterestOpen(false);
                          }}
                          aria-haspopup="listbox"
                          aria-expanded={countryOpen}
                        >
                          <span>{form.countryCode}</span>
                          <ChevronIcon open={countryOpen} />
                        </button>
                        {countryOpen && (
                          <ul className="lux-contact__select-list" role="listbox">
                            {countryCodes.map((c) => (
                              <li
                                key={c.code}
                                className={`lux-contact__select-option${form.countryCode === c.code ? " is-selected" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectCountry(c.code);
                                }}
                                role="option"
                                aria-selected={form.countryCode === c.code}
                              >
                                <span className="lux-contact__select-code">{c.code}</span>
                                <span className="lux-contact__select-label">{c.country}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <Input
                        id="lux-phone"
                        name="phone"
                        type="tel"
                        value={form.phone}
                        onChange={handleChange}
                        autoComplete="tel"
                        placeholder="Mobile number"
                        aria-invalid={fieldErrors.phone ? "true" : undefined}
                        aria-describedby={fieldErrors.phone ? "lux-phone-error" : undefined}
                        className="lux-contact__phone-input"
                      />
                    </div>
                  </div>
                  {fieldErrors.phone ? (
                    <p className="lux-contact__field-error" id="lux-phone-error">
                      {fieldErrors.phone}
                    </p>
                  ) : null}
                </Motion.div>

                <Motion.div
                  className={`lux-contact__field${fieldErrors.dob ? " lux-contact__field--invalid" : ""}`}
                  custom={3}
                  initial={shouldReduceMotion ? false : "hidden"}
                  animate="visible"
                  variants={fieldMotion}
                >
                  <div className="lux-contact__field-icon">
                    <span className="lux-contact__icon-char" aria-hidden="true">📅</span>
                  </div>
                  <div className="lux-contact__field-body">
                    <Label htmlFor="lux-dob">Date of Birth</Label>
                    <Input
                      id="lux-dob"
                      name="dob"
                      type="date"
                      value={form.dob}
                      onChange={handleChange}
                      aria-invalid={fieldErrors.dob ? "true" : undefined}
                      aria-describedby={fieldErrors.dob ? "lux-dob-error" : undefined}
                      className="lux-contact__date-input"
                    />
                  </div>
                  {fieldErrors.dob ? (
                    <p className="lux-contact__field-error" id="lux-dob-error">
                      {fieldErrors.dob}
                    </p>
                  ) : null}
                </Motion.div>

                                <Motion.div
                  className={`lux-contact__field${interestOpen ? " is-active" : ""}`}
                  custom={4}
                  initial={shouldReduceMotion ? false : "hidden"}
                  animate="visible"
                  variants={fieldMotion}
                >
                  <div className="lux-contact__field-icon lux-contact__field-icon--select">
                    <span className="lux-contact__icon-char lux-contact__icon-char--sparkle" aria-hidden="true">◆</span>
                  </div>
                  <div className="lux-contact__field-body">
                    <Label htmlFor="lux-interest">Interest Area</Label>
                    <div className="lux-contact__select lux-contact__select--interest">
                      <button
                        type="button"
                        id="lux-interest"
                        className="lux-contact__select-trigger lux-contact__select-trigger--full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInterestOpen((v) => !v);
                          setCountryOpen(false);
                        }}
                        aria-haspopup="listbox"
                        aria-expanded={interestOpen}
                      >
                        <span>{interestAreas.find((i) => i.value === form.interest)?.label}</span>
                        <ChevronIcon open={interestOpen} />
                      </button>
                      {interestOpen && (
                        <ul className="lux-contact__select-list lux-contact__select-list--full" role="listbox">
                          {interestAreas.map((i) => (
                            <li
                              key={i.value}
                              className={`lux-contact__select-option${form.interest === i.value ? " is-selected" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectInterest(i.value);
                              }}
                              role="option"
                              aria-selected={form.interest === i.value}
                            >
                              {i.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </Motion.div>

                <Motion.div
                  className={`lux-contact__field lux-contact__field--checkbox${fieldErrors.agreePromo ? " lux-contact__field--invalid" : ""}`}
                  custom={5}
                  initial={shouldReduceMotion ? false : "hidden"}
                  animate="visible"
                  variants={fieldMotion}
                >
                  <label className="lux-contact__checkbox" htmlFor="lux-agree">
                    <input
                      type="checkbox"
                      id="lux-agree"
                      name="agreePromo"
                      checked={form.agreePromo}
                      onChange={handleChange}
                      className="lux-contact__checkbox-input"
                      aria-invalid={fieldErrors.agreePromo ? "true" : undefined}
                      aria-describedby={fieldErrors.agreePromo ? "lux-agree-error" : undefined}
                    />
                    <span className="lux-contact__checkbox-box" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span className="lux-contact__checkbox-label">
                      I agree to receive promotional SMS and MMS messages from OrianaaClub.
                    </span>
                  </label>
                  {fieldErrors.agreePromo ? (
                    <p className="lux-contact__field-error lux-contact__field-error--checkbox" id="lux-agree-error">
                      {fieldErrors.agreePromo}
                    </p>
                  ) : null}
                </Motion.div>

                <Motion.div
                  className="lux-contact__field"
                  custom={6}
                  initial={shouldReduceMotion ? false : "hidden"}
                  animate="visible"
                  variants={fieldMotion}
                >
                  {recaptchaSiteKey ? (
                    <div className="lux-contact__recaptcha"><ReCAPTCHA sitekey={recaptchaSiteKey} onChange={(token) => setCaptchaToken(token || "")} /></div>
                  ) : (
                    <p className="lux-contact__fine-print">Verification is not configured in this local environment.</p>
                  )}
                </Motion.div>

                <Motion.div
                  className="lux-contact__actions"
                  custom={7}
                  initial={shouldReduceMotion ? false : "hidden"}
                  animate="visible"
                  variants={fieldMotion}
                >
                  <Button type="submit" disabled={submitting} className="lux-contact__submit home-button home-button--green">
                    {submitting ? "Sending..." : "Submit"}
                    <ArrowRight size={17} aria-hidden="true" />
                  </Button>
                  <p className="lux-contact__fine-print">
                    Your information will be used by OrianaaClub to respond to your enquiry.
                  </p>
                </Motion.div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
