"""
Multilingual Translation Engine for Palmora AI
Enables palm reading reports and consultations to be translated into any language,
supporting both LLM-augmented poetic translations and deterministic cultural wisdom fallbacks.
"""

import json
import logging
from typing import Dict, Any, Optional
from ..schemas.readings import PalmReadingReport, ReadingSection
from ..config import settings
from .llm_provider import call_llm_for_reading

logger = logging.getLogger(__name__)

# Canonical language names mapping
LANGUAGE_NAMES: Dict[str, str] = {
    "en": "English",
    "hinglish": "Hinglish (Hindi in Roman script)",
    "hi": "Hindi (हिन्दी)",
    "es": "Spanish (Español)",
    "fr": "French (Français)",
    "de": "German (Deutsch)",
    "it": "Italian (Italiano)",
    "pt": "Portuguese (Português)",
    "ja": "Japanese (日本語)",
    "zh": "Chinese (Simplified) (简体中文)",
    "ar": "Arabic (العربية)",
    "ru": "Russian (Русский)",
    "ko": "Korean (한국어)",
    "bn": "Bengali (বাংলা)",
    "mr": "Marathi (मराठी)",
    "te": "Telugu (తెలుగు)",
    "ta": "Tamil (தமிழ்)",
    "gu": "Gujarati (ગુજરાતી)",
    "tr": "Turkish (Türkçe)",
    "nl": "Dutch (Nederlands)",
    "vi": "Vietnamese (Tiếng Việt)",
    "pl": "Polish (Polski)",
    "id": "Indonesian (Bahasa Indonesia)"
}

TRANSLATION_SYSTEM_PROMPT = """You are Palmora AI's Chief Multilingual Palmistry Narrator & Cultural Translator.
Your role is to translate structured palmistry readings and contemplative reflections into the user's chosen language.

STRICT PRINCIPLES:
1. Translate all textual interpretations, reflective prompts, synthesis, and titles with poetic beauty, cultural nuance, and emotional resonance.
2. Maintain strict fidelity to the original meaning and tone: respectful, contemplative, and empowering.
3. Preserve all structured identifiers, crease feature names, and status codes.
4. Palmistry is for cultural appreciation, entertainment, and mindful self-inquiry—NEVER introduce deterministic predictions or medical claims.
5. Return strictly valid JSON adhering to the specified schema.
"""

TRANSLATION_SCHEMA_INSTRUCTIONS = """Return JSON with this exact structure:
{
  "reading_title": "Translated poetic title",
  "love_title": "Translated love section title",
  "love_interpretation": "Translated heart line traditional interpretation",
  "love_prompts": ["Translated reflective prompt 1", "Translated reflective prompt 2"],
  "love_confidence_note": "Translated visual confidence statement",
  "career_title": "Translated career section title",
  "career_interpretation": "Translated head line traditional interpretation",
  "career_prompts": ["Translated reflective prompt 1", "Translated reflective prompt 2"],
  "career_confidence_note": "Translated visual confidence statement",
  "personality_title": "Translated vitality section title",
  "personality_interpretation": "Translated life line traditional interpretation",
  "personality_prompts": ["Translated reflective prompt 1", "Translated reflective prompt 2"],
  "personality_confidence_note": "Translated visual confidence statement",
  "overall_synthesis": "Translated holistic synthesis",
  "disclaimer": "Translated mandatory ethical and entertainment notice"
}
"""

# Deterministic Fallback Dictionaries for major languages
DETERMINISTIC_TRANSLATIONS: Dict[str, Dict[str, Any]] = {
    "hinglish": {
        "reading_title": "Intuition aur Purpose ki Sanrachna (Antargyan aur Lakshya ka Mel)",
        "love_title": "Heart Line: Emotional Expression aur Harmony",
        "love_interpretation": (
            "Traditional Samudrika Shastra aur Hastarekha parampara ke anusaar, aapki Heart Line aapki emotional depth, "
            "relationships mein empathy aur genuine warmth ko darshati hai. Yeh line show karti hai ki aap doosron ke saath "
            "kaise connect karte hain, unhe kitna respect dete hain aur rishton mein loyalty aur healthy personal boundaries "
            "kaise maintain karte hain."
        ),
        "love_prompts": [
            "Aap daily life mein apni feelings aur appreciation ko kitni clarity se express karte hain?",
            "Kaunse relationships aapko sabse zyada inner peace aur positive energy provide karte hain?",
            "Apne close ones ke saath healthy emotional balance maintain karne ke liye aap kya practice karte hain?"
        ],
        "love_confidence_note": "Visual crease analysis par aadharit symbolic aur reflective interpretation.",
        "career_title": "Head Line: Focus, Strategy aur Curiosity",
        "career_interpretation": (
            "Aapki Head Line aapke intellectual style, strategic problem-solving aur logical clarity ko represent karti hai. "
            "Yeh darshati hai ki aap complex challenges ko step-by-step kaise analyze karte hain, naye ideas ko kitni tezi se "
            "grasp karte hain aur practical logic aur intuitive gut feeling ke beech kaise harmonious balance banate hain."
        ),
        "career_prompts": [
            "Current time mein kaunse projects ya challenges aapke intellect aur skills ko sabse zyada inspire karte hain?",
            "Aap deep analysis aur timely execution ke beech balance kaise banate hain?",
            "Apne long-term vocational goals achieve karne ke liye aapka sabse bada focus area kya hai?"
        ],
        "career_confidence_note": "Mid-palm crease contour aur trajectory par aadharit strategic insight.",
        "personality_title": "Life Line: Vitality, Pacing aur Equilibrium",
        "personality_interpretation": (
            "Samudrika Shastra ke anusaar, Life Line lifespan ya aayu ki prediction nahi karti, balki yeh aapki vital energy, "
            "daily stamina aur life ke changing seasons mein resilience ka symbolic reflection hai. Yeh batati hai ki aap "
            "intense hard work aur intentional restorative rest ke beech healthy rhythm kaise maintain karte hain."
        ),
        "personality_prompts": [
            "Busy schedule mein apni physical aur mental energy ko recharge karne ke liye aap kya rituals follow karte hain?",
            "Aapka daily routine work productivity aur mindful relaxation ke beech kitna balanced hai?",
            "Kaunse daily grounding habits aapko sabse zyada inner stability aur peace of mind dete hain?"
        ],
        "personality_confidence_note": "Thenar radial crease par aadharit lifestyle aur energy pacing reflection.",
        "overall_synthesis": (
            "Aapki palm geometry emotional warmth aur analytical intellect ka ek thoughtful sangam darshati hai. "
            "Hastarekha parampara ke mutabik, yeh major lines aapki inner potential aur conscious choices ka reflective map hain—"
            "jo aapko apne self-belief ko pehchanne aur personal tatha professional life mein harmonious balance create karne ke liye empower karti hain."
        ),
        "disclaimer": (
            "Palmora AI readings cultural, symbolic aur contemplative reflections hain jo self-discovery aur entertainment ke liye banayi gayi hain. "
            "Yeh future events ki deterministic prediction nahi karti aur professional, financial ya medical advice ka substitute nahi hain."
        )
    },
    "hi": {
        "reading_title": "अंतर्ज्ञान और उद्देश्य की संरचना",
        "love_title": "हृदय रेखा: भावनात्मक अभिव्यक्ति और सामंजस्य",
        "love_interpretation": (
            "पारंपरिक हस्तरेखा शास्त्र (सामुद्रिक शास्त्र) में, आपकी हृदय रेखा आपकी भावनात्मक गहराई और "
            "संबंधों में संवेदनशीलता को दर्शाती है। यह आपके दूसरों के साथ जुड़ने, सहानुभूति व्यक्त करने "
            "और आंतरिक शांति बनाए रखने की क्षमता का प्रतीक है।"
        ),
        "love_prompts": [
            "आप अपने दैनिक जीवन में अपनी भावनाओं को कितनी स्पष्टता से व्यक्त करते हैं?",
            "कौन से संबंध आपको सबसे अधिक ऊर्जा और शांति प्रदान करते हैं?"
        ],
        "love_confidence_note": "हस्तरेखा विश्लेषण पारंपरिक सांस्कृतिक प्रतीकों पर आधारित है।",
        "career_title": "मस्तिष्क रेखा: ध्यान, रणनीति और जिज्ञासा",
        "career_interpretation": (
            "आपकी मस्तिष्क रेखा बौद्धिक स्पष्टता, रणनीतिक योजना और समस्याओं को सुलझाने की मौलिक क्षमता "
            "का प्रतिनिधित्व करती है। यह सीखने की निरंतर इच्छा और विवेकपूर्ण निर्णय लेने के दृष्टिकोण का संकेत देती है।"
        ),
        "career_prompts": [
            "वर्तमान में कौन सी चुनौतियाँ आपकी मानसिक क्षमताओं को सबसे अधिक प्रेरित करती हैं?",
            "आप विश्लेषणात्मक तर्क और सहज ज्ञान के बीच संतुलन कैसे बनाते हैं?"
        ],
        "career_confidence_note": "अवलोकित रेखा विशेषताओं के आधार पर तैयार किया गया विचारशील विश्लेषण।",
        "personality_title": "जीवन रेखा: जीवन शक्ति, गति और संतुलन",
        "personality_interpretation": (
            "जीवन रेखा आपकी शारीरिक ऊर्जा की गति, सहनशक्ति और व्यक्तिगत जीवनशैली के संतुलन का प्रतीक है। "
            "यह भविष्य की अवधि की भविष्यवाणी नहीं है, बल्कि विश्राम और सक्रियता के बीच एक स्वस्थ संतुलन "
            "बनाए रखने का एक सांस्कृतिक मार्गदर्शन है।"
        ),
        "personality_prompts": [
            "आप थकान और तनाव के समय अपनी ऊर्जा को कैसे पुनः प्राप्त करते हैं?",
            "आपकी दिनचर्या में विश्राम और उत्पादकता का क्या अनुपात है?"
        ],
        "personality_confidence_note": "जीवन रेखा का विश्लेषण जीवनशैली और ऊर्जा संतुलन का सांस्कृतिक प्रतीक है।",
        "overall_synthesis": (
            "आपकी हस्तरेखा भावनात्मक संवेदनशीलता और बौद्धिक गहराई का एक सुंदर संगम प्रकट करती है। "
            "यह प्राचीन ज्ञान आपको अपने आत्म-विश्वास को पहचानने और सार्थक जीवन जीने के लिए प्रेरित करता है।"
        ),
        "disclaimer": (
            "पामोरा एआई (Palmora AI) पाठ सांस्कृतिक और प्रतीकात्मक चिंतन के लिए हैं। "
            "ये भविष्य की घटनाओं की गारंटी नहीं हैं और पेशेवर, वित्तीय या चिकित्सा परामर्श का विकल्प नहीं हैं।"
        )
    },
    "es": {
        "reading_title": "La Arquitectura de la Intuición y el Propósito",
        "love_title": "Línea del Corazón: Expresión Emocional y Armonía",
        "love_interpretation": (
            "En la quiromancia tradicional, la línea del corazón simboliza tu capacidad para conectar "
            "con empatía, gestionar tus relaciones afectivas y cultivar la autenticidad interpersonal. "
            "Refleja una naturaleza generosa que valora los vínculos profundos y leales."
        ),
        "love_prompts": [
            "¿Cómo comunicas tus necesidades emocionales con tus seres queridos?",
            "¿Qué relaciones nutren más tu serenidad y crecimiento interior?"
        ],
        "love_confidence_note": "Interpretación cultural basada en las características visuales observadas.",
        "career_title": "Línea de la Cabeza: Enfoque, Estrategia y Curiosidad",
        "career_interpretation": (
            "La línea de la cabeza refleja tu estilo intelectual, tu enfoque estratégico ante los desafíos "
            "y tu capacidad para innovar. Indica una mente inquisitiva que valora tanto la claridad lógica "
            "como la perspectiva intuitiva."
        ),
        "career_prompts": [
            "¿Qué proyectos profesionales despiertan tu mayor entusiasmo actualmente?",
            "¿Cómo equilibras el análisis minucioso con la acción oportuna?"
        ],
        "career_confidence_note": "Mediciones visuales analizadas con prudencia interpretativa.",
        "personality_title": "Línea de la Vida: Vitalidad, Ritmo y Equilibrio",
        "personality_interpretation": (
            "La línea de la vida simboliza tu ritmo de vitalidad, resistencia y equilibrio biopsicosocial. "
            "No predice la duración de la vida, sino que invita a honrar tus ciclos de trabajo, "
            "descanso consciente y nutrición personal."
        ),
        "personality_prompts": [
            "¿Qué hábitos restauran mejor tu vitalidad ante temporadas exigentes?",
            "¿Cómo cuidas tus límites de energía en el día a día?"
        ],
        "personality_confidence_note": "Símbolo cultural de ritmo personal y cuidado de la vitalidad.",
        "overall_synthesis": (
            "Tu palma revela un diálogo armónico entre la calidez afectiva y la lucidez estratégica. "
            "La quiromancia clásica celebra esta arquitectura como una brújula para vivir con propósito y coherencia."
        ),
        "disclaimer": (
            "Las lecturas de Palmora AI son interpretaciones culturales y simbólicas destinadas a la contemplación "
            "y el entretenimiento. No sustituyen el asesoramiento médico, psicológico o financiero."
        )
    },
    "fr": {
        "reading_title": "L'Architecture de l'Intuition et du Destin",
        "love_title": "Ligne de Cœur : Harmonie Émotionnelle et Sensibilité",
        "love_interpretation": (
            "Dans la chiromancie classique, votre ligne de cœur traduit la délicatesse de votre monde affectif, "
            "votre générosité naturelle et votre désir de connexions humaines authentiques et respectueuses."
        ),
        "love_prompts": [
            "De quelle manière exprimez-vous vos sentiments les plus profonds ?",
            "Quels liens renforcent véritablement votre sérénité intérieure ?"
        ],
        "love_confidence_note": "Interprétation culturelle établie d'après les plis observés.",
        "career_title": "Ligne de Tête : Clarté Intellectuelle et Stratégie",
        "career_interpretation": (
            "Votre ligne de tête incarne la vivacité d'esprit, la vision stratégique et la curiosité créative. "
            "Elle suggère une aptitude à transformer des idées complexes en réalisations concrètes."
        ),
        "career_prompts": [
            "Quels défis professionnels stimulent le plus votre réflexion en ce moment ?",
            "Comment cultivez-vous l'équilibre entre rigueur logique et intuition ?"
        ],
        "career_confidence_note": "Analyse basée sur les caractéristiques observées.",
        "personality_title": "Ligne de Vie : Vitalité, Rythme et Équilibre",
        "personality_interpretation": (
            "La ligne de vie représente le rythme de votre vitalité et votre énergie vitale. "
            "Elle n'indique nullement la durée de l'existence, mais vous invite à préserver votre souffle "
            "et à respecter vos périodes de repos réparateur."
        ),
        "personality_prompts": [
            "Quelles habitudes quotidiennes soutiennent le mieux votre endurance ?",
            "Comment accordez-vous du temps au ressourcement de votre esprit ?"
        ],
        "personality_confidence_note": "Symbole traditionnel de vitalité et d'équilibre de vie.",
        "overall_synthesis": (
            "Votre paume illustre une harmonie féconde entre l'intelligence du cœur et la force de la réflexion. "
            "Un témoignage d'intégrité et de conscience au service de vos aspirations."
        ),
        "disclaimer": (
            "Les lectures de Palmora AI sont des interprétations culturelles et contemplatives destinées au divertissement. "
            "Elles ne constituent en aucun cas des avis médicaux, psychologiques ou financiers."
        )
    },
    "de": {
        "reading_title": "Die Architektur von Intuition und Bestimmung",
        "love_title": "Herzlinie: Emotionaler Ausdruck und Harmonie",
        "love_interpretation": (
            "In der traditionellen Handlesekunst spiegelt Ihre Herzlinie emotionale Tiefe, "
            "Aufrichtigkeit in Beziehungen und die Fähigkeit wider, mit Empathie und Bedacht zu lieben."
        ),
        "love_prompts": [
            "Wie teilen Sie Ihre emotionalen Bedürfnisse im Alltag mit?",
            "Welche Beziehungen geben Ihnen die meiste Ruhe und Kraft?"
        ],
        "love_confidence_note": "Kulturelle Interpretation auf Basis visueller Merkmale.",
        "career_title": "Kopflinie: Fokus, Strategie und Weitblick",
        "career_interpretation": (
            "Ihre Kopflinie zeugt von analytischer Klarheit, Ausdauer bei geistigen Herausforderungen "
            "und einer natürlichen Neugier, die neue Horizonte eröffnet."
        ),
        "career_prompts": [
            "Welche beruflichen Ziele spornen Sie derzeit am stärksten an?",
            "Wie verbinden Sie logische Planung mit intuitiver Entscheidungsfindung?"
        ],
        "career_confidence_note": "Achtsame Deutung basierend auf erfassten Handlinien.",
        "personality_title": "Lebenslinie: Vitalität, Rhythmus und Lebenskraft",
        "personality_interpretation": (
            "Die Lebenslinie steht symbolisch für Ihren Energiehaushalt und Ihren persönlichen Lebensrhythmus. "
            "Sie ist keine Lebensdauerprognose, sondern eine Einladung zu achtsamer Selbstfürsorge."
        ),
        "personality_prompts": [
            "Welche Routinen stellen Ihre Energie nach arbeitsreichen Tagen wieder her?",
            "Wie wahren Sie gesunde Grenzen zwischen Schaffen und Erholen?"
        ],
        "personality_confidence_note": "Traditionelles Symbol für Lebensrhythmus und Ausgeglichenheit.",
        "overall_synthesis": (
            "Ihre Hand offenbart ein ausgewogenes Zusammenspiel aus Herzenswärme und rationaler Weitsicht. "
            "Eine bestärkende Grundlage für einen erfüllten Lebensweg."
        ),
        "disclaimer": (
            "Palmora AI Lesungen sind kulturelle und symbolische Interpretationen zur Reflexion und Unterhaltung. "
            "Sie ersetzen keine professionelle medizinische, finanzielle oder psychologische Beratung."
        )
    },
    "ja": {
        "reading_title": "直感と目的の構造",
        "love_title": "感情線：心の調和と共感の表現",
        "love_interpretation": (
            "伝統的な手相学において、感情線はあなたの深い感受性、誠実な人間関係、そして他者への温かい共感力を象徴しています。"
            "深い信頼に基づく調和のとれた絆を築く力を表しています。"
        ),
        "love_prompts": [
            "日々の生活でご自身の感情をどのように素直に表現していますか？",
            "どのような人とのつながりが、あなたに真の安らぎをもたらしますか？"
        ],
        "love_confidence_note": "観察された掌線特徴に基づく文化的解釈です。",
        "career_title": "知能線：思考の深さ、戦略、探求心",
        "career_interpretation": (
            "知能線は明晰な論理的思考、戦略的計画力、そして困難を創造的に乗り越える柔軟な知性を象徴しています。"
            "知的好奇心と着実な実行力のバランスを示しています。"
        ),
        "career_prompts": [
            "現在、どのような挑戦があなたの知的好奇心を最も刺激していますか？",
            "直感と論理的分析をどのように調和させて決断を下していますか？"
        ],
        "career_confidence_note": "誠実な特徴測定に基づく思考スタイルの解釈です。",
        "personality_title": "生命線：活力、リズム、心身の調和",
        "personality_interpretation": (
            "生命線は日々の活力のリズム、回復力、そして健全な自己管理の調和を象徴しています。"
            "これは寿命を占うものではなく、適度な休息と活動のバランスを保つための伝統的な指針です。"
        ),
        "personality_prompts": [
            "疲労を感じたとき、どのように心身を回復させていますか？",
            "活動と静寂のバランスを日々の生活でどのように保っていますか？"
        ],
        "personality_confidence_note": "生命力と生活リズムを整えるための文化的象徴です。",
        "overall_synthesis": (
            "あなたの掌は、深い思いやりと明確な知性の見事な調和を示しています。"
            "自分自身の可能性を信じ、心豊かな道を歩むための静かな羅針盤となります。"
        ),
        "disclaimer": (
            "Palmora AIの手相解釈は、内省とエンターテインメントのための文化的な象徴解釈です。"
            "将来の出来事を予言するものではなく、専門的な医療、心理、財務の助言に代わるものではありません。"
        )
    },
    "ar": {
        "reading_title": "هندسة البصيرة والغاية",
        "love_title": "خط القلب: التناغم العاطفي والتعبير الصادق",
        "love_interpretation": (
            "في علم قراءة الكف التقليدي، يرمز خط القلب إلى عمق مشاعرك، وقدرتك على التعاطف النبيل، "
            "وبناء علاقات تتسم بالصدق والوفاء. إنه يعكس طبيعة كريمة تقدّر الروابط الإنسانية الأصيلة."
        ),
        "love_prompts": [
            "كيف تعبر عن مشاعرك واحتياجاتك العاطفية بوضوح مع من تحب؟",
            "ما هي العلاقات التي تمنحك أكبر قدر من السكينة والسلام الداخلي؟"
        ],
        "love_confidence_note": "تفسير ثقافي مستند إلى الخصائص البصرية المرصودة للكف.",
        "career_title": "خط الرأس: التركيز الذهني، الإستراتيجية والشغف",
        "career_interpretation": (
            "يجسد خط الرأس صفاء الذهن، والقدرة على التفكير الإستراتيجي وحل المعضلات بوعي ومرونة. "
            "إنه يشير إلى فكر يوازن بين المنطق الرصين والحكمة الفطرية."
        ),
        "career_prompts": [
            "ما هي الأهداف المهنية التي تلهمك وتستنهض طاقاتك الفكرية حالياً؟",
            "كيف توازن بين التخطيط العقلاني والقرارات المعتمدة على الحدس؟"
        ],
        "career_confidence_note": "قراءة تأملية مبنية على قياسات خطوط الكف الظاهرة.",
        "personality_title": "خط الحياة: الحيوية، الإيقاع والتوازن الشخصي",
        "personality_interpretation": (
            "يرمز خط الحياة إلى إيقاع طاقتك الحيوية ومناعتك في مواجهة ضغوط الحياة. "
            "هذا ليس تنبؤاً بطول العمر أو الأقدار، بل دعوة للاعتناء بالصحة النفسية والجسدية والتوازن بين العمل والراحة."
        ),
        "personality_prompts": [
            "ما هي العادات اليومية التي تعيد إليك نشاطك وصفاء ذهنك؟",
            "كيف تحمي طاقتك وسلامك الداخلي خلال فترات الجهد المكثف؟"
        ],
        "personality_confidence_note": "رمز ثقافي تقليدي لتوازن الإيقاع اليومي والحيوية.",
        "overall_synthesis": (
            "تكشف راحة يدك عن تناغم بديع بين دفء القلب وبصيرة العقل، "
            "مما يمنحك أساساً متيناً للسعي نحو حياة مفعمة بالمعنى والعطاء."
        ),
        "disclaimer": (
            "قراءات Palmora AI هي تأملات رمزية وثقافية مخصصة للاستئناس والتفكر الذاتي. "
            "وهي لا تُعد تنبؤات حتمية للمستقبل ولا تغني عن الاستشارات الطبية أو القانونية أو المالية المتخصصة."
        )
    }
}


async def translate_palm_reading(
    report: PalmReadingReport,
    target_language: str
) -> PalmReadingReport:
    """
    Translates a PalmReadingReport into any target language.
    Tries LLM-augmented translation first for natural cultural resonance;
    falls back to deterministic multilingual wisdom if LLM is unavailable.
    """
    target_lang_clean = target_language.strip().lower()
    if target_lang_clean in ("hinglish", "hi-latn", "hi_latn", "hi-en", "hi_en"):
        lang_code = "hinglish"
    else:
        lang_code = target_lang_clean.split("-")[0].split("_")[0]

    # If target language is already identical, return as is
    if report.language and report.language.lower() == lang_code:
        return report

    target_lang_name = LANGUAGE_NAMES.get(lang_code, target_language)

    # 1. Attempt LLM translation if provider credentials exist
    if settings.GEMINI_API_KEY or settings.OPENAI_API_KEY:
        try:
            special_script_note = ""
            if lang_code == "hinglish":
                special_script_note = (
                    "\nIMPORTANT NOTE FOR HINGLISH: Translate into natural conversational Hindi "
                    "written exclusively in Roman/Latin script (e.g. 'Aapki palm reading mein Heart Line...', "
                    "'Aapka daily routine work aur mindful rest ke beech...'). Do NOT use Devanagari script."
                )

            prompt = f"""
            ORIGINAL PALM READING REPORT:
            Reading Title: {report.reading_title}
            
            Love Reading:
            - Title: {report.love_reading.title}
            - Interpretation: {report.love_reading.traditional_interpretation}
            - Reflective Prompts: {json.dumps(report.love_reading.reflective_prompts)}
            - Confidence Note: {report.love_reading.confidence_note}
            
            Career Reading:
            - Title: {report.career_reading.title}
            - Interpretation: {report.career_reading.traditional_interpretation}
            - Reflective Prompts: {json.dumps(report.career_reading.reflective_prompts)}
            - Confidence Note: {report.career_reading.confidence_note}
            
            Vitality / Life Reading:
            - Title: {report.personality_reading.title}
            - Interpretation: {report.personality_reading.traditional_interpretation}
            - Reflective Prompts: {json.dumps(report.personality_reading.reflective_prompts)}
            - Confidence Note: {report.personality_reading.confidence_note}
            
            Overall Synthesis:
            {report.overall_synthesis}
            
            Mandatory Disclaimer:
            {report.disclaimer}
            
            TARGET LANGUAGE: {target_lang_name} (Language Code: {lang_code})
            {special_script_note}
            
            Please translate this entire reading into {target_lang_name} with poetic elegance, 
            respecting the cultural symbolism and contemplative tone of Palmora AI.
            """

            translated_data = await call_llm_for_reading(prompt, TRANSLATION_SCHEMA_INSTRUCTIONS)
            if translated_data and isinstance(translated_data, dict) and "overall_synthesis" in translated_data:
                return _build_translated_report(report, translated_data, lang_code)
        except Exception as e:
            logger.warning(f"LLM translation failed for '{target_language}': {e}. Using deterministic multilingual fallback.")

    # 2. Deterministic Multilingual Fallback
    fallback_dict = DETERMINISTIC_TRANSLATIONS.get(lang_code)
    if fallback_dict:
        return _build_translated_report(report, fallback_dict, lang_code)

    # 3. Universal Fallback: Localized framing wrapper
    return _build_universal_fallback(report, lang_code, target_lang_name)


def _build_translated_report(
    original: PalmReadingReport,
    data: Dict[str, Any],
    lang_code: str
) -> PalmReadingReport:
    """Builds a PalmReadingReport with translated textual fields."""
    return PalmReadingReport(
        id=original.id,
        reading_title=data.get("reading_title", original.reading_title),
        created_at=original.created_at,
        features_analyzed=original.features_analyzed,
        love_reading=ReadingSection(
            title=data.get("love_title", original.love_reading.title),
            feature_name=original.love_reading.feature_name,
            feature_status=original.love_reading.feature_status,
            interpretation_id=original.love_reading.interpretation_id,
            tradition_attribution=original.love_reading.tradition_attribution,
            observed_measurements_summary=original.love_reading.observed_measurements_summary,
            traditional_interpretation=data.get("love_interpretation", original.love_reading.traditional_interpretation),
            reflective_prompts=data.get("love_prompts", original.love_reading.reflective_prompts),
            confidence_note=data.get("love_confidence_note", original.love_reading.confidence_note),
            applicable_limitations=original.love_reading.applicable_limitations,
            retake_recommended=original.love_reading.retake_recommended
        ),
        career_reading=ReadingSection(
            title=data.get("career_title", original.career_reading.title),
            feature_name=original.career_reading.feature_name,
            feature_status=original.career_reading.feature_status,
            interpretation_id=original.career_reading.interpretation_id,
            tradition_attribution=original.career_reading.tradition_attribution,
            observed_measurements_summary=original.career_reading.observed_measurements_summary,
            traditional_interpretation=data.get("career_interpretation", original.career_reading.traditional_interpretation),
            reflective_prompts=data.get("career_prompts", original.career_reading.reflective_prompts),
            confidence_note=data.get("career_confidence_note", original.career_reading.confidence_note),
            applicable_limitations=original.career_reading.applicable_limitations,
            retake_recommended=original.career_reading.retake_recommended
        ),
        personality_reading=ReadingSection(
            title=data.get("personality_title", original.personality_reading.title),
            feature_name=original.personality_reading.feature_name,
            feature_status=original.personality_reading.feature_status,
            interpretation_id=original.personality_reading.interpretation_id,
            tradition_attribution=original.personality_reading.tradition_attribution,
            observed_measurements_summary=original.personality_reading.observed_measurements_summary,
            traditional_interpretation=data.get("personality_interpretation", original.personality_reading.traditional_interpretation),
            reflective_prompts=data.get("personality_prompts", original.personality_reading.reflective_prompts),
            confidence_note=data.get("personality_confidence_note", original.personality_reading.confidence_note),
            applicable_limitations=original.personality_reading.applicable_limitations,
            retake_recommended=original.personality_reading.retake_recommended
        ),
        overall_synthesis=data.get("overall_synthesis", original.overall_synthesis),
        disclaimer=data.get("disclaimer", original.disclaimer),
        is_free_tier=original.is_free_tier,
        generation_method=f"multilingual_{original.generation_method}",
        language=lang_code
    )


def _build_universal_fallback(
    original: PalmReadingReport,
    lang_code: str,
    lang_name: str
) -> PalmReadingReport:
    """Provides a localized metadata representation when specialized dictionary is absent."""
    rep = original.model_copy(deep=True)
    rep.language = lang_code
    rep.reading_title = f"{original.reading_title} ({lang_name})"
    return rep
