import * as React from "react";
import { Button } from "@/components/crm/button";
import { ToastProvider, useToast } from "@/components/crm/toast";

function Buttons() {
  const { toast } = useToast();
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    toast({
      tone: "success",
      title: "Deal moved to Won",
      description: "LVMH · $530,111",
      duration: 0,
    });
    toast({
      title: "3 contacts archived",
      action: { label: "Undo", onClick: () => toast({ title: "Restored" }) },
      duration: 0,
    });
    toast({
      tone: "danger",
      title: "Couldn't send email",
      description: "SMTP timeout.",
      duration: 0,
    });
  }, [toast]);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={() =>
          toast({ tone: "success", title: "Deal moved to Won", description: "LVMH · $530,111" })
        }
      >
        Success
      </Button>
      <Button
        onClick={() =>
          toast({
            title: "Contact archived",
            action: { label: "Undo", onClick: () => toast({ title: "Restored" }) },
          })
        }
      >
        With undo
      </Button>
      <Button
        variant="danger"
        onClick={() =>
          toast({
            tone: "danger",
            title: "Couldn't send email",
            description: "SMTP timeout.",
            duration: 0,
          })
        }
      >
        Error (sticky)
      </Button>
    </div>
  );
}

export default function Example() {
  return (
    <ToastProvider>
      <Buttons />
    </ToastProvider>
  );
}
