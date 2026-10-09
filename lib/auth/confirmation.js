// Accept both the recommended token-hash template and default PKCE callbacks.
export async function confirmEmail(auth, params) {
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  const code = params.get('code');
  if (params.has('error') || params.has('error_code')) return false;
  try {
    if (tokenHash && ['email', 'signup'].includes(type)) {
      const { error } = await auth.verifyOtp({ type, token_hash: tokenHash });
      return !error;
    }
    if (code) {
      const { error } = await auth.exchangeCodeForSession(code);
      return !error;
    }
    return false;
  } catch {
    return false;
  }
}

export function preserveSessionResponse(source, target) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  for (const name of ['cache-control', 'expires', 'pragma']) {
    const value = source.headers.get(name);
    if (value) target.headers.set(name, value);
  }
  return target;
}

export function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\\\x00-\x1f]/.test(value) ? value : '/';
}
