import { Op } from "sequelize";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";
import MergeContactsService from "./MergeContactsService";

interface Request {
  number: string;
  lid: string;
}

const CHUNK_SIZE = 500;

// the same LID may come with a device suffix ("123:45@lid"); store it without
const normalizeLid = (lid: string): string => lid.replace(/:\d+@/, "@");

// Learns that a phone number and a LID belong to the same person. It only
// completes contacts that already exist, it never creates one.
export const LinkContactLidsService = async (
  pairs: Request[]
): Promise<void> => {
  const unique = new Map<string, Request>();
  pairs.forEach(pair => {
    const number = pair.number?.replace(/[^0-9]/g, "");
    const lid = pair.lid ? normalizeLid(pair.lid) : "";
    if (number && lid.endsWith("@lid"))
      unique.set(`${number}|${lid}`, { number, lid });
  });

  const list = Array.from(unique.values());

  for (let i = 0; i < list.length; i += CHUNK_SIZE) {
    const chunk = list.slice(i, i + CHUNK_SIZE);

    // eslint-disable-next-line no-await-in-loop
    const contacts = await Contact.findAll({
      where: {
        [Op.or]: [
          { number: { [Op.in]: chunk.map(p => p.number) } },
          { lid: { [Op.in]: chunk.map(p => p.lid) } }
        ]
      }
    });

    const byNumber = new Map<string, Contact>();
    const byLid = new Map<string, Contact>();
    contacts.forEach(contact => {
      byNumber.set(contact.number, contact);
      if (contact.lid) byLid.set(contact.lid, contact);
    });

    // eslint-disable-next-line no-restricted-syntax
    for (const { number, lid } of chunk) {
      try {
        const contactByNumber = byNumber.get(number);
        const contactByLid = byLid.get(lid);

        if (contactByNumber && contactByLid) {
          if (contactByNumber.id !== contactByLid.id) {
            // eslint-disable-next-line no-await-in-loop
            await MergeContactsService(contactByNumber, contactByLid, { lid });
            byLid.set(lid, contactByNumber);
            byNumber.delete(contactByLid.number);
          }
        } else if (contactByNumber) {
          if (!contactByNumber.lid) {
            // eslint-disable-next-line no-await-in-loop
            await contactByNumber.update({ lid });
            byLid.set(lid, contactByNumber);
          }
        } else if (contactByLid && contactByLid.number === lid.split("@")[0]) {
          // LID-only contact that now has a known phone
          // eslint-disable-next-line no-await-in-loop
          await contactByLid.update({ number });
          byNumber.set(number, contactByLid);
        }
      } catch (err) {
        logger.warn({ info: "Could not link contact lid", number, lid, err });
      }
    }
  }
};

const LinkContactLidService = async (request: Request): Promise<void> => {
  try {
    await LinkContactLidsService([request]);
  } catch (err) {
    logger.warn({ info: "Could not link contact lid", ...request, err });
  }
};

export default LinkContactLidService;
