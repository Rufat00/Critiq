import { MailError, type MailProviderName } from './types.ts';
import { email, text, url } from './validation.ts';

export interface MailBrand {
  appUrl: string;
  privacyUrl: string;
  organizationName: string;
  production: boolean;
}

type EnabledProvider = Exclude<MailProviderName, 'disabled'>;
export type MailConfig =
  | { provider: 'disabled' }
  | {
      provider: EnabledProvider;
      from: { address: string; name: string };
      brand: MailBrand;
      sendgridApiKey?: string;
      smtp?: {
        host: string;
        port: number;
        secure: boolean;
        requireTLS: boolean;
        auth?: { user: string; pass: string };
      };
    };

function boolean(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: boolean,
): boolean {
  const value = env[key]?.trim();
  if (!value) return fallback;
  if (value !== 'true' && value !== 'false')
    throw new MailError('CONFIGURATION', `${key} must be true or false.`);
  return value === 'true';
}

export function readMailConfig(
  env: NodeJS.ProcessEnv,
  hackathonName?: string,
): MailConfig {
  if (boolean(env, 'NO_EMAIL_LOWER_SECURITY_MODE', false))
    return { provider: 'disabled' };
  const required = (key: string) => {
    const value = env[key]?.trim();
    if (!value)
      throw new MailError(
        'CONFIGURATION',
        `${key} is required for email delivery.`,
      );
    return value;
  };
  try {
    const host = env.EMAIL_HOST?.trim();
    const key = env.SENDGRID_API_KEY?.trim();
    if (host && key)
      throw new MailError(
        'CONFIGURATION',
        'Configure either SENDGRID_API_KEY or EMAIL_HOST, not both.',
      );
    if (!host && !key)
      throw new MailError(
        'CONFIGURATION',
        'Configure SENDGRID_API_KEY or EMAIL_HOST, or explicitly enable NO_EMAIL_LOWER_SECURITY_MODE.',
      );
    const production = env.NODE_ENV === 'production';
    const provider: EnabledProvider = key
      ? 'sendgrid'
      : host?.toLowerCase() === 'smtp.gmail.com'
        ? 'gmail'
        : /^email-smtp\.[a-z0-9-]+\.amazonaws\.com(?:\.cn)?$/i.test(host!)
          ? 'ses'
          : 'smtp';
    const appUrl = url(
      env.APP_URL?.trim() || 'http://localhost:3000',
      'APP_URL',
      production,
    );
    const organizationName = text(
      hackathonName?.trim() || 'Critiq Judging',
      'hackathonName',
    );
    const config: Exclude<MailConfig, { provider: 'disabled' }> = {
      provider,
      from: {
        address: email(required('EMAIL_FROM'), 'EMAIL_FROM'),
        name: text(
          env.EMAIL_FROM_NAME?.trim() || organizationName,
          'EMAIL_FROM_NAME',
        ),
      },
      brand: {
        appUrl,
        privacyUrl: new URL('/privacy', appUrl).href,
        organizationName,
        production,
      },
    };
    if (key) {
      config.sendgridApiKey = text(key, 'SENDGRID_API_KEY', 512);
      return config;
    }
    text(host!, 'EMAIL_HOST', 253);
    if (!/^[a-z0-9.-]+$/i.test(host!))
      throw new MailError(
        'CONFIGURATION',
        'EMAIL_HOST must be a hostname or IPv4 address.',
      );
    const portValue = env.EMAIL_PORT?.trim() || '587';
    const port = Number(portValue);
    if (
      !/^\d+$/.test(portValue) ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    )
      throw new MailError(
        'CONFIGURATION',
        'EMAIL_PORT must be between 1 and 65535.',
      );
    const secure = boolean(env, 'EMAIL_SECURE', port === 465);
    const requireTLS = boolean(env, 'EMAIL_REQUIRE_TLS', true);
    if (
      !secure &&
      !requireTLS &&
      (production ||
        provider !== 'smtp' ||
        !['localhost', '127.0.0.1', 'mailpit'].includes(host!.toLowerCase()))
    ) {
      throw new MailError(
        'CONFIGURATION',
        'Unencrypted SMTP is allowed only for local development Mailpit.',
      );
    }
    const user = env.EMAIL_USERNAME?.trim();
    const pass = env.EMAIL_PASSWORD;
    if (!!user !== !!pass || (provider !== 'smtp' && (!user || !pass)))
      throw new MailError(
        'CONFIGURATION',
        'EMAIL_USERNAME and EMAIL_PASSWORD must be configured together; Gmail and SES require both.',
      );
    if (provider === 'gmail' && user !== config.from.address)
      throw new MailError(
        'CONFIGURATION',
        'Gmail EMAIL_FROM must match EMAIL_USERNAME.',
      );
    config.smtp = {
      host: host!,
      port,
      secure,
      requireTLS,
      ...(user && pass
        ? { auth: { user: text(user, 'EMAIL_USERNAME', 254), pass } }
        : {}),
    };
    return config;
  } catch (error) {
    if (error instanceof MailError && error.code === 'CONFIGURATION')
      throw error;
    throw new MailError(
      'CONFIGURATION',
      error instanceof MailError
        ? error.message
        : 'Email configuration is invalid.',
    );
  }
}
