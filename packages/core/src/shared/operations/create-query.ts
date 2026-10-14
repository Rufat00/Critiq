import {
  createOperation,
  type OperationArgs,
  type OperationOptions,
} from './create-operation';
import type { z } from 'zod';

export function createQuery<TSchema extends z.ZodType>(
  options: OperationOptions<TSchema>,
) {
  return function <TResult>(
    handler: (args: OperationArgs<z.output<TSchema>>) => Promise<TResult>,
  ) {
    return createOperation('query', options, handler);
  };
}
