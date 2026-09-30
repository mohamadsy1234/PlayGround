/**
 * Language Detection Module
 * Detects Arabic (Darija/Fus'ha), French, English
 */

class Language {
  static ARABIC = 'arabic';
  static FRENCH = 'french';
  static ENGLISH = 'english';
}

class LanguageDetector {
  constructor() {
    // Arabic character range [؀-ۿ]
    this._ARABIC_RE = /[؀-ۿ]+/g;
    this.FRENCH_HINTS = new Set(['bonjour', 'salut', 'merci', 'monsieur', 'madame', 'permis', 'carte']);
    this.ENGLISH_HINTS = new Set(['hello', 'hi', 'thank', 'please', 'license', 'card', 'passport']);
  }

  detect(text) {
    if (!text || text.length === 0) return Language.ARABIC; // default
    
    // Priority 1: Check for Arabic characters
    const arabicMatches = text.match(this._ARABIC_RE);
    if (arabicMatches && arabicMatches.length > 0) {
      const arabicRatio = arabicMatches.join('').length / text.length;
      if (arabicRatio > 0.3) return Language.ARABIC;
    }

    // Priority 2: Check French hints
    const lowerText = text.toLowerCase();
    let frenchCount = 0;
    for (const hint of this.FRENCH_HINTS) {
      if (lowerText.includes(hint)) frenchCount++;
    }
    if (frenchCount >= 2) return Language.FRENCH;

    // Priority 3: Check English hints
    let englishCount = 0;
    for (const hint of this.ENGLISH_HINTS) {
      if (lowerText.includes(hint)) englishCount++;
    }
    if (englishCount >= 2) return Language.ENGLISH;

    // Default to Arabic if mixed or unclear
    return Language.ARABIC;
  }
}
