// WhatsApp group ids: "<creator>-<timestamp>" (legacy) or "120363" followed by
// 10+ digits (current, 18 digits). User phones have at most 15 digits and LIDs
// 14-15, so neither can match.
const IsGroupNumber = (numberOrJid?: string | null): boolean => {
  if (!numberOrJid) return false;

  if (numberOrJid.endsWith("@g.us")) return true;

  const user = numberOrJid.split("@")[0];

  return /^\d+-\d+$/.test(user) || /^120363\d{10,}$/.test(user);
};

export default IsGroupNumber;
