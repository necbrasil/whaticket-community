import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as ConversationController from "../controllers/ConversationController";

const conversationRoutes = Router();

conversationRoutes.get("/conversations", isAuth, ConversationController.index);

conversationRoutes.get(
  "/conversations/:contactId/messages",
  isAuth,
  ConversationController.messages
);

conversationRoutes.post(
  "/conversations/:contactId/read",
  isAuth,
  ConversationController.read
);

conversationRoutes.post(
  "/conversations/:contactId/ticket",
  isAuth,
  ConversationController.ticket
);

export default conversationRoutes;
