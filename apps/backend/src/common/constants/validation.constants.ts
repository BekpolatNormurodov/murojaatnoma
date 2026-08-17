/** Matches E.164 phone numbers, e.g. +998901234567 (no external phone-number lib required). */
export const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

/** Matches a 4-6 digit numeric OTP code. */
export const OTP_CODE_REGEX = /^\d{4,6}$/;
