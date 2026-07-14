export type UserRole = "owner" | "admin" | "viewer";

export type WorkflowStatus =
  | "Nowa"
  | "Potwierdzona"
  | "Przed przyjazdem"
  | "W trakcie"
  | "Po pobycie"
  | "Zamknięta"
  | "Anulowana";

export type PaymentStatus =
  | "Do uzupełnienia"
  | "Zaliczka"
  | "Opłacone"
  | "Częściowo"
  | "Do dopłaty"
  | "Anulowane"
  | "Barter";

export type Channel =
  | "Bezpośrednio"
  | "Booking"
  | "Airbnb"
  | "Facebook"
  | "Google"
  | "AI/czat"
  | "Polecenie"
  | "Telefon"
  | "E-mail"
  | "Strona www"
  | "Agoda"
  | "Expedia"
  | "VRBO"
  | "Slowhop"
  | "Aloha Camp"
  | "Influencer/barter"
  | "Inne";

export type TaskType =
  | "Dane"
  | "Rezerwacja"
  | "Płatność"
  | "Przed przyjazdem"
  | "Sprzątanie"
  | "Content"
  | "Opinia"
  | "Follow-up"
  | "Naprawa"
  | "Inne";

export type TaskStatus =
  | "Do zrobienia"
  | "W toku"
  | "Zrobione"
  | "Zablokowane"
  | "Nie dotyczy";

export type Priority = "Wysoki" | "Średni" | "Niski";

export type MediaStatus =
  | "Do zgody"
  | "Można użyć"
  | "Opublikowane"
  | "Nie używać"
  | "Wygasło/wycofane";

export type SyncStatus =
  | "Aktywne"
  | "Do podłączenia"
  | "Wymaga sprawdzenia"
  | "Ręczny backup"
  | "Błąd";

export type ConnectionType =
  | "API"
  | "iCal"
  | "CSV/email"
  | "Channel manager"
  | "Ręcznie";

export type DataQuality = "Pełne" | "Częściowe" | "Minimalne";

export type Unit = {
  id: string;
  name: string;
  maxPeople: number;
  bedrooms: number;
  defaultCleaningCost: number;
  notes: string;
};

export type Booking = {
  id: string;
  bookingDate: string;
  source: string;
  platform: Channel;
  platformReservationNo?: string;
  unitId: string;
  checkIn: string;
  checkOut: string;
  arrivalTime?: string;
  departureTime?: string;
  adults: number;
  children: number;
  guestLabel: string;
  cityArea?: string;
  grossPrice?: number;
  pricePerNight?: number;
  depositAmount?: number;
  depositDueDate?: string;
  paymentMethod?: "Brak" | "Przelew" | "Gotówka" | "Karta" | "Online";
  currency?: "PLN" | "EUR";
  paymentStatus: PaymentStatus;
  workflowStatus: WorkflowStatus;
  specialRequests?: string;
  createdBy: string;
  version?: number;
  needsReview?: boolean;
  updatedAt?: string;
};

export type GuestProfile = {
  bookingId: string;
  groupType?: string;
  segment?: string;
  decisionMaker?: string;
  motivation?: string;
  childrenAges?: string;
  jobsLifestyle?: string;
  discoveryChannel?: Channel;
  bookingChannel?: Channel;
  searchPhraseOrAiPrompt?: string;
  bestQuote?: string;
  objections?: string;
  nps?: number;
  satisfaction?: number;
};

export type ContactConsent = {
  bookingId: string;
  phone?: string;
  email?: string;
  marketingConsent: "Tak" | "Nie" | "Do dopytania" | "Nie dotyczy";
  photoFbConsent: "Tak" | "Nie" | "Do dopytania" | "Nie dotyczy";
  photoSiteAdsConsent: "Tak" | "Nie" | "Do dopytania" | "Nie dotyczy";
  consentScope?: string;
  consentSource?: string;
  consentDate?: string;
  consentWithdrawnAt?: string;
};

export type OpsTask = {
  id: string;
  bookingId: string;
  type: TaskType;
  priority: Priority;
  status: TaskStatus;
  dueDate?: string;
  owner: string;
  unitId?: string;
  title: string;
  blocker?: string;
  completedAt?: string;
  comment?: string;
};

export type PaymentTransaction = {
  id: string;
  bookingId: string;
  occurredAt: string;
  type: "Wpłata" | "Zaliczka" | "Zwrot" | "Prowizja" | "Wypłata OTA" | "Koszt";
  amount: number;
  status: "Oczekuje" | "Zaksięgowana" | "Anulowana";
  method?: Booking["paymentMethod"];
  note?: string;
};

export type InvoiceRecord = {
  id: string;
  bookingId?: string;
  number: string;
  issuedAt: string;
  amount: number;
  status: "Do wystawienia" | "Wystawiona" | "Opłacona" | "Anulowana";
  note?: string;
};

export type TaskChecklistItem = {
  id: string;
  taskId: string;
  label: string;
  done: boolean;
  completedAt?: string;
};

export type IssueReport = {
  id: string;
  taskId?: string;
  bookingId?: string;
  unitId?: string;
  title: string;
  description?: string;
  status: "Otwarte" | "W toku" | "Rozwiązane";
  createdAt: string;
};

export type MessageRecord = {
  id: string;
  bookingId?: string;
  taskId?: string;
  channel: "SMS" | "E-mail" | "OTA" | "Notatka";
  direction: "Wychodząca" | "Przychodząca";
  recipient?: string;
  body: string;
  status: "Wersja robocza" | "W kolejce" | "Wysłana" | "Dostarczona" | "Błąd";
  createdAt: string;
  idempotencyKey?: string;
};

export type AuditEvent = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  createdAt: string;
  actor: string;
};

export type AppSettings = {
  organizationName: string;
  timezone: "Europe/Warsaw";
  cleaningContactName: string;
  cleaningPhone: string;
  defaultCheckIn: string;
  defaultCheckOut: string;
  aiApprovalRequired: boolean;
};

export type MediaAsset = {
  id: string;
  bookingId: string;
  type: "Zdjęcie" | "Wideo" | "Cytat" | "Opinia" | "Post" | "Inne";
  fileUrl?: string;
  caption?: string;
  peopleVisible?: string;
  consentScope?: string;
  usageStatus: MediaStatus;
  publishChannel:
    | "Facebook"
    | "Instagram"
    | "Strona"
    | "Reklama"
    | "Google Business Profile"
    | "Booking"
    | "Airbnb"
    | "Nie dotyczy";
  privacyRisk:
    | "Brak danych osobowych"
    | "Kontakt"
    | "Profil marketingowy"
    | "Zgoda/RODO"
    | "Finanse"
    | "Wrażliwe - unikać";
};

export type CalendarBlock = {
  id: string;
  unitId: string;
  dateFrom: string;
  dateTo: string;
  blockType:
    | "Właściciel"
    | "Serwis"
    | "Remont"
    | "Bufor sprzątania"
    | "Influencer/barter"
    | "Inne";
  reason: string;
  status: "Planowana" | "Aktywna" | "Zakończona" | "Anulowana";
};

export type RateRule = {
  id: string;
  unitId: string;
  dateFrom?: string;
  dateTo?: string;
  season: "Niski" | "Średni" | "Wysoki" | "Święta/długi weekend" | "Promocja" | "Specjalny";
  pricePerNight: number;
  minNights: number;
  active: boolean;
};

export type PlatformImport = {
  id: string;
  platform: "Booking" | "Airbnb";
  importedAt?: string;
  syncSource?: ConnectionType;
  reservationNo?: string;
  reservationLink?: string;
  bookingDate?: string;
  status?: string;
  listing?: string;
  guestName?: string;
  city?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  childrenAges?: string;
  grossPrice?: number;
  currency?: string;
  commission?: number;
  payout?: number;
  paymentStatus?: PaymentStatus;
  cancellationPolicy?: string;
  arrivalTime?: string;
  specialRequests?: string;
  firstMessage?: string;
  rawSource?: string;
  missingFields?: string[];
  dataQuality?: DataQuality;
  matchedBookingId?: string;
  transferStatus: "Do przeniesienia" | "Przeniesione" | "Wymaga sprawdzenia" | "Nie przenosić";
};

export type SourceConnection = {
  id: string;
  platform: "Booking" | "Airbnb";
  connectionType: ConnectionType;
  status: SyncStatus;
  lastSyncAt?: string;
  coverage: number;
  nextStep: string;
  notes: string;
  priority: "Teraz" | "Następne" | "Później";
  unitId?: string;
  importUrl?: string;
  exportToken?: string;
  lastError?: string;
  staleAfterMinutes?: number;
};

export type AppData = {
  units: Unit[];
  bookings: Booking[];
  guests: GuestProfile[];
  consents: ContactConsent[];
  tasks: OpsTask[];
  media: MediaAsset[];
  blocks: CalendarBlock[];
  rates: RateRule[];
  imports: PlatformImport[];
  sourceConnections: SourceConnection[];
  payments: PaymentTransaction[];
  invoices: InvoiceRecord[];
  checklistItems: TaskChecklistItem[];
  issues: IssueReport[];
  messages: MessageRecord[];
  auditLog: AuditEvent[];
  settings: AppSettings;
};
