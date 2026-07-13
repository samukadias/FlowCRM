"use client";

import { useState } from "react";

function formatarMilhar(digitos: string): string {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function centavosParaExibicao(centavos: number): string {
  const reais = Math.floor(centavos / 100);
  const cent = centavos % 100;
  return `${formatarMilhar(String(reais))},${String(cent).padStart(2, "0")}`;
}

/** Campo de valor em reais com centavos — para preço unitário (ex.: R$
 * 4,80/GB). Digitação estilo "máscara de caixa": os dois últimos dígitos
 * são sempre os centavos. Envia um decimal puro ("4.80") num input escondido. */
export function CampoValorDecimal({
  name,
  defaultValue,
  placeholder,
}: {
  name: string;
  defaultValue?: number | null;
  placeholder?: string;
}) {
  const [centavos, setCentavos] = useState(
    defaultValue != null ? Math.round(defaultValue * 100) : 0,
  );

  return (
    <div className="relative mt-1.5">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">
        R$
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={centavos === 0 ? "" : centavosParaExibicao(centavos)}
        onChange={(e) => {
          const digitos = e.target.value.replace(/\D/g, "");
          setCentavos(digitos ? parseInt(digitos, 10) : 0);
        }}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-line bg-canvas py-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25"
      />
      <input type="hidden" name={name} value={centavos === 0 ? "" : (centavos / 100).toFixed(2)} />
    </div>
  );
}
