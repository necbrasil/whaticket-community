import React, { useState, useEffect, useReducer, useRef } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import {
  Avatar,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemAvatar,
  Tooltip,
  Typography,
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import CreateIcon from "@material-ui/icons/Create";
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
import { formatListTime } from "../../helpers/dates";

// colors and sizes follow WhatsApp Web
const useStyles = makeStyles((theme) => {
  const dark = theme.palette.type === "dark";
  const textPrimary = dark ? "#e9edef" : "#111b21";
  const textSecondary = dark ? "#8696a0" : "#667781";
  const divider = dark ? "#222d34" : "#e9edef";
  return {
    root: {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
      backgroundColor: dark ? "#111b21" : "#fff",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flex: "none",
      height: 59,
      padding: "0 16px",
    },
    title: {
      fontSize: 22,
      fontWeight: 700,
      color: textPrimary,
    },
    headerIcon: {
      color: dark ? "#aebac1" : "#54656f",
    },
    searchRow: {
      flex: "none",
      padding: "7px 12px 8px",
    },
    searchBox: {
      display: "flex",
      alignItems: "center",
      height: 35,
      background: dark ? "#202c33" : "#f0f2f5",
      borderRadius: 8,
      padding: "0 12px",
    },
    searchIcon: {
      fontSize: 18,
      color: textSecondary,
      marginRight: 24,
      flex: "none",
    },
    searchBack: {
      fontSize: 18,
      color: "#00a884",
      marginRight: 24,
      flex: "none",
      cursor: "pointer",
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: textPrimary,
    },
    list: {
      flex: 1,
      overflowY: "auto",
      padding: 0,
      ...theme.scrollbarStyles,
    },
    item: {
      height: 72,
      padding: "0 0 0 15px",
      "&:hover": {
        backgroundColor: dark ? "#202c33" : "#f5f6f6",
      },
      "&.Mui-selected, &.Mui-selected:hover": {
        backgroundColor: dark ? "#2a3942" : "#f0f2f5",
      },
    },
    avatar: {
      width: 49,
      height: 49,
    },
    avatarWrapper: {
      minWidth: 0,
      marginRight: 15,
    },
    content: {
      flex: 1,
      minWidth: 0,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      paddingRight: 15,
      borderBottom: `1px solid ${divider}`,
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
      fontSize: 17,
      lineHeight: "21px",
      color: textPrimary,
    },
    nameText: {
      fontSize: "inherit",
      lineHeight: "inherit",
    },
    groupIcon: {
      fontSize: 16,
      color: textSecondary,
      marginRight: 4,
      flex: "none",
    },
    time: {
      flex: "none",
      marginLeft: 8,
      fontSize: 12,
      color: textSecondary,
    },
    unreadTime: {
      color: dark ? "#00a884" : "#1fa855",
    },
    previewRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 2,
    },
    preview: {
      minWidth: 0,
      display: "flex",
      alignItems: "center",
    },
    previewText: {
      minWidth: 0,
      fontSize: 14,
      lineHeight: "20px",
      color: textSecondary,
    },
    ackIcon: {
      fontSize: 16,
      marginRight: 3,
      flex: "none",
      color: textSecondary,
    },
    ackReadIcon: {
      fontSize: 16,
      marginRight: 3,
      flex: "none",
      color: "#53bdeb",
    },
    badge: {
      flex: "none",
      minWidth: 20,
      height: 20,
      padding: "0 6px",
      marginLeft: 8,
      borderRadius: 10,
      boxSizing: "border-box",
      textAlign: "center",
      fontSize: 12,
      fontWeight: 600,
      lineHeight: "20px",
      color: dark ? "#111b21" : "#fff",
      backgroundColor: dark ? "#00a884" : "#25d366",
    },
    empty: {
      textAlign: "center",
      color: textSecondary,
      fontSize: 14,
      margin: 40,
    },
  };
});

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
    <div className={classes.root}>
      <NewConversationModal
        open={newConversationOpen}
        onClose={() => setNewConversationOpen(false)}
      />
      <div className={classes.header}>
        <span className={classes.title}>{i18n.t("conversations.title")}</span>
        <Tooltip title={i18n.t("conversations.newConversation.title")}>
          <IconButton
            size="small"
            className={classes.headerIcon}
            onClick={() => setNewConversationOpen(true)}
          >
            <CreateIcon />
          </IconButton>
        </Tooltip>
      </div>
      <div className={classes.searchRow}>
        <div className={classes.searchBox}>
          {searchParam ? (
            <ArrowBackIcon
              className={classes.searchBack}
              onClick={() => setSearchParam("")}
            />
          ) : (
            <SearchIcon className={classes.searchIcon} />
          )}
          <InputBase
            className={classes.searchInput}
            placeholder={i18n.t("conversations.searchPlaceholder")}
            value={searchParam}
            onChange={(e) => setSearchParam(e.target.value)}
          />
        </div>
      </div>
      <List className={classes.list} onScroll={handleScroll}>
        {conversations.map((conversation) => {
          const { contact, unread } = conversation;
          return (
            <ListItem
              key={contact.id}
              button
              className={classes.item}
              selected={String(contact.id) === String(selectedContactId)}
              onClick={() => handleSelect(contact.id)}
            >
              <ListItemAvatar className={classes.avatarWrapper}>
                <Avatar className={classes.avatar} src={contact.profilePicUrl} />
              </ListItemAvatar>
              <div className={classes.content}>
                <div className={classes.nameRow}>
                  <span className={classes.name}>
                    {contact.isGroup && (
                      <GroupIcon className={classes.groupIcon} />
                    )}
                    <Typography
                      noWrap
                      component="span"
                      className={classes.nameText}
                    >
                      {contact.name}
                    </Typography>
                  </span>
                  <span
                    className={`${classes.time} ${
                      unread ? classes.unreadTime : ""
                    }`}
                  >
                    {formatListTime(conversation.updatedAt)}
                  </span>
                </div>
                <div className={classes.previewRow}>
                  <span className={classes.preview}>
                    {conversation.lastMessageFromMe &&
                      renderAck(conversation.lastMessageAck, classes)}
                    <Typography
                      noWrap
                      component="span"
                      className={classes.previewText}
                    >
                      {formatPreview(conversation)}
                    </Typography>
                  </span>
                  {unread > 0 && (
                    <span className={classes.badge}>
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
              </div>
            </ListItem>
          );
        })}
        {loading && <TicketsListSkeleton />}
        {!loading && conversations.length === 0 && (
          <div className={classes.empty}>{i18n.t("conversations.empty")}</div>
        )}
      </List>
    </div>
  );
};

export default ConversationsList;
