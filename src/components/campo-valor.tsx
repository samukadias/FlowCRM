"use client";

import { useState } from "react";

function formatarMilhar(digitos: string): string {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Campo de valor em reais: mostra "R$ 850.000" enquanto o usuário digita,
 * mas envia só os dígitos brutos num input escondido (mesmo formato que o
 * server action já espera). */
export function CampoValor({
  name,
  defaultValue,
  placeholder,
}: {
  name: string;
  defaultValue?: number | null;
  placeholder?: string;
}) {
  const [digitos, setDigitos] = useState(
    defaultValue != null ? String(Math.round(defaultValue)) : "",
  );

  return (
    <div className="relative mt-1.5">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">
        R$
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={formatarMilhar(digitos)}
        onChange={(e) => setDigitos(e.target.value.replace(/\D/g, ""))}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-line bg-canvas py-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25"
      />
      <input type="hidden" name={name} value={digitos} />
    </div>
  );
}
