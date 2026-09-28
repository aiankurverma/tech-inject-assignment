import { ContactDetail, type ContactRecord } from "@/components/crm/contact-detail";

const contact: ContactRecord = {
  id: "ct1",
  name: "Camille Durand",
  title: "Head of Digital Operations",
  company: "LVMH",
  email: "camille.durand@lvmh.com",
  phone: "+33 1 44 13 22 22",
  location: "Paris, France",
  timeZone: "Europe/Paris",
  owner: "Maya Chen",
  lifecycle: "Customer",
  doNotCall: true,
  linkedin: "linkedin.com/in/camilledurand",
  createdAt: "2024-03-11",
  tags: [
    { label: "Champion", color: "green" },
    { label: "EMEA", color: "blue" },
  ],
  deals: [
    { id: "d5", name: "Enterprise renewal – FY27", amount: 530111, stage: "Proposal" },
    { id: "d9", name: "Clienteling add-on", amount: 86000, stage: "Discovery" },
  ],
  activities: [
    {
      id: "a1",
      type: "meeting",
      actor: { name: "Maya Chen" },
      text: "held pricing review",
      time: "2d ago",
    },
    {
      id: "a2",
      type: "email",
      actor: { name: "Camille Durand" },
      text: "replied to proposal v3",
      detail: "Looks good — can you split SSO into its own line?",
      time: "3d ago",
    },
    {
      id: "a3",
      type: "email",
      actor: { name: "Maya Chen" },
      text: "sent proposal v3",
      time: "4d ago",
    },
    {
      id: "a4",
      type: "call",
      actor: { name: "Leo Park" },
      text: "left a voicemail",
      time: "2w ago",
    },
    {
      id: "a5",
      type: "note",
      actor: { name: "Maya Chen" },
      text: "added a note",
      detail: "Prefers async updates; weekly Thursday summary.",
      time: "3w ago",
    },
  ],
};

export default function Example() {
  return (
    <ContactDetail
      className="w-full max-w-[1000px]"
      contact={contact}
      currency="EUR"
      currentUser="Maya Chen"
    />
  );
}
