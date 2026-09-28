import { ClinicIntake } from "@/components/crm/clinic-intake";

export default function Example() {
  return (
    <ClinicIntake
      className="w-[640px]"
      defaultValues={{ firstName: "Maria", lastName: "Gonzalez", dob: "1968-03-14" }}
      onDraftChange={(v) => console.log("autosave draft", v.lastName)}
      onSubmit={async (values) => {
        await new Promise((r) => setTimeout(r, 800));
        console.log("intake submitted", values);
      }}
    />
  );
}
