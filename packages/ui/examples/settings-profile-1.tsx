import { SettingsProfile, type ProfileSettings } from "@/components/crm/settings-profile";

const initial: ProfileSettings = {
  firstName: "Maya",
  lastName: "Chen",
  email: "maya@kitbase.io",
  title: "Senior Account Executive",
  phone: "+1 415 555 0114",
  timezone: "America/Los_Angeles",
  workStart: "08:30",
  workEnd: "17:30",
  workDays: [0, 1, 2, 3, 4],
  signature: "Maya Chen\nSenior Account Executive · Kitbase\n+1 415 555 0114",
  weeklyDigest: true,
  showCalendar: true,
};

export default function Example() {
  return (
    <div className="w-full max-w-[720px]">
      <SettingsProfile
        initialValues={initial}
        onSave={(v) =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              console.log("saved", v);
              resolve();
            }, 600),
          )
        }
        onUploadAvatar={async (file) => URL.createObjectURL(file)}
      />
    </div>
  );
}
