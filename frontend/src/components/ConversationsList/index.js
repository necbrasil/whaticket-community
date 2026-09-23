import React, { useState, useEffect, useReducer, useRef } from "react";
import { useHistory } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
  Avatar,
  Badge,
  Divider,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import AddIcon from "@material-ui/icons/Add";
import GroupIcon from "@material-ui/icons/Group";
import AccessTime from "@material-ui/icons/AccessTime";
import Done from "@material-ui/icons/Done";
import DoneAll from "@material-ui/icons/DoneAll";

import api from "../../services/api";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import TicketsListSkeleton from "../TicketsListSkeleton";
import NewConversationModal from "../NewConversationModal";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1),
    background: "#fafafa",
    borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    background: "#fff",
    borderRadius: 40,
    padding: "4px 12px",
    marginRight: theme.spacing(1),
  },
  searchIcon: {
    color: "grey",
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
  },
  list: {
    flex: 1,
    overflowY: "scroll",
    padding: 0,
    ...theme.scrollbarStyles,
  },
  nameRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
  },
  groupIcon: {
    fontSize: 16,
    color: "grey",
    marginRight: 4,
    flex: "none",
  },
  unreadName: {
    fontWeight: 600,
  },
  time: {
    flex: "none",
    marginLeft: 8,
  },
  unreadTime: {
    color: green[600],
    fontWeight: 600,
  },
  previewRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  preview: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
  },
  previewText: {
    minWidth: 0,
  },
  unreadPreview: {
    color: theme.palette.text.primary,
    fontWeight: 600,
  },
  ackIcon: {
    fontSize: 16,
    marginRight: 3,
    flex: "none",
    color: "grey",
  },
  ackReadIcon: {
    fontSize: 16,
    marginRight: 3,
    flex: "none",
    color: "#34B7F1",
  },
  badge: {
    color: "white",
    backgroundColor: green[500],
    position: "static",
    transform: "none",
    marginLeft: 8,
  },
  empty: {
    textAlign: "center",
    color: "rgb(104, 121, 146)",
    fontSize: 14,
    margin: 40,
  },
}));

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD": {
      const known = new Set(state.map((c) => c.contact.id));
      const incoming = action.payload.filter((c) => !known.has(c.contact.id));
      return [...state, ...incoming];
    }
    case "UPSERT": {
      // a new message moves the conversation to the top
      const { conversation, addUnread, onlyIfListed } = action.payload;
      const previous = state.find(
        (c) => c.contact.id === conversation.contact.id
      );
      if (!previous && onlyIfListed) return state;
      const unread = (previous?.unread || 0) + (addUnread ? 1 : 0);
      const rest = state.filter((c) => c.contact.id !== conversation.contact.id);
      return [{ ...conversation, unread }, ...rest];
    }
    case "UPDATE_LAST_MESSAGE": {
      // ack changes and edits of the message shown in the preview
      const { id, ack, body } = action.payload;
      return state.map((c) =>
        c.lastMessageId === id
          ? { ...c, lastMessageAck: ack, lastMessage: body }
          : c
      );
    }
    case "UPDATE": {
      const { contactId, changes } = action.payload;
      return state.map((c) =>
        c.contact.id === contactId ? { ...c, ...changes(c) } : c
      );
    }
    case "RESET":
      return [];
    default:
      return state;
  }
};

const mediaLabel = (mediaType) =>
  mediaType && mediaType !== "chat"
    ? i18n.t(`conversations.media.${mediaType}`, { defaultValue: "" })
    : "";

// "*Name:* " is the signature added by the message input (older messages have
// a line break after it)
const stripSignature = (body) => body.replace(/^\*[^*\n]+:\*[ \n]/, "");

const formatPreview = (conversation) => {
  const body = stripSignature(conversation.lastMessage || "").replace(
    /\s+/g,
    " "
  );
  const label = mediaLabel(conversation.lastMediaType);
  const looksLikeFileName = /^[\w.-]+\.\w{2,5}$/.test(body);

  let text = body;
  if (label) {
    text = body && !looksLikeFileName ? `${label}: ${body}` : label;
  }

  return conversation.lastMessageFromMe
    ? `${i18n.t("conversations.you")}: ${text}`
    : text;
};

// same meaning as the chat: 0 pending, 1 sent, 2 delivered, 3/4 read/played
const renderAck = (ack, classes) => {
  if (ack === null || ack === undefined) return null;
  if (ack === 0) return <AccessTime className={classes.ackIcon} />;
  if (ack === 1) return <Done className={classes.ackIcon} />;
  if (ack === 2) return <DoneAll className={classes.ackIcon} />;
  return <DoneAll className={classes.ackReadIcon} />;
};

const formatTime = (date) => {
  if (!date) return "";
  const parsed = typeof date === "string" ? parseISO(date) : new Date(date);
  return isSameDay(parsed, new Date())
    ? format(parsed, "HH:mm")
    : format(parsed, "dd/MM/yyyy");
};

const ConversationsList = ({ selectedContactId }) => {
  const classes = useStyles();
  const history = useHistory();

  const [conversations, dispatch] = useReducer(reducer, []);
  const [searchParam, setSearchParam] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newConversationOpen, setNewConversationOpen] = useState(false);

  const selectedRef = useRef(selectedContactId);
  selectedRef.current = selectedContactId;
  const searchRef = useRef(searchParam);
  searchRef.current = searchParam;

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const { data } = await api.get("/conversations", {
          params: { searchParam, pageNumber },
        });
        dispatch({ type: "LOAD", payload: data.conversations });
        setHasMore(data.hasMore);
      } catch (err) {
        toastError(err);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("connect", () => socket.emit("joinNotification"));

    socket.on("appMessage", (data) => {
      if (data.action === "update" && data.message) {
        dispatch({
          type: "UPDATE_LAST_MESSAGE",
          payload: {
            id: data.message.id,
            ack: data.message.ack,
            body: data.message.body,
          },
        });
        return;
      }
      if (data.action !== "create" || !data.message || !data.ticket) return;

      const { message, contact } = data;
      const contactId = data.ticket.contactId;
      const isOpen = String(contactId) === String(selectedRef.current);

      dispatch({
        type: "UPSERT",
        payload: {
          addUnread: !message.fromMe && !isOpen,
          // while searching, don't add conversations that don't match
          onlyIfListed: Boolean(searchRef.current),
          conversation: {
            contact: contact || data.ticket.contact,
            lastMessageId: message.id,
            lastMessageAck: message.ack,
            lastMessage: message.body,
            lastMessageFromMe: message.fromMe,
            lastMediaType: message.mediaType,
            updatedAt: message.createdAt,
          },
        },
      });
    });

    socket.on("conversation", (data) => {
      if (data.action === "read") {
        dispatch({
          type: "UPDATE",
          payload: { contactId: data.contactId, changes: () => ({ unread: 0 }) },
        });
      }
    });

    socket.on("contact", (data) => {
      if (data.action === "update" && data.contact) {
        dispatch({
          type: "UPDATE",
          payload: {
            contactId: data.contact.id,
            changes: (c) => ({ contact: { ...c.contact, ...data.contact } }),
          },
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      setPageNumber((prev) => prev + 1);
    }
  };

  const handleSelect = (contactId) => {
    dispatch({
      type: "UPDATE",
      payload: { contactId, changes: () => ({ unread: 0 }) },
    });
    history.push(`/conversations/${contactId}`);
  };

  return (
    <Paper square elevation={0} variant="outlined" className={classes.root}>
      <NewConversationModal
        open={newConversationOpen}
        onClose={() => setNewConversationOpen(false)}
      />
      <div className={classes.toolbar}>
        <div className={classes.searchBox}>
          <SearchIcon className={classes.searchIcon} />
          <InputBase
            className={classes.searchInput}
            placeholder={i18n.t("conversations.searchPlaceholder")}
            value={searchParam}
            onChange={(e) => setSearchParam(e.target.value)}
          />
        </div>
        <Tooltip title={i18n.t("conversations.newConversation.title")}>
          <IconButton size="small" onClick={() => setNewConversationOpen(true)}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </div>
      <List className={classes.list} onScroll={handleScroll}>
        {conversations.map((conversation) => {
          const { contact, unread } = conversation;
          return (
            <React.Fragment key={contact.id}>
              <ListItem
                button
                dense
                selected={String(contact.id) === String(selectedContactId)}
                onClick={() => handleSelect(contact.id)}
              >
                <ListItemAvatar>
                  <Avatar src={contact.profilePicUrl} />
                </ListItemAvatar>
                <ListItemText
                  disableTypography
                  primary={
                    <div className={classes.nameRow}>
                      <span className={classes.name}>
                        {contact.isGroup && (
                          <GroupIcon className={classes.groupIcon} />
                        )}
                        <Typography
                          noWrap
                          variant="body2"
                          component="span"
                          className={unread ? classes.unreadName : undefined}
                        >
                          {contact.name}
                        </Typography>
                      </span>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        className={`${classes.time} ${
                          unread ? classes.unreadTime : ""
                        }`}
                      >
                        {formatTime(conversation.updatedAt)}
                      </Typography>
                    </div>
                  }
                  secondary={
                    <div className={classes.previewRow}>
                      <span className={classes.preview}>
                        {conversation.lastMessageFromMe &&
                          renderAck(conversation.lastMessageAck, classes)}
                        <Typography
                          noWrap
                          variant="body2"
                          color="textSecondary"
                          component="span"
                          className={`${classes.previewText} ${
                            unread ? classes.unreadPreview : ""
                          }`}
                        >
                          {formatPreview(conversation)}
                        </Typography>
                      </span>
                      {unread > 0 && (
                        <Badge
                          badgeContent={unread}
                          classes={{ badge: classes.badge }}
                        />
                      )}
                    </div>
                  }
                />
              </ListItem>
              <Divider variant="inset" component="li" />
            </React.Fragment>
          );
        })}
        {loading && <TicketsListSkeleton />}
        {!loading && conversations.length === 0 && (
          <div className={classes.empty}>{i18n.t("conversations.empty")}</div>
        )}
      </List>
    </Paper>
  );
};

export default ConversationsList;
