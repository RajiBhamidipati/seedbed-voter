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

function gateColor(val: string) {
  if (val === "Yes") return "text-green-sem bg-green-bg";
  if (val === "Partially") return "text-amber-sem bg-amber-bg";
  return "text-red-sem bg-red-bg";
}

type PickCounts = Record<string, { first: number; second: number }>;

const DEADLINE = new Date("2026-04-07T23:59:59+01:00"); // Tuesday 7 April 2026, end of day BST

export default function Home() {
  const [ideas, setIdeas] = useState<Submission[]>([]);
  const [pickCounts, setPickCounts] = useState<PickCounts>({});
  const [loading, setLoading] = useState(true);
  const [pickerName, setPickerName] = useState("");
  const [firstChoice, setFirstChoice] = useState<string | null>(null);
  const [secondChoice, setSecondChoice] = useState<string | null>(null);
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

  // Fetch pick counts (first + second separately)
  const fetchPickCounts = useCallback(async () => {
    if (ideas.length === 0) return;
    const ids = ideas.map((i) => i.id);
    const { data } = await supabase
      .from("idea_picks")
      .select("first_choice, second_choice");

    if (data) {
      const counts: PickCounts = {};
      ids.forEach((id) => (counts[id] = { first: 0, second: 0 }));
      data.forEach((row: { first_choice: string; second_choice: string | null }) => {
        if (row.first_choice && counts[row.first_choice]) {
          counts[row.first_choice].first += 1;
        }
        if (row.second_choice && counts[row.second_choice]) {
          counts[row.second_choice].second += 1;
        }
      });
      setPickCounts(counts);
    }
  }, [ideas]);

  useEffect(() => {
    fetchPickCounts();
  }, [fetchPickCounts]);

  // Real-time subscription for picks
  useEffect(() => {
    if (ideas.length === 0) return;
    const channel = supabase
      .channel("picks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "idea_picks" },
        () => {
          fetchPickCounts();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ideas, fetchPickCounts]);

  // Handle card click — toggle first choice, then second choice
  function handleCardClick(id: string) {
    if (firstChoice === id) {
      // Deselect first choice
      setFirstChoice(null);
      return;
    }
    if (secondChoice === id) {
      // Deselect second choice
      setSecondChoice(null);
      return;
    }
    if (!firstChoice) {
      setFirstChoice(id);
    } else if (!secondChoice) {
      setSecondChoice(id);
    } else {
      // Both set — replace second choice
      setSecondChoice(id);
    }
  }

  const isClosed = new Date() > DEADLINE;

  // Submit picks
  async function handleSubmit() {
    if (isClosed) {
      setMessage({ type: "error", text: "Voting has closed." });
      return;
    }
    const name = pickerName.trim();
    if (!name) {
      setMessage({ type: "error", text: "Please enter your name." });
      return;
    }
    if (!firstChoice) {
      setMessage({ type: "error", text: "Please select your first choice." });
      return;
    }
    setSubmitting(true);
    setMessage(null);

    // Case-insensitive duplicate check
    const { data: existing } = await supabase
      .from("idea_picks")
      .select("picker_name")
      .ilike("picker_name", name);

    if (existing && existing.length > 0) {
      setMessage({ type: "error", text: `You've already submitted your picks, ${name}.` });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from("idea_picks")
      .insert({
        first_choice: firstChoice,
        second_choice: secondChoice,
        picker_name: name,
      });

    if (error) {
      if (error.code === "23505") {
        setMessage({ type: "error", text: `You've already submitted your picks, ${name}.` });
      } else {
        setMessage({ type: "error", text: "Something went wrong. Please try again." });
      }
    } else {
      setMessage({ type: "success", text: `Thanks ${name} — your choices have been recorded!` });
      setFirstChoice(null);
      setSecondChoice(null);
      setPickerName("");
    }
    setSubmitting(false);
  }

  // CSV export
  async function exportCSV() {
    if (ideas.length === 0) return;
    const { data: picks } = await supabase
      .from("idea_picks")
      .select("picker_name, first_choice, second_choice, created_at")
      .order("created_at");

    if (!picks || picks.length === 0) {
      setMessage({ type: "error", text: "No picks to export yet." });
      return;
    }

    const titleMap = Object.fromEntries(ideas.map((i) => [i.id, i.title]));
    const rows = [
      ["name", "first_choice", "second_choice", "picked_at"],
      ...picks.map((p: { picker_name: string; first_choice: string; second_choice: string | null; created_at: string }) => [
        p.picker_name,
        titleMap[p.first_choice] || "",
        p.second_choice ? titleMap[p.second_choice] || "" : "",
        p.created_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seedbed-picks.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPeople = Object.values(pickCounts).reduce((a, b) => a + b.first, 0);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <div className="bg-ink px-7 pb-10 pt-8">
        <h1 className="text-white font-extrabold text-[28px] tracking-tight mb-1">
          Which ideas do you want to work on?
        </h1>
        <p className="text-white/50 text-[15px] max-w-xl">
          The AI Council has shortlisted 5 ideas from Seedbed. Pick your first
          and second choice — the ideas you&apos;d most like to help solve.
        </p>
        <p className={`font-mono text-[12px] mt-3 uppercase tracking-wider ${isClosed ? "text-red-bg" : "text-glow"}`}>
          {isClosed ? "Voting closed" : "Deadline: Tuesday 7 April 2026"}
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
              value={pickerName}
              onChange={(e) => setPickerName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-[14px] text-ink bg-white outline-none focus:border-brand transition-colors"
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || isClosed}
              className="bg-glow text-ink border-none rounded-[10px] px-6 py-2.5 font-bold text-[14px] hover:brightness-95 transition disabled:opacity-50"
            >
              {isClosed ? "Voting closed" : submitting ? "Submitting…" : "Submit choices"}
            </button>
            <button
              onClick={exportCSV}
              className="bg-transparent text-ink border-[1.5px] border-ink rounded-[10px] px-5 py-2.5 font-semibold text-[14px] hover:bg-ink hover:text-white transition"
            >
              Export (CSV)
            </button>
          </div>

          {/* Selection summary */}
          <div className="mt-3 flex gap-4 items-center flex-wrap">
            <span className="font-mono text-[11px] text-muted uppercase tracking-wider">
              1st:{" "}
              <span className={firstChoice ? "text-ink font-semibold" : ""}>
                {firstChoice
                  ? ideas.find((i) => i.id === firstChoice)?.title ?? "—"
                  : "click a card"}
              </span>
            </span>
            <span className="font-mono text-[11px] text-muted uppercase tracking-wider">
              2nd:{" "}
              <span className={secondChoice ? "text-ink font-semibold" : ""}>
                {secondChoice
                  ? ideas.find((i) => i.id === secondChoice)?.title ?? "—"
                  : "optional"}
              </span>
            </span>
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
            {totalPeople} {totalPeople === 1 ? "person has" : "people have"} picked so far
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
              const isFirst = firstChoice === idea.id;
              const isSecond = secondChoice === idea.id;
              const isSelected = isFirst || isSecond;
              const pillars = (idea.pillars || [])
                .map((pid) => PILLARS[pid])
                .filter(Boolean);
              const counts = pickCounts[idea.id] || { first: 0, second: 0 };

              return (
                <div
                  key={idea.id}
                  onClick={() => handleCardClick(idea.id)}
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
                      isFirst ? "bg-glow" : isSecond ? "bg-brand" : "bg-transparent"
                    }`}
                  />

                  <div className="px-7 pb-6 pt-5">
                    {/* Header row */}
                    <div className="flex justify-between items-start gap-3 mb-1">
                      <div className="flex items-center gap-3">
                        {/* Choice badge */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors text-[11px] font-bold ${
                            isFirst
                              ? "bg-ink text-glow"
                              : isSecond
                              ? "bg-brand text-white"
                              : "border-2 border-border bg-white text-transparent"
                          }`}
                        >
                          {isFirst ? "1" : isSecond ? "2" : "·"}
                        </div>
                        <h2 className="font-bold text-[16px] text-ink">
                          {idea.title}
                        </h2>
                      </div>
                      {/* Pick counts */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-center">
                          <span className="font-mono text-[18px] font-extrabold text-ink block leading-none">
                            {counts.first}
                          </span>
                          <span className="font-mono text-[9px] text-muted uppercase tracking-wider">
                            1st
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="font-mono text-[18px] font-extrabold text-mid block leading-none">
                            {counts.second}
                          </span>
                          <span className="font-mono text-[9px] text-muted uppercase tracking-wider">
                            2nd
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Meta */}
                    <p className="text-[12px] text-mid mb-4 ml-9">
                      {idea.submitter_name} · {idea.team} ·{" "}
                      {fmtDate(idea.created_at)}
                    </p>

                    {/* Problem */}
                    <div className="mb-3 ml-9">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-medium">
                        Problem
                      </span>
                      <p className="text-[13px] text-ink leading-relaxed mt-0.5 line-clamp-3">
                        {idea.problem}
                      </p>
                    </div>

                    {/* Solution */}
                    <div className="mb-3 ml-9">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-medium">
                        Solution
                      </span>
                      <p className="text-[13px] text-ink leading-relaxed mt-0.5 line-clamp-3">
                        {idea.solution}
                      </p>
                    </div>

                    {/* Beneficiary */}
                    {idea.beneficiary && (
                      <div className="mb-3 ml-9">
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
                      <div className="mb-3 ml-9">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-medium">
                          Success metric
                        </span>
                        <p className="text-[13px] text-ink leading-relaxed mt-0.5 whitespace-pre-line line-clamp-4">
                          {idea.success_metric}
                        </p>
                      </div>
                    )}

                    {/* Gates */}
                    <div className="mb-4 ml-9">
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

                    {/* Pillars */}
                    <div className="flex gap-1.5 flex-wrap ml-9">
                      {pillars.map((name) => (
                        <span
                          key={name}
                          className="bg-ink/[0.08] text-ink rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        >
                          {name}
                        </span>
                      ))}
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
