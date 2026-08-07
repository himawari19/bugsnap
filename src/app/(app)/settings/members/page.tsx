"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useT } from "@/components/I18nProvider";

interface Member {
  user_id: string;
  email: string;
  role: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Workspace {
  id: string;
  name: string;
}

export default function TeamManagementPage() {
  const { t } = useT();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_my_workspaces");
      if (error || !data || data.length === 0) {
        if (!cancelled) {
          if (error) setError(t("members.loadWsError"));
          setLoading(false);
        }
        return;
      }
      if (cancelled) return;
      const ws = (data as Workspace[]).map((w) => ({ id: w.id, name: w.name }));
      setWorkspaces(ws);
      setActiveWsId((prev) => prev ?? ws[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!activeWsId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("get_workspace_members", { p_workspace_id: activeWsId })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          setError(t("members.loadError"));
          return;
        }
        setMembers((data as Member[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWsId, t]);

  async function handleInvite() {
    const email = inviteEmail.trim();
    if (!email || !activeWsId || inviting) return;
    setInviting(true);
    setError(null);
    try {
      const { error: inviteError } = await supabase.rpc("invite_member_by_email", {
        p_workspace_id: activeWsId,
        p_email: email,
      });
      if (inviteError) throw inviteError;
      setInviteEmail("");
      // Reload members
      const { data, error: membersError } = await supabase.rpc("get_workspace_members", {
        p_workspace_id: activeWsId,
      });
      if (membersError) throw membersError;
      setMembers((data as Member[]) ?? []);
    } catch (err) {
      setError((err as { message?: string })?.message || t("members.inviteFailed"));
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(member: Member) {
    if (member.role === "owner") return;
    if (!confirm(t("members.removeConfirm", { email: member.email }))) return;
    try {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", activeWsId)
        .eq("user_id", member.user_id);
      if (error) throw error;
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
    } catch {
      setError(t("members.removeError"));
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("members.title")}</h1>
          <p className="text-sm text-muted mt-1">{t("members.subtitle")}</p>
        </div>
        <Link href="/settings" className="text-sm text-indigo-600 font-medium hover:underline">
          {t("members.backToSettings")}
        </Link>
      </div>

      {/* Workspace selector */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">{t("members.workspaceLabel")}</label>
        <select
          value={activeWsId ?? ""}
          onChange={(e) => setActiveWsId(e.target.value)}
          className="w-full sm:w-64 text-sm rounded-lg border border-border px-3 py-2.5 outline-none focus:border-indigo-500 bg-white"
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Invite box */}
      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">{t("members.inviteTitle")}</h2>
        <p className="text-xs text-muted mb-3">{t("members.inviteHint")}</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="teammate@company.com"
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            className="flex-1 text-sm rounded-lg border border-border px-3.5 py-2.5 outline-none focus:border-indigo-500 bg-white"
          />
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {inviting ? t("members.inviting") : t("members.invite")}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {/* Member list */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-subtle/50">
          <h2 className="text-sm font-semibold text-foreground">{t("members.count", { count: members.length })}</h2>
        </div>
        {loading ? (
          <div className="divide-y divide-border/60 animate-pulse">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="w-9 h-9 rounded-full bg-subtle" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 bg-subtle rounded" />
                  <div className="h-3 w-1/4 bg-subtle rounded" />
                </div>
                <div className="w-16 h-7 bg-subtle rounded-lg" />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="p-6 text-sm text-muted">{t("members.none")}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                {m.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar_url} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {(m.full_name || m.email || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {m.full_name || m.email}
                    {m.role === "owner" && <span className="ml-2 text-[10px] font-semibold text-muted bg-subtle px-1.5 py-0.5 rounded">{t("members.owner")}</span>}
                    {m.role === "admin" && <span className="ml-2 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{t("members.admin")}</span>}
                    {m.role === "member" && <span className="ml-2 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{t("members.member")}</span>}
                  </p>
                  <p className="text-xs text-muted truncate">{m.email}</p>
                </div>
                {m.role !== "owner" && (
                  <button
                    onClick={() => handleRemove(m)}
                    className="text-xs font-medium text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    {t("members.remove")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
