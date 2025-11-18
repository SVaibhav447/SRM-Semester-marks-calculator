// semester_script.js - updated note classification prioritizing LOWER bound for hover state

// ===============================
// CONFIG
// ===============================
const MAX = { ct1: 50, ct2: 60, ext: 75 };
const internalRawTotal = MAX.ct1 + MAX.ct2; // 110
const internalWeight = 60; // %
const externalWeight = 40; // %

const grades = [
  ["O", 91, 100],
  ["A+", 81, 90],
  ["A", 71, 80],
  ["B+", 61, 70],
  ["B", 51, 60],
  ["C", 41, 50],
  ["D", 35, 40],
  ["F", 0, 34.999]
];

// ===============================
// DOM HELPERS
// ===============================
const el = id => document.getElementById(id);

const ct1In = el("ct1");
const ct2In = el("ct2");
const internalIn = el("internal");
const extIn = el("ext");

const tbody = document.querySelector("#output tbody");
const status = el("status");
const resetBtn = el("reset");
const themeToggle = el("themeToggle");
const calcInfo = el("calcInfo");

function parseVal(input) {
  const v = input && input.value ? input.value.trim() : "";
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function internalWeightedFromRaw(raw) {
  return (raw / internalRawTotal) * internalWeight;
}
function externalWeightedFromRaw(raw) {
  return (raw / MAX.ext) * externalWeight;
}
function finalPercentage(internalRaw, externalRaw) {
  return internalWeightedFromRaw(internalRaw) + externalWeightedFromRaw(externalRaw);
}

// Determine note state and human-friendly text
function classifyNoteByLower(lo, hi) {
  // Prioritize lower bound (lo). Color/hover is decided by lower bound feasibility.
  // lo/hi objects may be of type 'ext' (value in raw ext), 'int_needed' (value raw internal), etc.
  const res = { text: "", className: "note-cell" };

  const hardThresholdExt = MAX.ext - 9; // >= this -> hard
  const hardThresholdInt = internalRawTotal - 9;

  // If lower bound is missing or NA, fallback to general logic
  if (!lo) {
    res.text = "Possible";
    res.className += " note-possible";
    return res;
  }

  // Helper to mark impossible based on lower bound
  const lowerImpossible = (lo.type === 'ext' && lo.value > MAX.ext) || (lo.type === 'int_needed' && lo.value > internalRawTotal);
  if (lowerImpossible) {
    res.text = "Impossible";
    res.className += " note-impossible";
    return res;
  }

  // If lower bound already satisfied (<=0 required)
  const lowerAchieved = (lo.type === 'ext' && lo.value <= 0) || (lo.type === 'int_needed' && lo.value <= 0);
  if (lowerAchieved) {
    // But if upper bound is impossible, still green because lower is enough
    if (hi && ((hi.type === 'ext' && hi.value > MAX.ext) || (hi.type === 'int_needed' && hi.value > internalRawTotal))) {
      res.text = "Already achieved (upper bound impossible)";
    } else {
      res.text = "Skipping is now also an option!";
    }
    res.className += " note-possible";
    return res;
  }

  // If lower requires near-max -> hard
  const lowerHard = (lo.type === 'ext' && lo.value >= hardThresholdExt) || (lo.type === 'int_needed' && lo.value >= hardThresholdInt);
  if (lowerHard) {
    // If upper impossible, still mark as Possible (hard)
    if (hi && ((hi.type === 'ext' && hi.value > MAX.ext) || (hi.type === 'int_needed' && hi.value > internalRawTotal))) {
      res.text = "Possible (hard) — upper bound impossible";
    } else {
      res.text = "Possible (hard)";
    }
    res.className += " note-hard";
    return res;
  }

  // Default: lower bound possible and not hard -> green
  if (hi && ((hi.type === 'ext' && hi.value > MAX.ext) || (hi.type === 'int_needed' && hi.value > internalRawTotal))) {
    res.text = "Possible — upper bound impossible"; // still green because lower achievable
  } else {
    res.text = "Possible";
  }
  res.className += " note-possible";
  return res;
}

// Build readable representation for requirement cell
function fmtRequirement(x) {
  if (!x) return "--";
  if (x.type === "ext") return `${x.value.toFixed(2)} / ${MAX.ext}`;
  if (x.type === "ct1" || x.type === "ct2") return `${x.value.toFixed(2)} / ${MAX[x.type]}`;
  if (x.type === "int_needed") {
    const s = x.suggestion || {};
    return `Internal needed: ${x.value.toFixed(2)} / ${internalRawTotal} <br>CT1≈${(s.ct1||0).toFixed(2)}, CT2≈${(s.ct2||0).toFixed(2)}`;
  }
  if (x.type === "both") {
    return `If CTs max → End-Sem ≈ ${x.extIfInternalMax.toFixed(2)} / ${MAX.ext} <br>If End-Sem max → Internal ≈ ${x.needInternalRawIfExtMax.toFixed(2)} / ${internalRawTotal}`;
  }
  return "--";
}

function clearTable() {
  tbody.innerHTML = "";
}

// ===============================
// MAIN COMPUTATION
// ===============================
function compute() {
  const ct1 = parseVal(ct1In);
  const ct2 = parseVal(ct2In);
  const ext = parseVal(extIn);
  const internalWeighted = parseVal(internalIn);

  const usingInternalWeighted = internalWeighted !== null;

  clearTable();
  status.textContent = "";

  const known = {
    ct1: !usingInternalWeighted && ct1 !== null,
    ct2: !usingInternalWeighted && ct2 !== null,
    internalWeighted: usingInternalWeighted,
    ext: ext !== null
  };

  if (!known.ct1 && !known.ct2 && !known.internalWeighted && !known.ext) {
    status.textContent = "Enter at least one field to calculate.";
    return;
  }

  let equivalentInternalRaw = null;
  if (usingInternalWeighted) equivalentInternalRaw = (internalWeighted / internalWeight) * internalRawTotal;

  const internalRawKnown = (!usingInternalWeighted && ct1 !== null && ct2 !== null) ? (ct1 + ct2) : (equivalentInternalRaw !== null ? equivalentInternalRaw : null);

  // If all known -> show final
  if (internalRawKnown !== null && ext !== null) {
  const finalPerc = finalPercentage(internalRawKnown, ext);
  const rounded = Math.round(finalPerc);
  const gObj = grades.find(g => rounded >= g[1] && rounded <= g[2]);
  const gradeLabel = gObj ? gObj[0] : 'N/A';

  // choose grade class same as later rows
  let gradeClass = '';
  if (gradeLabel === 'O') gradeClass = 'grade-bright';
  else if (['A+','A','B+','B'].includes(gradeLabel)) gradeClass = 'grade-good';
  else if (gradeLabel === 'F') gradeClass = 'grade-bad';
  else gradeClass = 'grade-warn';

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><span class="grade-pill ${gradeClass}">${gradeLabel}</span></td>
    <td>--</td>
    <td style="text-align:left">Final: ${finalPerc.toFixed(2)}% (rounded: ${rounded}%)</td>
    <td class="note-cell note-possible">Grade confirmed</td>`;

  tbody.appendChild(tr);
  return;
}

  // iterate grades
  grades.forEach(([grade, pMin, pMax]) => {
    const results = [pMin, pMax].map(target => {
      // internalWeighted known & ext unknown
      if (equivalentInternalRaw !== null && ext === null) {
        const internalW = internalWeightedFromRaw(equivalentInternalRaw);
        const neededEW = target - internalW;
        return { type: 'ext', value: (neededEW / externalWeight) * MAX.ext };
      }

      // ext known & internal unknown
      if (ext !== null && internalRawKnown === null) {
        const extW = externalWeightedFromRaw(ext);
        const neededIW = target - extW; // weighted out of 60
        const neededRaw = (neededIW / internalWeight) * internalRawTotal; // raw out of 110
        const suggestedCt1 = neededRaw * (MAX.ct1 / internalRawTotal);
        const suggestedCt2 = neededRaw * (MAX.ct2 / internalRawTotal);
        return { type: 'int_needed', value: neededRaw, weightedNeeded: neededIW, suggestion: { ct1: suggestedCt1, ct2: suggestedCt2 } };
      }

      // ct1 known, ct2 unknown, ext known
      if (!usingInternalWeighted && ct1 !== null && ct2 === null && ext !== null) {
        const extW = externalWeightedFromRaw(ext);
        const neededIR = ((target - extW) / internalWeight) * internalRawTotal;
        return { type: 'ct2', value: neededIR - ct1 };
      }

      // ct2 known, ct1 unknown, ext known
      if (!usingInternalWeighted && ct2 !== null && ct1 === null && ext !== null) {
        const extW = externalWeightedFromRaw(ext);
        const neededIR = ((target - extW) / internalWeight) * internalRawTotal;
        return { type: 'ct1', value: neededIR - ct2 };
      }

      // both CT known & ext unknown
      if (!usingInternalWeighted && ct1 !== null && ct2 !== null && ext === null) {
        const internalRaw = ct1 + ct2;
        const intW = internalWeightedFromRaw(internalRaw);
        const neededEW = target - intW;
        return { type: 'ext', value: (neededEW / externalWeight) * MAX.ext };
      }

      // nothing known
      if (!usingInternalWeighted && ct1 === null && ct2 === null && ext === null) {
        const intWmax = internalWeightedFromRaw(internalRawTotal);
        const needEWintMax = target - intWmax;
        const extIfInternalMax = (needEWintMax / externalWeight) * MAX.ext;

        const extWmax = externalWeightedFromRaw(MAX.ext);
        const needIRextMax = ((target - extWmax) / internalWeight) * internalRawTotal;

        return { type: 'both', extIfInternalMax, needInternalRawIfExtMax: needIRextMax, suggestion: { ct1: needIRextMax * (MAX.ct1 / internalRawTotal), ct2: needIRextMax * (MAX.ct2 / internalRawTotal) } };
      }

      return { type: 'na' };
    });

    const lo = results[0];
    const hi = results[1];

    // classify note using LOWER bound
    const noteInfo = classifyNoteByLower(lo, hi);

    // create row with requirement text
    const tr = document.createElement('tr');
    const reqHtml = `For ${pMin}% → ${fmtRequirement(lo)}<br>For ${pMax}% → ${fmtRequirement(hi)}`;
    tr.innerHTML = `
      <td><span class="grade-pill">${grade}</span></td>
      <td>${pMin}% - ${pMax}%</td>
      <td style="text-align:left">${reqHtml}</td>
      <td class="note-cell">${noteInfo.text}</td>`;

    tbody.appendChild(tr);

    // apply class to note cell
    const noteTd = tr.querySelector('td:last-child');
    if (noteTd) noteTd.className = noteInfo.className || 'note-cell';
  });
}

// ===============================
// UI EVENTS
// ===============================
[ct1In, ct2In, extIn, internalIn].forEach(i => i && i.addEventListener('input', compute));

themeToggle && themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
});

// THEME SWITCH
const themeSwitch = document.getElementById("themeSwitch");

themeSwitch.addEventListener("change", () => {
  document.body.classList.toggle("light", themeSwitch.checked);
});





resetBtn && resetBtn.addEventListener('click', () => {
  if (ct1In) ct1In.value = '';
  if (ct2In) ct2In.value = '';
  if (extIn) extIn.value = '';
  if (internalIn) internalIn.value = '';
  compute();
});

themeToggle && themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
});

calcInfo && calcInfo.addEventListener('click', () => {
  alert('Enter known fields. Leave unknown ones empty. Internal weighted overrides CT1+CT2.');
});

const ct1 = document.getElementById('ct1');     
const ct2 = document.getElementById('ct2');
const ext = document.getElementById('ext');
const internal = document.getElementById('internal');

ct1.addEventListener('input', () => {

  if (ct1.value < 0 || ct1.value > MAX.ct1) {
    alert(`CT1 must be between 0 and ${MAX.ct1}`);
    ct1.value = '';
  }
});

ct2.addEventListener('input', () => {
  if (ct2.value < 0 || ct2.value > MAX.ct2) {
    alert(`CT2 must be between 0 and ${MAX.ct2}`);
    ct2.value = '';
  }
});

ext.addEventListener('input', () => {
  if (ext.value < 0 || ext.value > MAX.ext) {
    alert(`End-Sem must be between 0 and ${MAX.ext}`);
    ext.value = '';
  }
});
internal.addEventListener('input', () => {
  if (internal.value < 0 || internal.value > internalWeight) {
    alert(`Internal Weighted must be between 0 and ${internalWeight}`);
    internal.value = '';
  }
});

// initial run
compute();
