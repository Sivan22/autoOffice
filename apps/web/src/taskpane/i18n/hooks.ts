import { useContext } from 'react';
import { LanguageContext, type LanguageContextValue } from './context.tsx';

function ctx(): LanguageContextValue {
  const c = useContext(LanguageContext);
  if (!c) throw new Error('LanguageProvider missing in tree');
  return c;
}

export function useTranslation() {
  const c = ctx();
  return { t: c.t, locale: c.locale, setLocale: c.setLocale };
}

export function useDirection(): 'ltr' | 'rtl' {
  return ctx().direction;
}

export function useFormatters() {
  return ctx().formatters;
}
