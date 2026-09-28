import { MeetingScheduler } from "@/components/crm/meeting-scheduler";

const now = new Date(2026, 8, 28, 8, 0);
const at = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m).toISOString();

export default function Example() {
  return (
    <MeetingScheduler
      className="max-w-[760px]"
      now={now}
      host={{ name: "Maya Chen", title: "Senior Account Executive" }}
      meetingTitle="Product walkthrough"
      durations={[15, 30, 45]}
      workingHours={{ days: [1, 2, 3, 4, 5], start: "09:00", end: "17:30" }}
      busy={[
        { start: at(28, 12), end: at(28, 13) },
        { start: at(29, 9), end: at(29, 11) },
        { start: at(29, 14), end: at(29, 15, 30) },
        { start: at(30, 9), end: at(30, 17, 30) },
      ]}
      bufferMinutes={15}
      minNoticeHours={3}
      onBook={() => new Promise((resolve) => setTimeout(resolve, 700))}
    />
  );
}
