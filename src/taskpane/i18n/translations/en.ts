import { TranslationDictionary } from '../types';

/**
 * English translation dictionary
 * Contains all UI strings for the AutoOffice add-in
 */
export const en: TranslationDictionary = {
  common: {
    appName: 'AutoOffice',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
  },
  
  chat: {
    welcomeTitle: 'Welcome to AutoOffice',
    welcomeMessage: 'Ask me to do anything with your {{host}} document. I\'ll write and run office.js code to make it happen.',
    exampleWord: 'Try: "Make all headings blue" or "Insert a 3-column table"',
    exampleExcel: 'Try: "Put 1 through 10 in column A" or "Make a chart from B2:D8"',
    inputPlaceholder: 'Ask me to modify the {{host}}...',
    sendButton: 'Send',
  },
  
  settings: {
    title: 'Settings',
    backButton: 'Back',
    
    providerSection: 'AI Provider',
    providerLabel: 'Provider',
    providerPlaceholder: 'Select a provider...',
    apiKeyLabel: 'API Key',
    apiKeyPlaceholder: 'Enter API key...',
    baseUrlLabel: 'Base URL',
    baseUrlPlaceholder: 'http://localhost:11434/v1',
    modelLabel: 'Model',
    modelPlaceholder: 'Enter model name...',
    
    executionSection: 'Execution',
    autoApproveLabel: 'Auto-approve code execution',
    maxRetriesLabel: 'Max retry attempts',
    timeoutLabel: 'Execution timeout (seconds)',
    
    mcpSection: 'MCP Servers',
    mcpAddButton: 'Add',
    mcpNoServers: 'No MCP servers configured. Add one to extend the agent\'s capabilities.',
    mcpNamePlaceholder: 'Server name',
    mcpUrlPlaceholder: 'https://server-url/mcp',
    
    languageSection: 'Language',
    languageLabel: 'Interface Language',
    languagePlaceholder: 'Select a language...',
    languageDescription: 'Select your preferred interface language. The interface will update immediately without reloading.',
  },
  
  code: {
    approveButton: 'Approve & Run',
    rejectButton: 'Reject',
    awaitingApprovalStatus: 'Awaiting Approval',
    rejectedStatus: 'Rejected',
    runningStatus: 'Running...',
    successStatus: 'Success',
    errorStatus: 'Error',
    errorDetails: 'Error details',
    result: 'Result',
    toolActivity: 'looked up: {{toolName}}',
  },
  
  errors: {
    executionFailed: 'Code execution failed: {{message}}',
    networkError: 'Network error. Please check your connection.',
    invalidApiKey: 'Invalid API key. Please check your settings.',
    timeout: 'Request timed out. Please try again.',
    unknownError: 'An unknown error occurred.',
    codeRejected: 'User rejected the code. Ask what they would like changed.',
    maxRetriesReached: 'Failed after {{count}} attempts. Last error: {{error}}',
    pleaseFixAndRetry: 'Please fix and try again.',
    streamError: 'Error: {{message}}',
  },
};
