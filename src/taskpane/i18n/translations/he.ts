import { TranslationDictionary } from '../types';

/**
 * Hebrew translation dictionary
 * Contains all UI strings for the AutoOffice add-in in Hebrew
 */
export const he: TranslationDictionary = {
  common: {
    appName: 'AutoOffice',
    loading: 'טוען...',
    error: 'שגיאה',
    success: 'הצלחה',
    cancel: 'ביטול',
    save: 'שמירה',
    close: 'סגירה',
  },
  
  chat: {
    welcomeTitle: 'ברוכים הבאים ל-AutoOffice',
    welcomeMessage: 'בקש ממני לעשות כל דבר עם מסמך ה-{{host}} שלך. אני אכתוב ואריץ קוד office.js כדי לבצע את זה.',
    exampleWord: 'נסה: "צבע את כל הכותרות בכחול" או "הוסף טבלה בת 3 עמודות"',
    exampleExcel: 'נסה: "שים את המספרים 1 עד 10 בעמודה A" או "צור גרף מ-B2:D8"',
    inputPlaceholder: 'בקש ממני לשנות את ה-{{host}}...',
    sendButton: 'שלח',
  },
  
  settings: {
    title: 'הגדרות',
    backButton: 'חזרה',
    
    providerSection: 'ספק AI',
    providerLabel: 'ספק',
    providerPlaceholder: 'בחר ספק...',
    apiKeyLabel: 'מפתח API',
    apiKeyPlaceholder: 'הזן מפתח API...',
    baseUrlLabel: 'כתובת בסיס',
    baseUrlPlaceholder: 'http://localhost:11434/v1',
    modelLabel: 'מודל',
    modelPlaceholder: 'הזן שם מודל...',
    
    executionSection: 'הרצה',
    autoApproveLabel: 'אישור אוטומטי להרצת קוד',
    maxRetriesLabel: 'מספר ניסיונות מקסימלי',
    timeoutLabel: 'זמן קצוב להרצה (שניות)',
    
    mcpSection: 'שרתי MCP',
    mcpAddButton: 'הוסף',
    mcpNoServers: 'לא הוגדרו שרתי MCP. הוסף אחד כדי להרחיב את יכולות הסוכן.',
    mcpNamePlaceholder: 'שם שרת',
    mcpUrlPlaceholder: 'https://server-url/mcp',
    
    languageSection: 'שפה',
    languageLabel: 'שפת ממשק',
    languagePlaceholder: 'בחר שפה...',
    languageDescription: 'בחר את שפת הממשק המועדפת עליך. הממשק יתעדכן מיד ללא טעינה מחדש.',
  },
  
  code: {
    approveButton: 'אשר והרץ',
    rejectButton: 'דחה',
    awaitingApprovalStatus: 'ממתין לאישור',
    rejectedStatus: 'נדחה',
    runningStatus: 'רץ...',
    successStatus: 'הצלחה',
    errorStatus: 'שגיאה',
    errorDetails: 'פרטי שגיאה',
    result: 'תוצאה',
    toolActivity: 'חיפש: {{toolName}}',
  },
  
  errors: {
    executionFailed: 'הרצת הקוד נכשלה: {{message}}',
    networkError: 'שגיאת רשת. אנא בדוק את החיבור שלך.',
    invalidApiKey: 'מפתח API לא תקין. אנא בדוק את ההגדרות שלך.',
    timeout: 'הבקשה פגה. אנא נסה שוב.',
    unknownError: 'אירעה שגיאה לא ידועה.',
    codeRejected: 'המשתמש דחה את הקוד. שאל מה הוא רוצה לשנות.',
    maxRetriesReached: 'נכשל אחרי {{count}} ניסיונות. שגיאה אחרונה: {{error}}',
    pleaseFixAndRetry: 'אנא תקן ונסה שוב.',
    streamError: 'שגיאה: {{message}}',
  },
};
