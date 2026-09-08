"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import en, { TranslationKeys } from "@/locales/en";
import hi from "@/locales/hi";
import te from "@/locales/te";
import ta from "@/locales/ta";
import kn from "@/locales/kn";
import mr from "@/locales/mr";
import bn from "@/locales/bn";
import gu from "@/locales/gu";
import pa from "@/locales/pa";

// ── Types ────────────────────────────────────────────────────────────────────

export type SupportedLocale = "en" | "hi" | "te" | "ta" | "kn" | "mr" | "bn" | "gu" | "pa";

export interface LanguageInfo {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  script: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: "en", name: "English", nativeName: "English", script: "Latn" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", script: "Deva" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", script: "Telu" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", script: "Taml" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", script: "Knda" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", script: "Deva" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", script: "Beng" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", script: "Gujr" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", script: "Guru" },
];

// ── Locale Map ───────────────────────────────────────────────────────────────

const LOCALE_MAP: Record<SupportedLocale, any> = {
  en, hi, te, ta, kn, mr, bn, gu, pa,
};

// ── Common UI / Agricultural Term Translations ──────────────────────────────
// Instant zero-latency translations for frequently viewed dashboard cards & commodities

export const COMMON_TRANSLATIONS: Record<string, Record<SupportedLocale, string>> = {
  // Weather & Telemetry Cards
  "soil moisture": {
    en: "Soil Moisture", hi: "मिट्टी की नमी", te: "నేలలో తేమ", ta: "மண் ஈரப்பதம்", kn: "ಮಣ್ಣಿನ ತೇವಾಂಶ", mr: "मातीतील ओलावा", bn: "মাটির আর্দ্রতা", gu: "જમીનમાં ભેજ", pa: "ਮਿੱਟੀ ਦੀ ਨਮੀ"
  },
  "optimal moisture": {
    en: "Optimal Moisture", hi: "उचित नमी", te: "అనుకూలమైన తేమ", ta: "சிறந்த ஈரப்பதம்", kn: "ಸೂಕ್ತ ತೇವಾಂಶ", mr: "योग्य ओलावा", bn: "অনুকূল আর্দ্রতা", gu: "યોગ્ય ભેજ", pa: "ਅਨੁਕੂਲ ਨਮੀ"
  },
  "needs watering": {
    en: "Needs Watering", hi: "पानी की आवश्यकता", te: "నీరు అవసరం", ta: "தண்ணீர் தேவை", kn: "ನೀರು ಬೇಕು", mr: "पाण्याची गरज", bn: "পানি প্রয়োজন", gu: "પાણીની જરૂર", pa: "ਪਾਣੀ ਦੀ ਲੋੜ"
  },
  "air temperature": {
    en: "Air Temperature", hi: "हवा का तापमान", te: "గాలి ఉష్ణోగ్రత", ta: "காற்று வெப்பநிலை", kn: "ಗಾಳಿಯ ತಾಪಮಾನ", mr: "हवेचे तापमान", bn: "বাতাসের তাপমাত্রা", gu: "હવાનું તાપમાન", pa: "ਹਵਾ ਦਾ ਤਾਪਮਾਨ"
  },
  "rainfall today": {
    en: "Rainfall Today", hi: "आज की वर्षा", te: "ఈరోజు వర్షపాతం", ta: "இன்றைய மழை", kn: "ಇಂದಿನ ಮಳೆ", mr: "आजचा पाऊस", bn: "আজকের বৃষ্টিপাত", gu: "આજનો વરસાદ", pa: "ਅੱਜ ਦੀ ਬਾਰਿਸ਼"
  },
  "wind speed": {
    en: "Wind Speed", hi: "हवा की गति", te: "గాలి వేగం", ta: "காற்றின் வேகம்", kn: "ಗಾಳಿಯ ವೇಗ", mr: "वाऱ्याचा वेग", bn: "বাতাসের গতি", gu: "પવનની ગતિ", pa: "ਹਵਾ ਦੀ ਰਫ਼ਤਾਰ"
  },
  "water evaporation": {
    en: "Water Evaporation", hi: "जल वाष्पीकरण", te: "నీటి ఆవిరి", ta: "நீர் ஆவியாதல்", kn: "ನೀರಿನ ಆವಿಯಾಗುವಿಕೆ", mr: "पाण्याचे बाष्पीभवन", bn: "পানি বাষ্পীভবন", gu: "પાણીનું બાષ્પીભવન", pa: "ਪਾਣੀ ਦਾ ਵਾਸ਼ਪੀਕਰਨ"
  },
  "farm location": {
    en: "Farm Location", hi: "खेत का स्थान", te: "వ్యవసాయ క్షేత్ర స్థానం", ta: "பண்ணை அமைவிடம்", kn: "ಕೃಷಿ ಭೂಮಿಯ ಸ್ಥಳ", mr: "शेताचे स्थान", bn: "খামারের অবস্থান", gu: "ખેતરનું સ્થાન", pa: "ਖੇਤ ਦਾ ਸਥਾਨ"
  },
  "smart farmer advisory & immediate action tips": {
    en: "Smart Farmer Advisory & Immediate Action Tips", hi: "स्मार्ट किसान सलाह और त्वरित सुझाव", te: "స్మార్ట్ రైతు సలహాలు & తక్షణ సూచనలు", ta: "ஸ்மார்ட் உழவர் ஆலோசனை மற்றும் உடனடி குறிப்புகள்", kn: "ಸ್ಮಾರ್ಟ್ ರೈತ ಸಲಹೆಗಳು ಮತ್ತು ತಕ್ಷಣದ ಸಲಹೆಗಳು", mr: "स्मार्ट शेतकरी सल्ला आणि त्वरित कृती टिप्स", bn: "স্মার্ট কৃষক পরামর্শ এবং তাৎক্ষণিক পদক্ষেপ টিপস", gu: "સ્માર્ટ ખેડૂત સલાહ અને તાત્કાલિક પગલાં ટિપ્સ", pa: "ਸਮਾਰਟ ਕਿਸਾਨ ਸਲਾਹ ਅਤੇ ਤੁਰੰਤ ਕਾਰਵਾਈ ਸੁਝਾਅ"
  },
  "forecast (7 days)": {
    en: "Forecast (7 Days)", hi: "7 दिनों का पूर्वानुमान", te: "7 రోజుల వాతావరణ అంచనా", ta: "7 நாள் முன்னறிவிப்பு", kn: "ಮುನ್ಸೂಚನೆ (7 ದಿನಗಳು)", mr: "7 दिवसांचा अंदाज", bn: "৭ দিনের পূর্বাভাস", gu: "આગાહી (7 દિવસ)", pa: "7 ਦਿਨਾਂ ਦੀ ਭਵਿੱਖਬਾਣੀ"
  },
  "soil moisture depth analysis": {
    en: "Soil Moisture Depth Analysis", hi: "मिट्टी की गहराई में नमी का विश्लेषण", te: "నేల తేమ లోతు విశ్లేషణ", ta: "மண் ஈரப்பத ஆழ பகுப்பாய்வு", kn: "ಮಣ್ಣಿನ ತೇವಾಂಶ ಆಳ ವಿಶ್ಲೇಷಣೆ", mr: "मातीतील ओलावा खोली विश्लेषण", bn: "মাটির আর্দ্রতা গভীরতা বিশ্লেষণ", gu: "જમીનના ભેજનું ઊંડાણ વિશ્લેષણ", pa: "ਮਿੱਟੀ ਦੀ ਨਮੀ ਡੂੰਘਾਈ ਵਿਸ਼ਲੇਸ਼ਣ"
  },
  "fetching live agricultural telemetry...": {
    en: "Fetching live agricultural telemetry...", hi: "लाइव कृषि मौसम डेटा लोड हो रहा है...", te: "ప్రత్యక్ష వ్యవసాయ డేటా లోడ్ అవుతోంది...", ta: "நேரடி வேளாண் தரவு பெறப்படுகிறது...", kn: "ಲೈವ್ ಕೃಷಿ ಡೇಟಾವನ್ನು ಪಡೆಯಲಾಗುತ್ತಿದೆ...", mr: "थेट कृषी डेटा लोड होत आहे...", bn: "লাইভ কৃষি ডেটা লোড হচ্ছে...", gu: "લાઇવ કૃષિ ડેટા લોડ થઈ રહ્યો છે...", pa: "ਲਾਈਵ ਖੇਤੀਬਾੜੀ ਡੇਟਾ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ..."
  },
  "surface moisture": {
    en: "Surface moisture", hi: "सतह की नमी", te: "ఉపరితల తేమ", ta: "மேற்பரப்பு ஈரப்பதம்", kn: "ಮೇಲ್ಮೈ ತೇವಾಂಶ", mr: "पृष्ठभागावरील ओलावा", bn: "পৃষ্ঠের আর্দ্রতা", gu: "સપાટીનો ભેજ", pa: "ਸਤਹ ਦੀ ਨਮੀ"
  },
  "current temp": {
    en: "Current temp", hi: "वर्तमान तापमान", te: "ప్రస్తుత ఉష్ణోగ్రత", ta: "தற்போதைய வெப்பநிலை", kn: "ಪ್ರಸ್ತುತ ತಾಪಮಾನ", mr: "सध्याचे तापमान", bn: "বর্তমান তাপমাত্রা", gu: "વર્તમાન તાપમાન", pa: "ਮੌਜੂਦਾ ਤਾਪਮਾਨ"
  },

  // Agricultural Commodities (Mandis & Market Prices)
  "rice": {
    en: "Rice", hi: "चावल / धान", te: "వరి", ta: "அரிசி", kn: "ಅಕ್ಕಿ", mr: "तांदूळ", bn: "চাল", gu: "ચોખા", pa: "ਚੌਲ"
  },
  "paddy": {
    en: "Paddy", hi: "धान", te: "వరి ధాన్యం", ta: "நெல்", kn: "ಭತ್ತ", mr: "भात", bn: "ধান", gu: "ડાંગર", pa: "ਝੋਨਾ"
  },
  "wheat": {
    en: "Wheat", hi: "गेहूं", te: "గోధుమ", ta: "கோதுமை", kn: "ಗೋಧಿ", mr: "गहू", bn: "গম", gu: "ઘઉં", pa: "ਕਣਕ"
  },
  "cotton": {
    en: "Cotton", hi: "कपास", te: "పత్తి", ta: "பருத்தி", kn: "ಹತ್ತಿ", mr: "कापूस", bn: "তুলা", gu: "કપાસ", pa: "ਕਪਾਹ"
  },
  "chilli": {
    en: "Chilli", hi: "मिर्च", te: "మిరప", ta: "மிளகாய்", kn: "ಮೆಣಸಿನಕಾಯಿ", mr: "मिरची", bn: "লঙ্কা", gu: "મરચાં", pa: "ਮਿਰਚ"
  },
  "maize": {
    en: "Maize", hi: "मक्का", te: "మొక్కజొన్న", ta: "மக்காச்சோளம்", kn: "ಮೆಕ್ಕೆಜೋಳ", mr: "मका", bn: "ভুট্টা", gu: "મકાઈ", pa: "ਮੱਕੀ"
  },
  "turmeric": {
    en: "Turmeric", hi: "हल्दी", te: "పసుపు", ta: "மஞ்சள்", kn: "ಅರಿಶಿನ", mr: "हळद", bn: "হলুদ", gu: "હળદર", pa: "ਹਲਦੀ"
  },
  "tomato": {
    en: "Tomato", hi: "टमाटर", te: "టమాటా", ta: "தக்காளி", kn: "ಟೊಮೆಟೊ", mr: "टोमॅटो", bn: "টমেটো", gu: "ટામેટા", pa: "ਟਮਾਟਰ"
  },
  "onion": {
    en: "Onion", hi: "प्याज", te: "ఉల్లిపాయ", ta: "வெங்காயம்", kn: "ಈರುಳ್ಳಿ", mr: "कांदा", bn: "পেঁয়াজ", gu: "ડુંગળી", pa: "ਪਿਆਜ਼"
  },
  "soybean": {
    en: "Soybean", hi: "सोयाबीन", te: "సోయాబీన్", ta: "சோயாபீன்", kn: "ಸೋಯಾಬೀನ್", mr: "सोयाबीन", bn: "সয়াবিন", gu: "સોયાબીન", pa: "ਸੋਇਆਬੀਨ"
  },
  "groundnut": {
    en: "Groundnut", hi: "मूंगफली", te: "వేరుశనగ", ta: "வேர்க்கடலை", kn: "ಕಡಲೆಕಾಯಿ", mr: "भुईमूग", bn: "চীনাবাদাম", gu: "મગફળી", pa: "ਮੂੰਗਫਲੀ"
  },

  // Dashboard & Farmer Actions
  "complete your farmer profile": {
    en: "Complete Your Farmer Profile", hi: "अपनी किसान प्रोफ़ाइल पूरी करें", te: "మీ రైతు ప్రొఫైల్‌ను పూర్తి చేయండి", ta: "உங்கள் உழவர் சுயவிவரத்தை முடிக்கவும்", kn: "ನಿಮ್ಮ ರೈತ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ", mr: "तुमची शेतकरी प्रोफाइल पूर्ण करा", bn: "আপনার কৃষক প্রোফাইল সম্পূর্ণ করুন", gu: "તમારી ખેડૂત પ્રોફાઇલ પૂર્ણ કરો", pa: "ਆਪਣੀ ਕਿਸਾਨ ਪ੍ਰੋਫਾਈਲ ਪੂਰੀ ਕਰੋ"
  },
  "quick actions": {
    en: "Quick Actions", hi: "त्वरित कार्य", te: "త్వరిత చర్యలు", ta: "விரைவான செயல்கள்", kn: "ತ್ವರಿತ ಕ್ರಿಯೆಗಳು", mr: "त्वरित कृती", bn: "দ্রুত ক্রিয়া", gu: "ઝડપી ક્રિયાઓ", pa: "ਤੁਰੰਤ ਕਾਰਵਾਈਆਂ"
  },
  "add crop": {
    en: "Add Crop", hi: "फसल जोड़ें", te: "పంటను జోడించండి", ta: "பயிரைச் சேர்க்கவும்", kn: "ಬೆಳೆಯನ್ನು ಸೇರಿಸಿ", mr: "पीक जोडा", bn: "ফসল যোগ করুন", gu: "પાક ઉમેરો", pa: "ਫਸਲ ਸ਼ਾਮਲ ਕਰੋ"
  },
  "log expense": {
    en: "Log Expense", hi: "खर्च दर्ज करें", te: "ఖర్చును నమోదు చేయండి", ta: "செலவை பதிவு செய்யவும்", kn: "ವೆಚ್ಚವನ್ನು ದಾಖಲಿಸಿ", mr: "खर्च नोंदवा", bn: "খরচ নথিভুক্ত করুন", gu: "ખર્ચ નોંધો", pa: "ਖਰਚਾ ਦਰਜ ਕਰੋ"
  },
  "record harvest": {
    en: "Record Harvest", hi: "कटाई दर्ज करें", te: "దిగుబడిని నమోదు చేయండి", ta: "அறுவடை பதிவு செய்யவும்", kn: "ಕೊಯ್ಲು ದಾಖಲಿಸಿ", mr: "कापणी नोंदवा", bn: "ফসল কাটা রেকর্ড করুন", gu: "લણણી નોંધો", pa: "ਵਾਢੀ ਦਰਜ ਕਰੋ"
  },
  "sell harvest": {
    en: "Sell Harvest", hi: "फसल बेचें", te: "దిగుబడిని అమ్మండి", ta: "அறுவடை விற்கவும்", kn: "ಕೊಯ್ಲು ಮಾರಾಟ ಮಾಡಿ", mr: "कापणी विका", bn: "ফসল বিক্রি করুন", gu: "પાક વેચો", pa: "ਵਾਢੀ ਵੇਚੋ"
  },

  // Community Hub Aliases
  "groups": {
    en: "Groups", hi: "समूह", te: "సమూహాలు", ta: "குழுக்கள்", kn: "ಗುಂಪುಗಳು", mr: "गट", bn: "দলসমূহ", gu: "જૂથો", pa: "ਸਮੂਹ"
  },
  "search people by name or phone...": {
    en: "Search people by name or phone...", hi: "नाम या फोन से खोजें...", te: "పేరు లేదా ఫోన్ ద్వారా వెతకండి...", ta: "பெயர் அல்லது தொலைபேசி மூலம் தேடுங்கள்...", kn: "ಹೆಸರು ಅಥವಾ ಫೋನ್ ಮೂಲಕ ಹುಡುಕಿ...", mr: "नाव किंवा फोनद्वारे शोधा...", bn: "নাম বা ফোন দ্বারা অনুসন্ধান করুন...", gu: "નામ અથવા ફોન દ્વારા શોધો...", pa: "ਨਾਮ ਜਾਂ ਫੋਨ ਰਾਹੀਂ ਖੋਜੋ..."
  },
  "search results": {
    en: "Search Results", hi: "खोज परिणाम", te: "శోధన ఫలితాలు", ta: "தேடல் முடிவுகள்", kn: "ಹುಡುಕಾಟ ಫಲಿತಾಂಶಗಳು", mr: "शोध निकाल", bn: "অনুসন্ধান ফলাফল", gu: "શોધ પરિણામો", pa: "ਖੋਜ ਨਤੀਜੇ"
  },
  "← back to chats": {
    en: "← Back to Chats", hi: "← चैट पर वापस जाएं", te: "← చాట్‌లకు తిరిగి వెళ్ళండి", ta: "← அரட்டைகளுக்குத் திரும்பு", kn: "← ಚಾಟ್‌ಗಳಿಗೆ ಹಿಂತಿರುಗಿ", mr: "← चॅट्सवर परत जा", bn: "← চ্যাটে ফিরে যান", gu: "← ચેટ્સ પર પાછા જાઓ", pa: "← ਚੈਟਾਂ 'ਤੇ ਵਾਪਸ ਜਾਓ"
  },
  "searching users...": {
    en: "Searching users...", hi: "उपयोगकर्ताओं को खोजा जा रहा है...", te: "వినియోగదారులను వెతుకుతోంది...", ta: "பயனர்களைத் தேடுகிறது...", kn: "ಬಳಕೆದಾರರನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ...", mr: "वापरकर्ते शोधत आहे...", bn: "ব্যবহারকারী খোঁজা হচ্ছে...", gu: "વપરાશકર્તાઓને શોધી રહ્યું છે...", pa: "ਉਪਭੋਗਤਾਵਾਂ ਦੀ ਖੋਜ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ..."
  },
  "no users found matching your search.": {
    en: "No users found matching your search.", hi: "आपकी खोज से कोई उपयोगकर्ता नहीं मिला।", te: "మీ శోధనకు సరిపోలే వినియోగదారులు కనుగొనబడలేదు.", ta: "உங்கள் தேடலுடன் பொருந்தும் பயனர்கள் இல்லை.", kn: "ನಿಮ್ಮ ಹುಡುಕಾಟಕ್ಕೆ ಯಾವುದೇ ಬಳಕೆದಾರರು ಸಿಗಲಿಲ್ಲ.", mr: "कोणताही वापरकर्ता सापडला नाही.", bn: "কোনো ব্যবহারকারী পাওয়া যায়নি।", gu: "કોઈ વપરાશકર્તા મળ્યા નથી.", pa: "ਕੋਈ ਉਪਭੋਗਤਾ ਨਹੀਂ ਮਿਲਿਆ।"
  },
  "agri experts": {
    en: "Agri Experts", hi: "कृषि विशेषज्ञ", te: "వ్యవసాయ నిపుణులు", ta: "வேளாண் நிபுணர்கள்", kn: "ಕೃಷಿ ತಜ್ಞರು", mr: "कृषी तज्ज्ञ", bn: "কৃষি বিশেষজ্ঞ", gu: "કૃષિ નિષ્ણાતો", pa: "ਖੇਤੀ ਮਾਹਿਰ"
  },
};

// ── Helper: Deep key access with alias resolution ───────────────────────────

function getNestedValue(obj: any, keyPath: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const keys = keyPath.split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return typeof current === "string" ? current : undefined;
}

function resolveKey(obj: any, keyPath: string): string | undefined {
  if (!obj) return undefined;
  // 1. Direct path lookup
  let val = getNestedValue(obj, keyPath);
  if (val) return val;

  // 2. Alias: community.* <-> communityHub.*
  if (keyPath.startsWith("community.")) {
    val = getNestedValue(obj, keyPath.replace("community.", "communityHub."));
    if (val) return val;
  } else if (keyPath.startsWith("communityHub.")) {
    val = getNestedValue(obj, keyPath.replace("communityHub.", "community."));
    if (val) return val;
  }

  // 3. Alias: weather telemetry
  if (keyPath.startsWith("weatherTelemetry.")) {
    val = getNestedValue(obj, keyPath.replace("weatherTelemetry.", "weather."));
    if (val) return val;
  }

  return undefined;
}

export function getCommonTranslation(keyOrText: string, fallback?: string, locale: SupportedLocale = "en"): string | undefined {
  if (locale === "en") return undefined;

  const lookupKey = (fallback || keyOrText).toLowerCase().trim();
  const directMatch = COMMON_TRANSLATIONS[lookupKey];
  if (directMatch && directMatch[locale]) {
    return directMatch[locale];
  }

  const keyWithoutPrefix = keyOrText.includes(".") ? keyOrText.split(".").pop()?.toLowerCase().trim() : undefined;
  if (keyWithoutPrefix && COMMON_TRANSLATIONS[keyWithoutPrefix] && COMMON_TRANSLATIONS[keyWithoutPrefix][locale]) {
    return COMMON_TRANSLATIONS[keyWithoutPrefix][locale];
  }

  return undefined;
}

// ── Context ──────────────────────────────────────────────────────────────────

interface LanguageContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, fallback?: string) => string;
  languages: LanguageInfo[];
  currentLanguage: LanguageInfo;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key: string) => key,
  languages: LANGUAGES,
  currentLanguage: LANGUAGES[0],
});

// ── Provider ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "agri_language";

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>("en");
  const [isHydrated, setIsHydrated] = useState(false);

  // Load saved locale from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as SupportedLocale | null;
    if (saved && LOCALE_MAP[saved]) {
      setLocaleState(saved);
    }
    setIsHydrated(true);
  }, []);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    if (LOCALE_MAP[newLocale]) {
      setLocaleState(newLocale);
      localStorage.setItem(STORAGE_KEY, newLocale);
      // Update the html lang attribute
      document.documentElement.lang = newLocale;
    }
  }, []);

  // Translation function: looks up key in current locale, falls back to English
  const t = useCallback(
    (key: string, fallback?: string): string => {
      if (locale === "en") {
        const enVal = resolveKey(en, key);
        return enVal || fallback || key;
      }

      // 1. Try current locale dictionary
      const localDict = LOCALE_MAP[locale];
      const translated = resolveKey(localDict, key);
      if (translated) return translated;

      // 2. Check built-in common agricultural terms
      const common = getCommonTranslation(key, fallback, locale);
      if (common) return common;

      // 3. Fall back to English dictionary
      const enTranslated = resolveKey(en, key);
      if (enTranslated) return enTranslated;

      // 4. Fall back to the provided fallback or the key itself
      return fallback || key;
    },
    [locale]
  );

  const currentLanguage = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  const contextValue = {
    locale: isHydrated ? locale : "en",
    setLocale,
    t: isHydrated ? t : (key: string, fallback?: string) => resolveKey(en, key) || fallback || key,
    languages: LANGUAGES,
    currentLanguage: isHydrated ? currentLanguage : LANGUAGES[0],
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useLanguage = () => useContext(LanguageContext);
