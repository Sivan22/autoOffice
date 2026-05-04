export const PORT = Number(process.env.AUTOOFFICE_PORT ?? 47318);
export const HOST = process.env.AUTOOFFICE_HOST ?? '127.0.0.1';
export const VERSION = process.env.AUTOOFFICE_VERSION ?? '0.0.0-dev';
export const IS_DEV = process.env.NODE_ENV !== 'production';
export const AUTH_TOKEN = process.env.AUTOOFFICE_TOKEN ?? 'dev-token-replace-me';
export const DATA_DIR = process.env.AUTOOFFICE_DATA_DIR ?? '';
