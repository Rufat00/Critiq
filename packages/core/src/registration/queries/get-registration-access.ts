import { createQuery } from '../../shared/operations';
import { requireRegistrationAccess } from '../lib/require-registration-access';
import { getRegistrationAccessSchema } from '../schemas/get-registration-access-schema';

export const getRegistrationAccess = createQuery({
  name: 'registration.access',
  schema: getRegistrationAccessSchema,
  allowSystem: true,
})(async ({ ctx, input }) => {
  const access = await requireRegistrationAccess(ctx, input);
  return {
    setup: access.kind === 'owner',
    email: access.kind === 'invitation' ? access.invitation.email : null,
  };
});
