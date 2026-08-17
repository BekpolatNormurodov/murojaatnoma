import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar, SidebarContent } from './Sidebar';
import { Topbar } from './Topbar';
import { useUI } from '@/shared/store/ui';
import { cn } from '@/shared/lib/cn';

export function AdminLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useUI((s) => s.sidebarCollapsed);

  // Sahifa almashganda mobil menyuni yopish
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar />

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-surface lg:hidden"
            >
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className={cn('transition-[padding] duration-300 ease-out', collapsed ? 'lg:pl-20' : 'lg:pl-66')}>
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-5 lg:px-8 lg:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
