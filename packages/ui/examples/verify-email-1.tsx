import { VerifyEmail } from "@/components/crm/verify-email";

export default function Example() {
  return (
    <VerifyEmail
      email="aisha.khan@harborview.health"
      initialCooldown={15}
      resendCooldown={30}
      maxAttempts={3}
      onChangeEmail={() => alert("Back to sign-up to change the email")}
      onResend={async () => {
        await new Promise((r) => setTimeout(r, 600));
      }}
      onVerify={async (code) => {
        await new Promise((r) => setTimeout(r, 600));
        if (code === "000000") return "expired";
        return code === "482913" ? "ok" : "invalid";
      }}
    />
  );
}
