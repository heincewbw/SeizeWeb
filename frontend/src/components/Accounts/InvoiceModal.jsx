import { useState, useRef } from 'react';
import { XMarkIcon, PrinterIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { adminAPI } from '@/services/api';
import toast from 'react-hot-toast';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtRp = (n) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default function InvoiceModal({ user, onClose }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [sending, setSending] = useState(false);
  const printRef = useRef(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.generateInvoice(user.id, month, year);
      setInvoice(data);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal generate invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!invoice) return;
    setSending(true);
    try {
      const { data } = await adminAPI.sendInvoiceEmail(invoice);
      toast.success(`Invoice terkirim ke ${data.sentTo}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal mengirim email');
    } finally {
      setSending(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${invoice.invoiceId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; padding: 32px; }
    .invoice-wrap { max-width: 780px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .header-left p { font-size: 13px; color: #444; margin-top: 4px; }
    .header-left .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
    .header-right { text-align: right; }
    .header-right .invoice-id { font-size: 12px; font-weight: bold; color: #1a1a1a; }
    .header-right table { margin-left: auto; margin-top: 8px; font-size: 12px; color: #444; }
    .header-right td { padding: 2px 6px; }
    .header-right td:first-child { color: #888; text-align: left; }
    .title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
    table.main { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    table.main thead tr { background: #1e3a5f; color: #fff; }
    table.main thead th { padding: 9px 12px; text-align: left; font-size: 12px; font-weight: 600; }
    table.main thead th:not(:first-child) { text-align: right; }
    table.main tbody tr:nth-child(even) { background: #f7f9fc; }
    table.main tbody td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
    table.main tbody td:not(:first-child):not(:nth-child(2)) { text-align: right; font-variant-numeric: tabular-nums; }
    .totals { width: 100%; display: flex; justify-content: flex-end; margin-bottom: 28px; }
    .totals table { font-size: 12px; min-width: 320px; }
    .totals td { padding: 4px 10px; }
    .totals td:first-child { color: #666; }
    .totals td:last-child { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
    .totals tr.divider td { border-top: 1px solid #e5e7eb; padding-top: 8px; }
    .footer { border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 11px; color: #888; }
    .logo { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #1e3a5f; margin-top: 12px; }
    .logo span { color: #2563eb; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  ${content}
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) years.push(y);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl bg-dark-800 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Generate Invoice</h3>
            <p className="text-xs text-slate-400 mt-0.5">{user.full_name} — {user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3 flex-wrap flex-shrink-0">
          <select
            value={month}
            onChange={(e) => { setMonth(Number(e.target.value)); setInvoice(null); }}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setInvoice(null); }}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
          >
            {loading ? 'Memuat...' : 'Generate'}
          </button>
          {invoice && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
            >
              <PrinterIcon className="w-4 h-4" />
              Print / Save PDF
            </button>
          )}
          {invoice && (
            <button
              onClick={handleSendEmail}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              <EnvelopeIcon className="w-4 h-4" />
              {sending ? 'Mengirim...' : 'Kirim ke Email User'}
            </button>
          )}
        </div>

        {/* Invoice Preview */}
        <div className="flex-1 overflow-y-auto p-6">
          {!invoice && !loading && (
            <div className="text-center py-16 text-slate-500 text-sm">
              Pilih periode lalu klik Generate
            </div>
          )}
          {invoice && (
            <div ref={printRef}>
              <div className="invoice-wrap" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#1a1a1a', background: '#fff', padding: '32px', borderRadius: '8px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent</div>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '4px' }}>{invoice.user.full_name}</div>
                    <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{invoice.user.email}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice ID</div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '2px' }}>{invoice.invoiceId}</div>
                    <table style={{ marginLeft: 'auto', marginTop: '10px', fontSize: '12px', color: '#444', borderCollapse: 'collapse' }}>
                      <tbody>
                        {[
                          ['Invoice Date', invoice.invoiceDate],
                          ['Start Date', invoice.startDate],
                          ['End Date', invoice.endDate],
                          ['Period', invoice.period],
                        ].map(([label, value]) => (
                          <tr key={label}>
                            <td style={{ padding: '2px 8px', color: '#888', textAlign: 'left' }}>{label}</td>
                            <td style={{ padding: '2px 8px', fontWeight: '500' }}>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                  <thead>
                    <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                      {['Invoice Number', 'Account Name', 'Total Profit($)', 'Total Profit(Rp)', `Total Comm(${invoice.commissionRate}%)($)`, 'Total Comm(Rp)'].map((h, i) => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: i <= 1 ? 'left' : 'right', fontSize: '12px', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.rows.map((row, i) => (
                      <tr key={row.invoiceNumber} style={{ background: i % 2 === 1 ? '#f7f9fc' : '#fff' }}>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontFamily: 'monospace' }}>{row.invoiceNumber}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontWeight: '500' }}>{row.accountName}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>$ {fmt(row.profitUSD)}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>Rp {fmtRp(row.profitIDR)}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>$ {fmt(row.commUSD)}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>Rp {fmtRp(row.commIDR)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
                  <table style={{ fontSize: '12px', minWidth: '340px', borderCollapse: 'collapse' }}>
                    <tbody>
                      {[
                        ['Total Profit($)', `$ ${fmt(invoice.totalProfitUSD)}`],
                        ['Rate (Rp)', `Rp ${fmtRp(invoice.rate)}`],
                        ['Total Profit (Rp)', `Rp ${fmtRp(invoice.totalProfitIDR)}`],
                        [`Total Commission Fee ($)`, `$ ${fmt(invoice.totalCommUSD)}`],
                        [`Total Commission Fee (Rp)`, `Rp ${fmtRp(invoice.totalCommIDR)}`],
                      ].map(([label, value], i) => (
                        <tr key={label} style={i === 3 ? { borderTop: '1px solid #e5e7eb' } : {}}>
                          <td style={{ padding: '4px 10px', color: '#666' }}>{label}</td>
                          <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                  <p style={{ fontSize: '11px', color: '#888' }}>
                    Thank you for your business. If you have any questions or if this invoice is incorrect, please contact us at{' '}
                    <a href="mailto:support@acecapital.app" style={{ color: '#2563eb' }}>support@acecapital.app</a>
                  </p>
                  <p style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>Best regards,</p>
                  <div style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px', color: '#1e3a5f', marginTop: '10px' }}>
                    ACE<span style={{ color: '#2563eb' }}>CAPITAL</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
