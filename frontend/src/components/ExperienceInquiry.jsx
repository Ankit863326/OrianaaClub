import React, { useState } from "react";
import "./ExperienceInquiry.css";
import ReCAPTCHA from "react-google-recaptcha";
import { contentApi } from "../lib/contentApi.js";

const Orianaaleadform = () => {
  const [captchaValue, setCaptchaValue] = useState(null);
  const [consent, setConsent] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    city: "",
    age: "",
    email: "",
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitStatus, setSubmitStatus] = useState("success");

  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  const handleCaptcha = (value) => {
    setCaptchaValue(value);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "name") {
      const filteredValue = value.replace(/[^A-Za-z.\s]/g, "");
      setFormData({ ...formData, [name]: filteredValue });
      return;
    }

    if (name === "mobile") {
      const filteredValue = value.replace(/[^0-9+\s]/g, "");
      setFormData({ ...formData, [name]: filteredValue });
      return;
    }

    setFormData({ ...formData, [name]: value });
  };

  const validate = () => {
    let newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Please enter your full name";
    } else if (!/^[A-Za-z.\s]+$/.test(formData.name)) {
      newErrors.name = "Name can only contain letters, spaces and dots";
    }

    if (!formData.mobile.trim()) {
      newErrors.mobile = "Please enter your mobile number";
    } else if (!/^\+?[0-9\s]{7,15}$/.test(formData.mobile.trim())) {
      newErrors.mobile = "Enter a valid mobile number";
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }

    if (!formData.age) {
      newErrors.age = "Please select your age group";
    }

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (!captchaValue) {
      newErrors.captcha = "Please verify you're not a robot";
    }

    if (!consent) {
      newErrors.consent = "Please accept terms to continue";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    setSubmitMessage("");
    try {
      const response = await contentApi.submitEnquiry({
        type: "experience",
        name: formData.name,
        email: formData.email,
        mobile: formData.mobile,
        message: "Request for an exclusive OrianaaClub experience.",
        extra: { city: formData.city, ageGroup: formData.age },
        recaptchaToken: captchaValue || "",
      });
      setSubmitMessage(response.message || "Thank you. Your enquiry has been sent.");
      setSubmitStatus("success");
      setFormData({ name: "", mobile: "", city: "", age: "", email: "" });
      setCaptchaValue(null);
    } catch (error) {
      setSubmitMessage(error.message || "We could not send your enquiry. Please try again.");
      setSubmitStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="form-lead-section">
      <div className="form-overlay"></div>

      <div className="form-shell">
        <div className="form-left">
          <div className="form-copy">
            <span className="form-badge">INSPIRED BY SAPTAGIRI</span>

            <h1 className="form-title">
              Discover the <span className="form-brand">OrianaaClub</span> Experience
            </h1>

            <p className="form-description">
              Where nature, wellness, and celebration come together to create meaningful and refined experiences. <br /><b>Rooted in holistic living and serene natural surroundings.</b>
            </p>
          </div>
        </div>

        <div className="form-right">
          <div className="form-card">
            <div className="form-top">
              <span className="form-mini-tag">Premium Access</span>
              <h2>Request an Exclusive Experience</h2>
              <p>
Share your details and our team will curate your experience.              </p>
            </div>

            <form className="form-wrapper" onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>
                    Name <span>*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={errors.name ? "form-error" : ""}
                  />
                  {errors.name && (
                    <p className="form-error-text">{errors.name}</p>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    Mobile <span>*</span>
                  </label>
                  <input
                    type="tel"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    className={errors.mobile ? "form-error" : ""}
                  />
                  {errors.mobile && (
                    <p className="form-error-text">{errors.mobile}</p>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    City <span>*</span>
                  </label>
                  <div className="form-input-wrap">
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className={errors.city ? "form-error" : ""}
                    />
                    <span className="form-input-icon">⌕</span>
                  </div>
                  {errors.city && (
                    <p className="form-error-text">{errors.city}</p>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    Age <span>*</span>
                  </label>
                  <select
                    name="age"
                    value={formData.age}
                    onChange={handleChange}
                    className={errors.age ? "form-error" : ""}
                  >
                    <option value="">Age Group</option>
                    <option value="<24">&lt;24</option>
                    <option value="25-28">25-28</option>
                    <option value="29-35">29-35</option>
                    <option value="36-49">36-49</option>
                    <option value="50-55">50-55</option>
                    <option value="55+">&gt;55</option>
                  </select>
                  {errors.age && (
                    <p className="form-error-text">{errors.age}</p>
                  )}
                </div>

                <div className="form-group form-full-width">
                  <label>
                    Email ID <span>*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={errors.email ? "form-error" : ""}
                  />
                  {errors.email && (
                    <p className="form-error-text">{errors.email}</p>
                  )}
                </div>
              </div>

              <div className="form-captcha">
                {siteKey && (
                  <div className="recaptcha-wrap">
                    <ReCAPTCHA sitekey={siteKey} onChange={handleCaptcha} />
                  </div>
                )}
                {errors.captcha && (
                  <p className="form-error-text">{errors.captcha}</p>
                )}
              </div>

              <div className="form-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={() => setConsent(!consent)}
                />
                <label>
                  I agree to be contacted by <strong>OrianaaClub</strong>{" "}
                  regarding my interest via phone call, WhatsApp, or any other
                  communication channel. I hereby provide my consent as per the{" "}
                  <a href="/">T&amp;C</a> and <a href="/">Declaration</a>.
                </label>
              </div>

              {errors.consent && (
                <p className="form-error-text">{errors.consent}</p>
              )}

              {submitMessage && <p role={submitStatus === "error" ? "alert" : "status"} style={{ color: submitStatus === "success" ? "#287a4c" : "#b00020" }}>{submitMessage}</p>}
              <button type="submit" className="form-submit" disabled={submitting}>
                {submitting ? "Sending..." : "Submit"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Orianaaleadform;