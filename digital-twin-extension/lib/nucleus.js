/**
 * Digital Twin Core State Machine
 * JavaScript port of Python nucleus.py
 */

class DigitalTwinCore {
  static STATES = {
    INIT: 'INIT',
    GREETED: 'GREETED',
    OFFERED_SAMPLE: 'OFFERED_SAMPLE',
    SAMPLE_SENT: 'SAMPLE_SENT',
    TERMS_EXPLAINED: 'TERMS_EXPLAINED',
    AWAITING_DEPOSIT: 'AWAITING_DEPOSIT',
    DEPOSIT_VERIFIED: 'DEPOSIT_VERIFIED',
    PREVIEW_SENT: 'PREVIEW_SENT',
    AWAITING_FINAL_PAY: 'AWAITING_FINAL_PAY',
    SHIPPED: 'SHIPPED',
    HUMAN_HANDOFF: 'HUMAN_HANDOFF'
  };

  static PRICING = {
    'driving_license': { total: 250, deposit: 100 },
    'residency_card': { total: 280, deposit: 100 },
    'passport': { total: 350, deposit: 150 },
    'visa': { total: 400, deposit: 150 },
    'id_card': { total: 200, deposit: 100 }
  };

  static DRIVE_CATALOG = {
    'italy_driving_license': 'https://drive.google.com/...',
    'italy_residency_card': 'https://drive.google.com/...',
    // ... more entries
  };

  constructor() {
    this.languageDetector = new LanguageDetector();
    this.intentExtractor = new IntentExtractor();
  }

  onTextMessage(session, text) {
    const language = this.languageDetector.detect(text);
    const [country, doc] = this.intentExtractor.extractIntent(text);
    const mtcn = this.intentExtractor.extractMTCN(text);

    let reply = null;

    switch (session.state) {
      case DigitalTwinCore.STATES.INIT: {
        // الزبون دخل مباشرة في الموضوع → جاوب مباشرة بلا تحية فارغة
        const [firstCountry, firstDoc] = this.intentExtractor.extractIntent(text);
        if (firstCountry && firstDoc) {
          session.requested_country = firstCountry;
          session.requested_doc = firstDoc;
          reply = this._offerSample(session, firstCountry, firstDoc);
        } else {
          reply = this._handleInit(session, language);
        }
        break;
      }
      case DigitalTwinCore.STATES.AWAITING_DEPOSIT:
        if (mtcn) {
          session.deposit_ria_mtcn = mtcn;
          reply = new Reply('deposit_submitted', '✓ شكراً! ننتظر التحقق من التحويل');
        } else {
          reply = new Reply('clarify_deposit', 'من فضلك أرسل صورة الإيصال أو الرقم');
        }
        break;
      case DigitalTwinCore.STATES.AWAITING_FINAL_PAY:
        if (mtcn) {
          session.final_ria_mtcn = mtcn;
          reply = new Reply('final_pay_received', '✓ تم استلام الدفعة النهائية');
        } else {
          reply = new Reply('clarify_final', 'من فضلك أرسل إيصال الدفعة الأخيرة والعنوان');
        }
        break;
      default:
        // MTCN مبكر (الزبون لصق رقم الحوالة قبل طلبها) → اعتبره دفعة مقدمة
        if (mtcn) {
          session.deposit_ria_mtcn = mtcn;
          session.state = DigitalTwinCore.STATES.AWAITING_DEPOSIT;
          reply = new Reply('deposit_submitted', '✓ شكراً! توصلنا بالرقم، ننتظر التحقق من التحويل ونرجع لك');
          break;
        }
        // اعتراضات شائعة → رد مطمئن يحافظ على الصفقة بدل "غير واضح"
        const objection = this.intentExtractor.detectObjection(text);
        if (objection) {
          reply = this._handleObjection(session, objection);
          break;
        }
        if (country && doc) {
          session.requested_country = country;
          session.requested_doc = doc;
          reply = this._offerSample(session, country, doc);
        } else if (country && !doc) {
          session.requested_country = country;
          reply = new Reply('clarify_doc', 'تمام، نخدمو ' + country + ' ✓ شنو اللي محتاج بالضبط؟ رخصة سياقة، بطاقة إقامة، جواز، ولا كارت؟');
        } else if (!country && doc) {
          session.requested_doc = doc;
          reply = new Reply('clarify_country', 'تمام، نخدمو هذ الوثيقة ✓ لأي دولة بغيتيها؟ إيطاليا، فرنسا، بلجيكا، إسبانيا؟');
        } else if (this.intentExtractor.isAgreement(text)) {
          if (session.requested_country && session.requested_doc) {
            reply = this._explainDeposit(session);
          } else {
            reply = new Reply('ask_need', 'مزيان! قولي شنو الدولة وشنو الوثيقة اللي بغيتي ونكمل لك الإجراءات');
          }
        } else {
          reply = new Reply('unclear', 'معك سؤال أكثر وضوح؟');
        }
    }

    return reply;
  }

  onMediaMessage(session, mediaType, mediaUrl) {
    if (mediaType === 'image') {
      if (session.state === DigitalTwinCore.STATES.AWAITING_DEPOSIT) {
        // OCR processing would happen here (backend integration)
        return new Reply('image_received', 'تم استلام الصورة، قيد التحقق...');
      }
    }
    return new Reply('media_received', '✓ تم استلام الملف');
  }

  onDepositVerified(session) {
    session.state = DigitalTwinCore.STATES.DEPOSIT_VERIFIED;
    return new Reply('preview_generation', 'جاري تحضير المعاينة...');
  }

  onPreviewGenerated(session, previewUrl) {
    session.state = DigitalTwinCore.STATES.PREVIEW_SENT;
    return new Reply('preview_ready', `إليك المعاينة: ${previewUrl}\nتمام؟ أرسل باقي المبلغ (${this._getRemainingAmount(session)}€)`);
  }

  onShipped(session, trackingNumber) {
    session.state = DigitalTwinCore.STATES.SHIPPED;
    return new Reply('shipping_confirmed', `✓ شُحن! رقم التتبع: ${trackingNumber}`);
  }

  // Private helpers
  _handleInit(session, language) {
    session.state = DigitalTwinCore.STATES.GREETED;
    if (language === Language.ARABIC) {
      return new Reply('greeting_ar', 'السلام عليكم! شنو اخبارك؟ بالمساعدة بالوثائق الأوروبية');
    } else if (language === Language.FRENCH) {
      return new Reply('greeting_fr', 'Bonjour! Je peux t\'aider avec les documents européens');
    }
    return new Reply('greeting_en', 'Hello! How can I help with European documents?');
  }

  _offerSample(session, country, doc) {
    session.state = DigitalTwinCore.STATES.OFFERED_SAMPLE;
    const catalogKey = `${country}_${doc}`;
    const sampleUrl = DigitalTwinCore.DRIVE_CATALOG[catalogKey] || 'https://drive.google.com/...';
    return new Reply('sample_offered', `إليك مثال: ${sampleUrl}\nالسعر: ${DigitalTwinCore.PRICING[doc]?.total}€`);
  }

  _explainDeposit(session) {
    session.state = DigitalTwinCore.STATES.AWAITING_DEPOSIT;
    const pricing = DigitalTwinCore.PRICING[session.requested_doc];
    const total = pricing ? pricing.total : 250;
    const deposit = pricing ? pricing.deposit : 100;
    return new Reply('terms_explained', `تمام! السومة ${total}€: تبعث ${deposit}€ مقدم عبر Ria، والباقي (${total - deposit}€) بعد ما تشوف المعاينة وتتأكد. صافي؟ أرسل الإيصال ولا رقم MTCN`);
  }

  _handleObjection(session, objection) {
    const pricing = session.requested_doc ? DigitalTwinCore.PRICING[session.requested_doc] : null;
    const deposit = pricing ? pricing.deposit : 100;
    switch (objection) {
      case 'price':
        return new Reply('objection_price', `فاهمك أخويا، على هذاك الشي الدفع على جوج مراحل: غير ${deposit}€ مقدم، والباقي حتى تشوف بعينيك وتتأكد. ما كتخسر والو`);
      case 'trust':
        return new Reply('objection_trust', 'سؤال في محلو! شوف النموذج الأول، والدفع المقدم غير جزء صغير، والباقي بعد المعاينة. زيد سقسي اللي تعاملو معانا');
      case 'hesitation':
        return new Reply('objection_hesitation', 'خود وقتك أخويا، أنا هنا. إلا بغيتي نشرح لك المراحل بالتفصيل قولي');
      case 'quality':
        return new Reply('objection_quality', 'الجودة مضمونة: غادي تشوف فيديو النموذج قبل ما تخلص الباقي. إلا ما عجبكش، ما كتكملش');
      default:
        return new Reply('unclear', 'معك سؤال أكثر وضوح؟');
    }
  }

  _getRemainingAmount(session) {
    if (!session.requested_doc) return '150';
    const pricing = DigitalTwinCore.PRICING[session.requested_doc];
    return pricing ? pricing.total - pricing.deposit : 150;
  }
}

class Reply {
  constructor(type, text, delay = null) {
    this.type = type;
    this.text = text;
    this.delay = delay || 3000; // milliseconds
  }
}
