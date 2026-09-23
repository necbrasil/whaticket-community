import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { whatsappProvider } from "../../providers/WhatsApp";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";

const ImportContactsService = async (userId: number): Promise<void> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(userId);

  let phoneContacts;

  try {
    phoneContacts = await whatsappProvider.getContacts(defaultWhatsapp.id);
  } catch (err) {
    logger.error(`Could not get whatsapp contacts from phone. Err: ${err}`);
  }

  if (phoneContacts) {
    // the phone may return the same number more than once
    const contactsByNumber = new Map<string, string>();
    phoneContacts.forEach(({ number, name, isGroup }) => {
      // groups are created (flagged as such) when their messages arrive
      if (isGroup) return;
      if (number && !contactsByNumber.has(number)) {
        contactsByNumber.set(number, name || number);
      }
    });

    await Contact.bulkCreate(
      Array.from(contactsByNumber, ([number, name]) => ({ number, name })),
      { ignoreDuplicates: true }
    );
  }
};

export default ImportContactsService;
