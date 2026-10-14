import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { test } from 'node:test';
import { readMailConfig } from './config.ts';
import { createMailProvider } from './provider.ts';
import { renderInvite, renderOTP } from './templates.ts';
import { MailError } from './types.ts';

const environment = {
  NODE_ENV: 'test',
  EMAIL_HOST: 'smtp.gmail.com',
  EMAIL_FROM: 'sender@example.com',
  EMAIL_USERNAME: 'sender@example.com',
  EMAIL_PASSWORD: 'test-password',
  APP_URL: 'https://critiq.example',
};
const config = readMailConfig(environment);
if (config.provider === 'disabled') throw new Error();
const brand = config.brand;
const otp = { to: 'judge@example.com', code: '012345', expiresInMinutes: 5 };
const invitation = {
  to: 'judge@example.com',
  inviterName: 'Alex',
  hackathonName: 'Spring Hackathon',
  inviteUrl: 'https://critiq.example/invite?token=private&test=1',
  expiresAt: new Date('2099-01-01T12:00:00Z'),
};

test('selects Gmail, SES, SMTP, or SendGrid from environment; ambiguous or absent providers fail', () => {
  assert.equal(config.provider, 'gmail');
  assert.equal(
    readMailConfig({
      ...environment,
      EMAIL_HOST: 'email-smtp.us-east-1.amazonaws.com',
    }).provider,
    'ses',
  );
  assert.equal(
    readMailConfig({ ...environment, EMAIL_HOST: 'smtp.example.com' }).provider,
    'smtp',
  );
  assert.equal(
    readMailConfig({
      ...environment,
      EMAIL_HOST: '',
      SENDGRID_API_KEY: 'test-key',
    }).provider,
    'sendgrid',
  );
  for (const env of [
    {},
    { ...environment, SENDGRID_API_KEY: 'test-key' },
    { ...environment, EMAIL_PASSWORD: '' },
    { ...environment, EMAIL_PORT: '1e3' },
    { ...environment, EMAIL_SECURE: 'yes' },
    { ...environment, EMAIL_FROM: 'a@example.com\r\nBcc:b@example.com' },
    {
      ...environment,
      NODE_ENV: 'production',
      EMAIL_HOST: 'localhost',
      EMAIL_REQUIRE_TLS: 'false',
    },
  ]) {
    assert.throws(
      () => readMailConfig(env),
      (error: unknown) =>
        error instanceof MailError && error.code === 'CONFIGURATION',
    );
  }
  assert.equal(
    readMailConfig({
      ...environment,
      EMAIL_HOST: 'localhost',
      EMAIL_PORT: '1025',
      EMAIL_USERNAME: '',
      EMAIL_PASSWORD: '',
      EMAIL_REQUIRE_TLS: 'false',
    }).provider,
    'smtp',
  );
});

test('uses APP_URL, derives privacy, and defaults the hackathon identity without extra environment variables', () => {
  const defaultConfig = readMailConfig(environment);
  assert.notEqual(defaultConfig.provider, 'disabled');
  if (defaultConfig.provider === 'disabled') throw new Error();
  assert.equal(defaultConfig.brand.appUrl, environment.APP_URL + '/');
  assert.equal(
    defaultConfig.brand.privacyUrl,
    environment.APP_URL + '/privacy',
  );
  assert.equal(defaultConfig.brand.organizationName, 'Critiq Judging');
  assert.equal(defaultConfig.from.name, 'Critiq Judging');
  const named = readMailConfig(environment, 'Spring Hackathon');
  if (named.provider === 'disabled') throw new Error();
  assert.equal(named.brand.organizationName, 'Spring Hackathon');
  assert.equal(named.from.name, 'Spring Hackathon');
  const local = readMailConfig({ ...environment, APP_URL: '' });
  if (local.provider === 'disabled') throw new Error();
  assert.equal(local.brand.privacyUrl, 'http://localhost:3000/privacy');
  assert.throws(
    () =>
      readMailConfig({ ...environment, NODE_ENV: 'production', APP_URL: '' }),
    MailError,
  );
});

test('explicit lower-security mode requires no mail configuration and reports skipped delivery', async () => {
  const provider = createMailProvider({ NO_EMAIL_LOWER_SECURITY_MODE: 'true' });
  assert.equal(provider.name, 'disabled');
  assert.deepEqual(await provider.sendOTP(otp), {
    status: 'skipped',
    provider: 'disabled',
    reason: 'lower-security-mode',
  });
  assert.equal((await provider.sendInvite(invitation)).status, 'skipped');
  assert.throws(
    () => createMailProvider({ NO_EMAIL_LOWER_SECURITY_MODE: 'yes' }),
    MailError,
  );
});

test('OTP preserves leading zeroes, validates digits and expiry, and keeps codes out of subject/preheader', () => {
  for (const code of ['012345', '012-345']) {
    const mail = renderOTP(brand, { ...otp, code });
    assert.match(mail.html, /012-345/);
    assert.match(mail.text, /012-345/);
    assert.doesNotMatch(mail.subject, /012/);
    assert.doesNotMatch(mail.html, /unsubscribe|preferences|List-Unsubscribe/i);
  }
  for (const code of ['12345', '1234567', '123-45x', '<script>'])
    assert.throws(() => renderOTP(brand, { ...otp, code }), MailError);
  for (const expiresInMinutes of [0, 61, 1.5])
    assert.throws(
      () => renderOTP(brand, { ...otp, expiresInMinutes }),
      MailError,
    );
  assert.throws(
    () => renderOTP(brand, { ...otp, to: 'a@example.com,b@example.com' }),
    MailError,
  );
});

test('invites escape content, constrain URLs, and require a valid future expiry', () => {
  const mail = renderInvite(brand, {
    ...invitation,
    inviterName: '<img src=x onerror=alert(1)>',
  });
  assert.match(mail.html, /&lt;img/);
  assert.doesNotMatch(mail.html, /<img|unsubscribe|preferences/i);
  assert.match(mail.html, /token=private&amp;test=1/);
  assert.match(mail.text, /Privacy policy:/);
  assert.doesNotMatch(mail.text, /Contact support:|Test Street/);
  assert.ok(mail.text.endsWith(invitation.hackathonName));
  for (const inviteUrl of [
    'javascript:alert(1)',
    'https://evil.example/invite',
    'https://user:pass@critiq.example/invite',
  ])
    assert.throws(
      () => renderInvite(brand, { ...invitation, inviteUrl }),
      MailError,
    );
  assert.throws(
    () => renderInvite(brand, { ...invitation, expiresAt: new Date(0) }),
    MailError,
  );
  assert.throws(
    () =>
      renderInvite(brand, { ...invitation, expiresAt: new Date('invalid') }),
    MailError,
  );
});

test('SendGrid sends both formats with tracking disabled; provider errors never expose secrets', async (context) => {
  const requests: { url: string; options: RequestInit }[] = [];
  const mock = context.mock.method(
    globalThis,
    'fetch',
    async (url: string, options: RequestInit) => {
      requests.push({ url, options });
      return new Response(null, {
        status: 202,
        headers: { 'x-message-id': 'test-message-id' },
      });
    },
  );
  const provider = createMailProvider({
    ...environment,
    EMAIL_HOST: '',
    SENDGRID_API_KEY: 'test-key',
  });
  assert.deepEqual(await provider.sendOTP(otp), {
    status: 'accepted',
    provider: 'sendgrid',
    messageId: 'test-message-id',
  });
  await provider.sendInvite(invitation);
  assert.equal(requests.length, 2);
  const request = requests[0]!;
  assert.equal(request.url, 'https://api.sendgrid.com/v3/mail/send');
  const body = JSON.parse(request.options.body as string);
  assert.equal(body.from.email, environment.EMAIL_FROM);
  assert.equal(body.personalizations[0].to[0].email, otp.to);
  assert.deepEqual(
    body.content.map((entry: { type: string }) => entry.type),
    ['text/plain', 'text/html'],
  );
  assert.equal(body.tracking_settings.click_tracking.enable, false);
  assert.equal(body.headers, undefined);
  assert.equal(body.reply_to, undefined);
  mock.mock.mockImplementation(
    async () => new Response('secret provider details', { status: 401 }),
  );
  await assert.rejects(
    provider.sendOTP(otp),
    (error: unknown) =>
      error instanceof MailError &&
      error.code === 'DELIVERY_FAILED' &&
      !String(error).includes('secret'),
  );
  mock.mock.mockImplementation(async () => {
    throw new Error('test-key 012345');
  });
  await assert.rejects(
    provider.sendInvite(invitation),
    (error: unknown) =>
      error instanceof MailError &&
      error.code === 'DELIVERY_FAILED' &&
      !String(error).includes('test-key'),
  );
});

test('SMTP transmits real multipart messages and detects recipient rejection', async () => {
  const messages: string[] = [];
  let rejectRecipient = false;
  const server = createServer((socket) => {
    socket.setEncoding('utf8');
    socket.write('220 localhost ESMTP\r\n');
    let buffer = '';
    let inData = false;
    let data = '';
    socket.on('data', (chunk) => {
      buffer += chunk;
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n');
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === '.') {
            messages.push(data);
            data = '';
            inData = false;
            socket.write('250 queued\r\n');
          } else data += line + '\r\n';
        } else if (/^EHLO/.test(line))
          socket.write('250-localhost\r\n250 8BITMIME\r\n');
        else if (/^RCPT/.test(line) && rejectRecipient)
          socket.write('550 rejected\r\n');
        else if (line === 'DATA') {
          inData = true;
          socket.write('354 send data\r\n');
        } else if (line === 'QUIT') socket.end('221 bye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const provider = createMailProvider({
      ...environment,
      EMAIL_HOST: '127.0.0.1',
      EMAIL_PORT: String(address.port),
      EMAIL_USERNAME: '',
      EMAIL_PASSWORD: '',
      EMAIL_REQUIRE_TLS: 'false',
    });
    assert.equal((await provider.sendOTP(otp)).status, 'accepted');
    assert.equal((await provider.sendInvite(invitation)).status, 'accepted');
    assert.equal(messages.length, 2);
    assert.match(messages[0]!, /multipart\/alternative/);
    assert.match(messages[0]!, /012-345/);
    assert.doesNotMatch(messages.join(''), /List-Unsubscribe/);
    rejectRecipient = true;
    await assert.rejects(
      provider.sendOTP(otp),
      (error: unknown) =>
        error instanceof MailError && error.code === 'DELIVERY_FAILED',
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});
