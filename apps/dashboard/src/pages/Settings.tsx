import { useState } from 'react';
import { getApiToken, setApiToken } from '../api/client';

export function Settings() {
  const [token, setToken] = useState(getApiToken() ?? '');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setApiToken(token);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Settings</h2>
      <div className="max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          API Bearer Token
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Paste your API token here"
        />
        <button
          onClick={handleSave}
          className="mt-3 rounded-lg bg-navy px-4 py-2 text-sm text-white hover:bg-navy-light"
        >
          {saved ? 'Saved!' : 'Save Token'}
        </button>
      </div>
    </div>
  );
}
