/**
 * Dependency-free i18n resources. `en` is the complete reference; other locales
 * may be partial — `translate()` falls back to `en` per missing key, so adding
 * a language is incremental and never breaks the UI. Full string extraction
 * across every screen is an ongoing follow-up (this covers the Settings hub +
 * Language screen as the first translated slice).
 */

/** The selectable app languages (endonym + English name), the single source for
 *  both the Language screen and the i18n layer. `en` is the default. */
export const LANGUAGES = [
  { code: "en", native: "English", english: "Default" },
  { code: "hi", native: "हिन्दी", english: "Hindi" },
  { code: "ta", native: "தமிழ்", english: "Tamil" },
  { code: "te", native: "తెలుగు", english: "Telugu" },
  { code: "bn", native: "বাংলা", english: "Bengali" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada" },
  { code: "ml", native: "മലയാളം", english: "Malayalam" },
  { code: "mr", native: "मराठी", english: "Marathi" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi" },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia" },
  { code: "ur", native: "اردو", english: "Urdu" },
  { code: "as", native: "অসমীয়া", english: "Assamese" },
  { code: "es", native: "Español", english: "Spanish" },
] as const;

export type LocaleCode = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LOCALE: LocaleCode = "en";

export function isSupportedLocale(code: string | null | undefined): code is LocaleCode {
  return LANGUAGES.some((l) => l.code === code);
}

/** A recursive tree of translation strings. */
export type ResourceTree = { [key: string]: string | ResourceTree };

const en: ResourceTree = {
  settings: {
    title: "Settings",
    sections: { money: "Money", app: "App", data: "Data", about: "About" },
    rows: {
      accounts: { title: "Accounts", desc: "add & update balances" },
      budgets: { title: "Budgets", desc: "monthly spending limits" },
      categories: { title: "Categories", desc: "expense & income" },
      rules: { title: "Smart Rules", desc: "auto-categorise" },
      subscriptions: { title: "Subscriptions", desc: "recurring payments" },
      appearance: { title: "Appearance", desc: "theme · accent · text size" },
      language: { title: "Language", desc: "app language" },
      notifications: { title: "Notifications", desc: "on-device reminders" },
      extensions: { title: "Extensions", desc: "browse · install · manage" },
      "data-privacy": { title: "Data & Privacy", desc: "export · import · backup" },
      about: { title: "About", desc: "version · licenses · legal" },
    },
  },
  language: {
    title: "Language",
    heading: "App Language",
    search: "Search {count} languages…",
    empty: "No languages match “{query}”.",
    note: "SMS parsing always reads English bank senders, whatever the app language.",
  },
};

const hi: ResourceTree = {
  settings: {
    title: "सेटिंग्स",
    sections: { money: "पैसा", app: "ऐप", data: "डेटा", about: "परिचय" },
    rows: {
      accounts: { title: "खाते", desc: "शेष जोड़ें और अपडेट करें" },
      budgets: { title: "बजट", desc: "मासिक ख़र्च सीमा" },
      categories: { title: "श्रेणियाँ", desc: "ख़र्च और आय" },
      rules: { title: "स्मार्ट नियम", desc: "स्वतः वर्गीकरण" },
      subscriptions: { title: "सदस्यताएँ", desc: "आवर्ती भुगतान" },
      appearance: { title: "रूप", desc: "थीम · रंग · टेक्स्ट आकार" },
      language: { title: "भाषा", desc: "ऐप भाषा" },
      notifications: { title: "सूचनाएँ", desc: "डिवाइस पर रिमाइंडर" },
      extensions: { title: "एक्सटेंशन", desc: "ब्राउज़ · इंस्टॉल · प्रबंधन" },
      "data-privacy": { title: "डेटा और गोपनीयता", desc: "निर्यात · आयात · बैकअप" },
      about: { title: "परिचय", desc: "संस्करण · लाइसेंस · क़ानूनी" },
    },
  },
  language: {
    title: "भाषा",
    heading: "ऐप भाषा",
    search: "{count} भाषाएँ खोजें…",
    empty: "“{query}” से कोई भाषा मेल नहीं खाती।",
    note: "ऐप की भाषा चाहे जो हो, SMS पार्सिंग हमेशा अंग्रेज़ी बैंक प्रेषकों को पढ़ती है।",
  },
};

const ta: ResourceTree = {
  settings: {
    title: "அமைப்புகள்",
    sections: { money: "பணம்", app: "செயலி", data: "தரவு", about: "பற்றி" },
    rows: {
      accounts: { title: "கணக்குகள்", desc: "இருப்பைச் சேர்த்து புதுப்பிக்கவும்" },
      budgets: { title: "பட்ஜெட்", desc: "மாதாந்திர செலவு வரம்புகள்" },
      categories: { title: "வகைகள்", desc: "செலவு & வருமானம்" },
      rules: { title: "ஸ்மார்ட் விதிகள்", desc: "தானியங்கு வகைப்பாடு" },
      subscriptions: { title: "சந்தாக்கள்", desc: "தொடர் கட்டணங்கள்" },
      appearance: { title: "தோற்றம்", desc: "தீம் · நிறம் · எழுத்து அளவு" },
      language: { title: "மொழி", desc: "செயலி மொழி" },
      notifications: { title: "அறிவிப்புகள்", desc: "சாதனத்தில் நினைவூட்டல்கள்" },
      extensions: { title: "நீட்டிப்புகள்", desc: "உலாவு · நிறுவு · நிர்வகி" },
      "data-privacy": { title: "தரவு & தனியுரிமை", desc: "ஏற்றுமதி · இறக்குமதி · காப்பு" },
      about: { title: "பற்றி", desc: "பதிப்பு · உரிமங்கள் · சட்டம்" },
    },
  },
  language: {
    title: "மொழி",
    heading: "செயலி மொழி",
    search: "{count} மொழிகளைத் தேடு…",
    empty: "“{query}” உடன் எந்த மொழியும் பொருந்தவில்லை.",
    note: "செயலியின் மொழி எதுவாயினும், SMS பாகுபடுத்தல் எப்போதும் ஆங்கில வங்கி அனுப்புநர்களைப் படிக்கும்.",
  },
};

export const RESOURCES: Record<string, ResourceTree> = { en, hi, ta };
