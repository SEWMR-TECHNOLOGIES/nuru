import { useLanguage } from '@/lib/i18n/LanguageContext';

const LanguageSwitcher = ({ variant = 'compact' }: { variant?: 'compact' | 'full' }) => {
  const { locale, setLocale, isEnglish } = useLanguage();

  if (variant === 'full') {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setLocale('en')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
            isEnglish
              ? 'bg-primary/10 border-primary text-primary font-semibold'
              : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          <span className="text-lg">🇬🇧</span>
          <span className="text-sm">English</span>
          {isEnglish && <span className="text-xs">✓</span>}
        </button>
        <button
          onClick={() => setLocale('sw')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
            !isEnglish
              ? 'bg-primary/10 border-primary text-primary font-semibold'
              : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          <span className="text-lg">🇹🇿</span>
          <span className="text-sm">Kiswahili</span>
          {!isEnglish && <span className="text-xs">✓</span>}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setLocale(isEnglish ? 'sw' : 'en')}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors text-sm font-medium"
      title={isEnglish ? 'Switch to Swahili' : 'Switch to English'}
    >
      <span>{isEnglish ? '🇬🇧' : '🇹🇿'}</span>
      <span className="text-xs font-bold">{isEnglish ? 'EN' : 'SW'}</span>
    </button>
  );
};

export default LanguageSwitcher;
