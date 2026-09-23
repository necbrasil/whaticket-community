import { Request, Response } from "express";

import ListConversationsService from "../services/ConversationServices/ListConversationsService";
import ListConversationMessagesService from "../services/ConversationServices/ListConversationMessagesService";
import MarkConversationReadService from "../services/ConversationServices/MarkConversationReadService";
import GetConversationTicketService from "../services/ConversationServices/GetConversationTicketService";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const result = await ListConversationsService({ searchParam, pageNumber });

  return res.json(result);
};

export const messages = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { pageNumber } = req.query as IndexQuery;

  const result = await ListConversationMessagesService({
    contactId,
    pageNumber
  });

  return res.json(result);
};

export const read = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;

  await MarkConversationReadService(contactId);

  return res.send();
};

export const ticket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;

  const conversationTicket = await GetConversationTicketService(
    contactId,
    +req.user.id
  );

  return res.json({ ticketId: conversationTicket.id });
};
