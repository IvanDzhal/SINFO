import { assertSecrets, corsOrigins, signingSecret } from './secrets';

const good = 'x'.repeat(16) + 'Qz9'.repeat(6);
const KEYS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'LINK_SIGNING_SECRET', 'CORS_ORIGINS'];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('assertSecrets', () => {
  it('падає, якщо секрети не задані', () => {
    for (const k of KEYS) delete process.env[k];
    expect(() => assertSecrets()).toThrow();
    expect(() => signingSecret()).toThrow();
  });

  it('відхиляє слабкі значення', () => {
    process.env.JWT_ACCESS_SECRET = 'change_me_access';
    process.env.JWT_REFRESH_SECRET = good + '1';
    process.env.LINK_SIGNING_SECRET = good + '2';
    expect(() => assertSecrets()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('відхиляє однакові access/refresh', () => {
    process.env.JWT_ACCESS_SECRET = good;
    process.env.JWT_REFRESH_SECRET = good;
    process.env.LINK_SIGNING_SECRET = good + '2';
    expect(() => assertSecrets()).toThrow(/відрізнятися/);
  });

  it('приймає міцні різні секрети', () => {
    process.env.JWT_ACCESS_SECRET = good + 'a';
    process.env.JWT_REFRESH_SECRET = good + 'b';
    process.env.LINK_SIGNING_SECRET = good + 'c';
    expect(() => assertSecrets()).not.toThrow();
  });
});

describe('corsOrigins', () => {
  it('парсить список', () => {
    process.env.CORS_ORIGINS = 'https://a.com, https://b.com';
    expect(corsOrigins()).toEqual(['https://a.com', 'https://b.com']);
  });
});
