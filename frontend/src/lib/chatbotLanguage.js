const ROMAN_MARATHI_MARKERS = /\b(aahe|ahe|kuthe|kothe|kasa|kashi|mala|amha|krupaya|milte|kay|sanga|sang|kontha|konti|che|cha|chi)\b/i;
const ROMAN_HINDI_MARKERS = /\b(hai|hain|kahan|kahaan|kaise|kaisi|mujhe|hamare|kripya|bataye|bataiye|kya|kaun|chahiye|batao|ka|ke|ki)\b/i;
const ENGLISH_MARKERS = /\b(the|is|are|what|where|how|can|do|does|your|you|we|with|for|about|please|tell|show|list|give|current|available)\b/i;

function containsScriptMarker(value, markers) {
  const words = new Set(value.match(/[\p{L}\p{M}]+/gu) || []);
  return markers.some((marker) => words.has(marker)
    || (marker.length >= 4 && [...words].some((word) => word.startsWith(marker))));
}

export function getBrowserChatLanguage(locale = typeof navigator !== 'undefined' ? navigator.language : 'en') {
  const language = String(locale || 'en').toLowerCase().split(/[-_]/)[0];
  return language === 'hi' || language === 'mr' ? language : 'en';
}

export function detectChatLanguage(message, preferredLanguage = getBrowserChatLanguage()) {
  const value = String(message || '').trim();
  if (/[\u0900-\u097f]/u.test(value)) {
    if (containsScriptMarker(value, ['आहे', 'आहेत', 'कुठे', 'कोठे', 'कसे', 'कशी', 'माझे', 'माझी', 'माझा', 'माझं', 'आपली', 'आपला', 'आम्हाला', 'मिळेल', 'करू', 'काय', 'सदस्यत्व', 'सांगा', 'बद्दल', 'विषयी'])) return 'mr';
    if (containsScriptMarker(value, ['है', 'हैं', 'कहाँ', 'कहां', 'कैसे', 'कैसी', 'मुझे', 'हमारे', 'मिलता', 'बताएं', 'बताइए', 'बताओ', 'क्या', 'सदस्यता', 'चाहिए', 'मेंबरशिप', 'मेम्बरशिप'])) return 'hi';
    return preferredLanguage === 'mr' ? 'mr' : 'hi';
  }
  if (ROMAN_MARATHI_MARKERS.test(value)) return 'mr';
  if (ROMAN_HINDI_MARKERS.test(value)) return 'hi';
  if (ENGLISH_MARKERS.test(value)) return 'en';
  return preferredLanguage;
}
