import { ulid } from 'ulid';

export function newId(prefix: string): string {
  return `${prefix}_${ulid()}`;
}
