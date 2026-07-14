import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return <main className="grid min-h-screen place-items-center bg-[#f4f0e7] px-4 py-10 text-[#243229]">
    <section className="w-full max-w-md rounded-[24px] border border-[#d8cdb8] bg-[#fffaf0] p-7 shadow-[0_30px_80px_rgba(24,51,44,.12)] sm:p-9">
      <span className="grid size-12 place-items-center rounded-2xl bg-[#174d3b] font-display text-lg font-semibold text-white">SU</span>
      <p className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-[#778849]">Bezpieczny panel właściciela</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-.035em]">Stawy OS</h1>
      <p className="mt-3 text-sm leading-6 text-[#66715f]">Rezerwacje, kalendarz, sprzątanie i finanse Stawów u Sikory.</p>
      <LoginForm />
    </section>
  </main>;
}
