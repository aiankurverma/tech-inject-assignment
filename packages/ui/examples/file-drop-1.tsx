import { useState } from "react";
import { FileDrop } from "@/components/crm/file-drop";

export default function Example() {
  const [name, setName] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <FileDrop onFile={(f) => setName(f.name)} />
      {name ? <p className="text-xs text-crm-soft">Selected: {name}</p> : null}
    </div>
  );
}
