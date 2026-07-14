import Link from "next/link";

export default function OfflinePage() {
  return <main className="grid min-h-screen place-items-center bg-[#f5f1e7] p-6 text-[#18332c]"><section className="max-w-md rounded-[24px] border border-[#d9d1c1] bg-[#fffdf8] p-8 text-center shadow-xl"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#174d3b] font-display text-white">SU</span><h1 className="mt-5 font-display text-3xl font-semibold">Brak połączenia</h1><p className="mt-3 text-sm leading-6 text-[#61716a]">Nie udało się pobrać tego widoku. Dane zapisane lokalnie nie zniknęły. Po odzyskaniu internetu wróć do panelu.</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#174d3b] px-5 text-sm font-bold text-white" href="/dashboard">Spróbuj ponownie</Link></section></main>;
}
