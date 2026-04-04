import jwt from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRY = "1d";
const REFRESH_TOKEN_EXPIRY = "7d";
const REMEMBER_ME_REFRESH_EXPIRY = "30d";

/**
 * Generate access + refresh tokens for a user.
 */
export function generateTokens(user, rememberMe = false) {
  const accessToken = jwt.sign(
    {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role || "user",
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: rememberMe ? REMEMBER_ME_REFRESH_EXPIRY : REFRESH_TOKEN_EXPIRY },
  );

  return { accessToken, refreshToken };
}

/**
 * Set httpOnly auth cookies on the response.
 */
export function setAuthCookies(reply, accessToken, refreshToken, rememberMe = false) {
  const isProd = process.env.NODE_ENV === "production";
  const domain = process.env.COOKIE_DOMAIN || undefined;

  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    domain,
    path: "/",
  };

  reply.setCookie("accessToken", accessToken, {
    ...base,
    maxAge: 24 * 60 * 60, // 1 day in seconds
  });

  reply.setCookie("refreshToken", refreshToken, {
    ...base,
    maxAge: (rememberMe ? 30 : 7) * 24 * 60 * 60,
  });
}

/**
 * Clear auth cookies (logout).
 */
export function clearAuthCookies(reply) {
  const isProd = process.env.NODE_ENV === "production";
  const domain = process.env.COOKIE_DOMAIN || undefined;

  const base = { httpOnly: true, secure: isProd, sameSite: "lax", domain, path: "/" };

  reply.setCookie("accessToken", "", { ...base, maxAge: 0 });
  reply.setCookie("refreshToken", "", { ...base, maxAge: 0 });
}
