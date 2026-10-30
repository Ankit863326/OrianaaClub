import React, { useEffect, useRef, useState } from "react";
import { motion as Motion, useInView } from "framer-motion";
import "./Experiences.css";

/* ─── Full Data from Figma ──────────────────────────────── */
const experiences = [
  {
    id: "dining",
    category: "Food & Dining",
    heading: "A Taste of Exceptional Living",
    description:
      "Discover thoughtfully curated dining experiences designed to bring together refined flavours, elegant settings, and memorable moments at every table.",
    tags: [
      "Fine Dining Restaurant",
      "Pure Vegetarian Restaurant",
      "Jain Food Available",
      "Outdoor Garden Dining",
      "Rooftop Restaurant",
      "Coffee Lounge & Café",
      "Bakery & Patisserie",
      "Live Barbecue",
      "Poolside Dining",
      "Sunday Brunch",
      "Private Candlelight Dinner",
      "Chef's Special Tasting Menu",
    ],
    items: [
      {
        name: "Fine Dining Restaurant",
        type: "Gourmet",
        highlight: "Multi-cuisine gourmet dining with master sommelier service",
        setting: "Indoor Elegance · Dinner & Lunch",
      },
      {
        name: "Pure Vegetarian Restaurant",
        type: "Satvik",
        highlight: "Authentic Satvik & traditional regional preparations",
        setting: "Dedicated Kitchen · Daily",
      },
      {
        name: "Jain Food Available",
        type: "Jain Special",
        highlight: "Strict root-free preparations guided by heritage recipes",
        setting: "Custom Menus on Request",
      },
      {
        name: "Outdoor Garden Dining",
        type: "Alfresco",
        highlight: "Alfresco dining canopy surrounded by manicured flora",
        setting: "Lush Greenery · Twilight",
      },
      {
        name: "Rooftop Restaurant",
        type: "Panoramic",
        highlight: "Elevated horizon views paired with artisanal cocktails",
        setting: "Panoramic Sky Deck · Sunset",
      },
      {
        name: "Coffee Lounge & Café",
        type: "Artisanal",
        highlight: "Single-origin pour-overs, artisanal teas & light bites",
        setting: "All-Day Casual Lounge",
      },
      {
        name: "Bakery & Patisserie",
        type: "Fresh Bakes",
        highlight: "Fresh sourdough, French pastries & bespoke celebration cakes",
        setting: "Handcrafted Daily · In-house",
      },
      {
        name: "Live Barbecue",
        type: "Open Grill",
        highlight: "Smoky charcoal skewers & chef-interactive open grill",
        setting: "Weekend Sundowners · Alfresco",
      },
      {
        name: "Poolside Dining",
        type: "Cabana Fare",
        highlight: "Chilled mocktails, wood-fired bites & cabana service",
        setting: "Deckside Loungers · All Day",
      },
      {
        name: "Sunday Brunch",
        type: "Grand Buffet",
        highlight: "Lavish multi-course buffet with live carving stations",
        setting: "Family Festive · Sundays",
      },
      {
        name: "Private Candlelight Dinner",
        type: "Romantic",
        highlight: "Secluded canopy setup with personal butler & floral decor",
        setting: "By Prior Reservation",
      },
      {
        name: "Chef's Special Tasting Menu",
        type: "Degustation",
        highlight: "7-course seasonal degustation journey curated by Executive Chef",
        setting: "Exclusive Seating · Sommelier Paired",
      },
    ],
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=85",
  },
  {
    id: "wellness",
    category: "Wellness & Recreation",
    heading: "Restore. Rebalance. Renew.",
    description:
      "Step away from the everyday and embrace moments of calm through wellness experiences created for relaxation, rejuvenation, and mindful living.",
    tags: [
      "Luxury Spa",
      "Ayurvedic Treatments",
      "Massage Therapy",
      "Steam & Sauna",
      "Jacuzzi",
      "Yoga Deck",
      "Meditation Garden",
      "Fitness Center",
      "Health Club",
    ],
    items: [
      {
        name: "Luxury Spa",
        type: "Rejuvenation",
        highlight: "Holistic skin, facial and sensory rejuvenation rituals",
        setting: "Private Treatment Suites · By Appointment",
      },
      {
        name: "Ayurvedic Treatments",
        type: "Panchakarma",
        highlight: "Classical Panchakarma & herbal therapies by certified vaidyas",
        setting: "Authentic Healing Sanctuary",
      },
      {
        name: "Massage Therapy",
        type: "Therapeutic",
        highlight: "Deep tissue, Balinese & Swedish targeted muscle relief",
        setting: "Customized Therapeutic Sessions",
      },
      {
        name: "Steam & Sauna",
        type: "Cedarwood",
        highlight: "Detoxifying dry cedarwood sauna & aromatic herbal steam",
        setting: "Separate Men & Women Suites",
      },
      {
        name: "Jacuzzi",
        type: "Hydrotherapy",
        highlight: "Temperature-controlled hydrotherapy whirlpool tubs",
        setting: "Relaxation Lounge Access",
      },
      {
        name: "Yoga Deck",
        type: "Sunrise Flow",
        highlight: "Sunrise guided Hatha & Vinyasa flows overlooking nature",
        setting: "Open-Air Forest Pavilion · Daily",
      },
      {
        name: "Meditation Garden",
        type: "Mindfulness",
        highlight: "Tranquil stone trails with babbling fountains for mindful reflection",
        setting: "Designated Silent Zone",
      },
      {
        name: "Fitness Center",
        type: "TechnoGym",
        highlight: "Advanced cardio, free weights & strength resistance equipment",
        setting: "Personal Trainers Available",
      },
      {
        name: "Health Club",
        type: "Vitality",
        highlight: "Vitality consultations, body analysis & lifestyle coaching",
        setting: "Member Wellness Desk",
      },
    ],
    image:
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1400&q=85",
  },
  {
    id: "sports",
    category: "Sports & Activities",
    heading: "Move. Play. Explore.",
    description:
      "From active pursuits to outdoor adventures, enjoy an exciting collection of recreational experiences for every age and interest.",
    tags: [
      "Swimming Pool",
      "Kids Pool",
      "Indoor Games",
      "Outdoor Sports",
      "Cricket Ground",
      "Football Turf",
      "Volleyball Court",
      "Badminton Court",
      "Basketball Court",
      "Tennis Court",
      "Pickleball Court",
      "Cycling",
      "Nature Trails",
      "Adventure Zone",
      "Rock Climbing",
      "Zip Line",
      "Archery",
      "ATV Rides",
      "Horse Riding",
      "Rain Dance",
      "Bonfire Area",
    ],
    items: [
      {
        name: "Swimming Pool",
        type: "Olympic Size",
        highlight: "Olympic-standard temperature regulated swimming pool",
        setting: "Dedicated Lap Lanes · Member Access",
      },
      {
        name: "Kids Pool",
        type: "Splash Pool",
        highlight: "Shallow, temperature-safe splash pool with water jets",
        setting: "Certified Lifeguard on Duty",
      },
      {
        name: "Indoor Games",
        type: "Billiards & TT",
        highlight: "Billiards, table tennis, snooker, foosball & classic boards",
        setting: "Air-Conditioned Game Lounge",
      },
      {
        name: "Outdoor Sports",
        type: "Athletics",
        highlight: "Comprehensive multi-sport grounds with pro coaching staff",
        setting: "Equipment & Gear Provided",
      },
      {
        name: "Cricket Ground",
        type: "Turf Pitch",
        highlight: "Full-boundary turf wicket with pavilion & floodlit setup",
        setting: "Day & Night Tournament Ready",
      },
      {
        name: "Football Turf",
        type: "FIFA Grade",
        highlight: "FIFA-standard artificial grass arena for 7-a-side matches",
        setting: "Shock-Absorbent Turf Surface",
      },
      {
        name: "Volleyball Court",
        type: "Sand Beach",
        highlight: "Fine beach sand court with regulation net and perimeter",
        setting: "Outdoor Sand Arena",
      },
      {
        name: "Badminton Court",
        type: "Indoor Wood",
        highlight: "Four competition wooden-cushioned indoor synthetic courts",
        setting: "Indoor Climate Controlled",
      },
      {
        name: "Basketball Court",
        type: "Full Court",
        highlight: "Full-size multi-layer acrylic court with professional hoops",
        setting: "Evening Floodlit Play",
      },
      {
        name: "Tennis Court",
        type: "Hard Court",
        highlight: "Championship standard hard court with tournament markings",
        setting: "Private Coaching Available",
      },
      {
        name: "Pickleball Court",
        type: "Dual Courts",
        highlight: "Fast-growing paddle sport courts for social & competitive play",
        setting: "Social Mixers & Tournaments",
      },
      {
        name: "Cycling",
        type: "Paved Trails",
        highlight: "Paved club perimeter tracks with premium mountain & hybrid bikes",
        setting: "Scenic Trail Map & Helmets",
      },
      {
        name: "Nature Trails",
        type: "Eco Walks",
        highlight: "Guided flora, bird-watching and biodiversity morning trails",
        setting: "Resort Eco Sanctuary Walk",
      },
      {
        name: "Adventure Zone",
        type: "Rope Courses",
        highlight: "Challenging rope bridges, balance beams & cargo net traverses",
        setting: "Supervised Safety Harnesses",
      },
      {
        name: "Rock Climbing",
        type: "40ft Wall",
        highlight: "40-ft artificial natural-grip climbing wall with belaying ropes",
        setting: "Multiple Route Grades",
      },
      {
        name: "Zip Line",
        type: "Canopy Aerial",
        highlight: "Canopy-high gravity zip wire cruising over resort greenery",
        setting: "Dual Steel Cable Safety",
      },
      {
        name: "Archery",
        type: "Target Range",
        highlight: "Precision recurve & compound target shooting range",
        setting: "Instructor Led Practice",
      },
      {
        name: "ATV Rides",
        type: "Dirt Circuit",
        highlight: "250cc all-terrain quad bikes on engineered off-road dirt trails",
        setting: "Dedicated Off-Road Circuit",
      },
      {
        name: "Horse Riding",
        type: "Equestrian",
        highlight: "Gentle equestrian horses with guided paddock walk & lessons",
        setting: "Equestrian Arena & Stable",
      },
      {
        name: "Rain Dance",
        type: "Mist Arena",
        highlight: "High-pressure overhead mist shower arena with sound beats",
        setting: "Non-slip Party Floor",
      },
      {
        name: "Bonfire Area",
        type: "Starlit Pit",
        highlight: "Sunken stone amphitheatre pit for stargazing & campfire talks",
        setting: "Evening Acoustic Gatherings",
      },
    ],
    image:
      "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1400&q=85",
  },
  {
    id: "family",
    category: "Family Entertainment",
    heading: "Moments Made for Togetherness",
    description:
      "Create unforgettable family memories with entertainment, activities, and shared experiences designed to bring everyone closer.",
    tags: [
      "Children's Play Area",
      "Kids Club",
      "Gaming Zone",
      "Movie Nights",
      "Live Music",
      "Cultural Programs",
      "DJ Nights",
      "Open Air Theatre",
      "Weekend Entertainment",
    ],
    items: [
      {
        name: "Children's Play Area",
        type: "Child-Safe",
        highlight: "Ergonomic safe play structures, tunnels, swings and slides",
        setting: "Impact-Absorbing Rubber Floor",
      },
      {
        name: "Kids Club",
        type: "Arts & Crafts",
        highlight: "Supervised pottery, creative painting, origami & storytelling",
        setting: "Dedicated Youth Coordinators",
      },
      {
        name: "Gaming Zone",
        type: "PS5 & VR",
        highlight: "PlayStation 5, Xbox Series X, VR simulation & classic arcades",
        setting: "High-Tech Gaming Arena",
      },
      {
        name: "Movie Nights",
        type: "Starlit Cinema",
        highlight: "Open-air screenings of family classics with gourmet popcorn",
        setting: "Under the Stars · Weekends",
      },
      {
        name: "Live Music",
        type: "Unplugged",
        highlight: "Acoustic indie sessions, jazz trios & unplugged performances",
        setting: "Lawn Amphitheatre Evenings",
      },
      {
        name: "Cultural Programs",
        type: "Heritage Acts",
        highlight: "Heritage folk dances, classical music recitals & art showcases",
        setting: "Festive & Seasonal Specials",
      },
      {
        name: "DJ Nights",
        type: "Club Lounge",
        highlight: "Resident DJs spinning high-energy lounge & dance grooves",
        setting: "Saturday Night Club Lounge",
      },
      {
        name: "Open Air Theatre",
        type: "Amphitheatre",
        highlight: "Stepped amphitheatre hosting plays, drama & musical revues",
        setting: "Full Acoustic Stage Sound",
      },
      {
        name: "Weekend Entertainment",
        type: "Carnivals",
        highlight: "Illusionists, stand-up comedy, street carnivals & puppet acts",
        setting: "Curated Sunday Family Specials",
      },
    ],
    image:
      "https://images.unsplash.com/photo-1504150558240-0b4fd8946624?auto=format&fit=crop&w=1400&q=85",
  },
  {
    id: "weddings",
    category: "Weddings & Celebrations",
    heading: "Celebrate Life's Finest Moments",
    description:
      "From intimate celebrations to grand destination weddings, create beautifully considered occasions surrounded by elegance and memorable hospitality.",
    tags: [
      "Grand Banquet Hall",
      "Premium Wedding Lawn",
      "Destination Wedding Packages",
      "Reception Packages",
      "Engagement Ceremony",
      "Haldi Ceremony Setup",
      "Mehendi Setup",
      "Sangeet Stage",
      "Bridal Suite",
      "Groom Lounge",
      "Wedding Planning Assistance",
      "Décor Services",
      "Catering Services",
      "Photography & Videography",
      "Artist & Celebrity Performances",
    ],
    items: [
      {
        name: "Grand Banquet Hall",
        type: "1500 Guests",
        highlight: "Pillarless royal ballroom featuring crystal chandeliers & grand foyer",
        setting: "Capacity up to 1,500 Guests",
      },
      {
        name: "Premium Wedding Lawn",
        type: "2500 Guests",
        highlight: "Expansive manicured lawn with natural sunset & mountain backdrops",
        setting: "Capacity up to 2,500 Guests",
      },
      {
        name: "Destination Wedding Packages",
        type: "Turnkey",
        highlight: "Turnkey multi-day royal celebrations with full guest hospitality",
        setting: "End-to-End Concierge Curation",
      },
      {
        name: "Reception Packages",
        type: "Royal Gala",
        highlight: "Bespoke stage production, thematic lighting & gala silver banquet",
        setting: "Tailored Luxury Themes",
      },
      {
        name: "Engagement Ceremony",
        type: "Intimate",
        highlight: "Romantic indoor & open-sky setups for ring exchange & dinner",
        setting: "Intimate Courtyard / Ballroom",
      },
      {
        name: "Haldi Ceremony Setup",
        type: "Floral Theme",
        highlight: "Vibrant yellow floral decor, traditional urlis & poolside vibes",
        setting: "Sunny Garden / Poolside Deck",
      },
      {
        name: "Mehendi Setup",
        type: "Boho Cabana",
        highlight: "Boho chic cabanas, marigold drapes, swings & festive music",
        setting: "Outdoor Gazebo Lawns",
      },
      {
        name: "Sangeet Stage",
        type: "Line-Array LED",
        highlight: "Concert-grade intelligent lighting, line-array audio & LED wall",
        setting: "High-Energy Dance Stage",
      },
      {
        name: "Bridal Suite",
        type: "Luxury Vanity",
        highlight: "Opulent dressing chambers with vanity mirrors, lounge & salon access",
        setting: "Private Dedicated Wing",
      },
      {
        name: "Groom Lounge",
        type: "Executive Bar",
        highlight: "Sophisticated executive lounge with refreshments & grooming assistance",
        setting: "Quiet Pre-Event Sanctuary",
      },
      {
        name: "Wedding Planning Assistance",
        type: "Concierge",
        highlight: "Dedicated event directorship overseeing timelines, guests & protocol",
        setting: "Personalized Concierge Team",
      },
      {
        name: "Décor Services",
        type: "Architectural",
        highlight: "Master floral artisans & contemporary architectural set design",
        setting: "Custom Floral & Light Concepts",
      },
      {
        name: "Catering Services",
        type: "Master Chefs",
        highlight: "Global cuisine counters, regional thalis & interactive live galleys",
        setting: "Master Chef Curated Menus",
      },
      {
        name: "Photography & Videography",
        type: "Drone Shoots",
        highlight: "Scenic heritage spots, cinematic drone permits & sunset photo decks",
        setting: "Pre-Wedding & Event Shoots",
      },
      {
        name: "Artist & Celebrity Performances",
        type: "Concert Stage",
        highlight: "Green rooms, rider management & concert production coordination",
        setting: "Live Entertainment Ready",
      },
    ],
    image:
      "https://cdn0.weddingwire.in/article/1478/3_2/960/jpg/78741-intimate-weddings-creative-wedding-photography-lead-image.jpeg",
  },
  {
    id: "corporate",
    category: "Corporate Facilities",
    heading: "Business, Beautifully Hosted",
    description:
      "Bring teams together in an inspiring resort environment with thoughtfully designed spaces for meetings, retreats, conferences, and celebrations.",
    tags: [
      "Conference Hall",
      "Board Room",
      "Meeting Rooms",
      "Corporate Retreat Packages",
      "Team Building Activities",
      "Product Launch Events",
      "Annual Conferences",
      "Training Programs",
      "High-Speed Internet",
      "Audio Visual Equipment",
    ],
    items: [
      {
        name: "Conference Hall",
        type: "500 Delegates",
        highlight: "Tiered executive seating, precision acoustics & motorized 4K projection",
        setting: "Accommodates up to 500 Delegates",
      },
      {
        name: "Board Room",
        type: "24-Seater",
        highlight: "Ergonomic leather chairs, telepresence conference hub & private pantry",
        setting: "24-Seater Executive Suite",
      },
      {
        name: "Meeting Rooms",
        type: "Breakout Hubs",
        highlight: "Flexible modular breakout spaces with wireless screen mirroring",
        setting: "Multiple Configurations",
      },
      {
        name: "Corporate Retreat Packages",
        type: "All-Inclusive",
        highlight: "Curated blending of strategic offsites, team dining & spa unwind",
        setting: "Residential All-Inclusive Offsites",
      },
      {
        name: "Team Building Activities",
        type: "Facilitated",
        highlight: "Outbound obstacle courses, cricket tournaments & leadership games",
        setting: "Led by Certified Facilitators",
      },
      {
        name: "Product Launch Events",
        type: "Reveal Staging",
        highlight: "Dramatic reveal ramps, immersive high-lumen video walls & media lounge",
        setting: "Brand Experience Staging",
      },
      {
        name: "Annual Conferences",
        type: "Full Production",
        highlight: "Comprehensive hospitality, delegate registration & breakout sessions",
        setting: "Full-Day Conference Facility",
      },
      {
        name: "Training Programs",
        type: "Smart Screens",
        highlight: "Classroom and cluster layouts with smart digital whiteboards",
        setting: "Quiet Learning Environment",
      },
      {
        name: "High-Speed Internet",
        type: "1 Gbps Leased",
        highlight: "Dedicated 1 Gbps symmetric fiber leased line with guest VLAN",
        setting: "Uninterrupted Redundant Wi-Fi",
      },
      {
        name: "Audio Visual Equipment",
        type: "4K Laser Tech",
        highlight: "Shure digital wireless mics, 4K laser projectors & hybrid video kit",
        setting: "Dedicated Tech Sound Engineer",
      },
    ],
    image:
      "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=85",
  },
];

/* ─── Animation Variants ─────────────────────────────────── */
const fadeLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.82, ease: [0.22, 1, 0.36, 1] } },
};

const fadeRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.82, ease: [0.22, 1, 0.36, 1] } },
};

const staggerTags = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.35 } },
};

const tagVariant = {
  hidden: { opacity: 0, scale: 0.8, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.4, ease: "backOut" } },
};

/* ─── Experience Row ─────────────────────────────────────── */
function ExperienceRow({ exp, index }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const isAlt = index % 2 === 1; // alternate bg only, layout stays image-left

  const items =
    exp.items ||
    (exp.tags || []).map((tag) => ({
      name: tag,
      type: "Curated",
      highlight: tag,
      setting: "Member Access",
    }));

  const midpoint = Math.ceil(items.length / 2);
  const table1Items = items.slice(0, midpoint);
  const table2Items = items.slice(midpoint);

  return (
    <div ref={ref} className={`exp-row ${isAlt ? "exp-row--alt" : ""}`}>
      {/* ── Image ── */}
      <Motion.div
        className="exp-row__image-wrap"
        variants={fadeLeft}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
      >
        <Motion.img
          src={exp.image}
          alt={exp.category}
          className="exp-row__image"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="exp-row__img-overlay" />
      </Motion.div>

      {/* ── Content ── */}
      <Motion.div
        className="exp-row__content"
        variants={fadeRight}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
      >
        {/* Category eyebrow */}
        <Motion.p
          className="exp-row__category"
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.18 }}
        >
          {exp.category}
        </Motion.p>

        {/* Main heading */}
        <Motion.h2
          className="exp-row__heading"
          initial={{ opacity: 0, y: 22 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, delay: 0.26 }}
        >
          {exp.heading}
        </Motion.h2>

        {/* Gold rule */}
        <Motion.div
          className="exp-row__line"
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 0.65, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Description */}
        <Motion.p
          className="exp-row__desc"
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.38 }}
        >
          {exp.description}
        </Motion.p>

        {/* ── Compact Dual-Table Directory (Fixed Area) ── */}
        <Motion.div
          className="exp-dual-card"
          initial={{ opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="exp-dual-card__header">
            <span className="exp-dual-card__kicker">Curated Directory</span>
            <span className="exp-dual-card__badge">
              <span className="exp-dual-card__badge-dot" />
              {items.length} Offerings
            </span>
          </div>

          <div className="exp-dual-card__body">
            <div className="exp-dual-card__tables">
              {/* Left Table */}
              <div className="exp-mini-table-wrap">
                <table className="exp-mini-table">
                  <thead>
                    <tr>
                      <th className="exp-mini-table__th--idx">#</th>
                      <th className="exp-mini-table__th--name">Offering</th>
                      <th className="exp-mini-table__th--type">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table1Items.map((item, idx) => (
                      <tr key={item.name} className="exp-mini-table__row">
                        <td className="exp-mini-table__td--idx">
                          {String(idx + 1).padStart(2, "0")}
                        </td>
                        <td className="exp-mini-table__td--name" title={item.highlight}>
                          {item.name}
                        </td>
                        <td className="exp-mini-table__td--type">
                          <span className="exp-mini-table__badge">{item.type}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right Table */}
              <div className="exp-mini-table-wrap">
                <table className="exp-mini-table">
                  <thead>
                    <tr>
                      <th className="exp-mini-table__th--idx">#</th>
                      <th className="exp-mini-table__th--name">Offering</th>
                      <th className="exp-mini-table__th--type">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table2Items.map((item, idx) => (
                      <tr key={item.name} className="exp-mini-table__row">
                        <td className="exp-mini-table__td--idx">
                          {String(midpoint + idx + 1).padStart(2, "0")}
                        </td>
                        <td className="exp-mini-table__td--name" title={item.highlight}>
                          {item.name}
                        </td>
                        <td className="exp-mini-table__td--type">
                          <span className="exp-mini-table__badge">{item.type}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Motion.div>

        {/* Join button */}
        <Motion.a
          href="/luxury-membership"
          className="exp-row__btn"
          aria-label="Join Membership"
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.65 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
        >
          Join Membership <span>→</span>
        </Motion.a>
      </Motion.div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
const Experiences = () => {
  const heroRef = useRef(null);

  useEffect(() => {
    let isActive = true;
    let ctx;
    const initGsap = async () => {
      try {
        const { default: gsap } = await import("gsap");
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        if (!isActive) return;
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ ignoreMobileResize: true });

        ctx = gsap.context(() => {
          /* Parallax hero bg */
          gsap.to(".exp-hero__bg", {
            yPercent: 18,
            ease: "none",
            scrollTrigger: {
              trigger: heroRef.current || ".exp-hero",
              start: "top top",
              end: "bottom top",
              scrub: true,
              invalidateOnRefresh: true,
            },
          });

          /* Floating gold particles */
          gsap.utils.toArray(".exp-particle").forEach((el, i) => {
            gsap.to(el, {
              y: -(30 + i * 14),
              x: i % 2 === 0 ? 18 : -18,
              opacity: 0,
              duration: 2.2 + i * 0.35,
              repeat: -1,
              ease: "power1.inOut",
              delay: i * 0.45,
            });
          });
        }, heroRef);
      } catch (e) {
        console.warn("GSAP init failed:", e);
      }
    };
    initGsap();
    return () => {
      isActive = false;
      ctx?.revert();
    };
  }, []);

  return (
    <main className="exp-page">

      {/* ══ HERO ══════════════════════════════════════════════ */}
      <section className="exp-hero" ref={heroRef}>
        <div className="exp-hero__bg" />
        <div className="exp-hero__overlay" />

        {/* floating particles */}
        {[...Array(7)].map((_, i) => (
          <span
            key={i}
            className="exp-particle"
            style={{ left: `${12 + i * 12}%`, bottom: `${16 + (i % 3) * 13}%` }}
          />
        ))}

        <div className="exp-hero__content">
          <Motion.p
            className="exp-hero__eyebrow"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2 }}
          >
            THE SAPTAGIRI EXPERIENCE
          </Motion.p>

          <Motion.h1
            className="exp-hero__title"
            initial={{ opacity: 0, y: 44 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            Moments that
            <br />
            <em>become memories</em>
          </Motion.h1>

          <Motion.p
            className="exp-hero__sub"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.72 }}
          >
            Discover a world of refined experiences — from exquisite dining and
            restorative wellness to celebrations, adventures, and meaningful
            moments together.
          </Motion.p>

          <Motion.a
            href="/luxury-membership"
            className="exp-hero__cta"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.98 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
          >
            Join Membership
          </Motion.a>
        </div>

        <div className="exp-hero__scroll">
          <span />
          <p>Scroll to explore</p>
        </div>
      </section>

      {/* ══ OUR EXPERIENCES ═══════════════════════════════════ */}
      <section className="exp-section" id="our-experiences">
        <div className="exp-section__header">
          <Motion.p
            className="exp-section__kicker"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            DISCOVER
          </Motion.p>
          <Motion.h2
            className="exp-section__title"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.72, delay: 0.1 }}
          >
            Our Experiences
          </Motion.h2>
        </div>

        <div className="exp-rows">
          {experiences.map((exp, i) => (
            <ExperienceRow key={exp.id} exp={exp} index={i} />
          ))}
        </div>
      </section>

      {/* ══ JOIN THE ORIANAA CLUB ══════════════════════════════ */}
      <section className="exp-join">
        <div className="exp-join__card">
          <Motion.div
            className="exp-join__image-wrap"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.88, ease: [0.22, 1, 0.36, 1] }}
          >
            <img
              src="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=85"
              alt="Orianaa Club bedroom"
              className="exp-join__image"
            />
          </Motion.div>

          <Motion.div
            className="exp-join__content"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.88, ease: [0.22, 1, 0.36, 1] }}
          >
            <Motion.h2
              className="exp-join__heading"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              Join The<br />Orianaa Club
            </Motion.h2>

            <Motion.p
              className="exp-join__desc"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.34 }}
            >
              Join our circle for private invitations and stories from the
              Orianaa world.
            </Motion.p>

            <Motion.a
              href="/#enquiry"
              className="exp-join__btn"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.5 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
            >
              Contact Us
            </Motion.a>
          </Motion.div>
        </div>
      </section>
    </main>
  );
};

export default Experiences;
