/**
 * Informe en PDF de My Farm (F40). Se carga solo al tocar "Export report": jsPDF no entra en el resto de la app.
 * Cada número del tablero va con su fuente, su método y sus límites. Nada se inventa: lo que falta dice "Missing data".
 */
import { jsPDF } from "jspdf";
import type { County, Transition } from "../data/types";
import { PRIORITY_LABEL, type NextData } from "../next/types";
import { CROP_LABEL, type CropId } from "../ui/crops";
import { baseTitle, optionStep, stepPct, type Comparison, type TwinRow } from "./crm";
import { COUNTY_BY_FIPS, FARM_CROP_LABEL, FARM_YEARS, farmIncome, rotationSummary, type Farm } from "./farm";

export interface ReportInput {
  farm: Farm;
  next: NextData;
  hist: County | null;
  cmp: Comparison;
  twins: TwinRow[];
  adoption: { year: number; items: Transition[] } | null;
}

// Paleta de la app (Field Rewind)
const NIGHT: [number, number, number] = [15, 42, 29];
const FIELD: [number, number, number] = [47, 125, 79];
const GOLD: [number, number, number] = [233, 185, 73];
const GOLD_INK: [number, number, number] = [138, 98, 0];
const INK: [number, number, number] = [18, 39, 27];
const MUTED: [number, number, number] = [96, 108, 100];
const LINE: [number, number, number] = [222, 214, 196];
const PAPER: [number, number, number] = [246, 241, 228];
const RED: [number, number, number] = [180, 35, 40];

/** Helvetica de jsPDF solo trae WinAnsi: se cambian los signos que no tiene */
const t = (s: string) =>
  s
    .replace(/[→⟶]/g, " to ")
    .replace(/[−–]/g, "-")
    .replace(/[▲]/g, "+")
    .replace(/[▼]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[^\x20-\x7E -ÿ]/g, "");

const money = (v: number | null | undefined) =>
  v == null ? "Missing data" : `${v < 0 ? "-" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
const signedMoney = (v: number | null | undefined) =>
  v == null ? "Missing data" : `${v > 0 ? "+" : v < 0 ? "-" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
const pct = (v: number | null | undefined) => (v == null ? "Missing data" : `${Math.round(v * 10) / 10}%`);
const cropName = (c: string) => CROP_LABEL[c as CropId] ?? c;

export async function buildReport({ farm, next, hist, cmp, twins, adoption }: ReportInput) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const CW = W - 2 * M;
  let y = M;

  const county = COUNTY_BY_FIPS[farm.fips];
  const countyLabel = county?.label ?? `${next.name} County, ${next.state}`;
  const crop = FARM_CROP_LABEL[farm.plan];
  const advice = cmp.advice.option;
  const base = cmp.base.option;
  const bTitle = baseTitle(cmp, farm);
  const season = next.mix?.season ?? null;
  const today = new Date();
  const dateText = today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const gap = cmp.adviceMedian != null && cmp.baseMedian != null ? cmp.adviceMedian - cmp.baseMedian : null;
  const aInc = farmIncome(advice.yield_bu_ac, cmp.pc);
  const bInc = farmIncome(base.yield_bu_ac, cmp.pc);

  // ---------------------------------------------------------------- utilidades de maquetado
  const color = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (size: number, style: "normal" | "bold" = "normal", c: [number, number, number] = INK) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    color(c);
  };
  const ensure = (h: number) => {
    if (y + h > H - M - 14) {
      doc.addPage();
      y = M;
    }
  };
  const para = (
    text: string,
    size = 10,
    c: [number, number, number] = INK,
    style: "normal" | "bold" = "normal",
    indent = 0,
  ) => {
    font(size, style, c);
    const lines = doc.splitTextToSize(t(text), CW - indent) as string[];
    const lh = size * 1.38;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, M + indent, y + size);
      y += lh;
    }
    y += 4;
  };
  const h2 = (text: string, sub?: string, need = 54) => {
    ensure(need);
    y += 10;
    doc.setDrawColor(...FIELD);
    doc.setLineWidth(2);
    doc.line(M, y, M + 26, y);
    y += 8;
    font(14, "bold", NIGHT);
    doc.text(t(text), M, y + 13);
    y += 22;
    if (sub) para(sub, 9.5, MUTED);
  };
  const bullet = (label: string, text: string) => {
    font(10, "bold");
    const lw = doc.getTextWidth(t(label) + "  ");
    const lines = doc.splitTextToSize(t(text), CW - 12 - lw) as string[];
    ensure(14 * lines.length + 4);
    doc.setFillColor(...FIELD);
    doc.circle(M + 3, y + 7, 1.8, "F");
    doc.text(t(label), M + 12, y + 10);
    font(10, "normal");
    lines.forEach((l, i) => doc.text(l, M + 12 + lw, y + 10 + i * 13.5));
    y += 13.5 * lines.length + 4;
  };
  const table = (head: string[], rows: string[][], widths: number[], align: Array<"left" | "right"> = []) => {
    const total = widths.reduce((a, b) => a + b, 0);
    const ws = widths.map((w) => (w / total) * CW);
    const rowH = 17;
    const drawHead = () => {
      ensure(rowH * 2);
      doc.setFillColor(...NIGHT);
      doc.rect(M, y, CW, rowH, "F");
      font(8.5, "bold", [255, 255, 255]);
      let x = M;
      head.forEach((h, i) => {
        const a = align[i] ?? "left";
        doc.text(t(h), a === "right" ? x + ws[i] - 6 : x + 6, y + 11.5, { align: a });
        x += ws[i];
      });
      y += rowH;
    };
    drawHead();
    rows.forEach((r, ri) => {
      if (y + rowH > H - M - 14) {
        doc.addPage();
        y = M;
        drawHead();
      }
      if (ri % 2 === 0) {
        doc.setFillColor(...PAPER);
        doc.rect(M, y, CW, rowH, "F");
      }
      font(9, "normal");
      let x = M;
      r.forEach((cell, i) => {
        const a = align[i] ?? "left";
        const txt = doc.splitTextToSize(t(cell), ws[i] - 10)[0] as string;
        if (/^Missing data$/.test(cell)) color(RED);
        else if (/^\+/.test(cell)) color(FIELD);
        else color(INK);
        doc.text(txt, a === "right" ? x + ws[i] - 6 : x + 6, y + 12, { align: a });
        x += ws[i];
      });
      y += rowH;
    });
    y += 8;
  };
  const kpi = (x: number, w: number, label: string, value: string, sub: string, accent: [number, number, number]) => {
    doc.setDrawColor(...LINE);
    doc.setFillColor(255, 253, 247);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, w, 74, 6, 6, "FD");
    doc.setFillColor(...accent);
    doc.rect(x, y + 10, 3, 54, "F");
    font(8.5, "normal", MUTED);
    doc.text(doc.splitTextToSize(t(label), w - 22)[0] as string, x + 12, y + 18);
    font(20, "bold", NIGHT);
    doc.text(t(value), x + 12, y + 44);
    font(8, "normal", MUTED);
    (doc.splitTextToSize(t(sub), w - 22) as string[])
      .slice(0, 2)
      .forEach((l, i) => doc.text(l, x + 12, y + 58 + i * 10));
  };

  // ---------------------------------------------------------------- portada
  doc.setFillColor(...NIGHT);
  doc.rect(0, 0, W, 112, "F");
  font(9, "bold", [142, 208, 129]);
  doc.text("FIELD REWIND  ·  MY FARM REPORT", M, 38);
  font(22, "bold", [246, 241, 228]);
  doc.text(t(farm.name || `Your farm in ${countyLabel}`), M, 66);
  font(10, "normal", [220, 232, 222]);
  doc.text(
    t(
      `${countyLabel}${farm.acres ? ` · ${farm.acres.toLocaleString("en-US")} acres` : ""} · Planning ${crop.toLowerCase()}${season ? ` for ${season}` : ""} · Generated ${dateText}`,
    ),
    M,
    88,
  );
  y = 136;

  // ---------------------------------------------------------------- 1. resumen
  h2("1. Summary");
  para(
    `Our advice for your next ${crop.toLowerCase()} season is ${advice.label.toLowerCase()}. ` +
      (farm.priorities.length
        ? `It is the option that scores best for what you told us matters: ${farm.priorities.map((p) => PRIORITY_LABEL[p].toLowerCase()).join(", ")}. `
        : "You did not set priorities, so the advice is the option with the highest typical income. ") +
      `Compared with ${bTitle.toLowerCase().replace(/^if you /, "what happens if you ")} (${base.label.toLowerCase()}), it left more money per acre in ${cmp.wins} of the ${cmp.seasons} past seasons' weather we tested (${cmp.years[0]}-${cmp.years[cmp.years.length - 1]}).`,
    10.5,
  );
  ensure(84);
  const kw = (CW - 20) / 3;
  kpi(
    M,
    kw,
    "Expected income · our advice",
    `${money(cmp.adviceMedian)}/ac`,
    aInc ? `Bad year ${money(aInc.p10)} · good year ${money(aInc.p90)}` : "Missing data",
    FIELD,
  );
  kpi(
    M + kw + 10,
    kw,
    bTitle,
    `${money(cmp.baseMedian)}/ac`,
    bInc ? `Bad year ${money(bInc.p10)} · good year ${money(bInc.p90)}` : "Missing data",
    GOLD,
  );
  kpi(
    M + 2 * (kw + 10),
    kw,
    farm.acres ? `Extra on your ${farm.acres.toLocaleString("en-US")} acres` : "Extra per acre",
    gap == null ? "Missing data" : signedMoney(farm.acres ? gap * farm.acres : gap),
    `${signedMoney(gap)}/ac in a typical year · wins ${cmp.wins} of ${cmp.seasons}`,
    FIELD,
  );
  y += 86;
  para(
    `"Typical", "bad year" and "good year" are the middle, the 10th and the 90th percentile of the ${cmp.seasons} weather years. ` +
      `Confidence in this advice: ${advice.confidence.level}. ${advice.confidence.reason}`,
    9,
    MUTED,
  );

  // ---------------------------------------------------------------- 2. tu campo
  h2("2. Your farm", "What you entered in My Farm. It stays in your browser; Field Rewind does not send it anywhere.");
  bullet("County:", countyLabel + ` (FIPS ${farm.fips})`);
  bullet("Acres:", farm.acres ? farm.acres.toLocaleString("en-US") : "Not set (the report shows $ per acre)");
  bullet(
    "Last seasons:",
    FARM_YEARS.map(
      (yr) => `${yr} ${farm.seasons[String(yr)] ? FARM_CROP_LABEL[farm.seasons[String(yr)]!] : "not set"}`,
    ).join(", ") +
      ". " +
      rotationSummary(farm),
  );
  bullet("Next season:", crop);
  bullet("Priorities:", farm.priorities.length ? farm.priorities.map((p) => PRIORITY_LABEL[p]).join(", ") : "None set");
  bullet(
    "Price:",
    `$${cmp.pc.price.toFixed(2)}/bu (${cmp.pc.priceFrom === "you" ? "your data" : `USDA NASS price received in your state${cmp.pc.years ? `, average ${cmp.pc.years}` : ""}`})`,
  );
  bullet(
    "Operating cost:",
    `${money(cmp.pc.cost)}/acre (${cmp.pc.costFrom === "you" ? "your data" : `USDA ERS operating costs for your farm region${cmp.pc.years ? `, average ${cmp.pc.years}` : ""}`})`,
  );

  // ---------------------------------------------------------------- 3. ingreso por año de clima
  h2(
    "3. Income in each past season's weather",
    `$ per acre left after operating costs if next season had the weather of each year. Green: our advice (${advice.label.toLowerCase()}). Gold: ${bTitle.toLowerCase()} (${base.label.toLowerCase()}).`,
    280,
  );
  drawChart();
  table(
    ["Weather of", "Advice bu/ac", "Advice $/ac", "Base bu/ac", "Base $/ac", "Difference"],
    cmp.years.map((yr, i) => {
      const ay = next.by_weather?.yield_bu_ac[`${advice.crop}_${advice.rotation}`]?.[i] ?? null;
      const by = next.by_weather?.yield_bu_ac[`${base.crop}_${base.rotation}`]?.[i] ?? null;
      const a = cmp.advice.income[i];
      const b = cmp.base.income[i];
      return [
        String(yr),
        ay == null ? "Missing data" : ay.toFixed(1),
        money(a),
        by == null ? "Missing data" : by.toFixed(1),
        money(b),
        a != null && b != null ? signedMoney(a - b) : "Missing data",
      ];
    }),
    [1, 1.1, 1.1, 1.1, 1.1, 1.1],
    ["left", "right", "right", "right", "right", "right"],
  );

  // ---------------------------------------------------------------- 4. cómo se calcula
  h2("4. How the numbers are calculated");
  bullet(
    "Yield model:",
    "The Field Rewind yield model was trained on county yields from USDA NASS (2009-2023), with weather from NASA POWER, rain from NASA GPM IMERG, soils from USDA SSURGO and crop rotations from the USDA Cropland Data Layer. For your county it predicts the yield of each rotation under the weather of every past year.",
  );
  bullet(
    "Income:",
    `Income per acre = predicted yield × price - operating cost. Price and cost stay the same in every year, so the differences come only from the weather. Here: yield × $${cmp.pc.price.toFixed(2)} - ${money(cmp.pc.cost)}.`,
  );
  bullet(
    "Seasons won:",
    `For each weather year we compare the two options. Our advice left more in ${cmp.wins} of ${cmp.seasons}.`,
  );
  bullet(
    "Advice:",
    "Each option gets a score from 0 to 1 for each priority (lower risk in bad years, higher income, soil health, saving water). The advice is the option with the best average over the priorities you chose. A priority with no data is left out and said so.",
  );
  const reasons = advice.reasons.filter((r) => r.pro);
  if (reasons.length) {
    para("Why this option, with sources:", 10, INK, "bold");
    reasons.forEach((r) =>
      bullet(
        `${r.kind === "rule" ? "Rule" : "Model"}:`,
        `${r.text} (${r.source}${r.years.length ? `; years ${r.years.join(", ")}` : ""})`,
      ),
    );
  }
  const risks = advice.reasons.filter((r) => !r.pro);
  if (risks.length) {
    para("Risks to keep in mind:", 10, INK, "bold");
    risks.forEach((r) => bullet("Risk:", `${r.text} (${r.source})`));
  }
  if (next.note) para(next.note, 9, MUTED);

  // ---------------------------------------------------------------- 5. quién ya lo hace
  h2(
    "5. Who already does it in your county",
    adoption
      ? `Share of ${next.name} County cropland by what was planted in ${adoption.year - 1} and in ${adoption.year} (USDA Cropland Data Layer, 30 m pixels).`
      : undefined,
  );
  if (!adoption) para("Missing data: there are no recent USDA crop maps for this county.", 10, RED);
  else {
    const st = optionStep(advice);
    if (st)
      para(
        `${pct(stepPct(adoption.items, st))} of the cropland already did ${advice.label.toLowerCase()} in ${adoption.year}.`,
        10.5,
        INK,
        "bold",
      );
    table(
      ["Last year", "This year", "Share of cropland"],
      adoption.items.map((x) => [cropName(x.from), cropName(x.to), pct(x.pct)]),
      [1.4, 1.4, 1],
      ["left", "left", "right"],
    );
  }

  // ---------------------------------------------------------------- 6. gemelos
  h2(
    "6. Twin counties that did it",
    "Counties that look like yours in soil and climate (9 numbers: 5 of soil from SSURGO and 4 of typical climate from NASA POWER and IMERG), without looking at what they plant. From the most similar, we keep the first ones that really planted this option.",
  );
  if (!twins.length) para("Missing data: no twin counties for this option.", 10, RED);
  else {
    table(
      ["County", "Doing this option", "Latest yield", "2015-19 average", "Change"],
      twins.map((r) => [
        `${r.name}, ${r.state}`,
        r.pct == null ? "Missing data" : `${pct(r.pct)}${r.year ? ` (${r.year})` : ""}`,
        r.latest == null ? "Missing data" : `${Math.round(r.latest)} bu/ac${r.year ? ` (${r.year})` : ""}`,
        r.baseAvg == null ? "Missing data" : `${r.baseAvg.toFixed(1)} bu/ac`,
        r.change == null ? "Missing data" : `${r.change >= 0 ? "+" : "-"}${Math.abs(Math.round(r.change * 10) / 10)}%`,
      ]),
      [1.5, 1.4, 1.3, 1.3, 0.8],
      ["left", "right", "right", "right", "right"],
    );
    para(
      `Yields are USDA NASS county yields of ${crop.toLowerCase()}. The change compares the latest year with the county's own 2015-2019 average, so it includes the general rise in yields over time, not only the effect of the rotation.`,
      9,
      MUTED,
    );
  }

  // ---------------------------------------------------------------- 7. rinde del condado
  const yrs = (hist?.years ?? []).filter((yr) => yr.yield || yr.year >= 2015);
  h2(
    `7. ${crop} yield in ${next.name} County`,
    "USDA NASS county yields. 'Below usual' or 'above usual' means more than 10% away from a usual year here, according to the Field Rewind model.",
  );
  if (!yrs.length) para("Missing data: no county yields.", 10, RED);
  else
    table(
      ["Year", "Yield (bu/acre)", "Compared with a usual year"],
      yrs.map((yr) => {
        const v = yr.yield?.crops[farm.plan];
        return [String(yr.year), v ? String(v.bu_ac) : "Missing data", v?.vs_usual ?? "Not rated"];
      }),
      [1, 1.2, 1.6],
      ["left", "right", "left"],
    );

  // ---------------------------------------------------------------- 8. antes de decidir
  h2("8. Before you decide", "What the numbers above cannot tell you, or only estimate.");
  bullet(`Confidence (${advice.confidence.level}):`, advice.confidence.reason);
  next.missing.forEach((m) => bullet(`${m.what}:`, m.why));
  bullet("County, not field:", "Every number is for the whole county. Your own field can do better or worse.");
  bullet(
    "Weather, not a forecast:",
    "The past seasons show the range of outcomes; they do not predict next season's weather.",
  );

  // ---------------------------------------------------------------- 9. fuentes
  h2("9. Data sources", `${next.source}. Generated by Field Rewind on ${dateText}.`, 200);
  table(
    ["Source", "What it is", "Used here for"],
    [
      ["NASA POWER", "Daily weather by county (1981-)", "Weather of each past season; twin counties"],
      ["NASA GPM IMERG", "Satellite rainfall, 0.1°", "Rain in the yield model; twin counties"],
      ["USDA NASS Quick Stats", "County yields; prices received by state", "Training the model; county yield; price"],
      ["USDA Cropland Data Layer", "Crop map, 30 m, every year", "Rotations in the model; who already does it"],
      ["USDA ERS", "Costs and returns by farm region", "Operating cost per acre"],
      ["USDA NRCS SSURGO", "Soil survey", "Soil in the model; twin counties"],
      ["Field Rewind model", "Yield by rotation and weather year", "Income by season, ranges, seasons won"],
    ],
    [1.3, 1.6, 2],
  );

  // ---------------------------------------------------------------- pie de página
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    font(8, "normal", MUTED);
    doc.text(t(`Field Rewind · ${countyLabel} · ${dateText}`), M, H - 24);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 24, { align: "right" });
  }

  const slug = (county?.name ?? next.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`field-rewind-${slug}-${today.toISOString().slice(0, 10)}.pdf`);

  // ---------------------------------------------------------------- gráfico vectorial (sección 3)
  function drawChart() {
    const ch = 190;
    ensure(ch + 20);
    const l = M + 44;
    const r = M + CW - 8;
    const top = y + 8;
    const bot = y + ch - 22;
    const vals = [...cmp.advice.income, ...cmp.base.income].filter((v): v is number => v != null);
    const span = Math.max(...vals) - Math.min(...vals) || 1;
    const step = [10, 20, 25, 50, 100, 200, 250, 500].find((s) => span / s <= 5) ?? 1000;
    const lo = Math.floor(Math.min(...vals) / step) * step;
    const hi = Math.ceil(Math.max(...vals) / step) * step;
    const n = cmp.years.length;
    const X = (i: number) => l + (i * (r - l)) / Math.max(n - 1, 1);
    const Y = (v: number) => bot - ((v - lo) / (hi - lo || 1)) * (bot - top);
    doc.setLineWidth(0.5);
    for (let v = lo; v <= hi; v += step) {
      doc.setDrawColor(...LINE);
      doc.line(l, Y(v), r, Y(v));
      font(7.5, "normal", MUTED);
      doc.text(money(v), l - 6, Y(v) + 2.5, { align: "right" });
    }
    cmp.years.forEach((yr, i) => {
      if (n > 12 && i % 2 && i !== n - 1) return;
      font(7.5, "normal", MUTED);
      doc.text(String(yr), X(i), bot + 12, { align: "center" });
    });
    const line = (vals: Array<number | null>, c: [number, number, number], w: number) => {
      doc.setDrawColor(...c);
      doc.setLineWidth(w);
      let prev: [number, number] | null = null;
      vals.forEach((v, i) => {
        if (v == null) {
          prev = null;
          return;
        }
        const p: [number, number] = [X(i), Y(v)];
        if (prev) doc.line(prev[0], prev[1], p[0], p[1]);
        doc.setFillColor(...c);
        doc.circle(p[0], p[1], 2, "F");
        prev = p;
      });
    };
    line(cmp.base.income, GOLD, 1.6);
    line(cmp.advice.income, FIELD, 2.2);
    // leyenda
    font(8, "normal", INK);
    doc.setFillColor(...FIELD);
    doc.rect(l, bot + 20, 10, 3, "F");
    doc.text("Our advice", l + 14, bot + 23.5);
    doc.setFillColor(...GOLD);
    doc.rect(l + 80, bot + 20, 10, 3, "F");
    color(GOLD_INK);
    doc.text(t(bTitle), l + 94, bot + 23.5);
    y += ch + 14;
  }
}
