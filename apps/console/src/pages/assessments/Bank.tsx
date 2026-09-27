import { AlertTriangle, Check } from "lucide-react";
import type { Bank } from "@/lib/api";
import { cellWords } from "@/lib/assessments-view";

/**
 * "Can the live bank fill it?", the template's metadata box
 * (`design/templates/console/assessments/SPEC.md`): label left, value right,
 * one fact per row, every number mono. The create form and a row's
 * `Check the bank…` render this one component from the same API answer
 * (`feasibilityOf()`), so the two can never disagree.
 *
 * A short bank is a WARNING, not danger: `danger` is for destructive staff
 * actions only (`apps/console/CLAUDE.md`).
 */
export function BankBox({
  bank, loading, error, titled = true,
}: { bank: Bank | null; loading?: boolean; error?: string | null; titled?: boolean }) {
  return (
    <section className="assess-box" aria-label="Can the bank fill it?" data-bank="">
      {/* The bank dialog's own title already asks the question. */}
      {titled ? <h3 className="assess-box-title">Can the bank fill it?</h3> : null}
      {loading && !bank ? (
        <div aria-busy="true" aria-label="Checking the bank" className="assess-box-wait">
          <span className="skeleton-bar" />
          <span className="skeleton-bar" />
          <span className="skeleton-bar" />
        </div>
      ) : error ? (
        <p role="alert" className="text-sm text-ink">
          The bank could not be checked. <span className="text-ink-muted">{error}</span>
        </p>
      ) : bank ? (
        // Keyed on the answer, so a new answer fades in rather than snapping.
        <div key={`${bank.poolSize}-${bank.totalItems}-${bank.shortfalls.length}`} className="ease-swap">
          <p className="assess-verdict" data-bank-verdict="" data-ok={bank.satisfiable ? "" : undefined}>
            {bank.satisfiable ? (
              <>
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> The bank can fill it.
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> It cannot be filled yet.
              </>
            )}
          </p>
          <dl className="assess-kv">
            <div>
              <dt>Questions needed</dt>
              <dd className="num">{bank.totalItems}</dd>
            </div>
            <div>
              <dt>Live in the pool</dt>
              <dd className="num">{bank.poolSize}</dd>
            </div>
            {bank.shortfalls.map((s) => (
              <div key={`${s.dimension}-${s.cell}`} data-shortfall="">
                <dt>{cellWords(s)}</dt>
                <dd>
                  needs <span className="num">{s.need}</span>, has <span className="num">{s.have}</span>
                </dd>
              </div>
            ))}
          </dl>
          {bank.satisfiable ? null : (
            <p className="assess-note">
              A student who presses Start on it gets an error, not a paper. Approving items on the
              Items page fills the pool.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** The Bank cell of a row: `fills`, or how it falls short, numbers mono. */
export function BankCell({ bank }: { bank: Bank }) {
  if (bank.satisfiable) {
    return (
      <span className="assess-bank-ok" data-bank="">
        fills
      </span>
    );
  }
  return (
    <span className="assess-bank-short" data-bank="">
      <span className="assess-bank-word">
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        short
      </span>
      <span className="assess-bank-detail">
        {bank.enoughItems ? (
          <>
            in <span className="num">{bank.shortfalls.length}</span>{" "}
            {bank.shortfalls.length === 1 ? "cell" : "cells"}
          </>
        ) : (
          <>
            <span className="num">{bank.poolSize}</span> of <span className="num">{bank.totalItems}</span> live
          </>
        )}
      </span>
    </span>
  );
}
