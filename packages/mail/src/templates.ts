import type { MailBrand } from './config.ts';
import { MailError, type SendInviteInput, type SendOTPInput } from './types.ts';
import { email, escapeHtml as escape, text, url } from './validation.ts';

export interface RenderedMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function frame(
  brand: MailBrand,
  title: string,
  preheader: string,
  content: string,
  plain: string,
  reason: string,
): { html: string; text: string } {
  const link = (href: string, label: string) =>
    `<a href="${escape(href)}" style="color:#0000ff;text-decoration:underline;">${label}</a>`;
  const footer = `${link(brand.privacyUrl, 'Privacy policy')}`;
  return {
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#f7f7f7;color:#202020;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;font-size:1px;color:#f7f7f7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;"><tr><td align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="560"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #ededed;border-radius:20px;">
<tr><td style="padding:28px 24px;border-bottom:1px solid #ededed;"><a href="${escape(brand.appUrl)}" style="color:#202020;font-size:24px;font-weight:700;text-decoration:none;">Critiq<span style="color:#0000ff;">.</span></a></td></tr>
<tr><td style="padding:32px 24px;font-size:16px;line-height:1.65;"><h1 style="margin:0 0 20px;font-size:28px;line-height:1.2;font-weight:700;">${escape(title)}</h1>${content}</td></tr>
<tr><td style="padding:24px;border-top:1px solid #ededed;font-size:12px;line-height:1.8;color:#707070;"><p style="margin:0 0 12px;">${escape(reason)}</p><p style="margin:0 0 12px;">${footer}</p><p style="margin:0;">${escape(brand.organizationName)}</p></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`,
    text: `Critiq\n\n${title}\n\n${plain}\n\n${reason}\n\nPrivacy policy: ${brand.privacyUrl}\n\n${brand.organizationName}`,
  };
}

function greeting(name?: string): string {
  return name === undefined
    ? 'Hello,'
    : `Hello ${text(name, 'recipientName')},`;
}

export function renderInvite(
  brand: MailBrand,
  input: SendInviteInput,
  now = new Date(),
): RenderedMail {
  const to = email(input.to, 'to');
  const hello = greeting(input.recipientName);
  const inviter = text(input.inviterName, 'inviterName');
  const hackathon = text(input.hackathonName, 'hackathonName');
  const inviteUrl = url(input.inviteUrl, 'inviteUrl', brand.production);
  if (new URL(inviteUrl).origin !== new URL(brand.appUrl).origin)
    throw new MailError('INVALID_INPUT', 'inviteUrl must belong to APP_URL.');
  if (
    !(input.expiresAt instanceof Date) ||
    !Number.isFinite(input.expiresAt.getTime()) ||
    input.expiresAt <= now
  )
    throw new MailError('INVALID_INPUT', 'expiresAt must be a future date.');
  const expiry =
    new Intl.DateTimeFormat('en', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(input.expiresAt) + ' UTC';
  const subject = `You're invited to ${hackathon}`;
  const description = `${inviter} has invited you to join ${hackathon} on Critiq.`;
  const content = `<p style="margin:0 0 16px;">${escape(hello)}</p><p style="margin:0 0 24px;">${escape(inviter)} has invited you to join <strong>${escape(hackathon)}</strong> on Critiq.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#0000ff" style="border-radius:999px;mso-padding-alt:14px 28px;"><a href="${escape(inviteUrl)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-weight:700;text-decoration:none;border-radius:999px;">View invitation</a></td></tr></table>
<p style="margin:24px 0 0;color:#707070;font-size:14px;">This invitation expires on ${escape(expiry)}. Only accept if you recognize the sender and hackathon. Do not forward this private invitation.</p>
<p style="margin:20px 0 0;font-size:13px;color:#707070;">Button not working? Copy this link into your browser:<br><a href="${escape(inviteUrl)}" style="color:#0000ff;word-break:break-all;overflow-wrap:anywhere;">${escape(inviteUrl)}</a></p>`;
  const reason =
    'You received this email because an organizer invited you to a hackathon. If this was unexpected, you can ignore it.';
  return {
    to,
    subject,
    ...frame(
      { ...brand, organizationName: hackathon },
      "You're invited",
      description,
      content,
      `${hello}\n\n${description}\n\nView invitation: ${inviteUrl}\n\nThis invitation expires on ${expiry}. Only accept if you recognize the sender and hackathon. Do not forward this private invitation.`,
      reason,
    ),
  };
}

export function renderOTP(brand: MailBrand, input: SendOTPInput): RenderedMail {
  const to = email(input.to, 'to');
  const hello = greeting(input.recipientName);
  if (
    typeof input.code !== 'string' ||
    !/^(?:\d{6}|\d{3}-\d{3})$/.test(input.code)
  )
    throw new MailError(
      'INVALID_INPUT',
      'code must contain exactly six digits, optionally formatted as 123-456.',
    );
  if (
    !Number.isInteger(input.expiresInMinutes) ||
    input.expiresInMinutes < 1 ||
    input.expiresInMinutes > 60
  )
    throw new MailError(
      'INVALID_INPUT',
      'expiresInMinutes must be an integer between 1 and 60.',
    );
  const digits = input.code.replace('-', '');
  const code = `${digits.slice(0, 3)}-${digits.slice(3)}`;
  const expiry = `${input.expiresInMinutes} ${input.expiresInMinutes === 1 ? 'minute' : 'minutes'}`;
  const content = `<p style="margin:0 0 16px;">${escape(hello)}</p><p style="margin:0 0 24px;">Enter this one-time code in Critiq to continue.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 8px;background:#dcf1fe;border:1px solid #cceafd;border-radius:12px;"><span style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:3px;color:#1717a6;white-space:nowrap;">${code}</span></td></tr></table>
<p style="margin:24px 0 0;">This code expires in <strong>${expiry}</strong> and can be used only once.</p><p style="margin:16px 0 0;font-size:14px;color:#707070;">Never share this code. Critiq support will never ask for it. If you did not request this code, ignore this email.</p>`;
  const reason =
    'This is an essential account security email sent in response to a verification request.';
  return {
    to,
    subject: 'Your Critiq verification code',
    ...frame(
      brand,
      'Your verification code',
      `Your code expires in ${expiry}. Never share it.`,
      content,
      `${hello}\n\nEnter this one-time code in Critiq to continue:\n\n${code}\n\nThis code expires in ${expiry} and can be used only once.\nNever share this code. Critiq support will never ask for it. If you did not request this code, ignore this email.`,
      reason,
    ),
  };
}
