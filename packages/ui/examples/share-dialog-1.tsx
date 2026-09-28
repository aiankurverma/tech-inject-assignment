import * as React from "react";
import { Button } from "@/components/crm/button";
import { ShareDialog, type LinkAccess, type ShareMember } from "@/components/crm/share-dialog";

const initial: ShareMember[] = [
  { id: "u1", name: "Alex Santos", email: "alex@northwind.io", role: "owner" },
  { id: "u2", name: "Priya Nair", email: "priya@northwind.io", role: "editor" },
  { id: "u3", name: "Lena Park", email: "lena@northwind.io", role: "commenter" },
  { id: "u4", name: "Dana Whit", email: "dana@acme.com", role: "viewer", pending: true },
];

const nameFromEmail = (email: string) =>
  (email.split("@")[0] ?? email).replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function Example() {
  const [open, setOpen] = React.useState(false);
  const [members, setMembers] = React.useState(initial);
  const [access, setAccess] = React.useState<LinkAccess>("workspace");
  return (
    <>
      <Button onClick={() => setOpen(true)}>Share deal</Button>
      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        resourceName="Acme Corp · Q4 renewal"
        members={members}
        currentUserId="u1"
        workspaceDomain="northwind.io"
        workspaceName="Northwind"
        seatLimit={10}
        shareUrl="https://app.northwind.io/deals/acme-q4"
        linkAccess={access}
        onLinkAccessChange={setAccess}
        onInvite={async ({ emails, role }) => {
          await new Promise((r) => setTimeout(r, 600));
          setMembers((m) => [
            ...m,
            ...emails.map((email) => ({
              id: email,
              email,
              role,
              pending: true,
              name: nameFromEmail(email),
            })),
          ]);
        }}
        onRoleChange={(id, role) =>
          setMembers((m) =>
            role === "remove"
              ? m.filter((x) => x.id !== id)
              : m.map((x) => (x.id === id ? { ...x, role } : x)),
          )
        }
      />
    </>
  );
}
