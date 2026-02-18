"use client";

import { useEffect, useState } from "react";
import { Save, Send, Mail } from "lucide-react";

type Feedback = {
  type: "success" | "error";
  message: string;
} | null;

function cronToTime(cron: string): { hour: number; minute: number } {
  // cron format: "minute hour * * *"
  const parts = cron.split(" ");
  const minute = parseInt(parts[0], 10) || 0;
  const hour = parseInt(parts[1], 10) || 6;
  return { hour, minute };
}

function timeToCron(hour: number, minute: number): string {
  return `${minute} ${hour} * * *`;
}

export default function SettingsPage() {
  const [emailTo, setEmailTo] = useState("");
  const [sendHour, setSendHour] = useState(6);
  const [sendMinute, setSendMinute] = useState(30);
  const [ollamaEndpoint, setOllamaEndpoint] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("qwen2.5:7b");
  const [timezone, setTimezone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: Record<string, unknown>) => {
        if (data.email_to !== undefined) setEmailTo(data.email_to as string);
        if (data.send_time) {
          const { hour, minute } = cronToTime(data.send_time as string);
          setSendHour(hour);
          setSendMinute(minute);
        }
        if (data.ollama_endpoint !== undefined)
          setOllamaEndpoint(data.ollama_endpoint as string);
        if (data.ollama_model !== undefined)
          setOllamaModel(data.ollama_model as string);
      })
      .catch(() => {
        setFeedback({ type: "error", message: "Failed to load settings." });
      })
      .finally(() => setLoading(false));
  }, []);

  const showFeedback = (fb: Feedback) => {
    setFeedback(fb);
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_to: emailTo,
          send_time: timeToCron(sendHour, sendMinute),
          ollama_endpoint: ollamaEndpoint,
          ollama_model: ollamaModel,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      showFeedback({ type: "success", message: "Settings saved successfully." });
    } catch {
      showFeedback({ type: "error", message: "Failed to save settings." });
    } finally {
      setSaving(false);
    }
  };

  const handleSendDigest = async () => {
    setSendingDigest(true);
    try {
      const res = await fetch("/api/digest/send", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send digest");
      showFeedback({
        type: "success",
        message: data.message || "Digest sent successfully!",
      });
    } catch (err) {
      showFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to send digest.",
      });
    } finally {
      setSendingDigest(false);
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    try {
      const res = await fetch("/api/digest/send", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send test email");
      showFeedback({
        type: "success",
        message: "Test email sent! Check your inbox for today's digest.",
      });
    } catch (err) {
      showFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to send test email.",
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            Settings
          </h1>
          <div className="mt-8 flex items-center justify-center py-16">
            <div className="text-sm text-muted-foreground">Loading settings...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Header */}
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your daily digest and AI settings
        </p>

        {/* Feedback banner */}
        {feedback && (
          <div
            className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Email Settings */}
        <div className="mt-8 space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Email Delivery
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure when and where your daily digest is sent
            </p>

            <div className="mt-6 space-y-5">
              {/* Email address */}
              <div>
                <label
                  htmlFor="email_to"
                  className="block text-sm font-medium text-foreground"
                >
                  Email address
                </label>
                <input
                  id="email_to"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Send time */}
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Send time
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <select
                    value={sendHour}
                    onChange={(e) => setSendHour(parseInt(e.target.value, 10))}
                    className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-base md:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i.toString().padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm font-medium text-muted-foreground">:</span>
                  <select
                    value={sendMinute}
                    onChange={(e) => setSendMinute(parseInt(e.target.value, 10))}
                    className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-base md:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <option key={m} value={m}>
                        {m.toString().padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Timezone: {timezone}
                </p>
              </div>
            </div>
          </section>

          {/* AI Settings */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              AI Configuration
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure the Ollama instance used for generating recaps
            </p>

            <div className="mt-6 space-y-5">
              {/* Ollama endpoint */}
              <div>
                <label
                  htmlFor="ollama_endpoint"
                  className="block text-sm font-medium text-foreground"
                >
                  Ollama endpoint URL
                </label>
                <input
                  id="ollama_endpoint"
                  type="url"
                  value={ollamaEndpoint}
                  onChange={(e) => setOllamaEndpoint(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Ollama model */}
              <div>
                <label
                  htmlFor="ollama_model"
                  className="block text-sm font-medium text-foreground"
                >
                  Ollama model name
                </label>
                <input
                  id="ollama_model"
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="qwen2.5:7b"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </section>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>

          {/* Actions */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-serif text-lg font-semibold text-foreground">Actions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manually trigger digest delivery
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleSendDigest}
                disabled={sendingDigest}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
                {sendingDigest ? "Sending..." : "Send Today's Digest Now"}
              </button>
              <button
                onClick={handleSendTest}
                disabled={sendingTest}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mail className="h-4 w-4" />
                {sendingTest ? "Sending..." : "Send Test Email"}
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Both buttons send the actual daily digest to your configured email
              address. Use this to verify your email setup is working correctly.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
