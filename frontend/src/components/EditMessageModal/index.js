import React, { useState, useEffect } from "react";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";

const EditMessageModal = ({ open, onClose, message }) => {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setBody(message?.body || "");
  }, [open, message]);

  const unchanged = body.trim() === (message?.body || "").trim();

  const handleSave = async () => {
    if (!body.trim() || unchanged) return;
    setLoading(true);
    try {
      await api.put(`/messages/${message.id}`, { body: body.trim() });
      onClose();
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{i18n.t("editMessageModal.title")}</DialogTitle>
      <DialogContent dividers>
        <TextField
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            // Enter saves, Shift+Enter breaks the line (like the chat input)
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
          }}
          variant="outlined"
          multiline
          fullWidth
          autoFocus
          minRows={2}
          maxRows={10}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          color="secondary"
          variant="outlined"
          disabled={loading}
        >
          {i18n.t("editMessageModal.cancel")}
        </Button>
        <ButtonWithSpinner
          variant="contained"
          color="primary"
          loading={loading}
          disabled={!body.trim() || unchanged}
          onClick={handleSave}
        >
          {i18n.t("editMessageModal.save")}
        </ButtonWithSpinner>
      </DialogActions>
    </Dialog>
  );
};

export default EditMessageModal;
