export function guestDisplayName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

export function validateGuestStep(firstName: string, lastName: string) {
  return guestDisplayName(firstName, lastName) ? undefined : "Wpisz imię, nazwisko albo nazwę rezerwacji.";
}
