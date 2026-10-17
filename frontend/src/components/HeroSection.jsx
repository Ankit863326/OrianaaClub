import React from 'react';
import { motion as Motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const HeroSection = () => {
  return (
    <section className="relative w-full overflow-hidden bg-[#0B1220]">
      
      {/* VIDEO SECTION */}
      <div className="relative w-full h-[calc(100vh-74px)] overflow-hidden bg-black mt-[60px]">
        
       

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />

        {/* Scroll */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <Motion.div
            animate={{ y: [0, 15, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-sm text-white/80">Explore</span>
            <ChevronDown size={24} className="text-white/80" />
          </Motion.div>
        </div>

      </div>
    </section>
  );
};

export default HeroSection;