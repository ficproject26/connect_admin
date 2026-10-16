export const BANK_ACCOUNT_REGEX = /^\d{8,20}$/;
export const BANK_ACCOUNT_ERROR_MESSAGE = 'Account number must contain 8–20 digits.';

export const isValidAccountNumber = (acc) => {
  if (!acc) return false;
  const clean = String(acc).trim();
  return BANK_ACCOUNT_REGEX.test(clean);
};

export const sanitizeAccountNumber = (value) => {
  return String(value || '').replace(/\D/g, '').slice(0, 20);
};
