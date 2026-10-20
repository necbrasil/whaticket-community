import { getIO } from "../../libs/socket";
import IsGroupNumber from "../../helpers/IsGroupNumber";
import Contact from "../../models/Contact";
import MergeContactsService from "./MergeContactsService";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  lid?: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
}

const emitContact = (action: "update" | "create", contact: Contact) => {
  const io = getIO();

  io.emit("contact", { action, contact });
};

const isDigitsOnly = (value: string): boolean => /^[+\d\s()-]*$/.test(value);

// a contact whose name is just digits (its number or LID) has no real name yet
const hasPlaceholderName = (contact: Contact): boolean =>
  isDigitsOnly((contact.name || "").trim());

const isRealName = (name?: string): name is string =>
  !!name && !isDigitsOnly(name.trim());

const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  lid: rawLid,
  profilePicUrl,
  isGroup: rawIsGroup,
  email = "",
  extraInfo = []
}: Request): Promise<Contact> => {
  const isGroup = rawIsGroup || IsGroupNumber(rawNumber);
  const number = isGroup ? rawNumber : rawNumber.replace(/[^0-9]/g, "");
  // the same LID may come with a device suffix ("123:45@lid"); store it without
  const lid = rawLid?.replace(/:\d+@/, "@");
  if (!number && !lid) throw new Error("Either number or lid must be provided");

  // phone unknown: the LID digits stand in for the number (see GetContactChatId)
  const numberIsLid = !isGroup && !!lid && number === lid.split("@")[0];

  const [contactByNumber, contactByLid] = await Promise.all([
    number && !numberIsLid ? Contact.findOne({ where: { number } }) : null,
    lid ? Contact.findOne({ where: { lid } }) : null
  ]);

  // only what is known is applied, so an update never blanks stored data
  const buildChanges = (contact: Contact): Partial<Contact> => {
    const changes: Partial<Contact> = {};

    if (profilePicUrl) changes.profilePicUrl = profilePicUrl;
    if (isRealName(name) && hasPlaceholderName(contact)) changes.name = name;

    return changes;
  };

  const shouldMerge =
    contactByNumber && contactByLid && contactByNumber.id !== contactByLid.id;

  if (shouldMerge) {
    await MergeContactsService(contactByNumber, contactByLid, {
      ...buildChanges(contactByNumber),
      lid: contactByLid.lid
    });

    emitContact("update", contactByNumber);

    return contactByNumber;
  }

  if (contactByNumber) {
    await contactByNumber.update({
      ...buildChanges(contactByNumber),
      lid: lid || contactByNumber.lid,
      isGroup: isGroup || contactByNumber.isGroup
    });

    emitContact("update", contactByNumber);

    return contactByNumber;
  }

  if (contactByLid) {
    // a LID-only message must not replace the phone we already know
    await contactByLid.update({
      ...buildChanges(contactByLid),
      ...(number && !numberIsLid ? { number } : {})
    });

    emitContact("update", contactByLid);
    return contactByLid;
  }

  const created = await Contact.create({
    name,
    number,
    lid,
    profilePicUrl,
    email,
    isGroup,
    extraInfo
  });

  emitContact("create", created);
  return created;
};

export default CreateOrUpdateContactService;
