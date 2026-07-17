export const smsDeliveryDisabledMessage = "Wysyłka SMS jest wyłączona na czas pilota. Wiadomość może pozostać wyłącznie szkicem.";

export function isSmsDeliveryEnabled(value = process.env.STAWY_OS_SMS_ENABLED) {
  return value === "true";
}
