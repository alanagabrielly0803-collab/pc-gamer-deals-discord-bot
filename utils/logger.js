export const logger = {
  info(message, extra = null) {
    console.log(extra ? `[info] ${message}` : `[info] ${message}`, extra || '');
  },

  warn(message, extra = null) {
    console.warn(extra ? `[warn] ${message}` : `[warn] ${message}`, extra || '');
  },

  error(message, error = null) {
    console.error(`[error] ${message}`, error?.message || error || '');
  }
};
