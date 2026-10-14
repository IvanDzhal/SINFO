const WEAK = /change[_-]?me|^dev$|^secret$|^password$/i;

function need(name: string, minLen = 32): string {
  const v = process.env[name];
  if (!v || v.length < minLen || WEAK.test(v)) {
    throw new Error(
      `Env ${name} не задано або надто слабке (мін. ${minLen} символів, без "change_me"). Див. .env.example`,
    );
  }
  return v;
}

/** Викликається на старті: падаємо, якщо секрети відсутні чи слабкі. */
export function assertSecrets(): void {
  need('JWT_ACCESS_SECRET');
  need('JWT_REFRESH_SECRET');
  need('LINK_SIGNING_SECRET');
  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET і JWT_REFRESH_SECRET мають відрізнятися');
  }
}

/** Ключ для HMAC-підписів посилань/токенів (окремий від JWT). */
export const signingSecret = () => need('LINK_SIGNING_SECRET');
export const accessSecret = () => need('JWT_ACCESS_SECRET');
export const refreshSecret = () => need('JWT_REFRESH_SECRET');

export function corsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
