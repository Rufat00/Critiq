export type MailProviderName =
  | 'gmail'
  | 'ses'
  | 'smtp'
  | 'sendgrid'
  | 'disabled';

export type MailDeliveryResult =
  | {
      status: 'accepted';
      provider: Exclude<MailProviderName, 'disabled'>;
      messageId?: string;
    }
  | { status: 'skipped'; provider: 'disabled'; reason: 'lower-security-mode' };

export interface SendInviteInput {
  to: string;
  recipientName?: string;
  inviterName: string;
  hackathonName: string;
  inviteUrl: string;
  expiresAt: Date;
}

export interface SendOTPInput {
  to: string;
  recipientName?: string;
  /** Six digits, with or without the display hyphen. Never generated here. */
  code: string;
  expiresInMinutes: number;
}

export interface MailProviderOptions {
  /** The installation's hackathon name from trusted server data. */
  hackathonName?: string;
}

export interface MailProvider {
  readonly name: MailProviderName;
  sendInvite(input: SendInviteInput): Promise<MailDeliveryResult>;
  sendOTP(input: SendOTPInput): Promise<MailDeliveryResult>;
}

export class MailError extends Error {
  readonly code: 'CONFIGURATION' | 'INVALID_INPUT' | 'DELIVERY_FAILED';

  constructor(
    code: 'CONFIGURATION' | 'INVALID_INPUT' | 'DELIVERY_FAILED',
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = 'MailError';
  }
}
