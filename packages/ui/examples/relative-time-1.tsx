import { RelativeTime } from "@/components/crm/relative-time";

const minutes = (n: number) => new Date(Date.now() - n * 60_000);

export default function Example() {
  return (
    <ul className="flex flex-col gap-2 font-crm text-sm text-crm-fg">
      <li>
        Email opened <RelativeTime date={minutes(0.2)} />
      </li>
      <li>
        Call logged <RelativeTime date={minutes(185)} />
      </li>
      <li>
        Deal created <RelativeTime date={minutes(60 * 24 * 9)} />
      </li>
      <li>
        Renewal due <RelativeTime date={new Date(Date.now() + 3 * 86_400_000)} />
      </li>
      <li>
        Compact <RelativeTime date={minutes(185)} format="short" />
      </li>
    </ul>
  );
}
