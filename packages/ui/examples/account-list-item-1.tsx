import { Building2, Cloud, CreditCard } from "lucide-react";
import { AccountListItem } from "@/components/crm/account-list-item";

export default function Example() {
  return (
    <div className="flex w-[440px] flex-col">
      <AccountListItem
        name="Apple"
        meta="6 open deals · Pilot"
        amount={530111}
        probability={82}
        logo={<Building2 />}
        onClick={() => {}}
      />
      <AccountListItem
        name="Snowflake"
        meta="6 open deals · Enterprise, Mid-Market"
        amount={520000}
        probability={24}
        logo={<Cloud />}
        onClick={() => {}}
      />
      <AccountListItem
        name="Stripe"
        meta="3 open deals · Expansion, SMB"
        amount={442231}
        probability={44}
        logo={<CreditCard />}
      />
    </div>
  );
}
