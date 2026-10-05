import React, {
  useState,
  useEffect,
  useReducer,
  useRef,
  useContext,
} from "react";

import { isSameDay, parseISO, format } from "date-fns";
import { formatDayLabel } from "../../helpers/dates";
import openSocket from "../../services/socket-io";
import clsx from "clsx";

import { green } from "@material-ui/core/colors";
import {
  Badge,
  Button,
  CircularProgress,
  Divider,
  Fab,
  IconButton,
  makeStyles,
} from "@material-ui/core";
import {
  AccessTime,
  Block,
  Done,
  DoneAll,
  ExpandMore,
  GetApp,
  KeyboardArrowDown,
} from "@material-ui/icons";

import MarkdownWrapper from "../MarkdownWrapper";
import VcardPreview from "../VcardPreview";
import LocationPreview from "../LocationPreview";
import ModalImageCors from "../ModalImageCors";
import MessageOptionsMenu from "../MessageOptionsMenu";
import whatsBackground from "../../assets/wa-background.svg";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import Audio from "../Audio";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";

// dark colors follow WhatsApp Web's dark theme
const useStyles = makeStyles((theme) => {
  const dark = theme.palette.type === "dark";
  return {
  messagesListWrapper: {
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    backgroundColor: dark ? "#0b141a" : "#efeae2",
    // the doodles sit behind the scrolling list, like WhatsApp Web
    "&::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      backgroundImage: `url(${whatsBackground})`,
      backgroundSize: "412.5px 749.25px",
      backgroundRepeat: "repeat",
      opacity: dark ? 0.05 : 0.06,
      filter: dark ? "invert(1)" : "none",
    },
  },

  messagesList: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    padding: "20px 6% 12px",
    overflowY: "scroll",
    [theme.breakpoints.down("sm")]: {
      paddingBottom: "90px",
    },
    ...theme.scrollbarStyles,
  },

  circleLoading: {
    color: green[500],
    position: "absolute",
    opacity: "70%",
    top: 0,
    left: "50%",
    marginTop: 12,
  },

  messageLeft: {
    marginRight: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: "65%",
    fontSize: 14.2,
    lineHeight: "19px",
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: dark ? "#202c33" : "#ffffff",
    color: dark ? "#e9edef" : "#111b21",
    alignSelf: "flex-start",
    borderRadius: 7.5,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 0.5px rgba(11, 20, 26, 0.13)",
  },

  // the little tail on the first bubble of a sequence
  tailLeft: {
    borderTopLeftRadius: 0,
    "&::before": {
      content: '""',
      position: "absolute",
      top: 0,
      left: -8,
      borderStyle: "solid",
      borderWidth: "0 8px 8px 0",
      borderColor: `transparent ${dark ? "#202c33" : "#ffffff"} transparent transparent`,
    },
  },

  tailRight: {
    borderTopRightRadius: 0,
    "&::before": {
      content: '""',
      position: "absolute",
      top: 0,
      right: -8,
      borderStyle: "solid",
      borderWidth: "0 0 8px 8px",
      borderColor: `transparent transparent transparent ${dark ? "#005c4b" : "#d9fdd3"}`,
    },
  },

  quotedContainerLeft: {
    margin: "-3px -70px 6px -6px",
    overflow: "hidden",
    backgroundColor: dark ? "#1d282f" : "#f5f6f6",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsg: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  quotedSideColorLeft: {
    flex: "none",
    width: "4px",
    backgroundColor: "#53bdeb",
  },

  messageRight: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: "65%",
    fontSize: 14.2,
    lineHeight: "19px",
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: dark ? "#005c4b" : "#d9fdd3",
    color: dark ? "#e9edef" : "#111b21",
    alignSelf: "flex-end",
    borderRadius: 7.5,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 0.5px rgba(11, 20, 26, 0.13)",
  },

  quotedContainerRight: {
    margin: "-3px -70px 6px -6px",
    overflowY: "hidden",
    backgroundColor: dark ? "#025144" : "#d1f4cc",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsgRight: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    whiteSpace: "pre-wrap",
  },

  quotedSideColorRight: {
    flex: "none",
    width: "4px",
    backgroundColor: "#06cf9c",
  },

  messageActionsButton: {
    display: "none",
    position: "relative",
    color: "#999",
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
  },

  messageContactName: {
    display: "flex",
    color: "#53bdeb",
    fontWeight: 500,
  },

  textContentItem: {
    overflowWrap: "break-word",
    padding: "3px 70px 6px 6px",
  },

  textContentItemEdited: {
    paddingRight: 130,
  },

  editedLabel: {
    fontStyle: "italic",
    marginRight: 4,
  },

  reactions: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    margin: "0 0 6px 6px",
    padding: "1px 6px",
    fontSize: 13,
    background: dark ? "#202c33" : "#fff",
    borderRadius: 12,
    boxShadow: dark ? "none" : "0 1px 1px #b3b3b3",
  },

  reactionCount: {
    fontSize: 11,
    color: dark ? "#8696a0" : "#666",
  },

  textContentItemDeleted: {
    fontStyle: "italic",
    color: dark ? "rgba(233, 237, 239, 0.45)" : "rgba(0, 0, 0, 0.36)",
    overflowWrap: "break-word",
    padding: "3px 70px 6px 6px",
  },

  messageMedia: {
    objectFit: "cover",
    width: 250,
    height: 200,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  timestamp: {
    fontSize: 11,
    lineHeight: "15px",
    position: "absolute",
    bottom: 3,
    right: 7,
    whiteSpace: "nowrap",
    color: dark ? "rgba(233, 237, 239, 0.6)" : "#667781",
  },

  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    padding: "5px 12px 6px",
    backgroundColor: dark ? "#182229" : "#ffffff",
    margin: "10px 0 12px",
    borderRadius: 7.5,
    boxShadow: "0 1px 0.5px rgba(11, 20, 26, 0.13)",
  },

  dailyTimestampText: {
    fontSize: 12.5,
    lineHeight: "21px",
    color: dark ? "#8696a0" : "#54656f",
  },

  ackIcons: {
    fontSize: 16,
    verticalAlign: "middle",
    marginLeft: 3,
  },

  deletedIcon: {
    fontSize: 18,
    verticalAlign: "middle",
    marginRight: 4,
  },

  ackDoneAllIcon: {
    color: "#53bdeb",
    fontSize: 16,
    verticalAlign: "middle",
    marginLeft: 3,
  },

  unreadSeparator: {
    alignSelf: "stretch",
    textAlign: "center",
    margin: "10px -20px",
    padding: "6px 0",
    fontSize: 13,
    color: dark ? "#8696a0" : "#54656f",
    backgroundColor: dark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.7)",
  },

  scrollToBottomButton: {
    position: "absolute",
    right: 20,
    bottom: 16,
    zIndex: 2,
    backgroundColor: dark ? "#202c33" : "#fff",
    color: dark ? "#8696a0" : "#54656f",
    "&:hover": {
      backgroundColor: dark ? "#2a3942" : "#f5f5f5",
    },
  },

  newMessagesBadge: {
    backgroundColor: green[500],
    color: "#fff",
  },

  quotedClickable: {
    cursor: "pointer",
  },

  "@keyframes highlightMessage": {
    "0%": { boxShadow: "0 0 0 4px rgba(37, 211, 102, 0.8)" },
    "100%": { boxShadow: "0 0 0 4px rgba(37, 211, 102, 0)" },
  },

  highlighted: {
    animation: "$highlightMessage 1.8s ease-out",
  },

  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10,
  },
  };
});

const reducer = (state, action) => {
  if (action.type === "LOAD_MESSAGES") {
    const messages = action.payload;
    const newMessages = [];

    messages.forEach((message) => {
      const messageIndex = state.findIndex((m) => m.id === message.id);
      if (messageIndex !== -1) {
        state[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });

    return [...newMessages, ...state];
  }

  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    const messageIndex = state.findIndex((m) => m.id === newMessage.id);

    if (messageIndex !== -1) {
      state[messageIndex] = newMessage;
    } else {
      state.push(newMessage);
    }

    return [...state];
  }

  if (action.type === "UPDATE_MESSAGE") {
    const messageToUpdate = action.payload;
    const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);

    if (messageIndex !== -1) {
      state[messageIndex] = messageToUpdate;
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

// With contactId it shows the whole conversation of the contact (every
// ticket), otherwise only the messages of ticketId.
const MessagesList = ({
  ticketId,
  contactId,
  isGroup,
  onNewMessage,
  onInitialLoad,
}) => {
  const classes = useStyles();

  const [messagesList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversationTicketIds, setConversationTicketIds] = useState([]);
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const lastMessageRef = useRef();
  const listRef = useRef();

  // "N unread messages" separator, fixed when the chat is opened
  const [firstUnreadId, setFirstUnreadId] = useState(null);
  const [unreadOnOpen, setUnreadOnOpen] = useState(0);
  // scroll position: new messages only follow the chat when at the bottom
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  const [newWhileAway, setNewWhileAway] = useState(0);
  // what to scroll to after the next render: "bottom", "unread" or null
  const pendingScroll = useRef(null);
  // jump to a quoted message, loading older pages until it shows up
  const [jumpTarget, setJumpTarget] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);

  const [selectedMessage, setSelectedMessage] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);
  const listKey = contactId ? `contact-${contactId}` : ticketId;
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;
  const onInitialLoadRef = useRef(onInitialLoad);
  onInitialLoadRef.current = onInitialLoad;
  const currentTicketId = useRef(listKey);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
    setConversationTicketIds([]);
    setFirstUnreadId(null);
    setUnreadOnOpen(0);
    setNewWhileAway(0);
    setJumpTarget(null);
    setAtBottom(true);
    atBottomRef.current = true;

    currentTicketId.current = listKey;
  }, [listKey]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchMessages = async () => {
        try {
          const url = contactId
            ? `/conversations/${contactId}/messages`
            : "/messages/" + ticketId;
          const { data } = await api.get(url, {
            params: { pageNumber },
          });

          if (currentTicketId.current === listKey) {
            // set before dispatching: React 16 renders synchronously here and
            // the next state update already flushes the effect reading it
            let unread = [];
            if (pageNumber === 1) {
              unread = data.messages.filter((m) => !m.fromMe && !m.read);
              pendingScroll.current = unread.length ? "unread" : "bottom";
            }

            dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
            if (unread.length) {
              setFirstUnreadId(unread[0].id);
              setUnreadOnOpen(unread.length);
            }
            setHasMore(data.hasMore);
            setLoading(false);
            if (contactId) setConversationTicketIds(data.ticketIds);
            // e.g. mark as read only after the unread separator was computed
            if (pageNumber === 1 && onInitialLoadRef.current) {
              onInitialLoadRef.current();
            }
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchMessages();
    }, 500);
    return () => {
      clearTimeout(delayDebounceFn);
    };
  }, [pageNumber, ticketId, contactId, listKey]);

  useEffect(() => {
    if (contactId) return undefined;

    const socket = openSocket();

    socket.on("connect", () => socket.emit("joinChatBox", ticketId));

    socket.on("appMessage", (data) => {
      if (data.action === "create") {
        followNewMessage(data.message);
        dispatch({ type: "ADD_MESSAGE", payload: data.message });
      }

      if (data.action === "update") {
        dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticketId, contactId]);

  const conversationTicketIdsKey = conversationTicketIds.join(",");

  useEffect(() => {
    if (!contactId) return undefined;

    const socket = openSocket();
    // new messages arrive on "notification"; acks and deletes only on each
    // ticket's room
    const joinedTickets = new Set(
      conversationTicketIdsKey ? conversationTicketIdsKey.split(",") : []
    );

    socket.on("connect", () => {
      socket.emit("joinNotification");
      joinedTickets.forEach((id) => socket.emit("joinChatBox", id));
    });

    socket.on("appMessage", (data) => {
      if (data.action === "create") {
        if (data.message?.ticket?.contactId !== Number(contactId)) return;

        const newTicketId = String(data.message.ticketId);
        if (!joinedTickets.has(newTicketId)) {
          joinedTickets.add(newTicketId);
          socket.emit("joinChatBox", newTicketId);
        }

        followNewMessage(data.message);
        dispatch({ type: "ADD_MESSAGE", payload: data.message });
        if (onNewMessageRef.current) onNewMessageRef.current(data.message);
      }

      if (data.action === "update") {
        dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [contactId, conversationTicketIdsKey]);

  const loadMore = () => {
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
  };

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    setNewWhileAway(0);
  };

  // called from the socket handlers: uses refs/setters only
  function followNewMessage(message) {
    if (message.fromMe || atBottomRef.current) {
      pendingScroll.current = "bottom";
    } else {
      setNewWhileAway((count) => count + 1);
    }
  }

  useEffect(() => {
    const pending = pendingScroll.current;
    if (!pending) return;
    pendingScroll.current = null;

    const separator = document.getElementById("unread-separator");
    if (pending === "unread" && separator) {
      separator.scrollIntoView({ block: "start" });
    } else {
      scrollToBottom();
    }
  }, [messagesList]);

  const jumpToMessage = (messageId) => {
    if (!messageId) return;
    setJumpTarget({ id: messageId, attempts: 0 });
  };

  useEffect(() => {
    if (!jumpTarget || loading) return;

    const element = document.getElementById(`message-${jumpTarget.id}`);
    if (element) {
      element.scrollIntoView({ block: "center", behavior: "smooth" });
      setHighlightedId(jumpTarget.id);
      setJumpTarget(null);
      return;
    }

    // not loaded yet: fetch older pages (bounded)
    if (hasMore && jumpTarget.attempts < 15) {
      setJumpTarget({ ...jumpTarget, attempts: jumpTarget.attempts + 1 });
      setPageNumber((page) => page + 1);
    } else {
      setJumpTarget(null);
    }
  }, [jumpTarget, loading, hasMore, messagesList]);

  useEffect(() => {
    if (!highlightedId) return undefined;
    const timeout = setTimeout(() => setHighlightedId(null), 1800);
    return () => clearTimeout(timeout);
  }, [highlightedId]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    const isAtBottom = scrollHeight - scrollTop - clientHeight < 80;
    if (isAtBottom !== atBottomRef.current) {
      atBottomRef.current = isAtBottom;
      setAtBottom(isAtBottom);
    }
    if (isAtBottom && newWhileAway) setNewWhileAway(0);

    if (!hasMore) return;

    if (scrollTop === 0) {
      document.getElementById("messagesList").scrollTop = 1;
    }

    if (loading) {
      return;
    }

    if (scrollTop < 50) {
      loadMore();
    }
  };

  const handleOpenMessageOptionsMenu = (e, message) => {
    setAnchorEl(e.currentTarget);
    setSelectedMessage(message);
  };

  const handleCloseMessageOptionsMenu = (e) => {
    setAnchorEl(null);
  };

  const checkMessageMedia = (message) => {
    if (message.mediaType === "location" && message.body.split('|').length >= 2) {
      let locationParts = message.body.split('|')
      let imageLocation = locationParts[0]
      let linkLocation = locationParts[1]

      let descriptionLocation = null

      if (locationParts.length > 2)
        descriptionLocation = message.body.split('|')[2]

      return <LocationPreview image={imageLocation} link={linkLocation} description={descriptionLocation} />
    }
    else if (message.mediaType === "vcard") {
      //console.log("vcard")
      //console.log(message)
      let array = message.body.split("\n");
      let obj = [];
      let contact = "";
      for (let index = 0; index < array.length; index++) {
        const v = array[index];
        let values = v.split(":");
        for (let ind = 0; ind < values.length; ind++) {
          if (values[ind].indexOf("+") !== -1) {
            obj.push({ number: values[ind] });
          }
          if (values[ind].indexOf("FN") !== -1) {
            contact = values[ind + 1];
          }
        }
      }
      return <VcardPreview contact={contact} numbers={obj[0]?.number} />
    }
    /*else if (message.mediaType === "multi_vcard") {
      console.log("multi_vcard")
      console.log(message)
    	
      if(message.body !== null && message.body !== "") {
        let newBody = JSON.parse(message.body)
        return (
          <>
            {
            newBody.map(v => (
              <VcardPreview contact={v.name} numbers={v.number} />
            ))
            }
          </>
        )
      } else return (<></>)
    }*/
    else if ( /^.*\.(jpe?g|png|gif)?$/i.exec(message.mediaUrl) && message.mediaType === "image") {
      return <ModalImageCors imageUrl={message.mediaUrl} />;
    } else if (message.mediaType === "audio") {
      return <Audio url={message.mediaUrl} />
    } else if (message.mediaType === "video") {
      return (
        <video
          className={classes.messageMedia}
          src={message.mediaUrl}
          controls
        />
      );
    } else {
      return (
        <>
          <div className={classes.downloadMedia}>
            <Button
              startIcon={<GetApp />}
              color="primary"
              variant="outlined"
              target="_blank"
              href={message.mediaUrl}
            >
              Download
            </Button>
          </div>
          <Divider />
        </>
      );
    }
  };

  const renderMessageAck = (message) => {
    if (message.ack === 0) {
      return <AccessTime fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 1) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 2) {
      return <DoneAll fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 3 || message.ack === 4) {
      return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />;
    }
  };

  const renderDailyTimestamps = (message, index) => {
    const isNewDay =
      index === 0 ||
      !isSameDay(
        parseISO(message.createdAt),
        parseISO(messagesList[index - 1].createdAt)
      );

    return (
      <>
        {isNewDay && (
          <span
            className={classes.dailyTimestamp}
            key={`timestamp-${message.id}`}
          >
            <div className={classes.dailyTimestampText}>
              {formatDayLabel(message.createdAt)}
            </div>
          </span>
        )}
        {index === messagesList.length - 1 && (
          <div
            key={`ref-${message.createdAt}`}
            ref={lastMessageRef}
            style={{ float: "left", clear: "both" }}
          />
        )}
      </>
    );
  };

  const renderUnreadSeparator = (message) =>
    message.id === firstUnreadId ? (
      <span id="unread-separator" className={classes.unreadSeparator}>
        {i18n.t("messagesList.unreadSeparator", { count: unreadOnOpen })}
      </span>
    ) : null;

  const startsSequence = (index) =>
    index === 0 ||
    messagesList[index - 1].fromMe !== messagesList[index].fromMe ||
    !isSameDay(
      parseISO(messagesList[index].createdAt),
      parseISO(messagesList[index - 1].createdAt)
    );

  const renderMessageDivider = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageUser = messagesList[index].fromMe;
      let previousMessageUser = messagesList[index - 1].fromMe;

      if (messageUser !== previousMessageUser) {
        return (
          <span style={{ marginTop: 16 }} key={`divider-${message.id}`}></span>
        );
      }
    }
  };

  const renderQuotedMessage = (message) => {
    return (
      <div
        className={clsx(classes.quotedContainerLeft, classes.quotedClickable, {
          [classes.quotedContainerRight]: message.fromMe,
        })}
        onClick={() => jumpToMessage(message.quotedMsg?.id)}
      >
        <span
          className={clsx(classes.quotedSideColorLeft, {
            [classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
          })}
        ></span>
        <div className={classes.quotedMsg}>
          {!message.quotedMsg?.fromMe && (
            <span className={classes.messageContactName}>
              {message.quotedMsg?.contact?.name}
            </span>
          )}
          {message.quotedMsg?.body}
        </div>
      </div>
    );
  };

  // double click on a message = "Reply", like WhatsApp Web
  const handleReplyOnDoubleClick = (message) => {
    if (message.isDeleted) return;
    window.getSelection()?.removeAllRanges();
    setReplyingMessage(message);
  };

  // deleted messages stay in the chat (text kept), just flagged
  const renderEditedLabel = (message) => {
    if (message.isDeleted) {
      return (
        <span className={classes.editedLabel}>
          {i18n.t("messagesList.deleted")}
        </span>
      );
    }
    return message.isEdited ? (
      <span className={classes.editedLabel}>
        {i18n.t("messagesList.edited")}
      </span>
    ) : null;
  };

  // same emoji from several people shows once, with the count
  const renderReactions = (message) => {
    if (!message.reactions?.length) return null;

    const counts = message.reactions.reduce((acc, { emoji }) => {
      acc[emoji] = (acc[emoji] || 0) + 1;
      return acc;
    }, {});

    return (
      <div className={classes.reactions}>
        {Object.entries(counts).map(([emoji, count]) => (
          <span key={emoji}>
            {emoji}
            {count > 1 && (
              <span className={classes.reactionCount}>{count}</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  const renderMessages = () => {
    if (messagesList.length > 0) {
      const viewMessagesList = messagesList.map((message, index) => {
        if (!message.fromMe) {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderMessageDivider(message, index)}
              {renderUnreadSeparator(message)}
              <div
                id={`message-${message.id}`}
                className={clsx(classes.messageLeft, {
                  [classes.tailLeft]: startsSequence(index),
                  [classes.highlighted]: highlightedId === message.id,
                })}
                onDoubleClick={() => handleReplyOnDoubleClick(message)}
              >
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {isGroup && (
                  <span className={classes.messageContactName}>
                    {message.contact?.name}
                  </span>
                )}
                {(message.mediaUrl || message.mediaType === "location" || message.mediaType === "vcard"
                  //|| message.mediaType === "multi_vcard" 
                ) && checkMessageMedia(message)}
                <div
                  className={clsx(classes.textContentItem, {
                    [classes.textContentItemDeleted]: message.isDeleted,
                    [classes.textContentItemEdited]:
                      message.isEdited || message.isDeleted,
                  })}
                >
                  {message.isDeleted && (
                    <Block
                      color="disabled"
                      fontSize="small"
                      className={classes.deletedIcon}
                    />
                  )}
                  {message.quotedMsg && renderQuotedMessage(message)}
                  <MarkdownWrapper>{message.body}</MarkdownWrapper>
                  <span className={classes.timestamp}>
                    {renderEditedLabel(message)}
                    {format(parseISO(message.createdAt), "HH:mm")}
                  </span>
                </div>
                {renderReactions(message)}
              </div>
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderMessageDivider(message, index)}
              <div
                id={`message-${message.id}`}
                className={clsx(classes.messageRight, {
                  [classes.tailRight]: startsSequence(index),
                  [classes.highlighted]: highlightedId === message.id,
                })}
                onDoubleClick={() => handleReplyOnDoubleClick(message)}
              >
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {(message.mediaUrl || message.mediaType === "location" || message.mediaType === "vcard"
                  //|| message.mediaType === "multi_vcard" 
                ) && checkMessageMedia(message)}
                <div
                  className={clsx(classes.textContentItem, {
                    [classes.textContentItemDeleted]: message.isDeleted,
                    [classes.textContentItemEdited]:
                      message.isEdited || message.isDeleted,
                  })}
                >
                  {message.isDeleted && (
                    <Block
                      color="disabled"
                      fontSize="small"
                      className={classes.deletedIcon}
                    />
                  )}
                  {message.quotedMsg && renderQuotedMessage(message)}
                  <MarkdownWrapper>{message.body}</MarkdownWrapper>
                  <span className={classes.timestamp}>
                    {renderEditedLabel(message)}
                    {format(parseISO(message.createdAt), "HH:mm")}
                    {renderMessageAck(message)}
                  </span>
                </div>
                {renderReactions(message)}
              </div>
            </React.Fragment>
          );
        }
      });
      return viewMessagesList;
    } else {
      return <div>Say hello to your new contact!</div>;
    }
  };

  return (
    <div className={classes.messagesListWrapper}>
      <MessageOptionsMenu
        message={selectedMessage}
        anchorEl={anchorEl}
        menuOpen={messageOptionsMenuOpen}
        handleClose={handleCloseMessageOptionsMenu}
      />
      <div
        id="messagesList"
        ref={listRef}
        className={classes.messagesList}
        onScroll={handleScroll}
      >
        {messagesList.length > 0 ? renderMessages() : []}
      </div>
      {!atBottom && (
        <Fab
          size="small"
          className={classes.scrollToBottomButton}
          onClick={scrollToBottom}
        >
          <Badge
            badgeContent={newWhileAway}
            classes={{ badge: classes.newMessagesBadge }}
          >
            <KeyboardArrowDown />
          </Badge>
        </Fab>
      )}
      {loading && (
        <div>
          <CircularProgress className={classes.circleLoading} />
        </div>
      )}
    </div>
  );
};

export default MessagesList;