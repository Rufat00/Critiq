import type { UserRole } from '@critiq/db';

export type UserActor = { type: 'user'; userId: string; role: UserRole };
export type SystemActor = { type: 'system'; service: string };
export type AppActor = UserActor | SystemActor;
