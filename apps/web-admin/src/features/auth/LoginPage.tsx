import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import {
  Sms,
  Lock1,
  Eye,
  EyeSlash,
  ArrowRight,
  ShieldTick,
  Chart21,
  MessageQuestion,
  Profile2User,
} from 'iconsax-react';
import { Button } from '@/shared/ui/Button';
import { useAuth } from '@/shared/store/auth';

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('admin@hokimiyat.uz');
  const [password, setPassword] = useState('123456');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setTimeout(() => {
      const res = login(email, password);
      if (res.ok) {
        navigate(from, { replace: true });
      } else {
        setError(res.error ?? "Kirishda xatolik");
        setLoading(false);
      }
    }, 800);
  }

  return (
    <div className="force-light grid min-h-screen bg-canvas lg:grid-cols-2">
      {/* Left — brand panel */}
      <div
        className="relative hidden overflow-hidden lg:block"
        style={{
          background:
            'linear-gradient(150deg, #064e3b 0%, #047857 45%, #059669 75%, #0d9488 100%)',
        }}
      >
        {/* Spotlight + vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_0%_0%,rgba(255,255,255,0.14),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(90%_90%_at_100%_100%,rgba(0,0,0,0.30),transparent_60%)]" />
        {/* Fine grid */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
            maskImage: 'radial-gradient(100% 100% at 50% 0%, #000 40%, transparent 85%)',
          }}
        />
        {/* Soft glow orbs (monochrome, on-brand) */}
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-20 top-10 h-80 w-80 rounded-full bg-primary-400/30 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.22, 1], opacity: [0.2, 0.38, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
          className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-primary-300/25 blur-3xl"
        />

        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur">
              <ShieldTick size={26} variant="Bulk" color="#ffffff" />
            </div>
            <div className="leading-tight">
              <div className="text-lg font-bold">Hokimiyat</div>
              <div className="text-xs text-white/60">Raqamli boshqaruv platformasi</div>
            </div>
          </motion.div>

          {/* Headline + features */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06 }}
              className="mb-4 inline-flex items-center gap-2.5"
            >
              <span className="h-px w-8 bg-primary-200/80" />
              <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-primary-200">
                Davlat boshqaruv platformasi
              </span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="max-w-md text-[34px] font-bold leading-tight"
            >
              Hududni boshqarishning{' '}
              <span className="text-primary-200">yagona markazi</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-3 max-w-md text-[15px] leading-relaxed text-white/75"
            >
              Murojaatlar, ishchilar va analitika — barchasi bitta zamonaviy panelda.
            </motion.p>

            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="mt-9 space-y-3"
            >
              {[
                { icon: Chart21, title: 'Real vaqt analitika', desc: "Ko'rsatkichlar va hisobotlar bir joyda" },
                { icon: MessageQuestion, title: 'Murojaatlar boshqaruvi', desc: 'Fuqaro murojaatlarini tez hal qiling' },
                { icon: Profile2User, title: 'Ishchilar nazorati', desc: 'Jamoa faoliyatini kuzatib boring' },
              ].map(({ icon: Ic, title, desc }) => (
                <motion.div
                  key={title}
                  variants={item}
                  className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur transition-colors hover:border-white/20 hover:bg-white/10"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 transition-transform group-hover:scale-110">
                    <Ic size={22} variant="Bulk" color="#ffffff" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[15px] font-semibold">{title}</div>
                    <div className="text-[13px] text-white/65">{desc}</div>
                  </div>
                  <ArrowRight
                    size={18}
                    className="shrink-0 -translate-x-1 text-white/50 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                  />
                  {/* Shine sweep */}
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Trust + security */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-7">
              {[
                { v: '99.9%', l: 'Uptime' },
                { v: '256-bit', l: 'Shifrlash' },
                { v: '24/7', l: "Qo'llab-quvvatlash" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-xl font-bold">{s.v}</div>
                  <div className="text-xs text-white/60">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="h-px w-full bg-white/10" />
            <div className="flex items-center gap-2 text-sm text-white/65">
              <ShieldTick size={18} variant="Bulk" />
              Davlat xavfsizlik standartlari bilan himoyalangan
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right — form */}
      <div className="relative flex items-center justify-center overflow-hidden bg-canvas p-6">
        {/* Layered ambient background — depth in both light & dark (no empty void) */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(125%_80%_at_100%_0%,rgba(16,185,129,0.16),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(95%_75%_at_0%_100%,rgba(59,130,246,0.16),transparent_55%)]" />
        {/* Dotted grid — subtle dark dots on light surface */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(15,23,42,0.07) 1px, transparent 0)',
            backgroundSize: '26px 26px',
            maskImage: 'radial-gradient(100% 100% at 50% 38%, #000 28%, transparent 78%)',
          }}
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.62, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary-400/20 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-accent-400/25 blur-3xl"
        />

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="relative w-full max-w-sm"
        >
          <div className="relative overflow-hidden rounded-3xl border border-line bg-surface/85 p-8 shadow-pop backdrop-blur-xl">
            {/* Top sheen accent */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary-400/70 to-transparent" />
            <div className="pointer-events-none absolute -top-10 left-1/2 -z-10 h-24 w-3/4 -translate-x-1/2 rounded-full bg-primary-400/10 blur-2xl" />
            {/* Mobile logo */}
            <motion.div variants={item} className="mb-6 flex justify-center lg:hidden">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 shadow-glow">
                <ShieldTick size={30} variant="Bulk" color="#ffffff" />
              </div>
            </motion.div>

            {/* Status pill */}
            <motion.div
              variants={item}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1 text-[12px] font-medium text-ink-soft"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
              </span>
              Tizim faol
            </motion.div>

            <motion.h2 variants={item} className="text-[26px] font-bold text-ink">
              Xush kelibsiz
            </motion.h2>
            <motion.p variants={item} className="mt-1 text-sm text-ink-muted">
              Boshqaruv paneliga kirish uchun ma'lumotlaringizni kiriting
            </motion.p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <motion.div variants={item} className="group">
                <label className="mb-1.5 block text-[13px] font-medium text-ink-soft transition-colors group-focus-within:text-primary-600">
                  Email yoki login
                </label>
                <div className="relative">
                  <Sms
                    size={19}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted transition-colors group-focus-within:text-primary-500"
                  />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-xl border border-line bg-surface-2 pl-11 pr-4 text-sm outline-none transition-all focus:border-primary-500 focus:bg-surface focus:ring-4 focus:ring-primary-50"
                  />
                </div>
              </motion.div>

              <motion.div variants={item} className="group">
                <label className="mb-1.5 block text-[13px] font-medium text-ink-soft transition-colors group-focus-within:text-primary-600">
                  Parol
                </label>
                <div className="relative">
                  <Lock1
                    size={19}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted transition-colors group-focus-within:text-primary-500"
                  />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 w-full rounded-xl border border-line bg-surface-2 pl-11 pr-11 text-sm outline-none transition-all focus:border-primary-500 focus:bg-surface focus:ring-4 focus:ring-primary-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-ink"
                  >
                    {showPass ? <EyeSlash size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </motion.div>

              <motion.div variants={item} className="flex items-center justify-between text-[13px]">
                <label className="flex cursor-pointer items-center gap-2 text-ink-soft">
                  <input type="checkbox" className="h-4 w-4 rounded accent-primary-600" />
                  Meni eslab qol
                </label>
                <a href="#" className="font-medium text-primary-600 hover:underline">
                  Parolni unutdingizmi?
                </a>
              </motion.div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger"
                >
                  <ShieldTick size={17} variant="Bulk" />
                  {error}
                </motion.div>
              )}

              <motion.div variants={item}>
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Kirilmoqda...
                    </>
                  ) : (
                    <>
                      Kirish
                      <ArrowRight size={18} />
                    </>
                  )}
                </Button>
              </motion.div>
            </form>
          </div>

          <motion.p variants={item} className="mt-6 text-center text-xs text-ink-muted">
            © 2026 Hokimiyat Digital Platform · O'zbekiston Respublikasi
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
