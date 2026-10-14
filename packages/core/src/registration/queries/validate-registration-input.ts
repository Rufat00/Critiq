import { createQuery } from '../../shared/operations';
import { registerAccountSchema } from '../schemas/register-account-schema';
export const validateRegistrationInput = createQuery({
  name: 'registration.validate',
  schema: registerAccountSchema,
  allowSystem: true,
})(async () => undefined);
