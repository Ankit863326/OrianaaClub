# OrianaaClub - Component Development Guide

A detailed guide for developing and maintaining components in the OrianaaClub premium homepage.

The application is in `frontend/`. Run npm commands from that directory; paths such as `src/components/` are relative to it.

---

## 🎯 Component Architecture

### Component Structure
```
Component.jsx
├── Imports (React, Framer Motion, Icons)
├── Animation Variants (reusable motion definitions)
├── Component Data (arrays, objects)
├── Main Component JSX
├── Exports
└── Styles (Tailwind CSS)
```

### Naming Conventions
- **Component Files**: PascalCase (e.g., `HeroSection.jsx`)
- **Variables**: camelCase (e.g., `containerVariants`)
- **CSS Classes**: kebab-case (e.g., `glass-effect`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_ITEMS`)

---

## 🏗️ Building a New Component

### Step 1: Create Component File
```bash
# Create in src/components/
touch src/components/YourComponent.jsx
```

### Step 2: Component Template
```jsx
import React from 'react';
import { motion } from 'framer-motion';
import { YourIcon } from 'lucide-react';

const YourComponent = () => {
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  // Component data
  const items = [
    { id: 1, title: 'Item 1', description: 'Description' },
    { id: 2, title: 'Item 2', description: 'Description' },
  ];

  return (
    <section className="relative w-full py-20 lg:py-32 px-4 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0B1220] to-[#1a2a4a]" />

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        className="max-w-7xl mx-auto"
      >
        <h2 className="text-5xl font-bold text-white mb-12 text-center">
          Section Title
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((item) => (
            <motion.div
              key={item.id}
              variants={itemVariants}
              className="p-6 glass rounded-2xl"
            >
              <h3 className="text-2xl font-bold text-white mb-3">
                {item.title}
              </h3>
              <p className="text-gray-300">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default YourComponent;
```

### Step 3: Import in App.jsx
```jsx
import YourComponent from './components/YourComponent';

// Add to main render
<YourComponent />
```

---

## 🎨 Animation Patterns

### Fade In on Scroll
```jsx
<motion.div
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
  transition={{ duration: 0.6 }}
>
  Content
</motion.div>
```

### Fade & Translate Up
```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.8, ease: 'easeOut' }}
>
  Content
</motion.div>
```

### Staggered Children
```jsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

<motion.div variants={containerVariants} initial="hidden" animate="visible">
  {items.map((item) => (
    <motion.div key={item.id} variants={itemVariants}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

### Hover Effects
```jsx
<motion.div
  whileHover={{ y: -8, boxShadow: '0 25px 50px rgba(212, 160, 23, 0.2)' }}
  whileTap={{ scale: 0.95 }}
  className="cursor-pointer"
>
  Hoverable content
</motion.div>
```

### Infinite Loop
```jsx
<motion.div
  animate={{ y: [0, -15, 0] }}
  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
>
  Floating element
</motion.div>
```

---

## 🎯 Styling Best Practices

### Tailwind Classes Pattern
```jsx
// Structure
<div className={`
  // Layout
  relative w-full px-4 sm:px-6 lg:px-8
  py-20 lg:py-32
  
  // Spacing
  space-y-8
  
  // Typography
  text-center
  
  // Colors
  text-white bg-[#0B1220]
  
  // Responsive
  grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4
`}>
  Content
</div>
```

### Dark Mode Colors
```
Text Colors:
- #F8FAFC (primary text)
- #D0D0D0 (secondary text)
- #909090 (tertiary text)

Accent Colors:
- #D4A017 (gold)
- #FF8A3D (orange)

Background:
- #0B1220 (midnight blue)
- #1a2a4a (dark blue)
```

### Gradient Usage
```jsx
// Gradient Text
className="bg-gradient-to-r from-[#D4A017] to-[#FF8A3D] bg-clip-text text-transparent"

// Gradient Background
className="bg-gradient-to-b from-[#0B1220] to-[#1a2a4a]"

// Gradient Border
className="border border-gradient-to-r from-[#D4A017]/50"
```

---

## 📱 Responsive Design Patterns

### Mobile-First Grid
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
  {/* 1 column on mobile */}
  {/* 2 columns on tablet */}
  {/* 3 columns on desktop */}
</div>
```

### Responsive Typography
```jsx
<h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold">
  Scaled heading
</h2>

<p className="text-base sm:text-lg lg:text-xl leading-relaxed">
  Responsive paragraph
</p>
```

### Responsive Padding
```jsx
<div className="px-4 sm:px-6 lg:px-8 py-12 lg:py-24">
  <!-- Scales padding based on viewport -->
</div>
```

### Hidden Elements
```jsx
{/* Visible only on desktop */}
<div className="hidden lg:block">Desktop only</div>

{/* Visible only on mobile */}
<div className="lg:hidden">Mobile menu</div>
```

---

## 🎯 Common Component Patterns

### Card Component Pattern
```jsx
<div className="p-6 lg:p-8 bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl border border-white/10 rounded-2xl hover:border-[#D4A017]/40 transition-all">
  {/* Card content */}
</div>
```

### Button Pattern
```jsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  className="px-8 py-3 bg-gradient-to-r from-[#D4A017] to-[#FF8A3D] text-[#0B1220] font-bold rounded-lg transition-all"
>
  Button Text
</motion.button>
```

### Section Layout
```jsx
<section className="relative w-full py-20 lg:py-32 px-4 overflow-hidden">
  {/* Background decorations */}
  <div className="absolute inset-0 -z-10">
    {/* Gradients and elements */}
  </div>

  {/* Main content */}
  <div className="max-w-7xl mx-auto">
    {/* Section content */}
  </div>
</section>
```

---

## 🔧 Working with Icons

### Using Lucide Icons
```jsx
import { Heart, Star, ArrowRight, Menu, X } from 'lucide-react';

// In JSX
<Heart size={24} className="text-[#D4A017]" />

// Animated
<motion.div whileHover={{ scale: 1.2 }}>
  <Star size={20} />
</motion.div>
```

### Available Icons (Common)
```
ArrowRight, ArrowLeft, ChevronDown, ChevronUp
Star, Heart, Sparkles, Zap, Shield, Crown
Menu, X, Search, Bell, User, Settings
Check, CheckCircle, AlertCircle, Info
```

---

## 🧪 Component Testing Checklist

### Before Publishing
- [ ] Renders without errors
- [ ] Responsive on mobile, tablet, desktop
- [ ] Animations are smooth
- [ ] Text is readable (contrast OK)
- [ ] No console warnings/errors
- [ ] Clicks/interactions work
- [ ] Accessibility check (keyboard nav)
- [ ] Performance (no lag)
- [ ] Cross-browser compatible

### Testing Tools
```bash
# ESLint for code quality
npm run lint

# Accessibility check
# Use axe DevTools extension

# Performance profiling
# React DevTools Profiler
```

---

## 📊 Component Data Structure

### Example: Features Array
```jsx
const features = [
  {
    id: 1,
    icon: Sparkles,
    title: 'Feature Title',
    description: 'Feature description text',
    color: 'from-[#D4A017] to-[#FF8A3D]',
  },
  // ... more items
];

// Render
{features.map((feature) => {
  const Icon = feature.icon;
  return (
    <div key={feature.id}>
      <Icon className={`bg-gradient-to-br ${feature.color}`} />
      <h3>{feature.title}</h3>
      <p>{feature.description}</p>
    </div>
  );
})}
```

---

## 🔄 Reusable Component Utilities

### Animation Variants Library
```jsx
// Create shared file: motionVariants.js
export const containerVars = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

export const fadeUpVars = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 },
  },
};

// Usage
import { containerVars, fadeUpVars } from '@/utils/motionVariants';

const MyComponent = () => (
  <motion.div variants={containerVars} initial="hidden" animate="visible">
    <motion.div variants={fadeUpVars}>Content</motion.div>
  </motion.div>
);
```

### Tailwind Class Utilities
```jsx
// Create shared classes object
const cardClasses = {
  glass: 'bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl border border-white/10 rounded-2xl',
  premium: 'hover:border-[#D4A017]/40 transition-all duration-300',
  padding: 'p-6 lg:p-8',
};

// Usage
<div className={`${cardClasses.glass} ${cardClasses.premium} ${cardClasses.padding}`}>
  Content
</div>
```

---

## 🐛 Debugging Tips

### Console Logging
```jsx
// Log component mount/unmount
useEffect(() => {
  console.log('Component mounted');
  return () => console.log('Component unmounted');
}, []);

// Log prop changes
useEffect(() => {
  console.log('Props updated:', props);
}, [props]);
```

### React DevTools
- Install React DevTools browser extension
- Profile component performance
- Check component props/state
- Track component lifecycle

### Tailwind IntelliSense
- Install Tailwind CSS IntelliSense extension
- Get class autocomplete
- Hover for documentation
- Lint warnings

---

## 📚 Component Examples

### Simple Feature Card
```jsx
<motion.div
  whileHover={{ y: -8 }}
  className="p-8 glass rounded-2xl group"
>
  <Icon className="w-14 h-14 text-[#D4A017]" />
  <h3 className="text-xl font-bold text-white mt-4">{title}</h3>
  <p className="text-gray-400 mt-2">{description}</p>
</motion.div>
```

### Interactive Button
```jsx
<motion.button
  whileHover={{
    scale: 1.05,
    boxShadow: '0 25px 50px rgba(212, 160, 23, 0.3)',
  }}
  whileTap={{ scale: 0.95 }}
  className="px-8 py-3 bg-gradient-to-r from-[#D4A017] to-[#FF8A3D] text-[#0B1220] font-bold rounded-lg"
>
  Click Me
</motion.button>
```

### Animated Counter
```jsx
const Counter = ({ end, duration = 2 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = end / (duration * 60);
    const timer = setInterval(() => {
      start += increment;
      if (start > end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 1000 / 60);

    return () => clearInterval(timer);
  }, [end, duration]);

  return <span>{count}</span>;
};
```

---

## 🚀 Performance Optimization

### Memoization
```jsx
import { memo } from 'react';

const OptimizedComponent = memo(({ data }) => {
  return <div>{data}</div>;
});
```

### Code Splitting
```jsx
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

### Image Optimization
```jsx
// Use responsive images
<img
  src="image.webp"
  srcSet="image-small.webp 400w, image.webp 800w"
  alt="Description"
  loading="lazy"
  width="800"
  height="600"
/>
```

---

## ✅ Quality Checklist

Before committing component code:

- [ ] No TypeScript errors
- [ ] ESLint passes
- [ ] Proper PropTypes/TypeScript types
- [ ] Accessibility (WCAG AA)
- [ ] Mobile responsive
- [ ] Performance optimized
- [ ] No console warnings
- [ ] Well-documented
- [ ] Tested manually
- [ ] Follows design system

---

## 📖 Resources

- [Framer Motion Docs](https://www.framer.com/motion/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [React Docs](https://react.dev/)
- [Lucide Icons](https://lucide.dev/)
- [Web Accessibility](https://www.w3.org/WAI/)

---

**Happy Component Building! 🎉**

*Remember: Code with quality, style with intention, animate with purpose.*

*Version: 1.0.0*
