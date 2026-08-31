import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      critical: "CRITICAL",
      high: "HIGH",
      moderate: "MODERATE",
      low: "LOW",
      earlyWarning: "Early Warning Issued",
      warningRecommended: "Early Warning Recommended",
      issueWarning: "Issue Early Warning",
      sosReport: "SOS Report",
      submitSos: "Submit SOS Report",
      sosSubmitted: "SOS Report Submitted",
      evacuateNow: "Evacuate Immediately",
      alertsIssued: "Alerts Issued",
      nearestShelter: "Nearest Safe Shelter"
    }
  },
  hi: {
    translation: {
      critical: "गंभीर",
      high: "उच्च",
      moderate: "मध्यम",
      low: "कम",
      earlyWarning: "पूर्व चेतावनी जारी",
      warningRecommended: "पूर्व चेतावनी की सिफारिश",
      issueWarning: "चेतावनी जारी करें",
      sosReport: "एसओएस रिपोर्ट",
      submitSos: "एसओएस रिपोर्ट भेजें",
      sosSubmitted: "एसओएस रिपोर्ट भेज दी गई",
      evacuateNow: "तुरंत स्थान खाली करें",
      alertsIssued: "जारी की गई चेतावनियाँ",
      nearestShelter: "निकटतम सुरक्षित शरण स्थल"
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }
});

export default i18n;