import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatBrlNumber(num: number, fractionDigits = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(num);
}

export function formatDate(date: string | Date | null | undefined, formatStr = "dd/MM/yyyy HH:mm") {
  if (!date) return "-";
  return format(new Date(date), formatStr, { locale: ptBR });
}

export function formatPercent(num: number | null | undefined) {
  if (num === null || num === undefined) return "-";
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(num);
}
