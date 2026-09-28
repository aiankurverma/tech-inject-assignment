import { CohortRetention } from "@/components/crm/cohort-retention";

const cohorts = [
  { label: "Jan 2026", size: 412, retained: [361, 332, 318, 301, 296, 288, 281, 277] },
  { label: "Feb 2026", size: 389, retained: [344, 310, 297, 285, 279, 270, 266] },
  { label: "Mar 2026", size: 455, retained: [409, 381, 360, 349, 340, 333] },
  { label: "Apr 2026", size: 501, retained: [431, 392, 371, 358, 350] },
  { label: "May 2026", size: 478, retained: [428, 399, 385, 377] },
  { label: "Jun 2026", size: 530, retained: [482, 455, 441] },
  { label: "Jul 2026", size: 562, retained: [517, 490] },
  { label: "Aug 2026", size: 604, retained: [559] },
  { label: "Sep 2026", size: 588, retained: [] },
];

export default function Example() {
  return <CohortRetention className="w-full max-w-[900px]" cohorts={cohorts} alertBelow={70} />;
}
