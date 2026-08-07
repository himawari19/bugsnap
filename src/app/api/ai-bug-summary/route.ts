import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

interface DevLog {
  type: string;
  level?: string;
  message?: string;
  text?: string;
  url?: string;
  status?: number;
  method?: string;
  time?: string;
}

// Compact health summary persisted by the extension (v1). Shares the dev_logs
// column with the legacy raw arrays — the AI path accepts both.
interface DevLogSummary {
  version: number;
  errors: number;
  warnings: number;
  failedRequests: number;
  topErrors?: string[];
  failedUrls?: string[];
}

export const runtime = "nodejs"; // fetch to OpenAI works in edge too, but nodejs is safest

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data: { user }, error } = await createServiceClient().auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: unknown = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { title, devLogs, windowSize } = body as Record<string, unknown>;
    const isSummaryShape =
      !!devLogs && typeof devLogs === "object" && !Array.isArray(devLogs) &&
      typeof (devLogs as DevLogSummary).version === "number";
    if ((title !== undefined && typeof title !== "string") ||
        (windowSize !== undefined && typeof windowSize !== "string") ||
        (!Array.isArray(devLogs) && !isSummaryShape) ||
        (devLogs !== undefined && typeof devLogs !== "object") ||
        (typeof title === "string" && title.length > 200) ||
        (typeof windowSize === "string" && windowSize.length > 100) ||
        JSON.stringify(devLogs ?? {}).length > 100_000) {
      return NextResponse.json({ error: "Invalid or oversized input" }, { status: 400 });
    }

    // Normalize the summary into the same view the AI used to get — with the
    // top messages/urls made explicit (raw rows are no longer persisted).
    // Normalize either shape (legacy raw array or the new compact summary)
    // into the error views the AI already understands.
    let consoleErrors: DevLog[] = [];
    let networkErrors: DevLog[] = [];
    let steps: DevLog[] = [];
    if (Array.isArray(devLogs)) {
      const logs: DevLog[] = devLogs.filter((l): l is DevLog => Boolean(l) && typeof l === "object");
      consoleErrors = logs.filter((l) => l.type === "console");
      networkErrors = logs.filter((l) => l.type === "network");
      steps = logs.filter((l) => l.type === "step");
    } else {
      const s = devLogs as DevLogSummary | null;
      consoleErrors = (s?.topErrors ?? []).map((message) => ({ type: "console", level: "error", message }));
      networkErrors = (s?.failedUrls ?? []).map((url) => ({ type: "network", level: "error", url, method: "GET" }));
      if ((s?.errors ?? 0) > consoleErrors.length) {
        consoleErrors.push({ type: "console", level: "error", message: `(${s!.errors} total console errors, top ${consoleErrors.length} shown)` });
      }
      if ((s?.failedRequests ?? 0) > networkErrors.length) {
        networkErrors.push({ type: "network", level: "error", url: `(${s!.failedRequests} total failed requests, top ${networkErrors.length} shown)`, method: "GET" });
      }
    }

    // ---- AI-powered summary via Multi-Model Waterfall Fallback ----
    const promptPayload = {
      messages: [
        {
          role: "system",
          content: "You are a senior QA engineer. Write a concise bug report in Markdown with sections: Steps to Reproduce, Root Cause Analysis, and Suggested Fix. Use the raw dev logs provided. Be specific and technical.",
        },
        {
          role: "user",
          content: `Title: ${title || "Untitled"}\nWindow size: ${windowSize || "Unknown"}\nConsole errors: ${JSON.stringify(consoleErrors.slice(0, 20))}\nNetwork errors: ${JSON.stringify(networkErrors.slice(0, 20))}\nUser actions: ${JSON.stringify(steps.slice(0, 30))}`,
        },
      ],
      max_tokens: 800,
    };

    const fetchAi = async (url: string, key: string, model: string, extraHeaders = {}) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 7000); // 7s timeout to prevent Vercel 10s hang
      try {
        const res = await fetch(url, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            ...extraHeaders,
          },
          body: JSON.stringify({ model, ...promptPayload }),
        });
        if (res.ok) {
          const json = await res.json();
          return json.choices?.[0]?.message?.content;
        }
      } catch (err) {
        console.warn(`[AI] Request failed for model ${model}:`, err instanceof Error ? err.message : String(err));
      } finally {
        clearTimeout(id);
      }
      return null;
    };

    const providers = [];
    const openrouterHeaders = {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://bugsnap.akusaraproject.my.id",
      "X-Title": "BugSnap",
    };

    // 1. 9Router Custom
    if (process.env.CUSTOM_ROUTER_API_KEY) {
      providers.push({
        url: process.env.CUSTOM_ROUTER_URL || "https://router.akusaraproject.my.id/v1/chat/completions",
        key: process.env.CUSTOM_ROUTER_API_KEY,
        model: "free",
        headers: openrouterHeaders,
      });
    }

    // 2. OpenRouter Fast Free Models
    if (process.env.OPENROUTER_API_KEY) {
      const orModels = [
        "cohere/north-mini-code:free",
        "google/gemma-4-26b-a4b-it:free",
        "openai/gpt-oss-20b:free",
      ];
      for (const model of orModels) {
        providers.push({
          url: "https://openrouter.ai/api/v1/chat/completions",
          key: process.env.OPENROUTER_API_KEY,
          model,
          headers: openrouterHeaders,
        });
      }
    }

    // 3. OpenAI Official
    if (process.env.OPENAI_API_KEY) {
      providers.push({
        url: "https://api.openai.com/v1/chat/completions",
        key: process.env.OPENAI_API_KEY,
        model: "gpt-4o-mini",
        headers: {},
      });
    }

    // Execute Waterfall
    let aiSummary = null;
    for (const p of providers) {
      aiSummary = await fetchAi(p.url, p.key, p.model, p.headers);
      if (aiSummary) break;
    }

    if (aiSummary) {
      return NextResponse.json({ summary: aiSummary });
    }

    // ---- Local smart summary logic (fallback, no API key worked) ----
    const stepsText = steps.length
      ? steps.map((s, i) => `${i + 1}. ${s.message || "User action"}`).join("\n")
      : "1. Open application\n2. Perform actions on screen\n3. Observed issue";

    const consoleSummary = consoleErrors.length
      ? consoleErrors.map((c) => `- [${c.level || "ERROR"}] ${c.message || c.text || ""}`).join("\n")
      : "No console errors detected.";

    const networkSummary = networkErrors.length
      ? networkErrors
          .map((n) => `- ${n.method || "GET"} ${n.url || ""} (${n.status || "FAILED"})`)
          .join("\n")
      : "No network errors detected.";

    const summaryMarkdown = `### 🐛 Bug Report: ${title || "Issue Captured"}

#### 📋 Steps to Reproduce
${stepsText}

#### ⚠️ Console Logs
${consoleSummary}

#### 🌐 Network Activity
${networkSummary}

#### 💻 Environment
- **Screen Resolution:** ${windowSize || "Unknown"}
- **Captured At:** ${new Date().toISOString()}

---
*Auto-generated by BugSnap AI Bug Reporter*`;

    return NextResponse.json({ summary: summaryMarkdown });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate AI bug report" },
      { status: 500 }
    );
  }
}
