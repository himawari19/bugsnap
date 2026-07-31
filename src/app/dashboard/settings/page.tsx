export default function SettingsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted mt-1">
          Manage your account preferences and integrations.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Integrations</h2>
          <p className="text-xs text-muted mt-1">Connect mazwayScreen to your favorite tools.</p>
          
          <div className="mt-6 flex items-center justify-between p-4 rounded-lg border border-border bg-subtle/30">
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="text-indigo-600">
                 <path d="M19.36 10.98c-1.31 0-2.45-.63-3.15-1.58-.69.95-1.84 1.58-3.15 1.58S9.91 10.35 9.22 9.4c-.7 1.05-1.92 1.68-3.32 1.68C2.64 11.08 0 8.7 0 5.54S2.64 0 5.9 0c1.4 0 2.62.63 3.32 1.68.7-1.05 1.84-1.68 3.15-1.68s2.45.63 3.15 1.58C16.21.63 17.43 0 18.83 0 22.1 0 24 2.38 24 5.54s-1.9 5.54-4.64 5.44zm-5.74-6.42c0 1.25.96 2.27 2.15 2.27 1.18 0 2.15-1.01 2.15-2.27 0-1.25-.96-2.27-2.15-2.27-1.18 0-2.15 1.01-2.15 2.27zm-7.6 0c0 1.25.96 2.27 2.15 2.27 1.18 0 2.15-1.01 2.15-2.27 0-1.25-.96-2.27-2.15-2.27-1.18 0-2.15 1.01-2.15 2.27zM24 15.6c0 3.16-2.64 5.54-5.9 5.54-1.4 0-2.62-.63-3.32-1.68-.7 1.05-1.84 1.68-3.15 1.68s-2.45-.63-3.15-1.58c-.69.95-1.91 1.58-3.32 1.58-3.26 0-5.9-2.38-5.9-5.54s2.64-5.54 5.9-5.54c1.4 0 2.62.63 3.32 1.68.7-1.05 1.84-1.68 3.15-1.68s2.45.63 3.15 1.58c.69-.95 1.91-1.58 3.32-1.58 3.26 0 5.9 2.38 5.9 5.54zm-5.46-3.14c-1.18 0-2.15 1.01-2.15 2.27 0 1.25.96 2.27 2.15 2.27 1.18 0 2.15-1.01 2.15-2.27 0-1.25-.96-2.27-2.15-2.27zm-7.6 0c-1.18 0-2.15 1.01-2.15 2.27 0 1.25.96 2.27 2.15 2.27 1.18 0 2.15-1.01 2.15-2.27 0-1.25-.96-2.27-2.15-2.27z"/>
              </svg>
              <div>
                <div className="text-sm font-medium text-foreground">Google Drive</div>
                <div className="text-xs text-muted mt-0.5">Files are automatically uploaded to your personal Drive.</div>
              </div>
            </div>
            <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded">Connected via Extension</div>
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-base font-semibold text-foreground">Account</h2>
          <p className="text-xs text-muted mt-1">Update your profile settings.</p>
          <div className="mt-4 text-sm text-muted">
            <p>You are using the offline extension mode. Once user login is fully configured, your profile details will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
