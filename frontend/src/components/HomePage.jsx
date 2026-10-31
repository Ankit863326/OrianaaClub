import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Leaf, Mountain, Trees, Waves } from "lucide-react";
import { AnimatePresence, LazyMotion, m as Motion, useReducedMotion } from "framer-motion";
import { Button } from "./ui/button";
// import beachImage from "../assets/beachh.jpg";
import heroVideo from "../assets/OrianaaClub_promo_video_creation_20261019122757.mp4";
import LuxuryContactDrawer from "./LuxuryContactDrawer";
import { contentApi } from "../lib/contentApi.js";
import saptagiriimg from "../assets/Swimming pool .png";
import "./HomePage.css";

const destinations = [
  {
    name: "Saptagiri Resort",
    place: "Yewalewadi, Pune Maharashtra",
    headline: "Room to find your own away",
    image:
      saptagiriimg,
  },
  {
    name: "Saptagiri Resort",
    place: "Igatpuri, Nashik Maharashtra",
    headline: "Room to find your own away",
    image:
      "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1000&q=85",
  },
];

const events = [
  {
    type: "Events & Celebrations",
    title: "Weddings",
    image:
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=90",
  },
  {
    type: "Wellness & Renewal",
    title: "A slower kind of escape",
    image:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1800&q=90",
  },
  {
    type: "Cherished Moments",
    title: "Make room for wonder",
    image:
      "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1800&q=90",
  },
];

// const stories = [
//   {
//     quote:
//       "I have stayed in fine hotels all over the world. Orianaa is the first place that felt like it was waiting for me.",
//     name: "Arjun Mehta",
//     role: "Founder, Mehta Industries",
//     initials: "AM",
//   },
//   {
//     quote:
//       "The points system is honest. One rupee, one point. No fine print, no games. That is rare.",
//     name: "Sarah Chen",
//     role: "Partner, Chen Capital",
//     initials: "SC",
//   },
//   {
//     quote:
//       "My wife and I celebrated our twentieth anniversary at an Orianaa resort. They remembered the wine we drank on our first date.",
//     name: "Vikram Rao",
//     role: "Chairman, Rao Group",
//     initials: "VR",
//   },
// ];

const eventCardVariants = {
  enter: (direction) => ({
    opacity: 0,
    x: direction > 0 ? "105%" : "-105%",
    scale: 0.94,
    rotate: direction > 0 ? 1.4 : -1.4,
    zIndex: 3,
  }),
  center: { opacity: 1, x: 0, scale: 1, rotate: 0, zIndex: 3 },
  exit: (direction) => ({
    opacity: 0,
    x: direction > 0 ? "-105%" : "105%",
    scale: 0.94,
    rotate: direction > 0 ? -1.2 : 1.2,
    zIndex: 2,
  }),
};

const loadMotionFeatures = () =>
  import("./motion-features.js").then((module) => module.default);

export default function HomePage() {
  const [activeEvent, setActiveEvent] = useState(0);
  const [eventDirection, setEventDirection] = useState(1);
  const [contactOpen, setContactOpen] = useState(false);
  const [memberReviews, setMemberReviews] = useState([]);
  const [activeReview, setActiveReview] = useState(0);
  const universeRef = useRef(null);
  const universeScrollTriggerRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const event = events[activeEvent];
  const previousEvent = (activeEvent - 1 + events.length) % events.length;
  const nextEvent = (activeEvent + 1) % events.length;

  useEffect(() => {
    let active = true;
    contentApi.memberReviews()
      .then((result) => {
        if (active) setMemberReviews(Array.isArray(result?.data) ? result.data : []);
      })
      .catch(() => {
        if (active) setMemberReviews([]);
      });
    return () => { active = false; };
  }, []);

  const changeReview = (direction) => {
    setActiveReview((current) => (current + direction + memberReviews.length) % memberReviews.length);
  };

  const changeEvent = (direction) => {
    setEventDirection(direction);
    setActiveEvent((current) => (current + direction + events.length) % events.length);
  };

  const handleThumbClick = (index) => {
    const st = universeScrollTriggerRef.current;
    if (st) {
      const targetY = index === 0 ? st.start + 2 : st.start + (st.end - st.start) * 0.85;
      window.scrollTo({ top: targetY, behavior: "smooth" });
    }
  };

  useLayoutEffect(() => {
    let isActive = true;
    let media;

    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([gsapModule, scrollTriggerModule]) => {
      if (!isActive) return;

      const gsap = gsapModule.default;
      const ScrollTrigger = scrollTriggerModule.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });

      const setupGalleryAnimation = (isMobile) => {
        const gallery = universeRef.current?.querySelector(".home-universe-gallery");
        if (!gallery) return;

        const centerImages = gsap.utils.toArray("[data-universe-image]", gallery);
        const captions = gsap.utils.toArray("[data-universe-caption]", gallery);
        const thumbnails = gsap.utils.toArray("[data-universe-thumb]", gallery);
        const indicators = gsap.utils.toArray(".home-universe-gallery__indicator", gallery);

        gsap.set(centerImages[0], { autoAlpha: 1, scale: 1 });
        gsap.set(centerImages.slice(1), { autoAlpha: 0, scale: 1.04 });
        gsap.set(captions[0], { autoAlpha: 1, y: 0 });
        gsap.set(captions.slice(1), { autoAlpha: 0, y: 10 });
        gsap.set(thumbnails[0], { autoAlpha: 1, scale: 1.02 });
        gsap.set(thumbnails.slice(1), { autoAlpha: 0.55, scale: 1 });
        gsap.set(indicators, { scaleX: 0 });
        gsap.set(indicators[0], { scaleX: 1 });

        const timeline = gsap.timeline({
          scrollTrigger: {
            id: isMobile ? "universe-mobile" : "universe-desktop",
            trigger: universeRef.current,
            start: "top top+=78",
            end: isMobile ? "+=100%" : "+=120%",
            pin: true,
            pinSpacing: true,
            scrub: isMobile ? 0.35 : 0.45,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        universeScrollTriggerRef.current = timeline.scrollTrigger;

        timeline.to(".home-universe-gallery__main-image:first-child", { scale: 1.06, duration: 0.8, ease: "none" }, 0);

        centerImages.slice(1).forEach((image, index) => {
          const transitionStart = 0.2 + index * 0.24;
          timeline.to(centerImages[index], { autoAlpha: 0, duration: 0.12, ease: "none" }, transitionStart);
          if (captions[index]) {
            timeline.to(captions[index], { autoAlpha: 0, y: -10, duration: 0.12, ease: "none" }, transitionStart);
          }
          timeline.fromTo(
            image,
            { autoAlpha: 0, scale: 1.04 },
            { autoAlpha: 1, scale: 1, duration: 0.12, ease: "none" },
            transitionStart,
          );
          if (captions[index + 1]) {
            timeline.fromTo(
              captions[index + 1],
              { autoAlpha: 0, y: 10 },
              { autoAlpha: 1, y: 0, duration: 0.12, ease: "none" },
              transitionStart,
            );
          }
          timeline.to(thumbnails[index], { autoAlpha: 0.55, scale: 1, duration: 0.1, ease: "none" }, transitionStart);
          timeline.to(indicators[index], { scaleX: 0, duration: 0.1, ease: "none" }, transitionStart);
          timeline.to(thumbnails[index + 1], { autoAlpha: 1, scale: 1.02, duration: 0.1, ease: "none" }, transitionStart);
          timeline.to(indicators[index + 1], { scaleX: 1, duration: 0.1, ease: "none" }, transitionStart);
        });
      };

      media = gsap.matchMedia();
      media.add("(min-width: 1001px) and (prefers-reduced-motion: no-preference)", () => {
        const context = gsap.context(() => setupGalleryAnimation(false), universeRef);
        return () => {
          universeScrollTriggerRef.current = null;
          context.revert();
        };
      });

      media.add("(max-width: 1000px) and (prefers-reduced-motion: no-preference)", () => {
        const context = gsap.context(() => setupGalleryAnimation(true), universeRef);
        return () => {
          universeScrollTriggerRef.current = null;
          context.revert();
        };
      });
    });

    return () => {
      isActive = false;
      universeScrollTriggerRef.current = null;
      media?.revert();
    };
  }, []);

  return (
    <LazyMotion features={loadMotionFeatures}>
    <main className="home-page">
      <section
        className="home-hero"
        style={{ backgroundImage: `url()` }}
        aria-labelledby="home-hero-title"
      >
        <video
          className="home-hero__video"
          autoPlay={!shouldReduceMotion}
          muted
          loop
          playsInline
          controls
          preload="metadata"
          aria-label="Saptagiri Resorts video"
        >
          <source src={heroVideo} type="video/mp4" />
          Your browser does not support embedded video.
        </video>
        <Motion.div
          className="home-hero__content"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.75, ease: "easeOut" }}
        >
          <p className="home-eyebrow">Saptagiri Resorts · The OrianaaClub vision</p>
          {/* <h1 id="home-hero-title">The Orianaa Club</h1> */}
          <p className="home-hero__summary">
            A members-only community of nature resorts across India. Through
            OrianaaClub, discover restorative stays, pure vegetarian hospitality,
            holistic wellness, and meaningful time together.
          </p>
          <div className="home-hero__actions">
            <Button asChild>
              <a className="home-button home-button--gold" href="/luxury-membership">About Membership</a>
            </Button>
            <Button asChild variant="outline">
              <a className="home-button home-button--outline" href="#universe">Explore</a>
            </Button>
          </div>
        </Motion.div>
        <a className="home-hero__scroll" href="#universe" aria-label="Scroll to explore">
          <span />
        </a>
      </section>

      <section className="home-universe" id="universe" ref={universeRef}>
        <div className="home-universe__copy">
          <p className="home-eyebrow home-eyebrow--dark">Our vision</p>
          <h2>Your nature home, wherever you travel</h2>
          <p className="home-body-copy">
            Saptagiri Resorts envisions a private club of nature sanctuaries
            across India’s hills, beaches, and forests. OrianaaClub brings
            members together through familiar comfort, thoughtful hospitality,
            and a lasting sense of belonging.
          </p>
          <div className="home-inline-actions">
            <Button asChild>
              <a className="home-button home-button--green" href="/resorts">Explore Destinations</a>
            </Button>
            <a className="home-text-link" href="/membership-benefits">
              About Membership <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="home-universe-gallery" aria-label="Saptagiri Resorts collection">
          <div className="home-universe-gallery__main">
            {destinations.map((destination, index) => (
              <img
                className="home-universe-gallery__main-image"
                key={destination.place || index}
                src={destination.image}
                alt={`${destination.name} - ${destination.place}`}
                data-universe-image
              />
            ))}
            {destinations.map((destination, index) => (
              <div
                className="home-universe-gallery__caption"
                key={`caption-${destination.place || index}`}
                data-universe-caption
              >
                <p className="home-eyebrow">{destination.place}</p>
                <h3>{destination.headline || "Room to find your own away"}</h3>
              </div>
            ))}
          </div>
          <div className="home-universe-gallery__thumbs" aria-label="Destinations in the collection">
            {destinations.map((destination, index) => (
              <figure
                className="home-universe-gallery__thumb"
                key={destination.place || index}
                data-universe-thumb
                onClick={() => handleThumbClick(index)}
                role="button"
                tabIndex={0}
                style={{ cursor: "pointer" }}
                aria-label={`View ${destination.name} at ${destination.place}`}
              >
                <img src={destination.image} alt={destination.place} />
                <figcaption title={destination.place}>
                  {destination.place.split(",")[0]} - {destination.name}
                </figcaption>
                <span className="home-universe-gallery__indicator" />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="home-destinations" id="destinations">
        <div className="home-section-heading">
          <p className="home-eyebrow home-eyebrow--dark">Nature, in all its moods</p>
          <h2>Discover Saptagiri Resorts</h2>
          <p>
            We are building a collection of member resorts shaped by their
            surroundings, from peaceful hillsides to the rhythm of the coast.
          </p>
        </div>
        <div className="home-destination-grid">
          {destinations.map((destination, index) => (
            <Motion.a
              className="home-destination"
              href="/resorts"
              key={destination.place || index}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : index * 0.08 }}
            >
              <div className="home-destination__image">
                <img src={destination.image} alt={destination.name} />
                <span className="home-destination__arrow" aria-hidden="true">
                  <ArrowRight size={19} />
                </span>
              </div>
              <div className="home-destination__caption">
                <h3>{destination.name}</h3>
                <p>{destination.place}</p>
              </div>
            </Motion.a>
          ))}
        </div>
        <div className="home-destination-signature">
          <div className="home-destination-signature__copy">
            <p className="home-eyebrow home-eyebrow--dark">A growing resort family</p>
            <h3>Belong. Renew. Return.</h3>
          </div>
          <div className="home-destination-signature__settings" aria-label="Resort settings">
            <span><Waves size={19} strokeWidth={1.4} aria-hidden="true" /> Coast</span>
            <span><Mountain size={19} strokeWidth={1.4} aria-hidden="true" /> Hills</span>
            <span><Trees size={19} strokeWidth={1.4} aria-hidden="true" /> Forest</span>
          </div>
          <a className="home-destination-signature__link" href="/resorts">
            Explore every stay <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="home-events" id="events">
        <div className="home-event-stage">
          <div
            className="home-event-peek home-event-peek--left"
            style={{ backgroundImage: `url(${events[previousEvent].image})` }}
            aria-hidden="true"
          />
          <div
            className="home-event-peek home-event-peek--right"
            style={{ backgroundImage: `url(${events[nextEvent].image})` }}
            aria-hidden="true"
          />
          <AnimatePresence initial={false} custom={eventDirection}>
            <Motion.article
              className="home-event-card"
              key={activeEvent}
              custom={eventDirection}
              variants={eventCardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: shouldReduceMotion ? 0 : 0.68, ease: [0.16, 1, 0.3, 1] }}
              drag={shouldReduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.08}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) changeEvent(1);
                if (info.offset.x > 80) changeEvent(-1);
              }}
              style={{ backgroundImage: `url(${event.image})` }}
            >
            <div className="home-event-card__content">
              <p>{event.type}</p>
              <h2>{event.title}</h2>
              <p className="home-event-card__description">
                The most meaningful moments deserve a setting that feels like
                it was made just for you.
              </p>
              <div className="home-event-card__actions">
                <Button asChild>
                  <a className="home-button home-button--green" href="/events">Explore Events</a>
                </Button>
                <Button asChild variant="outline">
                  <a className="home-button home-button--outline" href="/membership-benefits">About Membership</a>
                </Button>
              </div>
            </div>
            </Motion.article>
          </AnimatePresence>
          <Button
            variant="carousel"
            size="icon"
            className="home-event-control home-event-control--previous"
            type="button"
            onClick={() => changeEvent(-1)}
            aria-label="Previous event"
          >
            <ChevronLeft size={22} />
          </Button>
          <Button
            variant="carousel"
            size="icon"
            className="home-event-control home-event-control--next"
            type="button"
            onClick={() => changeEvent(1)}
            aria-label="Next event"
          >
            <ChevronRight size={22} />
          </Button>
        </div>
        <div className="home-event-pagination" aria-label="Choose an event">
          {events.map((carouselEvent, index) => (
            <Button
              key={carouselEvent.title}
              variant="indicator"
              size="indicator"
              className={`home-event-pagination__dot${activeEvent === index ? " is-active" : ""}`}
              type="button"
              aria-label={`Show ${carouselEvent.title}`}
              aria-current={activeEvent === index ? "true" : undefined}
              onClick={() => {
                setEventDirection(index > activeEvent ? 1 : -1);
                setActiveEvent(index);
              }}
            />
          ))}
        </div>
      </section>

      <section className="home-stories" id="stories">
        <div className="home-section-heading">
          <p className="home-eyebrow home-eyebrow--dark">In their own words</p>
          <h2>Stories</h2>
          <p>Experiences shared by OrianaaClub members.</p>
        </div>
        {memberReviews.length ? <div className="home-story-carousel" aria-label="Member reviews">
          <article className="home-story" aria-live="polite" aria-atomic="true">
            <div className="home-story__stars" aria-label={`${memberReviews[activeReview].rating} out of 5 stars`}>
              {'★'.repeat(memberReviews[activeReview].rating)}{'☆'.repeat(5 - memberReviews[activeReview].rating)}
            </div>
            <blockquote>“{memberReviews[activeReview].message}”</blockquote>
            <div className="home-story__author">
              <span className="home-story__avatar" aria-hidden="true">
                {String(memberReviews[activeReview].memberName || 'Member').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
              </span>
              <div>
                <h3>{memberReviews[activeReview].memberName}</h3>
                <p>OrianaaClub member</p>
              </div>
            </div>
          </article>
          {memberReviews.length > 1 && <>
            <div className="home-story-carousel__controls">
              <button type="button" onClick={() => changeReview(-1)} aria-label="Previous member review">‹</button>
              <span>{activeReview + 1} / {memberReviews.length}</span>
              <button type="button" onClick={() => changeReview(1)} aria-label="Next member review">›</button>
            </div>
            <div className="home-story-carousel__indicators" aria-label="Choose a member review">
              {memberReviews.map((review, index) => <button
                key={review._id || `${review.memberName}-${index}`}
                type="button"
                className={activeReview === index ? 'is-active' : ''}
                aria-label={`Show review by ${review.memberName}`}
                aria-current={activeReview === index ? 'true' : undefined}
                onClick={() => setActiveReview(index)}
              />)}
            </div>
          </>}
        </div> : <p className="home-stories__empty">Member stories will appear here as reviews are shared.</p>}
      </section>

      <section className="home-benefits" id="benefits">
        <Motion.div
          className="home-benefits__image"
          initial={shouldReduceMotion ? false : { opacity: 0, x: -22 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.55 }}
        >
          <img
            src="https://i.pinimg.com/1200x/ea/3a/02/ea3a023dfe2b94a9137b569ca4478e4a.jpg"
            alt="A family spending a quiet afternoon together"
          />
          <span className="home-benefits__image-note">Make time mean more</span>
        </Motion.div>
        <Motion.div
          className="home-benefits__copy"
          initial={shouldReduceMotion ? false : { opacity: 0, x: 22 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.55, delay: shouldReduceMotion ? 0 : 0.1 }}
        >
          <p className="home-eyebrow home-eyebrow--dark">Membership, reimagined</p>
          <h2>Benefits of Membership</h2>
          <p className="home-body-copy">
            OrianaaClub is the members-only community of Saptagiri Resorts.
            Each stay is envisioned as a chance to slow down, reconnect with
            nature, and return to balance.
          </p>
          <div className="home-benefit-points">
            <article>
              <Leaf size={30} strokeWidth={1.5} aria-hidden="true" />
              <h3>Membership value</h3>
              <p>Explore the benefits available with each membership plan.</p>
            </article>
            <article>
              <Trees size={30} strokeWidth={1.5} aria-hidden="true" />
              <h3>Rooted in nature and wellbeing</h3>
              <p>Nature-led stays, pure vegetarian hospitality, wellness, and active leisure are at the heart of the Saptagiri Resorts vision.</p>
            </article>
          </div>
          <Button asChild>
            <a className="home-button home-button--green" href="/luxury-membership">Join Membership</a>
          </Button>
        </Motion.div>
      </section>

      <section className="home-enquiry" id="enquiry">
        <Motion.div
          className="home-enquiry__image"
          role="img"
          aria-label="A calm, thoughtfully designed guest room"
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 1.03 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.6 }}
        />
        <Motion.div
          className="home-enquiry__copy"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.1 }}
        >
          <p className="home-eyebrow home-eyebrow--dark">A note from Saptagiri Resorts</p>
          <h2>How can we help?</h2>
          <p>Ask us about OrianaaClub membership and the Saptagiri Resorts vision.</p>
          <Button
            type="button"
            className="home-button home-button--green"
            onClick={() => setContactOpen(true)}
          >
            Get in touch <ArrowRight size={17} aria-hidden="true" />
          </Button>
        </Motion.div>
      </section>
      <LuxuryContactDrawer open={contactOpen} onOpenChange={setContactOpen} />
    </main>
    </LazyMotion>
  );
}
