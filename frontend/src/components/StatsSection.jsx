import React, { useState, useEffect } from 'react';
import { motion as Motion } from 'framer-motion';

const stars = Array.from({ length: 20 }, (_, index) => ({
  left: `${(index * 47) % 100}%`,
  top: `${(index * 67) % 100}%`,
  duration: 3 + (index % 5) * 0.4,
  delay: (index % 7) * 0.28,
}));

const Counter = ({ end, duration = 2 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = end / (duration * 60); // 60 frames per second
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

  return count;
};

const StatsSection = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  };

  const stats = [
    {
      id: 1,
      end: 150,
      suffix: '+',
      label: 'Premium Destinations',
      icon: '🌍',
    },
    {
      id: 2,
      end: 50000,
      suffix: '+',
      label: 'Happy Members',
      icon: '👥',
    },
    {
      id: 3,
      end: 300,
      suffix: '+',
      label: 'Curated Experiences',
      icon: '✨',
    },
    {
      id: 4,
      end: 24,
      suffix: '/7',
      label: 'Hours Support',
      icon: '🎯',
    },
  ];

  return (
    <section className="relative w-full py-20 lg:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Luxury Dark Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B1220] via-[#1a2a4a] to-[#0B1220] -z-10" />

      {/* Animated Background Stars */}
      <div className="absolute inset-0 -z-10">
        {stars.map((star, i) => (
          <Motion.div
            key={i}
            animate={{
              opacity: [0.2, 0.8, 0.2],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
            }}
            className="absolute w-1 h-1 bg-[#D4A017] rounded-full"
            style={{
              left: star.left,
              top: star.top,
            }}
          />
        ))}

        {/* Large Gradient Blobs */}
        <Motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-1/4 left-1/2 w-96 h-96 bg-gradient-to-r from-[#D4A017]/30 to-transparent rounded-full blur-3xl -translate-x-1/2"
        />
        <Motion.div
          animate={{
            scale: [1.1, 1, 1.1],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{ duration: 10, repeat: Infinity, delay: 1 }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-l from-[#FF8A3D]/20 to-transparent rounded-full blur-3xl"
        />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <Motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 lg:mb-20"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            By The Numbers
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Discover the scale and impact of OrianaaClub's premium membership ecosystem
          </p>
        </Motion.div>

        {/* Stats Grid */}
        <Motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {stats.map((stat) => (
            <Motion.div
              key={stat.id}
              variants={itemVariants}
              className="group relative px-8 py-12 text-center"
            >
              {/* Card Background with glassmorphism */}
              <Motion.div
                whileHover={{ y: -8 }}
                className="absolute inset-0 bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl border border-white/10 rounded-2xl group-hover:border-[#D4A017]/40 transition-all duration-300 -z-10"
              />

              {/* Shine Effect on Hover */}
              <Motion.div
                initial={{ opacity: 0, x: -100 }}
                whileHover={{ opacity: 1, x: 100 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -z-10 rounded-2xl"
              />

              {/* Icon */}
              <Motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-5xl mb-4"
              >
                {stat.icon}
              </Motion.div>

              {/* Counter */}
              <Motion.div className="mb-4">
                <span className="text-5xl lg:text-6xl font-bold bg-gradient-to-r from-[#D4A017] to-[#FF8A3D] bg-clip-text text-transparent">
                  <Counter end={stat.end} />
                  {stat.suffix}
                </span>
              </Motion.div>

              {/* Label */}
              <p className="text-gray-300 font-medium group-hover:text-white transition-colors duration-300">
                {stat.label}
              </p>

              {/* Bottom Accent Line */}
              <Motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 + stat.id * 0.1 }}
                className="absolute bottom-0 left-1/2 h-1 w-12 bg-gradient-to-r from-[#D4A017] to-[#FF8A3D] rounded-t-full -translate-x-1/2 origin-left"
              />
            </Motion.div>
          ))}
        </Motion.div>

        {/* Trust Statement */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 lg:mt-20 p-8 bg-gradient-to-r from-[#D4A017]/10 to-[#FF8A3D]/10 border border-[#D4A017]/20 rounded-2xl text-center"
        >
          <h3 className="text-2xl font-bold text-white mb-3">Trusted by Thousands</h3>
          <p className="text-gray-400 max-w-2xl mx-auto">
            OrianaaClub has revolutionized luxury travel membership, becoming the preferred choice for
            discerning families and premium travelers worldwide who seek extraordinary experiences.
          </p>
        </Motion.div>
      </div>
    </section>
  );
};

export default StatsSection;
