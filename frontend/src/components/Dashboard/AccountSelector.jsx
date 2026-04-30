export default function AccountSelector({ accounts, selected, onChange }) {
  if (!accounts || accounts.length === 0) return null;

  return (
    <select
      className="input-field w-auto min-w-44"
      value={selected || ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">All Accounts</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.account_name} ({a.login})
        </option>
      ))}
    </select>
  );
}
