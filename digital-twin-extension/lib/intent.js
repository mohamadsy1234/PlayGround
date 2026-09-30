/**
 * Intent Extraction Module
 * Extracts country, document type, and objections from customer messages
 */

class IntentExtractor {
  constructor() {
    this.COUNTRY_KEYWORDS = {
      'italy': ['italy', 'italie', 'italian', 'طاليان', 'إيطاليا', 'ايطاليا', 'إيطالي', 'ايطالي'],
      'france': ['france', 'français', 'francais', 'french', 'فرانسا', 'فرنسا', 'فرنسي', 'فرنسيه'],
      'belgium': ['belgique', 'belgium', 'belge', 'بلجيكا', 'بلجيكي', 'بلجيكيه'],
      'spain': ['españa', 'espana', 'spain', 'espagne', 'spanish', 'إسبانيا', 'اسبانيا', 'إسباني'],
      'germany': ['germany', 'allemagne', 'deutsch', 'ألمانيا', 'المانيا', 'ألماني'],
      'holland': ['netherlands', 'holland', 'pays-bas', 'holanda', 'هولندا', 'هولندي']
    };

    this.DOC_KEYWORDS = {
      'driving_license': ['license', 'permis', 'بيرمي', 'برمي', 'driving', 'رخصة القيادة', 'رخصة', 'رخصه', 'بيرميس', 'السياقة'],
      'residency_card': ['residency', 'titre de séjour', 'titre de sejour', 'resident', 'sejour', 'بطاقة إقامة', 'بطاقه', 'إقامة', 'اقامة', 'سجيل', 'تسجيل', 'كارت', 'لاكارت', 'تيتر'],
      'passport': ['passport', 'passeport', 'جواز', 'باسبور', 'باسبورت', 'جواز سفر'],
      'visa': ['visa', 'تأشيرة', 'تاشيرة', 'ڤيزا', 'فيزا'],
      'id_card': ['id', 'carte d\'identité', 'carte d\'identite', 'identity', 'بطاقة هوية', 'بطاقه', 'كرتة', 'كارت', 'لاكارت', 'سينية']
    };

    this.OBJECTION_HINTS = {
      'price': ['expensive', 'cher', 'trop', 'غالي', 'بزاف', 'سعر', 'تمن', 'كتاع', 'السومة', 'سومة'],
      'hesitation': ['maybe', 'peut-être', 'peut-etre', 'je réfléchis', 'ربما', 'لا أعرف', 'ما شنو', 'نفكر', 'نشوف', 'بغيت نسقسي', 'نسقسي'],
      'trust': ['fake', 'faux', 'scam', 'arnaque', 'تزوير', 'غش', 'شنو الضمان', 'الضمان', 'ثقة', 'مضمون'],
      'quality': ['quality', 'qualité', 'qualite', 'جودة', 'شنو النتيجة', 'شنو الفايدة', 'النموذج', 'نشوف']
    };
  }

  extractIntent(text) {
    if (!text) return [null, null];
    const lowerText = text.toLowerCase();

    let country = null;
    let doc = null;

    // Extract country
    for (const [c, keywords] of Object.entries(this.COUNTRY_KEYWORDS)) {
      for (const kw of keywords) {
        if (lowerText.includes(kw)) {
          country = c;
          break;
        }
      }
      if (country) break;
    }

    // Extract document type
    for (const [d, keywords] of Object.entries(this.DOC_KEYWORDS)) {
      for (const kw of keywords) {
        if (lowerText.includes(kw)) {
          doc = d;
          break;
        }
      }
      if (doc) break;
    }

    return [country, doc];
  }

  isAgreement(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    const positiveHints = ['yes', 'oui', 'ok', 'okay', 'd\'accord', 'نعم', 'أيه', 'واعر', 'ديريها', 'تمم', 'صافي', 'واخا', 'متافق', 'مزيان', 'تمام'];
    for (const hint of positiveHints) {
      if (lowerText.includes(hint)) return true;
    }
    return false;
  }

  detectObjection(text) {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    for (const [type, keywords] of Object.entries(this.OBJECTION_HINTS)) {
      for (const kw of keywords) {
        if (lowerText.includes(kw)) return type;
      }
    }
    return null;
  }

  extractMTCN(text) {
    if (!text) return null;
    // Ria MTCN: typically 8-16 digits
    const match = text.match(/\b\d{8,16}\b/);
    return match ? match[0] : null;
  }

  looksLikeCustomerData(text) {
    if (!text || text.length < 20) return false;
    // Check for date pattern (dd/mm/yyyy or similar)
    const hasDate = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text);
    return hasDate || text.length > 30;
  }
}
