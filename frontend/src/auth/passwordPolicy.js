const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
export const PASSWORD_POLICY_ERROR_MESSAGE =
  "8+ characters with uppercase, lowercase, number, and special character (!@#$%^&*).";

export const PASSWORD_REQUIREMENTS = [
  {
    id: "length",
    message: "Be at least 8 characters (was 6)",
    test: (value) => String(value || "").length >= 8,
  },
  {
    id: "uppercase",
    message: "Have at least 1 uppercase letter (A-Z)",
    test: (value) => /[A-Z]/.test(String(value || "")),
  },
  {
    id: "lowercase",
    message: "Have at least 1 lowercase letter (a-z)",
    test: (value) => /[a-z]/.test(String(value || "")),
  },
  {
    id: "number",
    message: "Have at least 1 number (0-9)",
    test: (value) => /[0-9]/.test(String(value || "")),
  },
  {
    id: "special",
    message:
      "Have at least 1 special character (!@#$%^&*()_+-=[]{}etc)",
    test: (value) => SPECIAL_CHAR_REGEX.test(String(value || "")),
  },
];

export function getPasswordRuleStates(password) {
  return PASSWORD_REQUIREMENTS.map((rule) => ({
    ...rule,
    met: rule.test(password),
  }));
}

export function isPasswordPolicySatisfied(password) {
  return getPasswordRuleStates(password).every((rule) => rule.met);
}
