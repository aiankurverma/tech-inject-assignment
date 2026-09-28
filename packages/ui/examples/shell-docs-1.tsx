import { ShellDocs } from "@/components/crm/shell-docs";

const H = ({ id, children }: { id: string; children: string }) => (
  <h2 id={id} className="scroll-mt-4 pt-4 text-base font-semibold text-crm-fg">
    {children}
  </h2>
);

export default function Example() {
  return (
    <ShellDocs
      className="w-[1100px]"
      title="Northwind API"
      groups={[
        {
          label: "Getting started",
          pages: [
            {
              id: "auth",
              title: "Authentication",
              updatedAt: "Sep 21, 2026",
              headings: [
                { id: "keys", label: "API keys" },
                { id: "scopes", label: "Scopes", level: 3 },
                { id: "rotation", label: "Key rotation" },
                { id: "errors", label: "Errors" },
              ],
              content: (
                <>
                  <p>
                    Every request sends a bearer token in the Authorization header. Keys are scoped
                    to a single workspace.
                  </p>
                  <H id="keys">API keys</H>
                  <p>
                    Create keys under Admin → API keys. Test-mode keys never touch live records.
                  </p>
                  <H id="scopes">Scopes</H>
                  <p>Grant the narrowest scope: contacts:read, deals:write, webhooks:manage.</p>
                  <H id="rotation">Key rotation</H>
                  <p>
                    Rotate keys every 90 days. Old keys keep working for 24 hours after rotation so
                    deployments do not break.
                  </p>
                  <H id="errors">Errors</H>
                  <p>401 means the key is missing or revoked; 403 means it lacks the scope.</p>
                </>
              ),
            },
            {
              id: "rate",
              title: "Rate limits",
              content: <p>600 requests per minute per key, burst 100. Honor Retry-After.</p>,
            },
          ],
        },
        {
          label: "Resources",
          pages: [
            {
              id: "contacts",
              title: "Contacts",
              content: <p>Create, update and merge contacts. Emails are unique per workspace.</p>,
            },
            {
              id: "deals",
              title: "Deals",
              content: (
                <p>Deals move through pipeline stages; amounts are stored in minor units.</p>
              ),
            },
            {
              id: "webhooks",
              title: "Webhooks",
              content: <p>Payloads are signed with HMAC-SHA256; verify before trusting them.</p>,
            },
          ],
        },
      ]}
    />
  );
}
