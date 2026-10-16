import nodemailer from 'nodemailer';
import { readMailConfig, type MailConfig } from './config.ts';
import { renderInvite, renderOTP, type RenderedMail } from './templates.ts';
import {
  MailError,
  type MailDeliveryResult,
  type MailProvider,
  type MailProviderOptions,
} from './types.ts';

/** Server-only infrastructure. Construct once, then reuse for both message types. */
export function createMailProvider(
  env: NodeJS.ProcessEnv = process.env,
  options: MailProviderOptions = {},
): MailProvider {
  if ('window' in globalThis)
    throw new MailError(
      'CONFIGURATION',
      'The mail package may only run on the server.',
    );
  const config = readMailConfig(env, options.hackathonName);
  if (config.provider === 'disabled') {
    const skipped = async (): Promise<MailDeliveryResult> => ({
      status: 'skipped',
      provider: 'disabled',
      reason: 'lower-security-mode',
    });
    return { name: 'disabled', sendInvite: skipped, sendOTP: skipped };
  }
  const transport = config.smtp
    ? nodemailer.createTransport({
        ...config.smtp,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
        tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        disableFileAccess: true,
        disableUrlAccess: true,
        logger: false,
        debug: false,
      })
    : undefined;

  const send = async (message: RenderedMail): Promise<MailDeliveryResult> => {
    try {
      if (config.provider === 'sendgrid')
        return await sendViaSendgrid(config, message);
      const result = await transport!.sendMail({
        from: config.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      if (!result.accepted?.length || result.rejected?.length)
        throw new Error();
      return {
        status: 'accepted',
        provider: config.provider,
        messageId: result.messageId,
      };
    } catch {
      // Never expose provider responses, addresses, credentials, message contents, or OTPs.
      // No automatic retries: a timeout may follow provider acceptance.
      throw new MailError(
        'DELIVERY_FAILED',
        'Email delivery could not be confirmed. Please try again.',
      );
    }
  };
  return {
    name: config.provider,
    sendInvite: async (input) => send(renderInvite(config.brand, input)),
    sendOTP: async (input) => send(renderOTP(config.brand, input)),
  };
}

async function sendViaSendgrid(
  config: Exclude<MailConfig, { provider: 'disabled' }>,
  message: RenderedMail,
): Promise<MailDeliveryResult> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${config.sendgridApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: message.to }] }],
      from: { email: config.from.address, name: config.from.name },
      subject: message.subject,
      content: [
        { type: 'text/plain', value: message.text },
        { type: 'text/html', value: message.html },
      ],
      // Tracking must not wrap private invitations or security message links.
      tracking_settings: {
        click_tracking: { enable: false, enable_text: false },
        open_tracking: { enable: false },
        subscription_tracking: { enable: false },
      },
    }),
  });
  await response.body?.cancel();
  if (response.status !== 202) throw new Error();
  const messageId = response.headers.get('x-message-id');
  return {
    status: 'accepted',
    provider: 'sendgrid',
    ...(messageId ? { messageId } : {}),
  };
}
