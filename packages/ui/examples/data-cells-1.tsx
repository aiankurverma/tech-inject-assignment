import { ContactLine, DateCell, MoneyValue } from "@/components/crm/data-cells";

export default function Example() {
  return (
    <div className="flex flex-col gap-4">
      <MoneyValue amount={530111} />
      <DateCell date="Mar 12" type="Exec" />
      <ContactLine email="alex.santos@crm.com" phone="+1 (202) 203-5668" />
    </div>
  );
}
