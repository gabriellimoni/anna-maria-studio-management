import { Box, Chip, TextField } from '@mui/material';

export type FinancialStatusFilter = 'all' | 'pending' | 'paid' | 'overdue';
export type InvoiceFilter = 'all' | 'invoiced' | 'not_invoiced';

interface FinancialFiltersBarProps {
  status: FinancialStatusFilter;
  onStatusChange: (s: FinancialStatusFilter) => void;
  from: string;
  onFromChange: (v: string) => void;
  to: string;
  onToChange: (v: string) => void;
  invoiceFilter?: InvoiceFilter;
  onInvoiceFilterChange?: (v: InvoiceFilter) => void;
}

const STATUS_OPTIONS: { value: FinancialStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'paid', label: 'Pagas' },
  { value: 'overdue', label: 'Atrasadas' },
];

const INVOICE_OPTIONS: { value: InvoiceFilter; label: string }[] = [
  { value: 'all', label: 'Todas NF' },
  { value: 'invoiced', label: 'Com NF' },
  { value: 'not_invoiced', label: 'Sem NF' },
];

export function FinancialFiltersBar({
  status,
  onStatusChange,
  from,
  onFromChange,
  to,
  onToChange,
  invoiceFilter,
  onInvoiceFilterChange,
}: FinancialFiltersBarProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        {STATUS_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            onClick={() => onStatusChange(opt.value)}
            color={status === opt.value ? (opt.value === 'overdue' ? 'error' : 'primary') : 'default'}
            variant={status === opt.value ? 'filled' : 'outlined'}
          />
        ))}
        {invoiceFilter !== undefined && onInvoiceFilterChange && (
          <>
            <Box sx={{ width: 1, height: 0 }} />
            {INVOICE_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                onClick={() => onInvoiceFilterChange(opt.value)}
                color={invoiceFilter === opt.value ? 'secondary' : 'default'}
                variant={invoiceFilter === opt.value ? 'filled' : 'outlined'}
                size="small"
              />
            ))}
          </>
        )}
        <TextField
          label="De"
          type="date"
          size="small"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 160 }}
        />
        <TextField
          label="Até"
          type="date"
          size="small"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 160 }}
        />
      </Box>
    </Box>
  );
}
