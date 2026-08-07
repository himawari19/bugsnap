import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const getAdminEmails = () => {
  const envVar = process.env.SUPER_ADMIN_EMAILS || "";
  return envVar.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
};

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = createServiceClient();
    
    // 1. Verify caller identity
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Enforce Super Admin list
    const adminEmails = getAdminEmails();
    if (!adminEmails.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: "Forbidden: Super Admin only" }, { status: 403 });
    }

    // 3. Fetch data in parallel using service role
    const [usersRes, workspacesRes, capturesRes, viewsRes, commentsRes, promoRes] = await Promise.all([
      supabase.from("users").select("*").order("created_at", { ascending: false }),
      supabase.from("workspaces").select("id, name, owner_user_id, created_at"),
      supabase.from("captures").select("id, user_id, workspace_id"),
      supabase.from("capture_views").select("id", { count: "exact", head: true }),
      supabase.from("comments").select("id", { count: "exact", head: true }),
      supabase.from("app_settings").select("value").eq("key", "promo_banner").maybeSingle(),
    ]);

    if (usersRes.error) throw usersRes.error;

    // 4. Transform and compute per-user stats
    const users = usersRes.data || [];
    const workspaces = workspacesRes.data || [];
    const captures = capturesRes.data || [];

    const enhancedUsers = users.map((u) => {
      const userWorkspaces = workspaces.filter(w => w.owner_user_id === u.id).length;
      const userCaptures = captures.filter(c => c.user_id === u.id).length;
      return {
        ...u,
        workspace_count: userWorkspaces,
        capture_count: userCaptures,
      };
    });

    // 5. Compute Top Workspaces by Capture Count
    const wsCaptureCounts: Record<string, number> = {};
    captures.forEach(c => {
      if (c.workspace_id) {
        wsCaptureCounts[c.workspace_id] = (wsCaptureCounts[c.workspace_id] || 0) + 1;
      }
    });

    const topWorkspaces = workspaces
      .map(w => {
        const owner = users.find(u => u.id === w.owner_user_id);
        return {
          id: w.id,
          name: w.name,
          owner_email: owner?.email || "Unknown",
          capture_count: wsCaptureCounts[w.id] || 0,
        };
      })
      .sort((a, b) => b.capture_count - a.capture_count)
      .slice(0, 5);

    const stats = {
      totalUsers: users.length,
      totalWorkspaces: workspaces.length,
      totalCaptures: captures.length,
      totalViews: viewsRes.count || 0,
      totalComments: commentsRes.count || 0,
    };

    return NextResponse.json({ 
      ok: true, 
      users: enhancedUsers, 
      stats, 
      topWorkspaces,
      promo: promoRes.data?.value || { enabled: false, message: "" }
    });
  } catch (err) {
    console.error("Admin data fetch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
