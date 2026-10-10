import clsx from 'clsx';

// Responsive table primitives — the table itself never shrinks below its
// natural width; the horizontal scroll happens in this wrapper instead of
// the page body, so a data-dense table never breaks the layout on narrow
// viewports. Used for ledger-style data (leases, invoices, payments,
// expenses) where a row-per-record table reads better than cards.
export function Table({ children, className }) {
  return (
    <div className="custom-scrollbar overflow-x-auto">
      <table className={clsx('w-full min-w-[720px] text-left text-sm', className)}>{children}</table>
    </div>
  );
}

export function Thead({ children }) {
  return <thead className="border-b border-slate-200 dark:border-slate-800">{children}</thead>;
}

export function Th({ children, className }) {
  return (
    <th scope="col" className={clsx('whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400', className)}>
      {children}
    </th>
  );
}

export function Tbody({ children }) {
  return <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>;
}

export function Tr({ children, className }) {
  return <tr className={clsx('hover:bg-slate-50 dark:hover:bg-slate-800/40', className)}>{children}</tr>;
}

// `nowrap` defaults to true (every financial/ledger table wants its columns
// on one line). Passing `nowrap={false}` is done as a conditional class
// rather than letting a `whitespace-normal` in `className` try to override
// it — Tailwind's generated stylesheet order (not the order classes appear
// in the attribute) decides which `whitespace-*` utility wins, and
// `nowrap` sorts after `normal` there, so an additive override would
// silently lose every time.
export function Td({ children, className, nowrap = true, ...props }) {
  return <td className={clsx(nowrap ? 'whitespace-nowrap' : 'whitespace-normal', 'px-4 py-3 align-middle text-slate-700 dark:text-slate-300', className)} {...props}>{children}</td>;
}
