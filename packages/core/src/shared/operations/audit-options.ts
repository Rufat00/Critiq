import type { AppContext } from '../../context';

export type AuditJson =
  | string
  | number
  | boolean
  | null
  | AuditJson[]
  | { [key: string]: AuditJson };

export type AuditArgs<TInput, TResult> = {
  ctx: AppContext;
  input: TInput;
  result: TResult;
};

export type AuditOptions<TInput, TResult> = {
  entityType: string;
  getEntityId(args: AuditArgs<TInput, TResult>): string | null;
  getBefore?(args: AuditArgs<TInput, TResult>): AuditJson | undefined;
  getAfter?(args: AuditArgs<TInput, TResult>): AuditJson | undefined;
};
