import React, { useEffect, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import clsx from "clsx";

import Paper from "@material-ui/core/Paper";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { makeStyles, useTheme } from "@material-ui/core/styles";

import ConversationsList from "../../components/ConversationsList";
import Conversation from "../../components/Conversation";
import { i18n } from "../../translate/i18n";

const MIN_LIST_WIDTH = 260;
const DEFAULT_LIST_WIDTH = 380;
const LIST_WIDTH_KEY = "conversationsListWidth";

const useStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
    height: `calc(100% - 48px)`,
    overflowY: "hidden",
    backgroundColor: theme.palette.background.default,
  },
  paper: {
    display: "flex",
    height: "100%",
    backgroundColor: theme.palette.background.paper,
  },
  listWrapper: {
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflowY: "hidden",
    flex: "none",
    [theme.breakpoints.down("sm")]: {
      width: "100%",
    },
  },
  // on phones the list hides while a conversation is open
  listWrapperWithChat: {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  resizer: {
    flex: "none",
    width: 5,
    cursor: "col-resize",
    backgroundColor: theme.palette.divider,
    transition: "background-color 0.15s",
    "&:hover, &$resizing": {
      backgroundColor: theme.palette.primary.main,
    },
  },
  resizing: {},
  chatWrapper: {
    display: "flex",
    height: "100%",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
  },
  chatWrapperEmpty: {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  welcomeMsg: {
    backgroundColor: theme.palette.background.paper,
    display: "flex",
    justifyContent: "space-evenly",
    alignItems: "center",
    height: "100%",
    textAlign: "center",
    borderRadius: 0,
  },
}));

const maxListWidth = () => Math.max(MIN_LIST_WIDTH, window.innerWidth * 0.6);

const clampListWidth = (width) =>
  Math.min(Math.max(width, MIN_LIST_WIDTH), maxListWidth());

const readStoredWidth = () => {
  try {
    const stored = Number(localStorage.getItem(LIST_WIDTH_KEY));
    return stored ? clampListWidth(stored) : DEFAULT_LIST_WIDTH;
  } catch {
    return DEFAULT_LIST_WIDTH;
  }
};

const Conversations = () => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();
  const { contactId } = useParams();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  // the list width is dragged by the divider and remembered per browser
  const [listWidth, setListWidth] = useState(readStoredWidth);
  const [resizing, setResizing] = useState(false);
  const dragStart = useRef(null);

  const handleResizeStart = (e) => {
    e.preventDefault();
    dragStart.current = { x: e.clientX, width: listWidth };
    setResizing(true);
  };

  useEffect(() => {
    if (!resizing) return undefined;

    const handleMouseMove = (e) => {
      const { x, width } = dragStart.current;
      setListWidth(clampListWidth(width + e.clientX - x));
    };
    const handleMouseUp = () => setResizing(false);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

  useEffect(() => {
    if (resizing) return;
    try {
      localStorage.setItem(LIST_WIDTH_KEY, String(Math.round(listWidth)));
    } catch {
      // only a preference
    }
  }, [listWidth, resizing]);

  // keep the list within bounds when the window shrinks
  useEffect(() => {
    const handleWindowResize = () => setListWidth((w) => clampListWidth(w));
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  // Esc closes the open conversation, like WhatsApp Web. Dialogs (contact,
  // new conversation, image preview) handle their own Esc first.
  useEffect(() => {
    if (!contactId) return undefined;

    const handleKeyDown = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [role="presentation"]')) {
        return;
      }
      history.push("/conversations");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contactId, history]);

  return (
    <div className={classes.container}>
      <div className={classes.paper}>
        <div
          className={clsx(classes.listWrapper, {
            [classes.listWrapperWithChat]: contactId,
          })}
          style={isDesktop ? { width: listWidth } : undefined}
        >
          <ConversationsList selectedContactId={contactId} />
        </div>
        {isDesktop && (
          <div
            className={clsx(classes.resizer, {
              [classes.resizing]: resizing,
            })}
            onMouseDown={handleResizeStart}
            onDoubleClick={() => setListWidth(DEFAULT_LIST_WIDTH)}
          />
        )}
        <div
          className={clsx(classes.chatWrapper, {
            [classes.chatWrapperEmpty]: !contactId,
          })}
        >
          {contactId ? (
            <Conversation contactId={contactId} />
          ) : (
            <Paper className={classes.welcomeMsg}>
              <span>{i18n.t("conversations.selectConversation")}</span>
            </Paper>
          )}
        </div>
      </div>
    </div>
  );
};

export default Conversations;
