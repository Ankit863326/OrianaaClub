import React from 'react';
import { motion as Motion } from 'framer-motion';
import {
  Crown,
  Zap,
  Gift,
  MapPin,
  Clock,
  Users,
  CheckCircle,
} from 'lucide-react';

const BenefitsSection = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  };

  const benefits = [
    {
      id: 1,
      icon: Crown,
      title: 'Priority Access',
      description: 'Get first access to premium stays and exclusive experiences before anyone else.',
    },
    {
      id: 2,
      icon: Zap,
      title: 'Family Planning',
      description: 'Dedicated vacation planning tailored for your family\'s unique needs.',
    },
    {
      id: 3,
      icon: Gift,
      title: 'Seasonal Offers',
      description: 'Exclusive member-only deals and discounts throughout the year.',
    },
    {
      id: 4,
      icon: MapPin,
      title: 'Curated Experiences',
      description: 'Hand-selected activities, dining, and wellness programs at every destination.',
    },
    {
      id: 5,
      icon: Clock,
      title: 'Flexible Booking',
      description: 'Easy rescheduling, flexible dates, and hassle-free cancellation policies.',
    },
    {
      id: 6,
      icon: Users,
      title: '24/7 Support',
      description: 'Premium concierge team ready to assist you anytime, anywhere in the world.',
    },
  ];

  return (
    <section
      id="membership"
      className="relative w-full py-20 lg:py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0B1220] via-[#1a2a4a]/50 to-[#0B1220] overflow-hidden"
    >
      {/* Background Decorations */}
      <div className="absolute inset-0 -z-10">
        <Motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute -top-40 right-1/4 w-96 h-96 bg-gradient-to-r from-[#D4A017]/40 to-transparent rounded-full blur-3xl"
        />
        <Motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 12, repeat: Infinity, delay: 2 }}
          className="absolute -bottom-40 left-1/4 w-96 h-96 bg-gradient-to-r from-[#FF8A3D]/30 to-transparent rounded-full blur-3xl"
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
            More Than a Membership
            <span className="block text-[#D4A017]">A Better Way to Travel</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Experience the pinnacle of luxury travel with benefits designed exclusively for you
          </p>
        </Motion.div>

        {/* Benefits Grid */}
        <Motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16"
        >
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <Motion.div
                key={benefit.id}
                variants={itemVariants}
                whileHover={{
                  y: -8,
                  boxShadow: '0 25px 50px rgba(212, 160, 23, 0.15)',
                }}
                className="group relative p-8 bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:border-[#D4A017]/40"
              >
                {/* Icon Container */}
                <Motion.div
                  whileHover={{ scale: 1.15, rotate: -5 }}
                  className="w-14 h-14 bg-gradient-to-br from-[#D4A017] to-[#FF8A3D] rounded-xl flex items-center justify-center mb-6 shadow-lg"
                >
                  <Icon size={28} className="text-white" />
                </Motion.div>

                {/* Content */}
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#D4A017] transition-colors duration-300">
                  {benefit.title}
                </h3>
                <p className="text-gray-400 group-hover:text-gray-300 transition-colors duration-300 leading-relaxed">
                  {benefit.description}
                </p>

                {/* Accent Line */}
                <div className="absolute bottom-0 left-0 h-1 w-0 group-hover:w-full bg-gradient-to-r from-[#D4A017] to-[#FF8A3D] transition-all duration-500" />
              </Motion.div>
            );
          })}
        </Motion.div>

        {/* Additional Benefits Section */}
        <Motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          {/* Left Content */}
          <div className="space-y-6">
            <h3 className="text-3xl lg:text-4xl font-bold text-white">
              Membership <span className="text-[#D4A017]">Advantages</span>
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Becoming an OrianaaClub member means joining an elite community of discerning
              travelers who refuse to compromise on quality or experiences.
            </p>

            <Motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="space-y-4"
            >
              {[
                'Lifetime access to 150+ curated destinations',
                'Exclusive member events and networking',
                'Personalized holiday concierge service',
                'Transfer credits and roll-over benefits',
              ].map((item, i) => (
                <Motion.div
                  key={i}
                  variants={itemVariants}
                  className="flex items-start gap-3"
                >
                  <CheckCircle size={24} className="text-[#D4A017] flex-shrink-0 mt-1" />
                  <span className="text-gray-300">{item}</span>
                </Motion.div>
              ))}
            </Motion.div>
          </div>

          {/* Right Content - Visual */}
          <Motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative h-96 rounded-2xl overflow-hidden"
          >
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#D4A017]/30 via-[#FF8A3D]/20 to-transparent" />

            {/* Animated Elements */}
            <Motion.div
              animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-br from-[#D4A017] to-[#FF8A3D] opacity-10"
            />

            {/* Stats Cards inside */}
            <div className="relative h-full flex items-center justify-center">
              <Motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="space-y-4"
              >
                <div className="p-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl">
                  <p className="text-[#D4A017] text-3xl font-bold">∞</p>
                  <p className="text-white text-sm">Unlimited Stays</p>
                </div>
                <div className="p-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl">
                  <p className="text-[#D4A017] text-3xl font-bold">50K+</p>
                  <p className="text-white text-sm">Happy Members</p>
                </div>
              </Motion.div>
            </div>
          </Motion.div>
        </Motion.div>
      </div>
    </section>
  );
};

export default BenefitsSection;
