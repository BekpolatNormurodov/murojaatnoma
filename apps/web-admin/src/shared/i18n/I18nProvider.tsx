import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DICT, type Lang } from './dict';

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nCtx | null>(null);
const STORAGE_KEY = 'hkm-lang';

function getInitial(): Lang {
  if (typeof window === 'undefined') return 'uz';
  const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (saved === 'uz' || saved === 'ru' || saved === 'en') return saved;
  return 'uz';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitial);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const t = useCallback(
    (key: string) => DICT[lang][key] ?? DICT.uz[key] ?? key,
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nCtx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
