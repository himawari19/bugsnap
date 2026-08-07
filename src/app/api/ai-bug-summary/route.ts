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
    if ((title !== undefined && typeof title !== "string") ||
        (windowSize !== undefined && typeof windowSize !== "string") ||
        !Array.isArray(devLogs) || devLogs.length > 100 ||
        (typeof title === "string" && title.length > 200) ||
        (typeof windowSize === "string" && windowSize.length > 100) ||
        JSON.stringify(devLogs).length > 100_000) {
      return NextResponse.json({ error: "Invalid or oversized input" }, { status: 400 });
    }

    const logs: DevLog[] = devLogs.filter((log): log is DevLog => Boolean(log) && typeof log === "object");
    const consoleErrors = logs.filter((l) => l.type === "console");
    const networkErrors = logs.filter((l) => l.type === "network");
    const steps = logs.filter((l) => l.type === "step");

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
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://dashboard.akusaraproject.my.id",
      "X-Title": "Mazway Dashboard",
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
*Auto-generated by Mazway AI Bug Reporter*`;

    return NextResponse.json({ summary: summaryMarkdown });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate AI bug report" },
      { status: 500 }
    );
  }
}
