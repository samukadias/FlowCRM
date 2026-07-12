/**
 * Server Actions rodam fora do runtime do Next.js nos testes, então
 * `next/navigation` e `next/cache` precisam ser mockados. `redirect()` de
 * verdade interrompe a execução lançando um erro interno — reproduzimos
 * esse comportamento aqui para que o código pós-redirect também não rode
 * durante o teste.
 */
export class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`REDIRECT: ${url}`);
  }
}
