export const PORT = Number(process.env.AUTOOFFICE_PORT ?? 47318);
export const HOST = process.env.AUTOOFFICE_HOST ?? '127.0.0.1';
export const VERSION = process.env.AUTOOFFICE_VERSION ?? '0.0.0-dev';
export const IS_DEV = process.env.NODE_ENV !== 'production';
