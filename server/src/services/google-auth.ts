type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  error_description?: string;
};

export type GoogleUser = {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
};

const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUser> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );

  if (!response.ok) {
    throw new Error('Invalid Google ID token');
  }

  const tokenInfo = (await response.json()) as GoogleTokenInfo;
  if (tokenInfo.error_description) {
    throw new Error(tokenInfo.error_description);
  }

  if (googleClientId && tokenInfo.aud !== googleClientId) {
    throw new Error('Google ID token audience mismatch');
  }

  if (!tokenInfo.sub) {
    throw new Error('Google ID token missing subject');
  }

  return {
    id: tokenInfo.sub,
    email: tokenInfo.email,
    name: tokenInfo.name,
    picture: tokenInfo.picture
  };
}
