// Fail before accepting requests; never include credential values in errors.
export function requiredEnv(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value || /placeholder|YOUR-PROJECT|YOUR[_-].*KEY/i.test(value)) {
    throw new Error(`Required environment variable is not configured: ${name}. Check server/.env.`);
  }
  return value;
}
