import React, { useState, useEffect, useCallback, useRef } from "react";
import { useHistory } from "react-router-dom";
import clsx from "clsx";

import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Paper,
  makeStyles,
} from "@material-ui/core";
import ArrowBackIos from "@material-ui/icons/ArrowBackIos";

import ContactDrawer from "../ContactDrawer";
import MessageInput from "../MessageInput/";
import MessagesList from "../MessagesList";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";
import api from "../../services/api";
import openSocket from "../../services/socket-io";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import toastError from "../../errors/toastError";

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },
  mainWrapper: {
    flex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    marginRight: -drawerWidth,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
  },
  header: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#eee",
    flex: "none",
    borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
  },
  backButton: {
    [theme.breakpoints.up("md")]: {
      display: "none",
    },
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
    cursor: "pointer",
  },
}));

const Conversation = ({ contactId }) => {
  const classes = useStyles();
  const history = useHistory();

  const [contact, setContact] = useState({});
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const readTimeout = useRef();

  const markAsRead = useCallback(() => {
    clearTimeout(readTimeout.current);
    readTimeout.current = setTimeout(async () => {
      try {
        await api.post(`/conversations/${contactId}/read`);
      } catch (err) {
        // not critical: the badge just stays until the next open
      }
    }, 500);
  }, [contactId]);

  useEffect(() => () => clearTimeout(readTimeout.current), []);

  useEffect(() => {
    setLoading(true);
    setDrawerOpen(false);
    const fetchContact = async () => {
      try {
        const { data } = await api.get(`/contacts/${contactId}`);
        setContact(data);
      } catch (err) {
        toastError(err);
      }
      setLoading(false);
    };
    fetchContact();
    markAsRead();
  }, [contactId, markAsRead]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("contact", (data) => {
      if (data.action === "update" && data.contact?.id === Number(contactId)) {
        setContact((prev) => ({ ...prev, ...data.contact }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [contactId]);

  const handleNewMessage = useCallback(
    (message) => {
      // the conversation is on screen, so what arrives is already read
      if (!message.fromMe) markAsRead();
    },
    [markAsRead]
  );

  // resolved on each send: the current open ticket may have been closed
  // meanwhile on the tickets page
  const getTicketId = useCallback(async () => {
    const { data } = await api.post(`/conversations/${contactId}/ticket`);
    return data.ticketId;
  }, [contactId]);

  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        variant="outlined"
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen,
        })}
      >
        {loading ? (
          <TicketHeaderSkeleton />
        ) : (
          <Card square className={classes.header}>
            <Button
              color="primary"
              className={classes.backButton}
              onClick={() => history.push("/conversations")}
            >
              <ArrowBackIos />
            </Button>
            <CardHeader
              className={classes.headerInfo}
              onClick={() => setDrawerOpen(true)}
              titleTypographyProps={{ noWrap: true }}
              subheaderTypographyProps={{ noWrap: true }}
              avatar={<Avatar src={contact.profilePicUrl} />}
              title={contact.name}
              subheader={contact.isGroup ? null : contact.number}
            />
          </Card>
        )}
        <ReplyMessageProvider>
          <MessagesList
            contactId={contactId}
            isGroup={contact.isGroup}
            onNewMessage={handleNewMessage}
          />
          <MessageInput
            ticketStatus="open"
            getTicketId={getTicketId}
            resetKey={contactId}
          />
        </ReplyMessageProvider>
      </Paper>
      <ContactDrawer
        open={drawerOpen}
        handleDrawerClose={() => setDrawerOpen(false)}
        contact={contact}
        loading={loading}
      />
    </div>
  );
};

export default Conversation;
