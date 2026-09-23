import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import Autocomplete from "@material-ui/lab/Autocomplete";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ContactModal from "../ContactModal";
import toastError from "../../errors/toastError";

const NewConversationModal = ({ open, onClose }) => {
  const history = useHistory();

  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [newContact, setNewContact] = useState({});

  useEffect(() => {
    if (!open || searchParam.length < 3) {
      setOptions([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const { data } = await api.get("contacts", {
          params: { searchParam },
        });
        setOptions(data.contacts);
      } catch (err) {
        toastError(err);
      }
      setLoading(false);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, open]);

  const handleClose = () => {
    setSearchParam("");
    setOptions([]);
    onClose();
  };

  const openConversation = (contactId) => {
    handleClose();
    history.push(`/conversations/${contactId}`);
  };

  const handleSelect = (e, option) => {
    if (!option) return;
    if (option.id) {
      openConversation(option.id);
      return;
    }
    // not a saved contact: create it, prefilled with what was typed
    const digits = option.input.replace(/\D/g, "");
    setNewContact(
      digits.length >= 8
        ? { name: option.input, number: digits }
        : { name: option.input }
    );
    setContactModalOpen(true);
  };

  const withCreateOption = (list) => {
    const input = searchParam.trim();
    if (!input || loading || searchParam.length < 3) return list;
    const digits = input.replace(/\D/g, "");
    const label =
      digits.length >= 8 && digits.length === input.replace(/[\s()+-]/g, "").length
        ? `${i18n.t("conversations.newConversation.startWith")} ${input}`
        : `${i18n.t("conversations.newConversation.addContact")}: ${input}`;
    return [...list, { input, label }];
  };

  return (
    <>
      <ContactModal
        open={contactModalOpen}
        initialValues={newContact}
        onClose={() => setContactModalOpen(false)}
        onSave={(contact) => openConversation(contact.id)}
      />
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{i18n.t("conversations.newConversation.title")}</DialogTitle>
        <DialogContent dividers>
          <Autocomplete
            options={options}
            loading={loading}
            style={{ width: 300 }}
            autoHighlight
            clearOnBlur
            filterOptions={withCreateOption}
            getOptionLabel={(option) =>
              option.id ? `${option.name} - ${option.number}` : option.label
            }
            onChange={handleSelect}
            renderInput={(params) => (
              <TextField
                {...params}
                label={i18n.t("conversations.newConversation.fieldLabel")}
                variant="outlined"
                autoFocus
                onChange={(e) => setSearchParam(e.target.value)}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <React.Fragment>
                      {loading ? (
                        <CircularProgress color="inherit" size={20} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </React.Fragment>
                  ),
                }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="secondary" variant="outlined">
            {i18n.t("conversations.newConversation.cancel")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default NewConversationModal;
