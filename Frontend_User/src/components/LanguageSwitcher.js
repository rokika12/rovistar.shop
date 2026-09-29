import { FiGlobe } from 'react-icons/fi';
import { useLanguage } from '../i18n';

export default function LanguageSwitcher({ className = '' }) {
  const { lang, toggle } = useLanguage();
  return (
    <button type="button" onClick={toggle} className={className} aria-label="Switch language">
      <FiGlobe /> {lang === 'kh' ? 'ខ្មែរ' : 'EN'}
    </button>
  );
}
