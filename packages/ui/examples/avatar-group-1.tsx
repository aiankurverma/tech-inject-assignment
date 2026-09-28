import { AvatarGroup } from "@/components/crm/avatar-group";

const team = [
  { name: "Alex Santos" },
  { name: "Grace Miller" },
  { name: "Jensen Ackles" },
  { name: "Priya Nair" },
  { name: "Tom Becker" },
  { name: "Lena Park" },
];

export default function Example() {
  return (
    <div className="flex flex-col gap-4">
      <AvatarGroup people={team.slice(0, 3)} size="sm" />
      <AvatarGroup people={team} size="md" max={3} label="Deal team" />
      <AvatarGroup people={team} size="lg" max={4} />
    </div>
  );
}
