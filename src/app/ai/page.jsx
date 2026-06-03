import { useState } from "react";
import { Bot, Lightbulb, Send, ShieldCheck, Sparkles } from "lucide-react";
import { Button, Card, Textarea } from "@/components/ui";
import { showToast } from "@/components/Toast";
import { shopHeaders } from "@/utils/shopContext";

const EXAMPLES = [
  "How much profit today?",
  "Which product is low stock?",
  "Summarize monthly profit",
  "Suggest price for cost Rs 500 and 25% margin",
  "Create customer payment reminder",
  "Show slow-moving products",
];

export default function AiAssistantPage() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const ask = async (question = prompt) => {
    const value = question.trim();
    if (!value) return;
    setPrompt(value);
    setLoading(true);
    try {
      const request = await fetch("/api/ai", {
        method: "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prompt: value }),
      });
      const data = await request.json().catch(() => ({}));
      if (!request.ok) throw new Error(data.error || "Could not get an answer");
      setResponse(data);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins flex items-center gap-2">
          <Sparkles className="w-7 h-7 t-accent-text" /> AI Assistant
        </h1>
        <p className="t-muted text-sm mt-1">
          Ask for stock alerts, profit summaries, pricing guidance and payment messages.
        </p>
      </div>

      <Card>
        <div className="flex items-start gap-3 mb-3">
          <Bot className="w-5 h-5 t-accent-text mt-0.5" />
          <div>
            <div className="t-text font-semibold">AI Update</div>
            <div className="t-dim text-xs">Answers use only the active shop's authorized business records.</div>
          </div>
        </div>
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          placeholder="Example: Which product is low stock?"
        />
        <div className="flex justify-end mt-3">
          <Button onClick={() => ask()} disabled={loading || !prompt.trim()}>
            <Send className="w-4 h-4" />
            {loading ? "Working..." : "Ask Assistant"}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4">
        <Card>
          <div className="flex items-center gap-2 t-text font-semibold mb-3">
            <Lightbulb className="w-4 h-4 t-accent-text" /> Insight
          </div>
          {response ? (
            <p className="t-text text-sm leading-7 whitespace-pre-wrap">{response.answer}</p>
          ) : (
            <p className="t-muted text-sm">Choose a question or enter one above to get a shop-level business insight.</p>
          )}
        </Card>
        <Card>
          <div className="t-text text-sm font-semibold mb-3">Try asking</div>
          <div className="space-y-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => ask(example)}
                className="w-full text-left t-elev hover:bg-[var(--bg-input-focus)] rounded-xl px-3 py-2 t-muted text-xs transition"
              >
                {example}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 t-accent-text flex-shrink-0" />
        <p className="t-muted text-xs leading-5">
          This assistant runs through a server-side endpoint with shop permission checks. Secret keys are not sent to the browser, and request logs mask sensitive patterns.
        </p>
      </Card>
    </div>
  );
}
