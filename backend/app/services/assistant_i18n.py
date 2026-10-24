"""English / Hindi / Marathi text for the What-If Assistant's built-in engine (template answers + keyword parser)."""
from __future__ import annotations

LANGS = ("en", "hi", "mr")
LANG_NAMES = {"en": "English", "hi": "Hindi", "mr": "Marathi"}


def lang_or_default(lang: str | None) -> str:
    return lang if lang in LANGS else "en"


ZONE_NAMES = {
    "hi": {"zone-a": "वैक्सीन स्टोर A", "zone-b": "डेयरी चिलर B", "zone-c": "फ्रोज़न स्टोर C"},
    "mr": {"zone-a": "लस साठवण कक्ष A", "zone-b": "डेअरी चिलर B", "zone-c": "गोठवलेला साठा कक्ष C"},
}
PRODUCTS = {
    "hi": {"zone-a": "वैक्सीन और बायोलॉजिक्स", "zone-b": "दूध, दही और पनीर", "zone-c": "फ्रोज़न खाद्य पदार्थ"},
    "mr": {"zone-a": "लसी आणि बायोलॉजिक्स", "zone-b": "दूध, दही आणि चीज", "zone-c": "गोठवलेले अन्नपदार्थ"},
}
SCENARIO_NAMES = {
    "hi": {"normal": "सामान्य संचालन", "door_open": "दरवाज़ा खुला रहना", "compressor_failure": "कंप्रेसर खराबी / बिजली गुल",
           "cooling_degradation": "कूलिंग क्षमता में गिरावट", "ambient_increase": "बाहरी तापमान में वृद्धि",
           "sensor_anomaly": "सेंसर गड़बड़ी", "abnormal_humidity": "असामान्य नमी", "fire_runaway": "आग / थर्मल रनअवे",
           "fan_off": "इवैपोरेटर पंखा बंद"},
    "mr": {"normal": "सामान्य कामकाज", "door_open": "दार उघडे राहणे", "compressor_failure": "कंप्रेसर बिघाड / वीज खंडित",
           "cooling_degradation": "शीतकरण क्षमतेत घट", "ambient_increase": "बाहेरील तापमानात वाढ",
           "sensor_anomaly": "सेन्सर बिघाड", "abnormal_humidity": "असामान्य आर्द्रता", "fire_runaway": "आग / थर्मल रनअवे",
           "fan_off": "इव्हॅपोरेटर पंखा बंद"},
}

# Scenarios that the what-if engine has no recommendations for.
EXTRA_RECOMMENDATIONS = {
    "fan_off": [
        "Reset the evaporator fan breaker and check the fan motor.",
        "Keep the door closed; without air circulation the room warms unevenly.",
        "Check the warmest spots with a calibrated probe until airflow is restored.",
    ],
    "abnormal_humidity": [
        "Check door seals and air curtains for moist air getting in.",
        "Inspect the evaporator for ice build-up and run a defrost cycle if needed.",
        "Check packaging for condensation damage.",
    ],
    "fire_runaway": [
        "Raise the fire alarm and follow the site evacuation procedure.",
        "Isolate electrical power to the affected equipment if it is safe to do so.",
        "Do not open the room until the fire team confirms it is safe; plan moving stock to backup storage.",
    ],
}

RECOMMENDATIONS = {
    "Inspect the compressor and verify power supply.": (
        "कंप्रेसर की जांच करें और बिजली आपूर्ति सत्यापित करें।",
        "कंप्रेसरची तपासणी करा आणि वीजपुरवठा तपासा."),
    "Prepare backup cold storage before the projected limit time.": (
        "अनुमानित सीमा समय से पहले बैकअप कोल्ड स्टोरेज तैयार रखें।",
        "अंदाजित मर्यादा वेळेपूर्वी पर्यायी शीतगृह तयार ठेवा."),
    "Keep the door closed to slow the temperature rise.": (
        "तापमान वृद्धि धीमी करने के लिए दरवाज़ा बंद रखें।",
        "तापमानवाढ मंद करण्यासाठी दार बंद ठेवा."),
    "Check the door seal and close the door.": (
        "दरवाज़े की सील जांचें और दरवाज़ा बंद करें।",
        "दाराचे सील तपासा आणि दार बंद करा."),
    "Review door-open alarms and staff procedures for loading.": (
        "दरवाज़ा-खुला अलार्म और लोडिंग के लिए स्टाफ प्रक्रियाओं की समीक्षा करें।",
        "दार-उघडे अलार्म आणि लोडिंगसाठीच्या कर्मचारी कार्यपद्धतींचा आढावा घ्या."),
    "Check condenser airflow and ventilation around the refrigeration unit.": (
        "रेफ्रिजरेशन यूनिट के आसपास कंडेंसर एयरफ्लो और वेंटिलेशन जांचें।",
        "रेफ्रिजरेशन युनिटभोवती कंडेन्सरचा हवाप्रवाह आणि वायुवीजन तपासा."),
    "Reduce door openings while ambient temperature is elevated.": (
        "बाहरी तापमान अधिक रहने तक दरवाज़ा कम से कम खोलें।",
        "बाहेरील तापमान जास्त असेपर्यंत दार कमीत कमी उघडा."),
    "Inspect refrigeration performance and prepare corrective action.": (
        "रेफ्रिजरेशन के प्रदर्शन की जांच करें और सुधारात्मक कार्रवाई तैयार रखें।",
        "रेफ्रिजरेशनच्या कामगिरीची तपासणी करा आणि सुधारात्मक कृती तयार ठेवा."),
    "Inspect condenser coils for dust/debris fouling and clean immediately.": (
        "कंडेंसर कॉइल पर धूल/कचरा जांचें और तुरंत साफ़ करें।",
        "कंडेन्सर कॉइलवरील धूळ/कचरा तपासा आणि लगेच स्वच्छ करा."),
    "Check refrigerant pressure levels for possible slow leakage.": (
        "संभावित धीमे रिसाव के लिए रेफ्रिजरेंट का दबाव जांचें।",
        "संभाव्य हळू गळतीसाठी रेफ्रिजरंटचा दाब तपासा."),
    "Verify evaporator fan speed and defrost cycle health.": (
        "इवैपोरेटर पंखे की गति और डीफ्रॉस्ट चक्र की स्थिति जांचें।",
        "इव्हॅपोरेटर पंख्याचा वेग आणि डीफ्रॉस्ट चक्राची स्थिती तपासा."),
    "Restrict non-essential door openings to reduce thermal load.": (
        "ताप भार कम करने के लिए अनावश्यक रूप से दरवाज़ा खोलना रोकें।",
        "उष्णता भार कमी करण्यासाठी अनावश्यक दार उघडणे टाळा."),
    "Continue routine monitoring; confirm the temperature returns to setpoint.": (
        "नियमित निगरानी जारी रखें; पुष्टि करें कि तापमान सेटपॉइंट पर लौट आए।",
        "नियमित देखरेख सुरू ठेवा; तापमान सेटपॉइंटवर परत येत असल्याची खात्री करा."),
    "Reset the evaporator fan breaker and check the fan motor.": (
        "इवैपोरेटर पंखे का ब्रेकर रीसेट करें और पंखे की मोटर जांचें।",
        "इव्हॅपोरेटर पंख्याचा ब्रेकर रीसेट करा आणि पंख्याची मोटर तपासा."),
    "Keep the door closed; without air circulation the room warms unevenly.": (
        "दरवाज़ा बंद रखें; हवा का संचार न होने से कमरा असमान रूप से गर्म होता है।",
        "दार बंद ठेवा; हवा खेळती नसल्याने कक्ष असमानपणे गरम होतो."),
    "Check the warmest spots with a calibrated probe until airflow is restored.": (
        "हवा का प्रवाह बहाल होने तक सबसे गर्म जगहों को कैलिब्रेटेड प्रोब से जांचते रहें।",
        "हवाप्रवाह पूर्ववत होईपर्यंत सर्वात उबदार ठिकाणे कॅलिब्रेटेड प्रोबने तपासत राहा."),
    "Check door seals and air curtains for moist air getting in.": (
        "नम हवा के प्रवेश के लिए दरवाज़े की सील और एयर कर्टन जांचें।",
        "दमट हवा आत येऊ नये म्हणून दाराचे सील आणि एअर कर्टन तपासा."),
    "Inspect the evaporator for ice build-up and run a defrost cycle if needed.": (
        "इवैपोरेटर पर बर्फ जमाव जांचें और ज़रूरत हो तो डीफ्रॉस्ट चक्र चलाएं।",
        "इव्हॅपोरेटरवर बर्फ साचला आहे का ते तपासा आणि गरज असल्यास डीफ्रॉस्ट चक्र चालवा."),
    "Check packaging for condensation damage.": (
        "संघनन से पैकेजिंग को हुए नुकसान की जांच करें।",
        "संघननामुळे पॅकेजिंगचे नुकसान झाले आहे का ते तपासा."),
    "Raise the fire alarm and follow the site evacuation procedure.": (
        "फायर अलार्म बजाएं और साइट निकासी प्रक्रिया का पालन करें।",
        "फायर अलार्म वाजवा आणि साइटवरील स्थलांतर प्रक्रियेचे पालन करा."),
    "Isolate electrical power to the affected equipment if it is safe to do so.": (
        "सुरक्षित हो तो प्रभावित उपकरण की बिजली आपूर्ति अलग करें।",
        "सुरक्षित असल्यास बाधित उपकरणाचा वीजपुरवठा बंद करा."),
    "Do not open the room until the fire team confirms it is safe; plan moving stock to backup storage.": (
        "फायर टीम की पुष्टि तक कमरा न खोलें; स्टॉक को बैकअप स्टोरेज में ले जाने की योजना बनाएं।",
        "अग्निशमन पथकाने खात्री करेपर्यंत कक्ष उघडू नका; साठा पर्यायी शीतगृहात हलवण्याची योजना करा."),
}

T: dict[str, dict[str, str]] = {
    "en": {
        "title": "### What if: {scenario} in {zone}{dur}{extra}",
        "dur_for": " for {d}", "ongoing": " (ongoing)", "extra": " (+{x}°C outside)",
        "critical": "**Critical: {zone} would pass its spoilage point ({t}°C) after ~{m}.**",
        "warning": "**Warning: {zone} would leave its safe range in ~{m}.**",
        "borderline": "**Borderline: {zone} reaches the edge of its safe range (peak {p}°C vs limit {l}°C), so act before it gets worse.**",
        "safe": "**Safe: {zone} stays within {lo} to {hi}°C in this scenario.**",
        "impact": "**Impact**",
        "temp": "- Temperature: from {start}°C to a peak of **{peak}°C** (peak {base}°C if nothing changes).",
        "range_breached": "- Safe range {lo} to {hi}°C: breached on the **{side}** side after **{m}**.",
        "range_ok": "- Safe range {lo} to {hi}°C: not breached.",
        "ai_warn": "- AI early warning: raised at minute {w}{lead}.", "lead": ", **{m} before** the breach",
        "risk": "- Risk score: peaks at **{r}/100** (vs {b}/100 normally).",
        "product_loss": "- Product: above {t}°C for {n} min, so **up to ${v}** of {product} is at risk. {mechanism}.",
        "product_ok": "- Product: stays below the {t}°C spoilage point, so no stock loss is expected.",
        "todo": "**What to do**",
        "disclaimer": "_Simulated projection from the ColdGuard digital twin; real equipment may behave differently._",
        "upper": "upper", "lower": "lower", "min": "{n} min", "hours": "{h} h",
        "status_title": "### Current facility status",
        "status_line": "- **{name}**: {t} (safe {lo} to {hi}°C), risk {r}/100 {cat}{ttb}; {a} active alert(s).",
        "status_ttb": ", predicted breach in {m}", "no_reading": "no reading",
        "status_footer": "\nAsk me *what if …* about any room to see the projected impact.",
        "not_understood": "I couldn't tell which situation you want to simulate.",
        "help": ("I can project what would happen to any cold room using the digital twin. Try asking:\n"
                 "- *What if the compressor fails in the dairy chiller for 45 minutes?*\n"
                 "- *What happens to the vaccine store during a power cut of 2 hours?*\n"
                 "- *What if the freezer door is left open for 20 minutes?*\n"
                 "- *Heatwave of +12°C in all rooms: what's the impact?*\n"
                 "- *What is the current status of the facility?*"),
    },
    "hi": {
        "title": "### क्या होगा अगर: {zone} में {scenario}{dur}{extra}",
        "dur_for": " ({d} के लिए)", "ongoing": " (लगातार)", "extra": " (बाहर +{x}°C)",
        "critical": "**गंभीर: लगभग {m} बाद {zone} अपने खराब होने के बिंदु ({t}°C) को पार कर जाएगा।**",
        "warning": "**चेतावनी: लगभग {m} में {zone} अपनी सुरक्षित सीमा से बाहर हो जाएगा।**",
        "borderline": "**सीमा पर: {zone} सुरक्षित सीमा के किनारे तक पहुंचता है (अधिकतम {p}°C, सीमा {l}°C), स्थिति बिगड़ने से पहले कार्रवाई करें।**",
        "safe": "**सुरक्षित: इस स्थिति में {zone} {lo} से {hi}°C के भीतर रहता है।**",
        "impact": "**प्रभाव**",
        "temp": "- तापमान: {start}°C से बढ़कर अधिकतम **{peak}°C** (कुछ न बदले तो अधिकतम {base}°C)।",
        "range_breached": "- सुरक्षित सीमा {lo} से {hi}°C: **{m}** बाद **{side}** सीमा पार।",
        "range_ok": "- सुरक्षित सीमा {lo} से {hi}°C: पार नहीं होती।",
        "ai_warn": "- AI पूर्व चेतावनी: मिनट {w} पर{lead}।", "lead": ", सीमा पार होने से **{m} पहले**",
        "risk": "- जोखिम स्कोर: अधिकतम **{r}/100** (सामान्य रूप से {b}/100)।",
        "product_loss": "- उत्पाद: {n} मिनट तक {t}°C से ऊपर, **${v}** तक के {product} जोखिम में।",
        "product_ok": "- उत्पाद: {t}°C के खराब होने के बिंदु से नीचे रहता है, स्टॉक नुकसान की आशंका नहीं।",
        "todo": "**क्या करें**",
        "disclaimer": "_यह ColdGuard डिजिटल ट्विन का सिम्युलेटेड अनुमान है; असली उपकरण का व्यवहार अलग हो सकता है।_",
        "upper": "ऊपरी", "lower": "निचली", "min": "{n} मिनट", "hours": "{h} घंटे",
        "status_title": "### सुविधा की वर्तमान स्थिति",
        "status_line": "- **{name}**: {t} (सुरक्षित {lo} से {hi}°C), जोखिम {r}/100{ttb}; {a} सक्रिय अलर्ट।",
        "status_ttb": ", अनुमानित सीमा उल्लंघन {m} में", "no_reading": "रीडिंग नहीं",
        "status_footer": "\nकिसी भी कमरे के बारे में *क्या होगा अगर …* पूछें।",
        "not_understood": "मैं समझ नहीं पाया कि आप कौन-सी स्थिति सिम्युलेट करना चाहते हैं।",
        "help": ("मैं डिजिटल ट्विन से किसी भी कोल्ड रूम पर असर का अनुमान दिखा सकता हूँ। ऐसे पूछें:\n"
                 "- *अगर डेयरी चिलर का कंप्रेसर 45 मिनट बंद रहे तो क्या होगा?*\n"
                 "- *वैक्सीन स्टोर में 2 घंटे बिजली गुल रहे तो क्या होगा?*\n"
                 "- *अगर फ्रीज़र का दरवाज़ा 20 मिनट खुला रहे तो?*\n"
                 "- *सभी कमरों में बाहर का तापमान 12 डिग्री बढ़े तो असर क्या होगा?*\n"
                 "- *सुविधा की वर्तमान स्थिति क्या है?*"),
    },
    "mr": {
        "title": "### जर असे झाले तर: {zone} मध्ये {scenario}{dur}{extra}",
        "dur_for": " ({d} साठी)", "ongoing": " (सतत)", "extra": " (बाहेर +{x}°C)",
        "critical": "**गंभीर: सुमारे {m} नंतर {zone} खराब होण्याच्या बिंदूला ({t}°C) ओलांडेल.**",
        "warning": "**इशारा: सुमारे {m} मध्ये {zone} सुरक्षित मर्यादेबाहेर जाईल.**",
        "borderline": "**मर्यादेवर: {zone} सुरक्षित मर्यादेच्या कडेपर्यंत पोहोचतो (कमाल {p}°C, मर्यादा {l}°C); परिस्थिती बिघडण्यापूर्वी कृती करा.**",
        "safe": "**सुरक्षित: या परिस्थितीत {zone} {lo} ते {hi}°C मध्येच राहतो.**",
        "impact": "**परिणाम**",
        "temp": "- तापमान: {start}°C पासून कमाल **{peak}°C** पर्यंत (काहीच बदलले नाही तर कमाल {base}°C).",
        "range_breached": "- सुरक्षित मर्यादा {lo} ते {hi}°C: **{m}** नंतर **{side}** मर्यादा ओलांडली जाते.",
        "range_ok": "- सुरक्षित मर्यादा {lo} ते {hi}°C: ओलांडली जात नाही.",
        "ai_warn": "- AI पूर्वसूचना: मिनिट {w} ला{lead}.", "lead": ", मर्यादा ओलांडण्याच्या **{m} आधी**",
        "risk": "- जोखीम गुण: कमाल **{r}/100** (सामान्यपणे {b}/100).",
        "product_loss": "- उत्पादन: {n} मिनिटे {t}°C पेक्षा जास्त, **${v}** पर्यंतचे {product} धोक्यात.",
        "product_ok": "- उत्पादन: {t}°C या खराब होण्याच्या बिंदूखाली राहते, साठ्याचे नुकसान अपेक्षित नाही.",
        "todo": "**काय करावे**",
        "disclaimer": "_हा ColdGuard डिजिटल ट्विनचा सिम्युलेटेड अंदाज आहे; प्रत्यक्ष उपकरणांचे वर्तन वेगळे असू शकते._",
        "upper": "वरची", "lower": "खालची", "min": "{n} मिनिटे", "hours": "{h} तास",
        "status_title": "### सुविधेची सद्यस्थिती",
        "status_line": "- **{name}**: {t} (सुरक्षित {lo} ते {hi}°C), जोखीम {r}/100{ttb}; {a} सक्रिय अलर्ट.",
        "status_ttb": ", अंदाजित मर्यादा उल्लंघन {m} मध्ये", "no_reading": "रीडिंग नाही",
        "status_footer": "\nकोणत्याही कक्षाबद्दल *जर … झाले तर काय होईल* असे विचारा.",
        "not_understood": "तुम्हाला कोणती परिस्थिती सिम्युलेट करायची आहे ते मला समजले नाही.",
        "help": ("मी डिजिटल ट्विन वापरून कोणत्याही शीतकक्षावरील परिणामाचा अंदाज दाखवू शकतो. असे विचारा:\n"
                 "- *डेअरी चिलरचा कंप्रेसर 45 मिनिटे बंद पडला तर काय होईल?*\n"
                 "- *लस साठवण कक्षात 2 तास वीज गेली तर काय होईल?*\n"
                 "- *फ्रीजरचे दार 20 मिनिटे उघडे राहिले तर?*\n"
                 "- *सर्व कक्षांमध्ये बाहेरचे तापमान 12 अंशांनी वाढले तर परिणाम काय?*\n"
                 "- *सुविधेची सद्यस्थिती काय आहे?*"),
    },
}


def zone_name(zone_id: str, default: str, lang: str) -> str:
    return ZONE_NAMES.get(lang, {}).get(zone_id, default)


def product_name(zone_id: str, default: str, lang: str) -> str:
    return PRODUCTS.get(lang, {}).get(zone_id, default)


def scenario_name(scenario: str, default: str, lang: str) -> str:
    return SCENARIO_NAMES.get(lang, {}).get(scenario, default)


def recommendation(text: str, lang: str) -> str:
    if lang == "en" or text not in RECOMMENDATIONS:
        return text
    return RECOMMENDATIONS[text][0 if lang == "hi" else 1]


# ---------------------------------------------------------------- keyword parser vocabulary (Devanagari)
SCENARIO_KEYWORDS_INDIC: dict[str, list[str]] = {
    "fire_runaway": ["आग", "धुआं", "धुआँ", "धूर", "शॉर्ट सर्किट"],
    "fan_off": ["पंखा", "पंखे", "पंख्या", "फैन", "फॅन", "ब्लोअर"],
    "compressor_failure": ["कंप्रेसर", "कम्प्रेसर", "कॉम्प्रेसर", "कंप्रेशर", "बिजली", "लाइट गई", "लाईट गेली", "वीज",
                           "पावर कट", "पॉवर कट", "ब्लैकआउट", "जनरेटर", "शीतकरण बंद", "कूलिंग बंद"],
    # "open" on its own also means the door: speech recognition often mishears the word for door itself.
    "door_open": ["दरवाज", "दरवाजा", "दार उघड", "दार उघडे", "दार खुल", "लोडिंग", "अनलोडिंग",
                  "खुला", "खुली", "खुले", "खुल रहा", "खुल रही", "खुला रह", "उघडे", "उघडं", "उघडा", "उघडी"],
    "ambient_increase": ["गर्मी", "उष्णता", "उन्हाळ", "हीटवेव", "हीट वेव", "बाहर का तापमान", "बाहरी तापमान",
                         "बाहेरचे तापमान", "बाहेरील तापमान", "तापमान बढ़", "तापमान वाढ"],
    "cooling_degradation": ["गैस", "गॅस", "रेफ्रिजरेंट", "रेफ्रिजरंट", "लीक", "रिसाव", "गळती", "कंडेन्सर", "कंडेंसर", "क्षमता कम", "क्षमता घट"],
    "abnormal_humidity": ["नमी", "आर्द्रता", "आद्रता", "दमट", "ओलावा", "पावसाळ", "बारिश", "मानसून", "मान्सून"],
}
# Short words that must match as whole words (e.g. "दार" = door, but not inside "जबाबदार").
SCENARIO_WHOLE_WORDS_INDIC: dict[str, list[str]] = {
    "door_open": ["दार", "दारं"],
    "ambient_increase": ["लू"],
}
ZONE_KEYWORDS_INDIC = {
    "zone-a": ["वैक्सीन", "वॅक्सीन", "टीका", "टीके", "लस", "इंसुलिन", "इन्सुलिन", "दवा", "औषध"],
    "zone-b": ["डेयरी", "डेअरी", "दूध", "दुग्ध", "पनीर", "दही", "चीज"],
    "zone-c": ["फ्रीजर", "फ्रीज़र", "फ्रिजर", "फ्रोजन", "फ्रोज़न", "गोठव", "बर्फ", "मांस"],
}
ALL_ZONES_INDIC = ["सभी कमर", "सारे कमर", "सब कमर", "सर्व कक्ष", "सगळ्या", "सगळे कक्ष", "सर्व खोल", "पूरी सुविधा", "संपूर्ण सुविधा"]
STATUS_INDIC = ["स्थिति", "स्थिती", "हालत", "परिस्थिती", "सद्यस्थिती", "अभी क्या", "आता काय", "सध्या"]
HOUR_UNITS_INDIC = ("घंट", "तास")
MINUTE_UNITS_INDIC = ("मिनट", "मिनिट")
NUMBER_WORDS = {
    "आधा": 0.5, "अर्धा": 0.5, "डेढ़": 1.5, "दीड": 1.5, "ढाई": 2.5, "अडीच": 2.5,
    "एक": 1, "दो": 2, "दोन": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "पाच": 5, "छह": 6, "सहा": 6,
    "दस": 10, "दहा": 10, "पंद्रह": 15, "पंधरा": 15, "बीस": 20, "वीस": 20, "पच्चीस": 25, "पंचवीस": 25,
    "तीस": 30, "चालीस": 40, "चाळीस": 40, "पैंतालीस": 45, "पंचेचाळीस": 45, "साठ": 60, "नब्बे": 90, "नव्वद": 90,
}
DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")
