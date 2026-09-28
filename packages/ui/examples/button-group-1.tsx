import { ChevronLeft, ChevronRight, Copy, Download, FileText, Send } from "lucide-react";
import { Button } from "@/components/crm/button";
import { ButtonGroup, SplitButton } from "@/components/crm/button-group";
import { DropdownMenuItem } from "@/components/crm/dropdown-menu";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center gap-4 font-crm text-crm-fg">
      <ButtonGroup label="Record navigation">
        <Button aria-label="Previous record">
          <ChevronLeft />
        </Button>
        <Button>3 of 18</Button>
        <Button aria-label="Next record">
          <ChevronRight />
        </Button>
      </ButtonGroup>

      <ButtonGroup label="Export">
        <Button>
          <Download /> CSV
        </Button>
        <Button>
          <FileText /> PDF
        </Button>
      </ButtonGroup>

      <SplitButton
        variant="primary"
        menu={
          <>
            <DropdownMenuItem icon={<Send />}>Send later</DropdownMenuItem>
            <DropdownMenuItem icon={<Copy />}>Save as template</DropdownMenuItem>
          </>
        }
      >
        <Send /> Send proposal
      </SplitButton>
    </div>
  );
}
