import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={`rounded-[18px] border border-[#d9d1c1] bg-[#fffdf8] shadow-[0_14px_40px_rgba(38,53,45,.06)] ${className}`} {...props} />;
}

export function CardTitle({ eyebrow, title, children, action }: { eyebrow?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#e6dfd1] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
      <div>
        {eyebrow ? <p className="mb-1 text-[11px] font-black uppercase tracking-[.2em] text-[#778849]">{eyebrow}</p> : null}
        <h2 className="font-display text-2xl font-semibold tracking-[-.025em] text-[#18332c]">{title}</h2>
        {children ? <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5d6c65]">{children}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Button({ className = "", variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-[#174d3b] text-white shadow-[0_8px_22px_rgba(23,77,59,.2)] hover:bg-[#103b2e]",
    secondary: "border border-[#cec6b7] bg-white text-[#18332c] hover:border-[#174d3b] hover:bg-[#f7f4ed]",
    ghost: "bg-transparent text-[#496058] hover:bg-[#eee9df]",
    danger: "bg-[#fbe8e2] text-[#a23c25] hover:bg-[#f7d7cd]",
  };
  return <button className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition duration-200 disabled:opacity-45 ${variants[variant]} ${className}`} {...props} />;
}

export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "lake"; className?: string }) {
  const tones = {
    neutral: "bg-[#ece7dd] text-[#59665f]",
    good: "bg-[#dfeede] text-[#215c3b]",
    warn: "bg-[#faedc5] text-[#795d0e]",
    bad: "bg-[#f9dfd7] text-[#9b4029]",
    lake: "bg-[#d9ebea] text-[#246563]",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black tracking-[.02em] ${tones[tone]} ${className}`}>{children}</span>;
}

export function Field({ label, children, error, hint }: { label: string; children: ReactNode; error?: string; hint?: string }) {
  return <label className="grid gap-1.5 text-sm font-bold text-[#334b42]"><span>{label}</span>{children}{hint ? <span className="text-xs font-medium text-[#758078]">{hint}</span> : null}{error ? <span className="text-xs font-bold text-[#a13d25]">{error}</span> : null}</label>;
}

export const inputClass = "min-h-11 w-full rounded-xl border border-[#cbc3b4] bg-white px-3.5 py-2.5 text-sm text-[#18332c] outline-none transition placeholder:text-[#9a9f98] focus:border-[#317a78] focus:ring-3 focus:ring-[#317a78]/10";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[#c9c0af] bg-[#f8f5ee] p-8 text-center"><h3 className="font-display text-xl font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#66736c]">{body}</p>{action ? <div className="mt-4">{action}</div> : null}</div>;
}
