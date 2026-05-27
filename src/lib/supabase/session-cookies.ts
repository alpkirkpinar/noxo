type CookieOptions = {
  maxAge?: number;
  expires?: Date | string | number;
  [key: string]: unknown;
};

export function toSessionCookieOptions(value: string, options: CookieOptions) {
  if (value === "" || options.maxAge === 0) {
    return options;
  }

  const { maxAge: _maxAge, expires: _expires, ...sessionOptions } = options;
  return sessionOptions;
}
