import React from "react";
import { createElement } from "react";
import { ArrowRight } from "lucide-react";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { Link } from "react-router-dom";
import logoImg from "../assets/Oriana Club Luxury Emblem Transparent.png";
import "./Footer.css";

const exploreLinks = [
  { label: "Resorts", to: "/resorts" },
  { label: "Experiences", to: "/experiences" },
  { label: "Events", to: "/events" },
  { label: "Journal", to: "/blog" },
];

const membershipLinks = [
  { label: "Membership benefits", to: "/membership-benefits" },
  { label: "Members login", to: "/login" },
  { label: "Join membership", to: "/luxury-membership" },
];

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/saptagiriresorts?obrf=NjN3Z243MzBndHhs", Icon: FaInstagram },
  { label: "Facebook", href: "https://www.facebook.com/share/1JtRYCZw7W/", Icon: FaFacebookF },
  { label: "Twitter", href: "https://x.com/Saptagiriresort?s=20", Icon: FaXTwitter },
  { label: "YouTube", href: "https://www.youtube.com/@SaptagiriResorts", Icon: FaYoutube },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/saptagiri-hospitality-lifestyle/posts/?feedView=all", Icon: FaLinkedinIn },
];

export default function Footer() {
  const adminUrl = import.meta.env.VITE_ADMIN_URL;

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__rule" aria-hidden="true" />
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Link to="/" aria-label="Saptagiri Resorts and OrianaaClub home">
              <img src={logoImg} alt="OrianaaClub" />
            </Link>
            <p>
              OrianaaClub is the members-only community of Saptagiri Resorts,
              bringing together nature-led stays, vegetarian hospitality,
              wellness, and time with family.
            </p>
            <div className="site-footer__socials" aria-label="Social media">
              {socialLinks.map(({ label, href, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}>
                  {createElement(Icon, { size: 16, "aria-hidden": true })}
                </a>
              ))}
            </div>
          </div>

          <nav className="site-footer__links" aria-label="Explore Saptagiri Resorts">
            <h2>Explore</h2>
            {exploreLinks.map((link) => (
              <Link key={link.to} to={link.to}>{link.label}</Link>
            ))}
          </nav>

          <nav className="site-footer__links" aria-label="Membership links">
            <h2>Membership</h2>
            {membershipLinks.map((link) => (
              <Link key={link.to} to={link.to}>{link.label}</Link>
            ))}
            <Link to="/#enquiry">Get in touch</Link>
          </nav>

          <div className="site-footer__invitation">
            <p className="site-footer__eyebrow">Members of nature</p>
            <h2>Belong. Renew. Return.</h2>
            <p>Find your place in a community shaped by nature, wellbeing, and togetherness.</p>
            <Link className="site-footer__join" to="/luxury-membership">
              Discover membership <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p>© 2026 OrianaaClub. All rights reserved.</p>
          <p>Belong. Renew. Return.</p>
          {adminUrl && <a href={adminUrl} target="_blank" rel="noopener noreferrer">Admin Login</a>}
        </div>
      </div>
    </footer>
  );
}
