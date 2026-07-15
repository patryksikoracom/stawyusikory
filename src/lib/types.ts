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
  defaultPricePerNight: number;
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
  commission?: number;
  payout?: number;
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
  historicalImport?: boolean;
  updatedAt?: string;
  /** Miękko usunięta rezerwacja jest dostępna w koszu przez 30 dni. */
  deletedAt?: string;
  purgeAfter?: string;
  workflowStatusBeforeDeletion?: WorkflowStatus;
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
  discoveryMethod?: DiscoveryMethod;
  discoveryNote?: string;
  bookingChannel?: Channel;
  searchPhraseOrAiPrompt?: string;
  bestQuote?: string;
  objections?: string;
  nps?: number;
  satisfaction?: number;
};

export type DiscoveryMethod =
  | "Przeglądanie ofert"
  | "Wyszukiwarka"
  | "Polecenie"
  | "Social media"
  | "Reklama"
  | "Inne"
  | "Nie wiadomo";

export type RepairHorizon =
  | "Do oceny"
  | "Przed następnym przyjazdem"
  | "W tym tygodniu"
  | "Po sezonie"
  | "Backlog";

export type DepartureDebrief = {
  id: string;
  bookingId: string;
  status: "Oczekuje" | "Ukończony" | "Pominięty";
  lastPromptedAt?: string;
  lastPromptedOn?: string;
  snoozedUntil?: string;
  completedAt?: string;
  capturedBy?: string;
  actualDepartureAt?: string;
  departureStatus?: "Wyjechali" | "Późny wyjazd" | "Niepotwierdzone";
  keysSettled: boolean;
  paymentOrDamageNote?: string;
  cleaningHandoff?: string;
  urgentNextArrivalRisk: boolean;
  discoverySource?: Channel;
  discoveryMethod?: DiscoveryMethod;
  discoveryNote?: string;
  whyChose?: string;
  bestParts?: string;
  improvementNotes?: string;
  bestQuote?: string;
  nps?: number;
  returnIntent?: "Tak" | "Może" | "Nie" | "Nie wiadomo";
  publicQuotePermission: "Tak" | "Nie" | "Do dopytania";
  skipReason?: string;
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
  issueId?: string;
  planningHorizon?: RepairHorizon;
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
  category?: "Bezpieczeństwo" | "Dostęp/drzwi" | "Woda" | "Prąd" | "Wyposażenie" | "Komfort" | "Inne";
  location?: string;
  severity?: "Krytyczna" | "Wysoka" | "Średnia" | "Niska";
  source?: "Gość" | "Sprzątanie" | "Właściciel" | "System";
  debriefId?: string;
  photoUrls?: string[];
  owner?: string;
  nextArrivalRisk?: boolean;
  planningHorizon?: RepairHorizon;
  resolutionNotes?: string;
  resolvedAt?: string;
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

export type MessagePurpose =
  | "Potwierdzenie"
  | "Płatność"
  | "Przed przyjazdem"
  | "Powitanie"
  | "W trakcie pobytu"
  | "Wyjazd"
  | "Prywatny feedback"
  | "Opinia publiczna"
  | "Przypomnienie opinii"
  | "Naprawa";

export type MessageTemplate = {
  id: string;
  name: string;
  purpose: MessagePurpose;
  channel: "SMS" | "E-mail" | "OTA";
  language: "pl" | "en";
  subject?: string;
  body: string;
  allowedVariables: string[];
  version: number;
  active: boolean;
};

export type AutomationTrigger =
  | "Po utworzeniu rezerwacji"
  | "Termin płatności"
  | "Przed przyjazdem"
  | "Po przyjeździe"
  | "Przed wyjazdem"
  | "Po wyjeździe"
  | "Po rozwiązaniu usterki";

export type AutomationRule = {
  id: string;
  name: string;
  templateId: string;
  trigger: AutomationTrigger;
  offsetDays: number;
  sendTime: string;
  mode: "Wersja robocza" | "Automatycznie";
  active: boolean;
  channels?: Channel[];
  unitIds?: string[];
  paymentStatuses?: PaymentStatus[];
  minimumNights?: number;
};

export type ScheduledMessage = {
  id: string;
  bookingId: string;
  ruleId: string;
  templateId: string;
  templateVersion: number;
  dueAt: string;
  channel: MessageTemplate["channel"];
  recipient?: string;
  subject?: string;
  renderedBody: string;
  status: "Wersja robocza" | "Zatwierdzona" | "Wysłana" | "Dostarczona" | "Błąd" | "Anulowana" | "Wymaga sprawdzenia";
  blockedReason?: string;
  approvedAt?: string;
  providerResult?: string;
  idempotencyKey: string;
  bookingFingerprint: string;
  createdAt: string;
};

export type MarketingTouchpoint = {
  id: string;
  bookingId: string;
  recordedAt: string;
  source?: Channel;
  method?: DiscoveryMethod;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  landingPage?: string;
  note?: string;
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

export type CostSetting = {
  id: string;
  unitId?: string;
  label: string;
  value: number;
  unit: "miesiąc" | "rok" | "pobyt" | "noc" | "% przychodu";
  notes?: string;
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
  costSettings: CostSetting[];
  imports: PlatformImport[];
  sourceConnections: SourceConnection[];
  payments: PaymentTransaction[];
  invoices: InvoiceRecord[];
  checklistItems: TaskChecklistItem[];
  issues: IssueReport[];
  messages: MessageRecord[];
  departureDebriefs: DepartureDebrief[];
  messageTemplates: MessageTemplate[];
  automationRules: AutomationRule[];
  scheduledMessages: ScheduledMessage[];
  marketingTouchpoints: MarketingTouchpoint[];
  auditLog: AuditEvent[];
  settings: AppSettings;
};
