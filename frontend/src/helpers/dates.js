import {
  differenceInCalendarDays,
  format,
  isToday,
  isYesterday,
  parseISO,
} from "date-fns";

import { i18n } from "../translate/i18n";

const toDate = (date) =>
  typeof date === "string" ? parseISO(date) : new Date(date);

const weekdayName = (date) => {
  const name = new Intl.DateTimeFormat(i18n.language || "pt-BR", {
    weekday: "long",
  }).format(date);
  return name.charAt(0).toUpperCase() + name.slice(1);
};

// Like WhatsApp: "Ontem", the weekday during the last week, then the date
const isLastWeek = (date) => differenceInCalendarDays(new Date(), date) < 7;

// Time shown on the conversations list: 14:32 / Ontem / Segunda-feira / 12/09/2026
export const formatListTime = (value) => {
  if (!value) return "";
  const date = toDate(value);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return i18n.t("dates.yesterday");
  if (isLastWeek(date)) return weekdayName(date);
  return format(date, "dd/MM/yyyy");
};

// Day separator inside a chat: Hoje / Ontem / Segunda-feira / 12/09/2026
export const formatDayLabel = (value) => {
  const date = toDate(value);
  if (isToday(date)) return i18n.t("dates.today");
  if (isYesterday(date)) return i18n.t("dates.yesterday");
  if (isLastWeek(date)) return weekdayName(date);
  return format(date, "dd/MM/yyyy");
};
