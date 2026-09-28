import { SettingsSecurity, type ActiveSession } from "@/components/crm/settings-security";

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const sessions: ActiveSession[] = [
  {
    id: "s1",
    device: "Chrome on macOS",
    kind: "desktop",
    location: "Bengaluru, IN",
    ip: "203.0.113.24",
    lastSeen: ago(0),
    current: true,
  },
  {
    id: "s2",
    device: "Kitbase iOS app",
    kind: "mobile",
    location: "Bengaluru, IN",
    ip: "49.36.12.8",
    lastSeen: ago(5),
  },
  {
    id: "s3",
    device: "Firefox on Windows",
    kind: "desktop",
    location: "Frankfurt, DE",
    ip: "185.12.40.77",
    lastSeen: ago(52),
  },
];

export default function Example() {
  return (
    <SettingsSecurity
      className="max-w-3xl"
      defaultValue={{
        enforce2fa: true,
        ssoOnly: false,
        passwordMinLength: 10,
        requireSymbols: true,
        sessionTimeout: 480,
        ipAllowlist: ["203.0.113.0/24"],
      }}
      twoFactorAdoption={0.82}
      currentIp="203.0.113.24"
      ssoConfigured
      sessions={sessions}
    />
  );
}
