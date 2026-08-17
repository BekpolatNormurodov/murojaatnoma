import { motion, type Variants } from 'framer-motion';
import { ShieldTick } from 'iconsax-react';

const TITLE = 'Hokimiyat';

const letter: Variants = {
  hidden: { opacity: 0, y: 28, rotateX: -90 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { delay: 0.55 + i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: 1.04,
        filter: 'blur(8px)',
        transition: { duration: 0.6, ease: 'easeInOut' },
      }}
      className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          'linear-gradient(140deg, #064e3b 0%, #047857 42%, #059669 72%, #0d9488 100%)',
      }}
    >
      {/* Rotating conic glow */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
        className="absolute h-[140vmax] w-[140vmax] opacity-25"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.18) 60deg, transparent 140deg, rgba(96,165,250,0.22) 220deg, transparent 320deg)',
        }}
      />

      {/* Fine grid for depth */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage: 'radial-gradient(80% 80% at 50% 50%, #000 30%, transparent 75%)',
        }}
      />
      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_40%,transparent_55%,rgba(0,0,0,0.28))]" />
      {/* Center spotlight on logo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_45%_at_50%_42%,rgba(255,255,255,0.16),transparent_70%)]" />

      {/* Floating orbs */}
      <motion.div
        animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.55, 0.3], x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
      />
      <motion.div
        animate={{ scale: [1, 1.35, 1], opacity: [0.2, 0.45, 0.2], x: [0, -24, 0], y: [0, 24, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
        className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-accent-400/30 blur-3xl"
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
        className="absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-primary-300/20 blur-3xl"
      />

      {/* Floating particles */}
      {[...Array(7)].map((_, i) => (
        <motion.span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-white/50"
          style={{ left: `${12 + i * 11}%`, top: `${18 + (i % 3) * 24}%` }}
          animate={{ y: [0, -26, 0], opacity: [0, 0.9, 0], scale: [0.6, 1, 0.6] }}
          transition={{ duration: 4 + i * 0.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
        />
      ))}

      {/* Twinkling stars */}
      {[...Array(22)].map((_, i) => (
        <motion.span
          key={`star-${i}`}
          className="absolute h-0.5 w-0.5 rounded-full bg-white"
          style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
          transition={{ duration: 2 + (i % 4), repeat: Infinity, ease: 'easeInOut', delay: (i % 5) * 0.5 }}
        />
      ))}

      {/* Logo */}
      <div className="relative flex flex-col items-center">
        {/* Soft glow behind logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
          className="pointer-events-none absolute -top-10 h-56 w-56 rounded-full bg-white/20 blur-[60px]"
        />
        <motion.div
          initial={{ scale: 0, rotate: -45, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 11, stiffness: 180, delay: 0.1 }}
          className="relative"
        >
          {/* Pulse rings */}
          {[0, 0.7, 1.4].map((delay) => (
            <motion.span
              key={delay}
              animate={{ scale: [1, 2], opacity: [0.5, 0] }}
              transition={{ duration: 2.1, repeat: Infinity, ease: 'easeOut', delay }}
              className="absolute inset-0 rounded-4xl bg-white/25"
            />
          ))}

          {/* Rotating dashed ring */}
          <motion.svg
            viewBox="0 0 176 176"
            className="absolute -inset-6 h-44 w-44"
            animate={{ rotate: 360 }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
          >
            <circle
              cx="88"
              cy="88"
              r="84"
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.5"
              strokeDasharray="2 12"
              strokeLinecap="round"
            />
          </motion.svg>

          {/* Drawn progress arc */}
          <svg viewBox="0 0 176 176" className="absolute -inset-6 h-44 w-44 -rotate-90">
            <motion.circle
              cx="88"
              cy="88"
              r="84"
              fill="none"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="528"
              initial={{ strokeDashoffset: 528 }}
              animate={{ strokeDashoffset: 150 }}
              transition={{ duration: 2.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>

          {/* Orbiting dot */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
            className="absolute -inset-3.5"
          >
            <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
          </motion.div>

          <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-4xl border border-white/30 bg-linear-to-br from-white/30 to-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_24px_50px_-12px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            {/* Sheen sweep */}
            <motion.span
              animate={{ x: ['-160%', '160%'] }}
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }}
              className="absolute inset-y-0 w-1/2 -skew-x-12 bg-linear-to-r from-transparent via-white/35 to-transparent"
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 9, stiffness: 210, delay: 0.4 }}
            >
              <ShieldTick size={66} variant="Bulk" color="#ffffff" />
            </motion.div>
          </div>
        </motion.div>

        {/* Title — letter stagger */}
        <h1
          className="mt-9 flex perspective-[600px] text-5xl font-black tracking-tight text-white"
          style={{ textShadow: '0 6px 36px rgba(255,255,255,0.28)' }}
        >
          {TITLE.split('').map((ch, i) => (
            <motion.span
              key={i}
              custom={i}
              variants={letter}
              initial="hidden"
              animate="show"
              className="inline-block"
            >
              {ch}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.05 }}
          className="mt-4 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[13px] font-medium tracking-wide text-white/85 backdrop-blur"
        >
          Raqamli boshqaruv platformasi
        </motion.p>

        {/* Decorative underline */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 h-px w-44 origin-center bg-linear-to-r from-transparent via-white/55 to-transparent"
        />
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.3 }}
        className="absolute bottom-10 text-[11px] tracking-wide text-white/50"
      >
        © 2026 O'zbekiston Respublikasi
      </motion.div>
    </motion.div>
  );
}
