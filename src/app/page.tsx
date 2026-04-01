"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Submission, PILLARS, GATES, SHORTLISTED_TITLES } from "@/lib/types";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function scoreLabel(total: number | null) {
  if (total === null) return { label: "Needs Clarity", color: "text-[#8b6914]", bg: "bg-[#fef3cd]" };
  if (total >= 12) return { label: "Proceed to POC", color: "text-green-sem", bg: "bg-green-bg" };
  if (total >= 8) return { label: "Conditional", color: "text-amber-sem", bg: "bg-amber-bg" };
  return { label: "Park for now", color: "text-red-sem", bg: "bg-red-bg" };
}

function gateColor(val: string) {
  if (val === "Yes") return "text-green-sem bg-green-bg";
  if (val === "Partially") return "text-amber-sem bg-amber-bg";
  return "text-red-sem bg-red-bg";
}

export default function Home() {
  const [ideas, setIdeas] = useState<Submission[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [voterName, setVoterName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch shortlisted ideas
  useEffect(() => {
    async function fetchIdeas() {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .in("title", SHORTLISTED_TITLES)
        .order("title");
      if (!error && data) setIdeas(data as Submission[]);
      setLoading(false);
    }
    fetchIdeas();
  }, []);

  // Fetch vote counts
  const fetchVoteCounts = useCallback(async () => {
    if (ideas.length === 0) return;
    const ids = ideas.map((i) => i.id);
    const { data } = await supabase
      .from("votes")
      .select("submission_id")
      .in("submission_id", ids);
    if (data) {
      const counts: Record<string, number> = {};
      ids.forEach((id) => (counts[id] = 0));
      data.forEach((v: { submission_id: string }) => {
        counts[v.submission_id] = (counts[v.submission_id] || 0) + 1;
      });
      setVoteCounts(counts);
    }
  }, [ideas]);

  useEffect(() => {
    fetchVoteCounts();
  }, [fetchVoteCounts]);

  // Real-time subscription for votes
  useEffect(() => {
    if (ideas.length === 0) return;
    const channel = supabase
      .channel("votes-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        () => {
          fetchVoteCounts();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ideas, fetchVoteCounts]);

  // Submit vote
  async function handleVote() {
    const name = voterName.trim();
    if (!name) {
      setMessage({ type: "error", text: "Please enter your name." });
      return;
    }
    if (!selectedId) {
      setMessage({ type: "error", text: "Please select an idea to vote for." });
      return;
    }
    setSubmitting(true);
    setMessage(null);

    // Case-insensitive duplicate check
    const { data: existing } = await supabase
      .from("votes")
      .select("voter_name")
      .ilike("voter_name", name);

    if (existing && existing.length > 0) {
      setMessage({ type: "error", text: `You've already voted, ${name}.` });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from("votes")
      .insert({ submission_id: selectedId, voter_name: name });

    if (error) {
      if (error.code === "23505") {
        setMessage({ type: "error", text: `You've already voted, ${name}.` });
      } else {
        setMessage({ type: "error", text: "Something went wrong. Please try again." });
      }
    } else {
      setMessage({ type: "success", text: `Thanks for voting, ${name}!` });
      setSelectedId(null);
      setVoterName("");
    }
    setSubmitting(false);
  }

  // CSV export
  async function exportCSV() {
    if (ideas.length === 0) return;
    const ids = ideas.map((i) => i.id);
    const { data: votes } = await supabase
      .from("votes")
      .select("voter_name, submission_id, created_at")
      .in("submission_id", ids)
      .order("created_at");

    if (!votes || votes.length === 0) {
      setMessage({ type: "error", text: "No votes to export yet." });
      return;
    }

    const titleMap = Object.fromEntries(ideas.map((i) => [i.id, i.title]));
    const rows = [
      ["voter_name", "idea_title", "created_at"],
      ...votes.map((v: { voter_name: string; submission_id: string; created_at: string }) => [
        v.voter_name,
        titleMap[v.submission_id] || "",
        v.created_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seedbed-votes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <div className="bg-ink px-7 pb-10 pt-8">
        <h1 className="text-white font-extrabold text-[28px] tracking-tight mb-1">
          Vote for your favourite AI idea
        </h1>
        <p className="text-white/50 text-[15px] max-w-xl">
          The AI Council has shortlisted 5 ideas from Seedbed. Pick the one you
          think we should build first.
        </p>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-5 py-8">
        {/* Voter input + controls */}
        <div className="bg-white rounded-card p-6 shadow-card mb-8 fade-up">
          <label className="font-mono text-[11px] uppercase tracking-wider font-medium text-ink block mb-1.5">
            Your name
          </label>
          <div className="flex gap-3 items-start flex-wrap">
            <input
              type="text"
              value={voterName}
              onChange={(e) => setVoterName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-[14px] text-ink bg-white outline-none focus:border-brand transition-colors"
            />
            <button
              onClick={handleVote}
              disabled={submitting}
              className="bg-glow text-ink border-none rounded-[10px] px-6 py-2.5 font-bold text-[14px] hover:brightness-95 transition disabled:opacity-50"
            >
              {submitting ? "Voting…" : "Cast Vote"}
            </button>
            <button
              onClick={exportCSV}
              className="bg-transparent text-ink border-[1.5px] border-ink rounded-[10px] px-5 py-2.5 font-semibold text-[14px] hover:bg-ink hover:text-white transition"
            >
              Export Results (CSV)
            </button>
          </div>
          {message && (
            <p
              className={`mt-3 text-[13px] font-medium ${
                message.type === "success" ? "text-green-sem" : "text-red-sem"
              }`}
            >
              {message.text}
            </p>
          )}
          <p className="mt-3 font-mono text-[11px] text-muted uppercase tracking-wider">
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""} cast so far
          </p>
        </div>

        {/* Idea cards */}
        {loading ? (
          <p className="text-center text-muted text-[14px] py-10">
            Loading ideas…
          </p>
        ) : ideas.length === 0 ? (
          <p className="text-center text-muted text-[14px] py-10">
            No shortlisted ideas found. Check your Supabase connection and data.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {ideas.map((idea, i) => {
              const isSelected = selectedId === idea.id;
              const pillars = (idea.pillars || [])
                .map((pid) => PILLARS[pid])
                .filter(Boolean);
              const total = idea.total_score;
              const sl = scoreLabel(total > 0 ? total : null);
              const votes = voteCounts[idea.id] || 0;

              return (
                <div
                  key={idea.id}
                  onClick={() => setSelectedId(idea.id)}
                  className={`fade-up bg-white rounded-card p-0 shadow-card cursor-pointer transition-all overflow-hidden ${
                    isSelected
                      ? "ring-[2.5px] ring-glow"
                      : "hover:translate-x-[3px]"
                  }`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {/* Selection indicator bar */}
                  <div
                    className={`h-1 transition-colors ${
                      isSelected ? "bg-glow" : "bg-transparent"
                    }`}
                  />

                  <div className="px-7 pb-6 pt-5">
                    {/* Header row */}
                    <div className="flex justify-between items-start gap-3 mb-1">
                      <div className="flex items-center gap-3">
                        {/* Radio circle */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected
                              ? "border-ink bg-ink"
                              : "border-border bg-white"
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-glow" />
                          )}
                        </div>
                        <h2 className="font-bold text-[16px] text-ink">
                          {idea.title}
                        </h2>
                      </div>
                      {/* Vote count */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-mono text-[20px] font-extrabold text-ink">
                          {votes}
                        </span>
                        <span className="font-mono text-[10px] text-muted uppercase tracking-wider">
                          vote{votes !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Meta */}
                    <p className="text-[12px] text-mid mb-4 ml-8">
                      {idea.submitter_name} · {idea.team} ·{" "}
                      {fmtDate(idea.created_at)}
                    </p>

                    {/* Problem */}
                    <div className="mb-3 ml-8">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-medium">
                        Problem
                      </span>
                      <p className="text-[13px] text-ink leading-relaxed mt-0.5 line-clamp-3">
                        {idea.problem}
                      </p>
                    </div>

                    {/* Solution */}
                    <div className="mb-3 ml-8">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-medium">
                        Solution
                      </span>
                      <p className="text-[13px] text-ink leading-relaxed mt-0.5 line-clamp-3">
                        {idea.solution}
                      </p>
                    </div>

                    {/* Beneficiary */}
                    {idea.beneficiary && (
                      <div className="mb-3 ml-8">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-medium">
                          Who benefits
                        </span>
                        <p className="text-[13px] text-ink leading-relaxed mt-0.5 whitespace-pre-line line-clamp-4">
                          {idea.beneficiary}
                        </p>
                      </div>
                    )}

                    {/* Success Metric */}
                    {idea.success_metric && (
                      <div className="mb-3 ml-8">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-medium">
                          Success metric
                        </span>
                        <p className="text-[13px] text-ink leading-relaxed mt-0.5 whitespace-pre-line line-clamp-4">
                          {idea.success_metric}
                        </p>
                      </div>
                    )}

                    {/* Gates */}
                    <div className="mb-4 ml-8">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-medium block mb-1.5">
                        Readiness gates
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {GATES.map((gate) => {
                          const val = idea[gate.id];
                          return (
                            <div key={gate.id} className="flex items-center gap-2">
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold font-mono uppercase tracking-wider ${gateColor(val)}`}
                              >
                                {val}
                              </span>
                              <span className="text-[12px] text-mid">
                                {gate.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer: pillars + score */}
                    <div className="flex justify-between items-end flex-wrap gap-3 ml-8">
                      <div className="flex gap-1.5 flex-wrap">
                        {pillars.map((name) => (
                          <span
                            key={name}
                            className="bg-ink/[0.08] text-ink rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                      {/* Score badge */}
                      <div
                        className={`inline-flex items-center gap-2.5 rounded-[10px] px-4 py-2 ${sl.bg}`}
                      >
                        <span
                          className={`font-extrabold text-[20px] ${sl.color}`}
                        >
                          {total > 0 ? `${total}/15` : "—"}
                        </span>
                        <span
                          className={`font-mono text-[11px] uppercase tracking-wider font-medium ${sl.color}`}
                        >
                          {sl.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
