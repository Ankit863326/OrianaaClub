import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, ChevronRight, X, Search, ChevronLeft } from "lucide-react";
import "./Blog.css";
import { contentApi } from "../../lib/contentApi.js";
import { apiFileUrl } from "../../config/api.js";
import imagePlaceholder from "../../assets/image-placeholder.svg";

function handleImageError(event) {
  if (event.currentTarget.dataset.fallback) return;
  event.currentTarget.dataset.fallback = "true";
  event.currentTarget.src = imagePlaceholder;
}

/* ─── 3 Vertical Featured Cards for Section 3 ─── */
const SLIDE_CARDS = [
  {
    id: "saptagiri-table",
    title: "At the Saptagiri Table",
    category: "Culinary & Dining",
    date: "16 August 2026",
    readTime: "5 min read",
    image: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?q=85&w=1600&auto=format&fit=crop",
    excerpt: "Thoughtful dining is about more than what is served. It is about atmosphere, conversation, presentation and the memories created around the table.",
    content: `Dining at Orianaa Saptagiri is an invitation to slow down and savour every nuance. From farm-to-table organic produce harvested daily to candlelit outdoor tables overlooking tranquil waters, every meal is crafted as an occasion. Our master chefs combine indigenous flavours with modern culinary finesse, creating dishes that tell stories of tradition and innovation. Join us for curated wine pairings, chef's table experiences, and unhurried evenings where conversation flows as effortlessly as the sea breeze.`,
  },
  {
    id: "family-escape",
    title: "The Family Escape, Reimagined",
    category: "Family & Leisure",
    date: "21 July 2026",
    readTime: "6 min read",
    image: "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?q=85&w=1600&auto=format&fit=crop",
    excerpt: "The best family holidays leave everyone with something to remember. Explore a slower, richer way to spend time together.",
    content: `Reconnecting as a family requires space, stillness, and shared wonder. At Orianaa, family escapes are thoughtfully designed to offer something extraordinary for every generation. Children explore nature trails, artistic workshops, and guided stargazing sessions, while adults indulge in holistic spa treatments or quiet reading nooks. Together, families gather for sunset catamaran cruises, private beach barbecues, and outdoor cinema nights under the canopy of stars.`,
  },
  {
    id: "occasion-destination",
    title: "When the Occasion Becomes the Destination",
    category: "Celebrations",
    date: "08 July 2026",
    readTime: "7 min read",
    image: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=85&w=1600&auto=format&fit=crop",
    excerpt: "Some celebrations deserve more than a venue. They deserve an entire setting designed around the people, moments and memories that matter.",
    content: `Milestones in life demand settings that do justice to the emotion behind them. Whether celebrating a silver wedding anniversary, a private family milestone, or an intimate vow renewal, Orianaa transforms moments into everlasting memories. Custom floral arrangements, bespoke menus tailored to your personal palate, and dedicated concierge teams ensure every detail reflects your unique story in effortless luxury.`,
  },
];

/* ─── All Articles Catalogue ─── */
const BLOG_POSTS = [
  {
    id: "art-of-slow-stay",
    title: "The Art of the Slow Stay",
    category: "Resort Life",
    date: "12 September 2026",
    readTime: "4 min read",
    image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?q=85&w=1200&auto=format&fit=crop",
    excerpt: "There is a certain luxury in having nowhere else to be. Discover the pleasure of slowing down, settling in and letting the day unfold naturally.",
    content: `In a world that moves at an unprecedented pace, true luxury is no longer defined by opulence, but by time and space. The 'Slow Stay' philosophy invites guests to step away from schedules, notifications, and obligations. Wake up without alarms to the sound of ocean swells; enjoy breakfast whenever you choose; wander through lush garden paths without a destination in mind. At Orianaa, we curate environments that encourage deep rest, reflection, and quiet inspiration.`,
  },
  {
    id: "better-way-weekend",
    title: "A Better Way to Spend the Weekend",
    category: "Getaways",
    date: "28 August 2026",
    readTime: "5 min read",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=85&w=1200&auto=format&fit=crop",
    excerpt: "From leisurely mornings to long dinners, a weekend away can become more than a break from routine. It can become a ritual worth returning to.",
    content: `Weekend escapes should leave you feeling renewed, not rushed. Our weekend retreat experience is built around seamless relaxation—from private airport transfers to pre-arranged spa therapies and late check-outs. Experience mornings spent sipping artisanal coffee on your private pavilion, afternoons lounging by infinity pools, and evenings savoring locally sourced seafood by candlelight.`,
  },
  {
    id: "saptagiri-table",
    title: "At the Saptagiri Table",
    category: "Dining",
    date: "16 August 2026",
    readTime: "5 min read",
    image: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?q=85&w=1600&auto=format&fit=crop",
    excerpt: "Thoughtful dining is about more than what is served. It is about atmosphere, conversation, presentation and the memories created around the table.",
    content: `Dining at Orianaa Saptagiri is an invitation to slow down and savour every nuance. From farm-to-table organic produce harvested daily to candlelit outdoor tables overlooking tranquil waters, every meal is crafted as an occasion.`,
  },
  {
    id: "quiet-luxury-wellbeing",
    title: "The Quiet Luxury of Wellbeing",
    category: "Wellness",
    date: "04 August 2026",
    readTime: "6 min read",
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=85&w=1200&auto=format&fit=crop",
    excerpt: "Wellness does not always have to be complicated. Sometimes it begins with silence, space, fresh air and a little more time for yourself.",
    content: `True wellness starts when the mind finds quiet. Our holistic wellness sanctuary blends ancient Ayurvedic therapies with contemporary thermal hydrotherapy. Guided yoga sessions at sunrise on oceanfront decks, sound bath healing under palm canopies, and personalized botanical skin rituals revitalize the body and soothe the soul.`,
  },
  {
    id: "family-escape",
    title: "The Family Escape, Reimagined",
    category: "Family",
    date: "21 July 2026",
    readTime: "6 min read",
    image: "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?q=85&w=1200&auto=format&fit=crop",
    excerpt: "The best family holidays leave everyone with something to remember. Explore a slower, richer way to spend time together.",
    content: `Reconnecting as a family requires space, stillness, and shared wonder. At Orianaa, family escapes are thoughtfully designed to offer something extraordinary for every generation.`,
  },
  {
    id: "occasion-destination",
    title: "When the Occasion Becomes the Destination",
    category: "Celebrations",
    date: "08 July 2026",
    readTime: "7 min read",
    image: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=85&w=1200&auto=format&fit=crop",
    excerpt: "Some celebrations deserve more than a venue. They deserve an entire setting designed around the people, moments and memories that matter.",
    content: `Milestones in life demand settings that do justice to the emotion behind them. Whether celebrating a silver wedding anniversary or an intimate vow renewal, Orianaa transforms moments into everlasting memories.`,
  },
];

const CATEGORIES = ["All", "Resort Life", "Getaways", "Dining", "Wellness", "Family", "Celebrations"];

/* ─── Interactive Draggable Slide Capsule Button (Snaps back to origin) ─── */
function SlideCapsuleButton({ onExplore }) {
  return (
    <div
      className="b2-card__capsule"
      onClick={(e) => {
        e.stopPropagation();
        onExplore();
      }}
    >
      <Motion.span
        className="b2-card__arrow-circle"
        drag="x"
        dragConstraints={{ left: 0, right: 130 }}
        dragSnapToOrigin={true}
        dragElastic={0.1}
        onDragEnd={(e, info) => {
          if (info.offset.x > 40) {
            onExplore();
          }
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <ChevronRight size={16} />
      </Motion.span>
      <span className="b2-card__capsule-text">Slide to Explore</span>
    </div>
  );
}

export default function Blog() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const consideredRef = useRef(null);
  const cardsRef = useRef(null);
  const catalogueRef = useRef(null);

  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStory, setSelectedStory] = useState(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isSlidePageOpen, setIsSlidePageOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [storiesError, setStoriesError] = useState("");

  useEffect(() => {
    let cancelled = false;
    contentApi.posts({ limit: 100 })
      .then((response) => {
        if (cancelled) return;
        setStories((response.data?.items || []).map((post, index) => ({
          ...post,
          id: post._id,
          image: apiFileUrl(post.coverImage) || SLIDE_CARDS[index % SLIDE_CARDS.length]?.image || "",
          date: post.publishedAt
            ? new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
            : "",
        })));
      })
      .catch((error) => {
        if (!cancelled) setStoriesError(error.message || "Stories could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setStoriesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(
    () => ["All", ...new Set([...CATEGORIES.slice(1), ...BLOG_POSTS.map((post) => post.category), ...stories.map((post) => post.category)])],
    [stories],
  );

  /* Combine slide cards & post cards for full carousel */
  const allCarouselStories = useMemo(() => {
    return stories.filter((post) => {
      const matchesCat = activeCategory === "All" || post.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQ =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.category.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });
  }, [activeCategory, searchQuery, stories]);

  const scrollToConsidered = () => {
    consideredRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleJoinContact = () => {
    navigate("/#enquiry");
  };

  const openSlidePage = (story, index = 0) => {
    setSelectedStory(story);
    setActiveSlideIndex(index);
    setIsSlidePageOpen(true);
  };

  const nextSlide = () => {
    if (!stories.length) return;
    const nextIndex = (activeSlideIndex + 1) % stories.length;
    setActiveSlideIndex(nextIndex);
    setSelectedStory(stories[nextIndex]);
  };

  const prevSlide = () => {
    if (!stories.length) return;
    const nextIdx = (activeSlideIndex - 1 + stories.length) % stories.length;
    setActiveSlideIndex(nextIdx);
    setSelectedStory(stories[nextIdx]);
  };

  const nextCarousel = () => {
    if (allCarouselStories.length === 0) return;
    setCarouselIndex((prev) => (prev + 1) % allCarouselStories.length);
  };

  const prevCarousel = () => {
    if (allCarouselStories.length === 0) return;
    setCarouselIndex((prev) => (prev - 1 + allCarouselStories.length) % allCarouselStories.length);
  };

  return (
    <main className="b2-page">

      {/* ========================================================
          1. HERO SECTION — High Visibility, Clean Spacing & Motion Reveal
      ======================================================== */}
      <section className="b2-hero" ref={heroRef} aria-label="Journal Hero">
        <div className="b2-hero__bg" aria-hidden="true" />
        <div className="b2-hero__overlay" aria-hidden="true" />

        <div className="b2-hero__inner">
          <div className="b2-hero__left">
            <Motion.h1
              className="b2-hero__main-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            >
              Stories from the<br />
              <em>art of living well.</em>
            </Motion.h1>
            <Motion.p
              className="b2-hero__title-line"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            >
              Discover stories, ideas and inspiration from the world of Saptagiri
            </Motion.p>
          </div>

          <div className="b2-hero__right">
            <Motion.button
              type="button"
              className="b2-hero__btn"
              onClick={scrollToConsidered}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.7 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              Explore our Stories
            </Motion.button>
          </div>
        </div>
      </section>

      {/* ========================================================
          2. COLLECTION OF CONSIDERED MOMENTS — Matches Figma
      ======================================================== */}
      <section className="b2-considered" ref={consideredRef}>
        <div className="b2-considered__inner">

          {/* Left: Large Resort Pool Image */}
          <Motion.div
            className="b2-considered__img-wrap"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          >
            <Motion.img
              src="https://images.unsplash.com/photo-1540541338287-41700207dee6?q=85&w=1600&auto=format&fit=crop"
              alt="Collection of Considered Moments resort pool"
              className="b2-considered__img"
              initial={{ scale: 1.08 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="b2-considered__img-shade" />
          </Motion.div>

          {/* Right: Stacked Title & Read More Button */}
          <div className="b2-considered__copy">
            <Motion.h2
              className="b2-considered__heading"
              initial={{ opacity: 0, y: 35 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="b2-considered__dark-text">Collection</span>
              <br />
              <span className="b2-considered__dark-text">of</span>
              <br />
              <span className="b2-considered__gold-text">Considered</span>
              <br />
              <span className="b2-considered__gold-text">Moments</span>
            </Motion.h2>

            <Motion.button
              type="button"
              className="b2-considered__btn"
              onClick={() => {
                catalogueRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25, duration: 0.6 }}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              Read More <ChevronRight size={15} style={{ marginLeft: 2 }} />
            </Motion.button>
          </div>

        </div>
      </section>

      {/* ========================================================
          3. 3 VERTICAL CARDS — "Slide to Explore" Draggable Slider
      ======================================================== */}
      <section className="b2-slide-section" ref={cardsRef}>
        <div className="b2-slide-section__inner">
          <div className="b2-cards-grid">
            {stories.slice(0, 3).map((card, i) => (
              <Motion.article
                key={card.id}
                className="b2-card"
                initial={{ opacity: 0, y: 45 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: i * 0.12, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                onClick={() => openSlidePage(card, i)}
              >
                {/* Background Image */}
                <div className="b2-card__media">
                  <img src={card.image} alt={card.title} loading="lazy" onError={handleImageError} />
                  <div className="b2-card__overlay" />
                </div>

                {/* Top Title */}
                <div className="b2-card__header">
                  <h3 className="b2-card__title">{card.title}</h3>
                </div>

                {/* Bottom Capsule Button with Draggable Arrow */}
                <div className="b2-card__action">
                  <SlideCapsuleButton onExplore={() => openSlidePage(card, i)} />
                </div>
              </Motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          4. JOIN THE ORIANAA CLUB — Two-column Card (Figma Matched)
      ======================================================== */}
      <section className="b2-join">
        <Motion.div
          className="b2-join__card"
          initial={{ opacity: 0, y: 45 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Left: Resort Bedroom photo */}
          <div className="b2-join__img-wrap">
            <Motion.img
              src="https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=85&w=1600&auto=format&fit=crop"
              alt="Orianaa Club luxury room"
              className="b2-join__img"
              initial={{ scale: 1.08 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="b2-join__img-overlay" />
          </div>

          {/* Right: Text Copy & Button */}
          <div className="b2-join__copy">
            <Motion.h2
              className="b2-join__heading"
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            >
              Join The<br />Orianaa Club
            </Motion.h2>
            <Motion.p
              className="b2-join__desc"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.32, duration: 0.6 }}
            >
              Join our circle for private invitations and stories from the Orianaa world.
            </Motion.p>
            <Motion.button
              type="button"
              className="b2-join__btn"
              onClick={handleJoinContact}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.45, duration: 0.55 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              Contact Us
            </Motion.button>
          </div>
        </Motion.div>
      </section>

      {/* ========================================================
          5. ALL BLOGS CAROUSEL — With Left & Right Arrows
      ======================================================== */}
      <section className="b2-catalogue" ref={catalogueRef} id="journal-catalogue">
        <div className="b2-catalogue__inner">
          <div className="b2-carousel-top">
            <div className="b2-carousel-title-wrap">
              <span className="b2-eyebrow"><Sparkles size={12} /> THE ORIANAA JOURNAL</span>
              <p className="b2-carousel-sub">Discover all stories across our resort collection</p>
            </div>

            {/* Carousel Navigation Arrows */}
            <div className="b2-carousel-arrows">
              <button
                type="button"
                className="b2-arrow-btn"
                onClick={prevCarousel}
                aria-label="Previous blog stories"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className="b2-arrow-btn b2-arrow-btn--primary"
                onClick={nextCarousel}
                aria-label="Next blog stories"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Search & Categories Filter */}
          <div className="b2-carousel-controls">
            <div className="b2-search-bar">
              <Search size={18} className="b2-search-icon" />
              <input
                type="text"
                placeholder="Search all blogs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="b2-search-clear" onClick={() => setSearchQuery("")}>
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="b2-categories">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`b2-cat-pill ${activeCategory === cat ? "b2-cat-pill--active" : ""}`}
                  onClick={() => {
                    setActiveCategory(cat);
                    setCarouselIndex(0);
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Carousel Track */}
          {storiesLoading ? (
            <div className="b2-no-results" role="status">Loading stories…</div>
          ) : storiesError ? (
            <div className="b2-no-results" role="alert">{storiesError}</div>
          ) : allCarouselStories.length > 0 ? (
            <div className="b2-carousel-viewport">
              <Motion.div
                className="b2-carousel-track"
                animate={{ x: -carouselIndex * 360 }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
              >
                {allCarouselStories.map((post, idx) => (
                  <Motion.article
                    key={post.id}
                    className="b2-carousel-card"
                    whileHover={{ y: -8, transition: { duration: 0.3 } }}
                  >
                    <div className="b2-carousel-card__media">
                      <img src={post.image} alt={post.title} loading="lazy" onError={handleImageError} />
                      <span className="b2-carousel-card__cat">{post.category}</span>
                    </div>

                    <div className="b2-carousel-card__body">
                      <span className="b2-carousel-card__date">{post.date}</span>
                      <h3 className="b2-carousel-card__title">{post.title}</h3>
                      <p className="b2-carousel-card__excerpt">{post.excerpt}</p>
                      
                      <div className="b2-carousel-card__action">
                        <SlideCapsuleButton onExplore={() => openSlidePage(post, idx)} />
                      </div>
                    </div>
                  </Motion.article>
                ))}
              </Motion.div>
            </div>
          ) : (
            <div className="b2-no-results">
              <h3>{stories.length ? "No stories match your search" : "No stories have been published yet"}</h3>
              <button
                type="button"
                className="b2-reset-btn"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("All");
                }}
              >
                View all stories
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================
          6. FULL-SCREEN SLIDING STORY PAGE VIEWER
      ======================================================== */}
      <AnimatePresence>
        {isSlidePageOpen && selectedStory && (
          <Motion.div
            className="b2-page-slider-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSlidePageOpen(false)}
          >
            <div className="b2-page-slider-container" onClick={(e) => e.stopPropagation()}>
              {/* Top Bar */}
              <div className="b2-page-slider-bar">
                <button
                  type="button"
                  className="b2-page-slider-back"
                  onClick={() => setIsSlidePageOpen(false)}
                >
                  ← Back to Journal
                </button>
                <span className="b2-page-slider-counter">
                  Orianaa Story Reader
                </span>
                <button
                  type="button"
                  className="b2-page-slider-close"
                  onClick={() => setIsSlidePageOpen(false)}
                  aria-label="Close page viewer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Animated Slide Content */}
              <div className="b2-page-slide-wrapper">
                <AnimatePresence mode="wait">
                  <Motion.div
                    key={selectedStory.id}
                    className="b2-page-slide"
                    initial={{ x: 120, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -120, opacity: 0 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="b2-page-slide__media">
                      <img
                        src={selectedStory.image}
                        alt={selectedStory.title}
                        onError={handleImageError}
                      />
                      <span className="b2-page-slide__cat">
                        {selectedStory.category}
                      </span>
                    </div>

                    <div className="b2-page-slide__copy">
                      <span className="b2-page-slide__meta">
                        {selectedStory.date} {selectedStory.readTime ? `• ${selectedStory.readTime}` : ""}
                      </span>
                      <h2 className="b2-page-slide__title">
                        {selectedStory.title}
                      </h2>
                      <p className="b2-page-slide__lead">
                        {selectedStory.excerpt}
                      </p>
                      <div className="b2-page-slide__rule" />
                      <p className="b2-page-slide__text">
                        {selectedStory.content}
                      </p>

                      {/* Navigation Controls */}
                      <div className="b2-page-slide__nav">
                        <button type="button" onClick={prevSlide} className="b2-slide-btn">
                          <ChevronLeft size={16} /> Previous Story
                        </button>
                        <button type="button" onClick={nextSlide} className="b2-slide-btn b2-slide-btn--primary">
                          Next Story <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </Motion.div>
                </AnimatePresence>
              </div>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}