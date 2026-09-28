import { Building2, Mail, Phone } from "lucide-react";
import { HStack, Stack, VStack } from "@/components/crm/stack";
import { Button } from "@/components/crm/button";

const stats = [
  { label: "Open deals", value: "12" },
  { label: "Pipeline", value: "$418k" },
  { label: "Win rate", value: "34%" },
];

export default function Example() {
  const hasPhone = false;
  return (
    <VStack
      gap={4}
      className="w-full max-w-xl rounded-crm border border-crm-border bg-crm-surface p-4 font-crm"
    >
      <Stack direction={{ base: "column", md: "row" }} gap={3} justify="between">
        <VStack gap={1}>
          <HStack gap={2}>
            <Building2 className="size-4 text-crm-subtle" aria-hidden />
            <span className="text-sm font-semibold text-crm-fg">Northwind Traders</span>
          </HStack>
          <HStack gap={3} wrap className="text-xs text-crm-soft">
            <HStack gap={1}>
              <Mail className="size-3" aria-hidden /> ops@northwind.com
            </HStack>
            {hasPhone && (
              <HStack gap={1}>
                <Phone className="size-3" aria-hidden /> +1 415 555 0142
              </HStack>
            )}
          </HStack>
        </VStack>
        <HStack gap={2}>
          <Button size="sm">Log call</Button>
          <Button size="sm" variant="primary">
            New deal
          </Button>
        </HStack>
      </Stack>
      <Stack
        as="ul"
        direction={{ base: "column", md: "row" }}
        divider
        gap={4}
        aria-label="Account stats"
      >
        {stats.map((s) => (
          <VStack key={s.label} gap={0} className="flex-1">
            <span className="crm-caption">{s.label}</span>
            <span className="text-lg font-semibold text-crm-fg tabular-nums">{s.value}</span>
          </VStack>
        ))}
      </Stack>
    </VStack>
  );
}
