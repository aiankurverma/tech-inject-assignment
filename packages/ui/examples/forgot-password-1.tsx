import { ForgotPassword } from "@/components/crm/forgot-password";

export default function Example() {
  return (
    <ForgotPassword
      defaultEmail="marcus.oyelaran@brightpath.co"
      resendCooldown={20}
      maxResends={2}
      onBack={() => alert("Back to sign in")}
      onSubmit={async (email) => {
        await new Promise((r) => setTimeout(r, 700));
        if (email.endsWith(".test"))
          return "We couldn't reach the mail server. Try again in a minute.";
      }}
    />
  );
}
