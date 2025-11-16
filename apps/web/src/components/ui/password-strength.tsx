'use client';

interface PasswordStrengthProps {
  password: string;
}

interface PasswordRequirement {
  regex: RegExp;
  text: string;
  met: boolean;
}

const REQUIREMENTS_CONFIG = [
  { regex: /.{8,}/, text: 'Mindestens 8 Zeichen' },
  { regex: /[A-Z]/, text: 'Ein Großbuchstabe' },
  { regex: /[a-z]/, text: 'Ein Kleinbuchstabe' },
  { regex: /\d/, text: 'Eine Zahl' },
  { regex: /[@$!%*?&#]/, text: 'Ein Sonderzeichen (@$!%*?&#)' },
];

export function PasswordStrength({ password }: PasswordStrengthProps) {
  // Compute requirements based on password value
  const requirements: PasswordRequirement[] = REQUIREMENTS_CONFIG.map((config) => ({
    ...config,
    met: config.regex.test(password),
  }));

  const metCount = requirements.filter((req) => req.met).length;
  const strengthPercentage = (metCount / requirements.length) * 100;

  const getStrengthColor = () => {
    if (strengthPercentage === 0) return 'bg-gray-200';
    if (strengthPercentage < 40) return 'bg-red-500';
    if (strengthPercentage < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (strengthPercentage === 0) return '';
    if (strengthPercentage < 40) return 'Schwach';
    if (strengthPercentage < 80) return 'Mittel';
    return 'Stark';
  };

  if (!password) return null;

  return (
    <div className="space-y-2 text-sm">
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Passwortstärke</span>
          {strengthPercentage > 0 && (
            <span
              className={`font-medium ${
                strengthPercentage < 40
                  ? 'text-red-600'
                  : strengthPercentage < 80
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`}
            >
              {getStrengthText()}
            </span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full transition-all duration-300 ${getStrengthColor()}`}
            style={{ width: `${strengthPercentage}%` }}
          />
        </div>
      </div>

      {/* Requirements checklist */}
      <ul className="space-y-1">
        {requirements.map((req, index) => (
          <li
            key={index}
            className={`flex items-center gap-2 ${
              req.met ? 'text-green-600' : 'text-gray-500'
            }`}
          >
            <span className="flex-shrink-0">
              {req.met ? (
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </span>
            <span className="text-xs">{req.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
