export class RegistrationCodeTimeoutError extends Error {
  constructor() {
    super(
      'We could not confirm that your code was sent. Please wait a minute, then try again.',
    );
    this.name = 'RegistrationCodeTimeoutError';
  }
}

// A Server Action cannot be cancelled by the caller. A timed-out send may still
// finish, so ask the user to respect the server's one-minute resend cooldown.
export async function withRegistrationCodeTimeout<T>(
  request: Promise<T>,
  timeoutMs = 20_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new RegistrationCodeTimeoutError()),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([request, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
