interface ChatContact {
  number: string;
  lid?: string | null;
}

// Contacts WhatsApp only identified by their LID (the phone number is hidden)
// are saved with the LID digits as "number"; they must be addressed by the LID.
const GetContactChatId = (contact: ChatContact, isGroup: boolean): string => {
  const { number, lid } = contact;

  if (isGroup) return `${number}@g.us`;

  if (lid && (!number || lid.split("@")[0] === number)) return lid;

  return `${number}@c.us`;
};

export default GetContactChatId;
