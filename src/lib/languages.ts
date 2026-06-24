// 번역 언어 선택 메뉴용 언어 목록(Google Translate 지원 코드 기준).
// 검색은 ko(한글명)·native(현지명)·en(영문명)·code 모두에 매칭된다.

export interface Lang {
  code: string;   // Google Translate target 코드
  ko: string;     // 한글 표기
  native: string; // 현지 표기
  en: string;     // 영문 표기(검색용)
}

export const LANGUAGES: Lang[] = [
  { code: 'ko',    ko: '한국어',         native: '한국어',            en: 'Korean' },
  { code: 'en',    ko: '영어',           native: 'English',           en: 'English' },
  { code: 'ja',    ko: '일본어',         native: '日本語',            en: 'Japanese' },
  { code: 'zh-CN', ko: '중국어(간체)',   native: '简体中文',          en: 'Chinese Simplified' },
  { code: 'zh-TW', ko: '중국어(번체)',   native: '繁體中文',          en: 'Chinese Traditional' },
  { code: 'es',    ko: '스페인어',       native: 'Español',           en: 'Spanish' },
  { code: 'vi',    ko: '베트남어',       native: 'Tiếng Việt',        en: 'Vietnamese' },
  { code: 'fr',    ko: '프랑스어',       native: 'Français',          en: 'French' },
  { code: 'de',    ko: '독일어',         native: 'Deutsch',           en: 'German' },
  { code: 'ru',    ko: '러시아어',       native: 'Русский',           en: 'Russian' },
  { code: 'pt',    ko: '포르투갈어',     native: 'Português',         en: 'Portuguese' },
  { code: 'it',    ko: '이탈리아어',     native: 'Italiano',          en: 'Italian' },
  { code: 'th',    ko: '태국어',         native: 'ไทย',               en: 'Thai' },
  { code: 'id',    ko: '인도네시아어',   native: 'Bahasa Indonesia',  en: 'Indonesian' },
  { code: 'hi',    ko: '힌디어',         native: 'हिन्दी',             en: 'Hindi' },
  { code: 'ar',    ko: '아랍어',         native: 'العربية',           en: 'Arabic' },
  { code: 'tr',    ko: '터키어',         native: 'Türkçe',            en: 'Turkish' },
  { code: 'nl',    ko: '네덜란드어',     native: 'Nederlands',        en: 'Dutch' },
  { code: 'pl',    ko: '폴란드어',       native: 'Polski',            en: 'Polish' },
  { code: 'uk',    ko: '우크라이나어',   native: 'Українська',        en: 'Ukrainian' },
  { code: 'ms',    ko: '말레이어',       native: 'Bahasa Melayu',     en: 'Malay' },
  { code: 'fil',   ko: '필리핀어',       native: 'Filipino',          en: 'Filipino Tagalog' },
  { code: 'mn',    ko: '몽골어',         native: 'Монгол',            en: 'Mongolian' },
  { code: 'sv',    ko: '스웨덴어',       native: 'Svenska',           en: 'Swedish' },
  { code: 'el',    ko: '그리스어',       native: 'Ελληνικά',          en: 'Greek' },
  { code: 'cs',    ko: '체코어',         native: 'Čeština',           en: 'Czech' },
  { code: 'ro',    ko: '루마니아어',     native: 'Română',            en: 'Romanian' },
  { code: 'hu',    ko: '헝가리어',       native: 'Magyar',            en: 'Hungarian' },
  { code: 'he',    ko: '히브리어',       native: 'עברית',             en: 'Hebrew' },
  { code: 'fa',    ko: '페르시아어',     native: 'فارسی',             en: 'Persian Farsi' },
  { code: 'bn',    ko: '벵골어',         native: 'বাংলা',             en: 'Bengali' },
  { code: 'ta',    ko: '타밀어',         native: 'தமிழ்',             en: 'Tamil' },
  { code: 'sw',    ko: '스와힐리어',     native: 'Kiswahili',         en: 'Swahili' },
  { code: 'da',    ko: '덴마크어',       native: 'Dansk',             en: 'Danish' },
  { code: 'fi',    ko: '핀란드어',       native: 'Suomi',             en: 'Finnish' },
  { code: 'no',    ko: '노르웨이어',     native: 'Norsk',             en: 'Norwegian' },
];

// 검색어가 없을 때 기본으로 보여줄 언어
export const PRESET_CODES = ['ko', 'en', 'ja', 'zh-CN', 'es', 'vi'];

/** 검색어로 언어 필터. 비어 있으면 기본 프리셋만 반환. */
export function filterLanguages(query: string): Lang[] {
  const q = query.trim().toLowerCase();
  if (!q) return LANGUAGES.filter(l => PRESET_CODES.includes(l.code));
  return LANGUAGES.filter(l =>
    l.ko.toLowerCase().includes(q) ||
    l.native.toLowerCase().includes(q) ||
    l.en.toLowerCase().includes(q) ||
    l.code.toLowerCase().includes(q)
  );
}
