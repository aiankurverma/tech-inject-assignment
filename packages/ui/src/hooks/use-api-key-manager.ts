import * as React from "react";
import type {
  ApiKey,
  ApiKeyStatus,
  CreateApiKeyInput,
  IssuedApiKey,
} from "@/components/crm/pro-api-key-manager/types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Cryptographically random base62 string (rejection sampling, no modulo bias). */
export function randomSecret(length = 40): string {
  const out: string[] = [];
  const buf = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < 248 && out.length < length) out.push(ALPHABET[b % 62]!);
    }
  }
  return out.join("");
}

export function keyStatus(key: ApiKey, now: number): ApiKeyStatus {
  if (key.revokedAt) return "revoked";
  if (key.expiresAt && Date.parse(key.expiresAt) <= now) return "expired";
  return "active";
}

/** Local issuer used when no backend callback is supplied (demos, storybooks, tests). */
export function issueLocalKey(input: CreateApiKeyInput, createdBy?: string): IssuedApiKey {
  const prefix = `kb_${input.environment}_`;
  const secret = prefix + randomSecret(40);
  return {
    secret,
    key: {
      id: `key_${randomSecret(12)}`,
      name: input.name,
      environment: input.environment,
      prefix,
      last4: secret.slice(-4),
      scopes: input.scopes,
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt,
      lastUsedAt: null,
      revokedAt: null,
      createdBy,
      usage: [],
    },
  };
}

interface Options {
  keys?: ApiKey[];
  defaultKeys?: ApiKey[];
  onKeysChange?: (keys: ApiKey[]) => void;
  onCreate?: (input: CreateApiKeyInput) => Promise<IssuedApiKey> | IssuedApiKey;
  onRotate?: (key: ApiKey) => Promise<IssuedApiKey> | IssuedApiKey;
  onRevoke?: (key: ApiKey) => Promise<void> | void;
  currentUser?: string;
}

const EMPTY: ApiKey[] = [];

/**
 * Controlled/uncontrolled key store. All mutations go through the async callbacks first, and the
 * list only changes once they resolve, so a failed backend call never leaves the UI out of sync.
 */
export function useApiKeyManager({
  keys: keysProp,
  defaultKeys,
  onKeysChange,
  onCreate,
  onRotate,
  onRevoke,
  currentUser,
}: Options) {
  const [inner, setInner] = React.useState<ApiKey[]>(defaultKeys ?? EMPTY);
  const controlled = keysProp !== undefined;
  const keys = controlled ? keysProp : inner;
  const keysRef = React.useRef(keys);
  keysRef.current = keys;

  const commit = React.useCallback(
    (next: ApiKey[]) => {
      if (!controlled) setInner(next);
      onKeysChange?.(next);
    },
    [controlled, onKeysChange],
  );

  const create = React.useCallback(
    async (input: CreateApiKeyInput): Promise<IssuedApiKey> => {
      const issued = onCreate ? await onCreate(input) : issueLocalKey(input, currentUser);
      commit([issued.key, ...keysRef.current]);
      return issued;
    },
    [commit, onCreate, currentUser],
  );

  const rotate = React.useCallback(
    async (key: ApiKey): Promise<IssuedApiKey> => {
      const issued = onRotate
        ? await onRotate(key)
        : issueLocalKey(
            {
              name: key.name,
              environment: key.environment,
              scopes: key.scopes,
              expiresAt: key.expiresAt,
            },
            currentUser,
          );
      const revokedAt = new Date().toISOString();
      commit([
        issued.key,
        ...keysRef.current.map((k) => (k.id === key.id ? { ...k, revokedAt } : k)),
      ]);
      return issued;
    },
    [commit, onRotate, currentUser],
  );

  const revoke = React.useCallback(
    async (key: ApiKey) => {
      await onRevoke?.(key);
      const revokedAt = new Date().toISOString();
      commit(keysRef.current.map((k) => (k.id === key.id ? { ...k, revokedAt } : k)));
    },
    [commit, onRevoke],
  );

  return { keys, create, rotate, revoke };
}
