# @critiq/mail

Server-only email delivery for Critiq. The provider exposes exactly two send
operations: `sendInvite` and `sendOTP`. It owns delivery and presentation, not
account provisioning, token/code generation, verification, expiration enforcement,
rate limiting, or authorization. Registration and Better Auth remain untouched.

## Usage

Add `@critiq/mail: workspace:*` to the consuming server package when integrating.
Do not import into client components. Environment is read when the factory is
called; reuse the resulting provider. No network request happens during creation.
Environment loading belongs to the host application (the package does not load
`.env` files itself).

```ts
import { createMailProvider, MailError } from '@critiq/mail';

// Pass the hackathon name from trusted server data when it is available.
const mail = createMailProvider(process.env, {
  hackathonName: 'Spring Hackathon',
});

await mail.sendInvite({
  to: 'judge@example.com',
  recipientName: 'Jamie', // optional
  inviterName: 'Alex',
  hackathonName: 'Spring Hackathon',
  inviteUrl: 'https://your-critiq.example/invitations/private-token',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
});

await mail.sendOTP({
  to: 'judge@example.com',
  code: '012345', // also accepts '012-345'; both render as 012-345
  expiresInMinutes: 5,
});
```

`accepted` means the provider accepted the message, not that it reached an inbox.
Results include the provider and its message ID when available. Invalid inputs
throw `MailError` with `INVALID_INPUT`; configuration errors use `CONFIGURATION`;
provider rejection, timeout, or unconfirmed delivery uses `DELIVERY_FAILED` with
safe text. Raw provider errors and message contents are never logged or exposed.
There are no automatic retries or delivery failovers: timeouts can happen after
acceptance, so callers must account for possible duplicate messages when retrying.

## Provider selection

| Configuration                                  | Provider                                               |
| ---------------------------------------------- | ------------------------------------------------------ |
| `NO_EMAIL_LOWER_SECURITY_MODE=true`            | Disabled; no credentials/footer configuration required |
| `SENDGRID_API_KEY`                             | SendGrid HTTPS API                                     |
| `EMAIL_HOST=smtp.gmail.com`                    | Gmail SMTP                                             |
| `EMAIL_HOST=email-smtp.<region>.amazonaws.com` | SES SMTP (also supports `.com.cn`)                     |
| Other `EMAIL_HOST`                             | Regular SMTP                                           |

Configuring both `SENDGRID_API_KEY` and `EMAIL_HOST` is an error. Missing or broken
configuration never implicitly disables email. Boolean settings accept only
`true` or `false`. Existing `SMTP_*` variables belong to the current auth stub and
Compose setup; this package uses `APP_URL`, `EMAIL_*`, and the two explicit settings above.

### Common settings

`EMAIL_FROM` is required: supply a single bare sender address without a display name.
`APP_URL` is shared with authentication and defaults to `http://localhost:3000` in
development. Set it to your HTTPS installation URL in production. Invitation URLs
must use this origin. The privacy link is derived as `/privacy` on that origin;
publish the policy at that path.

Pass the hackathon name from trusted server data in the factory's optional second
argument: `createMailProvider(process.env, { hackathonName })`. It supplies the
footer identity and default sender name; the fallback is `Critiq Judging`.
Invitation footers use the invitation's hackathon name. `EMAIL_FROM_NAME` remains
an optional sender display-name override. There are no separate email app/privacy
URLs, organization, support, or postal-address environment variables.

Links require HTTPS; localhost HTTP is allowed outside production. This package
does not create a privacy policy or route. Email rendering uses Critiq's white
panels, gray borders, vivid blue pill buttons, and soft blue code panel. Both HTML
and plain text are sent, with escaped content and no remote assets.

### Gmail SMTP

```dotenv
EMAIL_HOST=smtp.gmail.com
EMAIL_FROM=your-account@gmail.com
EMAIL_USERNAME=your-account@gmail.com
EMAIL_PASSWORD=your-google-app-password
```

Use a [Google app password](https://support.google.com/accounts/answer/185833?hl=en)
with 2-Step Verification enabled. The sender must match the username.

### SendGrid

```dotenv
SENDGRID_API_KEY=your-api-key
EMAIL_FROM=verified-sender@example.com
EMAIL_FROM_NAME=Critiq
```

Use a [SendGrid API key](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/api-keys)
with Mail Send access and an authenticated/verified sender. The package uses the
[Mail Send API](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send)
through Node's fetch; an additional SDK is unnecessary. Click/open/subscription
tracking is disabled in each request. Account-level suppression rules still apply;
the package does not bypass them.

### AWS SES SMTP

```dotenv
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_FROM=verified-sender@example.com
EMAIL_USERNAME=your-ses-smtp-username
EMAIL_PASSWORD=your-ses-smtp-password
```

Use [region-specific SES SMTP credentials](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html),
not an AWS secret access key. Verify the sender and satisfy SES sandbox/production
access requirements for the recipients you intend to contact.

### Regular SMTP / local Mailpit

SMTP defaults to port `587` with required STARTTLS. Port `465` defaults to implicit
TLS. Override with `EMAIL_PORT`, `EMAIL_SECURE`, and `EMAIL_REQUIRE_TLS` as needed.
Certificate verification remains enabled. Credentials are optional for generic
SMTP but must be configured together when used. Connections have bounded timeouts.

```dotenv
EMAIL_HOST=127.0.0.1
EMAIL_PORT=1025
EMAIL_SECURE=false
EMAIL_REQUIRE_TLS=false
EMAIL_FROM=noreply@critiq.test
```

Clear `EMAIL_USERNAME` and `EMAIL_PASSWORD` for Mailpit. A container on the Compose
network can use `mailpit` as its host. Unencrypted SMTP is permitted only outside
production with `localhost`, `127.0.0.1`, or `mailpit`. Gmail and SES always require
TLS. SMTP transport uses Nodemailer, with file/URL attachment access disabled.

## Explicit lower-security mode

`NO_EMAIL_LOWER_SECURITY_MODE=true` overrides all provider settings. Both methods
return `{ status: 'skipped', provider: 'disabled', reason: 'lower-security-mode' }`
without generating, logging, or sending a code or invitation. This is an explicit
opt-out from email delivery, not proof of verification or a successful send.

This package does not change authentication. Future auth integration must explicitly
choose its intended reduced-security workflow. Never treat `skipped` as a verified
email, successful OTP challenge, or delivered invitation. Delivery failure must
never switch to this mode. The current Better Auth stub still behaves independently.

## System email scope

These templates contain only invitation/account security content. There are no
unsubscribe links, headers, settings, or endpoints. OTPs contain security guidance;
invites explain why they were sent and how to ignore unexpected invitations.

Deployment owners must publish an accurate privacy policy and ensure lawful
recipient contact and provider/domain setup
(SPF, DKIM, DMARC). Footer links alone do not establish legal compliance. The
[FTC guidance](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
distinguishes transactional/relationship messages from commercial messages based on
primary purpose. Keep promotional content out of this system-email package; reassess
applicable laws and provider requirements before expanding its scope.

## Checks and previews

```sh
pnpm --filter @critiq/mail typecheck
pnpm --filter @critiq/mail test
pnpm --filter @critiq/mail preview
```

Tests cover provider selection, safe failure behavior, validation, HTML escaping,
OTP formatting, mocked SendGrid requests, and actual SMTP delivery to a local fake
server. Preview generates fictional invite/OTP HTML and text files under
`/tmp/critiq-mail-preview` (or the platform temp directory) without sending mail.
Live provider acceptance and inbox rendering still need deployment testing with
real credentials and target mail clients.
