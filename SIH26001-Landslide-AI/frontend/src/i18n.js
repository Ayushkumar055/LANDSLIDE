import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      routineMonitoring: "Routine Monitoring",
      earlyWarningRecommended: "Early Warning Recommended",

      criticalMessage:
        "Immediate attention recommended. Multiple risk factors are elevated.",
      highMessage:
        "Elevated landslide probability detected. Close monitoring recommended.",
      moderateMessage:
        "Moderate risk detected. Continue monitoring rainfall and terrain conditions.",
      lowMessage:
        "Current conditions indicate relatively low landslide susceptibility.",

      warningIssued: "Warning Issued & Dispatched",
      issueEarlyWarning: "Issue Early Warning",

      notificationTitle: "Landslide Alert",
      notificationMessage:
        "Risk score {{score}}/100. Evacuation advisory dispatched to NDRF/SDMA."
    }
  },

  hi: {
    translation: {
      routineMonitoring: "नियमित निगरानी",
      earlyWarningRecommended: "प्रारंभिक चेतावनी की अनुशंसा",

      criticalMessage:
        "तुरंत ध्यान देने की आवश्यकता है। कई जोखिम कारक बढ़े हुए हैं।",
      highMessage:
        "भूस्खलन की संभावना बढ़ी हुई पाई गई है। लगातार निगरानी की अनुशंसा की जाती है।",
      moderateMessage:
        "मध्यम जोखिम पाया गया है। वर्षा और भू-भाग की स्थिति की निगरानी जारी रखें।",
      lowMessage:
        "वर्तमान परिस्थितियाँ अपेक्षाकृत कम भूस्खलन संवेदनशीलता दर्शाती हैं।",

      warningIssued: "चेतावनी जारी और भेज दी गई",
      issueEarlyWarning: "प्रारंभिक चेतावनी जारी करें",

      notificationTitle: "भूस्खलन चेतावनी",
      notificationMessage:
        "जोखिम स्कोर {{score}}/100 है। निकासी संबंधी सलाह NDRF/SDMA को भेज दी गई है।"
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en", "hi"],
  interpolation: {
    escapeValue: false
  }
});

export default i18n;