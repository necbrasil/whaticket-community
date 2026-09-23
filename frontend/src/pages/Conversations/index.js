import React from "react";
import { useParams } from "react-router-dom";

import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Hidden from "@material-ui/core/Hidden";
import { makeStyles } from "@material-ui/core/styles";

import ConversationsList from "../../components/ConversationsList";
import Conversation from "../../components/Conversation";
import { i18n } from "../../translate/i18n";

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
  },
  // on phones the list hides while a conversation is open
  listWrapperWithChat: {
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflowY: "hidden",
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  chatWrapper: {
    display: "flex",
    height: "100%",
    flexDirection: "column",
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

const Conversations = () => {
  const classes = useStyles();
  const { contactId } = useParams();

  return (
    <div className={classes.container}>
      <div className={classes.paper}>
        <Grid container spacing={0}>
          <Grid
            item
            xs={12}
            md={4}
            className={
              contactId ? classes.listWrapperWithChat : classes.listWrapper
            }
          >
            <ConversationsList selectedContactId={contactId} />
          </Grid>
          <Grid item xs={12} md={8} className={classes.chatWrapper}>
            {contactId ? (
              <Conversation contactId={contactId} />
            ) : (
              <Hidden only={["sm", "xs"]}>
                <Paper className={classes.welcomeMsg}>
                  <span>{i18n.t("conversations.selectConversation")}</span>
                </Paper>
              </Hidden>
            )}
          </Grid>
        </Grid>
      </div>
    </div>
  );
};

export default Conversations;
