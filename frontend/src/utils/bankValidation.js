import {
  cleanBankAccount,
  maskBankAccount,
  validateBankAccount,
  validateBankAccountMatch,
  cleanIFSC,
  validateIFSC,
  DEFAULT_BANK_ACCOUNT_MIN,
  DEFAULT_BANK_ACCOUNT_MAX
} from './formValidation.js';

export const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;
export const BANK_ACCOUNT_ERROR_MESSAGE = 'Account number must contain 9–18 digits.';

export const isValidAccountNumber = (acc, bankName = '') => {
  if (!acc) return false;
  return validateBankAccount(acc, bankName).isValid;
};

export const sanitizeAccountNumber = (value) => {
  return cleanBankAccount(value);
};

export {
  cleanBankAccount,
  maskBankAccount,
  validateBankAccount,
  validateBankAccountMatch,
  cleanIFSC,
  validateIFSC,
  DEFAULT_BANK_ACCOUNT_MIN,
  DEFAULT_BANK_ACCOUNT_MAX
};
